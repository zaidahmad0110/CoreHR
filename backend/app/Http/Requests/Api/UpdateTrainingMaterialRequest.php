<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTrainingMaterialRequest extends FormRequest
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
            'training_program_id' => ['required', 'integer', 'exists:training_programs,id'],
            'title' => ['required', 'string', 'max:255'],
            'material_type' => ['required', 'in:Document,Video,Article'],
            'description' => ['nullable', 'string', 'max:5000'],
            'external_url' => ['nullable', 'url', 'max:2048'],
            'article_content' => ['nullable', 'string', 'max:50000'],
            'remove_existing_file' => ['nullable', 'boolean'],
            'file' => [
                'nullable',
                'file',
                'max:40960',
                'mimes:pdf,doc,docx,ppt,pptx,xls,xlsx,txt,mp4,mov,m4v,avi,webm',
            ],
        ];
    }
}
