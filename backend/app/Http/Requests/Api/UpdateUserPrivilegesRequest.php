<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use App\Services\UserPrivilegeService;

class UpdateUserPrivilegesRequest extends FormRequest
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
            'permissions' => ['required', 'array'],
            'permissions.*' => ['boolean'],
            'terms' => ['sometimes', 'array'],
            'terms.*' => ['string', 'in:accepted,rejected'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $permissions = $this->input('permissions');
        $terms = $this->input('terms');
        $filteredPermissions = [];
        $filteredTerms = [];

        if (is_array($permissions)) {
            foreach (UserPrivilegeService::ALL_PERMISSIONS as $permissionKey) {
                if (array_key_exists($permissionKey, $permissions)) {
                    $filteredPermissions[$permissionKey] = $permissions[$permissionKey];
                }
            }
        }

        if (is_array($terms)) {
            foreach (UserPrivilegeService::ALL_PERMISSIONS as $permissionKey) {
                if (! array_key_exists($permissionKey, $terms)) {
                    continue;
                }

                $filteredTerms[$permissionKey] = strtolower(trim((string) $terms[$permissionKey]));
            }
        }

        $payload = ['permissions' => $filteredPermissions];
        if (is_array($terms)) {
            $payload['terms'] = $filteredTerms;
        }

        $this->merge($payload);
    }
}
