import { Navigate } from "react-router";
import { useAuth } from "./AuthContext";
import type { UserPermissions } from "../api/types";

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-gray-600">Loading...</div>
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function RequireGuest({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const getFallbackRoute = (permissions?: Partial<UserPermissions>) => {
  if (!permissions) {
    return null;
  }

  if (permissions.dashboard) return "/dashboard";
  if (permissions.employees) return "/employees";
  if (permissions.attendance) return "/attendance";
  if (permissions.leave) return "/leave";
  if (permissions.training) return "/training";
  if (permissions.expenses) return "/expenses";
  if (permissions.loans) return "/loans";

  return null;
};

const isAdminRole = (role?: string | null) => (role ?? "").trim().toLowerCase() === "admin";

export function RequirePermission({
  permission,
  children,
}: {
  permission: keyof UserPermissions;
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasPermission = isAdminRole(user?.role) || Boolean(user?.permissions?.[permission]);
  if (!hasPermission) {
    const fallbackRoute = isAdminRole(user?.role) ? "/dashboard" : getFallbackRoute(user?.permissions);
    if (fallbackRoute) {
      return <Navigate to={fallbackRoute} replace />;
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-gray-600">You do not have access to any modules.</div>
      </div>
    );
  }

  return <>{children}</>;
}
