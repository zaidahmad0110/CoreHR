<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class ScheduleCandidateInterviewRequest extends FormRequest
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
            'job_posting_id' => ['required', 'integer', 'exists:job_postings,id'],
            'interview_at' => ['required', 'date'],
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => ['required', 'in:email,sms'],
            'notify_selected' => ['nullable', 'boolean'],
            'custom_message' => ['nullable', 'string', 'max:2000'],
        ];
    }
}

