import { useMemo, useState } from "react";
import { Plus, Building2, Users, Pencil, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { employeeService, organizationService } from "../api/services";
import type { BranchItem, DepartmentItem, EmployeeListItem, OrganizationChartPosition } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

type DepartmentFormState = {
  name: string;
  managerName: string;
  managerSelection: string;
};

type BranchFormState = {
  name: string;
  location: string;
  managerName: string;
  managerSelection: string;
};

type OrganizationChartFormState = {
  ceoId?: number;
  ceoRoleTitle: string;
  ceoPersonName: string;
  ceoPersonSelection: string;
  executives: Array<{
    localId: string;
    id?: number;
    roleTitle: string;
    personName: string;
    personSelection: string;
    department: string;
  }>;
};

const defaultDepartmentFormState: DepartmentFormState = {
  name: "",
  managerName: "",
  managerSelection: "none",
};

const defaultBranchFormState: BranchFormState = {
  name: "",
  location: "",
  managerName: "",
  managerSelection: "none",
};

const defaultChartFallback = {
  ceo: {
    id: 0,
    role_key: "ceo",
    role_title: "Chief Executive Officer",
    person_name: "John Doe",
    department: null,
  } as OrganizationChartPosition,
  executives: [
    {
      id: 0,
      role_key: "cto",
      role_title: "CTO",
      person_name: "David Martinez",
      department: "Engineering",
    },
    {
      id: 0,
      role_key: "cpo",
      role_title: "CPO",
      person_name: "Michael Chen",
      department: "Product",
    },
    {
      id: 0,
      role_key: "cfo",
      role_title: "CFO",
      person_name: "Robert Taylor",
      department: "Finance",
    },
  ] as OrganizationChartPosition[],
};

const normalizeName = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export function CompanyStructure() {
  const { user } = useAuth();
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [departmentMode, setDepartmentMode] = useState<"create" | "edit">("create");
  const [editingDepartment, setEditingDepartment] = useState<DepartmentItem | null>(null);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(defaultDepartmentFormState);
  const [departmentSubmitting, setDepartmentSubmitting] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<number | null>(null);

  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchMode, setBranchMode] = useState<"create" | "edit">("create");
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [branchForm, setBranchForm] = useState<BranchFormState>(defaultBranchFormState);
  const [branchSubmitting, setBranchSubmitting] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [deletingBranchId, setDeletingBranchId] = useState<number | null>(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [chartForm, setChartForm] = useState<OrganizationChartFormState | null>(null);
  const [chartSubmitting, setChartSubmitting] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiQuery(
    async () => {
      const [departments, branches, organizationChart] = await Promise.all([
        organizationService.getDepartments(),
        organizationService.getBranches(),
        organizationService.getOrganizationChart(),
      ]);

      const employees = await employeeService.getEmployees({});

      return { departments, branches, organizationChart, employees };
    },
    [],
  );

  const departments = data?.departments ?? [];
  const branches = data?.branches ?? [];
  const organizationChart = data?.organizationChart;
  const employees = data?.employees ?? [];
  const ceoNode = organizationChart?.ceo ?? defaultChartFallback.ceo;
  const executiveNodes = organizationChart
    ? organizationChart.executives
    : defaultChartFallback.executives;

  const canManageStructure = useMemo(() => {
    if (!user) {
      return false;
    }

    if ((user.role ?? "").toLowerCase() === "admin") {
      return true;
    }

    if (!user.permissions?.company_structure) {
      return false;
    }

    const currentEmployee = employees.find((employee) => normalizeName(employee.email) === normalizeName(user.email));
    const userNames = new Set(
      [user.name, currentEmployee?.name]
        .map((name) => normalizeName(name))
        .filter(Boolean),
    );
    const chartNames = new Set(
      [ceoNode, ...executiveNodes]
        .map((node) => normalizeName(node.person_name))
        .filter(Boolean),
    );
    const isOnOrganizationChart = [...userNames].some((name) => chartNames.has(name));

    if (!isOnOrganizationChart) {
      return false;
    }

    return true;
  }, [ceoNode, employees, executiveNodes, user]);

  const resolvePersonSelection = (personName: string) => {
    const matchedEmployee = employees.find((employee) => employee.name === personName);
    if (matchedEmployee) {
      return String(matchedEmployee.id);
    }

    return personName.trim() ? `custom:${personName}` : "none";
  };

  const openCreateDepartmentDialog = () => {
    setDepartmentMode("create");
    setEditingDepartment(null);
    setDepartmentForm(defaultDepartmentFormState);
    setDepartmentError(null);
    setDepartmentDialogOpen(true);
  };

  const openEditDepartmentDialog = (department: DepartmentItem) => {
    const matchedManager = employees.find(
      (employee) => employee.name === department.manager || employee.email === department.manager,
    );

    setDepartmentMode("edit");
    setEditingDepartment(department);
    setDepartmentForm({
      name: department.name,
      managerName: department.manager === "N/A" ? "" : department.manager,
      managerSelection: matchedManager ? String(matchedManager.id) : "none",
    });
    setDepartmentError(null);
    setDepartmentDialogOpen(true);
  };

  const handleSaveDepartment = async () => {
    if (!canManageStructure) {
      setDepartmentError("You need company structure access and an Organization Chart role to edit.");
      return;
    }

    if (!departmentForm.name.trim()) {
      setDepartmentError("Department name is required.");
      return;
    }

    setDepartmentSubmitting(true);
    setDepartmentError(null);

    try {
      const payload = {
        name: departmentForm.name.trim(),
        manager_name: departmentForm.managerName.trim() || undefined,
      };

      if (departmentMode === "create") {
        await organizationService.createDepartment(payload);
      } else if (editingDepartment) {
        await organizationService.updateDepartment(editingDepartment.id, payload);
      }

      setDepartmentDialogOpen(false);
      setEditingDepartment(null);
      setDepartmentForm(defaultDepartmentFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setDepartmentError(err.message);
      } else {
        setDepartmentError("Failed to save department.");
      }
    } finally {
      setDepartmentSubmitting(false);
    }
  };

  const openCreateBranchDialog = () => {
    setBranchMode("create");
    setEditingBranch(null);
    setBranchForm(defaultBranchFormState);
    setBranchError(null);
    setBranchDialogOpen(true);
  };

  const openEditBranchDialog = (branch: BranchItem) => {
    const matchedManager = employees.find(
      (employee) => employee.name === branch.manager || employee.email === branch.manager,
    );

    setBranchMode("edit");
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      location: branch.location,
      managerName: branch.manager === "N/A" ? "" : branch.manager,
      managerSelection: matchedManager ? String(matchedManager.id) : "none",
    });
    setBranchError(null);
    setBranchDialogOpen(true);
  };

  const handleSaveBranch = async () => {
    if (!canManageStructure) {
      setBranchError("You need company structure access and an Organization Chart role to edit.");
      return;
    }

    if (!branchForm.name.trim() || !branchForm.location.trim()) {
      setBranchError("Branch name and location are required.");
      return;
    }

    setBranchSubmitting(true);
    setBranchError(null);

    try {
      const payload = {
        name: branchForm.name.trim(),
        location: branchForm.location.trim(),
        manager_name: branchForm.managerName.trim() || undefined,
      };

      if (branchMode === "create") {
        await organizationService.createBranch(payload);
      } else if (editingBranch) {
        await organizationService.updateBranch(editingBranch.id, payload);
      }

      setBranchDialogOpen(false);
      setEditingBranch(null);
      setBranchForm(defaultBranchFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setBranchError(err.message);
      } else {
        setBranchError("Failed to save branch.");
      }
    } finally {
      setBranchSubmitting(false);
    }
  };

  const handleDeleteDepartment = async (department: DepartmentItem) => {
    if (!canManageStructure) {
      return;
    }

    const warning =
      department.employees > 0
        ? `Delete "${department.name}"? ${department.employees} employee records will be moved to no department.`
        : `Delete "${department.name}"?`;
    const shouldDelete = window.confirm(`${warning} This action cannot be undone.`);

    if (!shouldDelete) {
      return;
    }

    setDeletingDepartmentId(department.id);

    try {
      await organizationService.deleteDepartment(department.id);

      if (editingDepartment?.id === department.id) {
        setDepartmentDialogOpen(false);
        setEditingDepartment(null);
      }

      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete department.";
      window.alert(message);
    } finally {
      setDeletingDepartmentId(null);
    }
  };

  const handleDeleteBranch = async (branch: BranchItem) => {
    if (!canManageStructure) {
      return;
    }

    const warning =
      branch.employees > 0
        ? `Delete "${branch.name}"? ${branch.employees} employee records will be moved to no office location.`
        : `Delete "${branch.name}"?`;
    const shouldDelete = window.confirm(`${warning} This action cannot be undone.`);

    if (!shouldDelete) {
      return;
    }

    setDeletingBranchId(branch.id);

    try {
      await organizationService.deleteBranch(branch.id);

      if (editingBranch?.id === branch.id) {
        setBranchDialogOpen(false);
        setEditingBranch(null);
      }

      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete office location.";
      window.alert(message);
    } finally {
      setDeletingBranchId(null);
    }
  };

  const openEditChartDialog = () => {
    const sourceCeo = organizationChart?.ceo ?? defaultChartFallback.ceo;
    const sourceExecutives = organizationChart ? organizationChart.executives : defaultChartFallback.executives;

    setChartForm({
      ceoId: sourceCeo.id > 0 ? sourceCeo.id : undefined,
      ceoRoleTitle: sourceCeo.role_title,
      ceoPersonName: sourceCeo.person_name,
      ceoPersonSelection: resolvePersonSelection(sourceCeo.person_name),
      executives: sourceExecutives.map((executive, index) => ({
        localId: executive.id > 0 ? `existing-${executive.id}` : `default-${index}`,
        id: executive.id > 0 ? executive.id : undefined,
        roleTitle: executive.role_title,
        personName: executive.person_name,
        personSelection: resolvePersonSelection(executive.person_name),
        department: executive.department ?? "",
      })),
    });

    setChartError(null);
    setChartDialogOpen(true);
  };

  const updateExecutiveForm = (
    localId: string,
    key: "roleTitle" | "personName" | "department",
    value: string,
  ) => {
    setChartForm((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        executives: prev.executives.map((executive) =>
          executive.localId === localId
            ? {
                ...executive,
                [key]: value,
              }
            : executive,
        ),
      };
    });
  };

  const addExecutiveRole = () => {
    setChartForm((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        executives: [
          ...prev.executives,
          {
            localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            roleTitle: "",
            personName: "",
            personSelection: "none",
            department: "",
          },
        ],
      };
    });
  };

  const handleCeoPersonSelection = (value: string) => {
    setChartForm((prev) => {
      if (!prev) {
        return prev;
      }

      if (value === "none") {
        return {
          ...prev,
          ceoPersonSelection: value,
          ceoPersonName: "",
        };
      }

      if (value.startsWith("custom:")) {
        return {
          ...prev,
          ceoPersonSelection: value,
          ceoPersonName: value.replace("custom:", ""),
        };
      }

      const selectedEmployee = employees.find((employee) => String(employee.id) === value);

      return {
        ...prev,
        ceoPersonSelection: value,
        ceoPersonName: selectedEmployee?.name ?? prev.ceoPersonName,
      };
    });
  };

  const handleExecutivePersonSelection = (localId: string, value: string) => {
    setChartForm((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        executives: prev.executives.map((executive) => {
          if (executive.localId !== localId) {
            return executive;
          }

          if (value === "none") {
            return {
              ...executive,
              personSelection: value,
              personName: "",
            };
          }

          if (value.startsWith("custom:")) {
            return {
              ...executive,
              personSelection: value,
              personName: value.replace("custom:", ""),
            };
          }

          const selectedEmployee = employees.find((employee) => String(employee.id) === value);

          return {
            ...executive,
            personSelection: value,
            personName: selectedEmployee?.name ?? executive.personName,
            department: selectedEmployee?.department ?? executive.department,
          };
        }),
      };
    });
  };

  const removeExecutiveRole = (localId: string) => {
    setChartForm((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        executives: prev.executives.filter((executive) => executive.localId !== localId),
      };
    });
  };

  const handleSaveOrganizationChart = async () => {
    if (!canManageStructure) {
      setChartError("You need company structure access and an Organization Chart role to edit.");
      return;
    }

    if (!chartForm) {
      setChartError("Organization chart form is not ready.");
      return;
    }

    if (!chartForm.ceoRoleTitle.trim() || !chartForm.ceoPersonName.trim()) {
      setChartError("CEO role and name are required.");
      return;
    }

    const hasMissingExecutiveFields = chartForm.executives.some(
      (executive) => !executive.roleTitle.trim() || !executive.personName.trim(),
    );

    if (hasMissingExecutiveFields) {
      setChartError("Each executive card requires role title and person name.");
      return;
    }

    setChartSubmitting(true);
    setChartError(null);

    try {
      await organizationService.updateOrganizationChart({
        positions: [
          {
            ...(chartForm.ceoId ? { id: chartForm.ceoId } : {}),
            role_title: chartForm.ceoRoleTitle.trim(),
            person_name: chartForm.ceoPersonName.trim(),
          },
          ...chartForm.executives.map((executive) => ({
            ...(executive.id ? { id: executive.id } : {}),
            role_title: executive.roleTitle.trim(),
            person_name: executive.personName.trim(),
            department: executive.department.trim() || undefined,
          })),
        ],
      });

      setChartDialogOpen(false);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setChartError(err.message);
      } else {
        setChartError("Failed to save organization chart.");
      }
    } finally {
      setChartSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Company Structure</h1>
        <p className="text-gray-600 mt-1">View organization hierarchy and departments</p>
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

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Organization Chart</CardTitle>
          <Button variant="outline" onClick={openEditChartDialog} disabled={!canManageStructure}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Chart
          </Button>
        </CardHeader>
        <CardContent>
          {chartError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              {chartError}
            </div>
          )}
          <div className="flex flex-col items-center space-y-8">
            <div className="bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] text-white rounded-lg p-6 shadow-lg">
              <div className="text-center">
                <div className="text-sm opacity-90 mb-1">{ceoNode.role_title}</div>
                <div className="font-semibold text-lg">{ceoNode.person_name}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              {executiveNodes.map((executive) => (
                <div
                  key={`${executive.role_key}-${executive.id}`}
                  className="bg-white border-2 border-[#2563EB] rounded-lg p-4 text-center"
                >
                  <div className="text-sm text-gray-600 mb-1">{executive.role_title}</div>
                  <div className="font-semibold text-gray-900">{executive.person_name}</div>
                  <div className="text-xs text-gray-500 mt-1">{executive.department ?? "N/A"}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Departments</CardTitle>
          <Button variant="outline" onClick={openCreateDepartmentDialog} disabled={!canManageStructure}>
            <Plus className="w-4 h-4 mr-2" />
            Add Department
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading && <div className="text-sm text-gray-500">Loading departments...</div>}
            {!loading && departments.length === 0 && (
              <div className="text-sm text-gray-500">No departments found.</div>
            )}
            {!loading &&
              departments.map((dept) => (
                <div
                  key={dept.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    </div>
                    {canManageStructure && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDepartmentDialog(dept)}
                          disabled={deletingDepartmentId === dept.id}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void handleDeleteDepartment(dept)}
                          disabled={deletingDepartmentId === dept.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Manager</span>
                      <span className="font-medium text-gray-900">{dept.manager}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Employees</span>
                      <span className="font-medium text-gray-900">{dept.employees}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Office Locations</CardTitle>
          <Button variant="outline" onClick={openCreateBranchDialog} disabled={!canManageStructure}>
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading && <div className="text-sm text-gray-500">Loading branches...</div>}
            {!loading && branches.length === 0 && <div className="text-sm text-gray-500">No branches found.</div>}
            {!loading &&
              branches.map((branch) => (
                <div
                  key={branch.id}
                  className="p-6 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-[#2563EB]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{branch.location}</p>
                    </div>
                    {canManageStructure && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditBranchDialog(branch)}
                          disabled={deletingBranchId === branch.id}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void handleDeleteBranch(branch)}
                          disabled={deletingBranchId === branch.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <span>Manager</span>
                    <span className="font-medium text-gray-900">{branch.manager}</span>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>Employees</span>
                    </div>
                    <span className="text-lg font-semibold text-gray-900">{branch.employees}</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={departmentDialogOpen}
        onOpenChange={(open) => {
          setDepartmentDialogOpen(open);
          if (!open) {
            setDepartmentError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{departmentMode === "create" ? "Add Department" : "Edit Department"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {departmentError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {departmentError}
              </div>
            )}

            <div>
              <Label htmlFor="department-name">Department Name</Label>
              <Input
                id="department-name"
                className="mt-2"
                value={departmentForm.name}
                onChange={(event) =>
                  setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="department-manager-user">Manager Account</Label>
              <Select
                value={departmentForm.managerSelection}
                onValueChange={(value) => {
                  const selectedEmployee = employees.find((employee) => String(employee.id) === value);
                  setDepartmentForm((prev) => ({
                    ...prev,
                    managerSelection: value,
                    managerName: value === "none" ? "" : (selectedEmployee?.email ?? prev.managerName),
                  }));
                }}
              >
                <SelectTrigger id="department-manager-user" className="mt-2">
                  <SelectValue placeholder="Select manager account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((employee: EmployeeListItem) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                      {employee.name} ({employee.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="department-manager">Manager Name (optional)</Label>
              <Input
                id="department-manager"
                className="mt-2"
                value={departmentForm.managerName}
                onChange={(event) =>
                  setDepartmentForm((prev) => ({ ...prev, managerName: event.target.value }))
                }
                placeholder="Enter manager name or email"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDepartmentDialogOpen(false)}
                disabled={departmentSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveDepartment()}
                disabled={departmentSubmitting}
              >
                {departmentSubmitting
                  ? departmentMode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : departmentMode === "create"
                    ? "Create Department"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={branchDialogOpen}
        onOpenChange={(open) => {
          setBranchDialogOpen(open);
          if (!open) {
            setBranchError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{branchMode === "create" ? "Add Branch" : "Edit Branch"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {branchError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {branchError}
              </div>
            )}

            <div>
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                className="mt-2"
                value={branchForm.name}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="branch-location">Location</Label>
              <Input
                id="branch-location"
                className="mt-2"
                value={branchForm.location}
                onChange={(event) =>
                  setBranchForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="branch-manager-user">Manager Account</Label>
              <Select
                value={branchForm.managerSelection}
                onValueChange={(value) => {
                  const selectedEmployee = employees.find((employee) => String(employee.id) === value);
                  setBranchForm((prev) => ({
                    ...prev,
                    managerSelection: value,
                    managerName: value === "none" ? "" : (selectedEmployee?.email ?? prev.managerName),
                  }));
                }}
              >
                <SelectTrigger id="branch-manager-user" className="mt-2">
                  <SelectValue placeholder="Select branch manager account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((employee: EmployeeListItem) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                      {employee.name} ({employee.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="branch-manager-name">Manager Name (optional)</Label>
              <Input
                id="branch-manager-name"
                className="mt-2"
                value={branchForm.managerName}
                onChange={(event) =>
                  setBranchForm((prev) => ({ ...prev, managerName: event.target.value }))
                }
                placeholder="Enter manager name or email"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setBranchDialogOpen(false)} disabled={branchSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveBranch()}
                disabled={branchSubmitting}
              >
                {branchSubmitting
                  ? branchMode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : branchMode === "create"
                    ? "Create Branch"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={chartDialogOpen} onOpenChange={setChartDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Organization Chart</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {chartError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {chartError}
              </div>
            )}

            {chartForm ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="chart-ceo-role">CEO Role Title</Label>
                    <Input
                      id="chart-ceo-role"
                      className="mt-2"
                      value={chartForm.ceoRoleTitle}
                      onChange={(event) =>
                        setChartForm((prev) =>
                          prev ? { ...prev, ceoRoleTitle: event.target.value } : prev,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="chart-ceo-name">CEO Name</Label>
                    <Select
                      value={chartForm.ceoPersonSelection}
                      onValueChange={handleCeoPersonSelection}
                    >
                      <SelectTrigger id="chart-ceo-name" className="mt-2">
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {chartForm.ceoPersonSelection.startsWith("custom:") && (
                          <SelectItem value={chartForm.ceoPersonSelection}>
                            {chartForm.ceoPersonName} (not in employee list)
                          </SelectItem>
                        )}
                        {employees.map((employee) => (
                          <SelectItem key={`ceo-employee-${employee.id}`} value={String(employee.id)}>
                            {employee.name} ({employee.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-900">Executive Roles</div>
                    <Button type="button" variant="outline" size="sm" onClick={addExecutiveRole}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Role
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {chartForm.executives.map((executive) => (
                      <div key={executive.localId} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor={`chart-exec-role-${executive.localId}`}>Role Title</Label>
                          <Input
                            id={`chart-exec-role-${executive.localId}`}
                            className="mt-2"
                            value={executive.roleTitle}
                            onChange={(event) =>
                              updateExecutiveForm(executive.localId, "roleTitle", event.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`chart-exec-name-${executive.localId}`}>Name</Label>
                          <Select
                            value={executive.personSelection}
                            onValueChange={(value) => handleExecutivePersonSelection(executive.localId, value)}
                          >
                            <SelectTrigger id={`chart-exec-name-${executive.localId}`} className="mt-2">
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {executive.personSelection.startsWith("custom:") && (
                                <SelectItem value={executive.personSelection}>
                                  {executive.personName} (not in employee list)
                                </SelectItem>
                              )}
                              {employees.map((employee) => (
                                <SelectItem
                                  key={`exec-${executive.localId}-employee-${employee.id}`}
                                  value={String(employee.id)}
                                >
                                  {employee.name} ({employee.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`chart-exec-department-${executive.localId}`}>Department</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => removeExecutiveRole(executive.localId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <Input
                            id={`chart-exec-department-${executive.localId}`}
                            className="mt-2"
                            value={executive.department}
                            onChange={(event) =>
                              updateExecutiveForm(executive.localId, "department", event.target.value)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">Loading organization chart form...</div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setChartDialogOpen(false)} disabled={chartSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveOrganizationChart()}
                disabled={chartSubmitting || !chartForm}
              >
                {chartSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
