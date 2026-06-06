<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\PerformanceReview;
use Illuminate\Support\Collection;

class PredictiveAnalyticsService
{
    /**
     * @param  array<int>|null  $employeeIds  Null means unrestricted; empty means no accessible employees.
     */
    public function buildEmployeePerformancePredictions(?array $employeeIds = null): array
    {
        $employees = Employee::query()
            ->with([
                'department:id,name',
                'performanceReviews' => fn ($query) => $query
                    ->orderByDesc('period_end')
                    ->orderByDesc('id')
                    ->limit(3),
            ])
            ->where('status', 'Active')
            ->when($employeeIds !== null, fn ($query) => $query->whereIn('id', $employeeIds))
            ->orderBy('name')
            ->get();

        $insights = $employees->map(function (Employee $employee): array {
            /** @var Collection<int, PerformanceReview> $reviews */
            $reviews = $employee->performanceReviews;
            $latestReview = $reviews->first();
            $averageRating = (float) round((float) ($reviews->avg('rating') ?? 0), 2);

            $previousAverage = $reviews->count() > 1
                ? (float) round((float) $reviews->slice(1)->avg('rating'), 2)
                : $averageRating;
            $ratingTrend = (float) round($averageRating - $previousAverage, 2);

            $goalsCompletionRate = 0.0;
            if ($latestReview && (int) $latestReview->goals_total > 0) {
                $goalsCompletionRate = (float) round(
                    ((int) $latestReview->goals_completed / (int) $latestReview->goals_total) * 100,
                    1,
                );
            }

            $riskScore = $this->calculateRiskScore($averageRating, $ratingTrend, $goalsCompletionRate);
            $retentionProbability = max(5, min(99, 100 - $riskScore));
            $forecastRating = $this->forecastRating($averageRating, $ratingTrend);

            return [
                'employee_id' => $employee->id,
                'employee' => $employee->name,
                'department' => $employee->department?->name ?? 'N/A',
                'latest_rating' => $latestReview ? (float) $latestReview->rating : null,
                'average_rating' => $averageRating,
                'rating_trend' => $ratingTrend,
                'goals_completion_rate' => $goalsCompletionRate,
                'forecast_rating' => $forecastRating,
                'retention_probability' => $retentionProbability,
                'risk_score' => $riskScore,
                'risk_level' => $this->resolveRiskLevel($riskScore),
                'recommended_action' => $this->recommendAction($riskScore, $goalsCompletionRate, $ratingTrend),
            ];
        })->values();

        return [
            'summary' => [
                'employees_analyzed' => $insights->count(),
                'high_risk' => $insights->where('risk_level', 'High')->count(),
                'medium_risk' => $insights->where('risk_level', 'Medium')->count(),
                'low_risk' => $insights->where('risk_level', 'Low')->count(),
                'average_retention_probability' => (float) round((float) ($insights->avg('retention_probability') ?? 0), 1),
            ],
            'employees' => $insights->sortByDesc('risk_score')->values(),
        ];
    }

    private function calculateRiskScore(float $averageRating, float $ratingTrend, float $goalsCompletionRate): int
    {
        $score = 0;

        if ($averageRating < 3.5) {
            $score += (int) round((3.5 - $averageRating) * 24);
        }

        if ($ratingTrend < 0) {
            $score += (int) round(abs($ratingTrend) * 35);
        }

        if ($goalsCompletionRate < 70) {
            $score += (int) round((70 - $goalsCompletionRate) * 0.7);
        }

        return max(1, min(99, $score));
    }

    private function forecastRating(float $averageRating, float $ratingTrend): float
    {
        $forecast = $averageRating + ($ratingTrend * 0.6);

        return (float) round(max(1, min(5, $forecast)), 2);
    }

    private function resolveRiskLevel(int $riskScore): string
    {
        if ($riskScore >= 65) {
            return 'High';
        }

        if ($riskScore >= 35) {
            return 'Medium';
        }

        return 'Low';
    }

    private function recommendAction(int $riskScore, float $goalsCompletionRate, float $ratingTrend): string
    {
        if ($riskScore >= 65) {
            return 'Schedule a manager check-in and targeted coaching plan.';
        }

        if ($goalsCompletionRate < 70) {
            return 'Align on achievable goals and provide execution support.';
        }

        if ($ratingTrend < 0) {
            return 'Review recent blockers and create a short-term recovery plan.';
        }

        return 'Keep current development plan and monitor monthly.';
    }
}
