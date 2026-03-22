import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Careers } from "./pages/Careers";
import { Dashboard } from "./pages/Dashboard";
import { HRAssistant } from "./pages/HRAssistant";
import { EmployeeList } from "./pages/EmployeeList";
import { EmployeeProfile } from "./pages/EmployeeProfile";
import { Attendance } from "./pages/Attendance";
import { LeaveManagement } from "./pages/LeaveManagement";
import { Payroll } from "./pages/Payroll";
import { Recruitment } from "./pages/Recruitment";
import { Performance } from "./pages/Performance";
import { Training } from "./pages/Training";
import { TrainingMaterials } from "./pages/TrainingMaterials";
import { Assets } from "./pages/Assets";
import { Expenses } from "./pages/Expenses";
import { Loans } from "./pages/Loans";
import { CompanyStructure } from "./pages/CompanyStructure";
import { Settings } from "./pages/Settings";
import { UserPrivileges } from "./pages/UserPrivileges";
import { RequireAuth, RequireGuest, RequirePermission } from "./auth/RouteGuards";

function ProtectedLayout() {
  return (
    <RequireAuth>
      <Layout />
    </RequireAuth>
  );
}

function GuestLogin() {
  return (
    <RequireGuest>
      <Login />
    </RequireGuest>
  );
}

function DashboardPage() {
  return (
    <RequirePermission permission="dashboard">
      <Dashboard />
    </RequirePermission>
  );
}

function AssistantPage() {
  return (
    <RequirePermission permission="dashboard">
      <HRAssistant />
    </RequirePermission>
  );
}

function EmployeesPage() {
  return (
    <RequirePermission permission="employees">
      <EmployeeList />
    </RequirePermission>
  );
}

function EmployeeProfilePage() {
  return (
    <RequirePermission permission="employees">
      <EmployeeProfile />
    </RequirePermission>
  );
}

function AttendancePage() {
  return (
    <RequirePermission permission="attendance">
      <Attendance />
    </RequirePermission>
  );
}

function LeavePage() {
  return (
    <RequirePermission permission="leave">
      <LeaveManagement />
    </RequirePermission>
  );
}

function PayrollPage() {
  return (
    <RequirePermission permission="payroll">
      <Payroll />
    </RequirePermission>
  );
}

function RecruitmentPage() {
  return (
    <RequirePermission permission="recruitment">
      <Recruitment />
    </RequirePermission>
  );
}

function PerformancePage() {
  return (
    <RequirePermission permission="performance">
      <Performance />
    </RequirePermission>
  );
}

function TrainingPage() {
  return (
    <RequirePermission permission="training">
      <Training />
    </RequirePermission>
  );
}

function TrainingMaterialsPage() {
  return (
    <RequirePermission permission="training_materials">
      <TrainingMaterials />
    </RequirePermission>
  );
}

function AssetsPage() {
  return (
    <RequirePermission permission="assets">
      <Assets />
    </RequirePermission>
  );
}

function ExpensesPage() {
  return (
    <RequirePermission permission="expenses">
      <Expenses />
    </RequirePermission>
  );
}

function LoansPage() {
  return (
    <RequirePermission permission="loans">
      <Loans />
    </RequirePermission>
  );
}

function CompanyStructurePage() {
  return (
    <RequirePermission permission="company_structure">
      <CompanyStructure />
    </RequirePermission>
  );
}

function SettingsPage() {
  return (
    <RequirePermission permission="settings">
      <Settings />
    </RequirePermission>
  );
}

function UserPrivilegesPage() {
  return (
    <RequirePermission permission="settings">
      <UserPrivileges />
    </RequirePermission>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Careers,
  },
  {
    path: "/login",
    Component: GuestLogin,
  },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { path: "dashboard", Component: DashboardPage },
      { path: "assistant", Component: AssistantPage },
      { path: "employees", Component: EmployeesPage },
      { path: "employees/:id", Component: EmployeeProfilePage },
      { path: "attendance", Component: AttendancePage },
      { path: "leave", Component: LeavePage },
      { path: "payroll", Component: PayrollPage },
      { path: "recruitment", Component: RecruitmentPage },
      { path: "performance", Component: PerformancePage },
      { path: "training", Component: TrainingPage },
      { path: "training-materials", Component: TrainingMaterialsPage },
      { path: "assets", Component: AssetsPage },
      { path: "expenses", Component: ExpensesPage },
      { path: "loans", Component: LoansPage },
      { path: "company-structure", Component: CompanyStructurePage },
      { path: "settings", Component: SettingsPage },
      { path: "user-privileges", Component: UserPrivilegesPage },
    ],
  },
]);
