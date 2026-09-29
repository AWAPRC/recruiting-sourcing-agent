#!/usr/bin/env node
// audit_applied_stage.js (one-off, 2026-09-29) — Devanne wants to clean up
// the Applied stage (before Phone Screening) for a given role: pull every
// candidate currently sitting there with full profile + full stage-change
// history, so Claude can judge (a) who doesn't meet the role's requirements
// at all, and (b) who's already been disqualified twice before (already
// handled, no further action needed). This script does NOT make that call
// itself or move anyone - it just gathers live data. Read-only.
//
// Usage: node scripts/audit_applied_stage.js <position_id>
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const POSITION_ID = process.argv[2];
if (!POSITION_ID) {
  console.error("Usage: node audit_applied_stage.js <position_id>");
  process.exit(1);
}
const TARGET_STAGE_ID = "applied";
const DATA_DIR = path.join(__dirname, "..", "data");

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const company = await client.getCompanyId();

  const position = await client.api("GET", `/company/${company}/position/${POSITION_ID}`);
  console.log(`Position: ${position.name} (${POSITION_ID})`);

  const pipelineId = position.pipeline_id || (position.pipeline && position.pipeline._id);
  const stageMap = {};
  if (pipelineId) {
    const pipeline = await client.api("GET", `/company/${company}/pipeline/${pipelineId}`);
    const stages = pipeline.stages || pipeline.stage_list || [];
    for (const s of stages) stageMap[s.id] = { name: s.name, type_id: s.type && s.type.id };
  }

  const candidates = await client.listCandidates(POSITION_ID, company);
  const applied = candidates.filter((c) => c.stage && c.stage.id === TARGET_STAGE_ID);
  console.log(`${applied.length} candidate(s) currently in "${TARGET_STAGE_ID}" stage.`);

  const results = [];
  for (const c of applied) {
    const cid = c._id || c.id;
    let full = null;
    try {
      full = await client.getCandidate(POSITION_ID, cid, company);
    } catch (e) {
      console.log(`  ERROR fetching candidate ${c.name} (${cid}): ${e.message}`);
    }
    let stream = [];
    try {
      stream = await client.getCandidateStream(POSITION_ID, cid, company);
      if (!Array.isArray(stream)) stream = [];
    } catch (e) {
      console.log(`  ERROR fetching stream for ${c.name} (${cid}): ${e.message}`);
    }

    const stageEvents = stream
      .filter((e) => e && e.type === "candidateStatusUpdated")
      .map((e) => {
        const obj = e.object || {};
        const rawStageId =
          obj.stage_id || obj.to_stage_id || (obj.stage && obj.stage.id) || (obj.to && obj.to.id) || obj.new_stage_id || null;
        const resolved = rawStageId && stageMap[rawStageId];
        return {
          timestamp: e.timestamp,
          raw_object: obj,
          resolved_stage_id: rawStageId,
          resolved_stage_name: resolved && resolved.name,
          resolved_stage_type: resolved && resolved.type_id,
        };
      });
    const dq_stage_hits = stageEvents.filter((s) => s.resolved_stage_type === "disqualified").length;

    const comments = stream.filter((e) => e && e.type === "companyNotePosted");

    results.push({
      candidate_id: cid,
      name: c.name,
      cover_letter: full && full.cover_letter,
      education: full && full.education,
      work_history: full && (full.work_history || full.experience),
      questionnaire: full && full.questionnaire,
      comment_count: comments.length,
      comments: comments.map((e) => ({ timestamp: e.timestamp, body: e.object && e.object.body })),
      stage_change_events: stageEvents,
      dq_stage_hits_resolved: dq_stage_hits,
    });
  }

  const outFile = path.join(DATA_DIR, `applied_stage_audit_${POSITION_ID}_2026-09-29.json`);
  fs.writeFileSync(outFile, JSON.stringify({ pulled_at: new Date().toISOString(), position_id: POSITION_ID, position_name: position.name, candidates: results }, null, 2));
  console.log(`\nWrote ${outFile} with ${results.length} candidates.`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
