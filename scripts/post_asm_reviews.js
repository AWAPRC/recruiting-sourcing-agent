// Posts AI-generated candidate reviews to the Discussion/Stream feed for the
// Adolescent Services Manager role. Reads reviews from data/asm_reviews.json.
// Every posted note is prefixed with the required AI-disclosure label.

const fs = require('fs');
const path = require('path');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

const POSITION_ID = '70abb2f01e85'; // Adolescent Services Manager
const REVIEWS_PATH = path.join(__dirname, '..', 'data', 'asm_reviews.json');
const AI_LABEL = '**🤖 AI Candidate Review** (auto-generated, not a team member)\n\n';

async function postOne(token, company, candidateId, body) {
  const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${candidateId}/stream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'comment', body }),
  });
  const text = await res.text();
  return { status: res.status, text };
}

(async () => {
  const reviews = JSON.parse(fs.readFileSync(REVIEWS_PATH, 'utf8'));
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log(`Authenticated. Company: ${company}. Posting ${reviews.length} reviews to position ${POSITION_ID}.`);

  const results = [];
  for (const r of reviews) {
    const labeledBody = AI_LABEL + r.review;
    console.log(`\n--- Posting review for ${r.name} (${r.candidate_id}) ---`);
    const res = await postOne(token, company, r.candidate_id, labeledBody);
    console.log('Status:', res.status);
    console.log('Response:', res.text.slice(0, 300));
    results.push({
      candidate: r.name,
      candidate_id: r.candidate_id,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      posted_date: new Date().toISOString(),
    });
  }

  const outPath = path.join(__dirname, '..', 'data', 'posted_asm_reviews.json');
  fs.writeFileSync(outPath, JSON.stringify({ posted: results }, null, 2));

  const failed = results.filter((r) => !r.ok);
  console.log(`\nDone. ${results.length - failed.length}/${results.length} posted successfully.`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.candidate).join(', '));
    process.exitCode = 1;
  }
})();
