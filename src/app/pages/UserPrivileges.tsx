import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { privilegeService } from "../api/services";
import type { UserPermissionTerm, UserPermissionTerms, UserPermissions } from "../api/types";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";

type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: UserPermissions;
  terms: UserPermissionTerms;
};

const toLabel = (permission: string) =>
  permission
    .split("_")
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(" ");

export function UserPrivileges() {
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";
  const canManagePrivileges = isAdmin || Boolean(user?.permissions?.user_privileges);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Partial<UserPermissions>>({});
  const [draftTerms, setDraftTerms] = useState<Partial<UserPermissionTerms>>({});
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiQuery(
    () => privilegeService.getUserPrivileges(),
    [],
    { skip: !canManagePrivileges },
  );

  const permissionKeys = useMemo(
    () => (data?.permissions_catalog ?? []) as Array<keyof UserPermissions>,
    [data],
  );

  const openEditor = (record: UserRecord) => {
    setSelectedUser(record);
    setDraftPermissions({ ...record.permissions });
    setDraftTerms({ ...record.terms });
    setActionError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setActionError(null);

    try {
      await privilegeService.updateUserPrivileges(selectedUser.id, draftPermissions, draftTerms);
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update user privileges.");
    } finally {
      setSaving(false);
    }
  };

  if (!canManagePrivileges) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 text-sm text-gray-600">
          You are not authorized to manage user privileges.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">User Privileges</h1>
        <p className="text-gray-600 mt-1">Control access for each user across all modules</p>
      </div>

      {(error || actionError) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="text-red-600">{error ?? actionError}</div>
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-gray-500">Loading user privileges...</div>}
          {!loading && (data?.users.length ?? 0) === 0 && (
            <div className="text-sm text-gray-500">No users found.</div>
          )}
          {!loading && (data?.users.length ?? 0) > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Enabled Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.map((record) => {
                  const enabledCount = permissionKeys.filter((key) => Boolean(record.permissions[key])).length;

                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900">{record.name}</div>
                        <div className="text-xs text-gray-500">{record.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{record.role}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {enabledCount} / {permissionKeys.length}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEditor(record)}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage Privileges: {selectedUser?.name ?? "User"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {permissionKeys.map((permissionKey) => (
              <div
                key={permissionKey}
                className="flex items-start justify-between p-3 border border-gray-200 rounded-lg gap-3"
              >
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">{toLabel(permissionKey)}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Terms</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        (draftTerms[permissionKey] ?? "accepted") === "accepted" ? "secondary" : "outline"
                      }
                      onClick={() =>
                        setDraftTerms((prev) => ({ ...prev, [permissionKey]: "accepted" as UserPermissionTerm }))
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        (draftTerms[permissionKey] ?? "accepted") === "rejected" ? "secondary" : "outline"
                      }
                      className={
                        (draftTerms[permissionKey] ?? "accepted") === "rejected"
                          ? "bg-red-100 text-red-700 hover:bg-red-100 border border-red-200"
                          : "border-red-200 text-red-700 hover:bg-red-50"
                      }
                      onClick={() =>
                        setDraftTerms((prev) => ({ ...prev, [permissionKey]: "rejected" as UserPermissionTerm }))
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Page Access</span>
                  <Switch
                    checked={Boolean(draftPermissions[permissionKey])}
                    onCheckedChange={(checked) =>
                      setDraftPermissions((prev) => ({ ...prev, [permissionKey]: checked }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Privileges"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
