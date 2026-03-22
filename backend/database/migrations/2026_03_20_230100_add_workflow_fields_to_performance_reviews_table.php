<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('performance_reviews', function (Blueprint $table): void {
            if (! Schema::hasColumn('performance_reviews', 'workflow_stage')) {
                $table->string('workflow_stage')->default('Department Review')->after('meets_requirements');
            }

            if (! Schema::hasColumn('performance_reviews', 'department_reviewer_user_id')) {
                $table->foreignId('department_reviewer_user_id')
                    ->nullable()
                    ->after('workflow_stage')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('performance_reviews', 'department_reviewed_at')) {
                $table->timestamp('department_reviewed_at')->nullable()->after('department_reviewer_user_id');
            }

            if (! Schema::hasColumn('performance_reviews', 'hr_reviewer_user_id')) {
                $table->foreignId('hr_reviewer_user_id')
                    ->nullable()
                    ->after('department_reviewed_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('performance_reviews', 'hr_reviewed_at')) {
                $table->timestamp('hr_reviewed_at')->nullable()->after('hr_reviewer_user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('performance_reviews', function (Blueprint $table): void {
            if (Schema::hasColumn('performance_reviews', 'hr_reviewed_at')) {
                $table->dropColumn('hr_reviewed_at');
            }

            if (Schema::hasColumn('performance_reviews', 'hr_reviewer_user_id')) {
                $table->dropConstrainedForeignId('hr_reviewer_user_id');
            }

            if (Schema::hasColumn('performance_reviews', 'department_reviewed_at')) {
                $table->dropColumn('department_reviewed_at');
            }

            if (Schema::hasColumn('performance_reviews', 'department_reviewer_user_id')) {
                $table->dropConstrainedForeignId('department_reviewer_user_id');
            }

            if (Schema::hasColumn('performance_reviews', 'workflow_stage')) {
                $table->dropColumn('workflow_stage');
            }
        });
    }
};

