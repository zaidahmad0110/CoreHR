import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Briefcase, Building2, MapPin, Upload, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { recruitmentService } from "../api/services";
import { useApiQuery } from "../hooks/useApiQuery";
import type { RecruitmentJobItem } from "../api/types";
import { useAuth } from "../auth/AuthContext";

type ApplicationFormState = {
  name: string;
  email: string;
  phone: string;
  skills: string;
  yearsExperience: string;
  cv: File | null;
};

const defaultApplicationForm: ApplicationFormState = {
  name: "",
  email: "",
  phone: "",
  skills: "",
  yearsExperience: "",
  cv: null,
};

export function Careers() {
  const { isAuthenticated } = useAuth();
  const { data, loading, error, refetch } = useApiQuery(() => recruitmentService.getPublicJobs(), []);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RecruitmentJobItem | null>(null);
  const [applicationForm, setApplicationForm] = useState<ApplicationFormState>(defaultApplicationForm);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [applicationSuccess, setApplicationSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Careers";
  }, []);

  const jobs = data?.jobs ?? [];
  const totalApplicants = jobs.reduce((sum, job) => sum + job.applicants, 0);

  const resetApplicationForm = () => {
    setApplicationForm(defaultApplicationForm);
    setApplicationError(null);
    setApplicationSuccess(null);
  };

  const openApplyDialog = (job: RecruitmentJobItem) => {
    setSelectedJob(job);
    resetApplicationForm();
    setApplyDialogOpen(true);
  };

  const handleSubmitApplication = async () => {
    if (!selectedJob) {
      return;
    }

    if (!applicationForm.name.trim() || !applicationForm.email.trim() || !applicationForm.cv) {
      setApplicationError("Name, email, and CV are required.");
      return;
    }

    setSubmitting(true);
    setApplicationError(null);
    setApplicationSuccess(null);

    try {
      await recruitmentService.applyToPublicJob(selectedJob.id, {
        name: applicationForm.name.trim(),
        email: applicationForm.email.trim(),
        phone: applicationForm.phone.trim() || undefined,
        skills: applicationForm.skills.trim() || undefined,
        years_experience: applicationForm.yearsExperience.trim()
          ? Number(applicationForm.yearsExperience.trim())
          : undefined,
        cv: applicationForm.cv,
      });

      setApplicationSuccess("Application submitted successfully.");
      await refetch();
      window.setTimeout(() => {
        setApplyDialogOpen(false);
        setSelectedJob(null);
        resetApplicationForm();
      }, 1200);
    } catch (err) {
      setApplicationError(err instanceof Error ? err.message : "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#EFF6FF_0%,#F8FAFC_30%,#FFFFFF_100%)] text-gray-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB] shadow-sm">
              <span className="text-sm font-semibold text-white">HR</span>
            </div>
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.18em] text-[#2563EB]">Careers</div>
              <h1 className="text-2xl font-semibold">Open Positions</h1>
            </div>
          </div>
          {/* <Button asChild variant={isAuthenticated ? "default" : "outline"} className={isAuthenticated ? "bg-[#2563EB] hover:bg-[#1d4ed8] text-white" : ""}>
            <Link to={isAuthenticated ? "/dashboard" : "/login"}>
              {isAuthenticated ? "Go to Dashboard" : "Employee Login"}
            </Link>
          </Button> */}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[1.4fr_0.6fr]">
          <Card className="border-0 bg-white/90 shadow-sm">
            <CardContent className="p-8">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
                  Join our growing team
                </div>
                <h2 className="text-4xl font-semibold leading-tight text-gray-950">
                  Explore active job postings and apply directly.
                </h2>
                <p className="mt-4 text-base leading-7 text-gray-600">
                  Review open roles, check department and experience requirements, and submit your CV in a few steps.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DBEAFE]">
                  <Briefcase className="h-6 w-6 text-[#2563EB]" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Open Jobs</div>
                  <div className="text-2xl font-semibold">{jobs.length}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DCFCE7]">
                  <Users className="h-6 w-6 text-[#16A34A]" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">Applicants</div>
                  <div className="text-2xl font-semibold">{totalApplicants}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-10">
          {error && (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-6">
                <div className="text-red-600">{error}</div>
                <Button variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {!error && (
            <div className="grid gap-5">
              {loading && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6 text-sm text-gray-500">Loading job postings...</CardContent>
                </Card>
              )}

              {!loading && jobs.length === 0 && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6 text-sm text-gray-500">No active jobs are available right now.</CardContent>
                </Card>
              )}

              {jobs.map((job) => (
                <Card key={job.id} className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-950">{job.title}</h3>
                          <Badge className="bg-green-100 text-green-700" variant="secondary">
                            {job.status}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <span className="inline-flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {job.department}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {job.location || "Location to be discussed"}
                          </span>
                          <span>{job.type}</span>
                          <span>{job.applicants} applicants</span>
                        </div>

                        {(job.description || job.requirements || job.required_skills) && (
                          <div className="mt-5 space-y-3 text-sm leading-6 text-gray-600">
                            {job.description && <p>{job.description}</p>}
                            {job.requirements && (
                              <p>
                                <span className="font-medium text-gray-800">Requirements:</span> {job.requirements}
                              </p>
                            )}
                            {job.required_skills && (
                              <p>
                                <span className="font-medium text-gray-800">Skills:</span> {job.required_skills}
                              </p>
                            )}
                            {job.min_experience_years != null && job.min_experience_years > 0 && (
                              <p>
                                <span className="font-medium text-gray-800">Minimum experience:</span>{" "}
                                {job.min_experience_years} years
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                        <div className="text-sm text-gray-500">Posted {job.posted}</div>
                        <Button
                          className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                          onClick={() => openApplyDialog(job)}
                        >
                          Apply Now
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Apply{selectedJob ? ` - ${selectedJob.title}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {applicationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {applicationError}
              </div>
            )}
            {applicationSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {applicationSuccess}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="career-name">Full Name</Label>
                <Input
                  id="career-name"
                  className="mt-2"
                  value={applicationForm.name}
                  onChange={(event) => setApplicationForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="career-email">Email</Label>
                <Input
                  id="career-email"
                  type="email"
                  className="mt-2"
                  value={applicationForm.email}
                  onChange={(event) => setApplicationForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="career-phone">Phone</Label>
                <Input
                  id="career-phone"
                  className="mt-2"
                  value={applicationForm.phone}
                  onChange={(event) => setApplicationForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="career-years">Years of Experience</Label>
                <Input
                  id="career-years"
                  type="number"
                  min="0"
                  className="mt-2"
                  value={applicationForm.yearsExperience}
                  onChange={(event) =>
                    setApplicationForm((prev) => ({ ...prev, yearsExperience: event.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="career-skills">Skills</Label>
              <Textarea
                id="career-skills"
                rows={4}
                className="mt-2"
                placeholder="List your relevant skills, tools, and strengths."
                value={applicationForm.skills}
                onChange={(event) => setApplicationForm((prev) => ({ ...prev, skills: event.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="career-cv">Upload CV</Label>
              <Input
                id="career-cv"
                type="file"
                className="mt-2"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(event) =>
                  setApplicationForm((prev) => ({ ...prev, cv: event.target.files?.[0] ?? null }))
                }
              />
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                <Upload className="h-3.5 w-3.5" />
                PDF, DOC, DOCX, JPG, PNG, WEBP up to 10 MB
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setApplyDialogOpen(false);
                  setSelectedJob(null);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                onClick={() => void handleSubmitApplication()}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
