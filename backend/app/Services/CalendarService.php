<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\RecruitmentCandidate;
use App\Models\TrainingProgram;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class CalendarService
{
    public function __construct(private readonly DepartmentManagerScopeService $managerScopeService)
    {
    }

    public function getEventsForUser(User $user): array
    {
        $actorEmployee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        $isGlobal = $this->managerScopeService->actorIsGlobalApprover($user, $actorEmployee);
        $managedDepartmentIds = $this->managerScopeService->managedDepartmentIdsForUser($user);

        $events = collect()
            ->merge($this->holidayEvents())
            ->merge($this->leaveEvents($actorEmployee, $isGlobal, $managedDepartmentIds))
            ->merge($this->interviewEvents($user, $isGlobal))
            ->merge($this->trainingEvents())
            ->sortBy(fn (array $event): string => (string) ($event['date_iso'] ?? ''))
            ->values();

        return [
            'events' => $events,
            'stats' => [
                'total' => $events->count(),
                'holidays' => $events->where('type', 'holiday')->count(),
                'leave' => $events->where('type', 'leave')->count(),
                'interviews' => $events->where('type', 'interview')->count(),
                'training' => $events->where('type', 'training')->count(),
            ],
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function holidayEvents(): Collection
    {
        return Holiday::query()
            ->orderBy('date')
            ->get()
            ->map(fn (Holiday $holiday): array => [
                'id' => "holiday-{$holiday->id}",
                'type' => 'holiday',
                'title' => $holiday->name,
                'description' => 'Company holiday',
                'date_iso' => $holiday->date?->format('Y-m-d'),
                'date' => $holiday->date?->format('M d, Y'),
                'badge' => 'Holiday',
            ]);
    }

    /**
     * @param  array<int, int>  $managedDepartmentIds
     * @return Collection<int, array<string, mixed>>
     */
    private function leaveEvents(?Employee $actorEmployee, bool $isGlobal, array $managedDepartmentIds): Collection
    {
        $query = LeaveRequest::query()
            ->with('employee:id,name,manager_id,department_id')
            ->whereIn('status', ['Pending', 'Approved'])
            ->orderBy('start_date');

        if (! $isGlobal) {
            if (! $actorEmployee) {
                return collect();
            }

            $query->where(function ($builder) use ($actorEmployee, $managedDepartmentIds): void {
                $builder->where('employee_id', $actorEmployee->id)
                    ->orWhereHas('employee', function ($employeeBuilder) use ($actorEmployee): void {
                        $employeeBuilder->where('manager_id', $actorEmployee->id);
                    });

                if ($managedDepartmentIds !== []) {
                    $builder->orWhereHas('employee', function ($employeeBuilder) use ($managedDepartmentIds): void {
                        $employeeBuilder->whereIn('department_id', $managedDepartmentIds);
                    });
                }
            });
        }

        return $query
            ->limit(300)
            ->get()
            ->map(fn (LeaveRequest $leave): array => [
                'id' => "leave-{$leave->id}",
                'type' => 'leave',
                'title' => sprintf('%s - %s', $leave->employee?->name ?? 'Employee', $leave->type),
                'description' => sprintf(
                    '%s to %s (%s) - %s',
                    $leave->start_date?->format('M d, Y') ?? '-',
                    $leave->end_date?->format('M d, Y') ?? '-',
                    $this->formatLeaveDuration($leave),
                    $leave->status,
                ),
                'date_iso' => $leave->start_date?->format('Y-m-d'),
                'date' => $leave->start_date?->format('M d, Y'),
                'badge' => $leave->status,
            ]);
    }

    private function formatLeaveDuration(LeaveRequest $leave): string
    {
        if ((string) ($leave->request_unit ?: 'day') === 'hour') {
            $hours = (float) ($leave->hours ?? 0);
            $timeRange = $leave->start_time && $leave->end_time
                ? sprintf(
                    ' (%s - %s)',
                    Carbon::parse((string) $leave->start_time)->format('g:i A'),
                    Carbon::parse((string) $leave->end_time)->format('g:i A'),
                )
                : '';

            return rtrim(rtrim(number_format($hours, 2), '0'), '.').' hour'.($hours === 1.0 ? '' : 's').$timeRange;
        }

        $days = (int) $leave->days;

        return $days.' day'.($days === 1 ? '' : 's');
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function interviewEvents(User $user, bool $isGlobal): Collection
    {
        $role = strtolower(trim((string) $user->role));
        $canViewRecruitment = $isGlobal || in_array($role, ['admin', 'hr', 'manager'], true);

        if (! $canViewRecruitment) {
            return collect();
        }

        return RecruitmentCandidate::query()
            ->whereNotNull('interview_at')
            ->orderBy('interview_at')
            ->limit(200)
            ->get()
            ->map(fn (RecruitmentCandidate $candidate): array => [
                'id' => "interview-{$candidate->id}",
                'type' => 'interview',
                'title' => sprintf('Interview - %s', $candidate->name),
                'description' => sprintf(
                    '%s (%s)',
                    $candidate->position ?: 'Candidate',
                    $candidate->current_stage ?: 'Interview',
                ),
                'date_iso' => $candidate->interview_at?->format('Y-m-d'),
                'date' => $candidate->interview_at?->format('M d, Y'),
                'time' => $candidate->interview_at?->format('h:i A'),
                'badge' => 'Interview',
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function trainingEvents(): Collection
    {
        return TrainingProgram::query()
            ->orderBy('start_date')
            ->limit(200)
            ->get()
            ->flatMap(function (TrainingProgram $program): array {
                $events = [];

                if ($program->start_date instanceof Carbon) {
                    $events[] = [
                        'id' => "training-start-{$program->id}",
                        'type' => 'training',
                        'title' => sprintf('Training Start - %s', $program->title),
                        'description' => $program->description,
                        'date_iso' => $program->start_date->format('Y-m-d'),
                        'date' => $program->start_date->format('M d, Y'),
                        'badge' => 'Training',
                    ];
                }

                if ($program->end_date instanceof Carbon) {
                    $events[] = [
                        'id' => "training-end-{$program->id}",
                        'type' => 'training',
                        'title' => sprintf('Training End - %s', $program->title),
                        'description' => $program->description,
                        'date_iso' => $program->end_date->format('Y-m-d'),
                        'date' => $program->end_date->format('M d, Y'),
                        'badge' => 'Training',
                    ];
                }

                return $events;
            })
            ->values();
    }
}
