#!/usr/bin/env node
// send_replies.js — posts the replies Devanne approved (drafted together in
// chat) to Breezy's conversation endpoint for each candidate thread, then
// logs what was sent to data/sent_replies.json for a record/audit trail.
//
// Input: data/approved_replies.json, an array of entries. Each entry needs
// EITHER a known {position_id, candidate_id} OR a {position_name,
// candidate_name} pair to resolve at send time (useful when the candidate is
// already disqualified/closed and wasn't in a recent active-candidate pull,
// so we don't have their id cached anywhere). subject is optional.
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const DATA_DIR = path.join(__dirname, "..", "data");
const APPROVED_PATH = path.join(DATA_DIR, "approved_replies.json");
const LOG_PATH = path.join(DATA_DIR, "sent_replies.json");

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

(async () => {
  if (!fs.existsSync(APPROVED_PATH)) {
    console.error(`No ${APPROVED_PATH} found — nothing to send.`);
    process.exit(1);
  }
  const approved = JSON.parse(fs.readFileSync(APPROVED_PATH));
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  // Only fetch the full position/candidate listing (all states, not just open)
  // if at least one entry needs name-based resolution — avoids the cost when
  // every entry already carries known ids.
  const needsResolution = approved.some((m) => !m.candidate_id || !m.position_id);
  let allPositions = [];
  if (needsResolution) {
    console.log("Some entries need name-based resolution — pulling full position list...");
    allPositions = await client.listPositions(); // all states so DQ'd-position candidates still resolve
  }

  const log = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH)) : { sent: [] };
  const results = [];

  for (const m of approved) {
    let positionId = m.position_id;
    let candidateId = m.candidate_id;

    if (!positionId || !candidateId) {
      console.log(`\nResolving ${m.candidate_name} (${m.position_name || "no position given"})...`);
      let candidatePositions = allPositions;
      if (m.position_name) {
        const wanted = norm(m.position_name);
        candidatePositions = allPositions.filter(
          (p) => norm(p.name).includes(wanted) || wanted.includes(norm(p.name))
        );
        if (candidatePositions.length === 0) candidatePositions = allPositions; // fall back to scanning all
      }
      let found = null;
      for (const pos of candidatePositions) {
        let cands;
        try {
          cands = await client.listCandidates(pos._id);
        } catch (e) {
          continue;
        }
        const match = cands.find((c) => norm(c.name) === norm(m.candidate_name));
        if (match) {
          found = { position_id: pos._id, candidate_id: match._id, position_name: pos.name };
          break;
        }
      }
      if (!found) {
        console.error(`  COULD NOT RESOLVE ${m.candidate_name} — skipping, not sent.`);
        results.push({
          candidate_name: m.candidate_name,
          ok: false,
          error: "could not resolve candidate_id/position_id by name",
          sent_date: new Date().toISOString(),
        });
        continue;
      }
      positionId = found.position_id;
      candidateId = found.candidate_id;
      console.log(`  resolved: position_id=${positionId} candidate_id=${candidateId} (${found.position_name})`);
    }

    const url = `https://api.breezy.hr/v3/company/${company}/position/${positionId}/candidate/${candidateId}/conversation`;
    console.log(`\n--- Replying to ${m.candidate_name} ---`);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(m.subject ? { subject: m.subject, body: m.body } : { body: m.body }),
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text.slice(0, 500));

    results.push({
      candidate_id: candidateId,
      candidate_name: m.candidate_name,
      position_id: positionId,
      body: m.body,
      status: res.status,
      sent_date: new Date().toISOString(),
      ok: res.status >= 200 && res.status < 300,
    });
  }

  log.sent.push(...results);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  // Clear the approved-queue file so a re-run doesn't double-send.
  fs.writeFileSync(APPROVED_PATH, JSON.stringify([], null, 2));
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nDone. ${okCount}/${approved.length} repl${approved.length === 1 ? "y" : "ies"} sent successfully.`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
