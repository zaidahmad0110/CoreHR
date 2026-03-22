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
        Schema::table('expense_claims', function (Blueprint $table): void {
            if (! Schema::hasColumn('expense_claims', 'rejection_note')) {
                $table->text('rejection_note')->nullable()->after('status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('expense_claims', function (Blueprint $table): void {
            if (Schema::hasColumn('expense_claims', 'rejection_note')) {
                $table->dropColumn('rejection_note');
            }
        });
    }
};
