# Railway Deployment Checklist

## Pre-Deployment (Do This First)

- [ ] All code pushed to GitHub (main branch)
- [ ] Frontend `.env.production` created with correct API URL
- [ ] Backend `.env` has production values (or will set via Railway)
- [ ] No sensitive keys in code (use environment variables)
- [ ] Test locally: `php artisan serve` + `npm run dev` works

## During Deployment

- [ ] Create Railway account at railway.app
- [ ] Create new project and connect GitHub repo
- [ ] Add Backend service (set root dir to `/backend`)
- [ ] Add MySQL database service
- [ ] Add Frontend service (root dir empty, build: `npm run build`)
- [ ] Set all environment variables (see guide)
- [ ] Generate Laravel APP_KEY and add to variables
- [ ] Deploy all 3 services

## Post-Deployment

- [ ] Backend service shows "Active" status
- [ ] Frontend service shows "Active" status
- [ ] MySQL service shows "Active" status
- [ ] Check Deploy Logs for errors
- [ ] Get live URLs from each service
- [ ] Update frontend VITE_API_BASE_URL with actual backend URL
- [ ] Update backend SANCTUM_STATEFUL_DOMAINS with actual frontend URL
- [ ] Test login on live frontend URL
- [ ] Test user profile loads
- [ ] Share frontend URL as 30-day trial link

## Environment Variables Needed

### Backend Service
```
APP_NAME=CoreHR
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:xxx... (generate locally then paste)
APP_URL=https://your-backend-domain
DB_HOST=${{MYSQL.PRIVATE_URL}}
DB_PORT=3306
DB_DATABASE=railway
DB_USERNAME=${{MYSQL.USERNAME}}
DB_PASSWORD=${{MYSQL.PASSWORD}}
SESSION_DRIVER=cookie
SESSION_DOMAIN=your-domain
SESSION_SAME_SITE=none
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=your-frontend-domain.railway.app
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.railway.app
```

### Frontend Service
```
VITE_API_BASE_URL=https://your-backend-domain.railway.app
```

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Build fails | Run `npm run build` locally to test |
| Login gives 419 error | Check SANCTUM_STATEFUL_DOMAINS matches frontend URL |
| Can't connect to DB | Verify MySQL variables using ${{MYSQL.xxx}} |
| Frontend won't load | Check Deploy Logs for errors |
| CORS errors | Verify CORS_ALLOWED_ORIGINS in backend |

## When Everything Works ✅

- Share this URL with customers: `https://your-frontend.railway.app`
- They get 30-day free trial
- When ready to purchase, they sign up for $2,500/year
- Upgrade Railway to paid tier when scaling

---

**Estimated Time:** 30-45 minutes
