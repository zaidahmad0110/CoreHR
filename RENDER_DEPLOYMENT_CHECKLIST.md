# Render Deployment Checklist - CoreHR Backend

## Step 1: Prepare Your Backend Code

- [ ] Ensure all files are committed to Git
- [ ] Backend code is in the `/backend` directory or set appropriately in Render settings
- [ ] Test locally: `php artisan serve`
- [ ] Run migrations: `php artisan migrate --force` (for production)

## Step 2: Create Render Web Service

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Fill in the form:
   - **Name:** `corehr-v1` (or your chosen name)
   - **Environment:** `PHP`
   - **Region:** Pick closest to your users
   - **Branch:** `main` (or your default branch)

## Step 3: Set Build and Start Commands

In the Render dashboard:

**Build Command:**
```bash
composer install && php artisan migrate --force
```

**Start Command:**
```bash
php artisan serve --host=0.0.0.0 --port=10000
```

Or if you have a `dockerfile`, use:
```bash
docker build -t corehr .
```

## Step 4: Environment Variables (CRITICAL)

Copy all variables from [DEPLOYMENT_ENV_GUIDE.md](./DEPLOYMENT_ENV_GUIDE.md)

**These are the MOST IMPORTANT ones:**

| Variable | Value | Why? |
|----------|-------|------|
| `APP_URL` | `https://corehr-v1.onrender.com` | Backend URL |
| `APP_KEY` | `base64:kID78S9aBDVc9tbrSYLtPeI0nVmViDvHuJ8++K+qT94=` | Laravel encryption |
| `FRONTEND_URL` | `https://core-hr-v1.vercel.app` | Your Vercel frontend |
| `SESSION_DOMAIN` | _(leave empty)_ | **CRITICAL for CSRF!** |
| `SESSION_SECURE_COOKIE` | `true` | HTTPS only |
| `SESSION_SAME_SITE` | `none` | Cross-domain cookies |
| `SANCTUM_STATEFUL_DOMAINS` | `core-hr-v1.vercel.app,corehr-v1.onrender.com,localhost,localhost:5173,...` | Allow these domains |

⚠️ **DO NOT USE THE SAME DATABASE AS LOCAL!** Use a production database.

## Step 5: Deploy

1. Click "Deploy" button
2. Wait for build to complete (usually 5-10 minutes)
3. Check logs for errors in Render dashboard

## Step 6: Test After Deployment

```bash
# Check if backend is running
curl https://corehr-v1.onrender.com/api/public/jobs

# Check CSRF endpoint
curl -i https://corehr-v1.onrender.com/sanctum/csrf-cookie
# Should return Set-Cookie header with XSRF-TOKEN
```

## Step 7: Test Frontend Communication

From Vercel frontend:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Attempt login
4. Watch the requests:
   - GET `/sanctum/csrf-cookie` → Should get XSRF-TOKEN
   - POST `/api/login` → Should include X-XSRF-TOKEN header

## Troubleshooting

### "CSRF token mismatch"
- [ ] Verify `SESSION_DOMAIN` is **empty** (not set)
- [ ] Verify `SESSION_SAME_SITE=none`
- [ ] Verify `SESSION_SECURE_COOKIE=true`
- [ ] Check CORS is configured with `supports_credentials: true`
- [ ] Check Vercel domain is in CORS allowed_origins

### "Connection refused" / "Backend unreachable"
- [ ] Verify `APP_URL` is correct and pointing to Render domain
- [ ] Check if Render service is running (check dashboard)
- [ ] Look at Render logs for build/start errors

### "Database connection failed"
- [ ] Verify `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` are correct
- [ ] Make sure database is accessible from Render (check firewall/security groups)
- [ ] Test database connection: `php artisan migrate`

### Session not persisting
- [ ] Switch from `SESSION_DRIVER=file` to `SESSION_DRIVER=database`
- [ ] Create sessions table: `php artisan session:table && php artisan migrate`
- [ ] Or use Redis: `SESSION_DRIVER=redis` (requires Redis addon)

### Build/Deploy keeps failing
- [ ] Check Render logs for specific error messages
- [ ] Try restarting service (Render dashboard → Settings → Restart)
- [ ] Rollback to previous working version if needed

## Production Recommendations

For a production deployment:

1. **Database Sessions** - Switch from file to database:
   ```env
   SESSION_DRIVER=database
   ```
   Run: `php artisan session:table && php artisan migrate`

2. **Use Redis/Memcached** - For better performance:
   ```env
   CACHE_STORE=redis
   SESSION_DRIVER=redis
   ```

3. **Environment** - Ensure production settings:
   ```env
   APP_DEBUG=false
   APP_ENV=production
   LOG_LEVEL=error
   ```

4. **SSL Certificate** - Render provides free SSL, verify it's enabled

5. **Monitoring** - Set up error logging:
   ```env
   LOG_CHANNEL=stack
   LOG_LEVEL=error
   ```

## Useful Commands to Run

Once deployed, you can execute commands via Render shell:

```bash
# Check migrations status
php artisan migrate:status

# Run migrations (if needed)
php artisan migrate --force

# Clear caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Check app status
php artisan tinker
> check()
```

## Files Modified for Deployment

- ✅ `backend/.env` - Session and CSRF configuration fixed
- ✅ `backend/config/cors.php` - CORS configured for Vercel
- ✅ `backend/config/session.php` - Session settings loaded from .env

## Next Steps

1. Push all changes to your Git repository
2. Connect repository to Render
3. Set environment variables in Render dashboard
4. Deploy and test
5. Debug using Render logs and browser DevTools

---

**Need more help?** Check [DEPLOYMENT_ENV_GUIDE.md](./DEPLOYMENT_ENV_GUIDE.md) for detailed environment variable explanations.
