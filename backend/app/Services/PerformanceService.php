<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\HrNotification;
use App\Models\PerformanceReview;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class PerformanceService
{
    public function __construct(
        private readonly PredictiveAnalyticsService $predictiveAnalyticsService,
        private readonly MessagingService $messagingService,
    ) {
    }

    public function getOverview(User $actor, ?string $reviewType = null): array
    {
        $context = $this->resolveContext($actor);

        $query = PerformanceReview::query()
            ->with(['employee.department'])
            ->orderByDesc('period_end')
            ->orderByDesc('id');

        if ($reviewType !== null && $reviewType !== '') {
            $query->where('review_type', $reviewType);
        }

        $this->applyContextScope($query, $context);

        $reviews = $query->get();

        $totalGoals = $reviews->sum('goals_total');
        $completedGoals = $reviews->sum('goals_completed');
        $goalsCompletionRate = $totalGoals > 0
            ? round(($completedGoals / $totalGoals) * 100)
            : 0;

        return [
            'stats' => [
                'average_rating' => round((float) ($reviews->avg('rating') ?? 0), 1),
                'goals_completed_rate' => $goalsCompletionRate,
                'top_performers' => $reviews->where('rating', '>=', 4.5)->count(),
            ],
            'predictive_analytics' => $this->predictiveAnalyticsService->buildEmployeePerformancePredictions(
                $this->resolvePredictiveAnalyticsEmployeeIds($context),
            ),
            'creatable_employees' => $this->buildCreatableEmployees($context),
            'reviews' => $reviews
                ->map(fn (PerformanceReview $review): array => $this->serializeReview($review, $context))
                ->values(),
        ];
    }

    public function createReview(User $actor, array $payload): PerformanceReview
    {
        $employee = Employee::query()
            ->with('department')
            ->findOrFail((int) $payload['employee_id']);

        $context = $this->resolveContext($actor);
        $this->ensureCanCreateReview($employee, $context);

        $questionResponses = $this->normalizeQuestionResponses($payload['question_responses'] ?? null);
        $usesQuestionnaire = count($questionResponses) > 0;

        if ($usesQuestionnaire) {
            $rating = $this->calculateAverageScore($questionResponses);
            $goalsTotal = count($questionResponses);
            $goalsCompleted = collect($questionResponses)
                ->where('score', '>=', 4)
                ->count();
        } else {
            $rating = (float) ($payload['rating'] ?? 0);
            $goalsTotal = (int) ($payload['goals_total'] ?? 0);
            $goalsCompleted = (int) ($payload['goals_completed'] ?? 0);
        }

        $meetsRequirements = $this->checkMeetsRequirements($rating, $goalsTotal, $goalsCompleted);

        $creatorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);
        $initialWorkflowStage = match ($creatorJobTitle) {
            'supervisor' => 'Manager Review',
            'manager' => 'Department Review',
            'department manager' => 'HR Review',
            default => 'Department Review',
        };

        $review = PerformanceReview::query()->create([
            'employee_id' => (int) $payload['employee_id'],
            'reviewer_user_id' => $actor->id,
            'review_type' => $payload['review_type'],
            'period_start' => $payload['period_start'],
            'period_end' => $payload['period_end'],
            'rating' => $rating,
            'goals_total' => $goalsTotal,
            'goals_completed' => $goalsCompleted,
            'question_responses' => $usesQuestionnaire ? $questionResponses : null,
            'meets_requirements' => $meetsRequirements,
            'workflow_stage' => $initialWorkflowStage,
            'review_summary' => $payload['review_summary'] ?? null,
        ]);

        if ($initialWorkflowStage === 'Manager Review') {
            $this->notifyManagerReviewers($review, $actor);
        } elseif ($initialWorkflowStage === 'Department Review') {
            $this->notifyDepartmentReviewers($review, $actor);
        } else {
            $this->notifyHrReviewers($review, $actor);
        }

        return $review;
    }

    public function updateWorkflow(User $actor, PerformanceReview $review, array $payload): PerformanceReview
    {
        $review->loadMissing('employee.department');
        $context = $this->resolveContext($actor);
        $action = (string) ($payload['action'] ?? '');

        $this->applyReviewUpdates($review, $payload);

        if ($action === 'submit_manager_review') {
            if (! $this->canManagerReview($review, $context)) {
                throw new AuthorizationException('You are not authorized to submit manager review.');
            }

            $review->workflow_stage = 'Department Review';
            $review->manager_reviewer_user_id = $actor->id;
            $review->manager_reviewed_at = now();
            $review->save();

            $this->notifyDepartmentReviewers($review, $actor);

            return $review->fresh() ?? $review;
        }

        if ($action === 'submit_department_review') {
            if (! $this->canDepartmentReview($review, $context)) {
                throw new AuthorizationException('You are not authorized to submit department review.');
            }

            $review->workflow_stage = 'HR Review';
            $review->department_reviewer_user_id = $actor->id;
            $review->department_reviewed_at = now();
            $review->save();

            $this->notifyHrReviewers($review, $actor);

            return $review->fresh() ?? $review;
        }

        if ($action === 'submit_hr_review') {
            if (! $this->canHrReview($review, $context)) {
                throw new AuthorizationException('You are not authorized to submit HR review.');
            }

            $review->workflow_stage = 'Finalized';
            $review->hr_reviewer_user_id = $actor->id;
            $review->hr_reviewed_at = now();
            $review->save();

            return $review->fresh() ?? $review;
        }

        throw new AuthorizationException('Unsupported review action.');
    }

    /**
     * @param  array{is_global:bool,managed_department_ids:int[],employee_id:?int}  $context
     */
    private function serializeReview(PerformanceReview $review, array $context): array
    {
        $rating = (float) $review->rating;

        return [
            'id' => $review->id,
            'employee_id' => $review->employee_id,
            'employee' => $review->employee?->name ?? 'Unknown',
            'department' => $review->employee?->department?->name ?? 'N/A',
            'review_type' => $review->review_type,
            'period_start' => $review->period_start?->format('Y-m-d'),
            'period_end' => $review->period_end?->format('Y-m-d'),
            'period_label' => sprintf(
                '%s - %s',
                $review->period_start?->format('M d, Y') ?? '-',
                $review->period_end?->format('M d, Y') ?? '-',
            ),
            'rating' => $rating,
            'goals' => (int) $review->goals_total,
            'completed' => (int) $review->goals_completed,
            'meets_requirements' => (bool) $review->meets_requirements,
            'requirement_status' => (bool) $review->meets_requirements ? 'Meets Requirements' : 'Needs Improvement',
            'status' => $this->resolveStatus($rating),
            'workflow_stage' => (string) ($review->workflow_stage ?: 'Department Review'),
            'can_manager_review' => $this->canManagerReview($review, $context),
            'can_department_review' => $this->canDepartmentReview($review, $context),
            'can_hr_review' => $this->canHrReview($review, $context),
            'question_responses' => $review->question_responses,
            'review_summary' => $review->review_summary,
        ];
    }

    /**
     * @param  mixed  $value
     * @return array<int, array{question:string, score:int, comment:?string}>
     */
    private function normalizeQuestionResponses(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(function ($item): ?array {
                if (! is_array($item)) {
                    return null;
                }

                $question = trim((string) ($item['question'] ?? ''));
                $score = (int) ($item['score'] ?? 0);
                $comment = isset($item['comment']) ? trim((string) $item['comment']) : null;

                if ($question === '' || $score < 1 || $score > 5) {
                    return null;
                }

                return [
                    'question' => $question,
                    'score' => $score,
                    'comment' => $comment !== '' ? $comment : null,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{question:string, score:int, comment:?string}>  $responses
     */
    private function calculateAverageScore(array $responses): float
    {
        if (count($responses) === 0) {
            return 0;
        }

        $sum = collect($responses)->sum('score');

        return round($sum / count($responses), 2);
    }

    private function checkMeetsRequirements(float $rating, int $goalsTotal, int $goalsCompleted): bool
    {
        $completionRate = $goalsTotal > 0 ? ($goalsCompleted / $goalsTotal) : 0;

        return $rating >= 2.5 && $completionRate >= 0.6;
    }

    private function resolveStatus(float $rating): string
    {
        if ($rating >= 0.01 && $rating <= 1.49) {
            return 'Unsatisfactory';
        }

        if ($rating <= 2.49) {
            return 'Needs Improvement';
        }

        if ($rating <= 3.49) {
            return 'Meets Expectations';
        }

        if ($rating <= 4.49) {
            return 'Exceeds Expectations';
        }

        if ($rating >= 4.5 && $rating <= 5.0) {
            return 'Outstanding';
        }

        return $rating > 5 ? 'Outstanding' : 'Unsatisfactory';
    }

    /**
     * @return array{
     *     is_global:bool,
     *     managed_department_ids:int[],
     *     employee_id:?int,
     *     actor_user_id:int,
     *     actor_role:string,
     *     actor_job_title:?string,
     *     actor_department_id:?int,
     *     actor_department_name:?string
     * }
     */
    private function resolveContext(User $actor): array
    {
        $actorEmployee = Employee::query()
            ->with('department')
            ->where('email', $actor->email)
            ->first();

        $actorRole = strtolower(trim((string) $actor->role));
        $actorJobTitle = strtolower(trim((string) $actorEmployee?->job_title));

        $isGlobal = in_array($actorRole, ['admin', 'hr', 'ceo', 'gm', 'general manager'], true)
            || in_array($actorJobTitle, ['ceo', 'chief executive officer', 'gm', 'general manager'], true)
            || in_array(
                strtolower(trim((string) $actorEmployee?->department?->name)),
                ['human resources', 'hr'],
                true,
            );

        $managedDepartmentIds = Department::query()
            ->where('manager_user_id', $actor->id)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        return [
            'is_global' => $isGlobal,
            'managed_department_ids' => $managedDepartmentIds,
            'employee_id' => $actorEmployee?->id ? (int) $actorEmployee->id : null,
            'actor_user_id' => (int) $actor->id,
            'actor_role' => strtolower(trim((string) $actor->role)),
            'actor_job_title' => $actorEmployee?->job_title ? (string) $actorEmployee->job_title : null,
            'actor_department_id' => $actorEmployee?->department_id ? (int) $actorEmployee->department_id : null,
            'actor_department_name' => $actorEmployee?->department?->name ? (string) $actorEmployee->department->name : null,
        ];
    }

    private function resolvePredictiveAnalyticsEmployeeIds(array $context): ?array
    {
        if ($context['is_global']) {
            return null;
        }

        $employeeId = (int) ($context['employee_id'] ?? 0);
        if ($employeeId <= 0) {
            return [];
        }

        return [$employeeId];
    }

    private function applyContextScope($query, array $context): void
    {
        if ($context['is_global']) {
            return;
        }

        if ($context['managed_department_ids'] !== []) {
            $query->whereHas('employee', function ($builder) use ($context): void {
                $builder->whereIn('department_id', $context['managed_department_ids']);
            });

            return;
        }

        $actorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);
        $actorDepartmentId = (int) ($context['actor_department_id'] ?? 0);
        $actorEmployeeId = (int) ($context['employee_id'] ?? 0);

        if ($actorDepartmentId > 0 && in_array($actorJobTitle, ['manager', 'department manager'], true)) {
            $query->whereHas('employee', function ($builder) use ($actorDepartmentId): void {
                $builder->where('department_id', $actorDepartmentId);
            });

            return;
        }

        if ($actorEmployeeId > 0 && $actorJobTitle === 'supervisor') {
            $actorUserId = (int) ($context['actor_user_id'] ?? 0);

            $query->where(function ($builder) use ($actorEmployeeId, $actorUserId): void {
                $builder->where('employee_id', $actorEmployeeId)
                    ->orWhere('reviewer_user_id', $actorUserId)
                    ->orWhereHas('employee', fn ($employeeBuilder) => $employeeBuilder->where('manager_id', $actorEmployeeId));
            });

            return;
        }

        if ($context['employee_id']) {
            $query->where('employee_id', $context['employee_id']);
            return;
        }

        $query->whereRaw('1 = 0');
    }

    private function ensureCanCreateReview(Employee $employee, array $context): void
    {
        $actorEmployeeId = (int) ($context['employee_id'] ?? 0);
        $actorDepartmentId = (int) ($context['actor_department_id'] ?? 0);
        $actorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);

        if (! in_array($actorJobTitle, ['supervisor', 'manager', 'department manager'], true)) {
            throw new AuthorizationException('Only Supervisor, Manager, or Department manager can create performance reviews.');
        }

        if ($actorEmployeeId <= 0) {
            throw new AuthorizationException('No employee profile is linked to this account.');
        }

        if ((int) $employee->id === $actorEmployeeId) {
            throw new AuthorizationException('You cannot create a performance review for yourself.');
        }

        if ($actorJobTitle === 'supervisor') {
            if ($this->normalizeJobTitle((string) $employee->job_title) !== 'coordinator') {
                throw new AuthorizationException('Supervisors can only create reviews for Coordinators.');
            }

            if ((int) ($employee->manager_id ?? 0) !== $actorEmployeeId) {
                throw new AuthorizationException('Supervisors can only create reviews for their direct reports.');
            }

            return;
        }

        $reviewDepartmentId = (int) ($employee->department_id ?? 0);

        if ($reviewDepartmentId > 0 && in_array($reviewDepartmentId, $context['managed_department_ids'], true)) {
            return;
        }

        if ($actorDepartmentId > 0 && $reviewDepartmentId === $actorDepartmentId) {
            return;
        }

        throw new AuthorizationException('You are not authorized to create reviews outside your managed departments.');
    }

    private function buildCreatableEmployees(array $context): array
    {
        $actorEmployeeId = (int) ($context['employee_id'] ?? 0);
        $actorDepartmentId = (int) ($context['actor_department_id'] ?? 0);
        $actorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);

        if (! in_array($actorJobTitle, ['supervisor', 'manager', 'department manager'], true) || $actorEmployeeId <= 0) {
            return [];
        }

        $query = Employee::query()
            ->with('department:id,name')
            ->select(['id', 'name', 'email', 'job_title', 'manager_id', 'department_id'])
            ->where('id', '!=', $actorEmployeeId)
            ->orderBy('name');

        if ($actorJobTitle === 'supervisor') {
            $query
                ->whereRaw('LOWER(job_title) = ?', ['coordinator'])
                ->where('manager_id', $actorEmployeeId);
        } elseif ($context['managed_department_ids'] !== []) {
            $query->whereIn('department_id', $context['managed_department_ids']);
        } elseif ($actorDepartmentId > 0) {
            $query->where('department_id', $actorDepartmentId);
        } else {
            $query->whereRaw('1 = 0');
        }

        return $query
            ->get()
            ->map(fn (Employee $employee): array => [
                'id' => (int) $employee->id,
                'name' => (string) $employee->name,
                'email' => (string) $employee->email,
                'job_title' => (string) $employee->job_title,
                'manager_id' => $employee->manager_id ? (int) $employee->manager_id : null,
                'department' => $employee->department?->name ?? 'N/A',
                'status' => (string) $employee->status,
                'join_date' => $employee->join_date?->format('Y-m-d') ?? '',
            ])
            ->values()
            ->all();
    }

    private function canDepartmentReview(PerformanceReview $review, array $context): bool
    {
        $stage = (string) ($review->workflow_stage ?: 'Department Review');
        if ($stage !== 'Department Review') {
            return false;
        }

        $reviewDepartmentId = (int) ($review->employee?->department_id ?? 0);
        if ($reviewDepartmentId <= 0) {
            return false;
        }

        if (in_array($reviewDepartmentId, $context['managed_department_ids'], true)) {
            return true;
        }

        $actorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);
        $actorDepartmentId = (int) ($context['actor_department_id'] ?? 0);

        return $actorJobTitle === 'department manager'
            && $actorDepartmentId > 0
            && $actorDepartmentId === $reviewDepartmentId;
    }

    private function canManagerReview(PerformanceReview $review, array $context): bool
    {
        $stage = (string) ($review->workflow_stage ?: 'Department Review');
        if ($stage !== 'Manager Review') {
            return false;
        }

        $actorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);
        if ($actorJobTitle !== 'manager') {
            return false;
        }

        $actorDepartmentId = (int) ($context['actor_department_id'] ?? 0);
        $reviewDepartmentId = (int) ($review->employee?->department_id ?? 0);

        if ($actorDepartmentId <= 0 || $reviewDepartmentId <= 0) {
            return false;
        }

        return $actorDepartmentId === $reviewDepartmentId;
    }

    private function canHrReview(PerformanceReview $review, array $context): bool
    {
        $stage = (string) ($review->workflow_stage ?: 'Department Review');
        if ($stage !== 'HR Review') {
            return false;
        }

        $actorRole = (string) ($context['actor_role'] ?? '');
        if ($actorRole === 'admin') {
            return true;
        }

        if ($actorRole === 'hr') {
            $actorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);
            if ($actorJobTitle === '') {
                return true;
            }

            return str_contains($actorJobTitle, 'manager');
        }

        $actorDepartmentName = strtolower(trim((string) ($context['actor_department_name'] ?? '')));
        $actorJobTitle = $this->normalizeJobTitle($context['actor_job_title'] ?? null);

        return in_array($actorDepartmentName, ['human resources', 'hr'], true)
            && str_contains($actorJobTitle, 'manager');
    }

    private function normalizeJobTitle(?string $value): string
    {
        return strtolower(trim((string) ($value ?? '')));
    }

    private function applyReviewUpdates(PerformanceReview $review, array $payload): void
    {
        $questionResponses = $this->normalizeQuestionResponses($payload['question_responses'] ?? null);
        $usesQuestionnaire = count($questionResponses) > 0;

        if ($usesQuestionnaire) {
            $review->question_responses = $questionResponses;
            $review->rating = $this->calculateAverageScore($questionResponses);
            $review->goals_total = count($questionResponses);
            $review->goals_completed = collect($questionResponses)->where('score', '>=', 4)->count();
        } else {
            if (array_key_exists('rating', $payload) && $payload['rating'] !== null) {
                $review->rating = (float) $payload['rating'];
            }

            if (array_key_exists('goals_total', $payload) && $payload['goals_total'] !== null) {
                $review->goals_total = (int) $payload['goals_total'];
            }

            if (array_key_exists('goals_completed', $payload) && $payload['goals_completed'] !== null) {
                $review->goals_completed = (int) $payload['goals_completed'];
            }
        }

        if (array_key_exists('review_summary', $payload)) {
            $review->review_summary = $payload['review_summary'];
        }

        $review->meets_requirements = $this->checkMeetsRequirements(
            (float) $review->rating,
            (int) $review->goals_total,
            (int) $review->goals_completed,
        );

        $review->save();
    }

    private function notifyDepartmentReviewers(PerformanceReview $review, User $actor): void
    {
        $review->loadMissing('employee.department');

        $managerUserIds = Department::query()
            ->where('id', $review->employee?->department_id)
            ->whereNotNull('manager_user_id')
            ->where('manager_user_id', '!=', $actor->id)
            ->pluck('manager_user_id')
            ->map(fn ($id): int => (int) $id)
            ->values();

        if ($managerUserIds->isEmpty()) {
            return;
        }

        $users = User::query()
            ->whereIn('id', $managerUserIds->all())
            ->get(['id', 'name', 'email']);

        $title = sprintf('Performance review needs department review: %s', $review->employee?->name ?? 'Employee');
        $body = sprintf(
            "A performance review was submitted by manager and needs department review.\n\nEmployee: %s\nReview Type: %s\nPeriod: %s to %s",
            $review->employee?->name ?? 'Employee',
            $review->review_type,
            $review->period_start?->format('M d, Y') ?? '-',
            $review->period_end?->format('M d, Y') ?? '-',
        );

        $this->deliverReviewNotifications($users, $title, $body, [
            'scope' => 'performance_department_review',
            'performance_review_id' => $review->id,
        ]);
    }

    private function notifyManagerReviewers(PerformanceReview $review, User $actor): void
    {
        $review->loadMissing('employee.department');

        $departmentId = (int) ($review->employee?->department_id ?? 0);
        if ($departmentId <= 0) {
            return;
        }

        $managerEmails = Employee::query()
            ->where('department_id', $departmentId)
            ->whereRaw('LOWER(job_title) = ?', ['manager'])
            ->pluck('email')
            ->filter(fn ($email): bool => is_string($email) && trim($email) !== '')
            ->map(fn ($email): string => strtolower((string) $email))
            ->unique()
            ->values()
            ->all();

        if ($managerEmails === []) {
            return;
        }

        $users = User::query()
            ->whereIn('email', $managerEmails)
            ->where('id', '!=', $actor->id)
            ->get(['id', 'name', 'email']);

        if ($users->isEmpty()) {
            return;
        }

        $title = sprintf('Performance review needs manager review: %s', $review->employee?->name ?? 'Employee');
        $body = sprintf(
            "A performance review was submitted by supervisor and needs manager review.\n\nEmployee: %s\nReview Type: %s\nPeriod: %s to %s",
            $review->employee?->name ?? 'Employee',
            $review->review_type,
            $review->period_start?->format('M d, Y') ?? '-',
            $review->period_end?->format('M d, Y') ?? '-',
        );

        $this->deliverReviewNotifications($users, $title, $body, [
            'scope' => 'performance_manager_review',
            'performance_review_id' => $review->id,
        ]);
    }

    private function notifyHrReviewers(PerformanceReview $review, User $actor): void
    {
        $users = User::query()
            ->whereIn('role', ['Admin', 'HR'])
            ->where('id', '!=', $actor->id)
            ->get(['id', 'name', 'email']);

        if ($users->isEmpty()) {
            return;
        }

        $title = sprintf('Performance review needs HR final review: %s', $review->employee?->name ?? 'Employee');
        $body = sprintf(
            "Department review was submitted and this performance review needs final HR review.\n\nEmployee: %s\nReview Type: %s\nPeriod: %s to %s",
            $review->employee?->name ?? 'Employee',
            $review->review_type,
            $review->period_start?->format('M d, Y') ?? '-',
            $review->period_end?->format('M d, Y') ?? '-',
        );

        $this->deliverReviewNotifications($users, $title, $body, [
            'scope' => 'performance_hr_review',
            'performance_review_id' => $review->id,
        ]);
    }

    private function deliverReviewNotifications(Collection $users, string $title, string $body, array $context): void
    {
        if ($users->isEmpty()) {
            return;
        }

        $emails = $users->pluck('email')->all();
        $phonesByEmail = Employee::query()
            ->whereIn('email', $emails)
            ->pluck('phone', 'email')
            ->mapWithKeys(fn ($phone, $email): array => [strtolower((string) $email) => $phone])
            ->all();

        $now = now();
        $rows = $users->map(fn (User $user): array => [
            'user_id' => $user->id,
            'title' => $title,
            'body' => $body,
            'type' => 'warning',
            'is_read' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        HrNotification::query()->insert($rows);

        foreach ($users as $user) {
            $phone = $phonesByEmail[strtolower((string) $user->email)] ?? null;

            $this->messagingService->sendPreferred(
                $user->email,
                is_string($phone) ? $phone : null,
                $title,
                $body,
                ['email', 'sms'],
                $context + ['target_user_id' => $user->id],
            );
        }
    }
}
