# Vercel Deployment Configuration - CoreHR Frontend

## Overview
This guide covers deploying your React/TypeScript frontend to Vercel with proper API communication to your Render backend.

## Vercel Project Setup

### Step 1: Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** React
   - **Root Directory:** `.` (project root)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 2: Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables

```env
VITE_API_BASE_URL=https://corehr-v1.onrender.com
```

**For multiple environments:**

```env
# Production
VITE_API_BASE_URL=https://corehr-v1.onrender.com

# Preview/Staging (if you have a staging backend)
VITE_API_BASE_URL=https://staging-backend.onrender.com
```

### Step 3: Deploy

Push to your main branch, Vercel automatically deploys.

```bash
git push origin main
```

Vercel will show build logs and deployment URL:
```
✓ Deployed to https://core-hr-v1.vercel.app
```

## Frontend Configuration

### package.json Build Scripts

Ensure you have these scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  }
}
```

### Vite Configuration (vite.config.ts)

Your vite.config.ts should be set up for building:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
```

### API Client Configuration

The frontend API client (`src/app/api/client.ts`) correctly:
- ✅ Reads API base URL from `VITE_API_BASE_URL` environment variable
- ✅ Includes credentials for cookie transmission
- ✅ Handles CSRF token from `/sanctum/csrf-cookie`
- ✅ Adds `X-XSRF-TOKEN` header to non-GET requests

**No changes needed** if your client.ts has:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://corehr-v1.onrender.com";

export async function ensureCsrfCookie() {
  await fetch(buildUrl("/sanctum/csrf-cookie"), {
    method: "GET",
    credentials: "include",  // ← Important!
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // ... code ...
  const response = await fetch(buildUrl(path), {
    method,
    credentials: "include",  // ← Important!
    headers,
    // ... code ...
  });
  // ... code ...
}
```

## Testing Before Deployment

### Local Testing

1. Start backend locally:
   ```bash
   cd backend
   php artisan serve --host=127.0.0.1 --port=8000
   ```

2. Start frontend locally:
   ```bash
   npm run dev
   ```

3. Set correct API endpoint in browser:
   ```bash
   # Access at http://localhost:5173
   # Should connect to http://127.0.0.1:8000
   ```

4. Test login:
   - Open DevTools → Network tab
   - Submit login form
   - Check for CSRF token and session cookies

### Production Testing (After Vercel Deployment)

1. Visit https://core-hr-v1.vercel.app
2. Open DevTools → Network tab
3. Attempt login
4. Verify requests:
   ```
   GET https://corehr-v1.onrender.com/sanctum/csrf-cookie
   ✓ Status: 204 or 200
   ✓ Set-Cookie header with XSRF-TOKEN
   
   POST https://corehr-v1.onrender.com/api/login
   ✓ Status: 200
   ✓ X-XSRF-TOKEN header present
   ✓ Session cookie set
   ```

## Common Issues & Solutions

### Issue 1: "Network Error" / "Failed to fetch"

**Cause:** API URL is incorrect or backend is down

**Solution:**
- [ ] Verify `VITE_API_BASE_URL` in Vercel settings
- [ ] Check if backend is running at that URL
- [ ] Test: `curl https://corehr-v1.onrender.com/api/public/jobs`

### Issue 2: "CORS error" / "No 'Access-Control-Allow-Origin'"

**Cause:** Backend CORS config doesn't allow the Vercel domain

**Solution:**
- [ ] Verify backend CORS config includes your Vercel domain
- [ ] Check `backend/config/cors.php`:
   ```php
   'allowed_origins' => [
       'https://core-hr-v1.vercel.app',  // ← Your Vercel URL
       'http://localhost:5173',
       'http://127.0.0.1:5173',
   ],
   ```
- [ ] Redeploy backend if you modified CORS

### Issue 3: "CSRF token mismatch"

**Cause:** Session or CSRF configuration issue

**Solution:**
- [ ] Check backend `SESSION_DOMAIN` is empty
- [ ] Verify `SESSION_SAME_SITE=none`
- [ ] Clear browser cookies and try again
- [ ] See [DEPLOYMENT_ENV_GUIDE.md](./DEPLOYMENT_ENV_GUIDE.md)

### Issue 4: Build fails on Vercel

**Symptoms:** Deploy fails with TypeScript or build errors

**Solution:**
- [ ] Check Vercel build logs for actual error
- [ ] Ensure `tsc -b && vite build` works locally
- [ ] Check for TypeScript errors: `npx tsc`
- [ ] Verify all imports are correct
- [ ] Try: `npm run build` locally to replicate error

## Environment-Specific Configuration

### Development
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_DEBUG=true
```

### Staging (Optional)
```env
VITE_API_BASE_URL=https://staging.onrender.com
VITE_DEBUG=false
```

### Production
```env
VITE_API_BASE_URL=https://corehr-v1.onrender.com
VITE_DEBUG=false
```

## Optimizations for Production

### 1. Build Size Analysis
```bash
npm run build
npm install -g vite-bundle-visualizer
npm exec vite-bundle-visualizer
```

### 2. Code Splitting
Vite already does automatic code splitting for optimization.

### 3. Image Optimization
- Use WebP format where possible
- Compress images before uploading
- Consider using an image CDN

### 4. Caching in Vercel
All static assets are cached with version hashes. HTML files are not cached to allow updates.

## Vercel-Specific Features

### Preview Deployments
Every pull request gets a preview deployment:
```
https://corehr-v1-git-feature-xyz.vercel.app
```

### Analytics
Enable in Vercel → Settings → Analytics to monitor:
- Page load times
- Web Vitals (Core Web Vitals)
- Performance metrics

### Custom Domain
Add custom domain in Vercel → Domains:
```
Add: corehr.yourdomain.com
```

## Deployment Workflow

1. **Local Development**
   ```bash
   npm run dev  # Test locally
   ```

2. **Create Pull Request**
   ```bash
   git checkout -b feature/xyz
   git push origin feature/xyz
   # GitHub → Create pull request
   # Vercel → Automatic preview deployment
   ```

3. **Verify Preview**
   - Test feature on preview deployment
   - Check console for errors

4. **Merge to Main**
   ```bash
   # After approval, merge PR
   git merge feature/xyz
   git push origin main
   ```

5. **Vercel Auto-Deploys**
   - Deployment automatically starts
   - Check build logs for success
   - Visit production URL to verify

## Performance Tips

1. **Monitor bundle size:**
   ```bash
   npm run build
   # Check dist folder size
   ```

2. **Lazy load components:**
   ```typescript
   import { lazy, Suspense } from 'react';
   const HeavyComponent = lazy(() => import('./HeavyComponent'));
   
   export function App() {
     return (
       <Suspense fallback={<div>Loading...</div>}>
         <HeavyComponent />
       </Suspense>
     );
   }
   ```

3. **Monitor API calls:**
   - Use DevTools Network tab during build
   - Avoid duplicate API calls
   - Cache data appropriately

## Rollback Instructions

If deployment causes issues:

1. **Via Vercel Dashboard:**
   - Deployments → click previous working version → "Redeploy"

2. **Via Git:**
   ```bash
   git revert HEAD  # Revert last commit
   git push origin main  # Vercel redeploys
   ```

## Monitoring

### Set Up Error Tracking
Consider integrating error tracking (optional):
```typescript
// Example with Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### View Logs
Check Vercel logs:
- Vercel Dashboard → Deployments → click version → Logs
- Browser Console → F12 to see any frontend errors

---

**Deployment Checklist:**
- [ ] `VITE_API_BASE_URL` set in Vercel
- [ ] Backend CORS includes your Vercel domain
- [ ] Git repository connected to Vercel
- [ ] `npm run build` works locally
- [ ] No TypeScript errors
- [ ] API connectivity tested before deployment

**Next Steps:** See [RENDER_DEPLOYMENT_CHECKLIST.md](./RENDER_DEPLOYMENT_CHECKLIST.md) for backend deployment.
