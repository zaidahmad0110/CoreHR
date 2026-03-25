# CoreHR Local Development Setup

## Prerequisites

Ensure you have installed:
- **PHP 8.2+** - `php --version`
- **Composer** - `composer --version`
- **Node.js 18+** - `node --version`
- **npm** - `npm --version`
- **MySQL 8.0+** - Running and accessible
- **Git** - `git --version`

## Step 1: Setup Backend (Laravel)

### 1.1 Install Backend Dependencies
```bash
cd backend
composer install
cd ..
```

### 1.2 Configure Environment File
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set these critical values:

```env
# App Configuration
APP_NAME=CoreHR
APP_ENV=local
APP_DEBUG=true
APP_KEY=base64:kID78S9aBDVc9tbrSYLtPeI0nVmViDvHuJ8++K+qT94=
APP_URL=http://localhost:8000
APP_TIMEZONE=Asia/Amman

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=core_hr_local
DB_USERNAME=root
DB_PASSWORD=               # Your MySQL password (empty for XAMPP default)

# Session & CSRF (for localhost)
SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=
SESSION_SECURE_COOKIE=false    # false on localhost (http)
SESSION_SAME_SITE=lax          # lax on localhost
SESSION_HTTP_ONLY=true

# Sanctum & CORS
SANCTUM_STATEFUL_DOMAINS=localhost:3000,localhost:5173,localhost:8000,127.0.0.1:5173,127.0.0.1:3000,127.0.0.1:8000
FRONTEND_URL=http://localhost:5173

# Mail (optional - logs to console in local)
MAIL_MAILER=log
MAIL_FROM_ADDRESS=noreply@corehr-local.test
MAIL_FROM_NAME="CoreHR Local"

# Cache & Queue
CACHE_DRIVER=file
QUEUE_CONNECTION=sync
```

### 1.3 Generate Laravel Key
```bash
cd backend
php artisan key:generate
cd ..
```

### 1.4 Create Local Database
```bash
# Via MySQL CLI
mysql -u root -p
CREATE DATABASE core_hr_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Or via PHP
php -r "new mysqli('127.0.0.1', 'root', '', 'mysql'); mysqli_query($GLOBALS['___mysqli_ston'], 'CREATE DATABASE IF NOT EXISTS core_hr_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); echo 'Database created';"
```

### 1.5 Run Migrations
```bash
cd backend
php artisan migrate
cd ..
```

If you want sample data:
```bash
cd backend
php artisan db:seed    # If seeders exist
cd ..
```

### 1.6 Start Backend Server
```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8000
# or
php -S 127.0.0.1:8000 -t public
```

Backend will be at: **http://localhost:8000**

---

## Step 2: Setup Frontend (React)

### 2.1 Install Frontend Dependencies
```bash
npm install
```

### 2.2 Create Frontend Environment File
Create `.env` file in the project root (same level as `package.json`):

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 2.3 Start Frontend Development Server
```bash
npm run dev
```

Frontend will be at: **http://localhost:5173**

---

## Step 3: Verify Local Setup is Working

### 3.1 Test Backend Health
```bash
# In terminal/Postman/curl
curl http://localhost:8000/up

# Response should be OK or 200
```

### 3.2 Test CSRF Endpoint
```bash
curl -i http://localhost:8000/sanctum/csrf-cookie

# Should return:
# HTTP/1.1 204 No Content
# Set-Cookie: XSRF-TOKEN=...
```

### 3.3 Test Login Endpoint
```bash
# Get CSRF token first
curl -i -X GET http://localhost:8000/sanctum/csrf-cookie

# Copy the XSRF-TOKEN value from Set-Cookie header

# Then login (replace token value)
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -H "Cookie: XSRF-TOKEN=your_token_here" \
  -H "X-XSRF-TOKEN=your_token_here" \
  -d '{
    "email": "your@email.com",
    "password": "password",
    "remember": false
  }'

# Should return user data with 200 status
```

### 3.4 Test Frontend Connectivity
Open browser → http://localhost:5173
- Should see login page
- Open DevTools (F12) → Console → No errors
- Try logging in
- Network tab should show successful login request

---

## Step 4: Common Issues & Fixes

### Issue: "Connection refused" when accessing `http://localhost:8000`
**Solution:** 
- Verify PHP server is running
- Check port 8000 is available: `netstat -ano | find "8000"` (Windows)
- Try different port: `php artisan serve --port=8001`

### Issue: Database connection error
**Solution:**
```bash
# Verify MySQL is running
# Windows: Services → MySQL* should be "Running"
# Mac: Use MAMP or brew services start mysql
# Linux: sudo service mysql start

# Verify database exists
mysql -u root -p -e "SHOW DATABASES;"

# Verify .env has correct credentials
cd backend && php artisan tinker
DB::connection()->getPdo()  # Should return connection object
```

### Issue: CSRF token mismatch on login
**Solution:**
- Clear browser cookies (DevTools → Application → Delete all)
- Hard refresh (Ctrl+Shift+R)
- Ensure `SESSION_SAME_SITE=lax` in `.env` (not `none` on localhost)
- Ensure `SESSION_SECURE_COOKIE=false` on localhost (http)

### Issue: CORS errors
**Solution:**
- Verify `SANCTUM_STATEFUL_DOMAINS` in `backend/.env` includes:
  ```
  localhost:5173,127.0.0.1:5173,localhost:8000,127.0.0.1:8000
  ```
- Verify `FRONTEND_URL=http://localhost:5173` in `backend/.env`
- Restart backend server to reload env vars

### Issue: Node modules issues
**Solution:**
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Issue: Vite build cache issues
**Solution:**
```bash
# Clear Vite cache
rm -rf .vite
npm run dev
```

---

## Step 5: Development Workflow

### Terminal 1 - Backend
```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8000
```

### Terminal 2 - Frontend
```bash
npm run dev
```

### Terminal 3 - Optional: MySQL CLI
```bash
mysql -u root -p core_hr_local
```

Now:
1. Frontend at **http://localhost:5173** (auto-refreshes on save)
2. Backend at **http://localhost:8000** (hot-reloads most changes)
3. Open both in browser, test the application

---

## Step 6: Useful Commands During Development

### Backend Commands
```bash
cd backend

# Clear caches
php artisan cache:clear
php artisan route:clear
php artisan config:clear
php artisan view:clear

# Tinker - interactive PHP shell
php artisan tinker

# Create migration
php artisan make:migration create_table_name

# Rollback migrations
php artisan migrate:rollback

# Fresh database
php artisan migrate:fresh --seed

# Watch logs
tail -f storage/logs/laravel.log
```

### Frontend Commands
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## Step 7: Database Testing

Check if migrations ran successfully:

```bash
cd backend
php artisan migrate:status

# Should show all migrations as "Ran"
```

Check database tables:
```bash
mysql -u root -p core_hr_local
SHOW TABLES;
```

---

## Step 8: Test All Features Locally

### 1. Login/Logout
- Go to http://localhost:5173/login
- Enter credentials
- Should redirect to dashboard
- Logout should work

### 2. Employee Management
- Should be able to create, read, update employees
- Check Network tab for successful API calls

### 3. API Testing with Curl
```bash
# Get all employees (requires login first)
curl -H "Cookie: XSRF-TOKEN=...; LARAVEL_SESSION=..." \
  http://localhost:8000/api/employees

# Create employee
curl -X POST http://localhost:8000/api/employees \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -H "X-XSRF-TOKEN: ..." \
  -d '{...}'
```

---

## Environment Variables Summary

| Variable | Local | Production |
|----------|-------|------------|
| APP_DEBUG | true | false |
| APP_ENV | local | production |
| SESSION_SECURE_COOKIE | false | true |
| SESSION_SAME_SITE | lax | none |
| MAIL_MAILER | log | smtp |
| DB_HOST | 127.0.0.1 | your-db-host |

---

## Next Steps

1. ✅ Install dependencies (npm install, composer install)
2. ✅ Configure .env files
3. ✅ Create database
4. ✅ Run migrations
5. ✅ Start backend server
6. ✅ Start frontend server
7. ✅ Test login at http://localhost:5173

---

## Debugging Tips

### Check backend logs
```bash
cd backend
tail -f storage/logs/laravel.log
```

### Check browser console
F12 → Console tab → Look for errors

### Check network requests
F12 → Network tab → Look at failed requests

### Test API endpoint directly
```bash
curl -v http://localhost:8000/sanctum/csrf-cookie
```

### Check PHP compatibility
```bash
php -v    # Should be 8.2+
php -m    # Should show: pdo, pdo_mysql, zip
```

---

If you encounter any issues, check the error logs in:
- **Backend:** `backend/storage/logs/laravel.log`
- **Frontend:** Browser DevTools Console & Network tab
- **Database:** MySQL error log

Good luck! 🚀
