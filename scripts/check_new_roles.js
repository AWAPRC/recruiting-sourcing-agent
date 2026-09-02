// Runs on GitHub's daily schedule. Compares live published positions against
// data/known_positions.json. Any new one gets its talent-pool candidates
// pulled for a match draft - written to data/new_role_draft_<date>.json for
// review, NOT sent. Devanne approves before anything goes out.
const fs = require('fs');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const TALENT_POOL_POSITION_ID = '2ffecbf54808';

(async () => {
  const knownPath = 'data/known_positions.json';
  const known = JSON.parse(fs.readFileSync(knownPath));

  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  const posRes = await fetch(`https://api.breezy.hr/v3/company/${company}/positions?state=published`, {
    headers: { Authorization: token },
  });
  const positions = await posRes.json();
  const newOnes = positions.filter((p) => !known.known_ids.includes(p._id));

  if (newOnes.length === 0) {
    console.log('No new roles since last check.');
    return;
  }

  console.log(`Found ${newOnes.length} new role(s):`, newOnes.map((p) => p.name).join(', '));

  // Pull talent pool candidates so a human (or a later Claude pass) can match them.
  const poolRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${TALENT_POOL_POSITION_ID}/candidates`, {
    headers: { Authorization: token },
  });
  const poolCandidates = await poolRes.json();
  const poolDetail = [];
  for (const c of poolCandidates) {
    const dRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${TALENT_POOL_POSITION_ID}/candidate/${c._id}`, {
      headers: { Authorization: token },
    });
    poolDetail.push(await dRes.json());
  }

  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(`data/new_role_alert_${today}.json`, JSON.stringify({ new_roles: newOnes, talent_pool: poolDetail }, null, 2));

  known.known_ids.push(...newOnes.map((p) => p._id));
  fs.writeFileSync(knownPath, JSON.stringify(known, null, 2));
  console.log('Wrote alert file for review. No emails sent - matching/drafting happens in a follow-up Claude pass.');
})();
