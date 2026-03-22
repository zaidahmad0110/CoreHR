<?php

namespace App\Http\Requests\Api;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;

class StorePerformanceReviewRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'review_type' => ['required', 'in:Monthly,Half Yearly,Yearly'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'rating' => ['nullable', 'numeric', 'min:0.01', 'max:5'],
            'goals_total' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'goals_completed' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'question_responses' => ['nullable', 'array', 'min:1'],
            'question_responses.*.question' => ['required_with:question_responses', 'string', 'max:500'],
            'question_responses.*.score' => ['required_with:question_responses', 'integer', 'min:1', 'max:5'],
            'question_responses.*.comment' => ['nullable', 'string', 'max:2000'],
            'review_summary' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $payload = $this->all();
            $responses = $payload['question_responses'] ?? null;
            $hasQuestionnaire = is_array($responses) && count($responses) > 0;

            if (! $hasQuestionnaire) {
                if (! isset($payload['rating'], $payload['goals_total'], $payload['goals_completed'])) {
                    $validator->errors()->add(
                        'question_responses',
                        'Provide questionnaire answers or include rating with goals metrics.',
                    );
                }
            }

            $goalsTotal = (int) ($payload['goals_total'] ?? 0);
            $goalsCompleted = (int) ($payload['goals_completed'] ?? 0);
            if ($goalsCompleted > $goalsTotal) {
                $validator->errors()->add('goals_completed', 'Completed goals cannot exceed total goals.');
            }

            if (! isset($payload['period_start'], $payload['period_end'], $payload['review_type'])) {
                return;
            }

            try {
                $start = Carbon::parse($payload['period_start'])->startOfDay();
                $end = Carbon::parse($payload['period_end'])->startOfDay();
            } catch (\Throwable) {
                return;
            }

            $days = $start->diffInDays($end) + 1;
            $type = (string) $payload['review_type'];

            if ($type === 'Monthly' && ($days < 20 || $days > 35)) {
                $validator->errors()->add('period_end', 'Monthly review should cover approximately one month.');
            }

            if ($type === 'Half Yearly' && ($days < 150 || $days > 210)) {
                $validator->errors()->add('period_end', 'Half Yearly review should cover approximately six months.');
            }

            if ($type === 'Yearly' && ($days < 330 || $days > 400)) {
                $validator->errors()->add('period_end', 'Yearly review should cover approximately one year.');
            }
        });
    }
}
