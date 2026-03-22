<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HrAssistantService
{
    public function answer(User $user, string $question): array
    {
        $normalizedQuestion = trim($question);

        if ($normalizedQuestion === '') {
            return [
                'answer' => 'Please enter a question so I can help you.',
                'confidence' => 1.0,
                'suggested_actions' => [],
                'source' => 'fallback',
            ];
        }

        $openAiResult = $this->answerWithOpenAi($user, $normalizedQuestion);
        if ($openAiResult !== null) {
            return $openAiResult;
        }

        return $this->answerWithRules($normalizedQuestion);
    }

    private function answerWithOpenAi(User $user, string $question): ?array
    {
        $apiKey = trim((string) config('services.openai.api_key'));
        if ($apiKey === '') {
            return null;
        }

        try {
            $response = Http::timeout(20)
                ->withToken($apiKey)
                ->acceptJson()
                ->post('https://api.openai.com/v1/responses', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'input' => [
                        [
                            'role' => 'system',
                            'content' => 'You are CoreHR Assistant. Give concise and actionable HR system guidance. Keep responses practical, include module/page names, approval flow expectations, and permission boundaries.',
                        ],
                        [
                            'role' => 'user',
                            'content' => sprintf(
                                'Date: %s. User role: %s. Question: %s',
                                now()->format('Y-m-d'),
                                $user->role,
                                $question,
                            ),
                        ],
                    ],
                    'temperature' => 0.2,
                ]);

            if (! $response->successful()) {
                Log::warning('OpenAI assistant request failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            $payload = $response->json();
            $text = $this->extractResponseText($payload);
            if ($text === null || trim($text) === '') {
                return null;
            }

            return [
                'answer' => trim($text),
                'confidence' => 0.8,
                'suggested_actions' => [],
                'source' => 'openai',
            ];
        } catch (\Throwable $exception) {
            Log::warning('OpenAI assistant request exception.', [
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    private function answerWithRules(string $question): array
    {
        $q = strtolower($question);

        if ($this->containsAny($q, ['leave', 'vacation', 'time off'])) {
            return [
                'answer' => "Leave flow:\n1) Employee submits from Leave Management.\n2) Department manager reviews and approves/rejects.\n3) Employee receives status notification.\n\nCheck leave balances before submitting to avoid insufficient balance.",
                'confidence' => 0.94,
                'suggested_actions' => ['Open Leave page', 'Review pending requests'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['payroll', 'payslip', 'salary', 'finance approval'])) {
            return [
                'answer' => "Payroll flow:\n1) Payroll is generated from attendance, allowances, deductions, and active loans.\n2) HR submits payroll.\n3) Finance gives final approval.\n4) Finalized payslips become available for employees.",
                'confidence' => 0.93,
                'suggested_actions' => ['Open Payroll page', 'Check workflow status'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['expense', 'receipt', 'reimbursement'])) {
            return [
                'answer' => "Expense flow:\n1) Employee submits claim with category, amount, and optional receipt image/file.\n2) Department approver reviews attachment and decision.\n3) On reject, reviewer should include a rejection note.",
                'confidence' => 0.91,
                'suggested_actions' => ['Open Expenses page', 'Review pending expense claims'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['loan', 'installment'])) {
            return [
                'answer' => "Loan flow:\n1) Employee submits requested amount and installments.\n2) Manager/authorized approver reviews request.\n3) Approved active loans are included as monthly payroll deductions.",
                'confidence' => 0.9,
                'suggested_actions' => ['Open Loans page', 'Check active loans'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['attendance', 'check in', 'check-in', 'check out', 'check-out'])) {
            return [
                'answer' => "Attendance directly impacts payroll. Use accurate daily status (Present/Late/Absent/Overtime) and check-in/check-out times. Manual attendance can be created from the employee profile when needed.",
                'confidence' => 0.9,
                'suggested_actions' => ['Open Attendance page', 'Open Employee profile attendance'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['recruit', 'candidate', 'interview', 'ats', 'job offer'])) {
            return [
                'answer' => "Recruitment flow supports job posting, ATS ranking, interview scheduling, candidate decision, and communication over email/SMS. After interview date passes, candidate decisions should move to offer/not selected.",
                'confidence' => 0.9,
                'suggested_actions' => ['Open Recruitment page', 'View job details and ranking'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['training', 'enroll', 'course', 'learning'])) {
            return [
                'answer' => "Training statuses are date-driven: Upcoming before start date, In Progress during active dates, and hidden from available list after end date. Capacity limit blocks enrollment and shows Full.",
                'confidence' => 0.9,
                'suggested_actions' => ['Open Training page', 'Review enrollment progress'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['performance', 'review', 'rating'])) {
            return [
                'answer' => "Performance workflow: supervisor/manager/department manager can create. If supervisor creates, manager reviews first, then department manager, then HR finalizes. If manager creates, department manager then HR finalize. Rating bands: 0.01-1.49 Unsatisfactory, 1.50-2.49 Needs Improvement, 2.50-3.49 Meets Expectations, 3.50-4.49 Exceeds Expectations, 4.50-5.00 Outstanding.",
                'confidence' => 0.92,
                'suggested_actions' => ['Open Performance page', 'Review pending workflow stage'],
                'source' => 'fallback',
            ];
        }

        if ($this->containsAny($q, ['permission', 'role', 'privilege', 'access'])) {
            return [
                'answer' => "Access is controlled by role-based permissions and per-user overrides. Department managers are scoped to their department, while HR/Admin have global access.",
                'confidence' => 0.87,
                'suggested_actions' => ['Open User Privileges page', 'Review module access terms'],
                'source' => 'fallback',
            ];
        }

        return [
            'answer' => "I can help with dashboard insights, employees, attendance, leave approvals, payroll workflow, performance reviews, training, expenses, loans, recruitment, notifications, and permissions.\n\nAsk a task-focused question like: 'How do I finalize payroll?'",
            'confidence' => 0.7,
            'suggested_actions' => ['Ask about a specific workflow', 'Open the related module page'],
            'source' => 'fallback',
        ];
    }

    /**
     * @param  array<int, string>  $needles
     */
    private function containsAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($haystack, strtolower($needle))) {
                return true;
            }
        }

        return false;
    }

    private function extractResponseText(mixed $payload): ?string
    {
        if (! is_array($payload)) {
            return null;
        }

        $output = $payload['output'] ?? null;
        if (! is_array($output)) {
            return null;
        }

        foreach ($output as $item) {
            if (! is_array($item)) {
                continue;
            }

            $content = $item['content'] ?? null;
            if (! is_array($content)) {
                continue;
            }

            foreach ($content as $contentPart) {
                if (! is_array($contentPart)) {
                    continue;
                }

                $text = $contentPart['text'] ?? null;
                if (is_string($text) && trim($text) !== '') {
                    return $text;
                }
            }
        }

        return null;
    }
}
