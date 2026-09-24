// One-off (2026-09-24): both DQ-audit reactivation workflows (batch + round 2)
// already ran and moved all 43 candidates to Applied, including 8 who Devanne
// confirmed should NOT be reactivated (documented, legitimate human phone-screen
// rejections on file - this was caught in check_phone_screen_history.js AFTER
// the workflows had already been triggered, and the candidate lists in the two
// source scripts were only edited locally, never pushed before the runs).
// This script moves those 8 back to each position's real Disqualified stage
// (resolved dynamically per position, same approach as post_reviews.js) and
// posts a correction note. It does not email the candidate; only a stage PUT
// and a team-visible stream comment.
const fs = require('fs');
const path = require('path');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const NOTE = 'REVERTED - MOVED BACK TO DISQUALIFIED. Candidate has a documented phone screen rejection on file; was reactivated in error during the 2026-09-24 DQ audit before this check ran. Correcting now. - SIGNED CLAUDE';

const FALLBACK_DQ_STAGE_ID = 1776873797711;
const dqStageCache = {};

async function resolveDqStageId(client, company, positionId) {
  if (dqStageCache[positionId]) return dqStageCache[positionId];
  try {
    const position = await client.api('GET', `/company/${company}/position/${positionId}`);
    const pipelineId = position.pipeline_id || (position.pipeline && position.pipeline._id);
    if (!pipelineId) throw new Error('no pipeline_id on position');
    const pipeline = await client.api('GET', `/company/${company}/pipeline/${pipelineId}`);
    const stages = pipeline.stages || pipeline.stage_list || [];
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

const CANDIDATES = [
  { positionId: '90654c8a703c', candidateId: '1909a9a050dc', name: 'Adam Lance Leibowitz' },
  { positionId: '70abb2f01e85', candidateId: '1f559c94f002', name: 'David Salamon' },
  { positionId: '70abb2f01e85', candidateId: '7d4a40d1855b', name: 'Chelssea McAllister' },
  { positionId: '70abb2f01e85', candidateId: '1e0765c38edb', name: 'Raymond Massey' },
  { positionId: '70abb2f01e85', candidateId: 'd8c4c5d0664c', name: 'Carlene Gooden' },
  { positionId: '70abb2f01e85', candidateId: 'e38c88bf436f', name: 'Guerline Anderson' },
  { positionId: '70abb2f01e85', candidateId: '4d89f3e6bdd0', name: 'Ileana Madera' },
  { positionId: '70abb2f01e85', candidateId: '438614d1a448', name: 'Nelly Cossio' },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log(`Authenticated. Company: ${company}. Reverting ${CANDIDATES.length} wrongful reactivations.`);

  const results = [];
  for (const c of CANDIDATES) {
    console.log(`\n--- ${c.name} (${c.candidateId}) — position ${c.positionId} ---`);

    const dqStageId = await resolveDqStageId(client, company, c.positionId);

    const stageUrl = `https://api.breezy.hr/v3/company/${company}/position/${c.positionId}/candidate/${c.candidateId}/stage`;
    const stageRes = await fetch(stageUrl, {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: dqStageId }),
    });
    console.log('Stage move status:', stageRes.status);

    const streamUrl = `https://api.breezy.hr/v3/company/${company}/position/${c.positionId}/candidate/${c.candidateId}/stream`;
    const commentRes = await fetch(streamUrl, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'comment', body: NOTE }),
    });
    console.log('Comment status:', commentRes.status);

    results.push({
      candidate: c.name,
      candidate_id: c.candidateId,
      position_id: c.positionId,
      dq_stage_id: dqStageId,
      stage_status: stageRes.status,
      stage_ok: stageRes.status >= 200 && stageRes.status < 300,
      comment_status: commentRes.status,
      comment_ok: commentRes.status >= 200 && commentRes.status < 300,
      reverted_date: new Date().toISOString(),
    });
  }

  const outPath = path.join(__dirname, '..', 'data', 'reverted_wrongful_reactivations.json');
  fs.writeFileSync(outPath, JSON.stringify({ reverted: results }, null, 2));

  const failed = results.filter((r) => !r.comment_ok || !r.stage_ok);
  console.log(`\nDone. ${results.length - failed.length}/${results.length} fully reverted.`);
  if (failed.length) {
    console.log('Issues:', failed.map((f) => f.candidate).join(', '));
    process.exitCode = 1;
  }
})();
