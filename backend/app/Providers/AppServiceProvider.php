<?php

namespace App\Providers;

use App\Http\Middleware\EncryptCookies;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register custom EncryptCookies middleware with XSRF-TOKEN excluded
        $this->app->bind('Illuminate\Cookie\Middleware\EncryptCookies', EncryptCookies::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
