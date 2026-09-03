#!/usr/bin/env node
/**
 * get_review_batch.js — pulls every OPEN Breezy position, and within each, every candidate
 * currently sitting in a stage matching: Applied, Phone Screening, PII / Personal Impact
 * Interview, or "A Player". Writes data/review_batch_<date>.json for Claude to read and
 * draft hiring-guide-based feedback against, before any writes go back to Breezy.
 *
 * Run: BREEZY_EMAIL=... BREEZY_PASSWORD=... node scripts/get_review_batch.js [YYYY-MM-DD]
 */
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const DATE = process.argv[2] || new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(__dirname, "..", "data");

const TARGET_STAGE_PATTERNS = [
  /applied/i,
  /phone\s*screen/i,
  /\bpii\b/i,
  /personal\s*impact/i,
  /a[\s-]?player/i,
  /b[\s-]?player/i,
  /leadership/i,
];

function stageMatches(stageName) {
  if (!stageName) return false;
  return TARGET_STAGE_PATTERNS.some((re) => re.test(stageName));
}

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const openPositions = await client.listPositions("published");
  console.log(`Open (published) positions: ${openPositions.length}`);

  const results = [];
  for (const position of openPositions) {
    console.log(`\n${position.name} (id=${position._id})`);
    let candidates;
    try {
      candidates = await client.listCandidates(position._id);
    } catch (e) {
      console.error(`  failed to list candidates: ${e.message}`);
      continue;
    }

    const inTargetStage = candidates.filter((c) => stageMatches(c.stage && c.stage.name));
    console.log(`  candidates: ${candidates.length}, in target stages: ${inTargetStage.length}`);
    if (inTargetStage.length === 0) continue;

    const detailed = [];
    for (const c of inTargetStage) {
      try {
        const full = await client.getCandidate(position._id, c._id);
        detailed.push(full);
      } catch (e) {
        console.error(`    failed to fetch candidate ${c._id}: ${e.message}`);
        detailed.push(c);
      }
    }

    results.push({
      position_id: position._id,
      position_name: position.name,
      candidates: detailed,
    });
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `review_batch_${DATE}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ pulled_at: DATE, roles: results }, null, 2));
  console.log(`\nWrote ${outFile}`);
  console.log(`Total roles with candidates to review: ${results.length}`);
  console.log(`Total candidates to review: ${results.reduce((n, r) => n + r.candidates.length, 0)}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
