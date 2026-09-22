# LUDYS WP13.12B protected synthetic preview

Before any deployment, the product owner must review the shared shell and both
separate BM/NN bundles and provide this exact response:

`GODKJENN_WP13_12B_PREVIEW_TEKST_R2; FELLES=godkjent; BM=godkjent; NN=godkjent; sourceSetSha256=bf3ecfc58ae713bf91dd53f27b6ad5b9750a65b76bf5b73261526cae7db21d80`

Record that response with:

`npm run preview:copy:record -- --approval "<exact response>" --reviewer tryakim@gmail.com`

The recorder binds the approval to all three source SHA-256 values. Any later
copy change makes the Vercel build fail closed until a new human review.

This directory is the complete Vercel project root for the external,
synthetic-only WP13.12B preview. It has no package dependencies, database,
runtime AI, Firebase Auth, stable participant identifiers, analytics, or
long-lived cloud credentials.

The deployment must remain a Vercel Preview deployment with Standard
Deployment Protection enabled. Every API route rejects `VERCEL_ENV` values
other than `preview`. `/api/issue` and `/api/delete` additionally require the
exact deployment origin and Vercel's short-lived `x-vercel-oidc-token` header.

The server exchanges that header through Google Security Token Service and
calls IAM Credentials `generateIdToken` for the exact private Cloud Run
audience. Google Workload Identity Federation must constrain the issuer,
audience, team, project, and `environment:preview` subject. The dedicated
preview service account must have no keys and only the required per-service
invoker grants.

Browser capabilities are held only in JavaScript and password inputs for the
current page lifetime. They are sent only as bearer headers to the two public
capability endpoints. The application does not place them in URLs, persistent
browser storage, application cookies, request bodies, receipts, or logs.
Vercel Deployment Protection may independently use its own authentication
state; this application neither reads nor creates it.

Configure only these non-secret identifiers and HTTPS endpoints in the Vercel
Preview environment:

```text
LUDYS_GCP_PROJECT_NUMBER
LUDYS_GCP_WIF_POOL_ID
LUDYS_GCP_WIF_PROVIDER_ID
LUDYS_GCP_PREVIEW_SERVICE_ACCOUNT
LUDYS_ISSUE_FUNCTION_URL
LUDYS_DELETE_FUNCTION_URL
LUDYS_COMMAND_FUNCTION_URL
LUDYS_PROJECTION_FUNCTION_URL
```

Do not add `VERCEL_OIDC_TOKEN`, service-account keys, capability values, or any
local environment file. `VERCEL_ENV` and `VERCEL_URL` are Vercel system values;
Vercel injects the short-lived OIDC request header at runtime.

Run the scoped checks from this directory:

```text
node --test tests/*.test.mjs
```

`copy-review-contract.json` intentionally remains blocked until the shared
shell and both separate BM and NN bundles receive authentic human review bound
to their exact SHA-256 checksums. `node tools/copy-review-preflight.mjs` is the
Vercel build command, so a deployment fails closed while that metadata is
missing or stale. A protected deployment and a
physical two-device proof are external evidence and are not produced by these
source files.
