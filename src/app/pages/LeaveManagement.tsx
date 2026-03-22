import { useEffect, useState } from "react";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { leaveService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";

export function LeaveManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [updatingLeaveId, setUpdatingLeaveId] = useState<number | null>(null);

  const { data, loading, error, refetch } = useApiQuery(() => leaveService.getLeaveData(), []);
  const leaveRequests = data?.requests ?? [];
  const leaveBalance = data?.balance ?? [];
  const leaveTypeOptions = data?.leave_types?.map((type) => type.name) ?? [];

  useEffect(() => {
    if (leaveType && !leaveTypeOptions.includes(leaveType)) {
      setLeaveType("");
    }
  }, [leaveType, leaveTypeOptions]);

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

  const resetForm = () => {
    setLeaveType("");
    setFromDate("");
    setToDate("");
    setReason("");
    setFormError(null);
  };

  const handleCreateLeave = async () => {
    if (leaveTypeOptions.length === 0) {
      setFormError("No leave types are configured. Please contact HR.");
      return;
    }

    if (!leaveType || !fromDate || !toDate) {
      setFormError("Please fill in leave type and dates.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      await leaveService.createLeave({
        type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        reason,
      });
      resetForm();
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to submit leave request.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: "Approved" | "Rejected") => {
    setUpdatingLeaveId(id);

    try {
      await leaveService.updateLeaveStatus(id, status);
      await refetch();
    } catch {
      // Keep UI pattern minimal; data error appears on next refetch if needed.
    } finally {
      setUpdatingLeaveId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leave Management</h1>
          <p className="text-gray-600 mt-1">Manage employee leave requests and balances</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Leave Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {formError}
                </div>
              )}
              <div>
                <Label htmlFor="leave-type">Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger id="leave-type" className="mt-2">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypeOptions.length === 0 ? (
                      <SelectItem value="__no_leave_types__" disabled>
                        No leave types configured
                      </SelectItem>
                    ) : (
                      leaveTypeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from-date">From Date</Label>
                  <Input id="from-date" type="date" className="mt-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="to-date">To Date</Label>
                  <Input id="to-date" type="date" className="mt-2" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for leave..."
                  className="mt-2"
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  onClick={() => void handleCreateLeave()}
                  disabled={submitting || leaveTypeOptions.length === 0}
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
        {leaveBalance.map((balance, index) => (
          <Card key={index} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{balance.type}</h3>
                <div className="w-10 h-10 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-[#2563EB]" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="font-medium text-gray-900">{balance.total} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used</span>
                  <span className="font-medium text-gray-900">{balance.used} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining</span>
                  <span className="font-medium text-[#10B981]">{balance.remaining} days</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div
                    className="bg-[#2563EB] h-2 rounded-full"
                    style={{ width: `${(balance.used / balance.total) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Loading leave requests...
                  </TableCell>
                </TableRow>
              )}
              {!loading && leaveRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No leave requests available.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                leaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {request.employee.split(" ").map((n) => n[0]).join("")}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900">{request.employee}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{request.type}</TableCell>
                    <TableCell className="text-gray-700">{request.from}</TableCell>
                    <TableCell className="text-gray-700">{request.to}</TableCell>
                    <TableCell className="font-medium text-gray-900">{request.days}</TableCell>
                    <TableCell className="text-gray-600 max-w-xs truncate">
                      {request.reason}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(request.status)} variant="secondary">
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.can_approve && request.status === "Pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-[#10B981] hover:bg-[#059669] text-white"
                            onClick={() => void handleStatusUpdate(request.id, "Approved")}
                            disabled={updatingLeaveId === request.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => void handleStatusUpdate(request.id, "Rejected")}
                            disabled={updatingLeaveId === request.id}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
