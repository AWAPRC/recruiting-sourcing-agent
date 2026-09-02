// One-off / reusable eligibility check for specific candidates before sending
// outreach: excludes anyone with a low scorecard rating or a negative note
// on the Discussion/Stream feed.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '2ffecbf54808'; // Join Our Talent Network!
const CANDIDATES = [
  { name: 'Modeline Lubin', id: '066fa8a486aa' },
  { name: 'Tamar Gerber', id: '9e26e23c6abc' },
];

const NEGATIVE_NOTE_PATTERNS = /\b(not good|not a fit|do not recommend|don'?t recommend|red flag|reject|poor fit|bad fit|do not (re-?)?contact|no rehire)\b/i;

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  for (const cand of CANDIDATES) {
    const dRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${cand.id}`, {
      headers: { Authorization: token },
    });
    const detail = await dRes.json();
    const score = detail.overall_score || {};
    const hasLowScore = (score.poor && score.poor.length > 0) || (score.very_poor && score.very_poor.length > 0) ||
      (typeof score.average_score === 'number' && score.average_score < 2.5);

    const streamRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${cand.id}/stream`, {
      headers: { Authorization: token },
    });
    const stream = await streamRes.json();
    const negativeNotes = (Array.isArray(stream) ? stream : []).filter((m) => {
      const text = (m.object && m.object.body) || '';
      return NEGATIVE_NOTE_PATTERNS.test(text);
    });

    console.log(`\n${cand.name}:`);
    console.log('  overall_score:', JSON.stringify(score));
    console.log('  hasLowScore:', hasLowScore);
    console.log('  negative notes found:', negativeNotes.length);
    console.log('  ELIGIBLE:', !hasLowScore && negativeNotes.length === 0);
  }
})();
