<?php

use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\ChatbotController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\PerformanceController;
use App\Http\Controllers\Api\PrivilegeController;
use App\Http\Controllers\Api\RecruitmentController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\TrainingController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::get('/public/jobs', [RecruitmentController::class, 'publicJobs']);
Route::post('/public/jobs/{jobPosting}/apply', [RecruitmentController::class, 'applyToPublicJob']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/auth/password', [AuthController::class, 'changePassword']);
    Route::get('/auth/two-factor', [AuthController::class, 'twoFactorStatus']);
    Route::patch('/auth/two-factor', [AuthController::class, 'updateTwoFactor']);
    Route::get('/privileges/me', [PrivilegeController::class, 'me']);
    Route::get('/privileges/users', [PrivilegeController::class, 'index'])->middleware('permission:settings');
    Route::patch('/privileges/users/{user}', [PrivilegeController::class, 'update'])->middleware('permission:settings');

    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('permission:dashboard');
    Route::get('/calendar/events', [CalendarController::class, 'events'])->middleware('permission:dashboard');

    Route::middleware('permission:employees')->group(function (): void {
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
        Route::post('/employees/{employee}/documents', [EmployeeController::class, 'storeDocument']);
        Route::patch('/employees/{employee}/documents/{document}', [EmployeeController::class, 'updateDocument']);
        Route::delete('/employees/{employee}/documents/{document}', [EmployeeController::class, 'deleteDocument']);
        Route::post('/employees/{employee}/assets', [EmployeeController::class, 'storeAsset']);
        Route::patch('/employees/{employee}/assets/{asset}', [EmployeeController::class, 'updateAsset']);
        Route::delete('/employees/{employee}/assets/{asset}', [EmployeeController::class, 'deleteAsset']);
        Route::put('/employees/{employee}/today-attendance', [EmployeeController::class, 'upsertTodayAttendance']);
        Route::delete('/employees/{employee}/today-attendance', [EmployeeController::class, 'deleteTodayAttendance']);
        Route::get('/employees/{employee}/onboarding', [EmployeeController::class, 'onboarding']);
        Route::patch('/employees/{employee}/onboarding/{onboardingTask}', [EmployeeController::class, 'updateOnboardingTask']);
        Route::get('/employees/{employee}/payslip', [EmployeeController::class, 'payslip']);
        Route::patch('/employees/{employee}/reset-password', [EmployeeController::class, 'resetUserPassword']);
        Route::patch('/employees/{employee}', [EmployeeController::class, 'update']);
        Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);
    });

    Route::middleware('permission:company_structure')->group(function (): void {
        Route::get('/departments', [OrganizationController::class, 'departments']);
        Route::post('/departments', [OrganizationController::class, 'storeDepartment']);
        Route::patch('/departments/{department}', [OrganizationController::class, 'updateDepartment']);
        Route::delete('/departments/{department}', [OrganizationController::class, 'destroyDepartment']);
        Route::get('/branches', [OrganizationController::class, 'branches']);
        Route::post('/branches', [OrganizationController::class, 'storeBranch']);
        Route::patch('/branches/{branch}', [OrganizationController::class, 'updateBranch']);
        Route::delete('/branches/{branch}', [OrganizationController::class, 'destroyBranch']);
        Route::get('/organization-chart', [OrganizationController::class, 'organizationChart']);
        Route::put('/organization-chart', [OrganizationController::class, 'updateOrganizationChart']);
    });

    Route::get('/attendance', [AttendanceController::class, 'index'])->middleware('permission:attendance');

    Route::middleware('permission:expenses')->group(function (): void {
        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::patch('/expenses/{expenseClaim}/status', [ExpenseController::class, 'updateStatus']);
        Route::get('/expenses/{expenseClaim}/receipt', [ExpenseController::class, 'viewReceipt']);
    });

    Route::middleware('permission:loans')->group(function (): void {
        Route::get('/loans', [LoanController::class, 'index']);
        Route::post('/loans', [LoanController::class, 'store']);
        Route::patch('/loans/{loanRequest}/status', [LoanController::class, 'updateStatus']);
    });

    Route::middleware('permission:assets')->group(function (): void {
        Route::get('/assets', [AssetController::class, 'index']);
        Route::post('/assets', [AssetController::class, 'store']);
        Route::post('/assets/import-csv', [AssetController::class, 'importCsv']);
        Route::patch('/assets/{employeeAsset}', [AssetController::class, 'update']);
        Route::delete('/assets/{employeeAsset}', [AssetController::class, 'destroy']);
    });

    Route::middleware('permission:leave')->group(function (): void {
        Route::get('/leaves', [LeaveController::class, 'index']);
        Route::post('/leaves', [LeaveController::class, 'store']);
        Route::patch('/leaves/{leaveRequest}/status', [LeaveController::class, 'updateStatus']);
        Route::get('/leaves/{leaveRequest}/sick-leave-photo', [LeaveController::class, 'viewSickLeavePhoto']);
    });

    Route::middleware('permission:payroll')->group(function (): void {
        Route::get('/payroll', [PayrollController::class, 'index']);
        Route::patch('/payroll/{payrollPeriod}/submit-hr', [PayrollController::class, 'submitHr']);
        Route::patch('/payroll/{payrollPeriod}/approve-finance', [PayrollController::class, 'approveFinance']);
    });

    Route::middleware('permission:performance')->group(function (): void {
        Route::get('/performance', [PerformanceController::class, 'index']);
        Route::post('/performance', [PerformanceController::class, 'store']);
        Route::patch('/performance/{performanceReview}/workflow', [PerformanceController::class, 'updateWorkflow']);
    });

    Route::middleware('permission:training')->group(function (): void {
        Route::get('/training', [TrainingController::class, 'index']);
        Route::post('/training/programs', [TrainingController::class, 'storeProgram']);
        Route::post('/training/programs/{trainingProgram}/enroll', [TrainingController::class, 'enroll']);
    });

    Route::middleware('permission:training_materials')->group(function (): void {
        Route::get('/training/materials', [TrainingController::class, 'materials']);
        Route::post('/training/materials', [TrainingController::class, 'storeMaterial']);
        Route::get('/training/materials/{trainingMaterial}/view', [TrainingController::class, 'viewMaterial']);
        Route::patch('/training/materials/{trainingMaterial}', [TrainingController::class, 'updateMaterial']);
        Route::delete('/training/materials/{trainingMaterial}', [TrainingController::class, 'deleteMaterial']);
    });

    Route::middleware('permission:recruitment')->group(function (): void {
        Route::get('/recruitment', [RecruitmentController::class, 'index']);
        Route::post('/recruitment/jobs', [RecruitmentController::class, 'storeJob']);
        Route::patch('/recruitment/jobs/{jobPosting}', [RecruitmentController::class, 'updateJob']);
        Route::patch('/recruitment/jobs/{jobPosting}/close', [RecruitmentController::class, 'closeJob']);
        Route::delete('/recruitment/jobs/{jobPosting}', [RecruitmentController::class, 'deleteJob']);
        Route::post('/recruitment/candidates/manual', [RecruitmentController::class, 'storeManualCandidate']);
        Route::get('/recruitment/candidates/{candidate}/cv', [RecruitmentController::class, 'viewCandidateCv']);
        Route::delete('/recruitment/candidates/{candidate}', [RecruitmentController::class, 'deleteCandidate']);
        Route::post('/recruitment/candidates/{candidate}/decision', [RecruitmentController::class, 'processCandidateDecision']);
        Route::get('/recruitment/jobs/{jobPosting}', [RecruitmentController::class, 'showJob']);
        Route::post('/recruitment/jobs/{jobPosting}/ats/select-best', [RecruitmentController::class, 'selectBestCandidate']);
        Route::post('/recruitment/candidates/{candidate}/schedule-interview', [RecruitmentController::class, 'scheduleInterview']);
    });

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications', [NotificationController::class, 'clearAll']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/chatbot/query', [ChatbotController::class, 'query'])->middleware('permission:dashboard');

    Route::middleware('permission:settings')->group(function (): void {
        Route::get('/settings', [SettingsController::class, 'index']);
        Route::patch('/settings/company', [SettingsController::class, 'updateCompany']);
        Route::patch('/settings/communications', [SettingsController::class, 'updateCommunications']);
        Route::patch('/settings/biotime', [SettingsController::class, 'updateBioTime']);
        Route::post('/settings/biotime/sync', [SettingsController::class, 'syncBioTime']);
        Route::patch('/settings/work-hours', [SettingsController::class, 'updateWorkHours']);
        Route::patch('/settings/notifications', [SettingsController::class, 'updateNotifications']);
        Route::post('/settings/notifications/broadcast', [SettingsController::class, 'broadcastNotification']);
        Route::post('/settings/leave-types', [SettingsController::class, 'storeLeaveType']);
        Route::patch('/settings/leave-types/{leaveType}', [SettingsController::class, 'updateLeaveType']);
        Route::delete('/settings/leave-types/{leaveType}', [SettingsController::class, 'deleteLeaveType']);
        Route::post('/settings/allowances', [SettingsController::class, 'storeAllowanceType']);
        Route::patch('/settings/allowances/{allowanceType}', [SettingsController::class, 'updateAllowanceType']);
        Route::delete('/settings/allowances/{allowanceType}', [SettingsController::class, 'deleteAllowanceType']);
        Route::post('/settings/deductions', [SettingsController::class, 'storeDeductionType']);
        Route::patch('/settings/deductions/{deductionType}', [SettingsController::class, 'updateDeductionType']);
        Route::delete('/settings/deductions/{deductionType}', [SettingsController::class, 'deleteDeductionType']);
        Route::post('/settings/holidays', [SettingsController::class, 'storeHoliday']);
        Route::patch('/settings/holidays/{holiday}', [SettingsController::class, 'updateHoliday']);
        Route::delete('/settings/holidays/{holiday}', [SettingsController::class, 'deleteHoliday']);
    });
});
