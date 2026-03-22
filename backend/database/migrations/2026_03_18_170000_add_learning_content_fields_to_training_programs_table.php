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
        Schema::table('training_programs', function (Blueprint $table) {
            $table->string('video_url')->nullable()->after('description');
            $table->string('article_url')->nullable()->after('video_url');
            $table->longText('article_content')->nullable()->after('article_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('training_programs', function (Blueprint $table) {
            $table->dropColumn([
                'video_url',
                'article_url',
                'article_content',
            ]);
        });
    }
};
