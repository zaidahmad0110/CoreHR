<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationPreferencesRequest extends FormRequest
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
            'leave_request_notifications' => ['required', 'boolean'],
            'attendance_alerts' => ['required', 'boolean'],
            'expense_approvals' => ['required', 'boolean'],
            'payroll_reminders' => ['required', 'boolean'],
        ];
    }
}
