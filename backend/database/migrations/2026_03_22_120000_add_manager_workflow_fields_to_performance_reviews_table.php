<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('performance_reviews', function (Blueprint $table): void {
            if (! Schema::hasColumn('performance_reviews', 'manager_reviewer_user_id')) {
                $table->foreignId('manager_reviewer_user_id')
                    ->nullable()
                    ->after('workflow_stage')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('performance_reviews', 'manager_reviewed_at')) {
                $table->timestamp('manager_reviewed_at')->nullable()->after('manager_reviewer_user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('performance_reviews', function (Blueprint $table): void {
            if (Schema::hasColumn('performance_reviews', 'manager_reviewed_at')) {
                $table->dropColumn('manager_reviewed_at');
            }

            if (Schema::hasColumn('performance_reviews', 'manager_reviewer_user_id')) {
                $table->dropConstrainedForeignId('manager_reviewer_user_id');
            }
        });
    }
};

