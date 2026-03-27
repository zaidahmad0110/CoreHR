<?php

$defaultOrigins = [
    'https://corehrv1-production.up.railway.app/',
    'https://corehr-v1.up.railway.app/',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

$configuredOrigins = array_values(array_filter(array_map(
    static fn (string $value): string => trim($value),
    explode(',', (string) env('FRONTEND_URL', ''))
)));

$allowedOrigins = array_values(array_unique(array_merge($defaultOrigins, $configuredOrigins)));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
