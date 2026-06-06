import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
import { employeeService, organizationService, type EmployeeMutationPayload } from "../api/services";
import type { EmployeeOnboardingData, EmployeeProfileData } from "../api/types";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";
import { openInNewTab } from "../utils/openInNewTab";
import { printPayslipInvoice } from "../utils/printPayslipInvoice";
import { resolveEmployeeJobTitleOptions } from "../constants/jobTitles";

type EmployeeFormState = {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  branch: string;
  location: string;
  joinDate: string;
  status: "Active" | "On Leave" | "Inactive";
  baseSalary: string;
  allowances: string;
  deductions: string;
};

type DocumentFormState = {
  name: string;
  type: string;
  uploadDate: string;
  file: File | null;
};

type AssetFormState = {
  name: string;
  serialNumber: string;
  assignedDate: string;
};

type AttendanceFormState = {
  checkIn: string;
  checkOut: string;
  status: "Present" | "Early" | "Late" | "Absent" | "Overtime";
};

const defaultEmployeeFormState: EmployeeFormState = {
  name: "",
  email: "",
  phone: "",
  jobTitle: "",
  department: "",
  branch: "",
  location: "",
  joinDate: new Date().toISOString().slice(0, 10),
  status: "Active",
  baseSalary: "",
  allowances: "",
  deductions: "",
};

const defaultDocumentFormState: DocumentFormState = {
  name: "",
  type: "",
  uploadDate: new Date().toISOString().slice(0, 10),
  file: null,
};

const defaultAssetFormState: AssetFormState = {
  name: "",
  serialNumber: "",
  assignedDate: new Date().toISOString().slice(0, 10),
};

const defaultAttendanceFormState: AttendanceFormState = {
  checkIn: "",
  checkOut: "",
  status: "Present",
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

const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString()}`;

const parseTimeForInput = (value: string | null | undefined): string => {
  if (!value || value === "-") {
    return "";
  }

  const twelveHourMatch = value.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (twelveHourMatch) {
    const [, rawHours, minutes, periodRaw] = twelveHourMatch;
    const period = periodRaw.toUpperCase();
    let hours = Number(rawHours);

    if (period === "PM" && hours < 12) {
      hours += 12;
    }

    if (period === "AM" && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  const twentyFourHourMatch = value.match(/^(\d{2}):(\d{2})/);
  if (twentyFourHourMatch) {
    return `${twentyFourHourMatch[1]}:${twentyFourHourMatch[2]}`;
  }

  return "";
};

const getAttendanceStatusClassName = (status: string) => {
  if (status === "Present" || status === "Early" || status === "Overtime") {
    return "bg-green-100 text-green-700";
  }

  if (status === "Late") {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-red-100 text-red-700";
};

export function EmployeeProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);
  const [payslipMonth, setPayslipMonth] = useState("");
  const [profileForm, setProfileForm] = useState<EmployeeFormState>(defaultEmployeeFormState);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentMode, setDocumentMode] = useState<"create" | "edit">("create");
  const [editingDocument, setEditingDocument] = useState<EmployeeProfileData["documents"][number] | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(defaultDocumentFormState);
  const [documentSubmitting, setDocumentSubmitting] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetMode, setAssetMode] = useState<"create" | "edit">("create");
  const [editingAsset, setEditingAsset] = useState<EmployeeProfileData["assets"][number] | null>(null);
  const [assetForm, setAssetForm] = useState<AssetFormState>(defaultAssetFormState);
  const [assetSubmitting, setAssetSubmitting] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormState>(defaultAttendanceFormState);
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [deletingTodayAttendance, setDeletingTodayAttendance] = useState(false);
  const [updatingOnboardingTaskId, setUpdatingOnboardingTaskId] = useState<number | null>(null);

  const { data, loading, error, refetch } = useApiQuery(
    () => employeeService.getEmployee(id ?? ""),
    [id],
    { skip: !id },
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

  const {
    data: payslipData,
    loading: payslipLoading,
    error: payslipError,
    refetch: refetchPayslip,
  } = useApiQuery(
    () => employeeService.getPayslip(id ?? "", payslipMonth || undefined),
    [id, payslipMonth, payslipDialogOpen],
    { skip: !id || !payslipDialogOpen },
  );

  const {
    data: onboardingData,
    loading: onboardingLoading,
    error: onboardingError,
    refetch: refetchOnboarding,
  } = useApiQuery(
    () => employeeService.getOnboarding(id ?? ""),
    [id],
    { skip: !id },
  );

  const departmentOptions = useMemo(
    () => organizationData?.departments?.map((department) => department.name) ?? [],
    [organizationData],
  );
  const branchOptions = useMemo(
    () => organizationData?.branches?.map((branch) => branch.name) ?? [],
    [organizationData],
  );
  const profileJobTitleOptions = useMemo(
    () => resolveEmployeeJobTitleOptions(profileForm.jobTitle),
    [profileForm.jobTitle],
  );

  const managedDepartmentNames = useMemo(
    () => (user?.managed_departments ?? []).map((department) => department.name.toLowerCase()),
    [user],
  );

  const canManageEmployeeByDepartment = useMemo(() => {
    if (!user || !data) {
      return false;
    }

    const scope = user.employee_management_scope ?? "self";
    if (scope === "global") {
      return Boolean(user.can_manage_employees);
    }

    if (scope !== "department" || !user.can_manage_employees) {
      return false;
    }

    return managedDepartmentNames.includes((data.department ?? "").toLowerCase());
  }, [data, managedDepartmentNames, user]);

  const isSelfProfile = useMemo(() => {
    if (!user || !data) {
      return false;
    }

    return user.email.toLowerCase() === data.email.toLowerCase();
  }, [data, user]);

  const isPowerEmployee = useMemo(() => {
    if (!user) {
      return false;
    }

    const role = (user.role ?? "").trim().toLowerCase();
    const jobTitle = (user.job_title ?? "").trim().toLowerCase();
    const department = (user.department ?? "").trim().toLowerCase();

    if (["admin", "hr", "ceo"].includes(role)) {
      return true;
    }

    if (["ceo", "chief executive officer"].includes(jobTitle)) {
      return true;
    }

    if (["human resources", "hr"].includes(department)) {
      return true;
    }

    return Boolean(user.can_manage_employees) && (user.employee_management_scope ?? "self") === "global";
  }, [user]);

  const isNormalEmployee = !isPowerEmployee;

  const canManageGlobally = useMemo(() => {
    return isPowerEmployee;
  }, [isPowerEmployee]);

  const canManageProfileRecords = useMemo(() => {
    return canManageGlobally;
  }, [canManageGlobally]);

  const canManageAttendance = isSelfProfile || canManageEmployeeByDepartment || canManageGlobally;
  const canEditProfile = isSelfProfile || canManageEmployeeByDepartment || canManageGlobally;
  const canEditExtendedProfileFields = canManageGlobally;
  const isSelfNonGlobalProfile = isSelfProfile && !canEditExtendedProfileFields;
  const hideExtendedProfileTabsForViewer = isNormalEmployee && !isSelfProfile;

  const updateProfileForm = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) => {
    setProfileForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateDocumentForm = <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => {
    setDocumentForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateAssetForm = <K extends keyof AssetFormState>(key: K, value: AssetFormState[K]) => {
    setAssetForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateAttendanceForm = <K extends keyof AttendanceFormState>(key: K, value: AttendanceFormState[K]) => {
    setAttendanceForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const openEditDialog = () => {
    if (!data) {
      return;
    }

    setProfileForm({
      name: data.name,
      email: data.email,
      phone: data.phone ?? "",
      jobTitle: data.job_title,
      department: data.department === "N/A" ? "" : data.department,
      branch: data.branch ?? "",
      location: data.location ?? "",
      joinDate: formatDateForInput(data.join_date),
      status: (data.status as EmployeeFormState["status"]) ?? "Active",
      baseSalary: data.base_salary !== undefined ? String(data.base_salary) : "",
      allowances: data.allowances !== undefined ? String(data.allowances) : "",
      deductions: data.deductions !== undefined ? String(data.deductions) : "",
    });
    setProfileError(null);
    setEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!data || !id) {
      return;
    }

    if (!profileForm.name || !profileForm.email || !profileForm.jobTitle || !profileForm.joinDate) {
      setProfileError("Please fill all required fields.");
      return;
    }

    setProfileSubmitting(true);
    setProfileError(null);

    const payload: EmployeeMutationPayload = canEditExtendedProfileFields
      ? {
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone || undefined,
          job_title: profileForm.jobTitle,
          department: profileForm.department || undefined,
          branch: profileForm.branch || undefined,
          location: profileForm.location || undefined,
          join_date: profileForm.joinDate,
          status: profileForm.status,
          base_salary: toNumber(profileForm.baseSalary),
          allowances: toNumber(profileForm.allowances),
          deductions: toNumber(profileForm.deductions),
        }
      : isSelfNonGlobalProfile
        ? {
            name: data.name,
            email: profileForm.email,
            phone: profileForm.phone || undefined,
            job_title: data.job_title,
            department: data.department === "N/A" ? undefined : data.department,
            branch: data.branch ?? undefined,
            location: profileForm.location || undefined,
            join_date: formatDateForInput(data.join_date),
            status: (data.status as EmployeeFormState["status"]) ?? "Active",
            base_salary: data.base_salary ?? 0,
            allowances: data.allowances ?? 0,
            deductions: data.deductions ?? 0,
          }
      : {
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone || undefined,
          job_title: data.job_title,
          department: data.department === "N/A" ? undefined : data.department,
          branch: data.branch ?? undefined,
          location: profileForm.location || undefined,
          join_date: formatDateForInput(data.join_date),
          status: (data.status as EmployeeFormState["status"]) ?? "Active",
          base_salary: data.base_salary ?? 0,
          allowances: data.allowances ?? 0,
          deductions: data.deductions ?? 0,
        };

    try {
      await employeeService.updateEmployee(data.id, payload);
      setEditDialogOpen(false);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setProfileError(err.message);
      } else {
        setProfileError("Failed to update employee profile.");
      }
    } finally {
      setProfileSubmitting(false);
    }
  };

  const openCreateDocumentDialog = () => {
    setDocumentMode("create");
    setEditingDocument(null);
    setDocumentForm(defaultDocumentFormState);
    setDocumentError(null);
    setDocumentDialogOpen(true);
  };

  const openEditDocumentDialog = (document: EmployeeProfileData["documents"][number]) => {
    setDocumentMode("edit");
    setEditingDocument(document);
    setDocumentForm({
      name: document.name,
      type: document.type,
      uploadDate: formatDateForInput(document.upload_date),
      file: null,
    });
    setDocumentError(null);
    setDocumentDialogOpen(true);
  };

  const handleSaveDocument = async () => {
    if (!data) {
      return;
    }

    if (!documentForm.name.trim() || !documentForm.type.trim()) {
      setDocumentError("Document name and type are required.");
      return;
    }

    if (documentMode === "create" && !documentForm.file) {
      setDocumentError("Please choose a file to upload.");
      return;
    }

    setDocumentSubmitting(true);
    setDocumentError(null);

    try {
      if (documentMode === "create") {
        await employeeService.uploadDocument(data.id, {
          name: documentForm.name.trim(),
          type: documentForm.type.trim(),
          upload_date: documentForm.uploadDate || undefined,
          file: documentForm.file ?? undefined,
        });
      } else if (editingDocument) {
        await employeeService.updateDocument(data.id, editingDocument.id, {
          name: documentForm.name.trim(),
          type: documentForm.type.trim(),
          upload_date: documentForm.uploadDate || undefined,
          file: documentForm.file ?? undefined,
        });
      }

      setDocumentDialogOpen(false);
      setEditingDocument(null);
      setDocumentForm(defaultDocumentFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setDocumentError(err.message);
      } else {
        setDocumentError("Failed to save document.");
      }
    } finally {
      setDocumentSubmitting(false);
    }
  };

  const handleDeleteDocument = async (document: EmployeeProfileData["documents"][number]) => {
    if (!data) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${document.name}"? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setDeletingDocumentId(document.id);

    try {
      await employeeService.deleteDocument(data.id, document.id);
      await refetch();
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const openCreateAssetDialog = () => {
    setAssetMode("create");
    setEditingAsset(null);
    setAssetForm(defaultAssetFormState);
    setAssetError(null);
    setAssetDialogOpen(true);
  };

  const openEditAssetDialog = (asset: EmployeeProfileData["assets"][number]) => {
    setAssetMode("edit");
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      serialNumber: asset.serial_number,
      assignedDate: formatDateForInput(asset.assigned_date),
    });
    setAssetError(null);
    setAssetDialogOpen(true);
  };

  const handleSaveAsset = async () => {
    if (!data) {
      return;
    }

    if (!assetForm.name.trim() || !assetForm.serialNumber.trim()) {
      setAssetError("Asset name and serial number are required.");
      return;
    }

    setAssetSubmitting(true);
    setAssetError(null);

    try {
      if (assetMode === "create") {
        await employeeService.createAsset(data.id, {
          name: assetForm.name.trim(),
          serial_number: assetForm.serialNumber.trim(),
          assigned_date: assetForm.assignedDate || undefined,
        });
      } else if (editingAsset) {
        await employeeService.updateAsset(data.id, editingAsset.id, {
          name: assetForm.name.trim(),
          serial_number: assetForm.serialNumber.trim(),
          assigned_date: assetForm.assignedDate || undefined,
        });
      }

      setAssetDialogOpen(false);
      setEditingAsset(null);
      setAssetForm(defaultAssetFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setAssetError(err.message);
      } else {
        setAssetError("Failed to save asset.");
      }
    } finally {
      setAssetSubmitting(false);
    }
  };

  const handleDeleteAsset = async (asset: EmployeeProfileData["assets"][number]) => {
    if (!data) {
      return;
    }

    const shouldDelete = window.confirm(`Delete asset "${asset.name}"? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setDeletingAssetId(asset.id);

    try {
      await employeeService.deleteAsset(data.id, asset.id);
      await refetch();
    } finally {
      setDeletingAssetId(null);
    }
  };

  const openAttendanceDialog = () => {
    const todayAttendance = data?.today_attendance;

    setAttendanceForm({
      checkIn: parseTimeForInput(todayAttendance?.check_in),
      checkOut: parseTimeForInput(todayAttendance?.check_out),
      status: (todayAttendance?.status as AttendanceFormState["status"]) ?? "Present",
    });
    setAttendanceError(null);
    setAttendanceDialogOpen(true);
  };

  const handleSaveTodayAttendance = async () => {
    if (!data) {
      return;
    }

    if (attendanceForm.status !== "Absent" && !attendanceForm.checkIn) {
      setAttendanceError("Check-in time is required unless status is Absent.");
      return;
    }

    setAttendanceSubmitting(true);
    setAttendanceError(null);

    try {
      await employeeService.upsertTodayAttendance(data.id, {
        status: attendanceForm.status,
        check_in: attendanceForm.status === "Absent" ? undefined : attendanceForm.checkIn || undefined,
        check_out: attendanceForm.status === "Absent" ? undefined : attendanceForm.checkOut || undefined,
      });

      setAttendanceDialogOpen(false);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setAttendanceError(err.message);
      } else {
        setAttendanceError("Failed to save today attendance.");
      }
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  const handleDeleteTodayAttendance = async () => {
    if (!data || !data.today_attendance) {
      return;
    }

    const shouldDelete = window.confirm("Delete today's attendance record? This action cannot be undone.");
    if (!shouldDelete) {
      return;
    }

    setDeletingTodayAttendance(true);

    try {
      await employeeService.deleteTodayAttendance(data.id);
      await refetch();
    } finally {
      setDeletingTodayAttendance(false);
    }
  };

  const handleToggleOnboardingTask = async (
    task: EmployeeOnboardingData["tasks"][number],
  ) => {
    if (!data) {
      return;
    }

    setUpdatingOnboardingTaskId(task.id);

    try {
      await employeeService.updateOnboardingTask(data.id, task.id, !task.is_completed);
      await refetchOnboarding();
    } finally {
      setUpdatingOnboardingTaskId(null);
    }
  };

  if (!id) {
    return <div className="text-gray-600">Employee ID is missing.</div>;
  }

  if (loading && !data) {
    return <div className="text-gray-600">Loading employee profile...</div>;
  }

  if (error && !data) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="text-red-600">{error}</div>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return <div className="text-gray-600">Employee not found.</div>;
  }

  const initials = data.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <Link to="/employees" className="inline-flex items-center text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Employees
      </Link>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-3xl">{initials}</span>
            </div>
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
                    {canEditExtendedProfileFields && (
                      <Badge
                        className={
                          data.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }
                        variant="secondary"
                      >
                        {data.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg text-gray-700 mb-3">{data.job_title}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {data.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {data.phone ?? "N/A"}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {data.location ?? "N/A"}
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      Joined {data.join_date}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={openEditDialog} disabled={!canEditProfile}>
                    Edit Profile
                  </Button>
                  <Button
                    className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                    onClick={() => setPayslipDialogOpen(true)}
                  >
                    View Payslip
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Personal Info</TabsTrigger>
          {data.is_new_hire && <TabsTrigger value="onboarding">Onboarding</TabsTrigger>}
          {!hideExtendedProfileTabsForViewer && (
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          )}
          {!hideExtendedProfileTabsForViewer && <TabsTrigger value="leave">Leave History</TabsTrigger>}
          {!hideExtendedProfileTabsForViewer && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {!hideExtendedProfileTabsForViewer && <TabsTrigger value="assets">Assets</TabsTrigger>}
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600">Employee ID</div>
                  <div className="font-medium text-gray-900">{data.employee_id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Department</div>
                  <div className="font-medium text-gray-900">{data.department}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Job Title</div>
                  <div className="font-medium text-gray-900">{data.job_title}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Manager</div>
                  <div className="font-medium text-gray-900">
                    {data.manager}
                    {data.manager_role && data.manager_role !== "N/A" ? ` | ${data.manager_role}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Join Date</div>
                  <div className="font-medium text-gray-900">{data.join_date}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600">Email</div>
                  <div className="font-medium text-gray-900">{data.email}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Phone</div>
                  <div className="font-medium text-gray-900">{data.phone ?? "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="font-medium text-gray-900">{data.location ?? "N/A"}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {data.is_new_hire && (
          <TabsContent value="onboarding">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Onboarding Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {onboardingError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {onboardingError}
                  </div>
                )}

                {onboardingLoading && (
                  <div className="text-sm text-gray-500">Loading onboarding tasks...</div>
                )}

                {!onboardingLoading && onboardingData && onboardingData.tasks.length > 0 && (
                  <>
                    <div className="text-sm text-gray-600">
                      Completed {onboardingData.summary.completed} of {onboardingData.summary.total} tasks
                    </div>
                    <div className="space-y-3">
                      {onboardingData.tasks.map((task) => (
                        <div key={task.id} className="flex items-start justify-between p-4 rounded-lg bg-gray-50">
                          <div>
                            <div className="font-medium text-gray-900">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-gray-600 mt-1">{task.description}</div>
                            )}
                            {task.completed_at && (
                              <div className="text-xs text-gray-500 mt-1">
                                Completed {new Date(task.completed_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canManageProfileRecords || updatingOnboardingTaskId === task.id}
                            onClick={() => void handleToggleOnboardingTask(task)}
                            className={
                              task.is_completed
                                ? "text-green-700 border-green-200 hover:bg-green-50"
                                : "text-gray-700"
                            }
                          >
                            {updatingOnboardingTaskId === task.id
                              ? "Saving..."
                              : task.is_completed
                                ? "Completed"
                                : "Mark Complete"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!onboardingLoading && onboardingData && onboardingData.tasks.length === 0 && (
                  <div className="text-sm text-gray-500">No onboarding tasks found.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!hideExtendedProfileTabsForViewer && (
          <TabsContent value="attendance">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <CardTitle>Attendance History</CardTitle>
                  {canManageAttendance && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={openAttendanceDialog}>
                        {data.today_attendance ? "Edit Today" : "Create Today"}
                      </Button>
                      {data.today_attendance && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => void handleDeleteTodayAttendance()}
                          disabled={deletingTodayAttendance}
                        >
                          {deletingTodayAttendance ? "Deleting..." : "Delete Today"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Today</div>
                  {data.today_attendance ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <span className="text-gray-700">Check In: {data.today_attendance.check_in}</span>
                      <span className="text-gray-700">Check Out: {data.today_attendance.check_out}</span>
                      <span className="text-gray-700">Work Hours: {data.today_attendance.work_hours}</span>
                      <Badge className={getAttendanceStatusClassName(data.today_attendance.status)} variant="secondary">
                        {data.today_attendance.status}
                      </Badge>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No attendance record for today.</div>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attendance_history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No attendance history found.
                        </TableCell>
                      </TableRow>
                    )}
                    {data.attendance_history.map((record, index) => (
                      <TableRow key={`${record.date}-${index}`}>
                        <TableCell className="font-medium">{record.date}</TableCell>
                        <TableCell>{record.check_in}</TableCell>
                        <TableCell>{record.check_out}</TableCell>
                        <TableCell>
                          <Badge className={getAttendanceStatusClassName(record.status)} variant="secondary">
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!hideExtendedProfileTabsForViewer && <TabsContent value="leave">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leave_history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No leave history found.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.leave_history.map((leave, index) => (
                    <TableRow key={`${leave.type}-${leave.from}-${index}`}>
                      <TableCell className="font-medium">{leave.type}</TableCell>
                      <TableCell>{leave.from}</TableCell>
                      <TableCell>{leave.to}</TableCell>
                      <TableCell>{leave.days}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            leave.status === "Approved"
                              ? "bg-green-100 text-green-700"
                              : leave.status === "Pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }
                          variant="secondary"
                        >
                          {leave.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>}

        {!hideExtendedProfileTabsForViewer && <TabsContent value="documents">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Documents</CardTitle>
                {canManageProfileRecords && (
                  <Button size="sm" variant="outline" onClick={openCreateDocumentDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.documents.length === 0 && (
                  <div className="text-sm text-gray-500 py-8 text-center">No documents uploaded.</div>
                )}
                {data.documents.map((document, index) => (
                  <div
                    key={`${document.name}-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{document.name}</div>
                      <div className="text-sm text-gray-600">
                        {document.type} • Uploaded {document.upload_date ?? "N/A"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (document.file_url) {
                            openInNewTab(document.file_url);
                          }
                        }}
                        disabled={!document.file_url}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      {canManageProfileRecords && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEditDocumentDialog(document)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => void handleDeleteDocument(document)}
                            disabled={deletingDocumentId === document.id}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deletingDocumentId === document.id ? "Deleting..." : "Delete"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>}

        {!hideExtendedProfileTabsForViewer && <TabsContent value="assets">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Assigned Assets</CardTitle>
                {canManageProfileRecords && (
                  <Button size="sm" variant="outline" onClick={openCreateAssetDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Asset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Name</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    {canManageProfileRecords && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canManageProfileRecords ? 4 : 3} className="text-center py-8 text-gray-500">
                        No assets assigned.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.assets.map((asset, index) => (
                    <TableRow key={`${asset.serial_number}-${index}`}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell className="text-gray-600">{asset.serial_number}</TableCell>
                      <TableCell>{asset.assigned_date ?? "N/A"}</TableCell>
                      {canManageProfileRecords && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditAssetDialog(asset)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600"
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
        </TabsContent>}
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {profileError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  className="mt-2"
                  value={profileForm.name}
                  onChange={(event) => updateProfileForm("name", event.target.value)}
                  disabled={isNormalEmployee}
                />
              </div>
              <div>
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  className="mt-2"
                  value={profileForm.email}
                  onChange={(event) => updateProfileForm("email", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="profile-phone">Phone</Label>
                <Input
                  id="profile-phone"
                  className="mt-2"
                  value={profileForm.phone}
                  onChange={(event) => updateProfileForm("phone", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="profile-job">Job Title</Label>
                <Select
                  value={profileForm.jobTitle || "none"}
                  onValueChange={(value) => updateProfileForm("jobTitle", value === "none" ? "" : value)}
                  disabled={isNormalEmployee}
                >
                  <SelectTrigger id="profile-job" className="mt-2">
                    <SelectValue placeholder="Select job title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select job title</SelectItem>
                    {profileJobTitleOptions.map((jobTitle) => (
                      <SelectItem key={jobTitle} value={jobTitle}>
                        {jobTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="profile-dept">Department</Label>
                <Select
                  value={profileForm.department || "none"}
                  onValueChange={(value) => updateProfileForm("department", value === "none" ? "" : value)}
                  disabled={isNormalEmployee}
                >
                  <SelectTrigger id="profile-dept" className="mt-2">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="profile-branch">Branch</Label>
                <Select
                  value={profileForm.branch || "none"}
                  onValueChange={(value) => updateProfileForm("branch", value === "none" ? "" : value)}
                  disabled={isNormalEmployee}
                >
                  <SelectTrigger id="profile-branch" className="mt-2">
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
                <Label htmlFor="profile-location">Location</Label>
                <Input
                  id="profile-location"
                  className="mt-2"
                  value={profileForm.location}
                  onChange={(event) => updateProfileForm("location", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="profile-join-date">Join Date</Label>
                <Input
                  id="profile-join-date"
                  type="date"
                  className="mt-2"
                  value={profileForm.joinDate}
                  onChange={(event) => updateProfileForm("joinDate", event.target.value)}
                  disabled={isNormalEmployee}
                />
              </div>
              {(canEditExtendedProfileFields || isSelfNonGlobalProfile) && (
                <div>
                  <Label htmlFor="profile-base">Base Salary</Label>
                  <Input
                    id="profile-base"
                    type="number"
                    min="0"
                    className="mt-2"
                    value={profileForm.baseSalary}
                    onChange={(event) => updateProfileForm("baseSalary", event.target.value)}
                    disabled={isNormalEmployee}
                  />
                </div>
              )}
              {canEditExtendedProfileFields && (
                <>
                  <div>
                    <Label htmlFor="profile-status">Status</Label>
                    <Select
                      value={profileForm.status}
                      onValueChange={(value) => updateProfileForm("status", value as EmployeeFormState["status"])}
                      disabled={isNormalEmployee}
                    >
                      <SelectTrigger id="profile-status" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="profile-allowances">Allowances</Label>
                    <Input
                      id="profile-allowances"
                      type="number"
                      min="0"
                      className="mt-2"
                      value={profileForm.allowances}
                      onChange={(event) => updateProfileForm("allowances", event.target.value)}
                      disabled={isNormalEmployee}
                    />
                  </div>
                  <div>
                    <Label htmlFor="profile-deductions">Deductions</Label>
                    <Input
                      id="profile-deductions"
                      type="number"
                      min="0"
                      className="mt-2"
                      value={profileForm.deductions}
                      onChange={(event) => updateProfileForm("deductions", event.target.value)}
                      disabled={isNormalEmployee}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={profileSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveProfile()}
                disabled={profileSubmitting}
              >
                {profileSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payslipDialogOpen} onOpenChange={setPayslipDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Employee Payslip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="payslip-month">Month (optional)</Label>
              <Input
                id="payslip-month"
                type="month"
                className="mt-2"
                value={payslipMonth}
                onChange={(event) => setPayslipMonth(event.target.value)}
              />
            </div>

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
                        {payslipData.employee.department} • {payslipData.employee.job_title}
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
                    <div className="text-right font-medium">{formatCurrency(payslipData.payslip.base_salary)}</div>
                    <div className="text-gray-600">Allowances</div>
                    <div className="text-right font-medium text-green-600">
                      +{formatCurrency(payslipData.payslip.allowances)}
                    </div>
                    <div className="text-gray-600">Deductions</div>
                    <div className="text-right font-medium text-red-600">
                      -{formatCurrency(payslipData.payslip.deductions)}
                    </div>
                    <div className="text-gray-900 font-semibold border-t pt-2">Net Salary</div>
                    <div className="text-right font-semibold text-gray-900 border-t pt-2">
                      {formatCurrency(payslipData.payslip.net_salary)}
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

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{documentMode === "create" ? "Upload Document" : "Edit Document"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {documentError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {documentError}
              </div>
            )}

            <div>
              <Label htmlFor="doc-name">Document Name</Label>
              <Input
                id="doc-name"
                className="mt-2"
                value={documentForm.name}
                onChange={(event) => updateDocumentForm("name", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="doc-type">Document Type</Label>
              <Input
                id="doc-type"
                className="mt-2"
                placeholder="PDF, DOCX, ID..."
                value={documentForm.type}
                onChange={(event) => updateDocumentForm("type", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="doc-upload-date">Upload Date</Label>
              <Input
                id="doc-upload-date"
                type="date"
                className="mt-2"
                value={documentForm.uploadDate}
                onChange={(event) => updateDocumentForm("uploadDate", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="doc-file">
                {documentMode === "create" ? "File" : "Replace File (optional)"}
              </Label>
              <Input
                id="doc-file"
                type="file"
                className="mt-2"
                accept=".pdf,.doc,.docx"
                onChange={(event) => updateDocumentForm("file", event.target.files?.[0] ?? null)}
              />
              <div className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10 MB</div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDocumentDialogOpen(false)} disabled={documentSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveDocument()}
                disabled={documentSubmitting}
              >
                {documentSubmitting
                  ? documentMode === "create"
                    ? "Uploading..."
                    : "Saving..."
                  : documentMode === "create"
                    ? "Upload"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{assetMode === "create" ? "Add Asset" : "Edit Asset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {assetError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {assetError}
              </div>
            )}

            <div>
              <Label htmlFor="asset-name">Asset Name</Label>
              <Input
                id="asset-name"
                className="mt-2"
                value={assetForm.name}
                onChange={(event) => updateAssetForm("name", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="asset-serial">Serial Number</Label>
              <Input
                id="asset-serial"
                className="mt-2"
                value={assetForm.serialNumber}
                onChange={(event) => updateAssetForm("serialNumber", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="asset-assigned-date">Assigned Date</Label>
              <Input
                id="asset-assigned-date"
                type="date"
                className="mt-2"
                value={assetForm.assignedDate}
                onChange={(event) => updateAssetForm("assignedDate", event.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAssetDialogOpen(false)} disabled={assetSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveAsset()}
                disabled={assetSubmitting}
              >
                {assetSubmitting
                  ? assetMode === "create"
                    ? "Adding..."
                    : "Saving..."
                  : assetMode === "create"
                    ? "Add Asset"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {data.today_attendance ? "Edit Today Attendance" : "Create Today Attendance"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {attendanceError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {attendanceError}
              </div>
            )}

            <div>
              <Label htmlFor="today-attendance-status">Status</Label>
              <Select
                value={attendanceForm.status}
                onValueChange={(value) => updateAttendanceForm("status", value as AttendanceFormState["status"])}
              >
                <SelectTrigger id="today-attendance-status" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Early">Early</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Overtime">Overtime</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="today-attendance-check-in">Check In</Label>
              <Input
                id="today-attendance-check-in"
                type="time"
                className="mt-2"
                value={attendanceForm.checkIn}
                onChange={(event) => updateAttendanceForm("checkIn", event.target.value)}
                disabled={attendanceForm.status === "Absent"}
              />
            </div>
            <div>
              <Label htmlFor="today-attendance-check-out">Check Out</Label>
              <Input
                id="today-attendance-check-out"
                type="time"
                className="mt-2"
                value={attendanceForm.checkOut}
                onChange={(event) => updateAttendanceForm("checkOut", event.target.value)}
                disabled={attendanceForm.status === "Absent"}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAttendanceDialogOpen(false)} disabled={attendanceSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSaveTodayAttendance()}
                disabled={attendanceSubmitting}
              >
                {attendanceSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
