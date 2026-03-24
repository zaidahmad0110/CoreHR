# Quick Troubleshooting Card

## 🚨 Getting "CSRF token mismatch"?

### Check 1: Render Environment Variables
```bash
# In Render Dashboard → Settings → Environment Variables
SESSION_DOMAIN=              # MUST BE EMPTY (not set to a domain)
SESSION_SAME_SITE=none       # MUST BE: none
SESSION_SECURE_COOKIE=true   # MUST BE: true
```

### Check 2: Browser Cookies
Press F12 → Application → Cookies
- Should see `XSRF-TOKEN` after visiting login page ✓
- Should see `LARAVEL_SESSION` (or similar) after login ✓

### Check 3: Network Requests
Press F12 → Network tab → Attempt login
```
GET     /sanctum/csrf-cookie         → 204 or 200
        Set-Cookie: XSRF-TOKEN=...   ← Must have this

POST    /api/login                   → 200
        Header: X-XSRF-TOKEN=...     ← Must send this
        Set-Cookie: LARAVEL_SESSION  ← Must get this back
```

### Check 4: Verify Backend is Running
```bash
# From terminal or Postman
curl https://corehr-v1.onrender.com/api/public/jobs

# Should return JSON data, not error
```

---

## 🔄 Data Not Sending/Receiving?

### Check 1: API URL
In Vercel Environment Variables:
```env
VITE_API_BASE_URL=https://corehr-v1.onrender.com
```

### Check 2: Backend Awake
```bash
# Your backend might be sleeping if Render has free tier
# Ping it multiple times if it's slow to respond first time

curl https://corehr-v1.onrender.com/api/public/jobs
# If slow, wait 30 seconds and try again
```

### Check 3: CORS Allowed
Check `backend/config/cors.php`:
```php
'allowed_origins' => [
    'https://core-hr-v1.vercel.app',  // ← Your Vercel URL must be here
],
```

If missing, add your Vercel URL and redeploy backend.

### Check 4: Database Connected
```bash
# Check Render logs for database connection errors
# Ensure DB variables are correct:
DB_HOST=sql8.freesqldatabase.com
DB_PORT=3306
DB_DATABASE=sql8820970
DB_USERNAME=sql8820970
DB_PASSWORD=UfM4sppRQT
```

---

## 📊 Testing Send/Receive

### Simple Test in Browser Console
```javascript
// After login (in browser DevTools console)

// 1. Get CSRF token
await fetch('https://corehr-v1.onrender.com/sanctum/csrf-cookie', {
  credentials: 'include'
});

// 2. Get user data
const response = await fetch('https://corehr-v1.onrender.com/api/me', {
  credentials: 'include',
  headers: {
    'Accept': 'application/json'
  }
});
const user = await response.json();
console.log(user);

// 3. Create test data
const createResponse = await fetch(
  'https://corehr-v1.onrender.com/api/employees',
  {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-XSRF-TOKEN': document.cookie.split('XSRF-TOKEN=')[1]?.split(';')[0]
    },
    body: JSON.stringify({
      name: 'Test Employee',
      email: 'test@example.com',
      job_title: 'Test'
    })
  }
);
console.log(await createResponse.json());
```

---

## 🔧 Quick Fixes

### Fix 1: Clear Everything & Retry
1. Close all browser tabs with the app
2. Clear all cookies:
   - Settings → Privacy & Security → Delete cookies
3. Hard refresh: Ctrl+Shift+R
4. Try login again

### Fix 2: Restart Render Service
```bash
# Render Dashboard → Services → corehr-v1 → Settings → Restart
```

### Fix 3: Check Render Logs
```
Render Dashboard 
  → corehr-v1 service 
  → Logs 
  → Look for errors (red text)
```

Common errors:
- `SQLSTATE[HY000]` → Database connection failed
- `Class not found` → Migration failed, run: `php artisan migrate --force`
- `DRIVER [file]` → Session driver error, check SESSION_DRIVER env var

### Fix 4: Redeploy Backend
```bash
Render Dashboard → corehr-v1 → Manual Deploy → Deploy
```

---

## 📋 Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| **CSRF token mismatch** | SESSION_DOMAIN not empty | Set SESSION_DOMAIN to empty string |
| **No 'Access-Control-Allow-Origin'** | Vercel domain not in CORS | Add your Vercel domain to `backend/config/cors.php` |
| **401 Unauthorized** | Not logged in or session expired | Clear cookies and login again |
| **Failed to fetch / Network error** | Backend down or wrong URL | Check VITE_API_BASE_URL and if Render is running |
| **Database connection failed** | DB credentials wrong | Verify DB_* variables in Render |
| **Method not allowed (405)** | Wrong HTTP method | Check if POST/GET/PATCH/DELETE are correct |
| **Validation error (422)** | Required fields missing | Check API request body has all required fields |
| **Session lost on refresh** | SESSION_DRIVER=file not persistent | Switch to database or redis driver |

---

## 🎯 Step-by-Step Deployment Fix

### For Render Backend:

1. **Update `.env` file locally:**
   ```env
   SESSION_DOMAIN=                # Empty, not corehr-v1.onrender.com
   SESSION_SAME_SITE=none
   SESSION_SECURE_COOKIE=true
   SESSION_HTTP_ONLY=true
   ```

2. **Push to Git:**
   ```bash
   git add backend/.env
   git commit -m "Fix CSRF token mismatch"
   git push origin main
   ```

3. **Update Render Dashboard:**
   - Settings → Environment Variables
   - Update all SESSION_* variables
   - Trigger redeploy

### For Vercel Frontend:

1. **Set environment variable:**
   - Settings → Environment Variables
   - `VITE_API_BASE_URL=https://corehr-v1.onrender.com`

2. **Push to Git (if needed):**
   ```bash
   git push origin main
   # Vercel auto-deploys
   ```

---

## 📞 When Nothing Works

### Collect Debug Info:

1. **Render backend URL:**
   ```
   https://corehr-v1.onrender.com
   ```

2. **Vercel frontend URL:**
   ```
   https://core-hr-v1.vercel.app
   ```

3. **Browser console error (F12 → Console):**
   Copy exact error message

4. **Network error (F12 → Network):**
   Click failing request → Response tab → Copy response

5. **Check specific endpoint:**
   ```bash
   curl -v https://corehr-v1.onrender.com/sanctum/csrf-cookie
   # Look for Set-Cookie header
   ```

6. **Render logs:**
   ```
   Render Dashboard → Logs → Copy last 50 lines
   ```

With this info, debugging becomes much easier!

---

## ✅ Success Checklist

After implementing the fix, verify:

- [ ] `SESSION_DOMAIN` is **empty** in Render
- [ ] Can login without CSRF token mismatch error
- [ ] Can view user profile (GET /api/me)
- [ ] Can create employee (POST /api/employees)
- [ ] Can edit employee (PATCH /api/employees/{id})
- [ ] Can delete employee (DELETE /api/employees/{id})
- [ ] Session persists across page refreshes
- [ ] Logout clears session

If all ✅, **you're good to go!**

---

**Need more help?** See:
- **CSRF_FIX_SUMMARY.md** - Full explanation of the fix
- **DEPLOYMENT_ENV_GUIDE.md** - Environment variable reference
- **RENDER_DEPLOYMENT_CHECKLIST.md** - Complete Render setup guide
- **VERCEL_DEPLOYMENT_GUIDE.md** - Complete Vercel setup guide
