import { useMemo, useState } from "react";
import { Plus, Monitor, Laptop, Smartphone, Pencil, Trash2, Upload, Download } from "lucide-react";
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
import { assetService, employeeService } from "../api/services";
import type { AssetsData } from "../api/types";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";

type AssetFormState = {
  name: string;
  type: string;
  serialNumber: string;
  assignedEmployeeId: string;
  assignedDate: string;
};

const defaultAssetFormState: AssetFormState = {
  name: "",
  type: "Laptop",
  serialNumber: "",
  assignedEmployeeId: "none",
  assignedDate: new Date().toISOString().slice(0, 10),
};

const typeOptions = ["Laptop", "Phone", "Tablet", "Monitor", "Other"];

const getAssetTypeIcon = (type: string) => {
  const normalized = type.toLowerCase();

  if (normalized === "laptop") {
    return <Laptop className="w-4 h-4 text-gray-600" />;
  }

  if (normalized === "phone") {
    return <Smartphone className="w-4 h-4 text-gray-600" />;
  }

  return <Monitor className="w-4 h-4 text-gray-600" />;
};

export function Assets() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [assetForm, setAssetForm] = useState<AssetFormState>(defaultAssetFormState);
  const [editingAsset, setEditingAsset] = useState<AssetsData["items"][number] | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiQuery(() => assetService.getAssets(), []);
  const { data: employees } = useApiQuery(() => employeeService.getEmployees({}), []);

  const assets = data?.items ?? [];
  const stats = data?.stats ?? {
    total: 0,
    assigned: 0,
    available: 0,
  };

  const canManageAssets = useMemo(() => {
    if (!user) {
      return false;
    }

    const role = (user.role ?? "").toLowerCase();
    const jobTitle = (user.job_title ?? "").toLowerCase();
    if (["admin", "ceo", "gm", "general manager"].includes(role)) {
      return true;
    }

    if (["ceo", "chief executive officer", "gm", "general manager"].includes(jobTitle)) {
      return true;
    }

    return (user.department ?? "").toLowerCase() === "human resources";
  }, [user]);

  const openCreateDialog = () => {
    setDialogMode("create");
    setEditingAsset(null);
    setAssetForm(defaultAssetFormState);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (asset: AssetsData["items"][number]) => {
    setDialogMode("edit");
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      type: asset.type || "Other",
      serialNumber: asset.serial_number,
      assignedEmployeeId: asset.assigned_employee_id ? String(asset.assigned_employee_id) : "none",
      assignedDate: asset.assigned_date_iso ?? new Date().toISOString().slice(0, 10),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveAsset = async () => {
    if (!canManageAssets) {
      setFormError("Only Admin or HR can manage assets.");
      return;
    }

    if (!assetForm.name.trim() || !assetForm.serialNumber.trim()) {
      setFormError("Asset name and serial number are required.");
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      name: assetForm.name.trim(),
      asset_type: assetForm.type.trim() || undefined,
      serial_number: assetForm.serialNumber.trim(),
      employee_id: assetForm.assignedEmployeeId !== "none" ? Number(assetForm.assignedEmployeeId) : undefined,
      assigned_date: assetForm.assignedEmployeeId !== "none"
        ? assetForm.assignedDate || undefined
        : undefined,
    };

    try {
      if (dialogMode === "create") {
        await assetService.createAsset(payload);
      } else if (editingAsset) {
        await assetService.updateAsset(editingAsset.id, payload);
      }

      setDialogOpen(false);
      setEditingAsset(null);
      setAssetForm(defaultAssetFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to save asset.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteAsset = async (asset: AssetsData["items"][number]) => {
    const shouldDelete = window.confirm(`Delete asset "${asset.name}"? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setDeletingAssetId(asset.id);

    try {
      await assetService.deleteAsset(asset.id);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete asset.";
      window.alert(message);
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleImportCsv = async () => {
    if (!canManageAssets) {
      setImportError("Only Admin or HR can import assets.");
      return;
    }

    if (!importFile) {
      setImportError("Please select a CSV file.");
      return;
    }

    setImportSubmitting(true);
    setImportError(null);

    try {
      const result = await assetService.importCsv(importFile);
      const errorSuffix = result.errors.length > 0 ? ` (${result.errors.length} row errors)` : "";

      setImportFeedback(
        `CSV imported: ${result.created} created, ${result.skipped} skipped${errorSuffix}.`,
      );

      if (result.errors.length > 0) {
        const firstErrors = result.errors.slice(0, 5).join("\n");
        window.alert(`Some rows were skipped:\n${firstErrors}`);
      }

      setImportDialogOpen(false);
      setImportFile(null);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setImportError(err.message);
      } else {
        setImportError("Failed to import assets CSV.");
      }
    } finally {
      setImportSubmitting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/assets-import-template.csv";
    link.download = "assets-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Asset Management</h1>
          <p className="text-gray-600 mt-1">Track company assets and equipment</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setImportError(null);
              setImportDialogOpen(true);
            }}
            disabled={!canManageAssets}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
            onClick={openCreateDialog}
            disabled={!canManageAssets}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {importFeedback && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl">
            {importFeedback}
          </CardContent>
        </Card>
      )}

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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Assets</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.total}</h3>
              </div>
              <div className="w-12 h-12 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                <Monitor className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Assigned</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.assigned}</h3>
              </div>
              <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-lg flex items-center justify-center">
                <Laptop className="w-6 h-6 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Available</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.available}</h3>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Monitor className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>All Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-gray-500 mb-4">Loading assets...</div>}
          {!loading && assets.length === 0 && (
            <div className="text-sm text-gray-500 mb-4">No assets available.</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Status</TableHead>
                {canManageAssets && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium text-gray-900">{asset.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getAssetTypeIcon(asset.type)}
                      <span className="text-gray-700">{asset.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 font-mono text-sm">
                    {asset.serial_number}
                  </TableCell>
                  <TableCell className="text-gray-700">
                    {asset.assigned_to || "-"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {asset.assigned_date || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        asset.status === "Assigned"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }
                      variant="secondary"
                    >
                      {asset.status}
                    </Badge>
                  </TableCell>
                  {canManageAssets && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(asset)}
                          disabled={deletingAssetId === asset.id}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => void handleDeleteAsset(asset)}
                          disabled={deletingAssetId === asset.id}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {deletingAssetId === asset.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Add Asset" : "Edit Asset"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="asset-name">Asset Name</Label>
                <Input
                  id="asset-name"
                  className="mt-2"
                  value={assetForm.name}
                  onChange={(event) => setAssetForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="asset-type">Type</Label>
                <Select
                  value={assetForm.type}
                  onValueChange={(value) => setAssetForm((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger id="asset-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="asset-serial">Serial Number</Label>
                <Input
                  id="asset-serial"
                  className="mt-2"
                  value={assetForm.serialNumber}
                  onChange={(event) => setAssetForm((prev) => ({ ...prev, serialNumber: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="asset-employee">Assigned Employee</Label>
                <Select
                  value={assetForm.assignedEmployeeId}
                  onValueChange={(value) => setAssetForm((prev) => ({ ...prev, assignedEmployeeId: value }))}
                >
                  <SelectTrigger id="asset-employee" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(employees ?? []).map((employee) => (
                      <SelectItem key={employee.id} value={String(employee.id)}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="asset-assigned-date">Assigned Date</Label>
                <Input
                  id="asset-assigned-date"
                  type="date"
                  className="mt-2"
                  value={assetForm.assignedDate}
                  onChange={(event) => setAssetForm((prev) => ({ ...prev, assignedDate: event.target.value }))}
                  disabled={assetForm.assignedEmployeeId === "none"}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={formSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveAsset()}
                disabled={formSubmitting}
              >
                {formSubmitting
                  ? dialogMode === "create" ? "Adding..." : "Saving..."
                  : dialogMode === "create" ? "Add Asset" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Assets From CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {importError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {importError}
              </div>
            )}

            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
              Required columns: <span className="font-medium">name, serial_number</span>.
              Optional: <span className="font-medium">asset_type/type, employee_id, employee_email, assigned_date</span>.
            </div>

            <div className="flex justify-start">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div>
              <Label htmlFor="assets-csv-file">CSV File</Label>
              <Input
                id="assets-csv-file"
                type="file"
                className="mt-2"
                accept=".csv,text/csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setImportDialogOpen(false);
                  setImportFile(null);
                }}
                disabled={importSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleImportCsv()}
                disabled={importSubmitting}
              >
                {importSubmitting ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
