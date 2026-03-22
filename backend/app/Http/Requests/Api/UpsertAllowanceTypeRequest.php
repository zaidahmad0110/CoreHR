<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertAllowanceTypeRequest extends FormRequest
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
        $allowanceType = $this->route('allowanceType');

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('payroll_allowance_types', 'name')->ignore($allowanceType?->id),
            ],
            'amount' => ['required', 'numeric', 'min:0'],
        ];
    }
}
