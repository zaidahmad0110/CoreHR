<?php

namespace App\Http\Requests\Api;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreLeaveRequest extends FormRequest
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
            'type' => ['required', 'string', 'max:100'],
            'request_unit' => ['nullable', 'string', 'in:day,hour'],
            'from_date' => ['required', 'date'],
            'to_date' => ['nullable', 'date', 'after_or_equal:from_date'],
            'from_time' => ['nullable', 'date_format:H:i'],
            'to_time' => ['nullable', 'date_format:H:i'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'sick_leave_photo' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $type = strtolower(trim((string) $this->input('type')));
            $requestUnit = strtolower(trim((string) ($this->input('request_unit') ?: 'day')));

            if (str_contains($type, 'sick') && ! $this->hasFile('sick_leave_photo')) {
                $validator->errors()->add('sick_leave_photo', 'Sick leave photo is required for sick leave requests.');
            }

            if ($requestUnit === 'day' && ! $this->filled('to_date')) {
                $validator->errors()->add('to_date', 'To date is required for full day leave requests.');
            }

            if ($requestUnit !== 'hour') {
                return;
            }

            if (! $this->filled('from_time')) {
                $validator->errors()->add('from_time', 'From time is required for hourly leave requests.');
            }

            if (! $this->filled('to_time')) {
                $validator->errors()->add('to_time', 'To time is required for hourly leave requests.');
            }

            if (! $this->filled('from_date') || ! $this->filled('from_time') || ! $this->filled('to_time')) {
                return;
            }

            $from = Carbon::parse($this->input('from_date').' '.$this->input('from_time'));
            $to = Carbon::parse($this->input('from_date').' '.$this->input('to_time'));

            if ($to->lessThanOrEqualTo($from)) {
                $validator->errors()->add('to_time', 'To time must be after from time.');
            }
        });
    }
}
