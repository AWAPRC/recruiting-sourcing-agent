#!/usr/bin/env node
// audit_missing_comments.js (one-off, 2026-09-28) — Devanne asked for a
// comprehensive sweep across every OPEN role flagging any candidate whose
// discussion feed has ZERO comments/notes on it at all (not just candidates
// missing an AI review - anyone with a completely empty feed, human or
// automated). Writes one dated report; makes no changes to Breezy itself.
//
// Fixed 2026-09-28 (same-day fix): originally looped over every company on
// the account via listPositionsAllCompanies(), which crashed immediately -
// the account's second "company" (PRC-only) doesn't have Developer API
// access on its plan and returns a 403 on every call. Per Devanne, PRC's
// postings are already listed under the AWA/shared account anyway, so
// there's only one company worth pulling from. Reverted to the single
// default company (same pattern as get_review_batch.js / pull_all_full.js).
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const OUT_DIR = path.join(__dirname, "..", "data");
const DATE = new Date().toISOString().slice(0, 10);
const OPEN_STATES = new Set(["published", "open"]);

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const allPositions = await client.listPositions();
  const openPositions = allPositions.filter((p) => OPEN_STATES.has(p.state));
  console.log(`Found ${allPositions.length} total position(s), ${openPositions.length} open.`);

  const flagged = [];
  let candidateCount = 0;

  for (const pos of openPositions) {
    let candidates;
    try {
      candidates = await client.listCandidates(pos._id);
    } catch (e) {
      console.error(`  failed to list candidates for ${pos.name}: ${e.message}`);
      continue;
    }
    console.log(`\n=== ${pos.name} (${pos._id}) — ${candidates.length} candidates ===`);
    for (const c of candidates) {
      candidateCount++;
      const cid = c._id || c.id;
      let stream = [];
      try {
        stream = await client.getCandidateStream(pos._id, cid);
        if (!Array.isArray(stream)) stream = [];
      } catch (e) {
        console.log(`  ERROR fetching stream for ${c.name} (${cid}): ${e.message}`);
        continue;
      }
      const noteCount = stream.filter((e) => e && e.type === "companyNotePosted").length;
      if (noteCount === 0) {
        flagged.push({
          position_id: pos._id,
          position_name: pos.name,
          candidate_id: cid,
          name: c.name,
          stage: c.stage && c.stage.name,
          stream_length: stream.length,
        });
      }
    }
  }

  const outFile = path.join(OUT_DIR, `missing_comments_audit_${DATE}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ pulled_at: new Date().toISOString(), candidates_scanned: candidateCount, positions_scanned: openPositions.length, flagged }, null, 2)
  );
  console.log(`\nScanned ${candidateCount} candidates across ${openPositions.length} open positions.`);
  console.log(`${flagged.length} candidate(s) have ZERO comments/notes on file.`);
  console.log(`Wrote ${outFile}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
