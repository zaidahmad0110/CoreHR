<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\BioTimeSyncService;
use App\Services\PayrollService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('payroll:generate-monthly', function (PayrollService $payrollService) {
    $payrollService->getData(null, null);
    $this->info('Payroll generation sync completed.');
})->purpose('Generate payroll periods/items from attendance and trigger workflow notifications.');

Artisan::command('attendance:sync-biotime {--full : Import all historical BioTime transactions}', function (BioTimeSyncService $bioTimeSyncService) {
    $result = $bioTimeSyncService->sync(fullSync: (bool) $this->option('full'));
    $this->info(sprintf(
        'BioTime sync completed. Fetched: %d, imported: %d, attendance updated: %d.',
        $result['fetched'],
        $result['imported'],
        $result['attendance_updated'],
    ));
})->purpose('Import attendance punches from BioTime into CoreHR.');

Schedule::command('payroll:generate-monthly')->dailyAt('23:55');
Schedule::command('attendance:sync-biotime')->everyFifteenMinutes();
