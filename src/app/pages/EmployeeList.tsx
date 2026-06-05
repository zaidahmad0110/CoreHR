import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, Plus, MoreVertical } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Card, CardContent } from "../components/ui/card";
import {
  employeeService,
  organizationService,
  type EmployeeMutationPayload,
} from "../api/services";
import { useAuth } from "../auth/AuthContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { openInNewTab } from "../utils/openInNewTab";
import { resolveEmployeeJobTitleOptions } from "../constants/jobTitles";
import type { EmployeeListItem } from "../api/types";

type EmployeeFormState = {
  name: string;
  employeeCode: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  managerId: string;
  branch: string;
  location: string;
  joinDate: string;
  status: "Active" | "On Leave" | "Inactive";
  baseSalary: string;
  allowances: string;
  deductions: string;
  loginRole: "Admin" | "HR" | "Manager" | "Employee";
  loginPassword: string;
  resetLoginPassword: string;
};

type EmployeeEditSnapshot = {
  name: string;
  jobTitle: string;
  department: string;
  branch: string;
  joinDate: string;
  status: "Active" | "On Leave" | "Inactive";
  baseSalary?: number;
  allowances?: number;
  deductions?: number;
};

const defaultFormState: EmployeeFormState = {
  name: "",
  employeeCode: "",
  email: "",
  phone: "",
  jobTitle: "",
  department: "",
  managerId: "",
  branch: "",
  location: "",
  joinDate: new Date().toISOString().slice(0, 10),
  status: "Active",
  baseSalary: "",
  allowances: "",
  deductions: "",
  loginRole: "Employee",
  loginPassword: "",
  resetLoginPassword: "",
};

const formatDateForInput = (value: string | null | undefined) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const toNumber = (value: string): number | undefined => {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

type EmployeeTreeNode = EmployeeListItem & {
  children: EmployeeTreeNode[];
};

const normalizeJobTitle = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

type EmployeeHierarchyRole =
  | "ceo"
  | "gm"
  | "department-manager"
  | "manager"
  | "supervisor"
  | "coordinator"
  | "other";

const resolveHierarchyRole = (jobTitle: string): EmployeeHierarchyRole => {
  switch (normalizeJobTitle(jobTitle)) {
    case "ceo":
    case "chief executive officer":
      return "ceo";
    case "gm":
    case "general manager":
      return "gm";
    case "department manager":
    case "department head":
    case "dept manager":
      return "department-manager";
    case "manager":
      return "manager";
    case "supervisor":
      return "supervisor";
    case "coordinator":
      return "coordinator";
    default:
      return "other";
  }
};

const resolveRoleRank = (jobTitle: string): number => {
  switch (resolveHierarchyRole(jobTitle)) {
    case "ceo":
      return 0;
    case "gm":
      return 1;
    case "department-manager":
      return 2;
    case "manager":
      return 3;
    case "supervisor":
      return 4;
    case "coordinator":
      return 5;
    default:
      return 6;
  }
};

const sortByHierarchy = (left: EmployeeListItem, right: EmployeeListItem) => {
  const rankDiff = resolveRoleRank(left.job_title) - resolveRoleRank(right.job_title);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  return left.name.localeCompare(right.name);
};

const sortTreeNodes = (nodes: EmployeeTreeNode[]): EmployeeTreeNode[] =>
  nodes
    .sort(sortByHierarchy)
    .map((node) => ({
      ...node,
      children: sortTreeNodes(node.children),
    }));

const buildEmployeeTree = (employees: EmployeeListItem[]): EmployeeTreeNode[] => {
  const expectedParentRoles: Record<EmployeeHierarchyRole, EmployeeHierarchyRole[]> = {
    ceo: [],
    gm: ["ceo"],
    "department-manager": ["gm", "ceo"],
    manager: ["department-manager", "gm", "ceo"],
    supervisor: ["manager", "department-manager", "gm", "ceo"],
    coordinator: ["supervisor", "manager", "department-manager", "gm", "ceo"],
    other: ["supervisor", "manager", "department-manager", "gm", "ceo"],
  };

  const nodesById = new Map<number, EmployeeTreeNode>(
    employees.map((employee) => [
      employee.id,
      {
        ...employee,
        children: [],
      },
    ]),
  );

  const employeesByDepartment = new Map<string, EmployeeListItem[]>();
  employees.forEach((employee) => {
    const bucket = employeesByDepartment.get(employee.department) ?? [];
    bucket.push(employee);
    employeesByDepartment.set(employee.department, bucket);
  });

  const findRoleCandidate = (
    role: EmployeeHierarchyRole,
    employee: EmployeeListItem,
    departmentScoped: boolean,
  ): EmployeeListItem | undefined => {
    const source = departmentScoped ? employeesByDepartment.get(employee.department) ?? [] : employees;

    return [...source]
      .filter((candidate) => candidate.id !== employee.id && resolveHierarchyRole(candidate.job_title) === role)
      .sort(sortByHierarchy)[0];
  };

  const resolveParent = (employee: EmployeeListItem): EmployeeListItem | undefined => {
    const role = resolveHierarchyRole(employee.job_title);
    const candidateRoles = expectedParentRoles[role];

    if (candidateRoles.length === 0) {
      return undefined;
    }

    const manualManager = employee.manager_id ? nodesById.get(employee.manager_id) : undefined;
    if (
      manualManager
      && candidateRoles.includes(resolveHierarchyRole(manualManager.job_title))
      && manualManager.id !== employee.id
    ) {
      return manualManager;
    }

    for (const parentRole of candidateRoles) {
      const departmentScoped = !["ceo", "gm"].includes(parentRole);
      const candidate = findRoleCandidate(parentRole, employee, departmentScoped);

      if (candidate) {
        return candidate;
      }
    }

    return undefined;
  };

  const parentById = new Map<number, number>();

  employees.forEach((employee) => {
    const parent = resolveParent(employee);

    if (parent) {
      parentById.set(employee.id, parent.id);
    }
  });

  parentById.forEach((parentId, employeeId) => {
    const parentNode = nodesById.get(parentId);
    const employeeNode = nodesById.get(employeeId);

    if (!parentNode || !employeeNode) {
      return;
    }

    parentNode.children.push(employeeNode);
  });

  const roots = [...nodesById.values()].filter((node) => !parentById.has(node.id));
  return sortTreeNodes(roots);
};

export function EmployeeList() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<EmployeeFormState>(defaultFormState);
  const [editingSnapshot, setEditingSnapshot] = useState<EmployeeEditSnapshot | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 350);

  const { data, loading, error, refetch } = useApiQuery(
    () =>
      employeeService.getEmployees({
        search: debouncedSearch || undefined,
        department: departmentFilter === "all" ? undefined : departmentFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    [debouncedSearch, departmentFilter, statusFilter],
  );

  const { data: organizationData } = useApiQuery(
    async () => {
      const [departments, branches] = await Promise.all([
        organizationService.getDepartments(),
        organizationService.getBranches(),
      ]);

      return { departments, branches };
    },
    [],
  );
  const { data: allEmployeesData } = useApiQuery(
    () => employeeService.getEmployees({}),
    [],
  );

  const employees = data ?? [];
  const allEmployees = allEmployeesData ?? employees;
  const canManageOnlyOwnDepartment = (user?.employee_management_scope ?? "self") === "department";
  const managedDepartmentNames = useMemo(
    () => (user?.managed_departments ?? []).map((department) => department.name),
    [user],
  );
  const departmentOptions = useMemo(() => {
    if (canManageOnlyOwnDepartment && managedDepartmentNames.length > 0) {
      return managedDepartmentNames;
    }

    if (organizationData?.departments?.length) {
      return organizationData.departments.map((department) => department.name);
    }

    const values = new Set(employees.map((employee) => employee.department));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [canManageOnlyOwnDepartment, employees, managedDepartmentNames, organizationData]);

  const branchOptions = useMemo(
    () => organizationData?.branches?.map((branch) => branch.name) ?? [],
    [organizationData],
  );
  const jobTitleOptions = useMemo(
    () => resolveEmployeeJobTitleOptions(formState.jobTitle),
    [formState.jobTitle],
  );
  const supervisorOptions = useMemo(() => {
    return allEmployees
      .filter((employee) => {
        if (editingEmployeeId && employee.id === editingEmployeeId) {
          return false;
        }

        if (employee.job_title.trim().toLowerCase() !== "supervisor") {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [allEmployees, editingEmployeeId]);

  const canManageEmployees = useMemo(() => Boolean(user?.can_manage_employees), [user]);
  const canEditExtendedEmployeeFields = useMemo(
    () => (user?.employee_management_scope ?? "self") === "global",
    [user],
  );
  const isEditingOwnProfile = useMemo(() => {
    if (formMode !== "edit" || !editingEmployeeId || !user) {
      return false;
    }

    if (user.employee_profile_id) {
      return user.employee_profile_id === editingEmployeeId;
    }

    const editingEmployee = employees.find((employee) => employee.id === editingEmployeeId);
    if (!editingEmployee) {
      return false;
    }

    return user.email.toLowerCase() === editingEmployee.email.toLowerCase();
  }, [editingEmployeeId, employees, formMode, user]);
  const hideRestrictedCompensationFields = isEditingOwnProfile && !canEditExtendedEmployeeFields;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-700";
      case "On Leave":
        return "bg-yellow-100 text-yellow-700";
      case "Inactive":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const employeeTree = useMemo(() => buildEmployeeTree(employees), [employees]);

  const renderTreeNode = (employee: EmployeeTreeNode, depth = 0) => {
    const isSelf = (user?.email ?? "").toLowerCase() === employee.email.toLowerCase();
    const canEdit = canManageEmployees || isSelf;
    const canDelete = canManageEmployees;

    return (
      <li key={employee.id} className="relative">
        {depth > 0 && <span className="absolute -left-6 top-6 h-px w-6 bg-gray-200" />}
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <Link to={`/employees/${employee.id}`} className="flex items-center gap-3 hover:opacity-80 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center shrink-0">
                <span className="text-white font-medium">
                  {employee.name
                    .split(" ")
                    .map((namePart) => namePart[0])
                    .join("")}
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{employee.name}</div>
                <div className="text-sm text-gray-500 truncate">{employee.email}</div>
                <div className="text-sm text-gray-600">{employee.job_title} | {employee.department}</div>
              </div>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <Badge className={getStatusColor(employee.status)} variant="secondary">
                {employee.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openInNewTab(`/employees/${employee.id}`)}>
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void openEditDialog(employee.id)} disabled={!canEdit}>
                    Edit
                  </DropdownMenuItem>
                  {canDelete && (
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => void handleDeleteEmployee(employee.id, employee.name)}
                      disabled={deletingEmployeeId === employee.id}
                    >
                      {deletingEmployeeId === employee.id ? "Deleting..." : "Delete"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {employee.children.length > 0 && (
          <ul className="mt-3 ml-4 pl-6 border-l border-gray-200 space-y-3">
            {employee.children.map((child) => renderTreeNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const updateForm = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const openCreateDialog = () => {
    if (!canManageEmployees) {
      return;
    }

    const defaultDepartment =
      canManageOnlyOwnDepartment && managedDepartmentNames.length > 0
        ? managedDepartmentNames[0]
        : "";

    setFormMode("create");
    setEditingEmployeeId(null);
    setFormState({
      ...defaultFormState,
      department: defaultDepartment,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (employeeId: number) => {
    const targetEmployee = employees.find((employee) => employee.id === employeeId);
    const isSelf =
      (user?.employee_profile_id ?? null) === employeeId
      || (
        !!targetEmployee
        && !!user?.email
        && user.email.toLowerCase() === targetEmployee.email.toLowerCase()
      );

    if (!canManageEmployees && !isSelf) {
      setFormError("You can only edit your own profile.");
      return;
    }

    setDialogOpen(true);
    setFormMode("edit");
    setEditingEmployeeId(employeeId);
    setFormLoading(true);
    setFormError(null);

    try {
      const profile = await employeeService.getEmployee(String(employeeId));

      setFormState({
        name: profile.name,
        employeeCode: profile.employee_id,
        email: profile.email,
        phone: profile.phone ?? "",
        jobTitle: profile.job_title,
        department: profile.department === "N/A" ? "" : profile.department,
        managerId: profile.manager_id ? String(profile.manager_id) : "",
        branch: profile.branch ?? "",
        location: profile.location ?? "",
        joinDate: formatDateForInput(profile.join_date),
        status: (profile.status as "Active" | "On Leave" | "Inactive") ?? "Active",
        baseSalary: profile.base_salary !== undefined ? String(profile.base_salary) : "",
        allowances: profile.allowances !== undefined ? String(profile.allowances) : "",
        deductions: profile.deductions !== undefined ? String(profile.deductions) : "",
        loginRole: "Employee",
        loginPassword: "",
        resetLoginPassword: "",
      });
      setEditingSnapshot({
        name: profile.name,
        jobTitle: profile.job_title,
        department: profile.department === "N/A" ? "" : profile.department,
        branch: profile.branch ?? "",
        joinDate: formatDateForInput(profile.join_date),
        status: (profile.status as "Active" | "On Leave" | "Inactive") ?? "Active",
        baseSalary: profile.base_salary,
        allowances: profile.allowances,
        deductions: profile.deductions,
      });
    } catch (err) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to load employee details.");
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: number, employeeName: string) => {
    if (!canManageEmployees) {
      return;
    }

    const shouldDelete = window.confirm(`Delete ${employeeName}? This action cannot be undone.`);

    if (!shouldDelete) {
      return;
    }

    setDeletingEmployeeId(employeeId);

    try {
      await employeeService.deleteEmployee(employeeId);
      await refetch();
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const handleSaveEmployee = async () => {
    if (!formState.name || !formState.email || !formState.jobTitle || !formState.joinDate) {
      setFormError("Please fill all required fields.");
      return;
    }

    if (formMode === "create") {
      if (!formState.loginPassword) {
        setFormError("Login password is required for new employee account.");
        return;
      }

      if (formState.loginPassword.length < 8) {
        setFormError("Login password must be at least 8 characters.");
        return;
      }
    } else if (formState.resetLoginPassword && formState.resetLoginPassword.length < 8) {
      setFormError("Reset password must be at least 8 characters.");
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const normalizedJobTitle = formState.jobTitle.trim().toLowerCase();
    const parsedManagerId = Number(formState.managerId);
    const managerIdForCoordinator =
      normalizedJobTitle === "coordinator"
      && Number.isInteger(parsedManagerId)
      && parsedManagerId > 0
        ? parsedManagerId
        : undefined;

    let payload: EmployeeMutationPayload;
    if (formMode === "create") {
      payload = {
        name: formState.name,
        employee_code: formState.employeeCode || undefined,
        email: formState.email,
        phone: formState.phone || undefined,
        job_title: formState.jobTitle,
        department:
          canManageOnlyOwnDepartment && managedDepartmentNames.length > 0
            ? managedDepartmentNames[0]
            : formState.department || undefined,
        manager_id: managerIdForCoordinator,
        branch: formState.branch || undefined,
        location: formState.location || undefined,
        join_date: formState.joinDate,
        status: formState.status,
        base_salary: toNumber(formState.baseSalary),
        allowances: toNumber(formState.allowances),
        deductions: toNumber(formState.deductions),
        create_user_account: true,
        user_role: formState.loginRole,
        user_password: formState.loginPassword,
      };
    } else {
      if (editingEmployeeId === null) {
        setFormError("No employee selected for edit.");
        setFormSubmitting(false);
        return;
      }

      if (!canManageEmployees && !isEditingOwnProfile) {
        setFormError("You can only edit your own profile.");
        setFormSubmitting(false);
        return;
      }

      if (isEditingOwnProfile && !canEditExtendedEmployeeFields) {
        if (!editingSnapshot) {
          setFormError("Employee profile context is missing. Please reopen the form.");
          setFormSubmitting(false);
          return;
        }

        payload = {
          name: editingSnapshot.name,
          email: formState.email,
          phone: formState.phone || undefined,
          job_title: editingSnapshot.jobTitle,
          department: editingSnapshot.department || undefined,
          branch: editingSnapshot.branch || undefined,
          location: formState.location || undefined,
          join_date: editingSnapshot.joinDate,
          status: editingSnapshot.status,
          base_salary: editingSnapshot.baseSalary,
          allowances: editingSnapshot.allowances,
          deductions: editingSnapshot.deductions,
        };
      } else {
        payload = {
          name: formState.name,
          employee_code: formState.employeeCode || undefined,
          email: formState.email,
          phone: formState.phone || undefined,
          job_title: formState.jobTitle,
          department:
            canManageOnlyOwnDepartment && managedDepartmentNames.length > 0
              ? managedDepartmentNames[0]
              : formState.department || undefined,
          manager_id: managerIdForCoordinator,
          branch: formState.branch || undefined,
          location: formState.location || undefined,
          join_date: formState.joinDate,
          status: formState.status,
          base_salary: toNumber(formState.baseSalary),
          allowances: toNumber(formState.allowances),
          deductions: toNumber(formState.deductions),
        };
      }
    }

    try {
      if (formMode === "create") {
        await employeeService.createEmployee(payload);
      } else if (editingEmployeeId) {
        await employeeService.updateEmployee(editingEmployeeId, payload);

        if (canManageEmployees && formState.resetLoginPassword.trim()) {
          await employeeService.resetEmployeePassword(editingEmployeeId, formState.resetLoginPassword);
        }
      }

      setDialogOpen(false);
      setEditingEmployeeId(null);
      setEditingSnapshot(null);
      setFormState(defaultFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to save employee.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
          <p className="text-gray-600 mt-1">Manage your team members</p>
        </div>
        {canManageEmployees && (
          <Button className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-50"
                />
              </div>
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-48 bg-gray-50">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentOptions.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-gray-50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
        <CardContent className="p-6">
          {loading && <div className="text-center py-8 text-gray-500">Loading employees...</div>}

          {!loading && employees.length === 0 && (
            <div className="text-center py-8 text-gray-500">No employees found.</div>
          )}

          {!loading && employees.length > 0 && (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <ul className="space-y-3">{employeeTree.map((employee) => renderTreeNode(employee))}</ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-gray-600">Showing {employees.length} employees</div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setFormError(null);
            setFormLoading(false);
            setFormSubmitting(false);
            setEditingSnapshot(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "Add Employee" : "Edit Employee"}</DialogTitle>
          </DialogHeader>

          {formLoading ? (
            <div className="py-8 text-center text-gray-500">Loading employee details...</div>
          ) : (
            <div className="space-y-4 py-2">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emp-name">Full Name</Label>
                  <Input
                    id="emp-name"
                    className="mt-2"
                    value={formState.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    disabled={hideRestrictedCompensationFields}
                  />
                </div>
                {canManageEmployees && (
                  <div>
                    <Label htmlFor="emp-code">Employee ID / BioTime Code</Label>
                    <Input
                      id="emp-code"
                      className="mt-2"
                      placeholder="Example: 158"
                      value={formState.employeeCode}
                      onChange={(event) => updateForm("employeeCode", event.target.value)}
                      disabled={formMode === "edit" && !canEditExtendedEmployeeFields}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="emp-email">Email</Label>
                  <Input
                    id="emp-email"
                    type="email"
                    className="mt-2"
                    value={formState.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    disabled={formMode === "edit" && !canManageEmployees && !isEditingOwnProfile}
                  />
                </div>
                {formMode === "create" && canManageEmployees && (
                  <>
                    <div>
                      <Label htmlFor="emp-login-role">Login Role</Label>
                      <Select
                        value={formState.loginRole}
                        onValueChange={(value) =>
                          updateForm("loginRole", value as EmployeeFormState["loginRole"])
                        }
                      >
                        <SelectTrigger id="emp-login-role" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employee">Employee</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="emp-login-password">Login Password</Label>
                      <Input
                        id="emp-login-password"
                        type="password"
                        className="mt-2"
                        value={formState.loginPassword}
                        onChange={(event) => updateForm("loginPassword", event.target.value)}
                      />
                    </div>
                  </>
                )}
                {formMode === "edit" && canManageEmployees && (
                  <div>
                    <Label htmlFor="emp-reset-password">Reset Login Password (optional)</Label>
                    <Input
                      id="emp-reset-password"
                      type="password"
                      className="mt-2"
                      value={formState.resetLoginPassword}
                      onChange={(event) => updateForm("resetLoginPassword", event.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="emp-phone">Phone</Label>
                  <Input
                    id="emp-phone"
                    className="mt-2"
                    value={formState.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="emp-job-title">Job Title</Label>
                  <Select
                    value={formState.jobTitle || "none"}
                    onValueChange={(value) => {
                      const nextJobTitle = value === "none" ? "" : value;
                      setFormState((prev) => ({
                        ...prev,
                        jobTitle: nextJobTitle,
                        managerId: nextJobTitle.trim().toLowerCase() === "coordinator" ? prev.managerId : "",
                      }));
                    }}
                    disabled={formMode === "edit" && !canEditExtendedEmployeeFields}
                  >
                    <SelectTrigger id="emp-job-title" className="mt-2">
                      <SelectValue placeholder="Select job title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select job title</SelectItem>
                      {jobTitleOptions.map((jobTitle) => (
                        <SelectItem key={jobTitle} value={jobTitle}>
                          {jobTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="emp-dept">Department</Label>
                  <Select
                    value={formState.department || "none"}
                    onValueChange={(value) => {
                      const nextDepartment = value === "none" ? "" : value;
                      setFormState((prev) => ({
                        ...prev,
                        department: nextDepartment,
                        managerId: prev.managerId,
                      }));
                    }}
                    disabled={
                      (formMode === "edit" && !canEditExtendedEmployeeFields)
                      || canManageOnlyOwnDepartment
                    }
                  >
                    <SelectTrigger id="emp-dept" className="mt-2">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {!canManageOnlyOwnDepartment && <SelectItem value="none">None</SelectItem>}
                      {departmentOptions.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formState.jobTitle.trim().toLowerCase() === "coordinator" && (
                  <div>
                    <Label htmlFor="emp-supervisor">Supervisor (manual optional)</Label>
                    <Select
                      value={formState.managerId || "none"}
                      onValueChange={(value) => updateForm("managerId", value === "none" ? "" : value)}
                      disabled={formMode === "edit" && !canEditExtendedEmployeeFields}
                    >
                      <SelectTrigger id="emp-supervisor" className="mt-2">
                        <SelectValue placeholder="Auto-assign supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Auto-assign supervisor</SelectItem>
                        {supervisorOptions.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={String(supervisor.id)}>
                            {supervisor.name} ({supervisor.department})
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="emp-branch">Branch</Label>
                  <Select
                    value={formState.branch || "none"}
                    onValueChange={(value) => updateForm("branch", value === "none" ? "" : value)}
                    disabled={hideRestrictedCompensationFields || (!canManageEmployees && formMode === "edit")}
                  >
                    <SelectTrigger id="emp-branch" className="mt-2">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {branchOptions.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="emp-location">Location</Label>
                  <Input
                    id="emp-location"
                    className="mt-2"
                    value={formState.location}
                    onChange={(event) => updateForm("location", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="emp-join-date">Join Date</Label>
                  <Input
                    id="emp-join-date"
                    type="date"
                    className="mt-2"
                    value={formState.joinDate}
                    onChange={(event) => updateForm("joinDate", event.target.value)}
                    disabled={formMode === "edit" && !canEditExtendedEmployeeFields}
                  />
                </div>
                {!hideRestrictedCompensationFields && (
                  <div>
                    <Label htmlFor="emp-status">Status</Label>
                    <Select
                      value={formState.status}
                      onValueChange={(value) => updateForm("status", value as EmployeeFormState["status"])}
                      disabled={formMode === "edit" && !canEditExtendedEmployeeFields}
                    >
                      <SelectTrigger id="emp-status" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="emp-base">Base Salary</Label>
                  <Input
                    id="emp-base"
                    type="number"
                    min="0"
                    className="mt-2"
                    value={formState.baseSalary}
                    onChange={(event) => updateForm("baseSalary", event.target.value)}
                    disabled={hideRestrictedCompensationFields || (formMode === "edit" && !canEditExtendedEmployeeFields)}
                  />
                </div>
                {!hideRestrictedCompensationFields && (
                  <div>
                    <Label htmlFor="emp-allowances">Allowances</Label>
                    <Input
                      id="emp-allowances"
                      type="number"
                      min="0"
                      className="mt-2"
                      value={formState.allowances}
                      onChange={(event) => updateForm("allowances", event.target.value)}
                      disabled={formMode === "edit" && !canEditExtendedEmployeeFields}
                    />
                  </div>
                )}
                {!hideRestrictedCompensationFields && (
                  <div>
                    <Label htmlFor="emp-deductions">Deductions</Label>
                    <Input
                      id="emp-deductions"
                      type="number"
                      min="0"
                      className="mt-2"
                      value={formState.deductions}
                      onChange={(event) => updateForm("deductions", event.target.value)}
                      disabled={formMode === "edit" && !canEditExtendedEmployeeFields}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={formSubmitting}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  onClick={() => void handleSaveEmployee()}
                  disabled={formSubmitting}
                >
                  {formSubmitting
                    ? formMode === "create"
                      ? "Creating..."
                      : "Saving..."
                    : formMode === "create"
                      ? "Create Employee"
                      : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
