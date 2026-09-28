#!/usr/bin/env node
// find_september_meetings.js (one-off, 2026-09-28) — Devanne asked to narrow
// the 199 zero-comment candidates (data/missing_comments_audit_2026-09-28.json)
// down to just the ones she actually HAD A MEETING with in September but never
// left a note for. Zero comments already rules out anyone with a note-based
// meeting recap (like the Teams recap links posted as notes), so this checks
// each flagged candidate's raw stream for genuine interview/meeting SIGNAL
// events (scheduled interview, submitted scorecard/evaluation - i.e. a meeting
// actually happened or was put on the calendar) timestamped in September 2026.
// Interview CANCEL events are excluded - a cancelled meeting isn't a meeting
// she had. Read-only; makes no changes to Breezy.
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const DATA_DIR = path.join(__dirname, "..", "data");
const INPUT_FILE = path.join(DATA_DIR, "missing_comments_audit_2026-09-28.json");
const SEPT_START = new Date("2026-09-01T00:00:00Z");
const SEPT_END = new Date("2026-10-01T00:00:00Z");

// Events that indicate an actual meeting happened or is on the calendar -
// deliberately excludes candidateInterviewCancel (a cancelled meeting is not
// a meeting she had).
const MEETING_SIGNAL_TYPES = new Set([
  "candidateInterviewScheduled",
  "candidateScorecardSubmitted",
  "candidateEvaluationSubmitted",
]);

(async () => {
  const input = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  const flagged = input.flagged || [];
  console.log(`Checking ${flagged.length} zero-comment candidates for September meeting signals...`);

  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  await client.getToken();
  await client.getCompanyId();

  const results = [];
  for (const f of flagged) {
    let stream = [];
    try {
      stream = await client.getCandidateStream(f.position_id, f.candidate_id);
      if (!Array.isArray(stream)) stream = [];
    } catch (e) {
      console.log(`  ERROR fetching stream for ${f.name} (${f.candidate_id}): ${e.message}`);
      continue;
    }

    const septMeetings = stream.filter((e) => {
      if (!e || !e.type || !e.timestamp) return false;
      if (!MEETING_SIGNAL_TYPES.has(e.type)) return false;
      const t = new Date(e.timestamp);
      return t >= SEPT_START && t < SEPT_END;
    });

    if (septMeetings.length > 0) {
      results.push({
        position_id: f.position_id,
        position_name: f.position_name,
        candidate_id: f.candidate_id,
        name: f.name,
        stage: f.stage,
        meeting_events: septMeetings.map((e) => ({ type: e.type, timestamp: e.timestamp })),
      });
      console.log(`  FOUND: ${f.name} (${f.position_name}) - ${septMeetings.length} September meeting event(s), still 0 notes`);
    }
  }

  const outFile = path.join(DATA_DIR, "september_meetings_no_notes_2026-09-28.json");
  fs.writeFileSync(outFile, JSON.stringify({ checked_at: new Date().toISOString(), source_file: "missing_comments_audit_2026-09-28.json", candidates_checked: flagged.length, matched: results }, null, 2));
  console.log(`\n${results.length} of ${flagged.length} zero-comment candidates had a September meeting with no note.`);
  console.log(`Wrote ${outFile}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
