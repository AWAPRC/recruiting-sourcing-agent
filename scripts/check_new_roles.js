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
  const NEGATIVE_NOTE_PATTERNS = /\b(not good|not a fit|do not recommend|don'?t recommend|red flag|reject|poor fit|bad fit|do not (re-?)?contact|no rehire)\b/i;

  const poolRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${TALENT_POOL_POSITION_ID}/candidates`, {
    headers: { Authorization: token },
  });
  const poolCandidates = await poolRes.json();
  const poolDetail = [];
  for (const c of poolCandidates) {
    const dRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${TALENT_POOL_POSITION_ID}/candidate/${c._id}`, {
      headers: { Authorization: token },
    });
    const detail = await dRes.json();

    // Condition 1: low scorecard rating (any "poor"/"very_poor" ratings, or a low average)
    const score = detail.overall_score || {};
    const hasLowScore = (score.poor && score.poor.length > 0) || (score.very_poor && score.very_poor.length > 0) ||
      (typeof score.average_score === 'number' && score.average_score < 2.5);

    // Condition 2: negative note on the Discussion/Stream feed
    const streamRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${TALENT_POOL_POSITION_ID}/candidate/${c._id}/stream`, {
      headers: { Authorization: token },
    });
    const stream = await streamRes.json();
    const hasNegativeNote = Array.isArray(stream) && stream.some((m) => {
      const text = (m.object && m.object.body) || '';
      return NEGATIVE_NOTE_PATTERNS.test(text);
    });

    detail._eligible_for_outreach = !hasLowScore && !hasNegativeNote;
    detail._exclusion_reason = hasLowScore ? 'low scorecard rating' : hasNegativeNote ? 'negative discussion note' : null;
    poolDetail.push(detail);
  }

  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(`data/new_role_alert_${today}.json`, JSON.stringify({ new_roles: newOnes, talent_pool: poolDetail }, null, 2));

  known.known_ids.push(...newOnes.map((p) => p._id));
  fs.writeFileSync(knownPath, JSON.stringify(known, null, 2));
  console.log('Wrote alert file for review. No emails sent - matching/drafting happens in a follow-up Claude pass.');
})();
