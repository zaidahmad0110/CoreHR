<?php

namespace App\Services;

use App\Models\CandidateCommunication;
use App\Models\Department;
use App\Models\Employee;
use App\Models\JobPosting;
use App\Models\OnboardingTask;
use App\Models\RecruitmentCandidate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RecruitmentService
{
    /**
     * Per-request cache to avoid re-reading the same CV file repeatedly.
     *
     * @var array<int, array{text:string, years_experience:int}>
     */
    private array $cvInsightsCache = [];

    public function __construct(private readonly MessagingService $messagingService)
    {
    }

    public function getOverview(): array
    {
        $jobs = JobPosting::query()
            ->withCount('candidates')
            ->orderByDesc('created_at')
            ->get();

        $candidates = RecruitmentCandidate::query()
            ->with('jobPosting')
            ->orderByDesc('created_at')
            ->get();

        return [
            'stats' => [
                'active_job_postings' => $jobs->where('status', 'Active')->count(),
                'total_applicants' => $jobs->sum('candidates_count'),
                'interviews_scheduled' => $candidates
                    ->where('current_stage', 'Interview')
                    ->whereNotNull('interview_at')
                    ->count(),
            ],
            'jobs' => $jobs->map(fn (JobPosting $job): array => $this->serializeJob($job))->values(),
            'candidates' => $candidates
                ->map(fn (RecruitmentCandidate $candidate): array => $this->serializeCandidate($candidate))
                ->values(),
        ];
    }

    public function getPublicJobListings(): array
    {
        $jobs = JobPosting::query()
            ->where('status', 'Active')
            ->withCount('candidates')
            ->orderByDesc('created_at')
            ->get();

        return [
            'jobs' => $jobs->map(fn (JobPosting $job): array => $this->serializeJob($job))->values(),
        ];
    }

    public function createJobPosting(User $actor, array $payload): JobPosting
    {
        $this->ensureRecruitmentManagementPermission($actor);

        return JobPosting::query()->create([
            'title' => $payload['title'],
            'department' => $payload['department'],
            'location' => $payload['location'] ?? null,
            'employment_type' => $payload['type'],
            'status' => 'Active',
            'description' => $payload['description'] ?? null,
            'requirements' => $payload['requirements'] ?? null,
            'required_skills' => $payload['required_skills'] ?? null,
            'min_experience_years' => (int) ($payload['min_experience_years'] ?? 0),
            'created_by_user_id' => $actor->id,
        ]);
    }

    public function updateJobPosting(User $actor, JobPosting $jobPosting, array $payload): JobPosting
    {
        $this->ensureRecruitmentManagementPermission($actor);

        $jobPosting->update([
            'title' => $payload['title'],
            'department' => $payload['department'],
            'location' => $payload['location'] ?? null,
            'employment_type' => $payload['type'],
            'description' => $payload['description'] ?? null,
            'requirements' => $payload['requirements'] ?? null,
            'required_skills' => $payload['required_skills'] ?? null,
            'min_experience_years' => (int) ($payload['min_experience_years'] ?? 0),
        ]);

        return $jobPosting;
    }

    public function closeJobPosting(User $actor, JobPosting $jobPosting): JobPosting
    {
        $this->ensureRecruitmentManagementPermission($actor);

        $jobPosting->update([
            'status' => 'Closed',
        ]);

        return $jobPosting;
    }

    public function deleteJobPosting(User $actor, JobPosting $jobPosting): void
    {
        $this->ensureRecruitmentManagementPermission($actor);
        $jobPosting->delete();
    }

    public function createManualCandidate(User $actor, array $payload, UploadedFile $cv): RecruitmentCandidate
    {
        $this->ensureRecruitmentManagementPermission($actor);

        $job = JobPosting::query()->findOrFail((int) $payload['job_posting_id']);

        return $this->storeCandidateApplication(
            $job,
            $payload,
            $cv,
            'Manual CV Upload',
            (string) ($payload['stage'] ?? 'Applied'),
        );
    }

    public function createPublicCandidateApplication(JobPosting $jobPosting, array $payload, UploadedFile $cv): RecruitmentCandidate
    {
        $this->ensurePublicJobIsAvailable($jobPosting);

        return $this->storeCandidateApplication(
            $jobPosting,
            $payload,
            $cv,
            'Public Careers Page',
            'Applied',
        );
    }

    public function getJobDetails(JobPosting $jobPosting): array
    {
        $jobPosting->load(['candidates', 'communications']);

        $rankedCandidates = $this->rankCandidatesForJob($jobPosting)
            ->map(fn (array $item): array => [
                ...$this->serializeCandidate($item['candidate']),
                'ats_score' => $item['score'],
                'ats_reason' => $item['reason'],
            ])
            ->values();

        return [
            'job' => $this->serializeJob($jobPosting),
            'ranked_candidates' => $rankedCandidates,
            'communications' => $jobPosting->communications()
                ->latest()
                ->limit(50)
                ->get()
                ->map(fn (CandidateCommunication $communication): array => [
                    'id' => $communication->id,
                    'channel' => $communication->channel,
                    'message_type' => $communication->message_type,
                    'subject' => $communication->subject,
                    'delivery_status' => $communication->delivery_status,
                    'sent_at' => $communication->sent_at?->format('M d, Y h:i A'),
                ])->values(),
        ];
    }

    public function selectBestCandidate(User $actor, JobPosting $jobPosting): ?array
    {
        $this->ensureRecruitmentManagementPermission($actor);

        $best = $this->rankCandidatesForJob($jobPosting)->first();

        if (! $best) {
            return null;
        }

        /** @var RecruitmentCandidate $candidate */
        $candidate = $best['candidate'];

        $candidate->update([
            'job_posting_id' => $jobPosting->id,
            'selected_for_next_step' => true,
            'current_stage' => 'Screening',
        ]);

        return [
            ...$this->serializeCandidate($candidate->fresh()),
            'ats_score' => $best['score'],
            'ats_reason' => $best['reason'],
        ];
    }

    public function scheduleInterview(User $actor, RecruitmentCandidate $candidate, array $payload): array
    {
        $this->ensureRecruitmentManagementPermission($actor);

        $jobPosting = JobPosting::query()->findOrFail((int) $payload['job_posting_id']);
        $interviewAt = Carbon::parse($payload['interview_at']);
        $channels = collect($payload['channels'] ?? [])->values()->all();
        $selectedChannel = $this->selectPreferredChannel($channels);
        $notifySelected = (bool) ($payload['notify_selected'] ?? true);
        $customMessage = trim((string) ($payload['custom_message'] ?? ''));

        $candidate->update([
            'job_posting_id' => $jobPosting->id,
            'selected_for_next_step' => true,
            'current_stage' => 'Interview',
            'interview_at' => $interviewAt,
        ]);

        $communications = collect();

        if ($notifySelected) {
            $communications->push($this->dispatchCommunication(
                $candidate,
                $jobPosting,
                $selectedChannel,
                'selected',
                "You have been selected for the next step - {$jobPosting->title}",
                $customMessage !== ''
                    ? $customMessage
                    : "Dear {$candidate->name},\n\nCongratulations! Your application for {$jobPosting->title} has been shortlisted for the next step.\n\nOur team will contact you with more details shortly.",
            ));
        }

        $communications->push($this->dispatchCommunication(
            $candidate,
            $jobPosting,
            $selectedChannel,
            'interview_invite',
            "Interview schedule - {$jobPosting->title}",
            "Dear {$candidate->name},\n\nYou are invited to interview for the {$jobPosting->title} role.\n\nInterview Date & Time: {$interviewAt->format('F d, Y h:i A')}\nPosition: {$jobPosting->title}\nDepartment: {$jobPosting->department}\n\nPlease reply to confirm your availability.",
            $interviewAt,
        ));

        return [
            'candidate' => $this->serializeCandidate($candidate->fresh()),
            'communications' => $communications->map(fn (CandidateCommunication $communication): array => [
                'id' => $communication->id,
                'channel' => $communication->channel,
                'message_type' => $communication->message_type,
                'delivery_status' => $communication->delivery_status,
                'sent_at' => $communication->sent_at?->format('M d, Y h:i A'),
            ])->values(),
        ];
    }

    public function deleteCandidate(User $actor, RecruitmentCandidate $candidate): void
    {
        $this->ensureRecruitmentManagementPermission($actor);

        if ($candidate->cv_path && Storage::disk('public')->exists($candidate->cv_path)) {
            Storage::disk('public')->delete($candidate->cv_path);
        }

        $candidate->delete();
    }

    public function processCandidateDecision(
        User $actor,
        RecruitmentCandidate $candidate,
        array $payload,
        ?UploadedFile $offerAttachment = null,
    ): array
    {
        $this->ensureRecruitmentManagementPermission($actor);

        $jobPosting = JobPosting::query()->findOrFail((int) $payload['job_posting_id']);
        $decision = (string) $payload['decision'];
        $channels = collect($payload['channels'] ?? [])->map(fn ($channel): string => (string) $channel)->values()->all();
        $notifyCandidate = (bool) ($payload['notify_candidate'] ?? true);
        $customMessage = trim((string) ($payload['custom_message'] ?? ''));

        if (empty($channels)) {
            $channels = ['email'];
        }

        $selectedChannel = $this->selectPreferredChannel($channels);
        $offerAttachments = [];

        if ($decision === 'offer' && $offerAttachment instanceof UploadedFile) {
            $storedPath = $offerAttachment->store('recruitment-offers', 'public');
            $offerAttachments[] = [
                'path' => Storage::disk('public')->path($storedPath),
                'name' => $offerAttachment->getClientOriginalName() ?: basename($storedPath),
                'mime' => $offerAttachment->getClientMimeType(),
            ];
        }

        if ($decision === 'offer') {
            $candidate->update([
                'job_posting_id' => $jobPosting->id,
                'selected_for_next_step' => true,
                'current_stage' => 'Offer',
                'status' => 'Active',
            ]);
        } elseif ($decision === 'not_selected') {
            $candidate->update([
                'job_posting_id' => $jobPosting->id,
                'selected_for_next_step' => false,
                'current_stage' => 'Not Selected',
                'status' => 'Not Selected',
            ]);
        } elseif ($decision === 'accepted') {
            $candidate->update([
                'job_posting_id' => $jobPosting->id,
                'selected_for_next_step' => true,
                'current_stage' => 'Accepted',
                'status' => 'Accepted',
            ]);

            $this->ensureEmployeeProfileForAcceptedCandidate($candidate, $jobPosting);
        } else {
            $candidate->update([
                'job_posting_id' => $jobPosting->id,
                'selected_for_next_step' => false,
                'current_stage' => 'Rejected',
                'status' => 'Rejected',
            ]);
        }

        $communications = collect();

        if ($notifyCandidate) {
            if ($decision === 'offer') {
                $communications->push($this->dispatchCommunication(
                    $candidate,
                    $jobPosting,
                    $selectedChannel,
                    'job_offer',
                    "Job offer - {$jobPosting->title}",
                    $customMessage !== ''
                        ? $customMessage
                        : "Dear {$candidate->name},\n\nWe are pleased to offer you the {$jobPosting->title} position.\n\nPlease review the offer details and respond with your decision.",
                    null,
                    $offerAttachments,
                ));
            } elseif ($decision === 'not_selected') {
                $communications->push($this->dispatchCommunication(
                    $candidate,
                    $jobPosting,
                    $selectedChannel,
                    'not_selected',
                    "Application update - {$jobPosting->title}",
                    $customMessage !== ''
                        ? $customMessage
                        : "Dear {$candidate->name},\n\nThank you for your interest in the {$jobPosting->title} role.\nAfter careful review, we will not move forward with your application at this stage.\n\nWe appreciate your time and wish you success.",
                ));
            } elseif ($decision === 'accepted') {
                $communications->push($this->dispatchCommunication(
                    $candidate,
                    $jobPosting,
                    $selectedChannel,
                    'offer_accepted',
                    "Offer accepted - {$jobPosting->title}",
                    $customMessage !== ''
                        ? $customMessage
                        : "Dear {$candidate->name},\n\nThank you for accepting the offer for {$jobPosting->title}.\nYour acceptance has been recorded and our HR team will contact you with onboarding details.",
                ));
            } else {
                $communications->push($this->dispatchCommunication(
                    $candidate,
                    $jobPosting,
                    $selectedChannel,
                    'offer_rejected',
                    "Offer rejected - {$jobPosting->title}",
                    $customMessage !== ''
                        ? $customMessage
                        : "Dear {$candidate->name},\n\nYour decision to decline the offer for {$jobPosting->title} has been recorded.\nThank you for your time throughout the process.",
                ));
            }
        }

        return [
            'candidate' => $this->serializeCandidate($candidate->fresh()),
            'communications' => $communications->map(fn (CandidateCommunication $communication): array => [
                'id' => $communication->id,
                'channel' => $communication->channel,
                'message_type' => $communication->message_type,
                'delivery_status' => $communication->delivery_status,
                'sent_at' => $communication->sent_at?->format('M d, Y h:i A'),
            ])->values(),
        ];
    }

    private function ensureEmployeeProfileForAcceptedCandidate(
        RecruitmentCandidate $candidate,
        JobPosting $jobPosting
    ): Employee {
        $email = trim((string) ($candidate->email ?? ''));
        $employee = null;

        if ($email !== '') {
            $employee = Employee::query()->where('email', $email)->first();
        }

        if ($employee) {
            if ((string) $employee->status !== 'Active' || ! (bool) $employee->is_new_hire) {
                $employee->update([
                    'status' => 'Active',
                    'is_new_hire' => true,
                ]);
            }

            $this->ensureDefaultOnboardingTasks($employee);

            return $employee;
        }

        $departmentId = null;
        $departmentName = trim((string) ($jobPosting->department ?? ''));
        if ($departmentName !== '') {
            $departmentId = Department::query()->firstOrCreate(
                ['name' => $departmentName],
                ['manager_name' => null],
            )->id;
        }

        $employeeEmail = $email !== '' ? $email : $this->generateCandidateFallbackEmail($candidate);

        $employee = Employee::query()->create([
            'department_id' => $departmentId,
            'branch_id' => null,
            'manager_id' => null,
            'employee_code' => $this->generateEmployeeCode(),
            'name' => $candidate->name,
            'email' => $employeeEmail,
            'phone' => $candidate->phone,
            'job_title' => $candidate->position ?: $jobPosting->title,
            'location' => $jobPosting->location,
            'join_date' => Carbon::today()->toDateString(),
            'status' => 'Active',
            'is_new_hire' => true,
            'base_salary' => 0,
            'allowances' => 0,
            'deductions' => 0,
        ]);

        $this->ensureDefaultOnboardingTasks($employee);

        return $employee;
    }

    private function generateCandidateFallbackEmail(RecruitmentCandidate $candidate): string
    {
        $fallback = sprintf('candidate.%d@corehr.local', $candidate->id);

        if (! Employee::query()->where('email', $fallback)->exists()) {
            return $fallback;
        }

        do {
            $fallback = sprintf('candidate.%d.%d@corehr.local', $candidate->id, random_int(100, 999));
        } while (Employee::query()->where('email', $fallback)->exists());

        return $fallback;
    }

    private function generateEmployeeCode(): string
    {
        do {
            $code = sprintf(
                'EMP-%s-%04d',
                Carbon::now()->format('Y'),
                random_int(1, 9999),
            );
        } while (Employee::query()->where('employee_code', $code)->exists());

        return $code;
    }

    private function ensureDefaultOnboardingTasks(Employee $employee): void
    {
        $defaults = [
            ['title' => 'Complete personal information', 'description' => 'Verify profile and contact details.'],
            ['title' => 'Submit required documents', 'description' => 'Upload ID, contract, and mandatory files.'],
            ['title' => 'Review company policies', 'description' => 'Acknowledge handbook and compliance policies.'],
            ['title' => 'Meet manager and team', 'description' => 'Initial orientation and expectations alignment.'],
            ['title' => 'Set first 30-day goals', 'description' => 'Define probation objectives with your manager.'],
        ];

        if ($employee->onboardingTasks()->exists()) {
            return;
        }

        foreach ($defaults as $index => $task) {
            OnboardingTask::query()->create([
                'employee_id' => $employee->id,
                'title' => $task['title'],
                'description' => $task['description'],
                'is_completed' => false,
                'completed_at' => null,
                'sort_order' => $index + 1,
            ]);
        }
    }

    public function streamCandidateCv(RecruitmentCandidate $candidate): StreamedResponse
    {
        if (! $candidate->cv_path || ! Storage::disk('public')->exists($candidate->cv_path)) {
            abort(404, 'CV file not found.');
        }

        $fileName = $candidate->cv_original_name ?: basename($candidate->cv_path);
        $mimeType = Storage::disk('public')->mimeType($candidate->cv_path) ?: 'application/octet-stream';

        return Storage::disk('public')->response(
            $candidate->cv_path,
            $fileName,
            [
                'Content-Type' => $mimeType,
                'Cache-Control' => 'private, max-age=0, must-revalidate',
            ],
            'inline',
        );
    }

    private function serializeJob(JobPosting $job): array
    {
        return [
            'id' => $job->id,
            'title' => $job->title,
            'department' => $job->department,
            'location' => $job->location,
            'type' => $job->employment_type,
            'status' => $job->status,
            'applicants' => $job->candidates_count ?? $job->candidates()->count(),
            'posted' => $job->created_at?->format('M d, Y'),
            'description' => $job->description,
            'requirements' => $job->requirements,
            'required_skills' => $job->required_skills,
            'min_experience_years' => $job->min_experience_years,
        ];
    }

    private function serializeCandidate(RecruitmentCandidate $candidate): array
    {
        return [
            'id' => $candidate->id,
            'name' => $candidate->name,
            'position' => $candidate->position ?? ($candidate->jobPosting?->title ?? 'N/A'),
            'stage' => $candidate->current_stage,
            'email' => $candidate->email,
            'phone' => $candidate->phone,
            'skills' => $candidate->skills,
            'years_experience' => $candidate->years_experience,
            'selected_for_next_step' => (bool) $candidate->selected_for_next_step,
            'interview_at' => $candidate->interview_at?->format('M d, Y h:i A'),
            'interview_at_iso' => $candidate->interview_at?->toIso8601String(),
            'job_posting_id' => $candidate->job_posting_id,
            'cv_file_name' => $candidate->cv_original_name,
            'cv_url' => $candidate->cv_path ? "/api/recruitment/candidates/{$candidate->id}/cv" : null,
        ];
    }

    private function rankCandidatesForJob(JobPosting $jobPosting): Collection
    {
        $requiredSkills = $this->resolveTargetSkills($jobPosting);
        $jobTitleTokens = $this->normalizeRoleTokens($jobPosting->title);
        $minExperience = max((int) $jobPosting->min_experience_years, 0);

        $candidates = RecruitmentCandidate::query()
            ->where(function ($query) use ($jobPosting): void {
                $query->where('job_posting_id', $jobPosting->id)
                    ->orWhereNull('job_posting_id');
            })
            ->where('status', 'Active')
            ->get();

        return $candidates
            ->map(function (RecruitmentCandidate $candidate) use ($requiredSkills, $jobTitleTokens, $minExperience): array {
                $cvInsights = $this->extractCandidateCvInsights($candidate);
                $cvText = $cvInsights['text'];
                $candidateSkills = $this->normalizeSkills((string) ($candidate->skills ?? ''));
                $matchedSkillsCount = $this->calculateRequiredSkillMatches($requiredSkills, $candidateSkills, $cvText);

                $skillsScore = empty($requiredSkills)
                    ? 30
                    : ($matchedSkillsCount / count($requiredSkills)) * 60;

                $inferredExperienceYears = max((int) $candidate->years_experience, $cvInsights['years_experience']);
                $experienceScore = $this->calculateExperienceScore($inferredExperienceYears, $minExperience);

                $positionTokens = $this->normalizeRoleTokens((string) ($candidate->position ?? ''));
                $candidateRoleMatchCount = count(array_intersect($jobTitleTokens, $positionTokens));
                $candidateRoleScore = empty($jobTitleTokens)
                    ? 0
                    : ($candidateRoleMatchCount / count($jobTitleTokens)) * 10;

                $cvRoleMatchCount = $this->countTokenMatchesInText($jobTitleTokens, $cvText);
                $cvRoleScore = empty($jobTitleTokens)
                    ? 0
                    : ($cvRoleMatchCount / count($jobTitleTokens)) * 10;

                $positionScore = max($candidateRoleScore, $cvRoleScore);

                $score = round($skillsScore + $experienceScore + $positionScore, 1);
                $reason = sprintf(
                    'Skills %.1f, Experience %.1f, Role Match %.1f%s',
                    round($skillsScore, 1),
                    round($experienceScore, 1),
                    round($positionScore, 1),
                    $cvText !== '' ? ' (CV analyzed)' : '',
                );

                return [
                    'candidate' => $candidate,
                    'score' => $score,
                    'reason' => $reason,
                ];
            })
            ->sortByDesc('score')
            ->values();
    }

    private function normalizeSkills(string $skills): array
    {
        $normalized = collect(preg_split('/[,;\n]+/', strtolower($skills)) ?: [])
            ->map(fn (string $item): string => trim($item))
            ->filter(fn (string $item): bool => $item !== '')
            ->unique()
            ->values()
            ->all();

        return $normalized;
    }

    private function normalizeRoleTokens(string $value): array
    {
        $stopWords = ['and', 'of', 'for', 'the', 'a', 'an', 'to', 'in'];

        return collect(preg_split('/[^a-z0-9+#.]+/i', strtolower($value)) ?: [])
            ->map(fn (string $item): string => trim($item))
            ->filter(fn (string $item): bool => $item !== '' && strlen($item) > 1)
            ->reject(fn (string $item): bool => in_array($item, $stopWords, true))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function resolveTargetSkills(JobPosting $jobPosting): array
    {
        $fromJob = collect($this->normalizeSkills((string) ($jobPosting->required_skills ?? '')))
            ->reject(fn (string $skill): bool => $this->isPlaceholderText($skill))
            ->values()
            ->all();

        if (count($fromJob) >= 2) {
            return $fromJob;
        }

        $jobContext = strtolower(implode(' ', array_filter([
            $jobPosting->title,
            $jobPosting->department,
            (string) $jobPosting->requirements,
            (string) $jobPosting->description,
        ])));

        $fallbackSkills = $this->inferRoleSkills($jobContext);

        return array_values(array_unique(array_filter($fallbackSkills, fn (string $skill): bool => $skill !== '')));
    }

    private function isPlaceholderText(string $value): bool
    {
        $normalized = strtolower(trim($value));
        $placeholders = ['test', 'n/a', 'na', 'none', 'sample', 'tbd', 'todo', '-'];

        return $normalized === '' || in_array($normalized, $placeholders, true);
    }

    /**
     * @return array<int, string>
     */
    private function inferRoleSkills(string $jobContext): array
    {
        $roleSkillsMap = [
            'hr' => [
                'recruitment',
                'talent acquisition',
                'employee relations',
                'onboarding',
                'payroll',
                'hr policies',
                'performance management',
                'labor law',
                'compliance',
                'hris',
            ],
            'engineering' => [
                'php',
                'laravel',
                'react',
                'typescript',
                'mysql',
                'api',
                'git',
                'testing',
                'docker',
                'ci/cd',
            ],
            'product' => [
                'product strategy',
                'analytics',
                'stakeholder management',
                'roadmapping',
                'agile',
                'user research',
                'communication',
                'kpi',
            ],
            'design' => [
                'figma',
                'ux research',
                'prototyping',
                'design systems',
                'wireframing',
                'usability testing',
            ],
            'sales' => [
                'lead generation',
                'crm',
                'negotiation',
                'pipeline management',
                'client relationship',
            ],
            'finance' => [
                'financial reporting',
                'budgeting',
                'accounting',
                'excel',
                'compliance',
            ],
        ];

        $family = 'engineering';

        if (preg_match('/\b(hr|human resources|talent|recruitment|people ops)\b/i', $jobContext) === 1) {
            $family = 'hr';
        } elseif (preg_match('/\b(product|roadmap|product manager)\b/i', $jobContext) === 1) {
            $family = 'product';
        } elseif (preg_match('/\b(ux|ui|design|figma)\b/i', $jobContext) === 1) {
            $family = 'design';
        } elseif (preg_match('/\b(sales|account executive|business development)\b/i', $jobContext) === 1) {
            $family = 'sales';
        } elseif (preg_match('/\b(finance|accounting|financial)\b/i', $jobContext) === 1) {
            $family = 'finance';
        }

        $skills = $roleSkillsMap[$family];
        $knownTerms = array_values(array_unique(array_merge(...array_values($roleSkillsMap))));

        foreach ($knownTerms as $term) {
            if (str_contains($jobContext, strtolower($term))) {
                $skills[] = $term;
            }
        }

        return array_values(array_unique($skills));
    }

    private function calculateExperienceScore(int $yearsExperience, int $minExperience): float
    {
        if ($minExperience <= 0) {
            return min(30, $yearsExperience * 3);
        }

        $capYears = max($minExperience + 3, (int) ceil($minExperience * 1.5));
        if ($capYears <= 0) {
            return 0;
        }

        return min(30, ($yearsExperience / $capYears) * 30);
    }

    /**
     * @param  array<int, string>  $requiredSkills
     * @param  array<int, string>  $candidateSkills
     */
    private function calculateRequiredSkillMatches(array $requiredSkills, array $candidateSkills, string $cvText): int
    {
        if (empty($requiredSkills)) {
            return 0;
        }

        $matches = 0;

        foreach ($requiredSkills as $requiredSkill) {
            $requiredTokens = $this->normalizeRoleTokens($requiredSkill);
            if (empty($requiredTokens)) {
                continue;
            }

            $matchedByCandidateField = collect($candidateSkills)->contains(function (string $candidateSkill) use ($requiredTokens): bool {
                $candidateTokens = $this->normalizeRoleTokens($candidateSkill);
                if (empty($candidateTokens)) {
                    return false;
                }

                $intersection = count(array_intersect($requiredTokens, $candidateTokens));

                return $intersection >= max(1, (int) ceil(count($requiredTokens) * 0.6));
            });

            $matchedByCvText = $this->tokensPresentInText($requiredTokens, $cvText) >= max(1, (int) ceil(count($requiredTokens) * 0.6));

            if ($matchedByCandidateField || $matchedByCvText) {
                $matches++;
            }
        }

        return $matches;
    }

    /**
     * @param  array<int, string>  $tokens
     */
    private function tokensPresentInText(array $tokens, string $text): int
    {
        if ($text === '' || empty($tokens)) {
            return 0;
        }

        $count = 0;
        foreach ($tokens as $token) {
            if ($this->textContainsToken($text, $token)) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @return array{text:string, years_experience:int}
     */
    private function extractCandidateCvInsights(RecruitmentCandidate $candidate): array
    {
        if (isset($this->cvInsightsCache[$candidate->id])) {
            return $this->cvInsightsCache[$candidate->id];
        }

        if (! $candidate->cv_path || ! Storage::disk('public')->exists($candidate->cv_path)) {
            return $this->cvInsightsCache[$candidate->id] = [
                'text' => '',
                'years_experience' => 0,
            ];
        }

        $absolutePath = Storage::disk('public')->path($candidate->cv_path);
        $extension = strtolower(pathinfo($candidate->cv_original_name ?: $candidate->cv_path, PATHINFO_EXTENSION));
        $text = match ($extension) {
            'pdf' => $this->extractTextFromPdf($absolutePath),
            'docx' => $this->extractTextFromDocx($absolutePath),
            'txt' => $this->extractTextFromPlainFile($absolutePath),
            'doc' => $this->extractTextFromBinaryFile($absolutePath),
            'jpg', 'jpeg', 'png', 'webp' => $this->extractTextFromImageUsingOcr($absolutePath),
            default => $this->extractTextFromBinaryFile($absolutePath),
        };

        $normalized = $this->sanitizeExtractedText($text);

        return $this->cvInsightsCache[$candidate->id] = [
            'text' => strtolower($normalized),
            'years_experience' => $this->extractYearsExperienceFromText($normalized),
        ];
    }

    private function extractTextFromPlainFile(string $absolutePath): string
    {
        $text = @file_get_contents($absolutePath);

        return is_string($text) ? $text : '';
    }

    private function extractTextFromBinaryFile(string $absolutePath): string
    {
        $content = @file_get_contents($absolutePath);
        if (! is_string($content)) {
            return '';
        }

        if (preg_match_all('/[A-Za-z][A-Za-z0-9+#.\\-\\/,& ]{2,}/', $content, $matches)) {
            return implode(' ', $matches[0]);
        }

        return '';
    }

    private function extractTextFromDocx(string $absolutePath): string
    {
        if (! class_exists(\ZipArchive::class)) {
            return '';
        }

        $zip = new \ZipArchive();
        if ($zip->open($absolutePath) !== true) {
            return '';
        }

        $xml = $zip->getFromName('word/document.xml') ?: '';
        $zip->close();

        if ($xml === '') {
            return '';
        }

        $xml = str_replace(['</w:p>', '</w:tr>'], ["\n", "\n"], $xml);

        return strip_tags($xml);
    }

    private function extractTextFromPdf(string $absolutePath): string
    {
        $content = @file_get_contents($absolutePath);
        if (! is_string($content)) {
            return '';
        }

        $chunks = [];
        if (preg_match_all('/stream(.*?)endstream/s', $content, $streams)) {
            foreach ($streams[1] as $stream) {
                $decoded = $this->decodePdfStream((string) $stream);
                $chunks[] = $this->extractPrintableTextFromPdfChunk($decoded);
            }
        }

        $chunks[] = $this->extractPrintableTextFromPdfChunk($content);

        return implode(' ', array_filter($chunks));
    }

    private function decodePdfStream(string $stream): string
    {
        $stream = ltrim($stream, "\r\n");
        $decoded = @gzuncompress($stream);

        if ($decoded === false) {
            $decoded = @gzinflate($stream);
        }

        if ($decoded === false && strlen($stream) > 2) {
            $decoded = @gzinflate(substr($stream, 2));
        }

        return is_string($decoded) ? $decoded : $stream;
    }

    private function extractPrintableTextFromPdfChunk(string $chunk): string
    {
        $tokens = [];

        if (preg_match_all('/\(([^()]*)\)\s*Tj/s', $chunk, $singleMatches)) {
            foreach ($singleMatches[1] as $value) {
                $tokens[] = $this->decodePdfTextToken((string) $value);
            }
        }

        if (preg_match_all('/\[(.*?)\]\s*TJ/s', $chunk, $arrayMatches)) {
            foreach ($arrayMatches[1] as $arrayValue) {
                if (preg_match_all('/\(([^()]*)\)/s', (string) $arrayValue, $inlineValues)) {
                    foreach ($inlineValues[1] as $value) {
                        $tokens[] = $this->decodePdfTextToken((string) $value);
                    }
                }
            }
        }

        if (preg_match_all('/[A-Za-z][A-Za-z0-9+#.\\-\\/,& ]{2,}/', $chunk, $rawTextMatches)) {
            $tokens = [...$tokens, ...$rawTextMatches[0]];
        }

        return implode(' ', $tokens);
    }

    private function extractTextFromImageUsingOcr(string $absolutePath): string
    {
        if (! is_file($absolutePath)) {
            return '';
        }

        if (! $this->commandExists('tesseract')) {
            return '';
        }

        $stderrRedirect = PHP_OS_FAMILY === 'Windows' ? '2>NUL' : '2>/dev/null';
        $command = sprintf(
            'tesseract %s stdout -l eng %s',
            escapeshellarg($absolutePath),
            $stderrRedirect,
        );

        $output = shell_exec($command);

        return is_string($output) ? $output : '';
    }

    private function commandExists(string $command): bool
    {
        $probe = PHP_OS_FAMILY === 'Windows'
            ? sprintf('where %s 2>NUL', $command)
            : sprintf('command -v %s 2>/dev/null', $command);

        $result = shell_exec($probe);

        return is_string($result) && trim($result) !== '';
    }

    private function decodePdfTextToken(string $value): string
    {
        $decoded = str_replace(['\\(', '\\)', '\\\\'], ['(', ')', '\\'], $value);

        return preg_replace_callback(
            '/\\\\([0-7]{3})/',
            static fn (array $matches): string => chr(octdec($matches[1])),
            $decoded,
        ) ?? $decoded;
    }

    private function sanitizeExtractedText(string $text): string
    {
        $text = str_replace("\0", ' ', $text);
        $text = preg_replace('/[^\x09\x0A\x0D\x20-\x7E]/', ' ', $text) ?? $text;
        $text = preg_replace_callback(
            '/\b(?:[a-z]{1,2}\s+){3,}[a-z]{1,2}\b/i',
            static fn (array $matches): string => str_replace(' ', '', $matches[0]),
            $text,
        ) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }

    private function extractYearsExperienceFromText(string $text): int
    {
        if ($text === '') {
            return 0;
        }

        $maxYears = 0;
        if (preg_match_all('/(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?)/i', $text, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $first = (int) ($match[1] ?? 0);
                $second = isset($match[2]) && $match[2] !== '' ? (int) $match[2] : 0;
                $candidate = max($first, $second);

                if ($candidate > $maxYears && $candidate <= 50) {
                    $maxYears = $candidate;
                }
            }
        }

        return $maxYears;
    }

    /**
     * @param  array<int, string>  $tokens
     */
    private function countTokenMatchesInText(array $tokens, string $text): int
    {
        return $this->tokensPresentInText($tokens, $text);
    }

    private function textContainsToken(string $text, string $token): bool
    {
        $token = strtolower(trim($token));
        if ($token === '') {
            return false;
        }

        if (preg_match('/^[a-z0-9 ]+$/', $token) === 1) {
            return preg_match('/\b'.preg_quote($token, '/').'\b/i', $text) === 1;
        }

        return str_contains($text, $token);
    }

    private function dispatchCommunication(
        RecruitmentCandidate $candidate,
        JobPosting $jobPosting,
        string $channel,
        string $messageType,
        string $subject,
        string $message,
        ?Carbon $scheduledAt = null,
        array $attachments = [],
    ): CandidateCommunication {
        $delivery = $this->messagingService->send(
            $channel,
            $candidate->email,
            $candidate->phone,
            $subject,
            $message,
            [
                'scope' => 'recruitment',
                'candidate_id' => $candidate->id,
                'job_posting_id' => $jobPosting->id,
                'message_type' => $messageType,
                'attachments' => $attachments,
            ],
        );

        $status = $delivery['status'];
        $meta = $delivery['meta'];
        if ($attachments !== []) {
            $meta['attachments'] = collect($attachments)
                ->map(fn (array $attachment): array => [
                    'name' => (string) ($attachment['name'] ?? basename((string) ($attachment['path'] ?? ''))),
                ])
                ->values()
                ->all();
        }
        $sentAt = Carbon::now();

        return CandidateCommunication::query()->create([
            'candidate_id' => $candidate->id,
            'job_posting_id' => $jobPosting->id,
            'channel' => $channel,
            'message_type' => $messageType,
            'subject' => $subject,
            'message' => $message,
            'delivery_status' => $status,
            'scheduled_at' => $scheduledAt,
            'sent_at' => $sentAt,
            'meta' => $meta,
        ]);
    }

    /**
     * @param  array<int, mixed>  $channels
     */
    private function selectPreferredChannel(array $channels): string
    {
        foreach ($channels as $channel) {
            $normalized = strtolower(trim((string) $channel));
            if (in_array($normalized, ['email', 'sms'], true)) {
                return $normalized;
            }
        }

        return 'email';
    }

    private function ensureRecruitmentManagementPermission(User $actor): void
    {
        if ($this->canManageRecruitment($actor)) {
            return;
        }

        throw new AuthorizationException('You are not authorized to manage recruitment actions.');
    }

    private function canManageRecruitment(User $actor): bool
    {
        if (in_array(strtolower(trim((string) $actor->role)), ['admin', 'ceo', 'gm', 'general manager'], true)) {
            return true;
        }

        $employee = Employee::query()
            ->with('department')
            ->where('email', $actor->email)
            ->first();

        $jobTitle = strtolower(trim((string) $employee?->job_title));
        if (in_array($jobTitle, ['ceo', 'chief executive officer', 'gm', 'general manager'], true)) {
            return true;
        }

        return strcasecmp((string) $employee?->department?->name, 'Human Resources') === 0;
    }

    private function storeCandidateApplication(
        JobPosting $job,
        array $payload,
        UploadedFile $cv,
        string $source,
        string $stage
    ): RecruitmentCandidate {
        $email = isset($payload['email']) ? trim((string) $payload['email']) : null;

        if ($email) {
            $duplicateExists = RecruitmentCandidate::query()
                ->where('job_posting_id', $job->id)
                ->whereRaw('LOWER(email) = ?', [strtolower($email)])
                ->exists();

            if ($duplicateExists) {
                throw ValidationException::withMessages([
                    'email' => 'This email has already been used to apply for this job.',
                ]);
            }
        }

        $cvPath = $cv->store('candidate-cvs', 'public');

        return RecruitmentCandidate::query()->create([
            'job_posting_id' => $job->id,
            'name' => trim((string) $payload['name']),
            'email' => $email !== '' ? $email : null,
            'phone' => isset($payload['phone']) ? trim((string) $payload['phone']) : null,
            'cv_path' => $cvPath,
            'cv_original_name' => $cv->getClientOriginalName(),
            'position' => $job->title,
            'current_stage' => $stage,
            'application_source' => $source,
            'status' => 'Active',
            'skills' => isset($payload['skills']) ? trim((string) $payload['skills']) : null,
            'years_experience' => (int) ($payload['years_experience'] ?? 0),
        ]);
    }

    private function ensurePublicJobIsAvailable(JobPosting $jobPosting): void
    {
        if (strcasecmp((string) $jobPosting->status, 'Active') === 0) {
            return;
        }

        abort(404, 'Job posting not found.');
    }
}
