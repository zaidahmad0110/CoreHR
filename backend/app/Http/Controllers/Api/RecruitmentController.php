<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ProcessCandidateDecisionRequest;
use App\Http\Requests\Api\ScheduleCandidateInterviewRequest;
use App\Http\Requests\Api\StoreManualCandidateRequest;
use App\Http\Requests\Api\StorePublicCandidateApplicationRequest;
use App\Http\Requests\Api\StoreJobPostingRequest;
use App\Models\JobPosting;
use App\Models\RecruitmentCandidate;
use App\Services\RecruitmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RecruitmentController extends Controller
{
    public function __construct(private readonly RecruitmentService $recruitmentService)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => $this->recruitmentService->getOverview(),
        ]);
    }

    public function publicJobs(): JsonResponse
    {
        return response()->json([
            'data' => $this->recruitmentService->getPublicJobListings(),
        ]);
    }

    public function applyToPublicJob(
        StorePublicCandidateApplicationRequest $request,
        JobPosting $jobPosting
    ): JsonResponse {
        $candidate = $this->recruitmentService->createPublicCandidateApplication(
            $jobPosting,
            $request->validated(),
            $request->file('cv'),
        );

        return response()->json([
            'message' => 'Application submitted successfully.',
            'data' => [
                'id' => $candidate->id,
            ],
        ], 201);
    }

    public function storeJob(StoreJobPostingRequest $request): JsonResponse
    {
        $job = $this->recruitmentService->createJobPosting($request->user(), $request->validated());

        return response()->json([
            'message' => 'Job posting created successfully.',
            'data' => [
                'id' => $job->id,
            ],
        ], 201);
    }

    public function updateJob(StoreJobPostingRequest $request, JobPosting $jobPosting): JsonResponse
    {
        $this->recruitmentService->updateJobPosting($request->user(), $jobPosting, $request->validated());

        return response()->json([
            'message' => 'Job posting updated successfully.',
            'data' => [
                'id' => $jobPosting->id,
            ],
        ]);
    }

    public function closeJob(Request $request, JobPosting $jobPosting): JsonResponse
    {
        $this->recruitmentService->closeJobPosting($request->user(), $jobPosting);

        return response()->json([
            'message' => 'Job posting closed successfully.',
            'data' => [
                'id' => $jobPosting->id,
            ],
        ]);
    }

    public function deleteJob(Request $request, JobPosting $jobPosting): JsonResponse
    {
        $jobTitle = $jobPosting->title;

        $this->recruitmentService->deleteJobPosting($request->user(), $jobPosting);

        return response()->json([
            'message' => "Job posting {$jobTitle} deleted successfully.",
        ]);
    }

    public function storeManualCandidate(StoreManualCandidateRequest $request): JsonResponse
    {
        $candidate = $this->recruitmentService->createManualCandidate(
            $request->user(),
            $request->validated(),
            $request->file('cv'),
        );

        return response()->json([
            'message' => 'Candidate CV uploaded successfully.',
            'data' => [
                'id' => $candidate->id,
            ],
        ], 201);
    }

    public function showJob(JobPosting $jobPosting): JsonResponse
    {
        return response()->json([
            'data' => $this->recruitmentService->getJobDetails($jobPosting),
        ]);
    }

    public function viewCandidateCv(RecruitmentCandidate $candidate): StreamedResponse
    {
        return $this->recruitmentService->streamCandidateCv($candidate);
    }

    public function selectBestCandidate(Request $request, JobPosting $jobPosting): JsonResponse
    {
        $bestCandidate = $this->recruitmentService->selectBestCandidate($request->user(), $jobPosting);

        if (! $bestCandidate) {
            return response()->json([
                'message' => 'No suitable candidate available for this job.',
                'data' => null,
            ]);
        }

        return response()->json([
            'message' => 'ATS selected the most suitable candidate.',
            'data' => $bestCandidate,
        ]);
    }

    public function scheduleInterview(
        ScheduleCandidateInterviewRequest $request,
        RecruitmentCandidate $candidate
    ): JsonResponse {
        $result = $this->recruitmentService->scheduleInterview(
            $request->user(),
            $candidate,
            $request->validated(),
        );

        return response()->json([
            'message' => 'Interview scheduled and notifications sent.',
            'data' => $result,
        ]);
    }

    public function deleteCandidate(Request $request, RecruitmentCandidate $candidate): JsonResponse
    {
        $candidateName = $candidate->name;

        $this->recruitmentService->deleteCandidate($request->user(), $candidate);

        return response()->json([
            'message' => "Candidate {$candidateName} deleted successfully.",
        ]);
    }

    public function processCandidateDecision(
        ProcessCandidateDecisionRequest $request,
        RecruitmentCandidate $candidate
    ): JsonResponse {
        $result = $this->recruitmentService->processCandidateDecision(
            $request->user(),
            $candidate,
            $request->validated(),
            $request->file('offer_attachment'),
        );

        $decision = (string) $request->input('decision');
        $message = match ($decision) {
            'offer' => 'Job offer sent and candidate updated.',
            'not_selected' => 'Candidate marked as not selected.',
            'accepted' => 'Candidate marked as accepted.',
            'rejected' => 'Candidate marked as rejected.',
            default => 'Candidate decision updated.',
        };

        return response()->json([
            'message' => $message,
            'data' => $result,
        ]);
    }
}
