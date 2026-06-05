import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard, Users, Clock, Calendar, DollarSign, Briefcase,
  TrendingUp, GraduationCap, BookOpen, Monitor, Receipt, CreditCard,
  Building2, Settings as SettingsIcon, ShieldCheck, Bell, Search, ChevronDown, LogOut, Bot, Menu
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { useAuth } from "../auth/AuthContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { notificationService } from "../api/services";
import type { UserPermissions } from "../api/types";
import { useI18n } from "../i18n/I18nContext";

const navigation = [
  { key: "layout.nav.dashboard", path: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { key: "layout.nav.assistant", path: "/assistant", icon: Bot, permission: "dashboard" },
  { key: "layout.nav.employees", path: "/employees", icon: Users, permission: "employees" },
  { key: "layout.nav.attendance", path: "/attendance", icon: Clock, permission: "attendance" },
  { key: "layout.nav.leave", path: "/leave", icon: Calendar, permission: "leave" },
  { key: "layout.nav.payroll", path: "/payroll", icon: DollarSign, permission: "payroll" },
  { key: "layout.nav.recruitment", path: "/recruitment", icon: Briefcase, permission: "recruitment" },
  { key: "layout.nav.performance", path: "/performance", icon: TrendingUp, permission: "performance" },
  { key: "layout.nav.training", path: "/training", icon: GraduationCap, permission: "training" },
  { key: "layout.nav.training_materials", path: "/training-materials", icon: BookOpen, permission: "training_materials" },
  { key: "layout.nav.assets", path: "/assets", icon: Monitor, permission: "assets" },
  { key: "layout.nav.expenses", path: "/expenses", icon: Receipt, permission: "expenses" },
  { key: "layout.nav.loans", path: "/loans", icon: CreditCard, permission: "loans" },
  { key: "layout.nav.company_structure", path: "/company-structure", icon: Building2, permission: "company_structure" },
  { key: "layout.nav.settings", path: "/settings", icon: SettingsIcon, permission: "settings" },
  { key: "layout.nav.user_privileges", path: "/user-privileges", icon: ShieldCheck, permission: "settings" },
];

const isAdminRole = (role?: string | null) => (role ?? "").trim().toLowerCase() === "admin";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, isRtl } = useI18n();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: notifications, refetch: refetchNotifications } = useApiQuery(
    () => notificationService.getNotifications(),
    [],
    { skip: !user },
  );
  const permissions = user?.permissions as UserPermissions | undefined;
  const shownBrowserNotificationsRef = useRef<Set<number>>(new Set());

  const visibleNavigation = navigation.filter((item) => {
    if (item.path === "/user-privileges" && !isAdminRole(user?.role)) {
      return false;
    }

    return isAdminRole(user?.role) || Boolean(permissions?.[item.permission]);
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleOpenProfile = () => {
    if (user?.employee_profile_id) {
      navigate(`/employees/${user.employee_profile_id}`);
      return;
    }

    if (isAdminRole(user?.role) || permissions?.employees) {
      navigate("/employees");
      return;
    }

    navigate("/dashboard");
  };

  const handleOpenSettings = () => {
    if (isAdminRole(user?.role) || permissions?.settings) {
      navigate("/settings");
      return;
    }

    handleOpenProfile();
  };

  const handleNotificationRead = async (id: number) => {
    await notificationService.markAsRead(id);
    await refetchNotifications();
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!notifications || notifications.unread_count === 0) {
      return;
    }

    await notificationService.markAllAsRead();
    await refetchNotifications();
  };

  const handleClearNotifications = async () => {
    if (!notifications || notifications.items.length === 0) {
      return;
    }

    await notificationService.clearAll();
    await refetchNotifications();
  };

  const unreadCount = notifications?.unread_count ?? 0;
  const totalNotifications = notifications?.items.length ?? 0;
  const displayedNotifications = notifications?.items.slice(0, 5) ?? [];
  const companyName = user?.company_name?.trim() || "HRManager";
  const companyLogoUrl = user?.company_logo_url?.trim() || "";
  const companyInitials = companyName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "HR";
  const initials = user?.name
    ? user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "HR";

  const renderBrand = (compact = false) => (
    <div className="flex items-center gap-2 min-w-0">
      {companyLogoUrl ? (
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 bg-white flex items-center justify-center shrink-0">
          <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-semibold">{companyInitials}</span>
        </div>
      )}
      <span className={`font-semibold text-gray-900 truncate ${compact ? "max-w-[11rem]" : ""}`}>
        {companyName}
      </span>
    </div>
  );

  const renderNavigation = (onNavigate?: () => void) => (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {visibleNavigation.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
              isActive
                ? "bg-[#2563EB] text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="font-medium truncate">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );

  useEffect(() => {
    document.title = companyName;
  }, [companyName]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !notifications || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    notifications.items
      .filter((item) => !item.is_read)
      .forEach((item) => {
        if (shownBrowserNotificationsRef.current.has(item.id)) {
          return;
        }

        shownBrowserNotificationsRef.current.add(item.id);
        new Notification(item.title, {
          body: item.body ?? "",
          tag: `corehr-notification-${item.id}`,
        });
      });
  }, [notifications]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshNotifications = () => {
      if (!user) {
        return;
      }

      void refetchNotifications();
    };

    const intervalId = window.setInterval(refreshNotifications, 30000);
    window.addEventListener("corehr:notifications:refresh", refreshNotifications);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("corehr:notifications:refresh", refreshNotifications);
    };
  }, [refetchNotifications, user]);

  return (
    <div className={`flex min-h-screen bg-[#F8FAFC] ${isRtl ? "lg:flex-row-reverse" : ""}`}>
      {/* Sidebar */}
      <aside className={`hidden lg:flex lg:w-64 bg-white ${isRtl ? "border-l" : "border-r"} border-gray-200 flex-col`}>
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          {renderBrand()}
        </div>
        {renderNavigation()}
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side={isRtl ? "right" : "left"} className="w-[85vw] max-w-sm p-0">
          <SheetHeader className="border-b border-gray-200">
            <SheetTitle>{companyName}</SheetTitle>
            <SheetDescription>Navigate through CoreHR</SheetDescription>
          </SheetHeader>
          <div className="flex h-full min-h-0 flex-col">
            <div className="px-4 pt-2">{renderBrand(true)}</div>
            {renderNavigation(() => setMobileNavOpen(false))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:h-16 lg:flex-nowrap lg:py-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="lg:hidden">{renderBrand(true)}</div>
          </div>

          {/* Search */}
          <div className="order-3 w-full sm:order-2 sm:flex-1 sm:max-w-xl lg:order-none lg:w-auto">
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRtl ? "right-3" : "left-3"}`} />
              <Input
                type="search"
                placeholder={t("layout.search.placeholder")}
                className={isRtl ? "pr-10 bg-gray-50 border-gray-200" : "pl-10 bg-gray-50 border-gray-200"}
              />
            </div>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-80">
                {displayedNotifications.length === 0 ? (
                  <DropdownMenuItem disabled>{t("layout.notifications.empty")}</DropdownMenuItem>
                ) : (
                  displayedNotifications.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => void handleNotificationRead(item.id)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-gray-600">{item.body}</div>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={unreadCount === 0}
                  onClick={() => void handleMarkAllNotificationsRead()}
                >
                  {t("layout.notifications.mark_all_read")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={totalNotifications === 0}
                  onClick={() => void handleClearNotifications()}
                >
                  {t("layout.notifications.clear_all")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 sm:px-3">
                  <div className="w-8 h-8 bg-[#2563EB] rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{initials}</span>
                  </div>
                  <div className="hidden text-left sm:block">
                    <div className="text-sm font-medium">{user?.name ?? "User"}</div>
                    <div className="text-xs text-gray-500">{user?.role ?? "Employee"}</div>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleOpenProfile}>{t("layout.menu.profile")}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenSettings}>{t("layout.menu.settings")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  {t("layout.menu.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
