<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_periods', function (Blueprint $table): void {
            if (! Schema::hasColumn('payroll_periods', 'workflow_status')) {
                $table->string('workflow_status')->default('awaiting_hr_submission')->after('total_amount');
            }

            if (! Schema::hasColumn('payroll_periods', 'hr_notified_at')) {
                $table->timestamp('hr_notified_at')->nullable()->after('workflow_status');
            }

            if (! Schema::hasColumn('payroll_periods', 'hr_submitted_by_user_id')) {
                $table->foreignId('hr_submitted_by_user_id')
                    ->nullable()
                    ->after('hr_notified_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('payroll_periods', 'hr_submitted_at')) {
                $table->timestamp('hr_submitted_at')->nullable()->after('hr_submitted_by_user_id');
            }

            if (! Schema::hasColumn('payroll_periods', 'finance_notified_at')) {
                $table->timestamp('finance_notified_at')->nullable()->after('hr_submitted_at');
            }

            if (! Schema::hasColumn('payroll_periods', 'finance_approved_by_user_id')) {
                $table->foreignId('finance_approved_by_user_id')
                    ->nullable()
                    ->after('finance_notified_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('payroll_periods', 'finance_approved_at')) {
                $table->timestamp('finance_approved_at')->nullable()->after('finance_approved_by_user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payroll_periods', function (Blueprint $table): void {
            if (Schema::hasColumn('payroll_periods', 'finance_approved_at')) {
                $table->dropColumn('finance_approved_at');
            }

            if (Schema::hasColumn('payroll_periods', 'finance_approved_by_user_id')) {
                $table->dropConstrainedForeignId('finance_approved_by_user_id');
            }

            if (Schema::hasColumn('payroll_periods', 'finance_notified_at')) {
                $table->dropColumn('finance_notified_at');
            }

            if (Schema::hasColumn('payroll_periods', 'hr_submitted_at')) {
                $table->dropColumn('hr_submitted_at');
            }

            if (Schema::hasColumn('payroll_periods', 'hr_submitted_by_user_id')) {
                $table->dropConstrainedForeignId('hr_submitted_by_user_id');
            }

            if (Schema::hasColumn('payroll_periods', 'hr_notified_at')) {
                $table->dropColumn('hr_notified_at');
            }

            if (Schema::hasColumn('payroll_periods', 'workflow_status')) {
                $table->dropColumn('workflow_status');
            }
        });
    }
};

