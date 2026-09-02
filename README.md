# AWA/PRC Recruiting Sourcing Agent

An AI recruiting agent, assignable per open role, that sources candidates, screens/ranks resumes,
drafts outreach, and syncs into Breezy HR — mirroring the architecture of the P&C Recruiting
Dashboard project (same Breezy auth pattern, same GitHub Actions -> Netlify deploy workaround for
network egress).

## Status
Scaffolding only. Business Development (Breezy) is the pilot role.

## Architecture
- `scripts/` — Node scripts that talk to Breezy HR's API (same auth pattern as the dashboard).
- `.github/workflows/` — GitHub Actions run the actual network calls (Breezy, job boards) since
  those hosts are not reachable from the Claude session sandbox directly. This is the same
  "workaround" the dashboard project uses.
- Netlify — hosts the UI (a simple app where you pick a role and review sourced/screened candidates).

## Setup
1. Create a **private** GitHub repo, push this folder to it.
2. Add repo secrets (Settings -> Secrets and variables -> Actions):
   - `BREEZY_EMAIL`, `BREEZY_PASSWORD` — same login as the dashboard project
   - `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` — new Netlify site for this project (separate from the dashboard's site)
3. Run the pilot pull for Business Development via Actions (workflow_dispatch) or `node scripts/list_positions.js` locally once credentials are available in an environment with network access.
