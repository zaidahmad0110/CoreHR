<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreTrainingMaterialRequest extends FormRequest
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
            'file' => [
                'nullable',
                'file',
                'max:40960',
                'mimes:pdf,doc,docx,ppt,pptx,xls,xlsx,txt,mp4,mov,m4v,avi,webm',
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $hasFile = $this->hasFile('file');
            $hasExternalUrl = (bool) $this->string('external_url')->trim()->toString();
            $hasArticleContent = (bool) $this->string('article_content')->trim()->toString();

            if (! $hasFile && ! $hasExternalUrl && ! $hasArticleContent) {
                $validator->errors()->add(
                    'material',
                    'Please provide at least one material source: file, external URL, or article content.'
                );
            }
        });
    }
}
