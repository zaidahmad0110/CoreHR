# 419 Login Error - Root Cause & Fix

## 🔍 Problem Identified

You were getting **HTTP 419** (CSRF token mismatch) on login requests, even though:
- ✓ XSRF-TOKEN cookie was present
- ✓ X-XSRF-TOKEN header was being sent
- ✓ LARAVEL_SESSION cookie was present

**Root Cause:** Your login route was explicitly using `middleware('web')`, which doesn't work properly for cross-domain API requests with Sanctum.

## ✅ Fixes Applied

### Fix 1: Updated API Routes
**File:** `backend/routes/api.php`

**Changed from:**
```php
Route::middleware('web')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::get('/me', [AuthController::class, 'me'])->middleware('auth:sanctum');
});
```

**Changed to:**
```php
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/me', [AuthController::class, 'me'])->middleware('auth:sanctum');
```

**Why:** 
- Removed the explicit `'web'` middleware wrapper
- Now uses the default `'api'` middleware with Sanctum's `statefulApi()` configuration
- Sanctum properly handles CSRF tokens for cross-domain requests

### Fix 2: Cleaned Up Middleware Configuration  
**File:** `backend/bootstrap/app.php`

**Removed duplicate:**
```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->statefulApi();  // ← Removed this duplicate
})
```

**Consolidated into single configuration** that includes:
- `statefulApi()` - Enables Sanctum's stateful API mode
- `redirectGuestsTo('/login')` - For web requests
- Custom middleware aliases

## 🔄 How It Works Now

```
1. GET /sanctum/csrf-cookie
   └─▶ Backend returns XSRF-TOKEN cookie + session initialization

2. POST /api/login
   ├─ Client sends:
   │  ├─ Credentials (email, password)
   │  ├─ X-XSRF-TOKEN header (from cookie)
   │  └─ credentials: include (ensures cookies sent/received)
   │
   └─▶ Sanctum's statefulApi() middleware:
      ├─ Validates XSRF-TOKEN ✓
      ├─ Authenticates user ✓
      ├─ Creates session ✓
      └─ Returns 200 with user data ✓

3. GET /api/me (any authenticated request)
   ├─ Client includes credentials: include
   ├─ Session cookie automatically sent
   └─▶ Returns user info ✓
```

## 🚀 Next Steps

### 1. Deploy Changes

```bash
# Commit and push the changes
git add backend/routes/api.php backend/bootstrap/app.php
git commit -m "Fix 419 CSRF error: Remove explicit web middleware from API routes"
git push origin main
```

### 2. Render Redeploy

In Render Dashboard:
1. Go to `corehr-v1` service
2. Click "Manual Deploy" button
3. Wait for build to complete
4. Check logs for any errors

### 3. Test Login Flow

#### In Browser DevTools (F12):

1. **Network Tab:**
   - Refresh page
   - Attempt login
   - Watch the requests:
     ```
     ✓ csrf-cookie    → 204 (should get XSRF-TOKEN cookie)
     ✓ login          → 200 (should succeed with session cookie)
     ✓ me             → 200 (should return user data)
     ```

2. **Console Tab:**
   - Should NOT see error messages
   - Should see successful user data logged

3. **Application Tab → Cookies:**
   - Should see `XSRF-TOKEN`
   - Should see `LARAVEL_SESSION` (after login)

#### In External Test:

```bash
# Get CSRF token
curl -v -H "Origin: https://core-hr-v1.vercel.app" \
  -H "Content-Type: application/json" \
  https://corehr-v1.onrender.com/sanctum/csrf-cookie

# Note the XSRF-TOKEN value from Set-Cookie header

# Test login with token
curl -X POST https://corehr-v1.onrender.com/api/login \
  -H "Origin: https://core-hr-v1.vercel.app" \
  -H "Content-Type: application/json" \
  -H "X-XSRF-TOKEN: [token-from-above]" \
  -H "Cookie: XSRF-TOKEN=[token-from-above]" \
  -d '{
    "email": "your@email.com",
    "password": "password",
    "remember": false
  }' \
  -c cookies.txt

# Should return 200 with user data
```

## 📋 Verification Checklist

After deployment, verify:

- [ ] **Login succeeds (HTTP 200)**
  - Previously returned 419

- [ ] **User data is returned**
  - Check response has user name, email, permissions

- [ ] **Session persists**
  - Refresh page → still logged in (until logout)

- [ ] **CSRF token is valid**
  - No more CSRF token mismatch errors

- [ ] **All API operations work**
  - GET endpoints (fetch data)
  - POST endpoints (create data)
  - PATCH endpoints (update data)
  - DELETE endpoints (delete data)

## 🔍 If You Still Get 419

### Check 1: Verify Route Changes
```bash
cd backend
php artisan route:list | grep login
# Should show:
# POST    api/login             › AuthController@login
# (NOT within a web middleware group)
```

### Check 2: Check Render Logs
```
Render Dashboard → Logs
Look for:
- CSRF validation errors
- Session errors
- Authentication failures
```

### Check 3: Verify Environment Variables
```
Render Dashboard → Environment Variables
Ensure:
  SESSION_DOMAIN=              (empty)
  SESSION_SAME_SITE=none
  SESSION_SECURE_COOKIE=true
  SANCTUM_STATEFUL_DOMAINS=...with your Vercel domain...
```

### Check 4: Clear Cookies & Retry
Browser DevTools → Application → Cookies
- Delete all cookies for corehr-v1.onrender.com
- Refresh page
- Try login again

### Check 5: Check Database Connection
In Render logs, look for database errors:
```
SQLSTATE[HY000]: General error
```
If present, database connection is failing (check DB_* env vars)

## 🎯 Why These Changes Fixed it

| Change | Problem It Solved |
|--------|-------------------|
| Removed `middleware('web')` | Sanctum's statefulApi() now properly handles CSRF for cross-domain requests |
| Used default `'api'` middleware | CSRF validation works correctly with session cookies |
| Removed duplicate `withMiddleware` | Cleaner configuration, no ambiguity |

The key insight: **The 'web' middleware is designed for traditional server-rendered apps**, not for cross-domain API requests from SPAs. **Sanctum's statefulApi()** is what handles CSRF properly for your use case.

## 📚 Related Configuration Files

These are already correctly configured:
- ✅ `config/sanctum.php` - Has stateful domains configured
- ✅ `config/cors.php` - Has Vercel domain in allowed_origins  
- ✅ `config/session.php` - Uses environment variables (which we fixed earlier)
- ✅ `.env` - Has SESSION_DOMAIN empty and SESSION_SAME_SITE=none
- ✅ `src/app/api/client.ts` - Correctly sends CSRF token in header

No additional changes needed in these files!

---

**Summary:** You're now using Sanctum's proper stateful API pattern for cross-domain requests. Login should return 200 instead of 419, and all authenticated operations should work.

Deploy and test! Let me know if you still see issues.
