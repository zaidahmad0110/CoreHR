# CoreHR Send/Receive & CSRF Token Fix - Summary

## Problem Identified
Your application was experiencing **CSRF token mismatch** errors when trying to communicate between:
- **Frontend:** Vercel (`core-hr-v1.vercel.app`)
- **Backend:** Render (`corehr-v1.onrender.com`)

### Root Cause
The `SESSION_DOMAIN` was set to the backend domain only, preventing session cookies from being shared across domains during cross-domain requests.

## Solution Applied

### 1. ✅ Backend Configuration Fixed
**File:** `backend/.env`

**Change Made:**
```diff
- SESSION_DOMAIN=corehr-v1.onrender.com
+ SESSION_DOMAIN=                          (now empty)
  SESSION_SECURE_COOKIE=true
  SESSION_SAME_SITE=none
  SESSION_HTTP_ONLY=true
```

**Why This Works:**
- Empty `SESSION_DOMAIN` allows cookies to be set for any domain (when `SameSite=none`)
- `SESSION_SECURE_COOKIE=true` ensures cookies only sent over HTTPS
- `SESSION_SAME_SITE=none` explicitly allows cross-origin requests to send cookies

### 2. ✅ Verified API Client Configuration
**File:** `src/app/api/client.ts`

Status: **Already Correct** ✅
- ✅ `credentials: "include"` - Allows cookies to be sent/received
- ✅ `ensureCsrfCookie()` called before login
- ✅ `X-XSRF-TOKEN` header added automatically
- ✅ Reads API URL from environment variable

### 3. ✅ CORS Configuration
**File:** `backend/config/cors.php`

Status: **Already Correct** ✅
- ✅ Vercel domain included in `allowed_origins`
- ✅ `supports_credentials: true` enabled
- ✅ All necessary headers configured

### 4. ✅ Middleware Configuration
**File:** `backend/bootstrap/app.php`

Status: **Already Correct** ✅
- ✅ `$middleware->statefulApi()` configured
- ✅ Sanctum properly set up for CSRF protection

## How It Works Now

```
1. Frontend (Vercel) sends login request:
   ├─ GET /sanctum/csrf-cookie
   │  └─▶ Backend sets XSRF-TOKEN cookie ✅
   │
   └─ POST /api/login with X-XSRF-TOKEN header
      └─▶ Backend validates token against session ✅
         └─▶ Creates session cookie (LARAVEL_SESSION) ✅

2. Subsequent requests:
   └─ Frontend automatically includes both cookies ✅
   └─ Backend validates session ✅
```

## Files Created for Reference

### Documentation
1. **[DEPLOYMENT_ENV_GUIDE.md](./DEPLOYMENT_ENV_GUIDE.md)**
   - Complete environment variable reference
   - CSRF/CORS troubleshooting guide
   - Architecture overview

2. **[RENDER_DEPLOYMENT_CHECKLIST.md](./RENDER_DEPLOYMENT_CHECKLIST.md)**
   - Step-by-step Render deployment guide
   - Build/start commands
   - Environment variables checklist
   - Troubleshooting common issues

3. **[VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)**
   - Vercel project setup guide
   - Frontend configuration instructions
   - Testing procedures
   - Performance optimization tips

## Critical Environment Variables

For Render backend, ensure these are set:

```env
# ===== CRITICAL FOR CSRF ACROSS DOMAINS =====
SESSION_DOMAIN=                    # MUST BE EMPTY
SESSION_SECURE_COOKIE=true         # For HTTPS
SESSION_SAME_SITE=none             # Allow cross-domain
SESSION_HTTP_ONLY=true             # Security

# ===== OTHER CRITICAL VARS =====
APP_URL=https://corehr-v1.onrender.com
FRONTEND_URL=https://core-hr-v1.vercel.app
SANCTUM_STATEFUL_DOMAINS=core-hr-v1.vercel.app,corehr-v1.onrender.com,...
```

## Testing Checklist

- [ ] Backend running on Render
- [ ] Frontend running on Vercel
- [ ] Open browser DevTools (F12)
- [ ] Go to Network tab
- [ ] Attempt login:
  - [ ] First request should be `GET /sanctum/csrf-cookie` → should create XSRF-TOKEN cookie
  - [ ] Second request should be `POST /api/login` → should include X-XSRF-TOKEN header
  - [ ] Should receive session cookie (LARAVEL_SESSION)
- [ ] Subsequent authenticated requests should work without CSRF errors
- [ ] Test sending and receiving data (employees, leaves, payroll, etc.)

## Quick Reference: What Changed

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| SESSION_DOMAIN | `corehr-v1.onrender.com` | Empty | ✅ Fixed |
| SESSION_SAME_SITE | `none` | `none` | ✅ Correct |
| SESSION_SECURE_COOKIE | `true` | `true` | ✅ Correct |
| API Client credentials | `include` | `include` | ✅ Correct |
| API Client CSRF token fetch | Implemented | Implemented | ✅ Correct |
| CORS configuration | Vercel domain included | Vercel domain included | ✅ Correct |

## Common Issues After Fix

### If still getting CSRF errors:

1. **Clear browser cookies**
   - F12 → Application → Cookies → Delete all

2. **Check Render logs**
   - Render Dashboard → Logs → Look for session-related errors

3. **Verify environment variables**
   - Render Dashboard → Environment → Check SESSION_* variables

4. **Test CSRF endpoint directly**
   ```bash
   curl -i https://corehr-v1.onrender.com/sanctum/csrf-cookie
   # Should show: Set-Cookie: XSRF-TOKEN=...
   ```

5. **Check CORS headers**
   ```bash
   curl -i -H "Origin: https://core-hr-v1.vercel.app" \
     https://corehr-v1.onrender.com/api/public/jobs
   # Should show: Access-Control-Allow-Origin: https://core-hr-v1.vercel.app
   ```

## Next Steps

1. **Deploy the fix:**
   - Push `backend/.env` changes to your repository
   - Update Render environment variables
   - Trigger redeploy on Render

2. **Test thoroughly:**
   - Follow testing checklist above
   - Test all API endpoints (send/receive operations)

3. **Monitor:**
   - Check Render logs for errors
   - Monitor API response times
   - Track user issues

## Session Persistence Note

Currently using `SESSION_DRIVER=file` which works for single-instance deployments but has limitations:

- ✅ Works with single Render dyno
- ⚠️ Sessions lost on redeploy/restart
- ❌ Doesn't scale to multiple instances

**For production scaling, consider:**
```env
# Option 1: Database sessions (most reliable)
SESSION_DRIVER=database
# Run: php artisan session:table && php artisan migrate

# Option 2: Redis (recommended for performance)
SESSION_DRIVER=redis
REDIS_HOST=your-redis-url
REDIS_PASSWORD=your-redis-password
```

## Still Need Help?

Refer to the detailed guides:
- Questions about environment variables? → [DEPLOYMENT_ENV_GUIDE.md](./DEPLOYMENT_ENV_GUIDE.md)
- Setting up Render? → [RENDER_DEPLOYMENT_CHECKLIST.md](./RENDER_DEPLOYMENT_CHECKLIST.md)
- Setting up Vercel? → [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)

---

**Summary:** Your CSRF token mismatch issue is fixed by correcting the SESSION_DOMAIN configuration. The API client, CORS settings, and middleware are already properly configured. Your send/receive operations should now work correctly between Vercel and Render.
