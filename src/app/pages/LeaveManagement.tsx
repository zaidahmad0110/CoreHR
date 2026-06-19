import { useEffect, useState } from "react";
import { Plus, Calendar as CalendarIcon, Upload } from "lucide-react";
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
import { openBlobInNewTab } from "../utils/openInNewTab";

export function LeaveManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [requestUnit, setRequestUnit] = useState<"day" | "hour">("day");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [reason, setReason] = useState("");
  const [sickLeavePhoto, setSickLeavePhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [updatingLeaveId, setUpdatingLeaveId] = useState<number | null>(null);
  const [viewingPhotoId, setViewingPhotoId] = useState<number | null>(null);

  const { data, loading, error, refetch } = useApiQuery(() => leaveService.getLeaveData(), []);
  const leaveRequests = data?.requests ?? [];
  const leaveBalance = data?.balance ?? [];
  const employeeLeaveBalances = data?.employee_balances ?? [];
  const leaveTypeOptions = data?.leave_types?.map((type) => type.name) ?? [];
  const isSickLeaveSelected = leaveType.toLowerCase().includes("sick");

  useEffect(() => {
    if (leaveType && !leaveTypeOptions.includes(leaveType)) {
      setLeaveType("");
    }
  }, [leaveType, leaveTypeOptions]);

  useEffect(() => {
    if (!isSickLeaveSelected) {
      setSickLeavePhoto(null);
    }
  }, [isSickLeaveSelected]);

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
    setRequestUnit("day");
    setFromDate("");
    setToDate("");
    setFromTime("");
    setToTime("");
    setReason("");
    setSickLeavePhoto(null);
    setFormError(null);
  };

  const handleCreateLeave = async () => {
    if (leaveTypeOptions.length === 0) {
      setFormError("No leave types are configured. Please contact HR.");
      return;
    }

    if (!leaveType || !fromDate || (requestUnit === "day" && !toDate)) {
      setFormError("Please fill in leave type and dates.");
      return;
    }

    if (requestUnit === "hour" && (!fromTime || !toTime)) {
      setFormError("Please fill in hourly leave from and to time.");
      return;
    }

    if (requestUnit === "hour" && toTime <= fromTime) {
      setFormError("To time must be after from time.");
      return;
    }

    if (isSickLeaveSelected && !sickLeavePhoto) {
      setFormError("Please upload a sick leave photo.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      await leaveService.createLeave({
        type: leaveType,
        request_unit: requestUnit,
        from_date: fromDate,
        to_date: requestUnit === "day" ? toDate : undefined,
        from_time: requestUnit === "hour" ? fromTime : undefined,
        to_time: requestUnit === "hour" ? toTime : undefined,
        reason,
        sick_leave_photo: isSickLeaveSelected ? sickLeavePhoto ?? undefined : undefined,
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

  const handleViewSickLeavePhoto = async (id: number) => {
    setViewingPhotoId(id);

    try {
      const file = await leaveService.viewSickLeavePhoto(id);
      openBlobInNewTab(file.blob);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open sick leave photo.";
      window.alert(message);
    } finally {
      setViewingPhotoId(null);
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
              <div>
                <Label htmlFor="request-unit">Request Duration</Label>
                <Select value={requestUnit} onValueChange={(value) => setRequestUnit(value as "day" | "hour")}>
                  <SelectTrigger id="request-unit" className="mt-2">
                    <SelectValue placeholder="Select request duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Full Day</SelectItem>
                    <SelectItem value="hour">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {requestUnit === "day" ? (
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
              ) : (
                <>
                  <div>
                    <Label htmlFor="hourly-date">Leave Date</Label>
                    <Input id="hourly-date" type="date" className="mt-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="from-time">From Time</Label>
                      <Input id="from-time" type="time" className="mt-2" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="to-time">To Time</Label>
                      <Input id="to-time" type="time" className="mt-2" value={toTime} onChange={(e) => setToTime(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
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
              {isSickLeaveSelected && (
                <div>
                  <Label htmlFor="sick-leave-photo">Sick Leave Photo</Label>
                  <Input
                    id="sick-leave-photo"
                    type="file"
                    className="mt-2"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={(event) => setSickLeavePhoto(event.target.files?.[0] ?? null)}
                  />
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    JPG, PNG, or WEBP up to 5 MB is required for sick leave.
                  </div>
                </div>
              )}
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
                <TableHead>Duration</TableHead>
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
                    <TableCell className="font-medium text-gray-900">
                      {request.duration_label ?? request.days}
                    </TableCell>
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
                          {request.sick_leave_photo_available && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleViewSickLeavePhoto(request.id)}
                              disabled={viewingPhotoId === request.id}
                            >
                              {viewingPhotoId === request.id ? "Opening..." : "View Photo"}
                            </Button>
                          )}
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
                      {(!request.can_approve || request.status !== "Pending") && request.sick_leave_photo_available && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleViewSickLeavePhoto(request.id)}
                          disabled={viewingPhotoId === request.id}
                        >
                          {viewingPhotoId === request.id ? "Opening..." : "View Photo"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {employeeLeaveBalances.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Employee Leave Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeLeaveBalances.flatMap((employeeBalance) =>
                  employeeBalance.balances.map((balance, balanceIndex) => (
                    <TableRow key={`${employeeBalance.employee_id}-${balance.type}`}>
                      <TableCell className="font-medium text-gray-900">
                        {balanceIndex === 0 ? employeeBalance.employee : ""}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {balanceIndex === 0 ? employeeBalance.department : ""}
                      </TableCell>
                      <TableCell className="text-gray-700">{balance.type}</TableCell>
                      <TableCell className="text-gray-700">{balance.total} days</TableCell>
                      <TableCell className="text-gray-700">{balance.used} days</TableCell>
                      <TableCell className="font-medium text-[#10B981]">{balance.remaining} days</TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
