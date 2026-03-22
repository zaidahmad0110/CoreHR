<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateExpenseClaimStatusRequest extends FormRequest
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
            'status' => ['required', 'in:Approved,Rejected'],
            'rejection_note' => ['nullable', 'string', 'max:2000', 'required_if:status,Rejected'],
        ];
    }

    public function messages(): array
    {
        return [
            'rejection_note.required_if' => 'A rejection note is required when rejecting an expense claim.',
        ];
    }
}
