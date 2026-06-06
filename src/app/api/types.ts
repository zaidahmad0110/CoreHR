export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: {
    total?: number;
    filtered?: number;
  };
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  company_name?: string | null;
  company_logo_url?: string | null;
  preferred_language?: "en" | "ar" | null;
  two_factor_enabled?: boolean;
  employee_profile_id?: number | null;
  department?: string | null;
  job_title?: string | null;
  permissions?: UserPermissions;
  can_manage_employees?: boolean;
  employee_management_scope?: "global" | "department" | "self";
  managed_departments?: Array<{
    id: number;
    name: string;
  }>;
}

export interface AuthTwoFactorChallenge {
  two_factor_required: true;
  delivery_channel: "email";
  email_hint: string | null;
  expires_in_seconds: number;
}

export interface UserPermissions {
  dashboard: boolean;
  employees: boolean;
  attendance: boolean;
  leave: boolean;
  payroll: boolean;
  recruitment: boolean;
  performance: boolean;
  training: boolean;
  training_materials: boolean;
  assets: boolean;
  expenses: boolean;
  loans: boolean;
  company_structure: boolean;
  settings: boolean;
}

export type UserPermissionTerm = "accepted" | "rejected";
export type UserPermissionTerms = {
  [K in keyof UserPermissions]: UserPermissionTerm;
};

export interface DashboardKpi {
  value: number | string;
  trend: {
    value: string;
    is_positive: boolean;
  };
}

export interface DashboardData {
  context?: {
    mode: "global" | "department" | "self";
  };
  kpis: {
    total_employees: DashboardKpi;
    attendance_today: DashboardKpi;
    pending_leave_requests: DashboardKpi;
    monthly_payroll: DashboardKpi;
  };
  attendance_overview: Array<{
    month: string;
    present: number;
    absent: number;
  }>;
  employee_growth: Array<{
    month: string;
    employees: number;
  }>;
  pending_leaves: Array<{
    id: number;
    employee: string;
    type: string;
    days: number;
    date: string;
    can_approve?: boolean;
  }>;
  upcoming_holidays: Array<{
    id: number;
    name: string;
    date: string;
  }>;
  quick_stats: {
    present_today: number;
    on_leave_today: number;
  };
}

export interface CalendarEventItem {
  id: string;
  type: "holiday" | "leave" | "interview" | "training";
  title: string;
  description?: string | null;
  date_iso: string | null;
  date: string | null;
  time?: string | null;
  badge?: string | null;
}

export interface CalendarData {
  events: CalendarEventItem[];
  stats: {
    total: number;
    holidays: number;
    leave: number;
    interviews: number;
    training: number;
  };
}

export interface EmployeeListItem {
  id: number;
  name: string;
  email: string;
  job_title: string;
  manager_id?: number | null;
  department: string;
  status: string;
  is_new_hire?: boolean;
  join_date: string;
}

export interface EmployeeProfileData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  job_title: string;
  department: string;
  branch?: string | null;
  manager: string;
  manager_role?: string | null;
  manager_id?: number | null;
  location: string | null;
  join_date: string;
  employee_id: string;
  status: string;
  is_new_hire?: boolean;
  base_salary?: number;
  allowances?: number;
  deductions?: number;
  attendance_history: Array<{
    id?: number;
    date: string;
    check_in: string;
    check_out: string;
    break_in?: string;
    break_out?: string;
    break_duration?: string;
    status: string;
    work_hours?: string;
  }>;
  today_attendance?: {
    id: number;
    date: string;
    check_in: string;
    check_out: string;
    break_in?: string;
    break_out?: string;
    break_duration?: string;
    status: string;
    work_hours: string;
  } | null;
  leave_history: Array<{
    type: string;
    from: string;
    to: string;
    days: number;
    status: string;
  }>;
  documents: Array<{
    id: number;
    name: string;
    type: string;
    upload_date: string | null;
    file_url?: string | null;
  }>;
  assets: Array<{
    id: number;
    name: string;
    serial_number: string;
    assigned_date: string | null;
  }>;
}

export interface EmployeeOnboardingData {
  employee_id: number;
  is_new_hire: boolean;
  tasks: Array<{
    id: number;
    title: string;
    description: string | null;
    is_completed: boolean;
    completed_at: string | null;
    sort_order: number;
  }>;
  summary: {
    total: number;
    completed: number;
  };
}

export interface EmployeePayslipData {
  employee: {
    id: number;
    name: string;
    employee_id: string;
    department: string;
    job_title: string;
  };
  payslip: {
    month: string;
    status: string;
    base_salary: number;
    allowances: number;
    deductions: number;
    net_salary: number;
  };
}

export interface EmployeeDocumentPayload {
  name?: string;
  type?: string;
  upload_date?: string;
  file?: File;
}

export interface EmployeeAssetPayload {
  name: string;
  serial_number: string;
  assigned_date?: string;
}

export interface TodayAttendancePayload {
  check_in?: string;
  check_out?: string;
  status: "Present" | "Early" | "Late" | "Absent" | "Overtime";
}

export interface DepartmentItem {
  id: number;
  name: string;
  employees: number;
  manager: string;
  manager_user_id?: number | null;
}

export interface BranchItem {
  id: number;
  name: string;
  location: string;
  manager: string;
  manager_user_id?: number | null;
  employees: number;
}

export interface OrganizationChartPosition {
  id: number;
  role_key: string;
  role_title: string;
  person_name: string;
  department?: string | null;
}

export interface OrganizationChartData {
  ceo: OrganizationChartPosition | null;
  executives: OrganizationChartPosition[];
}

export interface AttendanceData {
  date: string;
  stats: {
    present: number;
    late: number;
    absent: number;
    overtime: number;
  };
  records: Array<{
    id: number;
    employee: string;
    department: string;
    check_in: string;
    check_out: string;
    break_in: string;
    break_out: string;
    break_duration: string;
    work_hours: string;
    status: string;
  }>;
}

export interface AssetsData {
  stats: {
    total: number;
    assigned: number;
    available: number;
  };
  items: Array<{
    id: number;
    name: string;
    type: string;
    serial_number: string;
    assigned_to?: string | null;
    assigned_employee_id?: number | null;
    assigned_date?: string | null;
    assigned_date_iso?: string | null;
    status: "Assigned" | "Available";
  }>;
}

export interface ExpensesData {
  stats: {
    total_amount: number;
    pending_count: number;
    approved_count: number;
  };
  claims: Array<{
    id: number;
    employee: string;
    category: string;
    amount: number;
    date: string | null;
    date_iso: string | null;
    description: string;
    status: "Pending" | "Approved" | "Rejected";
    rejection_note: string | null;
    receipt_available: boolean;
    can_approve: boolean;
  }>;
}

export interface LoansData {
  stats: {
    total_loans: number;
    active_loans: number;
    pending_loans: number;
  };
  requests: Array<{
    id: number;
    employee: string;
    amount: number;
    purpose: string;
    request_date: string | null;
    request_date_iso: string | null;
    status: "Pending" | "Approved" | "Rejected";
    installments: number;
    paid_installments: number;
    monthly_payment: number;
    can_approve: boolean;
  }>;
}

export interface LeaveManagementData {
  requests: Array<{
    id: number;
    employee: string;
    type: string;
    from: string;
    to: string;
    days: number;
    status: string;
    reason: string;
    can_approve?: boolean;
  }>;
  balance: Array<{
    type: string;
    total: number;
    used: number;
    remaining: number;
  }>;
  leave_types?: Array<{
    id: number;
    name: string;
    days: number;
  }>;
}

export interface PayrollData {
  selected_month: string | null;
  selected_period_id?: number | null;
  available_months: Array<{
    value: string;
    label: string;
  }>;
  summary: {
    total_payroll: number;
    total_allowances: number;
    total_deductions: number;
  };
  trend: Array<{
    month: string;
    amount: number;
  }>;
  workflow?: {
    status_key: "awaiting_hr_submission" | "awaiting_finance_approval" | "approved";
    status_label: string;
    hr_submitted_at?: string | null;
    finance_approved_at?: string | null;
    can_submit_hr: boolean;
    can_approve_finance: boolean;
  } | null;
  employees: Array<{
    id: number;
    employee: string;
    department: string;
    base_salary: number;
    allowances: number;
    deductions: number;
    net_salary: number;
    status: string;
  }>;
}

export interface PerformanceReviewItem {
  id: number;
  employee_id: number;
  employee: string;
  department: string;
  review_type: "Monthly" | "Half Yearly" | "Yearly";
  period_start: string;
  period_end: string;
  period_label: string;
  rating: number;
  goals: number;
  completed: number;
  meets_requirements: boolean;
  requirement_status: string;
  status: string;
  workflow_stage?: "Manager Review" | "Department Review" | "HR Review" | "Finalized";
  can_manager_review?: boolean;
  can_department_review?: boolean;
  can_hr_review?: boolean;
  question_responses?: Array<{
    question: string;
    score: number;
    comment?: string | null;
  }> | null;
  review_summary?: string | null;
}

export interface PerformanceData {
  stats: {
    average_rating: number;
    goals_completed_rate: number;
    top_performers: number;
  };
  predictive_analytics: {
    summary: {
      employees_analyzed: number;
      high_risk: number;
      medium_risk: number;
      low_risk: number;
      average_retention_probability: number;
    };
    employees: Array<{
      employee_id: number;
      employee: string;
      department: string;
      latest_rating: number | null;
      average_rating: number;
      rating_trend: number;
      goals_completion_rate: number;
      forecast_rating: number;
      retention_probability: number;
      risk_score: number;
      risk_level: "Low" | "Medium" | "High";
      recommended_action: string;
    }>;
  };
  creatable_employees: EmployeeListItem[];
  reviews: PerformanceReviewItem[];
}

export interface TrainingProgramItem {
  id: number;
  title: string;
  description?: string | null;
  video_url?: string | null;
  article_url?: string | null;
  article_content?: string | null;
  instructor: string;
  duration: string;
  duration_days: number;
  duration_weeks: number;
  enrolled: number;
  capacity: number;
  status: "Upcoming" | "In Progress" | "Completed";
  start_date?: string | null;
  end_date?: string | null;
  is_enrolled?: boolean;
}

export interface TrainingEnrollmentItem {
  id: number;
  course: string;
  progress: number;
  due_date: string | null;
  status: "In Progress" | "Completed" | "Dropped";
  program_id: number;
}

export interface TrainingData {
  stats: {
    active_programs: number;
    total_enrollments: number;
    completion_rate: number;
  };
  programs: TrainingProgramItem[];
  my_enrollments: TrainingEnrollmentItem[];
}

export interface TrainingMaterialItem {
  id: number;
  training_program_id: number;
  program_title: string;
  title: string;
  material_type: "Document" | "Video" | "Article";
  description?: string | null;
  external_url?: string | null;
  article_content?: string | null;
  has_file: boolean;
  file_name?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string | null;
}

export interface TrainingMaterialsData {
  programs: Array<{
    id: number;
    title: string;
    status: "Upcoming" | "In Progress" | "Completed";
  }>;
  materials: TrainingMaterialItem[];
  stats: {
    total_materials: number;
    documents: number;
    videos: number;
    articles: number;
  };
}

export interface RecruitmentCandidateItem {
  id: number;
  name: string;
  position: string;
  stage: string;
  email?: string | null;
  phone?: string | null;
  skills?: string | null;
  years_experience?: number;
  selected_for_next_step?: boolean;
  interview_at?: string | null;
  interview_at_iso?: string | null;
  job_posting_id?: number | null;
  cv_file_name?: string | null;
  cv_url?: string | null;
  ats_score?: number;
  ats_reason?: string;
}

export interface RecruitmentJobItem {
  id: number;
  title: string;
  department: string;
  location: string | null;
  type: string;
  applicants: number;
  status: string;
  posted: string;
  description?: string | null;
  requirements?: string | null;
  required_skills?: string | null;
  min_experience_years?: number;
}

export interface RecruitmentData {
  stats: {
    active_job_postings: number;
    total_applicants: number;
    interviews_scheduled: number;
  };
  jobs: RecruitmentJobItem[];
  candidates: RecruitmentCandidateItem[];
}

export interface PublicRecruitmentData {
  jobs: RecruitmentJobItem[];
}

export interface RecruitmentJobDetails {
  job: RecruitmentJobItem;
  ranked_candidates: RecruitmentCandidateItem[];
  communications: Array<{
    id: number;
    channel: string;
    message_type: string;
    subject: string | null;
    delivery_status: string;
    sent_at: string | null;
  }>;
}

export interface SettingsData {
  company: {
    name: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    logo_url?: string | null;
    default_language?: "en" | "ar";
  };
  communications: {
    mail_mailer: string | null;
    mail_host: string | null;
    mail_port: number | null;
    mail_username: string | null;
    mail_password: string | null;
    mail_encryption: string | null;
    mail_from_address: string | null;
    mail_from_name: string | null;
    sms_gateway_endpoint: string | null;
    sms_gateway_token: string | null;
    sms_gateway_timeout: number | null;
  };
  leave_types: Array<{
    id: number;
    name: string;
    days: number;
    carry_over: boolean;
  }>;
  payroll_settings: {
    allowances: Array<{
      id: number;
      name: string;
      amount: number;
    }>;
    deductions: Array<{
      id: number;
      name: string;
      amount?: number | null;
      percentage?: number | null;
    }>;
  };
  holidays: Array<{
    id: number;
    name: string;
    date: string | null;
    date_iso: string | null;
  }>;
  notifications: {
    leave_request_notifications: boolean;
    attendance_alerts: boolean;
    expense_approvals: boolean;
    payroll_reminders: boolean;
  };
  biotime: {
    enabled: boolean;
    base_url: string | null;
    username: string | null;
    password: string | null;
    timeout: number | null;
    last_sync_at: string | null;
  };
  work_hours: {
    start_time: string;
    end_time: string;
    full_day_minutes: number;
    full_day_hours: number;
  };
  permissions: {
    can_manage: boolean;
  };
}

export interface BioTimeSyncResult {
  fetched: number;
  imported: number;
  attendance_updated: number;
  absent_marked: number;
  unmatched_emp_codes: string[];
  start_time: string;
  end_time: string;
  synced_at: string;
}

export interface CommunicationSettingsUpdateResult extends SettingsData["communications"] {
  test_email?: {
    status: "sent" | "failed" | "skipped" | "simulated";
    recipient: string | null;
    error: string | null;
  };
}

export interface UserPrivilegesData {
  permissions_catalog: string[];
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    permissions: UserPermissions;
    terms: UserPermissionTerms;
  }>;
}

export interface NotificationsData {
  unread_count: number;
  items: Array<{
    id: number;
    title: string;
    body: string | null;
    type: string;
    is_read: boolean;
    created_at: string;
  }>;
}

export interface ChatbotQueryResponse {
  answer: string;
  confidence: number;
  suggested_actions: string[];
  source: "openai" | "fallback";
  asked_at: string;
}
