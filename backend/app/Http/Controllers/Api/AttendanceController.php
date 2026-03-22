<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(private readonly AttendanceService $attendanceService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $date = $request->string('date')->toString();
        $selectedDate = $date ? Carbon::parse($date) : Carbon::today();

        return response()->json([
            'data' => $this->attendanceService->getByDate($selectedDate),
        ]);
    }
}
