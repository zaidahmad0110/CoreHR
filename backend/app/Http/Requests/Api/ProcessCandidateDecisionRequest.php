<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ProcessCandidateDecisionRequest extends FormRequest
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
            'decision' => ['required', 'in:offer,not_selected,accepted,rejected'],
            'channels' => ['nullable', 'array'],
            'channels.*' => ['required', 'in:email,sms'],
            'notify_candidate' => ['nullable', 'boolean'],
            'custom_message' => ['nullable', 'string', 'max:2000'],
            'offer_attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,doc,docx', 'required_if:decision,offer'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $decision = (string) $this->input('decision');
            if ($decision !== 'offer') {
                return;
            }

            $channels = collect($this->input('channels', []))
                ->map(fn ($channel): string => strtolower(trim((string) $channel)))
                ->values()
                ->all();

            if (! in_array('email', $channels, true)) {
                $validator->errors()->add('channels', 'Job offers with attachment must be sent via email.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'offer_attachment.required_if' => 'Offer attachment is required when sending a job offer.',
            'offer_attachment.mimes' => 'Offer attachment must be a PDF, DOC, or DOCX file.',
            'offer_attachment.max' => 'Offer attachment may not be greater than 10 MB.',
        ];
    }
}
