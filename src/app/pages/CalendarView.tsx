import { useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { calendarService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const statusClassByType: Record<string, string> = {
  holiday: "bg-indigo-100 text-indigo-700",
  leave: "bg-amber-100 text-amber-700",
  interview: "bg-blue-100 text-blue-700",
  training: "bg-emerald-100 text-emerald-700",
};

export function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data, loading, error, refetch } = useApiQuery(() => calendarService.getEvents(), []);

  const selectedDateIso = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);
  const events = data?.events ?? [];
  const selectedDateEvents = useMemo(
    () => events.filter((event) => event.date_iso === selectedDateIso),
    [events, selectedDateIso],
  );

  const stats = data?.stats ?? {
    total: 0,
    holidays: 0,
    leave: 0,
    interviews: 0,
    training: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
          <p className="text-gray-600 mt-1">Interviews, leave, holidays, and training events</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} />
          </PopoverContent>
        </Popover>
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="text-xs text-gray-600">Total</div><div className="text-xl font-semibold text-gray-900">{stats.total}</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="text-xs text-gray-600">Holidays</div><div className="text-xl font-semibold text-gray-900">{stats.holidays}</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="text-xs text-gray-600">Leave</div><div className="text-xl font-semibold text-gray-900">{stats.leave}</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="text-xs text-gray-600">Interviews</div><div className="text-xl font-semibold text-gray-900">{stats.interviews}</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4"><div className="text-xs text-gray-600">Training</div><div className="text-xl font-semibold text-gray-900">{stats.training}</div></CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Events on {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-gray-500">Loading events...</div>}
          {!loading && selectedDateEvents.length === 0 && (
            <div className="text-sm text-gray-500">No events on this date.</div>
          )}
          {!loading && selectedDateEvents.length > 0 && (
            <div className="space-y-3">
              {selectedDateEvents.map((event) => (
                <div key={event.id} className="flex items-start justify-between p-4 rounded-lg bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900">{event.title}</div>
                    {event.description && <div className="text-sm text-gray-600 mt-1">{event.description}</div>}
                    {event.time && <div className="text-xs text-gray-500 mt-1">{event.time}</div>}
                  </div>
                  <Badge
                    variant="secondary"
                    className={statusClassByType[event.type] ?? "bg-gray-100 text-gray-700"}
                  >
                    {event.badge ?? event.type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

