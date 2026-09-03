#!/usr/bin/env node
// pull_inbox.js — walks every OPEN position, pulls every candidate's message
// stream, and collects inbound (candidate-sent) messages from the last N days
// where the candidate's message is the LAST one in the thread (i.e. needs a
// reply from us). Writes data/inbox_pull_<date>.json for Devanne to review.
//
// Runs on GitHub Actions (see .github/workflows/pull-inbox.yml) because
// api.breezy.hr is not reachable directly from the Claude session sandbox or
// from Devanne's local machine — same workaround as the rest of this repo.
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const DAYS = parseInt(process.argv[2] || "5", 10);
const OUT_DIR = path.join(__dirname, "..", "data");
const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const positions = await client.listPositions(); // defaults to open positions per listPositions()
  console.log(`Found ${positions.length} open position(s).`);

  const needsReply = [];
  let candidateCount = 0;

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
        continue; // no stream / not accessible
      }
      if (!Array.isArray(stream) || stream.length === 0) continue;

      // Only look at conversation-type entries (candidate <-> us emails/messages),
      // sorted oldest -> newest.
      const msgs = stream
        .filter((m) => m && m.timestamp && (m.type === "conversation" || m.object))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      if (msgs.length === 0) continue;

      const last = msgs[msgs.length - 1];
      const lastTime = new Date(last.timestamp);
      if (lastTime < cutoff) continue; // nothing recent

      // Heuristic for "inbound from candidate": Breezy stream entries typically
      // carry a `from` or `author`/`creator` field distinguishing candidate vs
      // team member; fall back to `direction`/`type` when present.
      const isFromCandidate = (m) => {
        const f = (m.from || m.author || m.creator || m.sender || "").toString().toLowerCase();
        if (f) return f.includes("candidate") || f === (c.email || "").toLowerCase();
        if (m.direction) return String(m.direction).toLowerCase().includes("in");
        return false;
      };

      if (!isFromCandidate(last)) continue; // last message was already from us

      const body = (last.object && (last.object.body || last.object.text)) || last.body || last.text || "";
      needsReply.push({
        position_id: pos._id,
        position_name: pos.name,
        candidate_id: c._id,
        candidate_name: c.name && (c.name.first + " " + c.name.last) || c.email || c._id,
        candidate_email: c.email || null,
        last_message_at: last.timestamp,
        last_message_body: body,
        thread_length: msgs.length,
      });
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outFile = path.join(OUT_DIR, `inbox_pull_${today}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ pulled_at: new Date().toISOString(), days: DAYS, candidates_scanned: candidateCount, needs_reply: needsReply }, null, 2)
  );
  console.log(`Scanned ${candidateCount} candidates across ${positions.length} positions.`);
  console.log(`${needsReply.length} thread(s) need a reply (last inbound message within ${DAYS} days).`);
  console.log(`Wrote ${outFile}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
