#!/usr/bin/env node
// debug_inbox_raw.js — diagnostic only. Walks open positions, and for every
// candidate with at least one stream entry in the last N days, dumps the RAW
// stream entries (no filtering/heuristics) to data/inbox_raw_debug.json so we
// can see Breezy's actual field names and fix pull_inbox.js's candidate-
// detection logic, which may be guessing wrong field names.
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const DAYS = parseInt(process.argv[2] || "14", 10);
const OUT_PATH = path.join(__dirname, "..", "data", "inbox_raw_debug.json");
const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const positions = await client.listPositions();
  console.log(`Found ${positions.length} open position(s).`);

  const samples = [];
  let candidateCount = 0;
  let candidatesWithRecentActivity = 0;

  for (const pos of positions) {
    let candidates;
    try {
      candidates = await client.listCandidates(pos._id);
    } catch (e) {
      continue;
    }
    for (const c of candidates) {
      candidateCount++;
      let stream;
      try {
        stream = await client.getCandidateStream(pos._id, c._id);
      } catch (e) {
        continue;
      }
      if (!Array.isArray(stream) || stream.length === 0) continue;

      const recent = stream.filter((m) => m && m.timestamp && new Date(m.timestamp) > cutoff);
      if (recent.length === 0) continue;

      candidatesWithRecentActivity++;
      if (samples.length < 15) {
        samples.push({
          position_name: pos.name,
          candidate_name: c.name && (c.name.first + " " + c.name.last),
          candidate_email: c.email,
          recent_raw_entries: recent,
        });
      }
    }
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      { pulled_at: new Date().toISOString(), days: DAYS, candidates_scanned: candidateCount, candidates_with_recent_activity: candidatesWithRecentActivity, samples },
      null,
      2
    )
  );
  console.log(`Scanned ${candidateCount} candidates. ${candidatesWithRecentActivity} had activity in the last ${DAYS} days.`);
  console.log(`Wrote ${samples.length} full samples to ${OUT_PATH}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
