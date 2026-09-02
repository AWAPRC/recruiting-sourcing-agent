// Runs on GitHub's own daily schedule (see workflow cron). For every candidate
// in data/sent_outreach.json, pulls their conversation thread, looks for a NEW
// reply since last check, and classifies it with simple pattern matching:
// clear "yes" -> auto-move to the matched role's stage; anything else -> flagged
// for human review. Writes results to data/reply_check_<date>.json.
const fs = require('fs');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

const YES_PATTERNS = /\b(yes|yeah|yep|interested|sounds good|i'?m in|let'?s talk|schedule|sure)\b/i;
const NO_PATTERNS = /\b(no thanks|not interested|no longer|pass|not right now)\b/i;

(async () => {
  const sentPath = 'data/sent_outreach.json';
  const sentData = JSON.parse(fs.readFileSync(sentPath));
  if (sentData.sent.length === 0) {
    console.log('No outreach sent yet - nothing to check.');
    return;
  }

  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  const results = [];
  for (const s of sentData.sent) {
    const url = `https://api.breezy.hr/v3/company/${company}/position/${s.position_id}/candidate/${s.candidate_id}/stream`;
    const res = await fetch(url, { headers: { Authorization: token } });
    const stream = await res.json();
    const newMessages = (Array.isArray(stream) ? stream : []).filter(
      (m) => new Date(m.timestamp) > new Date(s.last_checked || s.sent_date)
    );
    if (newMessages.length === 0) continue;

    for (const m of newMessages) {
      const text = (m.object && m.object.body) || '';
      let verdict = 'ambiguous';
      if (YES_PATTERNS.test(text)) verdict = 'yes';
      else if (NO_PATTERNS.test(text)) verdict = 'no';
      results.push({ candidate: s.candidate_name, position_id: s.position_id, candidate_id: s.candidate_id, verdict, text });

      if (verdict === 'yes' && s.target_stage_id) {
        const moveRes = await fetch(
          `https://api.breezy.hr/v3/company/${company}/position/${s.position_id}/candidate/${s.candidate_id}/stage`,
          { method: 'PUT', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: s.target_stage_id }) }
        );
        results[results.length - 1].moved = moveRes.status === 204;
      }
    }
    s.last_checked = new Date().toISOString();
  }

  fs.writeFileSync(sentPath, JSON.stringify(sentData, null, 2));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(`data/reply_check_${today}.json`, JSON.stringify(results, null, 2));
  console.log(`Checked ${sentData.sent.length} candidates. ${results.length} new replies found.`);
  console.log(JSON.stringify(results, null, 2));
})();
