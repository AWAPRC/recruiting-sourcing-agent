// One-off audit script: for a fixed list of (position_id, candidate_id) pairs
// in data/dq_audit_targets_2026-09-21.json, pulls each candidate's message
// stream and extracts our own AI-labeled review comment (if any), so Devanne
// can see exactly why our tool disqualified them without opening each one in
// Breezy by hand. Writes data/dq_audit_results_2026-09-21.json.
const fs = require('fs');
const path = require('path');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const AI_LABEL = '🤖 AI Candidate Review';

const TARGETS_PATH = path.join(__dirname, '..', 'data', 'dq_audit_targets_2026-09-21.json');
const OUT_PATH = path.join(__dirname, '..', 'data', 'dq_audit_results_2026-09-21.json');

(async () => {
  const targets = JSON.parse(fs.readFileSync(TARGETS_PATH, 'utf8'));
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const companies = await client.listCompanies();

  const results = [];
  for (const t of targets) {
    let stream = null;
    for (const co of companies) {
      try {
        const s = await client.getCandidateStream(t.position_id, t.candidate_id, co._id);
        if (Array.isArray(s)) { stream = s; break; }
      } catch (e) { /* try next company */ }
    }
    let aiComment = null;
    if (stream) {
      const comments = stream
        .filter((m) => m && (m.object?.body || m.body || '').includes(AI_LABEL))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (comments.length) {
        aiComment = (comments[0].object && comments[0].object.body) || comments[0].body || null;
      }
    }
    console.log(`--- ${t.name} (${t.candidate_id}) ---`);
    console.log(aiComment ? aiComment.replace(/<[^>]+>/g, ' ').slice(0, 400) : '(no AI comment found)');
    results.push({ ...t, ai_comment_found: !!aiComment, ai_comment_text: aiComment });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${OUT_PATH} (${results.length} candidates checked).`);
})();
