<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCompanyAssetRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'asset_type' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['required', 'string', 'max:255', Rule::unique('employee_assets', 'serial_number')],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'assigned_date' => ['nullable', 'date'],
        ];
    }
}
