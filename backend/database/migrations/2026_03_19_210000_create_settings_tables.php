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
        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->string('company_email')->nullable();
            $table->string('company_phone')->nullable();
            $table->string('company_website')->nullable();
            $table->string('company_address')->nullable();
            $table->boolean('notify_leave_requests')->default(true);
            $table->boolean('notify_attendance_alerts')->default(true);
            $table->boolean('notify_expense_approvals')->default(true);
            $table->boolean('notify_payroll_reminders')->default(false);
            $table->timestamps();
        });

        Schema::create('leave_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedInteger('annual_days')->default(0);
            $table->boolean('carry_over')->default(false);
            $table->timestamps();
        });

        Schema::create('payroll_allowance_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->decimal('amount', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('payroll_deduction_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->enum('value_type', ['amount', 'percentage'])->default('amount');
            $table->decimal('value', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_deduction_types');
        Schema::dropIfExists('payroll_allowance_types');
        Schema::dropIfExists('leave_types');
        Schema::dropIfExists('company_settings');
    }
};
