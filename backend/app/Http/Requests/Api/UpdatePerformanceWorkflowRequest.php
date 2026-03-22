<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePerformanceWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'in:submit_manager_review,submit_department_review,submit_hr_review'],
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
            if (! $this->has('goals_total') && ! $this->has('goals_completed')) {
                return;
            }

            $goalsTotal = (int) ($this->input('goals_total') ?? 0);
            $goalsCompleted = (int) ($this->input('goals_completed') ?? 0);

            if ($goalsCompleted > $goalsTotal) {
                $validator->errors()->add('goals_completed', 'Completed goals cannot exceed total goals.');
            }
        });
    }
}
