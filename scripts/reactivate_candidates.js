// One-off (2026-09-24): reactivate candidates on Virtual Intake Coordinator /
// Mental Health Program Coordinator (position a6cf9ac42d96) who were sitting
// in Disqualified but clearly meet every must-have (bilingual, FL-based,
// directly relevant setting, comp in range, no red flags) per Devanne's
// DQ audit on 2026-09-23. Moves them back to "applied" so they flow into
// the normal review pipeline again instead of staying stranded in DQ.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = 'a6cf9ac42d96';
const TARGET_STAGE_ID = 'applied'; // "Applied" stage on this position's pipeline

const CANDIDATES = [
  { name: 'Ann Marie Serrano', candidateId: '2d1221bcbd78' },
  { name: 'Viviana Morales', candidateId: '4843f8a70ec8' },
  { name: 'Lynda Valois', candidateId: 'ef5a22278c48' },
  { name: 'Enriette Barbara', candidateId: 'efc7d1e7c05e' },
  { name: 'Louis Rosario', candidateId: '85e994b31ff2' },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log('Authenticated. Company:', company);
  let anyFailed = false;
  for (const c of CANDIDATES) {
    const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${c.candidateId}/stage`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: TARGET_STAGE_ID }),
    });
    const text = await res.text();
    console.log(`\n--- ${c.name} (${c.candidateId}) -> Applied ---`);
    console.log('Status:', res.status);
    if (res.status < 200 || res.status >= 300) {
      console.log('Response:', text.slice(0, 500));
      anyFailed = true;
    }
  }
  if (anyFailed) process.exitCode = 1;
})();
