<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreLeaveRequest;
use App\Http\Requests\Api\UpdateLeaveStatusRequest;
use App\Models\LeaveRequest;
use App\Services\LeaveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveController extends Controller
{
    public function __construct(private readonly LeaveService $leaveService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->leaveService->listForUser($request->user()),
        ]);
    }

    public function store(StoreLeaveRequest $request): JsonResponse
    {
        $leaveRequest = $this->leaveService->createForUser(
            $request->user(),
            $request->validated(),
            $request->file('sick_leave_photo'),
        );

        return response()->json([
            'data' => [
                'id' => $leaveRequest->id,
                'status' => $leaveRequest->status,
            ],
            'message' => 'Leave request submitted successfully.',
        ], 201);
    }

    public function updateStatus(UpdateLeaveStatusRequest $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $updated = $this->leaveService->updateStatus(
            $request->user(),
            $leaveRequest,
            $request->validated()['status'],
        );

        return response()->json([
            'data' => [
                'id' => $updated->id,
                'status' => $updated->status,
            ],
            'message' => 'Leave request status updated.',
        ]);
    }

    public function viewSickLeavePhoto(Request $request, LeaveRequest $leaveRequest)
    {
        return $this->leaveService->downloadSickLeavePhoto($request->user(), $leaveRequest);
    }
}
