// Tries several plausible stage-change endpoint/method combos against ONE
// candidate (Modeline Lubin, safe since she's unambiguous AWA), logging each
// response, until one succeeds. Once we know the right shape we'll do Charnee.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '2ffecbf54808';
const CANDIDATE_ID = '066fa8a486aa'; // Modeline Lubin
const STAGE_ID = 1788361573586; // AWA

async function attempt(label, method, url, body) {
  console.log(`\n--- ${label} ---`);
  console.log(method, url, body ? JSON.stringify(body) : '(no body)');
  const res = await fetch(url, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text.slice(0, 500));
  return res.status >= 200 && res.status < 300;
}

let TOKEN;

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  TOKEN = await client.getToken();
  const company = await client.getCompanyId();
  console.log('Authenticated. Company:', company);
  const base = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${CANDIDATE_ID}`;

  const attempts = [
    ['PUT candidate/stage', 'PUT', `${base}/stage`, { stage_id: STAGE_ID }],
    ['POST candidate/stages', 'POST', `${base}/stages`, { stage_id: STAGE_ID }],
    ['PUT candidate/stages', 'PUT', `${base}/stages`, { stage_id: STAGE_ID }],
    ['PATCH candidate (stage_id field)', 'PATCH', base, { stage_id: STAGE_ID }],
    ['PUT candidate (stage_id field)', 'PUT', base, { stage_id: STAGE_ID }],
    ['POST candidate/stage/{stageId}', 'POST', `${base}/stage/${STAGE_ID}`, null],
    ['PATCH candidate (stage.id field)', 'PATCH', base, { stage: { id: STAGE_ID } }],
  ];

  for (const [label, method, url, body] of attempts) {
    const ok = await attempt(label, method, url, body);
    if (ok) { console.log(`\n✅ SUCCESS: ${label}`); return; }
  }
  console.log('\n❌ None of the attempted shapes worked.');
})();
