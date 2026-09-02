// Confirmed schema: PUT .../candidate/{id}/stage with {"stage_id": N}
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '2ffecbf54808';

const MOVES = [
  { name: 'Charnee Henry', candidateId: '05fe220a7690', stageId: 1788361552114, stageName: 'PRC' },
];

async function move(company, token, m) {
  const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${m.candidateId}/stage`;
  console.log(`\n--- Moving ${m.name} -> ${m.stageName} ---`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage_id: m.stageId }),
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log('Authenticated. Company:', company);
  for (const m of MOVES) await move(company, token, m);
})();
