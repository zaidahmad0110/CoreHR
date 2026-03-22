import { useState } from "react";
import { Users, UserCheck, Calendar, DollarSign } from "lucide-react";
import { KPICard } from "../components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { dashboardService, leaveService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";

const formatCurrency = (value: number) => `$${Math.round(value).toLocaleString()}`;

export function Dashboard() {
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const { data, loading, error, refetch } = useApiQuery(() => dashboardService.getDashboard(), []);

  const handleLeaveAction = async (leaveId: number, status: "Approved" | "Rejected") => {
    setActionLoadingId(leaveId);

    try {
      await leaveService.updateLeaveStatus(leaveId, status);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update leave status.";
      window.alert(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading && !data) {
    return <div className="text-gray-600">Loading dashboard...</div>;
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

  const dashboard = data;
  const dashboardMode = dashboard.context?.mode ?? "global";
  const isSelfMode = dashboardMode === "self";
  const isDepartmentMode = dashboardMode === "department";

  const attendanceTitle = isSelfMode
    ? "My Attendance Overview"
    : isDepartmentMode
      ? "Team Attendance Overview"
      : "Attendance Overview";
  const growthTitle = isSelfMode
    ? "My Performance Trend"
    : isDepartmentMode
      ? "Team Performance Trend"
      : "Employee Growth";
  const growthSeriesLabel = isSelfMode || isDepartmentMode ? "Performance" : "Employees";
  const pendingLeavesTitle = isSelfMode
    ? "My Pending Leave Requests"
    : isDepartmentMode
      ? "Team Pending Leave Requests"
      : "Pending Leave Requests";

  if (!dashboard) {
    return <div className="text-gray-600">No dashboard data available.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, here's what's happening today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Employees"
          value={dashboard.kpis.total_employees.value}
          icon={Users}
          trend={{
            value: dashboard.kpis.total_employees.trend.value,
            isPositive: dashboard.kpis.total_employees.trend.is_positive,
          }}
          color="#2563EB"
        />
        <KPICard
          title="Today's Attendance"
          value={dashboard.kpis.attendance_today.value}
          icon={UserCheck}
          trend={{
            value: dashboard.kpis.attendance_today.trend.value,
            isPositive: dashboard.kpis.attendance_today.trend.is_positive,
          }}
          color="#10B981"
        />
        <KPICard
          title="Pending Leave Requests"
          value={dashboard.kpis.pending_leave_requests.value}
          icon={Calendar}
          trend={{
            value: dashboard.kpis.pending_leave_requests.trend.value,
            isPositive: dashboard.kpis.pending_leave_requests.trend.is_positive,
          }}
          color="#F59E0B"
        />
        <KPICard
          title="Monthly Payroll"
          value={formatCurrency(Number(dashboard.kpis.monthly_payroll.value))}
          icon={DollarSign}
          trend={{
            value: dashboard.kpis.monthly_payroll.trend.value,
            isPositive: dashboard.kpis.monthly_payroll.trend.is_positive,
          }}
          color="#8B5CF6"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{attendanceTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboard.attendance_overview}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Bar key="present" dataKey="present" fill="#10B981" name="Present" radius={[4, 4, 0, 0]} />
                <Bar key="absent" dataKey="absent" fill="#EF4444" name="Absent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{growthTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboard.employee_growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Line
                  key="employees"
                  type="monotone"
                  dataKey="employees"
                  stroke="#2563EB"
                  strokeWidth={3}
                  dot={{ fill: "#2563EB", r: 5 }}
                  name={growthSeriesLabel}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{pendingLeavesTitle}</CardTitle>
            <Badge variant="secondary">{dashboard.pending_leaves.length} pending</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.pending_leaves.length === 0 && (
                <div className="text-sm text-gray-500">No pending leave requests.</div>
              )}

              {dashboard.pending_leaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{leave.employee}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {leave.type} • {leave.days} {leave.days === 1 ? "day" : "days"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{leave.date}</div>
                  </div>
                  {leave.can_approve ? (
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 text-sm bg-[#10B981] text-white rounded-md hover:bg-[#059669] disabled:opacity-50"
                        onClick={() => void handleLeaveAction(leave.id, "Approved")}
                        disabled={actionLoadingId === leave.id}
                      >
                        Approve
                      </button>
                      <button
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                        onClick={() => void handleLeaveAction(leave.id, "Rejected")}
                        disabled={actionLoadingId === leave.id}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      View only
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.upcoming_holidays.length === 0 && (
                <div className="text-sm text-gray-500">No upcoming holidays.</div>
              )}

              {dashboard.upcoming_holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-[#2563EB]" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{holiday.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{holiday.date}</div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{dashboard.quick_stats.present_today}</div>
                  <div className="text-sm text-gray-600 mt-1">Present Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{dashboard.quick_stats.on_leave_today}</div>
                  <div className="text-sm text-gray-600 mt-1">On Leave</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

