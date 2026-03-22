<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ImportCompanyAssetsCsvRequest;
use App\Http\Requests\Api\StoreCompanyAssetRequest;
use App\Http\Requests\Api\UpdateCompanyAssetRequest;
use App\Models\Employee;
use App\Models\EmployeeAsset;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class AssetController extends Controller
{
    public function index(): JsonResponse
    {
        $assets = EmployeeAsset::query()
            ->with('employee:id,name')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => [
                'stats' => [
                    'total' => $assets->count(),
                    'assigned' => $assets->whereNotNull('employee_id')->count(),
                    'available' => $assets->whereNull('employee_id')->count(),
                ],
                'items' => $assets->map(fn (EmployeeAsset $asset): array => [
                    'id' => $asset->id,
                    'name' => $asset->name,
                    'type' => $asset->asset_type ?: $this->detectAssetType($asset->name),
                    'serial_number' => $asset->serial_number,
                    'assigned_to' => $asset->employee?->name,
                    'assigned_employee_id' => $asset->employee_id ? (int) $asset->employee_id : null,
                    'assigned_date' => $asset->assigned_date?->format('M d, Y'),
                    'assigned_date_iso' => $asset->assigned_date?->format('Y-m-d'),
                    'status' => $asset->employee_id ? 'Assigned' : 'Available',
                ])->values(),
            ],
        ]);
    }

    public function store(StoreCompanyAssetRequest $request): JsonResponse
    {
        $this->ensureAssetManagementPermission($request);

        $payload = $request->validated();
        $employeeId = $payload['employee_id'] ?? null;

        $asset = EmployeeAsset::query()->create([
            'employee_id' => $employeeId,
            'name' => $payload['name'],
            'asset_type' => $payload['asset_type'] ?? null,
            'serial_number' => $payload['serial_number'],
            'assigned_date' => $payload['assigned_date']
                ?? ($employeeId ? Carbon::today()->toDateString() : null),
        ]);

        return response()->json([
            'message' => 'Asset created successfully.',
            'data' => [
                'id' => $asset->id,
            ],
        ], 201);
    }

    public function update(
        UpdateCompanyAssetRequest $request,
        EmployeeAsset $employeeAsset
    ): JsonResponse {
        $this->ensureAssetManagementPermission($request);

        $payload = $request->validated();
        $employeeId = $payload['employee_id'] ?? null;

        $employeeAsset->update([
            'employee_id' => $employeeId,
            'name' => $payload['name'],
            'asset_type' => $payload['asset_type'] ?? null,
            'serial_number' => $payload['serial_number'],
            'assigned_date' => $payload['assigned_date']
                ?? ($employeeId ? $employeeAsset->assigned_date?->toDateString() ?? Carbon::today()->toDateString() : null),
        ]);

        return response()->json([
            'message' => 'Asset updated successfully.',
            'data' => [
                'id' => $employeeAsset->id,
            ],
        ]);
    }

    public function destroy(Request $request, EmployeeAsset $employeeAsset): JsonResponse
    {
        $this->ensureAssetManagementPermission($request);

        $assetName = $employeeAsset->name;
        $employeeAsset->delete();

        return response()->json([
            'message' => "Asset {$assetName} deleted successfully.",
        ]);
    }

    public function importCsv(ImportCompanyAssetsCsvRequest $request): JsonResponse
    {
        $this->ensureAssetManagementPermission($request);

        $result = $this->importAssetsFromCsv($request->file('file'));

        return response()->json([
            'message' => "CSV import completed. Created {$result['created']} assets, skipped {$result['skipped']}.",
            'data' => $result,
        ]);
    }

    private function ensureAssetManagementPermission(Request $request): void
    {
        if (! $this->userCanManageAssets($request)) {
            abort(403, 'You are not authorized to manage company assets.');
        }
    }

    private function userCanManageAssets(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if (strcasecmp((string) $user->role, 'Admin') === 0) {
            return true;
        }

        $employee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        return strcasecmp((string) $employee?->department?->name, 'Human Resources') === 0;
    }

    private function detectAssetType(string $name): string
    {
        $normalized = strtolower($name);

        if (str_contains($normalized, 'laptop') || str_contains($normalized, 'macbook')) {
            return 'Laptop';
        }

        if (str_contains($normalized, 'phone') || str_contains($normalized, 'iphone')) {
            return 'Phone';
        }

        if (str_contains($normalized, 'tablet') || str_contains($normalized, 'ipad')) {
            return 'Tablet';
        }

        if (str_contains($normalized, 'monitor')) {
            return 'Monitor';
        }

        return 'Other';
    }

    private function importAssetsFromCsv(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'rb');

        if (! $handle) {
            abort(422, 'Unable to read CSV file.');
        }

        try {
            $headers = fgetcsv($handle);

            if (! $headers || count($headers) === 0) {
                abort(422, 'CSV file is empty.');
            }

            $normalizedHeaders = array_map(
                fn ($header): string => $this->normalizeHeader((string) $header),
                $headers,
            );
            $headerMap = array_flip($normalizedHeaders);

            $nameIndex = $headerMap['name'] ?? null;
            $serialIndex = $headerMap['serial_number'] ?? $headerMap['serial'] ?? null;
            $typeIndex = $headerMap['asset_type'] ?? $headerMap['type'] ?? null;
            $employeeIdIndex = $headerMap['employee_id'] ?? null;
            $employeeEmailIndex = $headerMap['employee_email'] ?? $headerMap['email'] ?? null;
            $assignedDateIndex = $headerMap['assigned_date'] ?? null;

            if ($nameIndex === null || $serialIndex === null) {
                abort(422, 'CSV must include at least these headers: name, serial_number.');
            }

            $created = 0;
            $skipped = 0;
            $errors = [];
            $seenSerials = [];
            $lineNumber = 1;

            while (($row = fgetcsv($handle)) !== false) {
                $lineNumber++;

                if ($this->isCsvRowEmpty($row)) {
                    continue;
                }

                $name = trim((string) ($row[$nameIndex] ?? ''));
                $serialNumber = trim((string) ($row[$serialIndex] ?? ''));
                $assetType = $typeIndex !== null ? trim((string) ($row[$typeIndex] ?? '')) : null;
                $employeeIdRaw = $employeeIdIndex !== null ? trim((string) ($row[$employeeIdIndex] ?? '')) : '';
                $employeeEmailRaw = $employeeEmailIndex !== null ? trim((string) ($row[$employeeEmailIndex] ?? '')) : '';
                $assignedDateRaw = $assignedDateIndex !== null ? trim((string) ($row[$assignedDateIndex] ?? '')) : '';

                if ($name === '' || $serialNumber === '') {
                    $skipped++;
                    $errors[] = "Line {$lineNumber}: name and serial_number are required.";
                    continue;
                }

                $serialKey = strtolower($serialNumber);
                if (isset($seenSerials[$serialKey])) {
                    $skipped++;
                    $errors[] = "Line {$lineNumber}: duplicate serial_number in CSV ({$serialNumber}).";
                    continue;
                }

                if (EmployeeAsset::query()->where('serial_number', $serialNumber)->exists()) {
                    $skipped++;
                    $errors[] = "Line {$lineNumber}: serial_number already exists ({$serialNumber}).";
                    continue;
                }

                $employeeId = null;
                if ($employeeIdRaw !== '') {
                    $employee = Employee::query()->find((int) $employeeIdRaw);
                    if (! $employee) {
                        $skipped++;
                        $errors[] = "Line {$lineNumber}: employee_id {$employeeIdRaw} does not exist.";
                        continue;
                    }
                    $employeeId = $employee->id;
                } elseif ($employeeEmailRaw !== '') {
                    $employee = Employee::query()->where('email', $employeeEmailRaw)->first();
                    if (! $employee) {
                        $skipped++;
                        $errors[] = "Line {$lineNumber}: employee_email {$employeeEmailRaw} not found.";
                        continue;
                    }
                    $employeeId = $employee->id;
                }

                $assignedDate = null;
                if ($assignedDateRaw !== '') {
                    try {
                        $assignedDate = Carbon::parse($assignedDateRaw)->toDateString();
                    } catch (\Throwable) {
                        $skipped++;
                        $errors[] = "Line {$lineNumber}: invalid assigned_date ({$assignedDateRaw}).";
                        continue;
                    }
                } elseif ($employeeId) {
                    $assignedDate = Carbon::today()->toDateString();
                }

                try {
                    EmployeeAsset::query()->create([
                        'employee_id' => $employeeId,
                        'name' => $name,
                        'asset_type' => $assetType !== '' ? $assetType : null,
                        'serial_number' => $serialNumber,
                        'assigned_date' => $assignedDate,
                    ]);

                    $seenSerials[$serialKey] = true;
                    $created++;
                } catch (\Throwable $exception) {
                    $skipped++;
                    $errors[] = "Line {$lineNumber}: ".$exception->getMessage();
                }
            }

            return [
                'created' => $created,
                'skipped' => $skipped,
                'errors' => $errors,
            ];
        } finally {
            fclose($handle);
        }
    }

    private function normalizeHeader(string $header): string
    {
        $header = strtolower(trim($header));
        $header = str_replace(['-', ' '], '_', $header);

        return preg_replace('/[^a-z0-9_]/', '', $header) ?? $header;
    }

    private function isCsvRowEmpty(array $row): bool
    {
        foreach ($row as $cell) {
            if (trim((string) $cell) !== '') {
                return false;
            }
        }

        return true;
    }
}
