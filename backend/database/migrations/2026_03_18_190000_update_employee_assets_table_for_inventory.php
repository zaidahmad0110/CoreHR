<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('employee_assets', function (Blueprint $table) {
            $table->string('asset_type')->nullable()->after('name');
        });

        DB::statement('ALTER TABLE employee_assets DROP FOREIGN KEY employee_assets_employee_id_foreign');
        DB::statement('ALTER TABLE employee_assets MODIFY employee_id BIGINT UNSIGNED NULL');
        DB::statement(
            'ALTER TABLE employee_assets ADD CONSTRAINT employee_assets_employee_id_foreign
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL'
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE employee_assets DROP FOREIGN KEY employee_assets_employee_id_foreign');
        DB::statement('ALTER TABLE employee_assets MODIFY employee_id BIGINT UNSIGNED NOT NULL');
        DB::statement(
            'ALTER TABLE employee_assets ADD CONSTRAINT employee_assets_employee_id_foreign
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE'
        );

        Schema::table('employee_assets', function (Blueprint $table) {
            $table->dropColumn('asset_type');
        });
    }
};
