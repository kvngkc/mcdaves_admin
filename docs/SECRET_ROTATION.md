# Secret Rotation Runbook - Supabase Service Role Key

## Required GitHub Actions secrets (this repo)

| Secret name | Consumed by | Rules |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | live/main DB leg (production project) | server-only, never `NEXT_PUBLIC_` |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | isolated test-DB leg | must belong to the isolated test project, never production |

Non-secret Actions **variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Rotation procedure

1. Supabase Dashboard -> Project Settings -> API -> **Roll** the `service_role` key.
2. Update the GitHub Actions secret in BOTH `kvngkc/mcdaves_admin` and `kvngkc/mcdaves_website`:
   Settings -> Secrets and variables -> Actions, or:
   ```bash
   gh secret set SUPABASE_SERVICE_ROLE_KEY --repo kvngkc/mcdaves_admin
   gh secret set SUPABASE_SERVICE_ROLE_KEY --repo kvngkc/mcdaves_website
   gh secret set TEST_SUPABASE_SERVICE_ROLE_KEY --repo kvngkc/mcdaves_admin
   gh secret set TEST_SUPABASE_SERVICE_ROLE_KEY --repo kvngkc/mcdaves_website
   ```
3. Update the runtime env on the hosting platform (e.g. Vercel) for the live service key.
4. If the isolated test project is replaced, update the workflow `env:` refs and the
   `TEST_SUPABASE_SERVICE_ROLE_KEY` secret accordingly, then re-run the regression gate.
5. Confirm the `Required Regression Gate` check is green before merging.

## Prohibited (never do)

- NEVER hardcode a `service_role` key or a real project URL in source, scripts, workflows or fixtures.
- NEVER commit a real `.env` file - only `.env.local.example` with empty values.
- NEVER expose the service-role key to the browser (no `NEXT_PUBLIC_` prefix).
