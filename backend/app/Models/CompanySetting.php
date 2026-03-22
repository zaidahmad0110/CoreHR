<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
    protected $fillable = [
        'company_name',
        'company_email',
        'company_phone',
        'company_website',
        'company_address',
        'company_logo_path',
        'default_language',
        'mail_mailer',
        'mail_host',
        'mail_port',
        'mail_username',
        'mail_password',
        'mail_encryption',
        'mail_from_address',
        'mail_from_name',
        'sms_gateway_endpoint',
        'sms_gateway_token',
        'sms_gateway_timeout',
        'notify_leave_requests',
        'notify_attendance_alerts',
        'notify_expense_approvals',
        'notify_payroll_reminders',
    ];

    protected function casts(): array
    {
        return [
            'default_language' => 'string',
            'mail_port' => 'integer',
            'sms_gateway_timeout' => 'integer',
            'notify_leave_requests' => 'bool',
            'notify_attendance_alerts' => 'bool',
            'notify_expense_approvals' => 'bool',
            'notify_payroll_reminders' => 'bool',
        ];
    }
}
