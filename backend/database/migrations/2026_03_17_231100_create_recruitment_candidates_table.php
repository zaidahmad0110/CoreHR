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
        Schema::create('recruitment_candidates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_posting_id')->nullable()->constrained('job_postings')->nullOnDelete();
            $table->string('name');
            $table->string('email')->nullable()->index();
            $table->string('phone')->nullable();
            $table->string('position')->nullable();
            $table->string('current_stage')->default('Applied');
            $table->string('status')->default('Active');
            $table->text('skills')->nullable();
            $table->unsignedTinyInteger('years_experience')->default(0);
            $table->text('notes')->nullable();
            $table->dateTime('interview_at')->nullable();
            $table->boolean('selected_for_next_step')->default(false);
            $table->timestamps();

            $table->index(['current_stage', 'job_posting_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recruitment_candidates');
    }
};

