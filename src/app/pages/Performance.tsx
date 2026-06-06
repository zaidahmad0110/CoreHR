import { useMemo, useState } from "react";
import { TrendingUp, Target, Award, Plus, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { performanceService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";

type ReviewType = "Monthly" | "Half Yearly" | "Yearly";

type QuestionState = Record<string, { score: string; comment: string }>;

const REVIEW_QUESTIONS: Record<ReviewType, Array<{ id: string; text: string }>> = {
  Monthly: [
    { id: "attendance_punctuality", text: "Employee maintained attendance and punctuality this month." },
    { id: "task_delivery", text: "Employee delivered assigned tasks on time with expected quality." },
    { id: "team_collaboration", text: "Employee collaborated effectively with team members." },
    { id: "communication", text: "Employee communicated progress, blockers, and updates clearly." },
    { id: "adaptability", text: "Employee adapted well to changes and feedback." },
  ],
  "Half Yearly": [
    { id: "goal_achievement", text: "Employee achieved planned goals for the half-year period." },
    { id: "technical_growth", text: "Employee demonstrated measurable skill growth." },
    { id: "ownership", text: "Employee took ownership and accountability for outcomes." },
    { id: "cross_functional", text: "Employee collaborated effectively across departments." },
    { id: "problem_solving", text: "Employee solved problems proactively and efficiently." },
  ],
  Yearly: [
    { id: "annual_goal_achievement", text: "Employee met key annual performance objectives." },
    { id: "leadership_impact", text: "Employee showed leadership and positive impact on others." },
    { id: "innovation", text: "Employee contributed new ideas/process improvements." },
    { id: "business_contribution", text: "Employee contributed to department/business outcomes." },
    { id: "overall_professionalism", text: "Employee maintained strong professionalism and compliance." },
  ],
};

const buildQuestionState = (reviewType: ReviewType): QuestionState =>
  REVIEW_QUESTIONS[reviewType].reduce<QuestionState>((acc, question) => {
    acc[question.id] = { score: "", comment: "" };
    return acc;
  }, {});

export function Performance() {
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [reviewTypeFilter, setReviewTypeFilter] = useState<"all" | ReviewType>("all");
  const [createForm, setCreateForm] = useState({
    employeeId: "",
    reviewType: "Monthly" as ReviewType,
    periodStart: "",
    periodEnd: "",
    reviewSummary: "",
  });
  const [questionState, setQuestionState] = useState<QuestionState>(buildQuestionState("Monthly"));
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState({
    reviewId: 0,
    action: "submit_manager_review" as "submit_manager_review" | "submit_department_review" | "submit_hr_review",
    employee: "",
    stage: "",
    rating: "",
    summary: "",
  });

  const {
    data,
    loading,
    error,
    refetch,
  } = useApiQuery(
    () => performanceService.getPerformance(reviewTypeFilter === "all" ? undefined : reviewTypeFilter),
    [reviewTypeFilter],
  );

  const reviews = data?.reviews ?? [];
  const stats = data?.stats ?? {
    average_rating: 0,
    goals_completed_rate: 0,
    top_performers: 0,
  };
  const predictive = data?.predictive_analytics ?? {
    summary: {
      employees_analyzed: 0,
      high_risk: 0,
      medium_risk: 0,
      low_risk: 0,
      average_retention_probability: 0,
    },
    employees: [],
  };

  const creatableEmployeeOptions = data?.creatable_employees ?? [];
  const canCreateReview = useMemo(() => {
    if (!user) {
      return false;
    }

    const jobTitle = (user.job_title ?? "").toLowerCase().trim();

    return jobTitle === "supervisor" || jobTitle === "manager" || jobTitle === "department manager";
  }, [user]);

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "bg-green-100 text-green-700";
    if (rating >= 3.5) return "bg-blue-100 text-blue-700";
    if (rating >= 2.5) return "bg-emerald-100 text-emerald-700";
    if (rating >= 1.5) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const getRequirementColor = (meetsRequirements: boolean) =>
    meetsRequirements ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";

  const getRiskBadgeClass = (risk: "Low" | "Medium" | "High") => {
    if (risk === "High") return "bg-red-100 text-red-700";
    if (risk === "Medium") return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  const getWorkflowClassName = (stage?: string) => {
    if (stage === "Finalized") return "bg-green-100 text-green-700";
    if (stage === "HR Review") return "bg-blue-100 text-blue-700";
    if (stage === "Department Review") return "bg-indigo-100 text-indigo-700";
    if (stage === "Manager Review") return "bg-amber-100 text-amber-700";
    return "bg-yellow-100 text-yellow-700";
  };

  const handleExportCsv = () => {
    if (reviews.length === 0) {
      return;
    }

    const headers = [
      "Employee",
      "Department",
      "Review Type",
      "Period Start",
      "Period End",
      "Rating",
      "Goals Total",
      "Goals Completed",
      "Meets Requirements",
      "Status",
    ];

    const rows = reviews.map((review) => [
      review.employee,
      review.department,
      review.review_type,
      review.period_start,
      review.period_end,
      review.rating,
      review.goals,
      review.completed,
      review.meets_requirements ? "Yes" : "No",
      review.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "performance-reviews.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetCreateForm = () => {
    setCreateForm({
      employeeId: "",
      reviewType: "Monthly",
      periodStart: "",
      periodEnd: "",
      reviewSummary: "",
    });
    setQuestionState(buildQuestionState("Monthly"));
    setCreateError(null);
  };

  const handleCreateReview = async () => {
    if (!createForm.employeeId || !createForm.periodStart || !createForm.periodEnd) {
      setCreateError("Employee, period start, and period end are required.");
      return;
    }

    const questionPayload = REVIEW_QUESTIONS[createForm.reviewType].map((question) => {
      const response = questionState[question.id];
      return {
        question: question.text,
        score: Number(response?.score ?? 0),
        comment: response?.comment?.trim() || undefined,
      };
    });

    if (questionPayload.some((item) => !Number.isFinite(item.score) || item.score < 1 || item.score > 5)) {
      setCreateError("Please answer all questions with a score between 1 and 5.");
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      await performanceService.createReview({
        employee_id: Number(createForm.employeeId),
        review_type: createForm.reviewType,
        period_start: createForm.periodStart,
        period_end: createForm.periodEnd,
        question_responses: questionPayload,
        review_summary: createForm.reviewSummary || undefined,
      });

      setCreateDialogOpen(false);
      resetCreateForm();
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError("Failed to create performance review.");
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleCreateReviewTypeChange = (value: string) => {
    const reviewType = value as ReviewType;
    setCreateForm((prev) => ({ ...prev, reviewType }));
    setQuestionState(buildQuestionState(reviewType));
  };

  const openWorkflowDialog = (
    review: (typeof reviews)[number],
    action: "submit_manager_review" | "submit_department_review" | "submit_hr_review",
  ) => {
    setWorkflowError(null);
    setWorkflowForm({
      reviewId: review.id,
      action,
      employee: review.employee,
      stage: review.workflow_stage ?? "Department Review",
      rating: review.rating.toFixed(2),
      summary: review.review_summary ?? "",
    });
    setWorkflowDialogOpen(true);
  };

  const handleSubmitWorkflow = async () => {
    if (!workflowForm.reviewId) {
      return;
    }

    const ratingValue = Number(workflowForm.rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 0.01 || ratingValue > 5) {
      setWorkflowError("Rating must be between 0.01 and 5.");
      return;
    }

    setWorkflowSubmitting(true);
    setWorkflowError(null);

    try {
      await performanceService.updateReviewWorkflow(workflowForm.reviewId, {
        action: workflowForm.action,
        rating: Number(ratingValue.toFixed(2)),
        review_summary: workflowForm.summary.trim() || undefined,
      });

      setWorkflowDialogOpen(false);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setWorkflowError(err.message);
      } else {
        setWorkflowError("Failed to update performance workflow.");
      }
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Performance Reviews</h1>
          <p className="text-gray-600 mt-1">Track employee performance and goals</p>
        </div>
        <Button
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
          onClick={() => {
            resetCreateForm();
            setCreateDialogOpen(true);
          }}
          disabled={!canCreateReview}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Review
        </Button>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExportCsv} disabled={reviews.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Rating</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.average_rating.toFixed(1)}/5.0</h3>
              </div>
              <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Goals Completed</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.goals_completed_rate}%</h3>
              </div>
              <div className="w-12 h-12 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Top Performers</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.top_performers}</h3>
              </div>
              <div className="w-12 h-12 bg-[#F59E0B] bg-opacity-10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#F59E0B]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Employee Performance</CardTitle>
            <Select value={reviewTypeFilter} onValueChange={(value) => setReviewTypeFilter(value as typeof reviewTypeFilter)}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Review Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Half Yearly">Half Yearly</SelectItem>
                <SelectItem value="Yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Performance Rating</TableHead>
                <TableHead>Goals Progress</TableHead>
                <TableHead>Performance Result</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    Loading performance reviews...
                  </TableCell>
                </TableRow>
              )}

              {!loading && reviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No performance reviews found.
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {review.employee.split(" ").map((n) => n[0]).join("")}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900">{review.employee}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{review.department}</TableCell>
                    <TableCell className="text-gray-700">{review.review_type}</TableCell>
                    <TableCell className="text-gray-700">{review.period_label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{review.rating.toFixed(1)}</span>
                        <span className="text-gray-500">/5.0</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {review.completed}/{review.goals} goals
                          </span>
                          <span className="font-medium text-gray-900">
                            {review.goals > 0 ? Math.round((review.completed / review.goals) * 100) : 0}%
                          </span>
                        </div>
                        <Progress value={review.goals > 0 ? (review.completed / review.goals) * 100 : 0} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRatingColor(review.rating)} variant="secondary">
                        {review.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getWorkflowClassName(review.workflow_stage)} variant="secondary">
                        {review.workflow_stage ?? "Department Review"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {review.can_manager_review && (
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => openWorkflowDialog(review, "submit_manager_review")}
                          >
                            Manager Submit
                          </Button>
                        )}
                        {review.can_department_review && (
                          <Button
                            size="sm"
                            className="bg-[#10B981] hover:bg-[#059669] text-white"
                            onClick={() => openWorkflowDialog(review, "submit_department_review")}
                          >
                            Department Submit
                          </Button>
                        )}
                        {review.can_hr_review && (
                          <Button
                            size="sm"
                            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                            onClick={() => openWorkflowDialog(review, "submit_hr_review")}
                          >
                            HR Finalize
                          </Button>
                        )}
                        {!review.can_manager_review && !review.can_department_review && !review.can_hr_review && (
                          <span className="text-xs text-gray-500">No action</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Predictive Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <div className="text-xs text-gray-500">Employees Analyzed</div>
              <div className="text-xl font-semibold text-gray-900 mt-1">
                {predictive.summary.employees_analyzed}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-red-50">
              <div className="text-xs text-red-700">High Risk</div>
              <div className="text-xl font-semibold text-red-700 mt-1">
                {predictive.summary.high_risk}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-yellow-50">
              <div className="text-xs text-yellow-700">Medium Risk</div>
              <div className="text-xl font-semibold text-yellow-700 mt-1">
                {predictive.summary.medium_risk}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 bg-green-50">
              <div className="text-xs text-green-700">Avg. Retention</div>
              <div className="text-xl font-semibold text-green-700 mt-1">
                {predictive.summary.average_retention_probability.toFixed(1)}%
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Forecast Rating</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Recommended Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictive.employees.slice(0, 10).map((item) => (
                <TableRow key={item.employee_id}>
                  <TableCell className="font-medium text-gray-900">{item.employee}</TableCell>
                  <TableCell className="text-gray-700">{item.department}</TableCell>
                  <TableCell className="text-gray-700">{item.forecast_rating.toFixed(2)} / 5</TableCell>
                  <TableCell className="text-gray-700">{item.retention_probability}%</TableCell>
                  <TableCell>
                    <Badge className={getRiskBadgeClass(item.risk_level)} variant="secondary">
                      {item.risk_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-700">{item.recommended_action}</TableCell>
                </TableRow>
              ))}
              {predictive.employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No predictive analytics data available yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Performance Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="perf-employee">Employee</Label>
                <Select
                  value={createForm.employeeId || "none"}
                  onValueChange={(value) =>
                    setCreateForm((prev) => ({ ...prev, employeeId: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger id="perf-employee" className="mt-2">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select employee</SelectItem>
                    {creatableEmployeeOptions.map((employee) => (
                      <SelectItem key={employee.id} value={String(employee.id)}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="perf-type">Review Type</Label>
                <Select
                  value={createForm.reviewType}
                  onValueChange={handleCreateReviewTypeChange}
                >
                  <SelectTrigger id="perf-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Half Yearly">Half Yearly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="perf-period-start">Period Start</Label>
                <Input
                  id="perf-period-start"
                  type="date"
                  className="mt-2"
                  value={createForm.periodStart}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, periodStart: event.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="perf-period-end">Period End</Label>
                <Input
                  id="perf-period-end"
                  type="date"
                  className="mt-2"
                  value={createForm.periodEnd}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, periodEnd: event.target.value }))}
                />
              </div>

            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-900">
                Questionnaire (1 = Needs Improvement, 5 = Excellent)
              </div>
              {REVIEW_QUESTIONS[createForm.reviewType].map((question) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="text-sm text-gray-700">{question.text}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      value={questionState[question.id]?.score || "none"}
                      onValueChange={(value) =>
                        setQuestionState((prev) => ({
                          ...prev,
                          [question.id]: {
                            ...prev[question.id],
                            score: value === "none" ? "" : value,
                          },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select score" />
                      </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select score</SelectItem>
                        <SelectItem value="1">1 - Unsatisfactory</SelectItem>
                        <SelectItem value="2">2 - Needs Improvement</SelectItem>
                        <SelectItem value="3">3 - Meets Expectations</SelectItem>
                        <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
                        <SelectItem value="5">5 - Outstanding</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                      placeholder="Optional note"
                      value={questionState[question.id]?.comment || ""}
                      onChange={(event) =>
                        setQuestionState((prev) => ({
                          ...prev,
                          [question.id]: {
                            ...prev[question.id],
                            comment: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="perf-summary">Summary (optional)</Label>
              <Textarea
                id="perf-summary"
                className="mt-2"
                rows={3}
                value={createForm.reviewSummary}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, reviewSummary: event.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleCreateReview()}
                disabled={createSubmitting}
              >
                {createSubmitting ? "Creating..." : "Create Review"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {workflowForm.action === "submit_manager_review"
                ? "Manager Review Submission"
                : workflowForm.action === "submit_department_review"
                  ? "Department Review Submission"
                  : "HR Final Review Submission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {workflowError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {workflowError}
              </div>
            )}

            <div className="text-sm text-gray-700">
              Employee: <span className="font-medium text-gray-900">{workflowForm.employee}</span>
            </div>
            <div className="text-sm text-gray-700">
              Current Stage: <span className="font-medium text-gray-900">{workflowForm.stage}</span>
            </div>

            <div>
              <Label htmlFor="workflow-rating">Rating</Label>
              <Input
                id="workflow-rating"
                type="number"
                min="0.01"
                max="5"
                step="0.01"
                className="mt-2"
                value={workflowForm.rating}
                onChange={(event) => setWorkflowForm((prev) => ({ ...prev, rating: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="workflow-summary">Summary (optional)</Label>
              <Textarea
                id="workflow-summary"
                className="mt-2"
                rows={4}
                value={workflowForm.summary}
                onChange={(event) => setWorkflowForm((prev) => ({ ...prev, summary: event.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setWorkflowDialogOpen(false)} disabled={workflowSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleSubmitWorkflow()}
                disabled={workflowSubmitting}
              >
                {workflowSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
