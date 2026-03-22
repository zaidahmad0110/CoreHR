import { useState } from "react";
import { Plus, Briefcase, Users, Sparkles, FileUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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
import { Textarea } from "../components/ui/textarea";
import { recruitmentService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";
import type { RecruitmentCandidateItem } from "../api/types";
import { openBlobInNewTab } from "../utils/openInNewTab";

const stages = ["Applied", "Screening", "Interview", "Offer"];

export function Recruitment() {
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [jobDetailsDialogOpen, setJobDetailsDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [jobClosingId, setJobClosingId] = useState<number | null>(null);
  const [jobDeletingId, setJobDeletingId] = useState<number | null>(null);
  const [atsSelecting, setAtsSelecting] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<"offer" | "not_selected" | "accepted" | "rejected">("offer");
  const [selectedCandidate, setSelectedCandidate] = useState<RecruitmentCandidateItem | null>(null);
  const [manualCvDialogOpen, setManualCvDialogOpen] = useState(false);
  const [manualCvSubmitting, setManualCvSubmitting] = useState(false);
  const [manualCvError, setManualCvError] = useState<string | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<number | null>(null);

  const [jobForm, setJobForm] = useState({
    title: "",
    department: "",
    location: "",
    type: "Full-time" as "Full-time" | "Part-time" | "Contract" | "Internship" | "Temporary",
    description: "",
    requirements: "",
    requiredSkills: "",
    minExperienceYears: "",
  });

  const [scheduleForm, setScheduleForm] = useState({
    interviewAt: "",
    sendEmail: true,
    sendSms: false,
    notifySelected: true,
    customMessage: "",
  });

  const [decisionForm, setDecisionForm] = useState({
    sendEmail: true,
    sendSms: false,
    customMessage: "",
    offerAttachment: null as File | null,
  });

  const [manualCvForm, setManualCvForm] = useState({
    jobPostingId: "",
    name: "",
    email: "",
    phone: "",
    stage: "Applied" as "Applied" | "Screening" | "Interview" | "Offer",
    skills: "",
    yearsExperience: "",
    cv: null as File | null,
  });

  const { data, loading, error, refetch } = useApiQuery(() => recruitmentService.getRecruitmentData(), []);
  const {
    data: jobDetails,
    loading: jobDetailsLoading,
    error: jobDetailsError,
    refetch: refetchJobDetails,
  } = useApiQuery(
    () => recruitmentService.getJobDetails(selectedJobId ?? 0),
    [selectedJobId, jobDetailsDialogOpen],
    { skip: !selectedJobId || !jobDetailsDialogOpen },
  );

  const jobPostings = data?.jobs ?? [];
  const candidates = data?.candidates ?? [];
  const stats = data?.stats ?? {
    active_job_postings: 0,
    total_applicants: 0,
    interviews_scheduled: 0,
  };

  const resetJobForm = () => {
    setEditingJobId(null);
    setJobForm({
      title: "",
      department: "",
      location: "",
      type: "Full-time",
      description: "",
      requirements: "",
      requiredSkills: "",
      minExperienceYears: "",
    });
    setPostError(null);
  };

  const resetManualCvForm = () => {
    setManualCvForm({
      jobPostingId: "",
      name: "",
      email: "",
      phone: "",
      stage: "Applied",
      skills: "",
      yearsExperience: "",
      cv: null,
    });
    setManualCvError(null);
  };

  const handleCreateJob = async () => {
    if (!jobForm.title || !jobForm.department) {
      setPostError("Title and department are required.");
      return;
    }

    setPostSubmitting(true);
    setPostError(null);

    try {
      const payload = {
        title: jobForm.title,
        department: jobForm.department,
        location: jobForm.location || undefined,
        type: jobForm.type,
        description: jobForm.description || undefined,
        requirements: jobForm.requirements || undefined,
        required_skills: jobForm.requiredSkills || undefined,
        min_experience_years: jobForm.minExperienceYears ? Number(jobForm.minExperienceYears) : undefined,
      };

      if (editingJobId) {
        await recruitmentService.updateJob(editingJobId, payload);
      } else {
        await recruitmentService.createJob(payload);
      }

      setPostDialogOpen(false);
      resetJobForm();
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setPostError(err.message);
      } else {
        setPostError(editingJobId ? "Failed to update job posting." : "Failed to create job posting.");
      }
    } finally {
      setPostSubmitting(false);
    }
  };

  const openJobDetails = (jobId: number) => {
    setSelectedJobId(jobId);
    setJobDetailsDialogOpen(true);
  };

  const openEditJobDialog = (job: typeof jobPostings[number]) => {
    setEditingJobId(job.id);
    setJobForm({
      title: job.title,
      department: job.department,
      location: job.location ?? "",
      type: job.type,
      description: job.description ?? "",
      requirements: job.requirements ?? "",
      requiredSkills: job.required_skills ?? "",
      minExperienceYears: job.min_experience_years != null ? String(job.min_experience_years) : "",
    });
    setPostError(null);
    setPostDialogOpen(true);
  };

  const handleSelectBestCandidate = async () => {
    if (!selectedJobId) {
      return;
    }

    setAtsSelecting(true);
    try {
      await recruitmentService.selectBestCandidate(selectedJobId);
      await Promise.all([refetch(), refetchJobDetails()]);
    } finally {
      setAtsSelecting(false);
    }
  };

  const openScheduleDialog = (candidate: RecruitmentCandidateItem) => {
    setSelectedCandidate(candidate);
    setScheduleError(null);
    setScheduleForm({
      interviewAt: "",
      sendEmail: true,
      sendSms: false,
      notifySelected: true,
      customMessage: "",
    });
    setScheduleDialogOpen(true);
  };

  const openDecisionDialog = (
    candidate: RecruitmentCandidateItem,
    type: "offer" | "not_selected" | "accepted" | "rejected",
  ) => {
    setSelectedCandidate(candidate);
    setDecisionType(type);
    setDecisionError(null);
    setDecisionForm({
      sendEmail: true,
      sendSms: false,
      customMessage: "",
      offerAttachment: null,
    });
    setDecisionDialogOpen(true);
  };

  const handleScheduleInterview = async () => {
    if (!selectedCandidate || !selectedJobId) {
      return;
    }

    if (!scheduleForm.interviewAt) {
      setScheduleError("Please select an interview date and time.");
      return;
    }

    const channels: Array<"email" | "sms"> = [];
    if (scheduleForm.sendEmail) channels.push("email");
    if (scheduleForm.sendSms) channels.push("sms");

    if (channels.length === 0) {
      setScheduleError("Select at least one notification channel.");
      return;
    }

    setScheduleSubmitting(true);
    setScheduleError(null);

    try {
      await recruitmentService.scheduleInterview(selectedCandidate.id, {
        job_posting_id: selectedJobId,
        interview_at: scheduleForm.interviewAt,
        channels,
        notify_selected: scheduleForm.notifySelected,
        custom_message: scheduleForm.customMessage || undefined,
      });
      setScheduleDialogOpen(false);
      setSelectedCandidate(null);
      await Promise.all([refetch(), refetchJobDetails()]);
    } catch (err) {
      if (err instanceof Error) {
        setScheduleError(err.message);
      } else {
        setScheduleError("Failed to schedule interview.");
      }
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleProcessCandidateDecision = async () => {
    if (!selectedCandidate || !selectedJobId) {
      return;
    }

    const channels: Array<"email" | "sms"> = [];
    if (decisionForm.sendEmail) channels.push("email");
    if (decisionForm.sendSms) channels.push("sms");

    if (channels.length === 0) {
      setDecisionError("Select at least one notification channel.");
      return;
    }

    if (decisionType === "offer" && !decisionForm.offerAttachment) {
      setDecisionError("Offer attachment is required.");
      return;
    }

    if (decisionType === "offer" && !decisionForm.sendEmail) {
      setDecisionError("Job offer attachments can only be sent by email.");
      return;
    }

    setDecisionSubmitting(true);
    setDecisionError(null);

    try {
      await recruitmentService.processCandidateDecision(selectedCandidate.id, {
        job_posting_id: selectedJobId,
        decision: decisionType,
        channels,
        notify_candidate: true,
        custom_message: decisionForm.customMessage || undefined,
        offer_attachment: decisionType === "offer" ? decisionForm.offerAttachment ?? undefined : undefined,
      });

      setDecisionDialogOpen(false);
      setSelectedCandidate(null);
      await Promise.all([refetch(), refetchJobDetails()]);
    } catch (err) {
      if (err instanceof Error) {
        setDecisionError(err.message);
      } else {
        setDecisionError("Failed to update candidate decision.");
      }
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const handleUploadManualCv = async () => {
    if (!manualCvForm.jobPostingId || !manualCvForm.name || !manualCvForm.cv) {
      setManualCvError("Job, candidate name, and CV file are required.");
      return;
    }

    setManualCvSubmitting(true);
    setManualCvError(null);

    try {
      await recruitmentService.uploadManualCandidate({
        job_posting_id: Number(manualCvForm.jobPostingId),
        name: manualCvForm.name,
        email: manualCvForm.email || undefined,
        phone: manualCvForm.phone || undefined,
        stage: manualCvForm.stage,
        skills: manualCvForm.skills || undefined,
        years_experience: manualCvForm.yearsExperience ? Number(manualCvForm.yearsExperience) : undefined,
        cv: manualCvForm.cv,
      });

      setManualCvDialogOpen(false);
      resetManualCvForm();
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setManualCvError(err.message);
      } else {
        setManualCvError("Failed to upload candidate CV.");
      }
    } finally {
      setManualCvSubmitting(false);
    }
  };

  const handleViewCv = async (candidate: RecruitmentCandidateItem) => {
    if (!candidate.cv_url) {
      return;
    }

    try {
      const file = await recruitmentService.getCandidateCv(candidate.id);
      openBlobInNewTab(file.blob);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open CV.";
      window.alert(message);
    }
  };

  const hasInterviewDatePassed = (candidate: RecruitmentCandidateItem) => {
    const rawInterviewDate = candidate.interview_at_iso ?? candidate.interview_at;
    if (!rawInterviewDate) {
      return false;
    }

    const interviewDate = new Date(rawInterviewDate);
    if (Number.isNaN(interviewDate.getTime())) {
      return false;
    }

    return interviewDate.getTime() <= Date.now();
  };

  const handleDeleteCandidate = async (candidate: RecruitmentCandidateItem) => {
    const shouldDelete = window.confirm(`Delete ${candidate.name}? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setDeletingCandidateId(candidate.id);

    try {
      await recruitmentService.deleteCandidate(candidate.id);
      if (selectedCandidate?.id === candidate.id) {
        setSelectedCandidate(null);
        setScheduleDialogOpen(false);
        setDecisionDialogOpen(false);
      }

      const refreshTasks: Array<Promise<unknown>> = [refetch()];
      if (jobDetailsDialogOpen && selectedJobId) {
        refreshTasks.push(refetchJobDetails());
      }

      await Promise.all(refreshTasks);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete candidate.";
      window.alert(message);
    } finally {
      setDeletingCandidateId(null);
    }
  };

  const handleCloseJob = async (job: typeof jobPostings[number]) => {
    const shouldClose = window.confirm(`Close ${job.title}? It will no longer appear on the public careers page.`);
    if (!shouldClose) {
      return;
    }

    setJobClosingId(job.id);

    try {
      await recruitmentService.closeJob(job.id);
      const refreshTasks: Array<Promise<unknown>> = [refetch()];
      if (selectedJobId === job.id && jobDetailsDialogOpen) {
        refreshTasks.push(refetchJobDetails());
      }
      await Promise.all(refreshTasks);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to close job posting.";
      window.alert(message);
    } finally {
      setJobClosingId(null);
    }
  };

  const handleDeleteJob = async (job: typeof jobPostings[number]) => {
    const shouldDelete = window.confirm(`Delete ${job.title}? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setJobDeletingId(job.id);

    try {
      await recruitmentService.deleteJob(job.id);
      if (selectedJobId === job.id) {
        setSelectedJobId(null);
        setJobDetailsDialogOpen(false);
      }
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete job posting.";
      window.alert(message);
    } finally {
      setJobDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recruitment</h1>
          <p className="text-gray-600 mt-1">Manage job postings and candidates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetManualCvForm();
              setManualCvDialogOpen(true);
            }}
          >
            <FileUp className="w-4 h-4 mr-2" />
            Upload CV Manual
          </Button>
          <Button
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
            onClick={() => {
              resetJobForm();
              setPostDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Post New Job
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Job Postings</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.active_job_postings}</h3>
              </div>
              <div className="w-12 h-12 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Applicants</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.total_applicants}</h3>
              </div>
              <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Interviews Scheduled</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.interviews_scheduled}</h3>
              </div>
              <div className="w-12 h-12 bg-[#F59E0B] bg-opacity-10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-[#F59E0B]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Current Job Postings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading && <div className="text-sm text-gray-500">Loading job postings...</div>}
            {!loading && jobPostings.length === 0 && (
              <div className="text-sm text-gray-500">No job postings yet.</div>
            )}
            {jobPostings.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{job.title}</h3>
                    <Badge
                      className={
                        job.status === "Closed"
                          ? "bg-gray-200 text-gray-700"
                          : "bg-green-100 text-green-700"
                      }
                      variant="secondary"
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{job.department}</span>
                    <span>|</span>
                    <span>{job.location}</span>
                    <span>|</span>
                    <span>{job.type}</span>
                    <span>|</span>
                    <span>Posted {job.posted}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-gray-900">{job.applicants}</div>
                    <div className="text-xs text-gray-600">Applicants</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditJobDialog(job)}
                    disabled={jobClosingId === job.id || jobDeletingId === job.id}
                  >
                    Edit
                  </Button>
                  {job.status !== "Closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-amber-700 border-amber-200 hover:bg-amber-50"
                      onClick={() => void handleCloseJob(job)}
                      disabled={jobClosingId === job.id || jobDeletingId === job.id}
                    >
                      {jobClosingId === job.id ? "Closing..." : "Close"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => void handleDeleteJob(job)}
                    disabled={jobDeletingId === job.id || jobClosingId === job.id}
                  >
                    {jobDeletingId === job.id ? "Deleting..." : "Delete"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openJobDetails(job.id)}>
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Candidate Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stages.map((stage) => {
              const stageCandidates = candidates.filter((c) => c.stage === stage);
              return (
                <div key={stage} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{stage}</h3>
                    <Badge variant="secondary">{stageCandidates.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {stageCandidates.map((candidate) => (
                      <div key={candidate.id} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-medium">
                              {candidate.name.split(" ").map((n) => n[0]).join("")}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm">
                              {candidate.name}
                            </div>
                            <div className="text-xs text-gray-600 mt-1 truncate">
                              {candidate.position}
                            </div>
                            {candidate.cv_url && (
                              <button
                                type="button"
                                className="text-xs text-[#2563EB] mt-1 hover:underline"
                                onClick={() => void handleViewCv(candidate)}
                              >
                                View CV
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-xs text-red-600 mt-1 hover:underline disabled:opacity-50"
                              onClick={() => void handleDeleteCandidate(candidate)}
                              disabled={deletingCandidateId === candidate.id}
                            >
                              {deletingCandidateId === candidate.id ? "Deleting..." : "Delete Candidate"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={postDialogOpen}
        onOpenChange={(open) => {
          setPostDialogOpen(open);
          if (!open) {
            resetJobForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingJobId ? "Edit Job Post" : "Post New Job"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {postError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {postError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="job-title">Title</Label>
                <Input
                  id="job-title"
                  className="mt-2"
                  value={jobForm.title}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="job-department">Department</Label>
                <Input
                  id="job-department"
                  className="mt-2"
                  value={jobForm.department}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, department: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="job-location">Location</Label>
                <Input
                  id="job-location"
                  className="mt-2"
                  value={jobForm.location}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, location: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="job-type">Type</Label>
                <Select
                  value={jobForm.type}
                  onValueChange={(value) =>
                    setJobForm((prev) => ({ ...prev, type: value as typeof jobForm.type }))
                  }
                >
                  <SelectTrigger id="job-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Internship">Internship</SelectItem>
                    <SelectItem value="Temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="job-min-exp">Min Experience (years)</Label>
                <Input
                  id="job-min-exp"
                  type="number"
                  min="0"
                  className="mt-2"
                  value={jobForm.minExperienceYears}
                  onChange={(event) =>
                    setJobForm((prev) => ({ ...prev, minExperienceYears: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="job-required-skills">Required Skills (comma-separated)</Label>
                <Input
                  id="job-required-skills"
                  className="mt-2"
                  value={jobForm.requiredSkills}
                  onChange={(event) =>
                    setJobForm((prev) => ({ ...prev, requiredSkills: event.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="job-description">Description</Label>
              <Textarea
                id="job-description"
                className="mt-2"
                rows={3}
                value={jobForm.description}
                onChange={(event) => setJobForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="job-requirements">Requirements</Label>
              <Textarea
                id="job-requirements"
                className="mt-2"
                rows={3}
                value={jobForm.requirements}
                onChange={(event) => setJobForm((prev) => ({ ...prev, requirements: event.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setPostDialogOpen(false);
                  resetJobForm();
                }}
                disabled={postSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleCreateJob()}
                disabled={postSubmitting}
              >
                {postSubmitting ? (editingJobId ? "Saving..." : "Posting...") : editingJobId ? "Save Changes" : "Post Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manualCvDialogOpen} onOpenChange={setManualCvDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Candidate CV (Manual)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {manualCvError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {manualCvError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manual-cv-job">Job Posting</Label>
                <Select
                  value={manualCvForm.jobPostingId || "none"}
                  onValueChange={(value) =>
                    setManualCvForm((prev) => ({ ...prev, jobPostingId: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger id="manual-cv-job" className="mt-2">
                    <SelectValue placeholder="Select job posting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select job posting</SelectItem>
                    {jobPostings.map((job) => (
                      <SelectItem key={job.id} value={String(job.id)}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="manual-cv-name">Candidate Name</Label>
                <Input
                  id="manual-cv-name"
                  className="mt-2"
                  value={manualCvForm.name}
                  onChange={(event) =>
                    setManualCvForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="manual-cv-email">Email</Label>
                <Input
                  id="manual-cv-email"
                  type="email"
                  className="mt-2"
                  value={manualCvForm.email}
                  onChange={(event) =>
                    setManualCvForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="manual-cv-phone">Phone</Label>
                <Input
                  id="manual-cv-phone"
                  className="mt-2"
                  value={manualCvForm.phone}
                  onChange={(event) =>
                    setManualCvForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="manual-cv-stage">Initial Stage</Label>
                <Select
                  value={manualCvForm.stage}
                  onValueChange={(value) =>
                    setManualCvForm((prev) => ({
                      ...prev,
                      stage: value as "Applied" | "Screening" | "Interview" | "Offer",
                    }))
                  }
                >
                  <SelectTrigger id="manual-cv-stage" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="manual-cv-exp">Years Experience</Label>
                <Input
                  id="manual-cv-exp"
                  type="number"
                  min="0"
                  className="mt-2"
                  value={manualCvForm.yearsExperience}
                  onChange={(event) =>
                    setManualCvForm((prev) => ({ ...prev, yearsExperience: event.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="manual-cv-skills">Skills (comma-separated)</Label>
              <Textarea
                id="manual-cv-skills"
                className="mt-2"
                rows={3}
                value={manualCvForm.skills}
                onChange={(event) =>
                  setManualCvForm((prev) => ({ ...prev, skills: event.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="manual-cv-file">CV File (PDF, DOC, DOCX, JPG, PNG)</Label>
              <Input
                id="manual-cv-file"
                type="file"
                className="mt-2"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(event) =>
                  setManualCvForm((prev) => ({ ...prev, cv: event.target.files?.[0] ?? null }))
                }
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setManualCvDialogOpen(false)} disabled={manualCvSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleUploadManualCv()}
                disabled={manualCvSubmitting}
              >
                {manualCvSubmitting ? "Uploading..." : "Upload CV"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={jobDetailsDialogOpen} onOpenChange={setJobDetailsDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Job Details & ATS Ranking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {jobDetailsLoading && <div className="text-sm text-gray-500">Loading job details...</div>}
            {jobDetailsError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {jobDetailsError}
              </div>
            )}

            {jobDetails && (
              <>
                <Card className="border border-gray-200 shadow-none">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{jobDetails.job.title}</div>
                        <div className="text-sm text-gray-600">
                          {jobDetails.job.department} | {jobDetails.job.location} | {jobDetails.job.type}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => void handleSelectBestCandidate()}
                        disabled={atsSelecting}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {atsSelecting ? "Selecting..." : "Pick Best Candidate (ATS)"}
                      </Button>
                    </div>
                    <div className="text-sm text-gray-700">{jobDetails.job.description}</div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-800">Requirements:</span>{" "}
                      {jobDetails.job.requirements || "N/A"}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-800">Required skills:</span>{" "}
                      {jobDetails.job.required_skills || "N/A"}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">ATS Ranked Candidates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {jobDetails.ranked_candidates.length === 0 && (
                      <div className="text-sm text-gray-500">No candidates available for ranking.</div>
                    )}
                    {jobDetails.ranked_candidates.map((candidate) => (
                      (() => {
                        const interviewDatePassed = hasInterviewDatePassed(candidate);
                        const isFinalDecision = candidate.stage === "Not Selected"
                          || candidate.stage === "Accepted"
                          || candidate.stage === "Rejected";
                        const canScheduleInterview = !interviewDatePassed
                          && candidate.stage !== "Offer"
                          && !isFinalDecision;
                        const canMakeDecision = interviewDatePassed
                          && candidate.stage !== "Offer"
                          && !isFinalDecision;
                        const canResolveOffer = candidate.stage === "Offer";

                        return (
                          <div
                            key={candidate.id}
                            className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <div className="font-medium text-gray-900">{candidate.name}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {candidate.position} | {candidate.years_experience ?? 0} yrs | Stage: {candidate.stage}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Score: {candidate.ats_score ?? 0} - {candidate.ats_reason ?? "N/A"}
                              </div>
                              {candidate.cv_file_name && (
                                <div className="text-xs text-gray-600 mt-1">CV: {candidate.cv_file_name}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {candidate.cv_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleViewCv(candidate)}
                                  disabled={deletingCandidateId === candidate.id}
                                >
                                  View CV
                                </Button>
                              )}
                              {canScheduleInterview && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openScheduleDialog(candidate)}
                                  disabled={deletingCandidateId === candidate.id}
                                >
                                  Schedule Interview
                                </Button>
                              )}
                              {canMakeDecision && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-700 border-green-200 hover:bg-green-50"
                                    onClick={() => openDecisionDialog(candidate, "offer")}
                                    disabled={deletingCandidateId === candidate.id}
                                  >
                                    Send Job Offer
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                                    onClick={() => openDecisionDialog(candidate, "not_selected")}
                                    disabled={deletingCandidateId === candidate.id}
                                  >
                                    Not Selected
                                  </Button>
                                </>
                              )}
                              {canResolveOffer && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                    onClick={() => openDecisionDialog(candidate, "accepted")}
                                    disabled={deletingCandidateId === candidate.id}
                                  >
                                    Accepted
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-rose-700 border-rose-200 hover:bg-rose-50"
                                    onClick={() => openDecisionDialog(candidate, "rejected")}
                                    disabled={deletingCandidateId === candidate.id}
                                  >
                                    Rejected
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => void handleDeleteCandidate(candidate)}
                                disabled={deletingCandidateId === candidate.id}
                              >
                                {deletingCandidateId === candidate.id ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
                          </div>
                        );
                      })()
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Schedule Interview{selectedCandidate ? ` - ${selectedCandidate.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {scheduleError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {scheduleError}
              </div>
            )}
            <div>
              <Label htmlFor="interview-at">Interview Date & Time</Label>
              <Input
                id="interview-at"
                type="datetime-local"
                className="mt-2"
                value={scheduleForm.interviewAt}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, interviewAt: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notify Candidate Via</Label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="schedule-channel"
                  checked={scheduleForm.sendEmail}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      sendEmail: event.target.checked,
                      sendSms: event.target.checked ? false : prev.sendSms,
                    }))
                  }
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="schedule-channel"
                  checked={scheduleForm.sendSms}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      sendSms: event.target.checked,
                      sendEmail: event.target.checked ? false : prev.sendEmail,
                    }))
                  }
                />
                SMS
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={scheduleForm.notifySelected}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({ ...prev, notifySelected: event.target.checked }))
                  }
                />
                Notify candidate they are selected for next step
              </label>
            </div>
            <div>
              <Label htmlFor="custom-message">Custom Message (optional)</Label>
              <Textarea
                id="custom-message"
                className="mt-2"
                rows={3}
                value={scheduleForm.customMessage}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, customMessage: event.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} disabled={scheduleSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleScheduleInterview()}
                disabled={scheduleSubmitting}
              >
                {scheduleSubmitting ? "Scheduling..." : "Schedule & Notify"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {decisionType === "offer" && "Send Job Offer"}
              {decisionType === "not_selected" && "Mark Not Selected"}
              {decisionType === "accepted" && "Mark Accepted"}
              {decisionType === "rejected" && "Mark Rejected"}
              {selectedCandidate ? ` - ${selectedCandidate.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {decisionError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {decisionError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Notify Candidate Via</Label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="decision-channel"
                  checked={decisionForm.sendEmail}
                  disabled={decisionType === "offer"}
                  onChange={(event) =>
                    setDecisionForm((prev) => ({
                      ...prev,
                      sendEmail: event.target.checked,
                      sendSms: event.target.checked ? false : prev.sendSms,
                    }))
                  }
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="decision-channel"
                  checked={decisionForm.sendSms}
                  disabled={decisionType === "offer"}
                  onChange={(event) =>
                    setDecisionForm((prev) => ({
                      ...prev,
                      sendSms: event.target.checked,
                      sendEmail: event.target.checked ? false : prev.sendEmail,
                    }))
                  }
                />
                SMS
              </label>
              {decisionType === "offer" && (
                <div className="text-xs text-gray-500">
                  Job offers with attachment are sent via email only.
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="decision-custom-message">Custom Message (optional)</Label>
              <Textarea
                id="decision-custom-message"
                className="mt-2"
                rows={3}
                value={decisionForm.customMessage}
                onChange={(event) =>
                  setDecisionForm((prev) => ({ ...prev, customMessage: event.target.value }))
                }
              />
            </div>
            {decisionType === "offer" && (
              <div>
                <Label htmlFor="decision-offer-attachment">Offer Attachment</Label>
                <Input
                  id="decision-offer-attachment"
                  type="file"
                  className="mt-2"
                  accept=".pdf,.doc,.docx"
                  onChange={(event) =>
                    setDecisionForm((prev) => ({ ...prev, offerAttachment: event.target.files?.[0] ?? null }))
                  }
                />
                <div className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10 MB</div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDecisionDialogOpen(false)} disabled={decisionSubmitting}>
                Cancel
              </Button>
              <Button
                className={
                  decisionType === "offer"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : decisionType === "not_selected"
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : decisionType === "accepted"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-rose-600 hover:bg-rose-700 text-white"
                }
                onClick={() => void handleProcessCandidateDecision()}
                disabled={decisionSubmitting}
              >
                {decisionSubmitting
                  ? "Submitting..."
                  : decisionType === "offer"
                    ? "Send Offer"
                    : decisionType === "not_selected"
                      ? "Confirm Not Selected"
                      : decisionType === "accepted"
                        ? "Confirm Accepted"
                        : "Confirm Rejected"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
