// One-off corrective run (2026-09-23): stage-move ONLY, no comment.
//
// Root cause found: post_reviews.js hardcoded a single DQ_STAGE_ID
// (1776873797711, "❌ DQ – Role Fit") for every role. Position 4cc04907edf2
// (Virtual Creative Group Facilitator - Adolescent PHP/IOP), added after the
// 2026-09-02 stage-discovery run, actually uses a DIFFERENT stage for
// disqualified candidates: id 1765824096294, name "Disqualified". Every
// auto-disqualify attempt on that role silently 500'd on the stage-move step
// while the DQ comment posted fine (200) - so candidates got the DQ comment
// but were never actually moved out of the pipeline. Confirmed via the
// 2026-09-21 13:40 UTC batch in data/posted_reviews_log.json.
// post_reviews.js is now fixed to resolve each position's real disqualify
// stage dynamically instead of relying on one hardcoded id. This script just
// corrects the two candidates already left stranded by the old bug.
const { BreezyClient } = require('./breezy_client');
const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

const POSITION_ID = '4cc04907edf2';
const CORRECT_DQ_STAGE_ID = 1765824096294; // "Disqualified" stage on this position's pipeline

const MOVES = [
  { candidateId: '108e99c5dd5c', name: 'April Agostini' },
  { candidateId: 'b15732591fd6', name: 'ShaVanety Jones, SSP, NCSP' },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  let anyFailed = false;
  for (const m of MOVES) {
    const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${m.candidateId}/stage`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: CORRECT_DQ_STAGE_ID }),
    });
    const text = await res.text();
    console.log(`--- ${m.name} (${m.candidateId}) ---`);
    console.log('Status:', res.status);
    console.log('Response:', text.slice(0, 500));
    console.log('');
    if (res.status < 200 || res.status >= 300) anyFailed = true;
  }
  if (anyFailed) process.exitCode = 1;
})();
