#!/usr/bin/env node
// audit_applied_stage.js (one-off, 2026-09-29, v3) — v1/v2 both failed to
// find anyone: v1 only checked the literal "applied" stage_id (missing A/B
// Players), and v2's pipeline-fetch approach came back empty because
// position.pipeline_id is literally the string "default" here, not a real
// pipeline resource id - GET /pipeline/default doesn't return a usable
// stage list for this account. Per debug_pipeline_shape.json, each
// candidate already carries its OWN current stage inline as
// {id, name, type:{id,name}} from listCandidates() - no separate pipeline
// fetch is needed at all. v3 uses that directly and matches on stage NAME
// (case-insensitive) against Devanne's "before phone screening" stages:
// Applied, Screening, B Players, A Players - explicitly excluding "Phone
// Screen" itself even though Breezy groups "Screening" and "Phone Screen"
// under the same type id (schedule_phone_screen) - they are different named
// stages and Devanne treats "Screening" as pre-phone-screen. Personal
// Impact and anything else is excluded (it happens after phone screening).
// Pulls full profile + full stage-change history for every matching
// candidate. Read-only; makes no changes to Breezy.
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
const TARGET_STAGE_NAMES = new Set(["applied", "screening", "b players", "a players"]);

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const company = await client.getCompanyId();

  const position = await client.api("GET", `/company/${company}/position/${POSITION_ID}`);
  console.log(`Position: ${position.name} (${POSITION_ID})`);

  const candidates = await client.listCandidates(POSITION_ID, company);

  // Build a best-effort stage_id -> {name, type_id} map from whatever stages
  // are actually in use right now (for resolving historical stage-change
  // events later), since there's no separate pipeline resource to fetch.
  const stageMap = {};
  for (const c of candidates) {
    if (c.stage && c.stage.id != null) {
      stageMap[c.stage.id] = { name: c.stage.name, type_id: c.stage.type && c.stage.type.id };
    }
  }
  console.log("Stages currently in use for this position:");
  for (const [id, s] of Object.entries(stageMap)) console.log(`  ${id} - "${s.name}" (type: ${s.type_id})`);

  const preScreen = candidates.filter((c) => c.stage && TARGET_STAGE_NAMES.has((c.stage.name || "").toLowerCase()));
  console.log(`\n${preScreen.length} candidate(s) currently in a pre-phone-screening stage (Applied/Screening/B Players/A Players).`);

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
        const resolved = rawStageId != null && stageMap[rawStageId];
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
  fs.writeFileSync(outFile, JSON.stringify({ pulled_at: new Date().toISOString(), position_id: POSITION_ID, position_name: position.name, target_stage_names: [...TARGET_STAGE_NAMES], candidates: results }, null, 2));
  console.log(`\nWrote ${outFile} with ${results.length} candidates.`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
