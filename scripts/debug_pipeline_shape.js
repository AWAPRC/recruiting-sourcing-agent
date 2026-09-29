#!/usr/bin/env node
// debug_pipeline_shape.js (diagnostic, 2026-09-29) — dumps the raw position
// and pipeline objects for one position so we can see the real field names
// Breezy uses for stage lists (the guessed pipeline.stages/stage_list came
// back empty in audit_applied_stage.js v2). Read-only.
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const POSITION_ID = process.argv[2];
if (!POSITION_ID) {
  console.error("Usage: node debug_pipeline_shape.js <position_id>");
  process.exit(1);
}

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const company = await client.getCompanyId();

  const position = await client.api("GET", `/company/${company}/position/${POSITION_ID}`);
  console.log("=== POSITION KEYS ===");
  console.log(Object.keys(position));
  console.log("=== POSITION (full) ===");
  console.log(JSON.stringify(position, null, 2));

  const pipelineId = position.pipeline_id || (position.pipeline && position.pipeline._id);
  console.log("resolved pipelineId:", pipelineId);

  if (pipelineId) {
    try {
      const pipeline = await client.api("GET", `/company/${company}/pipeline/${pipelineId}`);
      console.log("=== PIPELINE KEYS ===");
      console.log(Object.keys(pipeline));
      console.log("=== PIPELINE (full) ===");
      console.log(JSON.stringify(pipeline, null, 2));
    } catch (e) {
      console.log("pipeline fetch failed:", e.message);
    }
  }

  // Also grab one candidate to see what c.stage actually looks like
  const candidates = await client.listCandidates(POSITION_ID, company);
  console.log(`\n=== SAMPLE CANDIDATE STAGE OBJECTS (first 5 of ${candidates.length}) ===`);
  for (const c of candidates.slice(0, 5)) {
    console.log(c.name, "->", JSON.stringify(c.stage));
  }

  const outFile = path.join(__dirname, "..", "data", "debug_pipeline_shape.json");
  fs.writeFileSync(outFile, JSON.stringify({ position, pipelineId, candidates_sample: candidates.slice(0, 10).map(c => ({name: c.name, stage: c.stage})) }, null, 2));
  console.log(`\nWrote ${outFile}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
