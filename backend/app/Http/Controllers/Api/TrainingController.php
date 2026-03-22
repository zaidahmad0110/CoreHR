<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreTrainingMaterialRequest;
use App\Http\Requests\Api\StoreTrainingProgramRequest;
use App\Http\Requests\Api\UpdateTrainingMaterialRequest;
use App\Models\TrainingMaterial;
use App\Models\TrainingProgram;
use App\Services\TrainingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TrainingController extends Controller
{
    public function __construct(private readonly TrainingService $trainingService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->trainingService->getOverview($request->user()),
        ]);
    }

    public function storeProgram(StoreTrainingProgramRequest $request): JsonResponse
    {
        $program = $this->trainingService->createProgram($request->user(), $request->validated());

        return response()->json([
            'message' => 'Training program created successfully.',
            'data' => [
                'id' => $program->id,
            ],
        ], 201);
    }

    public function enroll(Request $request, TrainingProgram $trainingProgram): JsonResponse
    {
        $enrollment = $this->trainingService->enroll($request->user(), $trainingProgram);

        return response()->json([
            'message' => 'Enrolled successfully.',
            'data' => [
                'id' => $enrollment->id,
            ],
        ], 201);
    }

    public function materials(Request $request): JsonResponse
    {
        $trainingProgram = null;
        $programId = $request->integer('training_program_id');

        if ($programId > 0) {
            $trainingProgram = TrainingProgram::query()->findOrFail($programId);
        }

        return response()->json([
            'data' => $this->trainingService->getMaterials($request->user(), $trainingProgram),
        ]);
    }

    public function storeMaterial(StoreTrainingMaterialRequest $request): JsonResponse
    {
        $material = $this->trainingService->createMaterial(
            $request->user(),
            $request->validated(),
            $request->file('file'),
        );

        return response()->json([
            'message' => 'Training material uploaded successfully.',
            'data' => [
                'id' => $material->id,
            ],
        ], 201);
    }

    public function viewMaterial(Request $request, TrainingMaterial $trainingMaterial): StreamedResponse
    {
        return $this->trainingService->streamMaterial($request->user(), $trainingMaterial);
    }

    public function updateMaterial(
        UpdateTrainingMaterialRequest $request,
        TrainingMaterial $trainingMaterial
    ): JsonResponse {
        $material = $this->trainingService->updateMaterial(
            $request->user(),
            $trainingMaterial,
            $request->validated(),
            $request->file('file'),
        );

        return response()->json([
            'message' => 'Training material updated successfully.',
            'data' => [
                'id' => $material->id,
            ],
        ]);
    }

    public function deleteMaterial(Request $request, TrainingMaterial $trainingMaterial): JsonResponse
    {
        $materialTitle = $trainingMaterial->title;

        $this->trainingService->deleteMaterial($request->user(), $trainingMaterial);

        return response()->json([
            'message' => "Training material {$materialTitle} deleted successfully.",
        ]);
    }
}
