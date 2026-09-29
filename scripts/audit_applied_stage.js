#!/usr/bin/env node
// audit_applied_stage.js (one-off, 2026-09-29, v2) — Devanne wants to clean
// up EVERY stage that sits before Phone Screening for a given role: Applied,
// Video/initial Screen, B Players, A Players - not just the literal
// "Applied" stage_id. v1 of this script only checked "applied" and missed
// the A/B Players triage stages that sit between Applied and Phone
// Screening in this pipeline (per Devanne's recruiting_metrics stage order:
// Applied -> Video Screen -> B Players -> A Players -> Phone Screen -> ...).
// v2 resolves the position's actual pipeline stage order and audits every
// stage up to (not including) the first stage whose name matches "phone
// screen", so it adapts per-role instead of hardcoding stage names/ids.
// Pulls full profile + full stage-change history for every candidate
// currently sitting in any of those stages. Read-only; makes no changes.
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
const DATA_DIR = path.join(__dirname, "..", "data");

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const company = await client.getCompanyId();

  const position = await client.api("GET", `/company/${company}/position/${POSITION_ID}`);
  console.log(`Position: ${position.name} (${POSITION_ID})`);

  const pipelineId = position.pipeline_id || (position.pipeline && position.pipeline._id);
  if (!pipelineId) throw new Error("no pipeline_id on position");
  const pipeline = await client.api("GET", `/company/${company}/pipeline/${pipelineId}`);
  const stages = pipeline.stages || pipeline.stage_list || [];
  const stageMap = {};
  for (const s of stages) stageMap[s.id] = { name: s.name, type_id: s.type && s.type.id };

  console.log("Pipeline stage order:");
  stages.forEach((s, i) => console.log(`  [${i}] ${s.id} - "${s.name}" (type: ${s.type && s.type.id})`));

  const phoneScreenIdx = stages.findIndex((s) => /phone\s*screen/i.test(s.name || ""));
  if (phoneScreenIdx === -1) {
    console.log('WARNING: no stage matching "phone screen" found in pipeline - auditing every non-disqualified, non-hired stage instead.');
  }
  const preScreenStageIds = new Set(
    stages
      .filter((s, i) => {
        const typeId = s.type && s.type.id;
        if (typeId === "disqualified" || typeId === "hired") return false;
        if (phoneScreenIdx === -1) return true;
        return i < phoneScreenIdx;
      })
      .map((s) => s.id)
  );
  console.log(`Stages counted as "before phone screening": ${[...preScreenStageIds].map((id) => stageMap[id].name).join(", ")}`);

  const candidates = await client.listCandidates(POSITION_ID, company);
  const preScreen = candidates.filter((c) => c.stage && preScreenStageIds.has(c.stage.id));
  console.log(`${preScreen.length} candidate(s) currently in a pre-phone-screening stage.`);

  const results = [];
  for (const c of preScreen) {
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
      current_stage: c.stage && c.stage.name,
      cover_letter: full && full.cover_letter,
      education: full && full.education,
      work_history: full && (full.work_history || full.experience),
      questionnaire: full && full.questionnaire,
      comment_count: comments.length,
      comments: comments.map((e) => ({ timestamp: e.timestamp, body: e.object && e.object.body })),
      stage_change_events: stageEvents,
      dq_stage_hits_resolved: dq_stage_hits,
      raw_stream_length: stream.length,
    });
  }

  const outFile = path.join(DATA_DIR, `applied_stage_audit_${POSITION_ID}_2026-09-29.json`);
  fs.writeFileSync(outFile, JSON.stringify({ pulled_at: new Date().toISOString(), position_id: POSITION_ID, position_name: position.name, pre_screen_stage_names: [...preScreenStageIds].map((id) => stageMap[id].name), candidates: results }, null, 2));
  console.log(`\nWrote ${outFile} with ${results.length} candidates.`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
