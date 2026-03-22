<?php

namespace App\Http\Requests\Api;

use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
{
    private const ALLOWED_JOB_TITLES = [
        'Coordinator',
        'Supervisor',
        'Manager',
        'Department manager',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var Employee|null $employee */
        $employee = $this->route('employee');
        $allowedJobTitles = self::ALLOWED_JOB_TITLES;

        if ($employee && ! in_array($employee->job_title, $allowedJobTitles, true)) {
            $allowedJobTitles[] = $employee->job_title;
        }

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('employees', 'email')->ignore($employee?->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'job_title' => ['required', 'string', 'max:255', Rule::in($allowedJobTitles)],
            'department' => ['nullable', 'string', Rule::exists('departments', 'name')],
            'manager_id' => ['nullable', 'integer', Rule::exists('employees', 'id')],
            'branch' => ['nullable', 'string', Rule::exists('branches', 'name')],
            'location' => ['nullable', 'string', 'max:255'],
            'join_date' => ['required', 'date'],
            'status' => ['required', Rule::in(['Active', 'On Leave', 'Inactive'])],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'allowances' => ['nullable', 'numeric', 'min:0'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
