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
            ['email' => 'admin@company.com'],
            [
                'name' => 'John Doe',
                'role' => 'Admin',
                'password' => Hash::make('password'),
            ],
        );

        $branches = collect([
            ['name' => 'San Francisco HQ', 'location' => 'California, USA'],
            ['name' => 'New York Office', 'location' => 'New York, USA'],
            ['name' => 'London Office', 'location' => 'United Kingdom'],
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
                'employee_code' => 'EMP-2024-001',
                'name' => 'Sarah Johnson',
                'email' => 'sarah.j@company.com',
                'phone' => '+1 (555) 123-4567',
                'job_title' => 'Senior Software Engineer',
                'department' => 'Engineering',
                'branch' => 'San Francisco HQ',
                'location' => 'San Francisco, CA',
                'join_date' => '2024-01-15',
                'status' => 'Active',
                'base_salary' => 12000,
                'allowances' => 2000,
                'deductions' => 1400,
            ],
            [
                'employee_code' => 'EMP-2023-002',
                'name' => 'Michael Chen',
                'email' => 'michael.c@company.com',
                'phone' => '+1 (555) 234-5678',
                'job_title' => 'Product Manager',
                'department' => 'Product',
                'branch' => 'San Francisco HQ',
                'location' => 'San Francisco, CA',
                'join_date' => '2023-03-22',
                'status' => 'Active',
                'base_salary' => 11000,
                'allowances' => 1500,
                'deductions' => 1200,
            ],
            [
                'employee_code' => 'EMP-2024-003',
                'name' => 'Emily Davis',
                'email' => 'emily.d@company.com',
                'phone' => '+1 (555) 345-6789',
                'job_title' => 'UX Designer',
                'department' => 'Design',
                'branch' => 'New York Office',
                'location' => 'New York, NY',
                'join_date' => '2024-07-10',
                'status' => 'Active',
                'base_salary' => 9500,
                'allowances' => 1200,
                'deductions' => 950,
            ],
            [
                'employee_code' => 'EMP-2023-004',
                'name' => 'James Wilson',
                'email' => 'james.w@company.com',
                'phone' => '+1 (555) 456-7890',
                'job_title' => 'Marketing Manager',
                'department' => 'Marketing',
                'branch' => 'New York Office',
                'location' => 'New York, NY',
                'join_date' => '2023-02-05',
                'status' => 'Active',
                'base_salary' => 8500,
                'allowances' => 1000,
                'deductions' => 850,
            ],
            [
                'employee_code' => 'EMP-2024-005',
                'name' => 'Lisa Anderson',
                'email' => 'lisa.a@company.com',
                'phone' => '+1 (555) 567-8901',
                'job_title' => 'HR Specialist',
                'department' => 'Human Resources',
                'branch' => 'San Francisco HQ',
                'location' => 'San Francisco, CA',
                'join_date' => '2024-11-18',
                'status' => 'Active',
                'base_salary' => 7500,
                'allowances' => 800,
                'deductions' => 750,
            ],
            [
                'employee_code' => 'EMP-2023-006',
                'name' => 'David Martinez',
                'email' => 'david.m@company.com',
                'phone' => '+1 (555) 678-9012',
                'job_title' => 'DevOps Engineer',
                'department' => 'Engineering',
                'branch' => 'San Francisco HQ',
                'location' => 'San Francisco, CA',
                'join_date' => '2023-08-03',
                'status' => 'Active',
                'base_salary' => 10500,
                'allowances' => 1800,
                'deductions' => 1200,
            ],
            [
                'employee_code' => 'EMP-2022-007',
                'name' => 'Jennifer Lee',
                'email' => 'jennifer.l@company.com',
                'phone' => '+1 (555) 789-0123',
                'job_title' => 'Sales Director',
                'department' => 'Sales',
                'branch' => 'London Office',
                'location' => 'London, UK',
                'join_date' => '2022-04-12',
                'status' => 'Active',
                'base_salary' => 9800,
                'allowances' => 1700,
                'deductions' => 1100,
            ],
            [
                'employee_code' => 'EMP-2023-008',
                'name' => 'Robert Taylor',
                'email' => 'robert.t@company.com',
                'phone' => '+1 (555) 890-1234',
                'job_title' => 'Financial Analyst',
                'department' => 'Finance',
                'branch' => 'London Office',
                'location' => 'London, UK',
                'join_date' => '2023-09-25',
                'status' => 'On Leave',
                'base_salary' => 9000,
                'allowances' => 1000,
                'deductions' => 900,
            ],
            [
                'employee_code' => 'EMP-2026-009',
                'name' => 'John Doe',
                'email' => $admin->email,
                'phone' => '+1 (555) 777-1122',
                'job_title' => 'HR Director',
                'department' => 'Human Resources',
                'branch' => 'San Francisco HQ',
                'location' => 'San Francisco, CA',
                'join_date' => '2026-01-02',
                'status' => 'Active',
                'base_salary' => 13000,
                'allowances' => 2200,
                'deductions' => 1800,
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
            'Sarah Johnson' => 'David Martinez',
            'Michael Chen' => 'John Doe',
            'Emily Davis' => 'Michael Chen',
            'James Wilson' => 'John Doe',
            'Lisa Anderson' => 'John Doe',
            'David Martinez' => 'John Doe',
            'Jennifer Lee' => 'John Doe',
            'Robert Taylor' => 'John Doe',
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
                ['total' => 20, 'used' => random_int(4, 12)],
            );
            LeaveBalance::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'type' => 'Sick Leave'],
                ['total' => 10, 'used' => random_int(1, 4)],
            );
            LeaveBalance::query()->updateOrCreate(
                ['employee_id' => $employee->id, 'type' => 'Personal Leave'],
                ['total' => 5, 'used' => random_int(0, 2)],
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
                'person_name' => 'John Doe',
                'department' => null,
                'sort_order' => 1,
            ],
            [
                'role_key' => 'cto',
                'role_title' => 'CTO',
                'person_name' => 'David Martinez',
                'department' => 'Engineering',
                'sort_order' => 2,
            ],
            [
                'role_key' => 'cpo',
                'role_title' => 'CPO',
                'person_name' => 'Michael Chen',
                'department' => 'Product',
                'sort_order' => 3,
            ],
            [
                'role_key' => 'cfo',
                'role_title' => 'CFO',
                'person_name' => 'Robert Taylor',
                'department' => 'Finance',
                'sort_order' => 4,
            ],
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
                'company_name' => 'HRManager Inc.',
                'company_email' => 'info@hrmanager.com',
                'company_phone' => '+1 (555) 123-4567',
                'company_website' => 'https://hrmanager.com',
                'company_address' => '123 Business St, San Francisco, CA 94103',
                'mail_mailer' => null,
                'mail_host' => null,
                'mail_port' => null,
                'mail_username' => null,
                'mail_password' => null,
                'mail_encryption' => null,
                'mail_from_address' => null,
                'mail_from_name' => null,
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
            ['name' => 'Annual Leave', 'annual_days' => 20, 'carry_over' => true],
            ['name' => 'Sick Leave', 'annual_days' => 10, 'carry_over' => false],
            ['name' => 'Personal Leave', 'annual_days' => 5, 'carry_over' => false],
        ] as $leaveType) {
            LeaveType::query()->updateOrCreate(
                ['name' => $leaveType['name']],
                $leaveType,
            );
        }

        foreach ([
            ['name' => 'Housing Allowance', 'amount' => 500],
            ['name' => 'Transport Allowance', 'amount' => 200],
            ['name' => 'Meal Allowance', 'amount' => 150],
        ] as $allowanceType) {
            PayrollAllowanceType::query()->updateOrCreate(
                ['name' => $allowanceType['name']],
                $allowanceType,
            );
        }

        foreach ([
            ['name' => 'Income Tax', 'value_type' => 'percentage', 'value' => 15],
            ['name' => 'Health Insurance', 'value_type' => 'amount', 'value' => 100],
            ['name' => 'Pension Fund', 'value_type' => 'percentage', 'value' => 5],
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
            ['employee' => 'Sarah Johnson', 'type' => 'Annual Leave', 'from' => '2026-03-18', 'to' => '2026-03-22', 'status' => 'Pending', 'reason' => 'Family vacation'],
            ['employee' => 'Michael Chen', 'type' => 'Sick Leave', 'from' => '2026-03-15', 'to' => '2026-03-16', 'status' => 'Approved', 'reason' => 'Medical appointment'],
            ['employee' => 'Emily Davis', 'type' => 'Annual Leave', 'from' => '2026-03-20', 'to' => '2026-03-22', 'status' => 'Pending', 'reason' => 'Personal matters'],
            ['employee' => 'James Wilson', 'type' => 'Personal Leave', 'from' => '2026-03-17', 'to' => '2026-03-17', 'status' => 'Rejected', 'reason' => 'Personal errands'],
            ['employee' => 'Robert Taylor', 'type' => 'Sick Leave', 'from' => '2026-03-12', 'to' => '2026-03-14', 'status' => 'Approved', 'reason' => 'Recovery period'],
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
            ['name' => 'Good Friday', 'date' => '2026-04-18'],
            ['name' => 'Easter Monday', 'date' => '2026-04-21'],
            ['name' => 'Labor Day', 'date' => '2026-05-01'],
            ['name' => 'Independence Day', 'date' => '2026-07-04'],
            ['name' => 'Thanksgiving', 'date' => '2026-11-26'],
        ];

        foreach ($holidays as $holiday) {
            Holiday::query()->updateOrCreate(['date' => $holiday['date']], $holiday);
        }
    }

    private function seedExpenses($employees, User $admin): void
    {
        $rows = [
            [
                'employee' => 'Sarah Johnson',
                'category' => 'Travel',
                'amount' => 450,
                'date' => '2026-03-10',
                'description' => 'Flight to San Francisco for client meeting',
                'status' => 'Pending',
            ],
            [
                'employee' => 'Michael Chen',
                'category' => 'Equipment',
                'amount' => 1200,
                'date' => '2026-03-08',
                'description' => 'New laptop accessories',
                'status' => 'Approved',
            ],
            [
                'employee' => 'Emily Davis',
                'category' => 'Meals',
                'amount' => 85,
                'date' => '2026-03-12',
                'description' => 'Team lunch meeting',
                'status' => 'Pending',
            ],
            [
                'employee' => 'James Wilson',
                'category' => 'Travel',
                'amount' => 320,
                'date' => '2026-03-05',
                'description' => 'Hotel accommodation',
                'status' => 'Approved',
            ],
            [
                'employee' => 'Lisa Anderson',
                'category' => 'Training',
                'amount' => 599,
                'date' => '2026-03-03',
                'description' => 'Online course subscription',
                'status' => 'Rejected',
            ],
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
            [
                'employee' => 'Sarah Johnson',
                'amount' => 10000,
                'purpose' => 'Home renovation',
                'request_date' => '2026-02-15',
                'status' => 'Approved',
                'installments' => 12,
                'paid_installments' => 2,
            ],
            [
                'employee' => 'Michael Chen',
                'amount' => 5000,
                'purpose' => 'Medical expenses',
                'request_date' => '2026-03-01',
                'status' => 'Pending',
                'installments' => 10,
                'paid_installments' => 0,
            ],
            [
                'employee' => 'Emily Davis',
                'amount' => 15000,
                'purpose' => 'Vehicle purchase',
                'request_date' => '2026-01-10',
                'status' => 'Approved',
                'installments' => 24,
                'paid_installments' => 5,
            ],
            [
                'employee' => 'James Wilson',
                'amount' => 3000,
                'purpose' => 'Emergency expense',
                'request_date' => '2026-03-08',
                'status' => 'Rejected',
                'installments' => 6,
                'paid_installments' => 0,
            ],
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
            ['title' => 'Payroll generated', 'body' => 'March payroll has been generated successfully.', 'type' => 'success', 'is_read' => false],
            ['title' => 'Leave request pending', 'body' => 'Sarah Johnson submitted a new leave request.', 'type' => 'warning', 'is_read' => false],
            ['title' => 'Attendance alert', 'body' => '3 employees have late check-ins today.', 'type' => 'info', 'is_read' => true],
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
            ],
            [
                'title' => 'Product Manager',
                'department' => 'Product',
                'location' => 'Remote',
                'employment_type' => 'Full-time',
                'status' => 'Active',
                'description' => 'Own roadmap and execution for HR platform modules.',
                'requirements' => 'Product strategy, analytics, stakeholder communication.',
                'required_skills' => 'product strategy, analytics, communication, agile',
                'min_experience_years' => 4,
            ],
            [
                'title' => 'UX Designer',
                'department' => 'Design',
                'location' => 'New York, NY',
                'employment_type' => 'Full-time',
                'status' => 'Active',
                'description' => 'Design intuitive interfaces for HR systems and workflows.',
                'requirements' => 'Portfolio, user research, prototyping, design systems.',
                'required_skills' => 'figma, ux research, prototyping, design systems',
                'min_experience_years' => 3,
            ],
        ])->mapWithKeys(function (array $job) use ($admin): array {
            $record = JobPosting::query()->updateOrCreate(
                ['title' => $job['title'], 'department' => $job['department']],
                [...$job, 'created_by_user_id' => $admin->id],
            );

            return [$job['title'] => $record];
        });

        $candidateRows = [
            [
                'name' => 'Alex Thompson',
                'email' => 'alex.thompson@example.com',
                'phone' => '+1 (555) 111-1001',
                'position' => 'Senior Software Engineer',
                'current_stage' => 'Applied',
                'skills' => 'php, laravel, mysql, rest api',
                'years_experience' => 6,
            ],
            [
                'name' => 'Emma Rodriguez',
                'email' => 'emma.rodriguez@example.com',
                'phone' => '+1 (555) 111-1002',
                'position' => 'Senior Software Engineer',
                'current_stage' => 'Screening',
                'skills' => 'react, typescript, node, api',
                'years_experience' => 5,
            ],
            [
                'name' => 'Ryan Patel',
                'email' => 'ryan.patel@example.com',
                'phone' => '+1 (555) 111-1003',
                'position' => 'Product Manager',
                'current_stage' => 'Interview',
                'skills' => 'product strategy, analytics, agile',
                'years_experience' => 7,
                'interview_at' => Carbon::now()->addDays(2)->setTime(11, 0),
                'selected_for_next_step' => true,
            ],
            [
                'name' => 'Sofia Chen',
                'email' => 'sofia.chen@example.com',
                'phone' => '+1 (555) 111-1004',
                'position' => 'UX Designer',
                'current_stage' => 'Interview',
                'skills' => 'figma, prototyping, ux research',
                'years_experience' => 4,
                'interview_at' => Carbon::now()->addDays(3)->setTime(10, 30),
                'selected_for_next_step' => true,
            ],
            [
                'name' => 'Marcus Johnson',
                'email' => 'marcus.johnson@example.com',
                'phone' => '+1 (555) 111-1005',
                'position' => 'Senior Software Engineer',
                'current_stage' => 'Offer',
                'skills' => 'php, laravel, react, aws',
                'years_experience' => 8,
                'selected_for_next_step' => true,
            ],
            [
                'name' => 'Isabella Garcia',
                'email' => 'isabella.garcia@example.com',
                'phone' => '+1 (555) 111-1006',
                'position' => 'UX Designer',
                'current_stage' => 'Screening',
                'skills' => 'figma, design systems, usability testing',
                'years_experience' => 5,
            ],
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
