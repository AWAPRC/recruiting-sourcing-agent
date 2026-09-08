#!/usr/bin/env node
// debug_inbox_raw.js (v2) — diagnostic only. Walks every open position and
// EVERY candidate (not just the first few hits), tallies the frequency of
// every stream `type` seen within the recent window, and captures full raw
// samples for any type that isn't already known to be "noise" (status
// updates, notes we posted, etc.) — these are the candidates for actual
// candidate-authored messages. This version does not stop after 15 samples
// like the first draft did, so it isn't biased toward whichever positions
// happen to be scanned first.
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const DAYS = parseInt(process.argv[2] || "14", 10);
const OUT_PATH = path.join(__dirname, "..", "data", "inbox_raw_debug.json");
const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

// Types we already know are NOT candidate messages, based on the first debug run.
const KNOWN_NOISE_TYPES = new Set([
  "companyNotePosted",
  "candidateStatusUpdated",
  "candidateAdded",
  "candidateInterviewCancel",
  "questionnaireToCandidatePosted",
  "candidateInterviewScheduled",
  "candidateSourced",
  "candidateSourcedFromApplication",
  "candidateSourcedFromCareersPage",
  "candidateOriginated",
  "candidateSourceUpdated",
  "candidateSourceCreated",
  "candidateTagAdded",
  "candidateTagRemoved",
  "candidateRatingUpdated",
  "candidateScorecardSubmitted",
  "candidateEvaluationSubmitted",
]);

function nameOf(c) {
  if (!c) return null;
  if (typeof c.name === "string") return c.name;
  if (c.name && (c.name.first || c.name.last)) return `${c.name.first || ""} ${c.name.last || ""}`.trim();
  return c.email_address || c.email || c._id;
}

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const positions = await client.listPositions();
  console.log(`Found ${positions.length} open position(s).`);

  const typeCounts = {};
  const interestingSamples = [];
  let candidateCount = 0;
  let candidatesWithRecentActivity = 0;
  let candidatesWithInterestingActivity = 0;

  for (const pos of positions) {
    let candidates;
    try {
      candidates = await client.listCandidates(pos._id);
    } catch (e) {
      console.error(`  failed to list candidates for ${pos.name}: ${e.message}`);
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

      let hasInteresting = false;
      for (const e of recent) {
        const t = e.type || "unknown";
        typeCounts[t] = (typeCounts[t] || 0) + 1;
        if (!KNOWN_NOISE_TYPES.has(t)) {
          hasInteresting = true;
          if (interestingSamples.length < 40) {
            interestingSamples.push({
              position_name: pos.name,
              candidate_name: nameOf(c),
              candidate_email: c.email_address || c.email || null,
              candidate_stage: c.stage || null,
              entry: e,
            });
          }
        }
      }
      if (hasInteresting) candidatesWithInterestingActivity++;
    }
  }

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        pulled_at: new Date().toISOString(),
        days: DAYS,
        candidates_scanned: candidateCount,
        candidates_with_recent_activity: candidatesWithRecentActivity,
        candidates_with_interesting_activity: candidatesWithInterestingActivity,
        type_counts: typeCounts,
        interesting_samples: interesting_samples,
      },
      null,
      2
    )
  );
  console.log(`Scanned ${candidateCount} candidates across ${positions.length} positions.`);
  console.log(`${candidatesWithRecentActivity} had activity in the last ${DAYS} days.`);
  console.log(`Type counts:`, JSON.stringify(typeCounts));
  console.log(`${candidatesWithInterestingActivity} candidates had "interesting" (non-noise) activity.`);
  console.log(`Wrote ${interestingSamples.length} interesting samples to ${OUT_PATH}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
