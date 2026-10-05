// Generic reviewer-posting script (any open role, any batch).
// Reads data/pending_reviews.json, an array of:
//   { position_id, candidate_id, name, review, disqualify, move_to_stage_id? }
// For every entry: posts the AI-labeled review to the Discussion/Stream feed.
// If disqualify === true, also moves the candidate to that role's Disqualified
// stage. If move_to_stage_id is set (and disqualify is not true), moves the
// candidate to that explicit stage instead (e.g. a "B Players" bucket).
const fs = require('fs');
const path = require('path');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

const PENDING_PATH = path.join(__dirname, '..', 'data', 'pending_reviews.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'posted_reviews_log.json');
const AI_LABEL = '**🤖 AI Candidate Review** (auto-generated, not a team member)\n\n';

// Fallback only: confirmed via discovery run 2026-09-02 that this stage id
// ("❌ DQ – Role Fit") is shared by every role that existed at that time.
// DO NOT rely on this alone for new roles - 4cc04907edf2 (Virtual Creative
// Group Facilitator, added after that discovery run) uses a DIFFERENT stage
// id ("Disqualified", 1765824096294), which silently 500'd on every
// auto-disqualify stage-move for that role on 2026-09-18 and 2026-09-21
// (comment posted fine, stage move failed) until this fix. As of
// 2026-09-23 the script instead resolves each position's real disqualify
// stage id live from its pipeline and only falls back to this constant if
// that lookup fails.
const FALLBACK_DQ_STAGE_ID = 1776873797711;

// Known per-position overrides, confirmed via the "List all pipeline stages"
// discovery workflow on 2026-09-30 after both the live-resolution lookup AND
// the universal fallback returned wrong/500ing results for these two roles.
// Both use stage_id 1765824096294 ("Disqualified", type.id: disqualified) -
// the same alternate ID that 4cc04907edf2 needed previously. Add more roles
// here if the same "no disqualified-type stage found" warning + 500 pattern
// shows up again; re-run scripts/list_all_stages.js to confirm the real id
// before adding one.
const KNOWN_DQ_STAGE_OVERRIDES = {
  '135171b76561': 1765824096294, // Behavioral Health Recruiter
  '72e1265e1528': 1765824096294, // Licensed Clinical Intake Specialist
};

// Per-position disqualify-stage cache so we only hit the pipeline API once
// per position even across many candidates in the same batch.
const dqStageCache = {};

async function resolveDqStageId(client, company, positionId) {
  if (dqStageCache[positionId]) return dqStageCache[positionId];
  if (KNOWN_DQ_STAGE_OVERRIDES[positionId]) {
    dqStageCache[positionId] = KNOWN_DQ_STAGE_OVERRIDES[positionId];
    console.log(`Using known override disqualify stage for position ${positionId}: ${KNOWN_DQ_STAGE_OVERRIDES[positionId]}`);
    return dqStageCache[positionId];
  }
  try {
    const position = await client.api('GET', `/company/${company}/position/${positionId}`);
    const pipelineId = position.pipeline_id || (position.pipeline && position.pipeline._id);
    if (!pipelineId) throw new Error('no pipeline_id on position');
    const pipeline = await client.api('GET', `/company/${company}/pipeline/${pipelineId}`);
    const stages = pipeline.stages || pipeline.stage_list || [];
    // Prefer a stage explicitly typed "disqualified"; among those prefer one
    // named like our standard "❌ DQ – Role Fit" stage, else take whichever
    // disqualified-type stage exists (every pipeline should have exactly one).
    const disqualifyStages = stages.filter((s) => s.type && s.type.id === 'disqualified');
    let chosen = disqualifyStages.find((s) => /dq.*role fit/i.test(s.name || ''));
    if (!chosen) chosen = disqualifyStages[0];
    if (!chosen) throw new Error('no disqualified-type stage found in pipeline');
    dqStageCache[positionId] = chosen.id;
    console.log(`Resolved disqualify stage for position ${positionId}: ${chosen.id} ("${chosen.name}")`);
    return chosen.id;
  } catch (e) {
    console.log(`WARNING: could not resolve disqualify stage for position ${positionId} (${e.message}). Falling back to ${FALLBACK_DQ_STAGE_ID}, which may be wrong for this role.`);
    dqStageCache[positionId] = FALLBACK_DQ_STAGE_ID;
    return FALLBACK_DQ_STAGE_ID;
  }
}

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
    console.log(`\n--- ${item.name} (${item.candidate_id}) — position ${item.position_id} ${item.disqualify ? '[DISQUALIFY]' : ''}${item.skip_comment ? ' [SKIP-COMMENT: retry stage-move only]' : ''} ---`);
    let commentRes;
    if (item.skip_comment) {
      console.log('Skipping comment post (already posted in a prior run) - retrying stage move only.');
      commentRes = { status: 200, text: '' };
    } else {
      commentRes = await postComment(token, company, item.position_id, item.candidate_id, AI_LABEL + item.review);
      console.log('Comment status:', commentRes.status);
    }

    let stageRes = null;
    if (item.disqualify) {
      const stageId = await resolveDqStageId(client, company, item.position_id);
      stageRes = await moveStage(token, company, item.position_id, item.candidate_id, stageId);
      console.log('Stage move status:', stageRes.status, stageRes.status >= 400 ? stageRes.text.slice(0, 300) : '');
    } else if (item.move_to_stage_id) {
      stageRes = await moveStage(token, company, item.position_id, item.candidate_id, item.move_to_stage_id);
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

    // Small delay between requests to avoid tripping Breezy's API rate limiter
    // (a burst with no delay previously triggered a 429 cascade partway through a batch).
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const existingLog = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')) : { posted: [] };
  existingLog.posted = existingLog.posted.concat(results);
  fs.writeFileSync(LOG_PATH, JSON.stringify(existingLog, null, 2));

  // Only clear items that fully succeeded. Anything that failed (comment and/or stage move)
  // stays queued for the next run instead of being silently dropped - this is what previously
  // let a partial-failure run (e.g. a 429 rate-limit cascade) clear the whole queue, including
  // items that never actually posted, risking duplicate comments on a naive re-run.
  const stillPending = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const r = results[i];
    const commentOk = r.comment_ok;
    const stageOk = !item.disqualify || r.stage_ok;
    if (commentOk && stageOk) continue; // fully succeeded - drop from queue
    if (commentOk && !stageOk) {
      // Comment already posted successfully - retry the stage move only next time.
      stillPending.push({ ...item, skip_comment: true });
    } else {
      // Comment failed (or wasn't attempted) - retry the whole item next time.
      const { skip_comment, ...rest } = item;
      stillPending.push(rest);
    }
  }
  fs.writeFileSync(PENDING_PATH, JSON.stringify(stillPending, null, 2) + '\n');

  const failed = results.filter((r) => !r.comment_ok || (r.disqualified && !r.stage_ok));
  console.log(`\nDone. ${results.length - failed.length}/${results.length} fully succeeded.`);
  if (failed.length) {
    console.log('Issues:', failed.map((f) => f.candidate).join(', '));
    console.log(`${stillPending.length} item(s) left in pending_reviews.json for retry.`);
    process.exitCode = 1;
  }
})();
