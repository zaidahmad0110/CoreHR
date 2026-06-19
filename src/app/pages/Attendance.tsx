import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Download, Clock, UserCheck } from "lucide-react";
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
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { format } from "date-fns";
import { attendanceService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";

export function Attendance() {
  const [date, setDate] = useState<Date>(new Date());

  const queryDate = useMemo(() => format(date, "yyyy-MM-dd"), [date]);
  const { data, loading, error, refetch } = useApiQuery(
    () => attendanceService.getAttendance(queryDate),
    [queryDate],
  );

  const stats = data?.stats ?? {
    present: 0,
    late: 0,
    absent: 0,
    overtime: 0,
  };
  const attendanceRecords = data?.records ?? [];

  const escapeCsvValue = (value: string | number) => {
    const text = String(value).replace(/"/g, '""');
    return `"${text}"`;
  };

  const handleExportReport = () => {
    if (attendanceRecords.length === 0) {
      return;
    }

    const header = [
      "Date",
      "Employee",
      "Department",
      "Check In",
      "Check Out",
      "Work Hours",
      "Status",
    ];
    const rows = attendanceRecords.map((record) => [
      format(date, "yyyy-MM-dd"),
      record.employee,
      record.department,
      record.check_in,
      record.check_out,
      record.work_hours,
      record.status,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `attendance-${format(date, "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Present":
      case "Early":
        return "bg-green-100 text-green-700";
      case "Late":
        return "bg-yellow-100 text-yellow-700";
      case "Absent":
        return "bg-red-100 text-red-700";
      case "Overtime":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
          <p className="text-gray-600 mt-1">Track employee attendance and working hours</p>
        </div>
        <div className="flex gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
            </PopoverContent>
          </Popover>
          <Button
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
            onClick={handleExportReport}
            disabled={attendanceRecords.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Present</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.present}</h3>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Late Arrivals</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.late}</h3>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Absent</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.absent}</h3>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Overtime</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.overtime}</h3>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Today's Attendance - {format(date, "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Work Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Loading attendance...
                  </TableCell>
                </TableRow>
              )}
              {!loading && attendanceRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No attendance records for this date.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                attendanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {record.employee.split(" ").map((n) => n[0]).join("")}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900">{record.employee}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{record.department}</TableCell>
                    <TableCell className="text-gray-700">{record.check_in}</TableCell>
                    <TableCell className="text-gray-700">{record.check_out}</TableCell>
                    <TableCell className="font-medium text-gray-900">{record.work_hours}</TableCell>
                    <TableCell>
                      {record.status ? (
                        <Badge className={getStatusColor(record.status)} variant="secondary">
                          {record.status}
                        </Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
