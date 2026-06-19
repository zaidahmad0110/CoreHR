import { apiFileRequest, apiRequest } from "./client";
import type {
  AssetsData,
  ExpensesData,
  LoansData,
  AttendanceData,
  BioTimeSyncResult,
  AuthTwoFactorChallenge,
  AuthUser,
  BranchItem,
  CalendarData,
  ChatbotQueryResponse,
  DashboardData,
  DepartmentItem,
  OrganizationChartData,
  EmployeeListItem,
  EmployeeDocumentPayload,
  EmployeeAssetPayload,
  TodayAttendancePayload,
  EmployeePayslipData,
  EmployeeProfileData,
  EmployeeOnboardingData,
  LeaveManagementData,
  NotificationsData,
  PayrollData,
  PerformanceData,
  PublicRecruitmentData,
  TrainingData,
  TrainingMaterialsData,
  RecruitmentData,
  RecruitmentJobDetails,
  SettingsData,
  CommunicationSettingsUpdateResult,
  UserPermissionTerms,
  UserPermissions,
  UserPrivilegesData,
} from "./types";

export interface EmployeeMutationPayload {
  name: string;
  employee_code?: string;
  email: string;
  phone?: string;
  job_title: string;
  department?: string;
  manager_id?: number;
  branch?: string;
  location?: string;
  join_date: string;
  status: "Active" | "On Leave" | "Inactive";
  base_salary?: number;
  allowances?: number;
  deductions?: number;
  create_user_account?: boolean;
  user_role?: "Admin" | "HR" | "Manager" | "Employee";
  user_password?: string;
}

export interface AuthLoginSuccess {
  user: AuthUser;
  access_token: string;
  token_type: "Bearer";
}

const toQueryString = (params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export const authService = {
  async login(payload: { email: string; password: string; remember: boolean; otp_code?: string }) {
    return apiRequest<AuthLoginSuccess | AuthTwoFactorChallenge>("/api/login", {
      method: "POST",
      body: payload,
    });
  },
  logout() {
    return apiRequest<void>("/api/logout", {
      method: "POST",
    });
  },
  me() {
    return apiRequest<AuthUser>("/api/me");
  },
  getTwoFactorStatus() {
    return apiRequest<{ enabled: boolean }>("/api/auth/two-factor");
  },
  updateTwoFactor(enabled: boolean) {
    return apiRequest<{ enabled: boolean }>("/api/auth/two-factor", {
      method: "PATCH",
      body: { enabled },
    });
  },
  changePassword(payload: { current_password: string; password: string; password_confirmation: string }) {
    return apiRequest<void>("/api/auth/password", {
      method: "PATCH",
      body: payload,
    });
  },
  requestPasswordReset(email: string) {
    return apiRequest<void>("/api/forgot-password", {
      method: "POST",
      body: { email },
    });
  },
  resetPassword(payload: { email: string; code: string; password: string; password_confirmation: string }) {
    return apiRequest<void>("/api/reset-password", {
      method: "POST",
      body: payload,
    });
  },
};

export const dashboardService = {
  getDashboard() {
    return apiRequest<DashboardData>("/api/dashboard");
  },
};

export const calendarService = {
  getEvents() {
    return apiRequest<CalendarData>("/api/calendar/events");
  },
};

export const employeeService = {
  getEmployees(filters: { search?: string; department?: string; status?: string }) {
    return apiRequest<EmployeeListItem[]>(
      `/api/employees${toQueryString({
        search: filters.search,
        department: filters.department,
        status: filters.status,
      })}`,
    );
  },
  getEmployee(id: string) {
    return apiRequest<EmployeeProfileData>(`/api/employees/${id}`);
  },
  getOnboarding(id: string) {
    return apiRequest<EmployeeOnboardingData>(`/api/employees/${id}/onboarding`);
  },
  updateOnboardingTask(employeeId: number, taskId: number, is_completed: boolean) {
    return apiRequest<EmployeeOnboardingData["tasks"][number]>(
      `/api/employees/${employeeId}/onboarding/${taskId}`,
      {
        method: "PATCH",
        body: { is_completed },
      },
    );
  },
  createEmployee(payload: EmployeeMutationPayload) {
    return apiRequest<EmployeeListItem>("/api/employees", {
      method: "POST",
      body: payload,
    });
  },
  updateEmployee(id: number, payload: EmployeeMutationPayload) {
    return apiRequest<EmployeeListItem>(`/api/employees/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  resetEmployeePassword(id: number, password: string) {
    return apiRequest<void>(`/api/employees/${id}/reset-password`, {
      method: "PATCH",
      body: { password },
    });
  },
  getPayslip(id: string, month?: string) {
    return apiRequest<EmployeePayslipData>(
      `/api/employees/${id}/payslip${toQueryString({ month })}`,
    );
  },
  uploadDocument(id: number, payload: EmployeeDocumentPayload) {
    const formData = new FormData();

    if (payload.name) formData.append("name", payload.name);
    if (payload.type) formData.append("type", payload.type);
    if (payload.upload_date) formData.append("upload_date", payload.upload_date);
    if (payload.file) formData.append("file", payload.file);

    return apiRequest<EmployeeProfileData["documents"][number]>(`/api/employees/${id}/documents`, {
      method: "POST",
      body: formData,
    });
  },
  updateDocument(employeeId: number, documentId: number, payload: EmployeeDocumentPayload) {
    const formData = new FormData();
    formData.append("_method", "PATCH");
    formData.append("name", payload.name ?? "");
    formData.append("type", payload.type ?? "File");
    if (payload.upload_date) formData.append("upload_date", payload.upload_date);
    if (payload.file) formData.append("file", payload.file);

    return apiRequest<EmployeeProfileData["documents"][number]>(
      `/api/employees/${employeeId}/documents/${documentId}`,
      {
        method: "POST",
        body: formData,
      },
    );
  },
  deleteDocument(employeeId: number, documentId: number) {
    return apiRequest<void>(`/api/employees/${employeeId}/documents/${documentId}`, {
      method: "DELETE",
    });
  },
  createAsset(employeeId: number, payload: EmployeeAssetPayload) {
    return apiRequest<EmployeeProfileData["assets"][number]>(`/api/employees/${employeeId}/assets`, {
      method: "POST",
      body: payload,
    });
  },
  updateAsset(employeeId: number, assetId: number, payload: EmployeeAssetPayload) {
    return apiRequest<EmployeeProfileData["assets"][number]>(`/api/employees/${employeeId}/assets/${assetId}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteAsset(employeeId: number, assetId: number) {
    return apiRequest<void>(`/api/employees/${employeeId}/assets/${assetId}`, {
      method: "DELETE",
    });
  },
  upsertTodayAttendance(employeeId: number, payload: TodayAttendancePayload) {
    return apiRequest<EmployeeProfileData["today_attendance"]>(`/api/employees/${employeeId}/today-attendance`, {
      method: "PUT",
      body: payload,
    });
  },
  deleteTodayAttendance(employeeId: number) {
    return apiRequest<void>(`/api/employees/${employeeId}/today-attendance`, {
      method: "DELETE",
    });
  },
  deleteEmployee(id: number) {
    return apiRequest<void>(`/api/employees/${id}`, {
      method: "DELETE",
    });
  },
};

export const organizationService = {
  getDepartments() {
    return apiRequest<DepartmentItem[]>("/api/departments");
  },
  createDepartment(payload: { name: string; manager_name?: string; manager_user_id?: number }) {
    return apiRequest<{ id: number }>("/api/departments", {
      method: "POST",
      body: payload,
    });
  },
  updateDepartment(id: number, payload: { name: string; manager_name?: string; manager_user_id?: number }) {
    return apiRequest<{ id: number }>(`/api/departments/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteDepartment(id: number) {
    return apiRequest<void>(`/api/departments/${id}`, {
      method: "DELETE",
    });
  },
  getBranches() {
    return apiRequest<BranchItem[]>("/api/branches");
  },
  createBranch(payload: { name: string; location: string; manager_name?: string; manager_user_id?: number }) {
    return apiRequest<{ id: number }>("/api/branches", {
      method: "POST",
      body: payload,
    });
  },
  updateBranch(id: number, payload: { name: string; location: string; manager_name?: string; manager_user_id?: number }) {
    return apiRequest<{ id: number }>(`/api/branches/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteBranch(id: number) {
    return apiRequest<void>(`/api/branches/${id}`, {
      method: "DELETE",
    });
  },
  getOrganizationChart() {
    return apiRequest<OrganizationChartData>("/api/organization-chart");
  },
  updateOrganizationChart(payload: {
    positions: Array<{
      id?: number;
      role_title: string;
      person_name: string;
      department?: string;
    }>;
  }) {
    return apiRequest<void>("/api/organization-chart", {
      method: "PUT",
      body: payload,
    });
  },
};

export const attendanceService = {
  getAttendance(date: string) {
    return apiRequest<AttendanceData>(`/api/attendance${toQueryString({ date })}`);
  },
};

export const assetService = {
  getAssets() {
    return apiRequest<AssetsData>("/api/assets");
  },
  createAsset(payload: {
    name: string;
    asset_type?: string;
    serial_number: string;
    employee_id?: number;
    assigned_date?: string;
  }) {
    return apiRequest<{ id: number }>("/api/assets", {
      method: "POST",
      body: payload,
    });
  },
  updateAsset(
    id: number,
    payload: {
      name: string;
      asset_type?: string;
      serial_number: string;
      employee_id?: number;
      assigned_date?: string;
    },
  ) {
    return apiRequest<{ id: number }>(`/api/assets/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteAsset(id: number) {
    return apiRequest<void>(`/api/assets/${id}`, {
      method: "DELETE",
    });
  },
  importCsv(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest<{
      created: number;
      skipped: number;
      errors: string[];
    }>("/api/assets/import-csv", {
      method: "POST",
      body: formData,
    });
  },
};

export const leaveService = {
  getLeaveData() {
    return apiRequest<LeaveManagementData>("/api/leaves");
  },
  createLeave(payload: {
    type: string;
    request_unit: "day" | "hour";
    from_date: string;
    to_date?: string;
    from_time?: string;
    to_time?: string;
    reason: string;
    sick_leave_photo?: File;
  }) {
    const formData = new FormData();
    formData.append("type", payload.type);
    formData.append("request_unit", payload.request_unit);
    formData.append("from_date", payload.from_date);
    if (payload.to_date) formData.append("to_date", payload.to_date);
    if (payload.from_time) formData.append("from_time", payload.from_time);
    if (payload.to_time) formData.append("to_time", payload.to_time);
    formData.append("reason", payload.reason);
    if (payload.sick_leave_photo) formData.append("sick_leave_photo", payload.sick_leave_photo);

    return apiRequest<{ id: number; status: string }>("/api/leaves", {
      method: "POST",
      body: formData,
    });
  },
  updateLeaveStatus(id: number, status: "Approved" | "Rejected" | "Pending") {
    return apiRequest<{ id: number; status: string }>(`/api/leaves/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  },
  viewSickLeavePhoto(id: number) {
    return apiFileRequest(`/api/leaves/${id}/sick-leave-photo`);
  },
};

export const expenseService = {
  getExpenses() {
    return apiRequest<ExpensesData>("/api/expenses");
  },
  createExpense(payload: {
    category: string;
    amount: number;
    expense_date: string;
    description: string;
    receipt?: File;
  }) {
    const formData = new FormData();
    formData.append("category", payload.category);
    formData.append("amount", String(payload.amount));
    formData.append("expense_date", payload.expense_date);
    formData.append("description", payload.description);
    if (payload.receipt) formData.append("receipt", payload.receipt);

    return apiRequest<{ id: number; status: string }>("/api/expenses", {
      method: "POST",
      body: formData,
    });
  },
  updateExpenseStatus(id: number, status: "Approved" | "Rejected", rejection_note?: string) {
    const body: { status: "Approved" | "Rejected"; rejection_note?: string } = { status };
    if (status === "Rejected" && rejection_note) {
      body.rejection_note = rejection_note;
    }

    return apiRequest<{ id: number; status: string }>(`/api/expenses/${id}/status`, {
      method: "PATCH",
      body,
    });
  },
  viewReceipt(id: number) {
    return apiFileRequest(`/api/expenses/${id}/receipt`);
  },
};

export const loanService = {
  getLoans() {
    return apiRequest<LoansData>("/api/loans");
  },
  createLoan(payload: {
    amount: number;
    purpose: string;
    request_date?: string;
    installments: number;
  }) {
    return apiRequest<{ id: number; status: string }>("/api/loans", {
      method: "POST",
      body: payload,
    });
  },
  updateLoanStatus(id: number, status: "Approved" | "Rejected") {
    return apiRequest<{ id: number; status: string }>(`/api/loans/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  },
};

export const payrollService = {
  getPayroll(month?: string) {
    return apiRequest<PayrollData>(`/api/payroll${toQueryString({ month })}`);
  },
  submitPayrollByHr(payrollPeriodId: number) {
    return apiRequest<{ id: number; workflow_status: string }>(`/api/payroll/${payrollPeriodId}/submit-hr`, {
      method: "PATCH",
    });
  },
  approvePayrollByFinance(payrollPeriodId: number) {
    return apiRequest<{ id: number; workflow_status: string }>(`/api/payroll/${payrollPeriodId}/approve-finance`, {
      method: "PATCH",
    });
  },
};

export const performanceService = {
  getPerformance(reviewType?: "Monthly" | "Half Yearly" | "Yearly") {
    return apiRequest<PerformanceData>(`/api/performance${toQueryString({ review_type: reviewType })}`);
  },
  createReview(payload: {
    employee_id: number;
    review_type: "Monthly" | "Half Yearly" | "Yearly";
    period_start: string;
    period_end: string;
    rating?: number;
    goals_total?: number;
    goals_completed?: number;
    question_responses?: Array<{
      question: string;
      score: number;
      comment?: string;
    }>;
    review_summary?: string;
  }) {
    return apiRequest<{ id: number }>("/api/performance", {
      method: "POST",
      body: payload,
    });
  },
  updateReviewWorkflow(
    reviewId: number,
    payload: {
      action: "submit_manager_review" | "submit_department_review" | "submit_hr_review";
      rating?: number;
      goals_total?: number;
      goals_completed?: number;
      review_summary?: string;
      question_responses?: Array<{
        question: string;
        score: number;
        comment?: string;
      }>;
    },
  ) {
    return apiRequest<{ id: number; workflow_stage: string }>(`/api/performance/${reviewId}/workflow`, {
      method: "PATCH",
      body: payload,
    });
  },
};

export const trainingService = {
  getTrainingData() {
    return apiRequest<TrainingData>("/api/training");
  },
  getTrainingMaterials(programId?: number) {
    const query = programId ? `?training_program_id=${programId}` : "";
    return apiRequest<TrainingMaterialsData>(`/api/training/materials${query}`);
  },
  createProgram(payload: {
    title: string;
    description?: string;
    video_url?: string;
    article_url?: string;
    article_content?: string;
    instructor: string;
    duration_days: number;
    duration_weeks?: number;
    capacity: number;
    start_date?: string;
    end_date?: string;
  }) {
    return apiRequest<{ id: number }>("/api/training/programs", {
      method: "POST",
      body: payload,
    });
  },
  enroll(programId: number) {
    return apiRequest<{ id: number }>(`/api/training/programs/${programId}/enroll`, {
      method: "POST",
    });
  },
  uploadMaterial(payload: {
    training_program_id: number;
    title: string;
    material_type: "Document" | "Video" | "Article";
    description?: string;
    external_url?: string;
    article_content?: string;
    file?: File;
  }) {
    const formData = new FormData();
    formData.append("training_program_id", String(payload.training_program_id));
    formData.append("title", payload.title);
    formData.append("material_type", payload.material_type);
    if (payload.description) formData.append("description", payload.description);
    if (payload.external_url) formData.append("external_url", payload.external_url);
    if (payload.article_content) formData.append("article_content", payload.article_content);
    if (payload.file) formData.append("file", payload.file);

    return apiRequest<{ id: number }>("/api/training/materials", {
      method: "POST",
      body: formData,
    });
  },
  updateMaterial(
    materialId: number,
    payload: {
      training_program_id: number;
      title: string;
      material_type: "Document" | "Video" | "Article";
      description?: string;
      external_url?: string;
      article_content?: string;
      remove_existing_file?: boolean;
      file?: File;
    },
  ) {
    const formData = new FormData();
    formData.append("_method", "PATCH");
    formData.append("training_program_id", String(payload.training_program_id));
    formData.append("title", payload.title);
    formData.append("material_type", payload.material_type);
    formData.append("description", payload.description ?? "");
    formData.append("external_url", payload.external_url ?? "");
    formData.append("article_content", payload.article_content ?? "");
    formData.append("remove_existing_file", payload.remove_existing_file ? "1" : "0");
    if (payload.file) formData.append("file", payload.file);

    return apiRequest<{ id: number }>(`/api/training/materials/${materialId}`, {
      method: "POST",
      body: formData,
    });
  },
  deleteMaterial(materialId: number) {
    return apiRequest<void>(`/api/training/materials/${materialId}`, {
      method: "DELETE",
    });
  },
  viewMaterial(materialId: number) {
    return apiFileRequest(`/api/training/materials/${materialId}/view`);
  },
};

export const recruitmentService = {
  getPublicJobs() {
    return apiRequest<PublicRecruitmentData>("/api/public/jobs");
  },
  applyToPublicJob(
    jobId: number,
    payload: {
      name: string;
      email: string;
      phone?: string;
      skills?: string;
      years_experience?: number;
      cv: File;
    },
  ) {
    const formData = new FormData();
    formData.append("name", payload.name);
    formData.append("email", payload.email);
    if (payload.phone) formData.append("phone", payload.phone);
    if (payload.skills) formData.append("skills", payload.skills);
    if (payload.years_experience !== undefined) {
      formData.append("years_experience", String(payload.years_experience));
    }
    formData.append("cv", payload.cv);

    return apiRequest<{ id: number }>(`/api/public/jobs/${jobId}/apply`, {
      method: "POST",
      body: formData,
    });
  },
  getRecruitmentData() {
    return apiRequest<RecruitmentData>("/api/recruitment");
  },
  createJob(payload: {
    title: string;
    department: string;
    location?: string;
    type: "Full-time" | "Part-time" | "Contract" | "Internship" | "Temporary";
    description?: string;
    requirements?: string;
    required_skills?: string;
    min_experience_years?: number;
  }) {
    return apiRequest<{ id: number }>("/api/recruitment/jobs", {
      method: "POST",
      body: payload,
    });
  },
  updateJob(
    jobId: number,
    payload: {
      title: string;
      department: string;
      location?: string;
      type: "Full-time" | "Part-time" | "Contract" | "Internship" | "Temporary";
      description?: string;
      requirements?: string;
      required_skills?: string;
      min_experience_years?: number;
    },
  ) {
    return apiRequest<{ id: number }>(`/api/recruitment/jobs/${jobId}`, {
      method: "PATCH",
      body: payload,
    });
  },
  closeJob(jobId: number) {
    return apiRequest<{ id: number }>(`/api/recruitment/jobs/${jobId}/close`, {
      method: "PATCH",
    });
  },
  deleteJob(jobId: number) {
    return apiRequest<void>(`/api/recruitment/jobs/${jobId}`, {
      method: "DELETE",
    });
  },
  getJobDetails(jobId: number) {
    return apiRequest<RecruitmentJobDetails>(`/api/recruitment/jobs/${jobId}`);
  },
  selectBestCandidate(jobId: number) {
    return apiRequest<RecruitmentJobDetails["ranked_candidates"][number] | null>(
      `/api/recruitment/jobs/${jobId}/ats/select-best`,
      {
        method: "POST",
      },
    );
  },
  scheduleInterview(
    candidateId: number,
    payload: {
      job_posting_id: number;
      interview_at: string;
      channels: Array<"email" | "sms">;
      notify_selected?: boolean;
      custom_message?: string;
    },
  ) {
    return apiRequest<{
      candidate: RecruitmentJobDetails["ranked_candidates"][number];
      communications: Array<{
        id: number;
        channel: string;
        message_type: string;
        delivery_status: string;
        sent_at: string | null;
      }>;
    }>(`/api/recruitment/candidates/${candidateId}/schedule-interview`, {
      method: "POST",
      body: payload,
    });
  },
  uploadManualCandidate(payload: {
    job_posting_id: number;
    name: string;
    email?: string;
    phone?: string;
    stage?: "Applied" | "Screening" | "Interview" | "Offer";
    skills?: string;
    years_experience?: number;
    cv: File;
  }) {
    const formData = new FormData();
    formData.append("job_posting_id", String(payload.job_posting_id));
    formData.append("name", payload.name);
    if (payload.email) formData.append("email", payload.email);
    if (payload.phone) formData.append("phone", payload.phone);
    if (payload.stage) formData.append("stage", payload.stage);
    if (payload.skills) formData.append("skills", payload.skills);
    if (payload.years_experience !== undefined) {
      formData.append("years_experience", String(payload.years_experience));
    }
    formData.append("cv", payload.cv);

    return apiRequest<{ id: number }>("/api/recruitment/candidates/manual", {
      method: "POST",
      body: formData,
    });
  },
  getCandidateCv(candidateId: number) {
    return apiFileRequest(`/api/recruitment/candidates/${candidateId}/cv`);
  },
  deleteCandidate(candidateId: number) {
    return apiRequest<void>(`/api/recruitment/candidates/${candidateId}`, {
      method: "DELETE",
    });
  },
  processCandidateDecision(
    candidateId: number,
    payload: {
      job_posting_id: number;
      decision: "offer" | "not_selected" | "accepted" | "rejected";
      channels?: Array<"email" | "sms">;
      notify_candidate?: boolean;
      custom_message?: string;
      offer_attachment?: File;
    },
  ) {
    if (payload.offer_attachment) {
      const formData = new FormData();
      formData.append("job_posting_id", String(payload.job_posting_id));
      formData.append("decision", payload.decision);

      payload.channels?.forEach((channel) => {
        formData.append("channels[]", channel);
      });

      if (payload.notify_candidate !== undefined) {
        formData.append("notify_candidate", payload.notify_candidate ? "1" : "0");
      }
      if (payload.custom_message) {
        formData.append("custom_message", payload.custom_message);
      }
      formData.append("offer_attachment", payload.offer_attachment);

      return apiRequest<{
        candidate: RecruitmentJobDetails["ranked_candidates"][number];
        communications: Array<{
          id: number;
          channel: string;
          message_type: string;
          delivery_status: string;
          sent_at: string | null;
        }>;
      }>(`/api/recruitment/candidates/${candidateId}/decision`, {
        method: "POST",
        body: formData,
      });
    }

    return apiRequest<{
      candidate: RecruitmentJobDetails["ranked_candidates"][number];
      communications: Array<{
        id: number;
        channel: string;
        message_type: string;
        delivery_status: string;
        sent_at: string | null;
      }>;
    }>(`/api/recruitment/candidates/${candidateId}/decision`, {
      method: "POST",
      body: payload,
    });
  },
};

export const settingsService = {
  getSettings() {
    return apiRequest<SettingsData>("/api/settings");
  },
  updateCompany(payload: {
    company_name: string;
    company_email?: string;
    company_phone?: string;
    company_website?: string;
    company_address?: string;
    company_logo?: File;
    default_language?: "en" | "ar";
  }) {
    if (payload.company_logo) {
      const formData = new FormData();
      formData.append("_method", "PATCH");
      formData.append("company_name", payload.company_name);
      if (payload.company_email) formData.append("company_email", payload.company_email);
      if (payload.company_phone) formData.append("company_phone", payload.company_phone);
      if (payload.company_website) formData.append("company_website", payload.company_website);
      if (payload.company_address) formData.append("company_address", payload.company_address);
      if (payload.default_language) formData.append("default_language", payload.default_language);
      formData.append("company_logo", payload.company_logo);

      return apiRequest<SettingsData["company"]>("/api/settings/company", {
        method: "POST",
        body: formData,
      });
    }

    return apiRequest<SettingsData["company"]>("/api/settings/company", {
      method: "PATCH",
      body: payload,
    });
  },
  updateCommunications(payload: SettingsData["communications"]) {
    return apiRequest<CommunicationSettingsUpdateResult>("/api/settings/communications", {
      method: "PATCH",
      body: payload,
    });
  },
  updateBioTime(payload: Omit<SettingsData["biotime"], "last_sync_at">) {
    return apiRequest<SettingsData["biotime"]>("/api/settings/biotime", {
      method: "PATCH",
      body: payload,
    });
  },
  updateWorkHours(payload: Pick<SettingsData["work_hours"], "start_time" | "end_time" | "full_day_minutes">) {
    return apiRequest<SettingsData["work_hours"]>("/api/settings/work-hours", {
      method: "PATCH",
      body: payload,
    });
  },
  syncBioTime(payload?: { start_time?: string; end_time?: string; full_sync?: boolean }) {
    return apiRequest<BioTimeSyncResult>("/api/settings/biotime/sync", {
      method: "POST",
      body: payload ?? {},
    });
  },
  updateNotifications(payload: SettingsData["notifications"]) {
    return apiRequest<SettingsData["notifications"]>("/api/settings/notifications", {
      method: "PATCH",
      body: payload,
    });
  },
  broadcastNotification(payload: {
    title: string;
    body?: string;
    type?: "info" | "success" | "warning" | "error";
    include_sender?: boolean;
  }) {
    return apiRequest<{ delivered: number }>("/api/settings/notifications/broadcast", {
      method: "POST",
      body: payload,
    });
  },
  createLeaveType(payload: { name: string; days: number; carry_over: boolean }) {
    return apiRequest<SettingsData["leave_types"][number]>("/api/settings/leave-types", {
      method: "POST",
      body: payload,
    });
  },
  updateLeaveType(id: number, payload: { name: string; days: number; carry_over: boolean }) {
    return apiRequest<SettingsData["leave_types"][number]>(`/api/settings/leave-types/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteLeaveType(id: number) {
    return apiRequest<void>(`/api/settings/leave-types/${id}`, {
      method: "DELETE",
    });
  },
  createAllowance(payload: { name: string; amount: number }) {
    return apiRequest<SettingsData["payroll_settings"]["allowances"][number]>("/api/settings/allowances", {
      method: "POST",
      body: payload,
    });
  },
  updateAllowance(id: number, payload: { name: string; amount: number }) {
    return apiRequest<SettingsData["payroll_settings"]["allowances"][number]>(`/api/settings/allowances/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteAllowance(id: number) {
    return apiRequest<void>(`/api/settings/allowances/${id}`, {
      method: "DELETE",
    });
  },
  createDeduction(payload: { name: string; value_type: "amount" | "percentage"; value: number }) {
    return apiRequest<SettingsData["payroll_settings"]["deductions"][number]>("/api/settings/deductions", {
      method: "POST",
      body: payload,
    });
  },
  updateDeduction(id: number, payload: { name: string; value_type: "amount" | "percentage"; value: number }) {
    return apiRequest<SettingsData["payroll_settings"]["deductions"][number]>(`/api/settings/deductions/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteDeduction(id: number) {
    return apiRequest<void>(`/api/settings/deductions/${id}`, {
      method: "DELETE",
    });
  },
  createHoliday(payload: { name: string; date: string }) {
    return apiRequest<SettingsData["holidays"][number]>("/api/settings/holidays", {
      method: "POST",
      body: payload,
    });
  },
  updateHoliday(id: number, payload: { name: string; date: string }) {
    return apiRequest<SettingsData["holidays"][number]>(`/api/settings/holidays/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },
  deleteHoliday(id: number) {
    return apiRequest<void>(`/api/settings/holidays/${id}`, {
      method: "DELETE",
    });
  },
};

export const privilegeService = {
  getMyPrivileges() {
    return apiRequest<{ permissions: UserPermissions; terms: UserPermissionTerms }>("/api/privileges/me");
  },
  getUserPrivileges() {
    return apiRequest<UserPrivilegesData>("/api/privileges/users");
  },
  updateUserPrivileges(
    userId: number,
    permissions: Partial<UserPermissions>,
    terms: Partial<UserPermissionTerms>,
  ) {
    return apiRequest<{ user_id: number; permissions: UserPermissions; terms: UserPermissionTerms }>(
      `/api/privileges/users/${userId}`,
      {
        method: "PATCH",
        body: { permissions, terms },
      },
    );
  },
};

export const notificationService = {
  getNotifications() {
    return apiRequest<NotificationsData>("/api/notifications");
  },
  markAsRead(id: number) {
    return apiRequest<void>(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });
  },
  markAllAsRead() {
    return apiRequest<void>("/api/notifications/read-all", {
      method: "PATCH",
    });
  },
  clearAll() {
    return apiRequest<void>("/api/notifications", {
      method: "DELETE",
    });
  },
};

export const chatbotService = {
  ask(question: string) {
    return apiRequest<ChatbotQueryResponse>("/api/chatbot/query", {
      method: "POST",
      body: { question },
    });
  },
};
