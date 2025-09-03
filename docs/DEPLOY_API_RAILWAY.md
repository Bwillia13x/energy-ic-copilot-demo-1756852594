# Deploying the API on Railway

This repo includes everything needed to deploy `apps/api` to Railway quickly.

## What you need

- Railway account
- A Railway Project (create in the UI)
- A Railway token (Account → Tokens)
- The Railway Project ID (Project → Settings → General → Project ID)

## Configure GitHub Secrets

Add in GitHub → Settings → Secrets and variables → Actions:

- `RAILWAY_TOKEN`: your Railway token
- `RAILWAY_PROJECT_ID`: your Railway project ID

## Deploy via GitHub Actions

Run the manual workflow:

- Actions → "Deploy API to Railway (Manual)" → Run workflow
  - environment: `production` (optional)
  - service: `api` (default)

The workflow uses the Railway CLI to deploy from `apps/api` with your token.

## First-time setup on Railway

- After the first deploy, open the Railway UI → your service → copy the public domain URL
- Set `NEXT_PUBLIC_API_URL` in Vercel (Production and Preview) to that URL
  - Example: `https://your-railway-subdomain.up.railway.app`
- Redeploy the frontend

## CORS & Ports

- The API now reads `PORT` from env (Railway sets this automatically)
- CORS allowlist can be overridden via `ALLOWED_ORIGINS` env (comma-separated), e.g.:
  - `https://energy-ic-copilot.vercel.app,https://energy-ic-copilot-*.vercel.app`

## Alternative: Docker

- `apps/api/Dockerfile` is provided. Railway will use Nixpacks by default, but you can switch to Docker in the service settings if you prefer.

