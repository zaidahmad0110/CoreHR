<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\HrNotification;
use App\Models\TrainingEnrollment;
use App\Models\TrainingMaterial;
use App\Models\TrainingProgram;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TrainingService
{
    public function __construct(private readonly MessagingService $messagingService)
    {
    }

    public function getOverview(User $actor): array
    {
        $employee = $this->resolveActorEmployee($actor);
        $this->syncProgramsAndEnrollments();

        $today = Carbon::today();
        $programs = TrainingProgram::query()
            ->withCount('enrollments')
            ->where(function ($query) use ($today): void {
                $query->whereNull('end_date')
                    ->orWhereDate('end_date', '>=', $today->toDateString());
            })
            ->orderByDesc('created_at')
            ->get();

        $myEnrollmentsQuery = TrainingEnrollment::query()
            ->with('program')
            ->orderByDesc('created_at');

        if ($employee) {
            $myEnrollmentsQuery->where('employee_id', $employee->id);
        } else {
            $myEnrollmentsQuery->whereRaw('1 = 0');
        }

        $myEnrollments = $myEnrollmentsQuery->get();
        $myProgramIds = $myEnrollments->pluck('training_program_id')->all();

        $totalEnrollments = TrainingEnrollment::query()->count();
        $completedEnrollments = TrainingEnrollment::query()
            ->where('status', 'Completed')
            ->count();

        return [
            'stats' => [
                'active_programs' => $programs->where('status', '!=', 'Completed')->count(),
                'total_enrollments' => $totalEnrollments,
                'completion_rate' => $totalEnrollments > 0
                    ? (int) round(($completedEnrollments / $totalEnrollments) * 100)
                    : 0,
            ],
            'programs' => $programs->map(function (TrainingProgram $program) use ($myProgramIds): array {
                $durationDays = $this->resolveDurationDays($program);

                return [
                    'id' => $program->id,
                    'title' => $program->title,
                    'description' => $program->description,
                    'video_url' => $program->video_url,
                    'article_url' => $program->article_url,
                    'article_content' => $program->article_content,
                    'instructor' => $program->instructor,
                    'duration' => $this->formatDuration($durationDays),
                    'duration_weeks' => (int) $program->duration_weeks,
                    'duration_days' => $durationDays,
                    'enrolled' => (int) ($program->enrollments_count ?? 0),
                    'capacity' => (int) $program->capacity,
                    'status' => $program->status,
                    'start_date' => $program->start_date?->format('Y-m-d'),
                    'end_date' => $program->end_date?->format('Y-m-d'),
                    'is_enrolled' => in_array($program->id, $myProgramIds, true),
                ];
            })->values(),
            'my_enrollments' => $myEnrollments->map(fn (TrainingEnrollment $enrollment): array => [
                'id' => $enrollment->id,
                'course' => $enrollment->program?->title ?? 'N/A',
                'progress' => (int) $enrollment->progress_percent,
                'due_date' => $enrollment->due_date?->format('M d, Y'),
                'status' => $enrollment->status,
                'program_id' => $enrollment->training_program_id,
            ])->values(),
        ];
    }

    public function createProgram(User $actor, array $payload): TrainingProgram
    {
        $this->ensureTrainingManagementPermission($actor);

        $durationDays = $this->resolveDurationDaysFromPayload($payload);
        $startDate = isset($payload['start_date']) ? Carbon::parse($payload['start_date'])->startOfDay() : null;
        $endDate = isset($payload['end_date']) ? Carbon::parse($payload['end_date'])->startOfDay() : null;

        if ($startDate && ! $endDate) {
            $endDate = $startDate->copy()->addDays($durationDays - 1);
        }

        $program = TrainingProgram::query()->create([
            'title' => $payload['title'],
            'description' => $payload['description'] ?? null,
            'video_url' => $payload['video_url'] ?? null,
            'article_url' => $payload['article_url'] ?? null,
            'article_content' => $payload['article_content'] ?? null,
            'instructor' => $payload['instructor'],
            'duration_weeks' => (int) max((int) ceil($durationDays / 7), 1),
            'duration_days' => $durationDays,
            'capacity' => (int) $payload['capacity'],
            'status' => 'Upcoming',
            'start_date' => $startDate?->toDateString(),
            'end_date' => $endDate?->toDateString(),
            'created_by_user_id' => $actor->id,
        ]);

        $this->syncProgramAndEnrollments($program->fresh() ?? $program);
        $this->notifyEmployeesAboutNewProgram($program->fresh() ?? $program, $actor);

        return $program;
    }

    public function enroll(User $actor, TrainingProgram $program): TrainingEnrollment
    {
        $employee = $this->resolveActorEmployee($actor);

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee' => ['No employee profile is linked to this account.'],
            ]);
        }

        $this->syncProgramAndEnrollments($program);
        $program->refresh();

        $existing = TrainingEnrollment::query()
            ->where('training_program_id', $program->id)
            ->where('employee_id', $employee->id)
            ->first();

        if ($existing) {
            return $existing;
        }

        if ($program->status === 'Completed') {
            throw ValidationException::withMessages([
                'program' => ['This training program has already ended.'],
            ]);
        }

        $enrolledCount = $program->enrollments()->count();
        if ($enrolledCount >= (int) $program->capacity) {
            throw ValidationException::withMessages([
                'capacity' => ['Program is full.'],
            ]);
        }

        $durationDays = $this->resolveDurationDays($program);
        $dueDate = $program->end_date
            ?? ($program->start_date
                ? $program->start_date->copy()->addDays($durationDays - 1)
                : Carbon::today()->addDays($durationDays));

        return TrainingEnrollment::query()->create([
            'training_program_id' => $program->id,
            'employee_id' => $employee->id,
            'status' => 'In Progress',
            'progress_percent' => 0,
            'due_date' => $dueDate?->toDateString(),
            'enrolled_at' => Carbon::now(),
        ]);
    }

    public function getMaterials(User $actor, ?TrainingProgram $selectedProgram = null): array
    {
        $canManage = $this->canManageTraining($actor);

        $programsQuery = TrainingProgram::query()
            ->select(['id', 'title', 'status'])
            ->orderBy('title');

        if (! $canManage) {
            $employee = $this->resolveActorEmployee($actor);

            if (! $employee) {
                return $this->emptyMaterialsPayload();
            }

            $enrolledProgramIds = TrainingEnrollment::query()
                ->where('employee_id', $employee->id)
                ->pluck('training_program_id')
                ->all();

            if ($enrolledProgramIds === []) {
                return $this->emptyMaterialsPayload();
            }

            $programsQuery->whereIn('id', $enrolledProgramIds);
        }

        if ($selectedProgram && ! $canManage && ! $this->canViewMaterial($actor, $selectedProgram->id)) {
            throw new AuthorizationException('You are not authorized to view materials for this training program.');
        }

        if ($selectedProgram) {
            $programsQuery->where('id', $selectedProgram->id);
        }

        $programs = $programsQuery->get();
        $programIds = $programs->pluck('id')->all();

        $materials = $programIds === []
            ? collect()
            : TrainingMaterial::query()
                ->with([
                    'program:id,title',
                    'uploader:id,name',
                ])
                ->whereIn('training_program_id', $programIds)
                ->orderByDesc('created_at')
                ->get();

        return [
            'programs' => $programs->map(fn (TrainingProgram $program): array => [
                'id' => $program->id,
                'title' => $program->title,
                'status' => $program->status,
            ])->values(),
            'materials' => $materials->map(fn (TrainingMaterial $material): array => [
                'id' => $material->id,
                'training_program_id' => $material->training_program_id,
                'program_title' => $material->program?->title ?? 'N/A',
                'title' => $material->title,
                'material_type' => $material->material_type,
                'description' => $material->description,
                'external_url' => $material->external_url,
                'article_content' => $material->article_content,
                'has_file' => (bool) $material->file_path,
                'file_name' => $material->file_name,
                'uploaded_by' => $material->uploader?->name,
                'uploaded_at' => $material->created_at?->format('M d, Y'),
            ])->values(),
            'stats' => [
                'total_materials' => (int) $materials->count(),
                'documents' => (int) $materials->where('material_type', 'Document')->count(),
                'videos' => (int) $materials->where('material_type', 'Video')->count(),
                'articles' => (int) $materials->where('material_type', 'Article')->count(),
            ],
        ];
    }

    public function createMaterial(User $actor, array $payload, ?UploadedFile $file): TrainingMaterial
    {
        $this->ensureTrainingManagementPermission($actor);

        $filePath = $file?->store('training-materials', 'public');
        $fileName = $file?->getClientOriginalName();

        return TrainingMaterial::query()->create([
            'training_program_id' => (int) $payload['training_program_id'],
            'title' => $payload['title'],
            'material_type' => $payload['material_type'],
            'description' => $payload['description'] ?? null,
            'external_url' => $payload['external_url'] ?? null,
            'article_content' => $payload['article_content'] ?? null,
            'file_path' => $filePath,
            'file_name' => $fileName,
            'uploaded_by_user_id' => $actor->id,
        ]);
    }

    public function streamMaterial(User $actor, TrainingMaterial $material): StreamedResponse
    {
        if (! $this->canViewMaterial($actor, (int) $material->training_program_id)) {
            throw new AuthorizationException('You are not authorized to view this material.');
        }

        if (! $material->file_path) {
            throw ValidationException::withMessages([
                'material' => ['This material does not have an uploaded file.'],
            ]);
        }

        if (! Storage::disk('public')->exists($material->file_path)) {
            abort(404, 'Training material file was not found.');
        }

        return Storage::disk('public')->download(
            $material->file_path,
            $material->file_name ?: basename($material->file_path),
        );
    }

    public function updateMaterial(
        User $actor,
        TrainingMaterial $material,
        array $payload,
        ?UploadedFile $file
    ): TrainingMaterial {
        $this->ensureTrainingManagementPermission($actor);

        $filePath = $material->file_path;
        $fileName = $material->file_name;
        $removeExistingFile = (bool) ($payload['remove_existing_file'] ?? false);

        if ($file) {
            if ($filePath) {
                Storage::disk('public')->delete($filePath);
            }

            $filePath = $file->store('training-materials', 'public');
            $fileName = $file->getClientOriginalName();
        } elseif ($removeExistingFile && $filePath) {
            Storage::disk('public')->delete($filePath);
            $filePath = null;
            $fileName = null;
        }

        $externalUrl = $payload['external_url'] ?? null;
        $articleContent = $payload['article_content'] ?? null;

        if (! $filePath && ! $externalUrl && ! $articleContent) {
            throw ValidationException::withMessages([
                'material' => ['Please provide file, external URL, or article content.'],
            ]);
        }

        $material->update([
            'training_program_id' => (int) $payload['training_program_id'],
            'title' => $payload['title'],
            'material_type' => $payload['material_type'],
            'description' => $payload['description'] ?? null,
            'external_url' => $externalUrl,
            'article_content' => $articleContent,
            'file_path' => $filePath,
            'file_name' => $fileName,
        ]);

        return $material->fresh() ?? $material;
    }

    public function deleteMaterial(User $actor, TrainingMaterial $material): void
    {
        $this->ensureTrainingManagementPermission($actor);

        if ($material->file_path) {
            Storage::disk('public')->delete($material->file_path);
        }

        $material->delete();
    }

    private function syncProgramsAndEnrollments(): void
    {
        TrainingProgram::query()
            ->with('enrollments')
            ->get()
            ->each(function (TrainingProgram $program): void {
                $this->syncProgramAndEnrollments($program);
            });
    }

    private function syncProgramAndEnrollments(TrainingProgram $program): void
    {
        $today = Carbon::today();
        $durationDays = $this->resolveDurationDays($program);
        $startDate = $program->start_date?->copy()->startOfDay();
        $endDate = $program->end_date?->copy()->startOfDay();

        if ($startDate && ! $endDate) {
            $endDate = $startDate->copy()->addDays($durationDays - 1);
        }

        $resolvedStatus = $program->status;
        if ($startDate) {
            if ($today->lt($startDate)) {
                $resolvedStatus = 'Upcoming';
            } elseif ($endDate && $today->gt($endDate)) {
                $resolvedStatus = 'Completed';
            } else {
                $resolvedStatus = 'In Progress';
            }
        }

        $needsUpdate = false;
        $updatePayload = [];

        if ((int) ($program->duration_days ?? 0) !== $durationDays) {
            $updatePayload['duration_days'] = $durationDays;
            $updatePayload['duration_weeks'] = (int) max((int) ceil($durationDays / 7), 1);
            $needsUpdate = true;
        }

        if ($startDate && (! $program->end_date || ! $program->end_date->isSameDay($endDate))) {
            $updatePayload['end_date'] = $endDate?->toDateString();
            $needsUpdate = true;
        }

        if ($resolvedStatus !== $program->status) {
            $updatePayload['status'] = $resolvedStatus;
            $needsUpdate = true;
        }

        if ($needsUpdate) {
            $program->update($updatePayload);
            $program->refresh();
        }

        $program->loadMissing('enrollments');
        foreach ($program->enrollments as $enrollment) {
            $progress = (int) $enrollment->progress_percent;
            $status = $enrollment->status;
            $dueDate = $endDate?->toDateString() ?? $enrollment->due_date?->toDateString();

            if ($resolvedStatus === 'Upcoming') {
                $progress = 0;
                $status = 'In Progress';
            } elseif ($resolvedStatus === 'Completed') {
                $progress = 100;
                $status = 'Completed';
            } elseif ($startDate && $endDate) {
                $totalDays = max($startDate->diffInDays($endDate) + 1, 1);
                $elapsedDays = 0;

                if ($today->greaterThanOrEqualTo($startDate)) {
                    $elapsedDays = min($startDate->diffInDays($today) + 1, $totalDays);
                }

                $progress = (int) round(($elapsedDays / $totalDays) * 100);
                $status = $progress >= 100 ? 'Completed' : 'In Progress';
            }

            $updates = [];
            if ((int) $enrollment->progress_percent !== $progress) {
                $updates['progress_percent'] = $progress;
            }
            if ((string) $enrollment->status !== $status) {
                $updates['status'] = $status;
            }
            if ($dueDate && $enrollment->due_date?->toDateString() !== $dueDate) {
                $updates['due_date'] = $dueDate;
            }

            if ($updates !== []) {
                $enrollment->update($updates);
            }
        }
    }

    private function formatDuration(int $durationDays): string
    {
        return $durationDays === 1 ? '1 day' : "{$durationDays} days";
    }

    private function resolveActorEmployee(User $actor): ?Employee
    {
        return Employee::query()->where('email', $actor->email)->first();
    }

    private function ensureTrainingManagementPermission(User $actor): void
    {
        if ($this->canManageTraining($actor)) {
            return;
        }

        throw new AuthorizationException('You are not authorized to manage training programs.');
    }

    private function canManageTraining(User $actor): bool
    {
        if (strcasecmp((string) $actor->role, 'Admin') === 0) {
            return true;
        }

        $employee = Employee::query()
            ->with('department')
            ->where('email', $actor->email)
            ->first();

        return strcasecmp((string) $employee?->department?->name, 'Human Resources') === 0;
    }

    private function canViewMaterial(User $actor, int $programId): bool
    {
        if ($this->canManageTraining($actor)) {
            return true;
        }

        $employee = $this->resolveActorEmployee($actor);

        if (! $employee) {
            return false;
        }

        return TrainingEnrollment::query()
            ->where('employee_id', $employee->id)
            ->where('training_program_id', $programId)
            ->exists();
    }

    private function notifyEmployeesAboutNewProgram(TrainingProgram $program, User $actor): void
    {
        $employees = Employee::query()
            ->where('status', 'Active')
            ->where('email', '<>', $actor->email)
            ->get(['id', 'name', 'email', 'phone']);

        if ($employees->isEmpty()) {
            return;
        }

        $targetUsers = User::query()
            ->whereIn('email', $employees->pluck('email')->all())
            ->get(['id', 'email']);

        $targetUserIdsByEmail = $targetUsers
            ->mapWithKeys(fn (User $user): array => [strtolower((string) $user->email) => (int) $user->id])
            ->all();

        $title = "New training program: {$program->title}";
        $bodyTemplate = "Dear %s,\n\nA new training program is now available.\n\nProgram: %s\nInstructor: %s\nDuration: %s\nStatus: %s\n\nPlease visit the Training page to review details and enroll.";

        $now = now();
        $notificationRows = [];

        foreach ($employees as $employee) {
            $body = sprintf(
                $bodyTemplate,
                $employee->name,
                $program->title,
                $program->instructor,
                $this->formatDuration($this->resolveDurationDays($program)),
                $program->status,
            );

            $userId = $targetUserIdsByEmail[strtolower((string) $employee->email)] ?? null;
            if (is_int($userId) && $userId > 0) {
                $notificationRows[] = [
                    'user_id' => $userId,
                    'title' => $title,
                    'body' => $body,
                    'type' => 'info',
                    'is_read' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            $this->messagingService->sendPreferred(
                $employee->email,
                $employee->phone,
                $title,
                $body,
                ['email', 'sms'],
                [
                    'scope' => 'training',
                    'training_program_id' => $program->id,
                    'employee_id' => $employee->id,
                ],
            );
        }

        if ($notificationRows !== []) {
            HrNotification::query()->insert($notificationRows);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function resolveDurationDaysFromPayload(array $payload): int
    {
        $durationDays = (int) ($payload['duration_days'] ?? 0);
        if ($durationDays > 0) {
            return $durationDays;
        }

        $durationWeeks = (int) ($payload['duration_weeks'] ?? 1);
        return max($durationWeeks * 7, 1);
    }

    private function resolveDurationDays(TrainingProgram $program): int
    {
        $durationDays = (int) ($program->duration_days ?? 0);
        if ($durationDays > 0) {
            return $durationDays;
        }

        $durationWeeks = (int) ($program->duration_weeks ?? 1);
        return max($durationWeeks * 7, 1);
    }

    private function emptyMaterialsPayload(): array
    {
        return [
            'programs' => [],
            'materials' => [],
            'stats' => [
                'total_materials' => 0,
                'documents' => 0,
                'videos' => 0,
                'articles' => 0,
            ],
        ];
    }
}
