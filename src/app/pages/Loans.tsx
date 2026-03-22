import { useMemo, useState } from "react";
import { Plus, DollarSign, TrendingDown } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { loanService } from "../api/services";
import type { LoansData } from "../api/types";
import { useApiQuery } from "../hooks/useApiQuery";

type LoanFormState = {
  amount: string;
  purpose: string;
  requestDate: string;
  installments: string;
};

const defaultLoanFormState: LoanFormState = {
  amount: "",
  purpose: "",
  requestDate: new Date().toISOString().slice(0, 10),
  installments: "12",
};

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

export function Loans() {
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoansData["requests"][number] | null>(null);
  const [loanForm, setLoanForm] = useState<LoanFormState>(defaultLoanFormState);

  const { data, loading, error, refetch } = useApiQuery(() => loanService.getLoans(), []);

  const loanRequests = data?.requests ?? [];
  const stats = data?.stats ?? {
    total_loans: 0,
    active_loans: 0,
    pending_loans: 0,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const handleRequestLoan = async () => {
    if (!loanForm.amount.trim() || !loanForm.purpose.trim() || !loanForm.installments.trim()) {
      setRequestError("Amount, purpose, and installments are required.");
      return;
    }

    const amount = Number(loanForm.amount);
    const installments = Number(loanForm.installments);

    if (!Number.isFinite(amount) || amount <= 0) {
      setRequestError("Amount must be greater than 0.");
      return;
    }

    if (!Number.isInteger(installments) || installments < 1) {
      setRequestError("Installments must be at least 1.");
      return;
    }

    setRequestSubmitting(true);
    setRequestError(null);

    try {
      await loanService.createLoan({
        amount,
        purpose: loanForm.purpose.trim(),
        request_date: loanForm.requestDate || undefined,
        installments,
      });

      setRequestDialogOpen(false);
      setLoanForm(defaultLoanFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setRequestError(err.message);
      } else {
        setRequestError("Failed to submit loan request.");
      }
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleUpdateLoanStatus = async (loanId: number, status: "Approved" | "Rejected") => {
    setStatusUpdatingId(loanId);

    try {
      await loanService.updateLoanStatus(loanId, status);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update loan status.";
      window.alert(message);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const progressByLoanId = useMemo(() => {
    const map = new Map<number, number>();

    loanRequests.forEach((loan) => {
      const percentage = loan.installments > 0
        ? Math.min(100, Math.round((loan.paid_installments / loan.installments) * 100))
        : 0;
      map.set(loan.id, percentage);
    });

    return map;
  }, [loanRequests]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employee Loans</h1>
          <p className="text-gray-600 mt-1">Manage employee loan requests and repayments</p>
        </div>
        <Button
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
          onClick={() => {
            setRequestError(null);
            setRequestDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Request Loan
        </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Loans</p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(stats.total_loans)}
                </h3>
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
                <p className="text-sm text-gray-600 mb-1">Active Loans</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.active_loans}</h3>
              </div>
              <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Approval</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.pending_loans}</h3>
              </div>
              <div className="w-12 h-12 bg-[#F59E0B] bg-opacity-10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#F59E0B]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Loan Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-gray-500 mb-4">Loading loan requests...</div>}
          {!loading && loanRequests.length === 0 && (
            <div className="text-sm text-gray-500 mb-4">No loan requests yet.</div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Request Date</TableHead>
                <TableHead>Repayment Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loanRequests.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {loan.employee.split(" ").map((n) => n[0]).join("")}
                        </span>
                      </div>
                      <div className="font-medium text-gray-900">{loan.employee}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900">
                    {formatCurrency(loan.amount)}
                  </TableCell>
                  <TableCell className="text-gray-700">{loan.purpose}</TableCell>
                  <TableCell className="text-gray-600">{loan.request_date ?? "-"}</TableCell>
                  <TableCell>
                    {loan.status === "Approved" ? (
                      <div className="space-y-2 min-w-[150px]">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {loan.paid_installments}/{loan.installments}
                          </span>
                          <span className="font-medium text-gray-900">
                            {progressByLoanId.get(loan.id) ?? 0}%
                          </span>
                        </div>
                        <Progress value={progressByLoanId.get(loan.id) ?? 0} />
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(loan.status)} variant="secondary">
                      {loan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {loan.status === "Pending" && loan.can_approve && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-[#10B981] hover:bg-[#059669] text-white"
                          onClick={() => void handleUpdateLoanStatus(loan.id, "Approved")}
                          disabled={statusUpdatingId === loan.id}
                        >
                          {statusUpdatingId === loan.id ? "Updating..." : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => void handleUpdateLoanStatus(loan.id, "Rejected")}
                          disabled={statusUpdatingId === loan.id}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {loan.status === "Pending" && !loan.can_approve && (
                      <span className="text-xs text-gray-500">Awaiting approval</span>
                    )}
                    {loan.status === "Approved" && (
                      <Button size="sm" variant="outline" onClick={() => setSelectedLoan(loan)}>
                        View Details
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Loan</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {requestError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {requestError}
              </div>
            )}

            <div>
              <Label htmlFor="loan-amount">Loan Amount</Label>
              <Input
                id="loan-amount"
                type="number"
                min="1"
                className="mt-2"
                value={loanForm.amount}
                onChange={(event) => setLoanForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="loan-installments">Installments</Label>
              <Input
                id="loan-installments"
                type="number"
                min="1"
                className="mt-2"
                value={loanForm.installments}
                onChange={(event) => setLoanForm((prev) => ({ ...prev, installments: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="loan-date">Request Date</Label>
              <Input
                id="loan-date"
                type="date"
                className="mt-2"
                value={loanForm.requestDate}
                onChange={(event) => setLoanForm((prev) => ({ ...prev, requestDate: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="loan-purpose">Purpose</Label>
              <Textarea
                id="loan-purpose"
                className="mt-2"
                rows={3}
                value={loanForm.purpose}
                onChange={(event) => setLoanForm((prev) => ({ ...prev, purpose: event.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)} disabled={requestSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleRequestLoan()}
                disabled={requestSubmitting}
              >
                {requestSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedLoan)} onOpenChange={(open) => !open && setSelectedLoan(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
          </DialogHeader>

          {selectedLoan && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Employee</span>
                <span className="font-medium text-gray-900">{selectedLoan.employee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-medium text-gray-900">{formatCurrency(selectedLoan.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Payment</span>
                <span className="font-medium text-gray-900">{formatCurrency(selectedLoan.monthly_payment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Installments</span>
                <span className="font-medium text-gray-900">
                  {selectedLoan.paid_installments}/{selectedLoan.installments}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Repayment Progress</span>
                  <span className="font-medium text-gray-900">
                    {selectedLoan.installments > 0
                      ? Math.min(100, Math.round((selectedLoan.paid_installments / selectedLoan.installments) * 100))
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    selectedLoan.installments > 0
                      ? Math.min(100, Math.round((selectedLoan.paid_installments / selectedLoan.installments) * 100))
                      : 0
                  }
                />
              </div>
              <div>
                <span className="text-gray-600">Purpose</span>
                <p className="text-gray-900 mt-1">{selectedLoan.purpose}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
