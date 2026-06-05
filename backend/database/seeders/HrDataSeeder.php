<?php

namespace Database\Seeders;

use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAsset;
use App\Models\EmployeeDocument;
use App\Models\ExpenseClaim;
use App\Models\Holiday;
use App\Models\HrNotification;
use App\Models\JobPosting;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LoanRequest;
use App\Models\OrganizationChartPosition;
use App\Models\CompanySetting;
use App\Models\PayrollItem;
use App\Models\PayrollAllowanceType;
use App\Models\PayrollDeductionType;
use App\Models\PayrollPeriod;
use App\Models\RecruitmentCandidate;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class HrDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@konak-travel.com'],
            [
                'name' => 'Hr Admin',
                'role' => 'Admin',
                'password' => Hash::make('password'),
            ],
        );

        $branches = collect([
            ['name' => 'Konak HQ', 'location' => 'Amman, Jo'],
            
        ])->mapWithKeys(fn (array $branch): array => [
            $branch['name'] => Branch::query()->updateOrCreate(['name' => $branch['name']], $branch),
        ]);

        $departments = collect([
            ['name' => 'Engineering', 'manager_name' => 'David Martinez'],
            ['name' => 'Product', 'manager_name' => 'Michael Chen'],
            ['name' => 'Design', 'manager_name' => 'Emily Davis'],
            ['name' => 'Marketing', 'manager_name' => 'James Wilson'],
            ['name' => 'Sales', 'manager_name' => 'Jennifer Lee'],
            ['name' => 'Finance', 'manager_name' => 'Robert Taylor'],
            ['name' => 'Human Resources', 'manager_name' => 'Lisa Anderson'],
            ['name' => 'Operations', 'manager_name' => 'Sarah Johnson'],
        ])->mapWithKeys(fn (array $department): array => [
            $department['name'] => Department::query()->updateOrCreate(['name' => $department['name']], $department),
        ]);

        $employeeRows = [
            [
                'employee_code' => 'EMP-2026-001',
                'name' => 'HR Admin',
                'email' => $admin->email,
                'phone' => '',
                'job_title' => 'HR Director',
                'department' => 'Human Resources',
                'branch' => 'Konak HQ',
                'location' => 'Amman, Jordan',
                'join_date' => '2026-01-02',
                'status' => 'Active',
                'base_salary' => 0,
                'allowances' => 0,
                'deductions' => 0,
            ],
        ];

        $employees = collect($employeeRows)->mapWithKeys(function (array $row) use ($branches, $departments): array {
            $employee = Employee::query()->updateOrCreate(
                ['employee_code' => $row['employee_code']],
                [
                    'name' => $row['name'],
                    'email' => $row['email'],
                    'phone' => $row['phone'],
                    'job_title' => $row['job_title'],
                    'department_id' => $departments[$row['department']]->id,
                    'branch_id' => $branches[$row['branch']]->id,
                    'location' => $row['location'],
                    'join_date' => $row['join_date'],
                    'status' => $row['status'],
                    'base_salary' => $row['base_salary'],
                    'allowances' => $row['allowances'],
                    'deductions' => $row['deductions'],
                ],
            );

            return [$row['name'] => $employee];
        });

        $managerMap = [
            'John Doe' => null,
        ];

        foreach ($employees as $name => $employee) {
            $managerName = $managerMap[$name] ?? null;
            $employee->manager_id = $managerName ? $employees[$managerName]->id : null;
            $employee->save();
        }

        $this->seedOrganizationChart();
        $this->seedSettings();

        foreach ($employees as $employee) {
            LeaveBalance::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'type' => 'Annual Leave'],
                ['total' => 14, 'used' => random_int(0, 0)],
            );
            LeaveBalance::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'type' => 'Sick Leave'],
                ['total' => 14, 'used' => random_int(0, 0)],
            );
        }

        $this->seedAttendance($employees);
        $this->seedDocumentsAndAssets($employees);
        $this->seedLeaves($employees);
        $this->seedExpenses($employees, $admin);
        $this->seedLoanRequests($employees, $admin);
        $this->seedHolidays();
        $this->seedPayroll($employees);
        $this->seedRecruitment($admin);
        $this->seedNotifications($admin);
    }

    private function seedOrganizationChart(): void
    {
        $positions = [
            [
                'role_key' => 'ceo',
                'role_title' => 'Chief Executive Officer',
                'person_name' => 'Yahea Bassam',
                'department' => null,
                'sort_order' => 1,
            ],
            [
                'role_key' => 'GM',
                'role_title' => 'General Manager',
                'person_name' => 'Laith Alqass',
                'department' => null,
                'sort_order' => 2,
            ]
        ];

        foreach ($positions as $position) {
            OrganizationChartPosition::query()->updateOrCreate(
                ['role_key' => $position['role_key']],
                $position,
            );
        }
    }

    private function seedSettings(): void
    {
        CompanySetting::query()->updateOrCreate(
            ['id' => 1],
            [
                'company_name' => 'Konak for travel and tourism',
                'company_email' => 'info@konak-travel.com',
                'company_phone' => '+962 79 300 1900',
                'company_website' => 'https://konak-travel.com/',
                'company_address' => 'مجمع العتوم التجاري, Wasfi At-Tall St., Amman, Jordan',
                'mail_mailer' => null,
                'mail_host' => 'mail.konak-travel.com',
                'mail_port' => 587,
                'mail_username' => 'info@konak-travel.com',
                'mail_password' => 'P@ssw0rd1',
                'mail_encryption' => null,
                'mail_from_address' => null,
                'mail_from_name' => 'Konak for travel and tourism HR System',
                'sms_gateway_endpoint' => null,
                'sms_gateway_token' => null,
                'sms_gateway_timeout' => 10,
                'notify_leave_requests' => true,
                'notify_attendance_alerts' => true,
                'notify_expense_approvals' => true,
                'notify_payroll_reminders' => false,
            ],
        );

        foreach ([
            ['name' => 'Annual Leave', 'annual_days' => 14, 'carry_over' => false],
            ['name' => 'Sick Leave', 'annual_days' => 14, 'carry_over' => false],
        ] as $leaveType) {
            LeaveType::query()->updateOrCreate(
                ['name' => $leaveType['name']],
                $leaveType,
            );
        }

        foreach ([
            ['name' => 'Housing Allowance', 'amount' => 0],
            ['name' => 'Transport Allowance', 'amount' => 0],
            ['name' => 'Meal Allowance', 'amount' => 0],
        ] as $allowanceType) {
            PayrollAllowanceType::query()->updateOrCreate(
                ['name' => $allowanceType['name']],
                $allowanceType,
            );
        }

        foreach ([
            ['name' => 'Income Tax', 'value_type' => 'percentage', 'value' => 0],
            ['name' => 'Health Insurance', 'value_type' => 'amount', 'value' => 0],
            ['name' => 'Pension Fund', 'value_type' => 'percentage', 'value' => 0],
        ] as $deductionType) {
            PayrollDeductionType::query()->updateOrCreate(
                ['name' => $deductionType['name']],
                $deductionType,
            );
        }
    }

    private function seedDocumentsAndAssets($employees): void
    {
        foreach ($employees as $employee) {
            EmployeeDocument::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'name' => 'Employment Contract'],
                [
                    'type' => 'PDF',
                    'upload_date' => $employee->join_date,
                ],
            );

            EmployeeDocument::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'name' => 'NDA Agreement'],
                [
                    'type' => 'PDF',
                    'upload_date' => Carbon::parse($employee->join_date)->addDay()->toDateString(),
                ],
            );

            EmployeeAsset::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'serial_number' => 'ASSET-'.$employee->id.'-LAPTOP'],
                [
                    'name' => 'Laptop',
                    'assigned_date' => $employee->join_date,
                ],
            );

            EmployeeAsset::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'serial_number' => 'ASSET-'.$employee->id.'-PHONE'],
                [
                    'name' => 'Phone',
                    'assigned_date' => $employee->join_date,
                ],
            );
        }
    }

    private function seedAttendance($employees): void
    {
        $startDate = Carbon::today()->subMonths(6)->startOfMonth();
        $endDate = Carbon::today();

        foreach ($employees as $employee) {
            $date = $startDate->copy();
            while ($date->lte($endDate)) {
                $weekday = (int) $date->format('N');
                $status = $weekday >= 6 ? 'Absent' : $this->randomStatus();

                $checkIn = null;
                $checkOut = null;
                $workMinutes = null;

                if ($status !== 'Absent') {
                    $checkIn = match ($status) {
                        'Late' => '09:20:00',
                        'Overtime' => '09:00:00',
                        default => '08:55:00',
                    };
                    $checkOut = $status === 'Overtime' ? '19:15:00' : '18:05:00';
                    $workMinutes = match ($status) {
                        'Overtime' => 615,
                        'Late' => 540,
                        default => 550,
                    };
                }

                AttendanceRecord::query()->updateOrCreate(
                    [
                        'employee_id' => $employee->id,
                        'date' => $date->toDateString(),
                    ],
                    [
                        'check_in' => $checkIn,
                        'check_out' => $checkOut,
                        'work_minutes' => $workMinutes,
                        'status' => $status,
                    ],
                );

                $date->addDay();
            }
        }
    }

    private function seedLeaves($employees): void
    {
        $seedRequests = [

        ];

        foreach ($seedRequests as $row) {
            $from = Carbon::parse($row['from']);
            $to = Carbon::parse($row['to']);

            LeaveRequest::query()->updateOrCreate(
                [
                    'employee_id' => $employees[$row['employee']]->id,
                    'type' => $row['type'],
                    'start_date' => $from->toDateString(),
                    'end_date' => $to->toDateString(),
                ],
                [
                    'days' => $from->diffInDays($to) + 1,
                    'status' => $row['status'],
                    'reason' => $row['reason'],
                ],
            );
        }
    }

    private function seedHolidays(): void
    {
        $holidays = [
                ['name' => 'New Year\'s Day', 'date' => '2026-01-01'],

                ['name' => 'Eid Al-Fitr', 'date' => '2026-03-19'],
                ['name' => 'Eid Al-Fitr Holiday', 'date' => '2026-03-20'],
                ['name' => 'Eid Al-Fitr Holiday', 'date' => '2026-03-21'],
                ['name' => 'Eid Al-Fitr Holiday', 'date' => '2026-03-22'],
                ['name' => 'Eid Al-Fitr Holiday', 'date' => '2026-03-23'],

                ['name' => 'Labor Day', 'date' => '2026-05-01'],

                ['name' => 'Independence Day', 'date' => '2026-05-25'],

                ['name' => 'Arafat Day', 'date' => '2026-05-26'],

                ['name' => 'Eid Al-Adha', 'date' => '2026-05-27'],
                ['name' => 'Eid Al-Adha Holiday', 'date' => '2026-05-28'],
                ['name' => 'Eid Al-Adha Holiday', 'date' => '2026-05-29'],
                ['name' => 'Eid Al-Adha Holiday', 'date' => '2026-05-30'],

                ['name' => 'Islamic New Year', 'date' => '2026-06-16'],

                ['name' => 'Prophet Muhammad\'s Birthday', 'date' => '2026-08-25'],

                ['name' => 'Christmas Day', 'date' => '2026-12-25'],
        ];

        foreach ($holidays as $holiday) {
            Holiday::query()->updateOrCreate(['date' => $holiday['date']], $holiday);
        }
    }

    private function seedExpenses($employees, User $admin): void
    {
        $rows = [

        ];

        foreach ($rows as $row) {
            $reviewedAt = $row['status'] === 'Pending' ? null : Carbon::parse($row['date'])->addDay();
            $reviewedBy = $row['status'] === 'Pending' ? null : $admin->id;

            ExpenseClaim::query()->updateOrCreate(
                [
                    'employee_id' => $employees[$row['employee']]->id,
                    'category' => $row['category'],
                    'expense_date' => $row['date'],
                ],
                [
                    'amount' => $row['amount'],
                    'description' => $row['description'],
                    'status' => $row['status'],
                    'reviewed_by_user_id' => $reviewedBy,
                    'reviewed_at' => $reviewedAt,
                ],
            );
        }
    }

    private function seedLoanRequests($employees, User $admin): void
    {
        $rows = [
            
        ];

        foreach ($rows as $row) {
            $reviewedAt = $row['status'] === 'Pending' ? null : Carbon::parse($row['request_date'])->addDay();
            $reviewedBy = $row['status'] === 'Pending' ? null : $admin->id;
            $monthlyPayment = round($row['amount'] / max(1, (int) $row['installments']), 2);

            LoanRequest::query()->updateOrCreate(
                [
                    'employee_id' => $employees[$row['employee']]->id,
                    'purpose' => $row['purpose'],
                    'request_date' => $row['request_date'],
                ],
                [
                    'amount' => $row['amount'],
                    'status' => $row['status'],
                    'installments' => $row['installments'],
                    'paid_installments' => $row['paid_installments'],
                    'monthly_payment' => $monthlyPayment,
                    'reviewed_by_user_id' => $reviewedBy,
                    'reviewed_at' => $reviewedAt,
                ],
            );
        }
    }

    private function seedPayroll($employees): void
    {
        $baseNet = $employees->sum(fn (Employee $employee) => ($employee->base_salary + $employee->allowances - $employee->deductions));

        for ($i = 5; $i >= 0; $i--) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            $period = PayrollPeriod::query()->updateOrCreate(
                ['month' => $month->toDateString()],
                ['total_amount' => $baseNet + (($i % 3) * 2500)],
            );

            foreach ($employees as $employee) {
                $status = $i === 0 && $employee->name === 'James Wilson' ? 'Pending' : 'Paid';

                PayrollItem::query()->updateOrCreate(
                    ['payroll_period_id' => $period->id, 'employee_id' => $employee->id],
                    [
                        'base_salary' => $employee->base_salary,
                        'allowances' => $employee->allowances,
                        'deductions' => $employee->deductions,
                        'net_salary' => $employee->base_salary + $employee->allowances - $employee->deductions,
                        'status' => $status,
                    ],
                );
            }

            $period->total_amount = (float) $period->items()->sum('net_salary');
            $period->save();
        }
    }

    private function seedNotifications(User $admin): void
    {
        $notifications = [
            
        ];

        foreach ($notifications as $notification) {
            HrNotification::query()->updateOrCreate(
                ['user_id' => $admin->id, 'title' => $notification['title']],
                $notification,
            );
        }
    }

    private function seedRecruitment(User $admin): void
    {
        $jobs = collect([
            [
                'title' => 'Senior Software Engineer',
                'department' => 'Engineering',
                'location' => 'San Francisco, CA',
                'employment_type' => 'Full-time',
                'status' => 'Active',
                'description' => 'Lead backend and frontend initiatives for core HR workflows.',
                'requirements' => '5+ years building production web apps, strong API design, mentoring.',
                'required_skills' => 'php, laravel, react, typescript, mysql, api',
                'min_experience_years' => 5,
            ]
        ])->mapWithKeys(function (array $job) use ($admin): array {
            $record = JobPosting::query()->updateOrCreate(
                ['title' => $job['title'], 'department' => $job['department']],
                [...$job, 'created_by_user_id' => $admin->id],
            );

            return [$job['title'] => $record];
        });

        $candidateRows = [
            
        ];

        foreach ($candidateRows as $row) {
            RecruitmentCandidate::query()->updateOrCreate(
                ['email' => $row['email']],
                [
                    'job_posting_id' => $jobs[$row['position']]->id ?? null,
                    'name' => $row['name'],
                    'phone' => $row['phone'],
                    'position' => $row['position'],
                    'current_stage' => $row['current_stage'],
                    'skills' => $row['skills'],
                    'years_experience' => $row['years_experience'],
                    'interview_at' => $row['interview_at'] ?? null,
                    'selected_for_next_step' => (bool) ($row['selected_for_next_step'] ?? false),
                ],
            );
        }
    }

    private function randomStatus(): string
    {
        $random = random_int(1, 100);

        if ($random <= 68) {
            return 'Present';
        }

        if ($random <= 80) {
            return 'Late';
        }

        if ($random <= 90) {
            return 'Absent';
        }

        return 'Overtime';
    }
}
