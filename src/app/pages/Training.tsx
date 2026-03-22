import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Plus, GraduationCap, Users, Clock, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { trainingService } from "../api/services";
import type { TrainingMaterialItem } from "../api/types";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";
import { openBlobInNewTab, openInNewTab } from "../utils/openInNewTab";

const parseProgramId = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toOptionalString = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toEmbedVideoUrl = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
};

export function Training() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [enrollingProgramId, setEnrollingProgramId] = useState<number | null>(null);
  const [viewingMaterialId, setViewingMaterialId] = useState<number | null>(null);
  const [articlePreviewMaterial, setArticlePreviewMaterial] = useState<TrainingMaterialItem | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
    parseProgramId(searchParams.get("program")),
  );
  const [programForm, setProgramForm] = useState({
    title: "",
    description: "",
    videoUrl: "",
    articleUrl: "",
    articleContent: "",
    instructor: "",
    durationDays: "30",
    capacity: "20",
    startDate: "",
    endDate: "",
  });

  const { data, loading, error, refetch } = useApiQuery(() => trainingService.getTrainingData(), []);
  const {
    data: selectedProgramMaterialsData,
    loading: selectedProgramMaterialsLoading,
    error: selectedProgramMaterialsError,
  } = useApiQuery(
    () => trainingService.getTrainingMaterials(selectedProgramId ?? undefined),
    [selectedProgramId],
    { skip: !selectedProgramId },
  );

  const trainingPrograms = data?.programs ?? [];
  const myEnrollments = data?.my_enrollments ?? [];
  const selectedProgramMaterials = selectedProgramMaterialsData?.materials ?? [];
  const stats = data?.stats ?? {
    active_programs: 0,
    total_enrollments: 0,
    completion_rate: 0,
  };

  const canManageTraining = useMemo(() => {
    if (!user) {
      return false;
    }

    if (user.role.toLowerCase() === "admin") {
      return true;
    }

    return (user.department ?? "").toLowerCase() === "human resources";
  }, [user]);

  useEffect(() => {
    setSelectedProgramId(parseProgramId(searchParams.get("program")));
  }, [searchParams]);

  useEffect(() => {
    setArticlePreviewMaterial(null);
  }, [selectedProgramId]);

  const selectedProgram = useMemo(
    () => trainingPrograms.find((program) => program.id === selectedProgramId) ?? null,
    [selectedProgramId, trainingPrograms],
  );

  const selectedProgramVideoEmbedUrl = useMemo(() => {
    if (!selectedProgram?.video_url) {
      return null;
    }

    return toEmbedVideoUrl(selectedProgram.video_url);
  }, [selectedProgram]);

  const handleCreateProgram = async () => {
    if (!programForm.title || !programForm.instructor) {
      setCreateError("Title and instructor are required.");
      return;
    }

    const durationDays = Number(programForm.durationDays);
    const capacity = Number(programForm.capacity);

    if (!Number.isInteger(durationDays) || durationDays < 1) {
      setCreateError("Duration must be at least 1 day.");
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
      setCreateError("Capacity must be at least 1.");
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      await trainingService.createProgram({
        title: programForm.title,
        description: toOptionalString(programForm.description),
        video_url: toOptionalString(programForm.videoUrl),
        article_url: toOptionalString(programForm.articleUrl),
        article_content: toOptionalString(programForm.articleContent),
        instructor: programForm.instructor,
        duration_days: durationDays,
        capacity,
        start_date: programForm.startDate || undefined,
        end_date: programForm.endDate || undefined,
      });

      setCreateDialogOpen(false);
      setProgramForm({
        title: "",
        description: "",
        videoUrl: "",
        articleUrl: "",
        articleContent: "",
        instructor: "",
        durationDays: "30",
        capacity: "20",
        startDate: "",
        endDate: "",
      });
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError("Failed to create training program.");
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleShowProgramDetails = (programId: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("program", String(programId));
    setSearchParams(nextParams, { replace: true });

    window.setTimeout(() => {
      document.getElementById("training-program-details")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const clearProgramDetails = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("program");
    setSearchParams(nextParams, { replace: true });
  };

  const handleEnrollProgram = async (programId: number) => {
    setEnrollingProgramId(programId);

    try {
      await trainingService.enroll(programId);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enroll in this program.";
      window.alert(message);
    } finally {
      setEnrollingProgramId(null);
    }
  };

  const handleViewProgramMaterial = async (material: TrainingMaterialItem) => {
    if (material.has_file) {
      setViewingMaterialId(material.id);

      try {
        const file = await trainingService.viewMaterial(material.id);
        openBlobInNewTab(file.blob);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to open material.";
        window.alert(message);
      } finally {
        setViewingMaterialId(null);
      }

      return;
    }

    if (material.external_url) {
      openInNewTab(material.external_url);
      return;
    }

    if (material.article_content) {
      setArticlePreviewMaterial(material);
      return;
    }

    window.alert("No viewable content exists for this material.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Training & Development</h1>
          <p className="text-gray-600 mt-1">Manage training programs and enrollments</p>
        </div>
        <Button
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
          onClick={() => {
            setCreateError(null);
            setCreateDialogOpen(true);
          }}
          disabled={!canManageTraining}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Program
        </Button>
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
                <p className="text-sm text-gray-600 mb-1">Active Programs</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.active_programs}</h3>
              </div>
              <div className="w-12 h-12 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Enrollments</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.total_enrollments}</h3>
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
                <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.completion_rate}%</h3>
              </div>
              <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>My Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading && <div className="text-sm text-gray-500">Loading enrollments...</div>}
            {!loading && myEnrollments.length === 0 && (
              <div className="text-sm text-gray-500">No enrollments yet.</div>
            )}
            {myEnrollments.map((enrollment) => (
              <div key={enrollment.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{enrollment.course}</h3>
                    <p className="text-sm text-gray-600 mt-1">Due: {enrollment.due_date ?? "N/A"}</p>
                  </div>
                  <Badge
                    className={
                      enrollment.status === "Completed"
                        ? "bg-green-100 text-green-700"
                        : enrollment.status === "In Progress"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                    }
                    variant="secondary"
                  >
                    {enrollment.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium text-gray-900">{enrollment.progress}%</span>
                  </div>
                  <Progress value={enrollment.progress} />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    className="border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white"
                    onClick={() => handleShowProgramDetails(enrollment.program_id)}
                  >
                    More Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card id="training-program-details" className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Program Details</CardTitle>
            {selectedProgram && (
              <Button variant="outline" onClick={clearProgramDetails}>
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProgram && (
            <div className="text-sm text-gray-500">
              Select an enrollment and click <span className="font-medium">More Details</span> to
              view its learning materials.
            </div>
          )}

          {selectedProgram && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedProgram.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{selectedProgram.description || "No description."}</p>
                  </div>
                  <Badge
                    className={
                      selectedProgram.status === "In Progress"
                        ? "bg-blue-100 text-blue-700"
                        : selectedProgram.status === "Completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                    }
                    variant="secondary"
                  >
                    {selectedProgram.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    {selectedProgram.instructor}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {selectedProgram.duration}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {selectedProgram.enrolled}/{selectedProgram.capacity} enrolled
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900">Video</h4>
                  {selectedProgram.video_url ? (
                    <div className="mt-3 space-y-3">
                      {selectedProgramVideoEmbedUrl ? (
                        <div className="aspect-video rounded-md overflow-hidden border border-gray-200">
                          <iframe
                            src={selectedProgramVideoEmbedUrl}
                            title={`${selectedProgram.title} training video`}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <a
                          href={selectedProgram.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-[#2563EB] hover:underline"
                        >
                          Open video
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No video is available for this program.</p>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900">Article</h4>
                  {selectedProgram.article_url || selectedProgram.article_content ? (
                    <div className="mt-3 space-y-3">
                      {selectedProgram.article_url && (
                        <a
                          href={selectedProgram.article_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-[#2563EB] hover:underline"
                        >
                          Open article link
                        </a>
                      )}
                      {selectedProgram.article_content && (
                        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700 whitespace-pre-line max-h-72 overflow-y-auto">
                          {selectedProgram.article_content}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No article is available for this program.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <h4 className="font-medium text-gray-900">Uploaded Materials</h4>
                </div>

                {selectedProgramMaterialsLoading && (
                  <p className="mt-3 text-sm text-gray-500">Loading materials...</p>
                )}

                {selectedProgramMaterialsError && (
                  <p className="mt-3 text-sm text-red-600">{selectedProgramMaterialsError}</p>
                )}

                {!selectedProgramMaterialsLoading && !selectedProgramMaterialsError && selectedProgramMaterials.length === 0 && (
                  <p className="mt-3 text-sm text-gray-500">No uploaded materials for this program yet.</p>
                )}

                {!selectedProgramMaterialsLoading && selectedProgramMaterials.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {selectedProgramMaterials.map((material) => (
                      <div
                        key={material.id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 p-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{material.title}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {material.material_type}
                            {material.file_name ? ` | ${material.file_name}` : ""}
                            {material.uploaded_at ? ` | ${material.uploaded_at}` : ""}
                          </div>
                          {material.description && (
                            <div className="text-xs text-gray-500 mt-1 max-w-xl">
                              {material.description}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => void handleViewProgramMaterial(material)}
                          disabled={viewingMaterialId === material.id}
                        >
                          {viewingMaterialId === material.id ? "Opening..." : "Open"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Available Training Programs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading && <div className="text-sm text-gray-500">Loading training programs...</div>}
            {!loading && trainingPrograms.length === 0 && (
              <div className="text-sm text-gray-500">No training programs available.</div>
            )}
            {trainingPrograms.map((program) => (
              <div
                key={program.id}
                className="p-6 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{program.title}</h3>
                      <Badge
                        className={
                          program.status === "In Progress"
                            ? "bg-blue-100 text-blue-700"
                            : program.status === "Completed"
                              ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }
                        variant="secondary"
                      >
                        {program.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{program.description}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        {program.instructor}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {program.duration}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {program.enrolled}/{program.capacity} enrolled
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void handleEnrollProgram(program.id)}
                    disabled={
                      enrollingProgramId === program.id
                      || program.is_enrolled
                      || program.enrolled >= program.capacity
                      || program.status === "Completed"
                    }
                  >
                    {enrollingProgramId === program.id
                      ? "Enrolling..."
                      : program.is_enrolled
                        ? "Enrolled"
                        : program.enrolled >= program.capacity
                          ? "Full"
                          : program.status === "Completed"
                            ? "Completed"
                            : "Enroll Now"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Training Program</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="training-title">Title</Label>
                <Input
                  id="training-title"
                  className="mt-2"
                  value={programForm.title}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="training-instructor">Instructor</Label>
                <Input
                  id="training-instructor"
                  className="mt-2"
                  value={programForm.instructor}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, instructor: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="training-duration">Duration (days)</Label>
                <Input
                  id="training-duration"
                  type="number"
                  min="1"
                  className="mt-2"
                  value={programForm.durationDays}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, durationDays: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="training-capacity">Capacity</Label>
                <Input
                  id="training-capacity"
                  type="number"
                  min="1"
                  className="mt-2"
                  value={programForm.capacity}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, capacity: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="training-start">Start Date (optional)</Label>
                <Input
                  id="training-start"
                  type="date"
                  className="mt-2"
                  value={programForm.startDate}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="training-end">End Date (optional)</Label>
                <Input
                  id="training-end"
                  type="date"
                  className="mt-2"
                  value={programForm.endDate}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="training-description">Description</Label>
              <Textarea
                id="training-description"
                className="mt-2"
                rows={3}
                value={programForm.description}
                onChange={(event) => setProgramForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="training-video-url">Video URL (optional)</Label>
                <Input
                  id="training-video-url"
                  className="mt-2"
                  placeholder="https://..."
                  value={programForm.videoUrl}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, videoUrl: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="training-article-url">Article URL (optional)</Label>
                <Input
                  id="training-article-url"
                  className="mt-2"
                  placeholder="https://..."
                  value={programForm.articleUrl}
                  onChange={(event) => setProgramForm((prev) => ({ ...prev, articleUrl: event.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="training-article-content">Article Content (optional)</Label>
              <Textarea
                id="training-article-content"
                className="mt-2"
                rows={4}
                value={programForm.articleContent}
                onChange={(event) => setProgramForm((prev) => ({ ...prev, articleContent: event.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleCreateProgram()}
                disabled={createSubmitting}
              >
                {createSubmitting ? "Creating..." : "Create Program"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(articlePreviewMaterial)}
        onOpenChange={(open) => !open && setArticlePreviewMaterial(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{articlePreviewMaterial?.title ?? "Article Preview"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {articlePreviewMaterial?.external_url && (
              <a
                href={articlePreviewMaterial.external_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#2563EB] hover:underline"
              >
                Open original article
              </a>
            )}
            <div className="max-h-[60vh] overflow-y-auto rounded-md border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-line">
              {articlePreviewMaterial?.article_content || "No article content available."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
