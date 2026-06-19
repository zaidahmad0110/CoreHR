<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

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

    public function export(Request $request): Response
    {
        $validated = $request->validate([
            'mode' => ['nullable', 'in:daily,range'],
            'date' => ['nullable', 'date'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $mode = $validated['mode'] ?? 'daily';
        $fromDate = $mode === 'range'
            ? Carbon::parse($validated['from'] ?? $validated['date'] ?? today()->toDateString())
            : Carbon::parse($validated['date'] ?? today()->toDateString());
        $toDate = $mode === 'range'
            ? Carbon::parse($validated['to'] ?? $fromDate->toDateString())
            : $fromDate->copy();
        $export = $this->attendanceService->export($fromDate, $toDate);

        return response($export['contents'], 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$export['filename'].'"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    }
}
