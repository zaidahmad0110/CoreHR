# CoreHR Deployment Environment Configuration Guide

## Overview
This guide explains the critical environment variables needed for proper CSRF token handling and cross-domain communication between your Vercel frontend and Render backend.

## Backend (Render) Environment Variables

### Critical for CSRF/CORS

```env
# ===== APP CONFIGURATION =====
APP_NAME=Laravel
APP_ENV=production
APP_KEY=base64:kID78S9aBDVc9tbrSYLtPeI0nVmViDvHuJ8++K+qT94=
APP_DEBUG=false
APP_TIMEZONE=Asia/Amman
APP_URL=https://corehr-v1.onrender.com
APP_LOCALE=en
APP_FALLBACK_LOCALE=en

# ===== CRITICAL SESSION/CSRF CONFIGURATION =====
# IMPORTANT: SESSION_DOMAIN must be EMPTY for cross-domain cookies to work
SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=                          # ← MUST BE EMPTY
SESSION_SECURE_COOKIE=true               # ← Required for HTTPS
SESSION_SAME_SITE=none                   # ← Required for cross-domain
SESSION_HTTP_ONLY=true                   # ← Protects from XSS

# ===== SANCTUM CONFIGURATION =====
# List all frontend domains that should have stateful access
SANCTUM_STATEFUL_DOMAINS=core-hr-v1.vercel.app,corehr-v1.onrender.com,localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,127.0.0.1:5173,::1

# ===== DATABASE =====
DB_CONNECTION=mysql
DB_HOST=sql8.freesqldatabase.com
DB_PORT=3306
DB_DATABASE=sql8820970
DB_USERNAME=sql8820970
DB_PASSWORD=UfM4sppRQT

# ===== LOGGING & DEBUGGING =====
LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=error

# ===== CACHE & QUEUE =====
CACHE_STORE=file
CACHE_PREFIX=
BROADCAST_CONNECTION=log
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local

# ===== OTHER =====
FRONTEND_URL=https://core-hr-v1.vercel.app
BCRYPT_ROUNDS=12
PHP_CLI_SERVER_WORKERS=4
```

## Frontend (Vercel) Environment Variables

```env
VITE_API_BASE_URL=https://corehr-v1.onrender.com
```

## Common CSRF Token Mismatch Issues & Solutions

### Problem 1: "CSRF token mismatch" on POST requests
**Cause:** Session cookies not being sent from Vercel to Render
**Solution:** Verify these are set correctly:
- `SESSION_DOMAIN=` (empty, not the backend domain)
- `SESSION_SECURE_COOKIE=true`
- `SESSION_SAME_SITE=none`
- CORS `supports_credentials: true` ✓ (already configured)

### Problem 2: XSRF token not found
**Cause:** Frontend not calling `/sanctum/csrf-cookie` before login
**Solution:** Already handled in `authService.login()` - calls `ensureCsrfCookie()` first
```typescript
// This is already in your code:
export const authService = {
  async login(payload) {
    await ensureCsrfCookie();  // ← Gets the token
    return apiRequest<AuthUser>("/api/login", {
      method: "POST",
      body: payload,
    });
  }
}
```

### Problem 3: Cookies not persisting across requests
**Cause:** Missing `credentials: "include"` in fetch
**Solution:** Already implemented ✓
```typescript
// In client.ts - already correct:
const response = await fetch(buildUrl(path), {
  method,
  credentials: "include",  // ← Allows cookie sending
  headers,
  body: ...
});
```

## Testing the Setup

### 1. Test CSRF Cookie Retrieval
Open browser DevTools (F12) → Network tab
```
GET /sanctum/csrf-cookie
```
Check Response Headers for `Set-Cookie` with XSRF-TOKEN

### 2. Test Login Flow
```
POST /api/login
Headers:
  X-XSRF-TOKEN: [token-from-step-1]
```

### 3. Verify Subsequent Requests
All authenticated requests should automatically include the session cookie.

## Render Deployment Checklist

- [ ] Set all critical SESSION/CSRF environment variables
- [ ] Verify `SESSION_DOMAIN` is **empty** (not set to backend domain)
- [ ] Confirm `SESSION_SAME_SITE=none` (for cross-domain)
- [ ] Set `SESSION_SECURE_COOKIE=true` (for HTTPS)
- [ ] Add `FRONTEND_URL` pointing to your Vercel deployment
- [ ] Update `SANCTUM_STATEFUL_DOMAINS` if your domains change
- [ ] Update `APP_URL` to your Render backend URL
- [ ] Ensure database is accessible from Render

## Local Development Testing

For testing locally with these settings:
```env
# Local .env overrides
APP_DEBUG=true
SESSION_SAME_SITE=lax          # Can be lax locally
SESSION_SECURE_COOKIE=false    # Can be false on http://localhost
SANCTUM_STATEFUL_DOMAINS=...localhost:5173,localhost:3000...
```

## Architecture Overview

```
┌─────────────────────────┐         ┌──────────────────────┐
│  Vercel Frontend        │         │  Render Backend      │
│  core-hr-v1.vercel.app  │────────▶│ corehr-v1.onrender.com│
│                         │        │                      │
│ 1. GET /sanctum/...     │        │ Returns: XSRF-TOKEN  │
│ 2. POST /api/login      │────────▶│ Validates XSRF-TOKEN │
│    Header: X-XSRF-TOKEN │        │ Sets: Session Cookie │
│ 3. Subsequent requests  │        │ Session persists     │
│    credentials: include │        │ across requests      │
└─────────────────────────┘        └──────────────────────┘
```

## Need Help?

If you still see CSRF token mismatch errors:

1. Check Render logs for actual error messages
2. Verify session cookies are being set (DevTools → Application → Cookies)
3. Ensure your CORS config has `supports_credentials: true`
4. Check that Vercel domain is in CORS `allowed_origins` array
5. Verify DATABASE connection is working (sessions might fail silently)

**Critical:** Session storage is currently set to `file` driver. For production with multiple Render instances, consider upgrading to database or Redis session storage.
