# CoreHR

CoreHR is a full-stack Human Resources Management System for employee records, attendance, payroll, leave, recruitment, expenses, loans, performance, training, assets, notifications, and role-based access control.

The application is built as an existing React frontend connected to a Laravel API backend. The intended local/intranet setup is:

- Frontend: React 18, TypeScript, Vite, React Router, Tailwind CSS v4, Radix UI, Recharts, Lucide React
- Backend: Laravel 11, Laravel Sanctum, MySQL/MariaDB
- Authentication: Bearer token API authentication
- Optional integrations: Email/SMS notifications, BioTime/ZKTeco attendance sync

---

## Features

- Employee management with profiles, documents, assets, managers, departments, branches, and user login creation
- Attendance tracking with manual records and optional BioTime/ZKTeco sync
- Leave requests with department-manager approval workflow
- Payroll generation from salary, attendance days, allowances, deductions, and active loans
- Payroll workflow with HR submission and Finance approval
- Recruitment with public careers page, candidate applications, CV upload, ATS ranking, interviews, offers, and candidate status handling
- Performance reviews with rating result mapping and multi-level review flow
- Training and development with materials, enrollment, capacity checks, progress, and active/upcoming status
- Expenses and loans with approval/rejection workflows and notifications
- Company structure management for branches, departments, managers, and organization chart
- Settings for company info, logo, notifications, payroll types, leave types, SMS/email config, and user privileges
- Role-based permissions for Admin, HR, CEO, department managers, managers, supervisors, coordinators, and employees

---

## Requirements

- Node.js 18+
- PHP 8.2+
- Composer
- MySQL or MariaDB
- Git
- XAMPP is supported for local Windows development

---

## Local/Intranet Setup

### 1. Install frontend dependencies

```powershell
npm install
```

### 2. Install backend dependencies

```powershell
cd backend
composer install
cd ..
```

If Composer is not globally installed, use the bundled composer file:

```powershell
cd backend
C:\xampp\php\php.exe ..\composer.phar install
cd ..
```

### 3. Configure backend environment

Create `backend/.env` from the example if it does not exist:

```powershell
copy backend\.env.example backend\.env
```

Recommended local database settings:

```env
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=corehr_api
DB_USERNAME=root
DB_PASSWORD=

FRONTEND_URL=http://localhost:5173
```

Create the database in MySQL/MariaDB:

```sql
CREATE DATABASE IF NOT EXISTS corehr_api
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 4. Generate Laravel app key

```powershell
cd backend
C:\xampp\php\php.exe artisan key:generate
cd ..
```

### 5. Run migrations and seed data

```powershell
cd backend
C:\xampp\php\php.exe artisan migrate
C:\xampp\php\php.exe artisan db:seed
cd ..
```

If the local database was corrupted or tables are broken, recreate it cleanly:

```powershell
cd backend
C:\xampp\php\php.exe artisan migrate:fresh --seed
cd ..
```

### 6. Start the backend API

```powershell
cd backend
C:\xampp\php\php.exe artisan serve --host=0.0.0.0 --port=8000
```

For intranet access from other devices, use the server machine IP, for example:

```powershell
C:\xampp\php\php.exe artisan serve --host=0.0.0.0 --port=8000
```

Then connect clients to:

```text
http://SERVER_IP:8000
```

### 7. Start the frontend

In a second terminal:

```powershell
npm run dev -- --host 0.0.0.0
```

Local browser:

```text
http://localhost:5173
```

Intranet browser:

```text
http://SERVER_IP:5173
```

If the backend URL is not `http://localhost:8000`, create a frontend `.env` file:

```env
VITE_API_BASE_URL=http://SERVER_IP:8000
```

Restart the Vite dev server after changing frontend environment variables.

---

## Run in Background on Windows

Use this when you want CoreHR to run without terminal windows on the screen.

Double-click:

```text
start-corehr-hidden.vbs
```

This starts:

- Laravel backend on `http://localhost:8000`
- Vite frontend on `http://localhost:5173`

To stop both background processes, double-click:

```text
stop-corehr-hidden.vbs
```

Runtime logs and PID files are stored in:

```text
.corehr-runtime/
```

If PHP is not found automatically, set the PHP path once in Windows PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("COREHR_PHP_PATH", "G:\xampp\php\php.exe", "User")
```

Then double-click `start-corehr-hidden.vbs` again.

### Avoid Conflicts With Services on 127.0.0.1

If another important service is already running on `127.0.0.1`, do not bind CoreHR to `0.0.0.0` or `localhost`.

Use the server LAN IP instead.

Find the LAN IP:

```powershell
ipconfig
```

Example LAN IP:

```text
192.168.100.201
```

Set CoreHR to use that IP and optional non-default ports:

```powershell
[Environment]::SetEnvironmentVariable("COREHR_HOST_ADDRESS", "192.168.100.201", "User")
[Environment]::SetEnvironmentVariable("COREHR_BACKEND_PORT", "8088", "User")
[Environment]::SetEnvironmentVariable("COREHR_FRONTEND_PORT", "5174", "User")
```

Then double-click:

```text
start-corehr-hidden.vbs
```

Open the app from:

```text
http://192.168.100.201:5174
```

The launcher automatically sets the frontend API URL to:

```text
http://192.168.100.201:8088
```

To reset back to defaults:

```powershell
[Environment]::SetEnvironmentVariable("COREHR_HOST_ADDRESS", $null, "User")
[Environment]::SetEnvironmentVariable("COREHR_BACKEND_PORT", $null, "User")
[Environment]::SetEnvironmentVariable("COREHR_FRONTEND_PORT", $null, "User")
```

---

## Default Admin Access

After seeding, use:

```text
Email: admin@company.com
Password: password
```

If the admin user is missing or has no permissions, run this SQL:

```sql
START TRANSACTION;

INSERT INTO users (
    name,
    email,
    role,
    password,
    email_verified_at,
    created_at,
    updated_at
)
VALUES (
    'CoreHR Admin',
    'admin@company.com',
    'Admin',
    '$2y$10$ffVBAYqTrjXD30K8T7TCTevqy03LZH57hrRV3c/d9/jaB.MKiU8BG',
    NOW(),
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    name = 'CoreHR Admin',
    role = 'Admin',
    password = '$2y$10$ffVBAYqTrjXD30K8T7TCTevqy03LZH57hrRV3c/d9/jaB.MKiU8BG',
    email_verified_at = COALESCE(email_verified_at, NOW()),
    updated_at = NOW();

DELETE FROM user_permission_overrides
WHERE user_id = (
    SELECT id FROM users WHERE email = 'admin@company.com' LIMIT 1
);

INSERT INTO user_permission_overrides (
    user_id,
    permissions,
    terms,
    created_at,
    updated_at
)
SELECT
    id,
    JSON_OBJECT(
        'dashboard', true,
        'employees', true,
        'attendance', true,
        'leave', true,
        'payroll', true,
        'recruitment', true,
        'performance', true,
        'training', true,
        'training_materials', true,
        'assets', true,
        'expenses', true,
        'loans', true,
        'company_structure', true,
        'settings', true
    ),
    JSON_OBJECT(
        'dashboard', 'accepted',
        'employees', 'accepted',
        'attendance', 'accepted',
        'leave', 'accepted',
        'payroll', 'accepted',
        'recruitment', 'accepted',
        'performance', 'accepted',
        'training', 'accepted',
        'training_materials', 'accepted',
        'assets', 'accepted',
        'expenses', 'accepted',
        'loans', 'accepted',
        'company_structure', 'accepted',
        'settings', 'accepted'
    ),
    NOW(),
    NOW()
FROM users
WHERE email = 'admin@company.com';

COMMIT;
```

The password in this SQL is `password`.

---

## Development Commands

### Frontend

```powershell
npm run dev
npm run build
npm run preview
```

### Backend

```powershell
cd backend
C:\xampp\php\php.exe artisan migrate
C:\xampp\php\php.exe artisan db:seed
C:\xampp\php\php.exe artisan optimize:clear
C:\xampp\php\php.exe artisan route:list
C:\xampp\php\php.exe artisan serve --host=0.0.0.0 --port=8000
```

### Clear Laravel caches

```powershell
cd backend
C:\xampp\php\php.exe artisan optimize:clear
```

---

## API Configuration

The frontend API client reads:

```env
VITE_API_BASE_URL=http://localhost:8000
```

If this variable is missing, the frontend defaults to:

```text
http://localhost:8000
```

Common API endpoints:

- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/public/jobs`
- `GET /api/employees`
- `POST /api/employees`
- `GET /api/dashboard`
- `GET /api/payroll`
- `GET /api/notifications`

Full routes are in:

```text
backend/routes/api.php
```

---

## BioTime / ZKTeco Attendance Sync

CoreHR can sync attendance from BioTime/ZKTeco using BioTime API credentials.

Typical BioTime API token command:

```powershell
$body = @{
  username = "YOUR_BIOTIME_USERNAME"
  password = "YOUR_BIOTIME_PASSWORD"
} | ConvertTo-Json -Compress

curl.exe -X POST "http://127.0.0.1:8091/api-token-auth/" `
  -H "Content-Type: application/json" `
  --data-raw $body
```

Expected integration flow:

- Store BioTime connection settings in CoreHR
- Map BioTime `emp_code` to CoreHR employees
- Sync BioTime transactions
- Convert first punch to check-in and last punch to check-out
- Update CoreHR attendance records

---

## Troubleshooting

### Frontend is blank and shows `/src/main.tsx 404`

Open the app using the Vite dev server, not directly through Apache:

```text
http://localhost:5173
```

Do not open:

```text
http://localhost:8080/CoreHR/
```

unless Apache is specifically configured to serve the built `dist` output.

### `ERR_CONNECTION_REFUSED` for `localhost:8000`

The Laravel backend is not running. Start it:

```powershell
cd backend
C:\xampp\php\php.exe artisan serve --host=0.0.0.0 --port=8000
```

### `401 Unauthorized` on `/api/me`

This is normal before login. If it happens after login:

- Clear browser local storage for the app
- Log in again
- Confirm the frontend is using the correct `VITE_API_BASE_URL`
- Confirm the backend has the user and permissions

### `You do not have access to any modules`

The logged-in user has no accepted permissions. Use the admin SQL above or update permissions from the User Privileges page.

### `Unexpected token '<' is not valid JSON`

The frontend received an HTML page instead of API JSON. Check:

- `VITE_API_BASE_URL`
- Backend server is running
- API routes are reachable
- No Apache/Vite/Railway rewrite is sending API calls to the frontend app

### `Host is not allowed to connect to this MariaDB server`

Allow the client host/user in MySQL/MariaDB or use `127.0.0.1` when running locally.

For local XAMPP:

```env
DB_HOST=127.0.0.1
DB_USERNAME=root
DB_PASSWORD=
```

### `Table ... doesn't exist in engine`

The local database is likely corrupted. Recreate it:

```powershell
cd backend
C:\xampp\php\php.exe artisan migrate:fresh --seed
```

---

## Project Structure

```text
CoreHR/
  src/
    app/
      api/
      auth/
      components/
      hooks/
      pages/
      utils/
    main.tsx
  backend/
    app/
      Http/
      Models/
      Services/
    database/
      migrations/
      seeders/
    routes/
      api.php
  public/
  dist/
  package.json
  README.md
```

---

## Notes

- Keep `backend/.env` out of commits unless intentionally changing shared configuration.
- For intranet use, run both frontend and backend with `--host 0.0.0.0`.
- After changing backend `.env`, run `php artisan optimize:clear`.
- After changing frontend `.env`, restart Vite.
- SMTP testing may fail in production/intranet networks if outbound SMTP ports are blocked by the host or ISP.

---

## Version

CoreHR V1

Last updated: June 2026
