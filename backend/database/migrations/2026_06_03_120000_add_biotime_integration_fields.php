<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table): void {
            $table->boolean('biotime_enabled')->default(false)->after('sms_gateway_timeout');
            $table->string('biotime_base_url')->nullable()->after('biotime_enabled');
            $table->string('biotime_username')->nullable()->after('biotime_base_url');
            $table->string('biotime_password')->nullable()->after('biotime_username');
            $table->unsignedSmallInteger('biotime_timeout')->default(20)->after('biotime_password');
            $table->timestamp('biotime_last_sync_at')->nullable()->after('biotime_timeout');
        });

        Schema::table('employees', function (Blueprint $table): void {
            $table->string('biotime_emp_code')->nullable()->unique()->after('employee_code');
        });

        Schema::create('biotime_punch_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('external_id')->unique();
            $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->string('emp_code')->nullable()->index();
            $table->timestamp('punch_time')->index();
            $table->string('punch_state')->nullable();
            $table->unsignedSmallInteger('verify_type')->nullable();
            $table->string('terminal_sn')->nullable()->index();
            $table->string('terminal_alias')->nullable();
            $table->timestamp('upload_time')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('biotime_punch_logs');

        Schema::table('employees', function (Blueprint $table): void {
            $table->dropUnique(['biotime_emp_code']);
            $table->dropColumn('biotime_emp_code');
        });

        Schema::table('company_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'biotime_enabled',
                'biotime_base_url',
                'biotime_username',
                'biotime_password',
                'biotime_timeout',
                'biotime_last_sync_at',
            ]);
        });
    }
};
