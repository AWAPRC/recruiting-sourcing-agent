// Moves two confirmed talent-pool candidates into their matched stage
// (PRC or AWA) within the "Join Our Talent Network!" pipeline.
// Tamar Gerber and Jessica Pietrzak are intentionally left alone (ambiguous fit).
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '2ffecbf54808';

const MOVES = [
  { name: 'Charnee Henry', candidateId: '05fe220a7690', stageId: 1788361552114, stageName: 'PRC' },
  { name: 'Modeline Lubin', candidateId: '066fa8a486aa', stageId: 1788361573586, stageName: 'AWA' },
];

async function tryMove(company, token, m) {
  const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${m.candidateId}/stage`;
  console.log(`\n--- Moving ${m.name} -> ${m.stageName} (stage_id=${m.stageId}) ---`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage_id: m.stageId }),
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
  return res.status >= 200 && res.status < 300;
}

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log('Authenticated. Company:', company);

  for (const m of MOVES) {
    await tryMove(company, token, m);
  }
})();
