<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOrganizationChartRequest extends FormRequest
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
            'positions' => ['required', 'array', 'min:1'],
            'positions.*.id' => ['nullable', 'integer', 'min:1'],
            'positions.*.role_title' => ['required', 'string', 'max:255'],
            'positions.*.person_name' => ['required', 'string', 'max:255'],
            'positions.*.department' => ['nullable', 'string', 'max:255'],
        ];
    }
}
