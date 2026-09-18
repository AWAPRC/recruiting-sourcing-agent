// One-off retry for candidates whose stream post failed (e.g. transient 500).
// Usage: node scripts/retry_one.js
const { BreezyClient } = require('./breezy_client');
const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const AI_LABEL = '**🤖 AI Candidate Review** (auto-generated, not a team member)\n\n';

// Retry batch 2026-09-18: these two failed with a transient 500 during the
// "Post pending AI reviews" run (position 4cc04907edf2, Virtual Creative
// Group Facilitator). Everyone else in that run posted successfully.
const RETRIES = [
  {
    positionId: '4cc04907edf2',
    candidateId: 'cab4788b65cb',
    name: 'Alexandra D',
    review: "_No standing hiring guide for Virtual Creative Group Facilitator — per Devanne, this varies role-to-role/batch-to-batch, so reviewing on general judgment only; comment-only, no disqualify action taken._\n\n\n**Fit summary:** No usable data to assess.\n**Strengths:** None identifiable from the data provided.\n**Gaps:** Headline, summary, education, work history, cover letter, and questionnaire are all blank.\n**Consistency check:** N/A.\n**Tenure/timeline notes:** N/A.\n**Recommendation:** Comment-only, no guide loaded and no usable application data — already at Leadership stage, deferring to direct-conversation context; recommend a profile check in Breezy if this is unexpected.",
  },
  {
    positionId: '4cc04907edf2',
    candidateId: 'b783554f04c0',
    name: 'Karen Taveras',
    review: "_No standing hiring guide for Virtual Creative Group Facilitator — per Devanne, this varies role-to-role/batch-to-batch, so reviewing on general judgment only; comment-only, no disqualify action taken._\n\n\n**Fit summary:** Strong, directly-relevant creative-arts therapy background with a youth/trauma focus, even without a formal guide.\n**Strengths:** M.A. in Drama Therapy; multiple roles facilitating trauma-informed creative-arts groups for youth and survivors using mixed modalities (drama, music, visual art, movement); pursuing full creative-arts-therapy licensure.\n**Gaps:** Adolescent-specific (13-17) experience is described as \"school or educational setting\" rather than clinical PHP/IOP; no Spanish fluency listed.\n**Consistency check:** No discrepancies found.\n**Tenure/timeline notes:** One listed role shows an end date before its start date (9/2007-9/2003) — very likely a data-entry error rather than a real inconsistency; worth a quick confirm of actual dates. [VERIFY]\n**Recommendation:** Comment-only, no guide loaded — strong creative-arts-therapy fit; already at Leadership stage, deferring to that context.",
  },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  let anyFailed = false;
  for (const r of RETRIES) {
    const url = `https://api.breezy.hr/v3/company/${company}/position/${r.positionId}/candidate/${r.candidateId}/stream`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'comment', body: AI_LABEL + r.review }),
    });
    const text = await res.text();
    console.log(`--- ${r.name} (${r.candidateId}) ---`);
    console.log('Status:', res.status);
    console.log('Response:', text.slice(0, 500));
    console.log('');
    if (res.status < 200 || res.status >= 300) anyFailed = true;
  }
  if (anyFailed) process.exitCode = 1;
})();
