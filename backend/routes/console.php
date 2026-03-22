<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\PayrollService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('payroll:generate-monthly', function (PayrollService $payrollService) {
    $payrollService->getData(null, null);
    $this->info('Payroll generation sync completed.');
})->purpose('Generate payroll periods/items from attendance and trigger workflow notifications.');

Schedule::command('payroll:generate-monthly')->dailyAt('23:55');
