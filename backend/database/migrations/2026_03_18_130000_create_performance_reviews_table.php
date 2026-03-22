<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('performance_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('review_type');
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('rating', 3, 2);
            $table->unsignedSmallInteger('goals_total')->default(0);
            $table->unsignedSmallInteger('goals_completed')->default(0);
            $table->text('review_summary')->nullable();
            $table->timestamps();

            $table->index(['review_type', 'period_start', 'period_end']);
            $table->index(['employee_id', 'period_end']);
            $table->unique(['employee_id', 'review_type', 'period_start', 'period_end'], 'performance_reviews_unique_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('performance_reviews');
    }
};
