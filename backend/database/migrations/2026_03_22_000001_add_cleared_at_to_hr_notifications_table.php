<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_notifications', function (Blueprint $table): void {
            $table->timestamp('cleared_at')->nullable()->after('is_read');
            $table->index(['user_id', 'cleared_at']);
        });
    }

    public function down(): void
    {
        Schema::table('hr_notifications', function (Blueprint $table): void {
            $table->dropIndex('hr_notifications_user_id_cleared_at_index');
            $table->dropColumn('cleared_at');
        });
    }
};

