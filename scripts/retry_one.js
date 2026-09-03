// One-off retry for a single candidate whose stream post failed (e.g. transient 500).
// Usage: node scripts/retry_one.js
const { BreezyClient } = require('./breezy_client');
const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '70abb2f01e85'; // Adolescent Services Manager
const CANDIDATE_ID = '2b221d1f800e'; // Tracy Howze
const AI_LABEL = '**🤖 AI Candidate Review** (auto-generated, not a team member)\n\n';
const REVIEW = "**Fit summary:** Limited seniority for this role - only 16 months as Site Supervisor, most experience is entry-level behavior technician work. **Strengths:** 3-4 yrs adolescent-adjacent experience, genuine passion in cover letter. **Gaps:** Comp expectation listed as $19-21 (hourly), which suggests she may be applying under the assumption this is an hourly/entry role rather than a salaried management position. **Recommendation:** Likely not a fit for the seniority this role requires - worth clarifying comp expectations before advancing, if at all.";

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${CANDIDATE_ID}/stream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'comment', body: AI_LABEL + REVIEW }),
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text.slice(0, 500));
  if (res.status < 200 || res.status >= 300) process.exitCode = 1;
})();
