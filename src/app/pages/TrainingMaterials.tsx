import { useMemo, useState } from "react";
import { Plus, FileText, Video, BookOpen, Eye, Pencil, Trash2 } from "lucide-react";
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
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { trainingService } from "../api/services";
import type { TrainingMaterialItem } from "../api/types";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAuth } from "../auth/AuthContext";
import { openBlobInNewTab, openInNewTab } from "../utils/openInNewTab";

type UploadMaterialFormState = {
  trainingProgramId: string;
  title: string;
  materialType: "Document" | "Video" | "Article";
  description: string;
  externalUrl: string;
  articleContent: string;
  file: File | null;
  removeExistingFile: boolean;
};

const defaultUploadMaterialFormState: UploadMaterialFormState = {
  trainingProgramId: "",
  title: "",
  materialType: "Document",
  description: "",
  externalUrl: "",
  articleContent: "",
  file: null,
  removeExistingFile: false,
};

const MAX_TRAINING_MATERIAL_FILE_SIZE_BYTES = 40 * 1024 * 1024;

const normalizeOptionalText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function TrainingMaterials() {
  const { user } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState("all");
  const [uploadForm, setUploadForm] = useState<UploadMaterialFormState>(defaultUploadMaterialFormState);
  const [editingMaterial, setEditingMaterial] = useState<TrainingMaterialItem | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<number | null>(null);
  const [previewArticle, setPreviewArticle] = useState<TrainingMaterialItem | null>(null);
  const [viewingMaterialId, setViewingMaterialId] = useState<number | null>(null);

  const canManageTraining = useMemo(() => {
    if (!user) {
      return false;
    }

    const role = (user.role ?? "").toLowerCase();
    const jobTitle = (user.job_title ?? "").toLowerCase();
    if (["admin", "ceo", "gm", "general manager"].includes(role)) {
      return true;
    }

    if (["ceo", "chief executive officer", "gm", "general manager"].includes(jobTitle)) {
      return true;
    }

    return (user.department ?? "").toLowerCase() === "human resources";
  }, [user]);

  const selectedProgramId =
    programFilter !== "all" && Number.isInteger(Number(programFilter))
      ? Number(programFilter)
      : undefined;

  const { data, loading, error, refetch } = useApiQuery(
    () => trainingService.getTrainingMaterials(selectedProgramId),
    [selectedProgramId],
  );

  const materials = data?.materials ?? [];
  const programs = data?.programs ?? [];
  const stats = data?.stats ?? {
    total_materials: 0,
    documents: 0,
    videos: 0,
    articles: 0,
  };

  const openUploadDialog = () => {
    setDialogMode("create");
    setEditingMaterial(null);
    setUploadForm((prev) => ({
      ...defaultUploadMaterialFormState,
      trainingProgramId: prev.trainingProgramId || (programs[0] ? String(programs[0].id) : ""),
    }));
    setUploadError(null);
    setUploadDialogOpen(true);
  };

  const openEditDialog = (material: TrainingMaterialItem) => {
    setDialogMode("edit");
    setEditingMaterial(material);
    setUploadForm({
      trainingProgramId: String(material.training_program_id),
      title: material.title,
      materialType: material.material_type,
      description: material.description ?? "",
      externalUrl: material.external_url ?? "",
      articleContent: material.article_content ?? "",
      file: null,
      removeExistingFile: false,
    });
    setUploadError(null);
    setUploadDialogOpen(true);
  };

  const handleUploadMaterial = async () => {
    if (!canManageTraining) {
      setUploadError("Only Admin or HR can upload training materials.");
      return;
    }

    if (!uploadForm.trainingProgramId || !uploadForm.title.trim()) {
      setUploadError("Program and title are required.");
      return;
    }

    if (uploadForm.file && uploadForm.file.size > MAX_TRAINING_MATERIAL_FILE_SIZE_BYTES) {
      setUploadError("Selected file is too large. Maximum allowed size is 40 MB.");
      return;
    }

    const hasFile = Boolean(uploadForm.file);
    const hasExistingFileInEdit =
      dialogMode === "edit" && Boolean(editingMaterial?.has_file) && !uploadForm.removeExistingFile;
    const hasExternalUrl = Boolean(normalizeOptionalText(uploadForm.externalUrl));
    const hasArticleContent = Boolean(normalizeOptionalText(uploadForm.articleContent));

    if (!hasFile && !hasExistingFileInEdit && !hasExternalUrl && !hasArticleContent) {
      setUploadError("Provide file upload, external URL, or article content.");
      return;
    }

    if (uploadForm.materialType === "Video" && !hasFile && !hasExistingFileInEdit && !hasExternalUrl) {
      setUploadError("Video material requires an uploaded file or external video URL.");
      return;
    }

    if (uploadForm.materialType === "Document" && !hasFile && !hasExistingFileInEdit && !hasExternalUrl) {
      setUploadError("Document material requires an uploaded file or external URL.");
      return;
    }

    setUploadSubmitting(true);
    setUploadError(null);

    try {
      if (dialogMode === "create") {
        await trainingService.uploadMaterial({
          training_program_id: Number(uploadForm.trainingProgramId),
          title: uploadForm.title.trim(),
          material_type: uploadForm.materialType,
          description: normalizeOptionalText(uploadForm.description),
          external_url: normalizeOptionalText(uploadForm.externalUrl),
          article_content: normalizeOptionalText(uploadForm.articleContent),
          file: uploadForm.file ?? undefined,
        });
      } else {
        if (!editingMaterial) {
          setUploadError("No material selected for editing.");
          return;
        }

        await trainingService.updateMaterial(editingMaterial.id, {
          training_program_id: Number(uploadForm.trainingProgramId),
          title: uploadForm.title.trim(),
          material_type: uploadForm.materialType,
          description: normalizeOptionalText(uploadForm.description),
          external_url: normalizeOptionalText(uploadForm.externalUrl),
          article_content: normalizeOptionalText(uploadForm.articleContent),
          remove_existing_file: uploadForm.removeExistingFile,
          file: uploadForm.file ?? undefined,
        });
      }

      setUploadDialogOpen(false);
      setEditingMaterial(null);
      setUploadForm(defaultUploadMaterialFormState);
      await refetch();
    } catch (err) {
      if (err instanceof Error) {
        setUploadError(err.message);
      } else {
        setUploadError("Failed to upload training material.");
      }
    } finally {
      setUploadSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (material: TrainingMaterialItem) => {
    const shouldDelete = window.confirm(`Delete "${material.title}"? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setDeletingMaterialId(material.id);

    try {
      await trainingService.deleteMaterial(material.id);
      if (editingMaterial?.id === material.id) {
        setUploadDialogOpen(false);
        setEditingMaterial(null);
      }
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete material.";
      window.alert(message);
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const handleViewMaterial = async (material: TrainingMaterialItem) => {
    if (material.has_file) {
      setViewingMaterialId(material.id);
      try {
        const file = await trainingService.viewMaterial(material.id);
        openBlobInNewTab(file.blob);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to open file.";
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
      setPreviewArticle(material);
      return;
    }

    window.alert("No viewable content exists for this material.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Training Materials</h1>
          <p className="text-gray-600 mt-1">Upload and manage training content by program</p>
        </div>
        <Button
          className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
          onClick={openUploadDialog}
          disabled={!canManageTraining}
        >
          <Plus className="w-4 h-4 mr-2" />
          Upload Material
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Materials</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.total_materials}</h3>
              </div>
              <div className="w-12 h-12 bg-[#2563EB] bg-opacity-10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#2563EB]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Documents</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.documents}</h3>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Videos</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.videos}</h3>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Video className="w-6 h-6 text-red-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Articles</p>
                <h3 className="text-2xl font-semibold text-gray-900">{stats.articles}</h3>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-emerald-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Materials Library</CardTitle>
            <div className="w-full md:w-80">
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by training program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={String(program.id)}>
                      {program.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-gray-500">Loading training materials...</div>}
          {!loading && materials.length === 0 && (
            <div className="text-sm text-gray-500">No training materials found for this filter.</div>
          )}

          {!loading && materials.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">{material.title}</div>
                      {material.description && (
                        <div className="text-xs text-gray-600 mt-1 max-w-sm truncate">
                          {material.description}
                        </div>
                      )}
                      {material.file_name && (
                        <div className="text-xs text-gray-500 mt-1">File: {material.file_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-700">{material.program_title}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          material.material_type === "Video"
                            ? "bg-red-100 text-red-700"
                            : material.material_type === "Article"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-700"
                        }
                        variant="secondary"
                      >
                        {material.material_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {material.uploaded_at ?? "N/A"}
                      {material.uploaded_by && (
                        <div className="text-xs text-gray-500 mt-1">{material.uploaded_by}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleViewMaterial(material)}
                          disabled={viewingMaterialId === material.id || deletingMaterialId === material.id}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {viewingMaterialId === material.id ? "Opening..." : "View"}
                        </Button>
                        {canManageTraining && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(material)}
                              disabled={deletingMaterialId === material.id}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => void handleDeleteMaterial(material)}
                              disabled={deletingMaterialId === material.id}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {deletingMaterialId === material.id ? "Deleting..." : "Delete"}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Upload Training Material" : "Edit Training Material"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {uploadError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {uploadError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="material-program">Training Program</Label>
                <Select
                  value={uploadForm.trainingProgramId || undefined}
                  onValueChange={(value) =>
                    setUploadForm((prev) => ({ ...prev, trainingProgramId: value }))
                  }
                >
                  <SelectTrigger id="material-program" className="mt-2">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={String(program.id)}>
                        {program.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="material-type">Material Type</Label>
                <Select
                  value={uploadForm.materialType}
                  onValueChange={(value) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      materialType: value as UploadMaterialFormState["materialType"],
                    }))
                  }
                >
                  <SelectTrigger id="material-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Document">Document</SelectItem>
                    <SelectItem value="Video">Video</SelectItem>
                    <SelectItem value="Article">Article</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="material-title">Title</Label>
                <Input
                  id="material-title"
                  className="mt-2"
                  value={uploadForm.title}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="material-description">Description (optional)</Label>
              <Textarea
                id="material-description"
                className="mt-2"
                rows={2}
                value={uploadForm.description}
                onChange={(event) =>
                  setUploadForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="material-url">External URL (optional)</Label>
              <Input
                id="material-url"
                className="mt-2"
                placeholder="https://..."
                value={uploadForm.externalUrl}
                onChange={(event) =>
                  setUploadForm((prev) => ({ ...prev, externalUrl: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="material-article-content">Article Content (optional)</Label>
              <Textarea
                id="material-article-content"
                className="mt-2"
                rows={4}
                value={uploadForm.articleContent}
                onChange={(event) =>
                  setUploadForm((prev) => ({ ...prev, articleContent: event.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="material-file">File Upload (optional)</Label>
              <Input
                id="material-file"
                type="file"
                className="mt-2"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp4,.mov,.m4v,.avi,.webm"
                onChange={(event) =>
                  setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))
                }
              />
              <p className="text-xs text-gray-500 mt-1">Max file size: 40 MB.</p>
              {dialogMode === "edit" && editingMaterial?.has_file && (
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={uploadForm.removeExistingFile}
                    onChange={(event) =>
                      setUploadForm((prev) => ({ ...prev, removeExistingFile: event.target.checked }))
                    }
                  />
                  Remove existing uploaded file
                </label>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploadSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                onClick={() => void handleUploadMaterial()}
                disabled={uploadSubmitting}
              >
                {uploadSubmitting
                  ? dialogMode === "create" ? "Uploading..." : "Saving..."
                  : dialogMode === "create" ? "Upload" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewArticle)} onOpenChange={(open) => !open && setPreviewArticle(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewArticle?.title ?? "Article Preview"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {previewArticle?.external_url && (
              <a
                href={previewArticle.external_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#2563EB] hover:underline"
              >
                Open original article
              </a>
            )}
            <div className="max-h-[60vh] overflow-y-auto rounded-md border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-line">
              {previewArticle?.article_content || "No article content available."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
