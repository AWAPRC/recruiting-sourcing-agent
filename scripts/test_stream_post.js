// One-candidate test of writing to Breezy's Discussion/Stream feed.
// Public v3 docs only confirm GET for this endpoint - no documented POST schema exists.
// This script tries the most REST-conventional shape first, then two fallback shapes,
// logging the FULL response body each time so we can see Breezy's real validation error
// and correct the schema from that, per the approved "test on one candidate first" plan.

const BreezyClient = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

// Test candidate: Brandon Restivo, Business Development & Outreach Representative,
// stage = Personal Impact (PII). Single candidate on this role - safe, isolated test.
const POSITION_ID = '90654c8a703c';
const CANDIDATE_ID = '5c949947c609';

const REVIEW_TEXT = `**🤖 AI Candidate Review** (auto-generated, not a team member)

**Fit summary:** Strong match on paper for Business Development & Outreach. 7 years in behavioral health admissions, including a direct Business Development Coordination Supervisor role managing referral accounts and admissions conversion. Familiar with Kipu EMR, Salesforce (Classic and Lightning), and Call Tracking Metrics systems - all tools this role touches.

**Strengths vs. Outreach hiring guide:** 4+ years admissions/customer-service experience (exceeds guide minimum). Hybrid remote experience, comfortable documenting in CRM/EMR in real time, direct crisis/family communication experience, high call volume (60+ inbound/day) background.

**Gaps / flags:** No Spanish fluency (guide lists this as a plus, not a must-have). Compensation expectation marked "Other" rather than a listed range - worth confirming in phone screen. Resume/summary field has a typo ("collage" for "college") - minor, not disqualifying.

**Recommendation:** Advance to phone screen. This is a test note generated to confirm the AI review workflow posts correctly to this feed - please disregard for actual candidate decisioning until the team has validated the format.`;

async function tryPost(client, token, company, label, body) {
  const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${CANDIDATE_ID}/stream`;
  console.log(`\n--- Attempt: ${label} ---`);
  console.log('POST', url);
  console.log('Body:', JSON.stringify(body));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
    return { status: res.status, body: text };
  } catch (e) {
    console.log('Request error:', e.message);
    return { status: 0, body: e.message };
  }
}

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log('Authenticated. Company:', company);

  // Attempt 1: {"type": "comment", "body": "..."}
  const r1 = await tryPost(client, token, company, 'type+body', { type: 'comment', body: REVIEW_TEXT });
  if (r1.status >= 200 && r1.status < 300) { console.log('\n✅ SUCCESS with attempt 1'); return; }

  // Attempt 2: {"comment": "..."}
  const r2 = await tryPost(client, token, company, 'comment field', { comment: REVIEW_TEXT });
  if (r2.status >= 200 && r2.status < 300) { console.log('\n✅ SUCCESS with attempt 2'); return; }

  // Attempt 3: {"note": {"body": "..."}}
  const r3 = await tryPost(client, token, company, 'note.body nested', { note: { body: REVIEW_TEXT } });
  if (r3.status >= 200 && r3.status < 300) { console.log('\n✅ SUCCESS with attempt 3'); return; }

  console.log('\n❌ None of the 3 tried shapes succeeded. Review the error messages above - Breezy\'s validation error usually names the expected field. Update breezy_client.js/this script once the real schema is known.');
})();
