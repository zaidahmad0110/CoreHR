# Railway Deployment Guide - CoreHR

Deploy your entire CoreHR project (React + Laravel + MySQL) to Railway in one platform.

---

## Prerequisites

✅ GitHub account with code pushed  
✅ Railway account (free at railway.app)  
✅ Git installed locally  

---

## Step 1: Prepare Your GitHub Repository

Your code must be on GitHub in a single repository with this structure:

```
CoreHR/
├── src/                    (React frontend)
├── backend/                (Laravel backend)
├── package.json           (Frontend dependencies)
├── vite.config.ts         (Frontend config)
└── README.md
```

### Make sure to push all changes:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

---

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub"**
4. Authorize GitHub access
5. Select your **CoreHR repository**
6. Click **"Deploy"**

Railway will auto-detect and start deploying. You'll see the project dashboard.

---

## Step 3: Add Backend Service (Laravel)

Railway may have already added a service. Configure it:

### 3.1 Set Backend Root Directory

1. Click the service card in dashboard
2. Go to **"Settings"** tab
3. Set **"Root Directory"** to: `backend`
4. Click **"Deploy"**

### 3.2 Add Environment Variables

Click the service → **"Variables"** tab → Add these:

```
APP_NAME=CoreHR
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:kID78S9aBDVc9tbrSYLtPeI0nVmViDvHuJ8++K+qT94=
APP_URL=https://corehrv1-production.up.railway.app/

DB_HOST=${{MYSQL.PRIVATE_URL}}
DB_PORT=3306
DB_DATABASE=railway
DB_USERNAME=${{MYSQL.USERNAME}}
DB_PASSWORD=${{MYSQL.PASSWORD}}

SESSION_DRIVER=cookie
SESSION_DOMAIN=corehrv1-production.up.railway.app
SESSION_PATH=/
SESSION_SAME_SITE=none
SESSION_SECURE_COOKIE=true

SANCTUM_STATEFUL_DOMAINS=[your-frontend-domain].railway.app
CORS_ALLOWED_ORIGINS=https://[your-frontend-domain].railway.app
FRONTEND_URL=https://[your-frontend-domain].railway.app
```

**Note:** Replace `[your-frontend-domain]` with your actual frontend Railway domain once deployed.

### 3.3 Generate Laravel Key

In Railway dashboard, open **"Deploy Logs"** for the backend service.

Look for this line:
```
php artisan key:generate
```

If it's not there, you need to add it to `backend/Dockerfile` or run:
```bash
php artisan key:generate --show
```

Copy the generated key and add to variables as `APP_KEY=base64:xxx...`

---

## Step 4: Add Database Service (MySQL)

1. In Railway dashboard, click **"New Service"**
2. Select **"MySQL"**
3. Railway will auto-provision a MySQL database

You'll see connection details in the service. These are used automatically via `${{MYSQL.xxx}}` variables.

---

## Step 5: Add Frontend Service (Node.js)

1. In Railway dashboard, click **"New Service"**
2. Click **"GitHub"** → Select your CoreHR repo again
3. Configure as Frontend:
   - **Root Directory:** (leave empty - defaults to root)
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run preview`

### 5.1 Backend Environment Variables (Frontend)

Click the frontend service → **"Variables"** → Add:

```
VITE_API_BASE_URL=https://[backend-service-url].railway.app
```

**Note:** Replace `[backend-service-url]` with actual Railway backend domain after deployment completes.

---

## Step 6: Deploy Services

Your Railway project now has 3 services:
- **Backend** (Laravel)
- **Frontend** (React)
- **Database** (MySQL)

1. Each service will auto-deploy
2. Monitor logs in the **"Deploy"** tab
3. Wait for all 3 to show **"Active"** status

---

## Step 7: Run Migrations

Once backend is running at `https://corehrv1-production.up.railway.app/`:

1. Go to backend service → **"Deployments"**
2. Click the latest deployment → **"Logs"**
3. Check if migrations ran automatically

If not, you need to add to `backend/Dockerfile`:

```dockerfile
RUN php artisan migrate --force
```

Or connect via Railway CLI:
```bash
railway run php artisan migrate
```

**Verification:** Try curling the API:
```bash
curl https://corehrv1-production.up.railway.app/api/login
```

Should return JSON response (not HTML error).

---

## Step 8: Get Live URLs

Once all services are deployed:

**Your Backend is live at:**
```
https://corehrv1-production.up.railway.app/
```

1. Click **Frontend service** → Copy the generated URL (e.g., `https://corehr-frontend.railway.app`)

Update environment variables:

**Frontend service Variables:**
```
VITE_API_BASE_URL=https://corehrv1-production.up.railway.app
```

**Backend service Variables (already set):**
```
SANCTUM_STATEFUL_DOMAINS=corehr-frontend.railway.app
CORS_ALLOWED_ORIGINS=https://corehr-frontend.railway.app
APP_URL=https://corehrv1-production.up.railway.app/
```

---

## Step 9: Test the Deployment

1. Open frontend URL in browser: `https://corehr-frontend.railway.app`
2. Try to **login**
3. Should connect to backend without CSRF errors
4. Check user profile loads correctly

If you get errors:
- Check **Deploy Logs** for each service
- Verify **Variables** are set correctly
- Ensure database migrations ran

---

## Step 10: Custom Domain (Optional)

To use your own domain:

1. Go to service → **"Settings"**
2. Scroll to **"Domains"**
3. Add custom domain (e.g., `app.yoursite.com`)
4. Update DNS records per Railway instructions

---

## Troubleshooting

### "Build failed" for Frontend
- Check `npm run build` works locally
- Verify all dependencies in `package.json`
- Check for TypeScript errors: `npm run build`

### "Service not connecting" (backend)
- Check DB credentials in Variables
- Verify `SANCTUM_STATEFUL_DOMAINS` matches frontend URL
- Check `APP_KEY` is set

### "CSRF token mismatch" on login
- Verify `SESSION_SAME_SITE=none`
- Ensure `VITE_API_BASE_URL` points to correct backend
- Check cookies are being sent (use browser DevTools)

### Database not found
- Check MySQL service is in "Active" status
- Verify migration ran (check Deploy Logs)
- Test connection manually via Railway CLI

---

## Quick Reference: Railway CLI (Optional)

If you need more control:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs

# Run migrations
railway run php artisan migrate

# Access backend shell
railway shell
```

---

## After Deployment

✅ CoreHR is now live  
✅ Share frontend URL with customers for 30-day trial  
✅ Monitor logs for errors  
✅ Scale services if needed (upgrading from free tier)  

---

## Cost Estimate

| Service | Free Tier | Approximate Cost |
|---------|-----------|-----------------|
| Railway Credits | $5/month free | $0 |
| Backend (512MB) | Included | ~$5-7/mo when paid |
| Frontend (512MB) | Included | ~$5-7/mo when paid |
| Database (MySQL) | Included | ~$10-15/mo when paid |
| **Total** | | **$0-7/month** (free tier) |

---

## Next Steps

1. Deploy to Railway following this guide
2. Test login flow end-to-end
3. Share frontend URL with Yasmin Blasi for 30-day trial
4. Monitor logs for issues
5. When ready, upgrade to paid plan for production

---

**Questions?** Check Railway docs: https://docs.railway.app
