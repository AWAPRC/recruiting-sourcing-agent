// Generic reviewer-posting script (any open role, any batch).
// Reads data/pending_reviews.json, an array of:
//   { position_id, candidate_id, name, review, disqualify }
// For every entry: posts the AI-labeled review to the Discussion/Stream feed.
// If disqualify === true, also moves the candidate to that role's Disqualified
// stage (DQ_STAGE_ID below - confirmed identical across every role in scope).
const fs = require('fs');
const path = require('path');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

const PENDING_PATH = path.join(__dirname, '..', 'data', 'pending_reviews.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'posted_reviews_log.json');
const AI_LABEL = '**🤖 AI Candidate Review** (auto-generated, not a team member)\n\n';

// Confirmed via discovery run 2026-09-02: every in-scope open role (Adolescent
// Mental Health Technician, Adolescent Services Manager, Business Development &
// Outreach Representative, Behavioral Health Recruiter, Behavioral Health
// Technician) uses this same stage id for "❌ DQ – Role Fit".
const DQ_STAGE_ID = 1776873797711;

async function postComment(token, company, positionId, candidateId, body) {
  const url = `https://api.breezy.hr/v3/company/${company}/position/${positionId}/candidate/${candidateId}/stream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'comment', body }),
  });
  return { status: res.status, text: await res.text() };
}

async function moveStage(token, company, positionId, candidateId, stageId) {
  const url = `https://api.breezy.hr/v3/company/${company}/position/${positionId}/candidate/${candidateId}/stage`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage_id: stageId }),
  });
  return { status: res.status, text: await res.text() };
}

(async () => {
  if (!fs.existsSync(PENDING_PATH)) {
    console.log('No data/pending_reviews.json found - nothing to post.');
    return;
  }
  const items = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log(`Authenticated. Company: ${company}. Posting ${items.length} review(s).`);

  const results = [];
  for (const item of items) {
    console.log(`\n--- ${item.name} (${item.candidate_id}) — position ${item.position_id} ${item.disqualify ? '[DISQUALIFY]' : ''} ---`);
    const commentRes = await postComment(token, company, item.position_id, item.candidate_id, AI_LABEL + item.review);
    console.log('Comment status:', commentRes.status);

    let stageRes = null;
    if (item.disqualify) {
      stageRes = await moveStage(token, company, item.position_id, item.candidate_id, DQ_STAGE_ID);
      console.log('Stage move status:', stageRes.status);
    }

    results.push({
      candidate: item.name,
      candidate_id: item.candidate_id,
      position_id: item.position_id,
      comment_status: commentRes.status,
      comment_ok: commentRes.status >= 200 && commentRes.status < 300,
      disqualified: !!item.disqualify,
      stage_status: stageRes ? stageRes.status : null,
      stage_ok: stageRes ? stageRes.status >= 200 && stageRes.status < 300 : null,
      posted_date: new Date().toISOString(),
    });
  }

  const existingLog = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')) : { posted: [] };
  existingLog.posted = existingLog.posted.concat(results);
  fs.writeFileSync(LOG_PATH, JSON.stringify(existingLog, null, 2));

  // Clear the pending queue now that it's been posted.
  fs.writeFileSync(PENDING_PATH, JSON.stringify([], null, 2));

  const failed = results.filter((r) => !r.comment_ok || (r.disqualified && !r.stage_ok));
  console.log(`\nDone. ${results.length - failed.length}/${results.length} fully succeeded.`);
  if (failed.length) {
    console.log('Issues:', failed.map((f) => f.candidate).join(', '));
    process.exitCode = 1;
  }
})();
