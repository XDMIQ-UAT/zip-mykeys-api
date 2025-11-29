# How to Get Vercel Project ID

## Method 1: From Vercel Dashboard (Easiest)

1. Go to your project: https://vercel.com/xdmiq/zip-myl-mykeys-api
2. Click on **Settings** (in the top navigation)
3. Scroll down to **General** section
4. The **Project ID** is displayed there

## Method 2: From Vercel API

If you have `VERCEL_TOKEN` set:

```powershell
$headers = @{ "Authorization" = "Bearer $env:VERCEL_TOKEN" }
$projects = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?teamId=xdmiq" -Headers $headers
$project = $projects.projects | Where-Object { $_.name -eq "zip-myl-mykeys-api" }
$project.id
```

## Method 3: From Browser DevTools

1. Open your project in Vercel dashboard
2. Open browser DevTools (F12)
3. Go to Network tab
4. Refresh the page
5. Look for API calls to `vercel.com/v9/projects/...`
6. The project ID will be in the response

## Method 4: From Deployment URL

The project ID is sometimes visible in deployment URLs or API responses.

## For Credential Rotation Script

The rotation script (`rotate-vercel-gcp-credentials.ps1`) will try to automatically detect the project ID, but if it fails, you can:

1. Set it manually in the script
2. Or update the script to use the project name instead of ID
3. Or provide it via environment variable: `$env:VERCEL_PROJECT_ID = "your-project-id"`

## Current Project Info

- **Project Name:** `zip-myl-mykeys-api`
- **Team:** `xdmiq` (formerly `ici1`)
- **Project ID:** (check dashboard or use methods above)




