<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePerformanceReviewRequest;
use App\Http\Requests\Api\UpdatePerformanceWorkflowRequest;
use App\Models\PerformanceReview;
use App\Services\PerformanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerformanceController extends Controller
{
    public function __construct(private readonly PerformanceService $performanceService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $reviewType = $request->string('review_type')->toString();

        return response()->json([
            'data' => $this->performanceService->getOverview(
                $request->user(),
                $reviewType !== '' ? $reviewType : null,
            ),
        ]);
    }

    public function store(StorePerformanceReviewRequest $request): JsonResponse
    {
        $review = $this->performanceService->createReview($request->user(), $request->validated());

        return response()->json([
            'message' => 'Performance review created successfully.',
            'data' => [
                'id' => $review->id,
            ],
        ], 201);
    }

    public function updateWorkflow(
        UpdatePerformanceWorkflowRequest $request,
        PerformanceReview $performanceReview
    ): JsonResponse {
        $review = $this->performanceService->updateWorkflow(
            $request->user(),
            $performanceReview,
            $request->validated(),
        );

        return response()->json([
            'message' => 'Performance review workflow updated successfully.',
            'data' => [
                'id' => $review->id,
                'workflow_stage' => $review->workflow_stage,
            ],
        ]);
    }
}
