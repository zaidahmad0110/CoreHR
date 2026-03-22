<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CalendarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function __construct(private readonly CalendarService $calendarService)
    {
    }

    public function events(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->calendarService->getEventsForUser($request->user()),
        ]);
    }
}

