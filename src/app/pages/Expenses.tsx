import { useState } from "react";
import { Plus, Upload, DollarSign } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { expenseService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";
import { openBlobInNewTab } from "../utils/openInNewTab";

type ExpenseFormState = {
  category: string;
  amount: string;
  expenseDate: string;
  description: string;
  receipt: File | null;
};

const defaultExpenseFormState: ExpenseFormState = {
  category: "",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  description: "",
  receipt: null,
};

const expenseCategoryOptions = [
  "Travel",
  "Equipment",
  "Meals",
  "Training",
  "Office Supplies",
  "Accommodation",
  "Transport",
  "Other",
];

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

export function Expenses() {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(defaultExpenseFormState);
  const [submitSubmitting, setSubmitSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [viewingReceiptId, setViewingReceiptId] = useState<number | null>(null);
  const [viewedReceiptIds, setViewedReceiptIds] = useState<number[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingClaimId, setRejectingClaimId] = useState<number | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiQuery(() => expenseService.getExpenses(), []);

  const claims = data?.claims ?? [];
  const stats = data?.stats ?? {
    total_amount: 0,
    pending_count: 0,
    approved_count: 0,
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

  const handleSubmitExpense = async () => {
    if (!form.category.trim() || !form.amount.trim() || !form.expenseDate || !form.description.trim()) {
      setSubmitError("Category, amount, date, and description are required.");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitError("Amount must be greater than 0.");
      return;
    }

    setSubmitSubmitting(true);
    setSubmitError(null);

    try {
      await expenseService.createExpense({
        category: form.category.trim(),
        amount,
        expense_date: form.expenseDate,
        description: form.description.trim(),
        receipt: form.receipt ?? undefined,
      });

      setSubmitDialogOpen(false);
      setForm(defaultExpenseFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to submit expense claim.");
      }
    } finally {
      setSubmitSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: "Approved" | "Rejected") => {
    setStatusUpdatingId(id);

    try {
      await expenseService.updateExpenseStatus(id, status);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update expense status.";
      window.alert(message);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openRejectDialog = (claimId: number) => {
    setRejectingClaimId(claimId);
    setRejectionNote("");
    setRejectionError(null);
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingClaimId) {
      return;
    }

    const note = rejectionNote.trim();
    if (!note) {
      setRejectionError("Rejection note is required.");
      return;
    }

    setStatusUpdatingId(rejectingClaimId);
    setRejectionError(null);

    try {
      await expenseService.updateExpenseStatus(rejectingClaimId, "Rejected", note);
      setRejectDialogOpen(false);
      setRejectingClaimId(null);
      setRejectionNote("");
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reject expense claim.";
      setRejectionError(message);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleViewReceipt = async (id: number) => {
    setViewingReceiptId(id);

    try {
      const file = await expenseService.viewReceipt(id);
      openBlobInNewTab(file.blob);

      setViewedReceiptIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open receipt.";
      window.alert(message);
    } finally {
      setViewingReceiptId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Expense Management</h1>
          <p className="text-gray-600 mt-1">Track and manage expense claims</p>
        </div>
        <Button
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
          onClick={() => {
            setSubmitError(null);
            setSubmitDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Submit Expense
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
                <p className="text-sm text-gray-600 mb-1">Total Expenses</p>
                <h3 className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(stats.total_amount)}
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
                <p className="text-sm text-gray-600 mb-1">Pending Approval</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.pending_count}</h3>
              </div>
              <div className="w-12 h-12 bg-[#F59E0B] bg-opacity-10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#F59E0B]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Approved</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.approved_count}</h3>
              </div>
              <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Expense Claims</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-gray-500 mb-4">Loading expense claims...</div>}
          {!loading && claims.length === 0 && (
            <div className="text-sm text-gray-500 mb-4">No expense claims yet.</div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {claim.employee.split(" ").map((n) => n[0]).join("")}
                        </span>
                      </div>
                      <div className="font-medium text-gray-900">{claim.employee}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-700">{claim.category}</TableCell>
                  <TableCell className="text-gray-600 max-w-xs truncate">
                    {claim.description}
                  </TableCell>
                  <TableCell className="text-gray-700">{claim.date ?? "-"}</TableCell>
                  <TableCell className="font-semibold text-gray-900">
                    {formatCurrency(claim.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(claim.status)} variant="secondary">
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {claim.status === "Pending" && claim.can_approve && (
                      <div className="flex flex-wrap items-center gap-2">
                        {claim.receipt_available && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleViewReceipt(claim.id)}
                            disabled={viewingReceiptId === claim.id}
                          >
                            {viewingReceiptId === claim.id ? "Opening..." : "View Receipt"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="bg-[#10B981] hover:bg-[#059669] text-white"
                          onClick={() => void handleUpdateStatus(claim.id, "Approved")}
                          disabled={
                            statusUpdatingId === claim.id
                            || (claim.receipt_available && !viewedReceiptIds.includes(claim.id))
                          }
                        >
                          {statusUpdatingId === claim.id ? "Updating..." : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => openRejectDialog(claim.id)}
                          disabled={
                            statusUpdatingId === claim.id
                            || (claim.receipt_available && !viewedReceiptIds.includes(claim.id))
                          }
                        >
                          Reject
                        </Button>
                        {claim.receipt_available && !viewedReceiptIds.includes(claim.id) && (
                          <span className="text-xs text-amber-600">
                            View receipt before approval.
                          </span>
                        )}
                      </div>
                    )}
                    {claim.status === "Pending" && !claim.can_approve && (
                      <div className="flex items-center gap-2">
                        {claim.receipt_available && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleViewReceipt(claim.id)}
                            disabled={viewingReceiptId === claim.id}
                          >
                            {viewingReceiptId === claim.id ? "Opening..." : "View Receipt"}
                          </Button>
                        )}
                        <span className="text-xs text-gray-500">Awaiting approval</span>
                      </div>
                    )}
                    {claim.status !== "Pending" && claim.receipt_available && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleViewReceipt(claim.id)}
                        disabled={viewingReceiptId === claim.id}
                      >
                        {viewingReceiptId === claim.id ? "Opening..." : "View Receipt"}
                      </Button>
                    )}
                    {claim.status !== "Pending" && !claim.receipt_available && (
                      <span className="text-xs text-gray-500">No receipt</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) {
            setRejectionError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject Expense Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {rejectionError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {rejectionError}
              </div>
            )}
            <div>
              <Label htmlFor="expense-rejection-note">Rejection Note</Label>
              <Textarea
                id="expense-rejection-note"
                className="mt-2"
                rows={4}
                placeholder="Enter the reason for rejection..."
                value={rejectionNote}
                onChange={(event) => setRejectionNote(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
                disabled={statusUpdatingId === rejectingClaimId}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => void handleConfirmReject()}
                disabled={statusUpdatingId === rejectingClaimId}
              >
                {statusUpdatingId === rejectingClaimId ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Expense Claim</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {submitError}
              </div>
            )}

            <div>
              <Label htmlFor="expense-category">Category</Label>
              <Select
                value={form.category || undefined}
                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="expense-category" className="mt-2">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0.01"
                step="0.01"
                className="mt-2"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="expense-date">Expense Date</Label>
              <Input
                id="expense-date"
                type="date"
                className="mt-2"
                value={form.expenseDate}
                onChange={(event) => setForm((prev) => ({ ...prev, expenseDate: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="expense-description">Description</Label>
              <Textarea
                id="expense-description"
                className="mt-2"
                rows={3}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="expense-receipt">Receipt (optional)</Label>
              <Input
                id="expense-receipt"
                type="file"
                className="mt-2"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => setForm((prev) => ({ ...prev, receipt: event.target.files?.[0] ?? null }))}
              />
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Upload className="w-3 h-3" />
                PDF, JPG, JPEG, PNG up to 5 MB
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} disabled={submitSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSubmitExpense()}
                disabled={submitSubmitting}
              >
                {submitSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
