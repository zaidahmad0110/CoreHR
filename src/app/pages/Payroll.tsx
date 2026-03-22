import { useEffect, useMemo, useState } from "react";
import { Download, DollarSign, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { employeeService, payrollService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";
import { printPayslipInvoice } from "../utils/printPayslipInvoice";

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString()}`;

export function Payroll() {
  const { user, loading: authLoading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: number; name: string } | null>(null);
  const [workflowSubmitting, setWorkflowSubmitting] = useState<"hr" | "finance" | null>(null);

  const canManagePayroll = useMemo(() => {
    if (!user) {
      return false;
    }

    const role = (user.role ?? "").toLowerCase();
    if (role === "admin" || role === "hr") {
      return true;
    }

    const department = (user.department ?? "").toLowerCase().trim();
    if (department === "human resources" || department === "hr" || department === "finance") {
      return true;
    }

    return (user.managed_departments ?? []).some(
      (managedDepartment) => managedDepartment.name.toLowerCase() === "finance",
    );
  }, [user]);

  const { data, loading, error, refetch } = useApiQuery(
    () => payrollService.getPayroll(selectedMonth),
    [selectedMonth],
    { skip: !canManagePayroll },
  );

  const {
    data: selfPayslipData,
    loading: selfPayslipLoading,
    error: selfPayslipError,
    refetch: refetchSelfPayslip,
  } = useApiQuery(
    () => employeeService.getPayslip(String(user?.employee_profile_id), selectedMonth),
    [user?.employee_profile_id, selectedMonth, canManagePayroll],
    { skip: canManagePayroll || !user?.employee_profile_id },
  );

  const {
    data: payslipData,
    loading: payslipLoading,
    error: payslipError,
    refetch: refetchPayslip,
  } = useApiQuery(
    () => employeeService.getPayslip(String(selectedEmployee?.id), selectedMonth),
    [selectedEmployee?.id, selectedMonth, payslipDialogOpen],
    { skip: !payslipDialogOpen || !selectedEmployee?.id },
  );

  useEffect(() => {
    if (!selectedMonth && data?.selected_month) {
      setSelectedMonth(data.selected_month);
    }
  }, [data, selectedMonth]);

  const summary = data?.summary ?? {
    total_payroll: 0,
    total_allowances: 0,
    total_deductions: 0,
  };

  const maxSelectableMonth = useMemo(() => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const payrollTrend = data?.trend ?? [];
  const employeePayroll = data?.employees ?? [];
  const payrollWorkflow = data?.workflow ?? null;
  const months = data?.available_months ?? [];
  const selectedMonthLabel =
    months.find((month) => month.value === selectedMonth)?.label ?? "Selected Month";

  const handleOpenPayslip = (employee: { id: number; employee: string }) => {
    setSelectedEmployee({ id: employee.id, name: employee.employee });
    setPayslipDialogOpen(true);
  };

  const handleSubmitPayrollByHr = async () => {
    if (!data?.selected_period_id) {
      return;
    }

    setWorkflowSubmitting("hr");
    try {
      await payrollService.submitPayrollByHr(data.selected_period_id);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit payroll.";
      window.alert(message);
    } finally {
      setWorkflowSubmitting(null);
    }
  };

  const handleApprovePayrollByFinance = async () => {
    if (!data?.selected_period_id) {
      return;
    }

    setWorkflowSubmitting("finance");
    try {
      await payrollService.approvePayrollByFinance(data.selected_period_id);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve payroll.";
      window.alert(message);
    } finally {
      setWorkflowSubmitting(null);
    }
  };

  const escapeCsvValue = (value: string | number) => {
    const text = String(value).replace(/"/g, '""');
    return `"${text}"`;
  };

  const handleExportPayroll = () => {
    if (employeePayroll.length === 0) {
      return;
    }

    const header = [
      "Employee",
      "Department",
      "Base Salary",
      "Allowances",
      "Deductions",
      "Net Salary",
      "Status",
      "Month",
    ];

    const rows = employeePayroll.map((emp) => [
      emp.employee,
      emp.department,
      emp.base_salary,
      emp.allowances,
      emp.deductions,
      emp.net_salary,
      emp.status,
      selectedMonthLabel,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `payroll-${selectedMonth ?? "latest"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return <div className="text-gray-600">Loading payroll...</div>;
  }

  if (!canManagePayroll) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
            <p className="text-gray-600 mt-1">View your payslip</p>
          </div>
          <div className="w-56">
            <Input
              type="month"
              value={selectedMonth ?? ""}
              onChange={(event) => setSelectedMonth(event.target.value || undefined)}
              max={maxSelectableMonth}
            />
          </div>
        </div>

        {(selfPayslipError || error) && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="text-red-600">{selfPayslipError ?? error}</div>
              <Button variant="outline" onClick={() => void refetchSelfPayslip()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>My Payslip</CardTitle>
          </CardHeader>
          <CardContent>
            {selfPayslipLoading && (
              <div className="text-sm text-gray-500">Loading payslip...</div>
            )}

            {!selfPayslipLoading && !selfPayslipData && !selfPayslipError && (
              <div className="text-sm text-gray-500">No payslip found.</div>
            )}

            {selfPayslipData && (
              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{selfPayslipData.employee.name}</div>
                      <div className="text-sm text-gray-600">{selfPayslipData.employee.employee_id}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {selfPayslipData.employee.department} - {selfPayslipData.employee.job_title}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        selfPayslipData.payslip.status === "Paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }
                    >
                      {selfPayslipData.payslip.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-700">Month: {selfPayslipData.payslip.month}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-600">Base Salary</div>
                    <div className="text-right font-medium">{formatMoney(selfPayslipData.payslip.base_salary)}</div>
                    <div className="text-gray-600">Allowances</div>
                    <div className="text-right font-medium text-green-600">
                      +{formatMoney(selfPayslipData.payslip.allowances)}
                    </div>
                    <div className="text-gray-600">Deductions</div>
                    <div className="text-right font-medium text-red-600">
                      -{formatMoney(selfPayslipData.payslip.deductions)}
                    </div>
                    <div className="text-gray-900 font-semibold border-t pt-2">Net Salary</div>
                    <div className="text-right font-semibold text-gray-900 border-t pt-2">
                      {formatMoney(selfPayslipData.payslip.net_salary)}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => void refetchSelfPayslip()}>
                      Refresh
                    </Button>
                    <Button
                      className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                      onClick={() => printPayslipInvoice(selfPayslipData)}
                    >
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
          <p className="text-gray-600 mt-1">Manage employee salaries and payroll</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
            onClick={handleExportPayroll}
            disabled={employeePayroll.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Payroll
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="text-red-600">{error}</div>
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {payrollWorkflow && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">Payroll Workflow</div>
              <div className="text-base font-semibold text-gray-900 mt-1">{payrollWorkflow.status_label}</div>
              <div className="text-xs text-gray-500 mt-1">
                {payrollWorkflow.hr_submitted_at
                  ? `HR submitted: ${new Date(payrollWorkflow.hr_submitted_at).toLocaleString()}`
                  : "Waiting for HR submission"}
              </div>
              {payrollWorkflow.finance_approved_at && (
                <div className="text-xs text-gray-500 mt-1">
                  Finance approved: {new Date(payrollWorkflow.finance_approved_at).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="bg-[#10B981] hover:bg-[#059669] text-white"
                onClick={() => void handleSubmitPayrollByHr()}
                disabled={
                  workflowSubmitting !== null
                  || !payrollWorkflow.can_submit_hr
                  || payrollWorkflow.status_key !== "awaiting_hr_submission"
                }
              >
                {workflowSubmitting === "hr" ? "Submitting..." : "Submit as HR"}
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleApprovePayrollByFinance()}
                disabled={
                  workflowSubmitting !== null
                  || !payrollWorkflow.can_approve_finance
                  || payrollWorkflow.status_key !== "awaiting_finance_approval"
                }
              >
                {workflowSubmitting === "finance" ? "Approving..." : "Finance Final Approval"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Payroll</p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {formatMoney(summary.total_payroll)}
                </h3>
                <p className="text-sm text-green-600 mt-1">Current selected month</p>
              </div>
              <div className="w-12 h-12 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Allowances</p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {formatMoney(summary.total_allowances)}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Across all employees</p>
              </div>
              <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Deductions</p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {formatMoney(summary.total_deductions)}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Tax, insurance, etc.</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Payroll Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={payrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Bar key="amount" dataKey="amount" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>
            Employee Payroll - {selectedMonthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Loading payroll...
                  </TableCell>
                </TableRow>
              )}
              {!loading && employeePayroll.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No payroll data found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                employeePayroll.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {emp.employee.split(" ").map((n) => n[0]).join("")}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900">{emp.employee}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{emp.department}</TableCell>
                    <TableCell className="text-gray-700">{formatMoney(emp.base_salary)}</TableCell>
                    <TableCell className="text-green-600">+{formatMoney(emp.allowances)}</TableCell>
                    <TableCell className="text-red-600">-{formatMoney(emp.deductions)}</TableCell>
                    <TableCell className="font-semibold text-gray-900">
                      {formatMoney(emp.net_salary)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          emp.status === "Paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }
                        variant="secondary"
                      >
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPayslip(emp)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Payslip
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={payslipDialogOpen} onOpenChange={setPayslipDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Employee Payslip{selectedEmployee ? ` - ${selectedEmployee.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {payslipLoading && <div className="text-sm text-gray-500">Loading payslip...</div>}

            {payslipError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {payslipError}
              </div>
            )}

            {payslipData && (
              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{payslipData.employee.name}</div>
                      <div className="text-sm text-gray-600">{payslipData.employee.employee_id}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {payslipData.employee.department} - {payslipData.employee.job_title}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        payslipData.payslip.status === "Paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }
                    >
                      {payslipData.payslip.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-700">Month: {payslipData.payslip.month}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-gray-600">Base Salary</div>
                    <div className="text-right font-medium">{formatMoney(payslipData.payslip.base_salary)}</div>
                    <div className="text-gray-600">Allowances</div>
                    <div className="text-right font-medium text-green-600">
                      +{formatMoney(payslipData.payslip.allowances)}
                    </div>
                    <div className="text-gray-600">Deductions</div>
                    <div className="text-right font-medium text-red-600">
                      -{formatMoney(payslipData.payslip.deductions)}
                    </div>
                    <div className="text-gray-900 font-semibold border-t pt-2">Net Salary</div>
                    <div className="text-right font-semibold text-gray-900 border-t pt-2">
                      {formatMoney(payslipData.payslip.net_salary)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => void refetchPayslip()}>
                Refresh
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => printPayslipInvoice(payslipData)}
                disabled={!payslipData}
              >
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

