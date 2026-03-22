<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\HrAssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatbotController extends Controller
{
    public function __construct(private readonly HrAssistantService $assistantService)
    {
    }

    public function query(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'question' => ['required', 'string', 'max:2000'],
        ]);

        return response()->json([
            'data' => [
                ...$this->assistantService->answer($request->user(), $validated['question']),
                'asked_at' => now()->toISOString(),
            ],
        ]);
    }
}

