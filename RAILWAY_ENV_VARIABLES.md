# Railway Production Environment Variables

**Backend URL:** `https://corehrv1-production.up.railway.app`

---

## For Backend Service (Laravel)

Copy and paste these into Railway Dashboard → Backend Service → Variables:

```
APP_NAME=CoreHR
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:kID78S9aBDVc9tbrSYLtPeI0nVmViDvHuJ8++K+qT94=
APP_URL=https://corehrv1-production.up.railway.app/

DB_CONNECTION=mysql
DB_HOST=${{MYSQL.PRIVATE_URL}}
DB_PORT=3306
DB_DATABASE=railway
DB_USERNAME=${{MYSQL.USERNAME}}
DB_PASSWORD=${{MYSQL.PASSWORD}}

LOG_CHANNEL=stack
LOG_LEVEL=error

SESSION_DRIVER=cookie
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=corehrv1-production.up.railway.app
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none
SESSION_HTTP_ONLY=true

SANCTUM_STATEFUL_DOMAINS=[your-frontend-domain].railway.app
CORS_ALLOWED_ORIGINS=https://[your-frontend-domain].railway.app
FRONTEND_URL=https://[your-frontend-domain].railway.app

BROADCAST_CONNECTION=log
QUEUE_CONNECTION=sync
CACHE_STORE=file
FILESYSTEM_DISK=local
```

**Replace:** `[your-frontend-domain]` with your actual Railway frontend subdomain (e.g., `corehr-frontend`)

---

## For Frontend Service (React)

Copy and paste these into Railway Dashboard → Frontend Service → Variables:

```
VITE_API_BASE_URL=https://corehrv1-production.up.railway.app
```

---

## Quick Copy-Paste Blocks

### Backend Complete (Copy All At Once)
```
APP_NAME=CoreHR
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:kID78S9aBDVc9tbrSYLtPeI0nVmViDvHuJ8++K+qT94=
APP_URL=https://corehrv1-production.up.railway.app/
DB_CONNECTION=mysql
DB_HOST=${{MYSQL.PRIVATE_URL}}
DB_PORT=3306
DB_DATABASE=railway
DB_USERNAME=${{MYSQL.USERNAME}}
DB_PASSWORD=${{MYSQL.PASSWORD}}
LOG_CHANNEL=stack
LOG_LEVEL=error
SESSION_DRIVER=cookie
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=corehrv1-production.up.railway.app
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none
SESSION_HTTP_ONLY=true
SANCTUM_STATEFUL_DOMAINS=[YOUR_FRONTEND_DOMAIN].railway.app
CORS_ALLOWED_ORIGINS=https://[YOUR_FRONTEND_DOMAIN].railway.app
FRONTEND_URL=https://[YOUR_FRONTEND_DOMAIN].railway.app
BROADCAST_CONNECTION=log
QUEUE_CONNECTION=sync
CACHE_STORE=file
FILESYSTEM_DISK=local
```

---

## Next Steps

1. **Deploy Frontend** to Railway
2. **Note the frontend domain** from Railway dashboard
3. **Replace** `[YOUR_FRONTEND_DOMAIN]` in above variables
4. **Paste** into Railway Backend Service → Variables
5. **Deploy** to apply changes
6. **Test** at `https://[your-frontend-domain].railway.app`

---

## Testing Backend

Verify backend is working:

```bash
curl https://corehrv1-production.up.railway.app/api/login
```

Should return JSON (not HTML error page).

---

## Support

- **Backend URL Issues?** Check APP_URL in variables
- **CORS Errors?** Update CORS_ALLOWED_ORIGINS with frontend domain
- **Login 419 Errors?** Check SANCTUM_STATEFUL_DOMAINS matches frontend
