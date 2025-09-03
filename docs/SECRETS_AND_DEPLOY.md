# Secrets, Env Vars, and Deployment Hooks

This document explains how environment variables and deploy hooks are handled, and what to update when rotating credentials.

## NEXT_PUBLIC_API_URL in Production

The frontend reads `NEXT_PUBLIC_API_URL` at build time. Configure it in one of these places:

- GitHub Actions: set `N
EXT_PUBLIC_API_URL` as a Repository Secret (preferred) or Repository/Org Variable. The CI build step consumes it automatically.
- Vercel Project Settings: add `NEXT_PUBLIC_API_URL` under Settings → Environment Variables.

Notes:
- The repo no longer hardcodes `NEXT_PUBLIC_API_URL` in `vercel.json` to avoid accidental demo defaults in production.
- Local dev examples remain in `.env.example` and `apps/web/ENV_EXAMPLE`.

## Vercel Deploy Hook (optional)

If you want CI to trigger a Vercel deployment after successful tests/builds:

1) In Vercel Project Settings → Deploy Hooks, create a new hook for your target branch (e.g., `main`).
2) Copy the generated URL and add it to GitHub → Settings → Secrets and variables → Actions as `VERCEL_DEPLOY_HOOK_URL`.
3) The `deploy` job in `.github/workflows/ci.yml` will POST to the hook when the secret is present.

Test the hook locally:

```
curl -fsS -X POST "<your-hook-url>" -H 'Content-Type: application/json' -d '{"source":"manual-test"}'
```

## Rotating a Leaked Vercel Token/Hook

If a Vercel token or deploy hook was exposed:

1) In Vercel, revoke the compromised token/hook and create a new one.
2) Update GitHub Secrets with the new value (e.g., `VERCEL_DEPLOY_HOOK_URL`).
3) Audit recent commits and ensure any token files are removed from the repo and `.gitignore` prevents re-adding them.

## Summary

- Configure `NEXT_PUBLIC_API_URL` via CI secrets/vars or Vercel env.
- Use a Vercel deploy hook only if you want CI-triggered deployments.
- Rotate and update secrets immediately if exposed.

