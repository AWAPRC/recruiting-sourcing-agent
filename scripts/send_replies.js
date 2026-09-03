#!/usr/bin/env node
// send_replies.js — posts the replies Devanne approved (drafted together in
// chat) to Breezy's conversation endpoint for each candidate thread, then
// logs what was sent to data/sent_replies.json for a record/audit trail.
//
// Input: data/approved_replies.json, an array of:
//   { position_id, candidate_id, candidate_name, subject, body }
// (subject is optional — Breezy conversation replies don't require one for
// an existing thread, but it's included when present.)
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const DATA_DIR = path.join(__dirname, "..", "data");
const APPROVED_PATH = path.join(DATA_DIR, "approved_replies.json");
const LOG_PATH = path.join(DATA_DIR, "sent_replies.json");

(async () => {
  if (!fs.existsSync(APPROVED_PATH)) {
    console.error(`No ${APPROVED_PATH} found — nothing to send.`);
    process.exit(1);
  }
  const approved = JSON.parse(fs.readFileSync(APPROVED_PATH));
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  const log = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH)) : { sent: [] };

  for (const m of approved) {
    const url = `https://api.breezy.hr/v3/company/${company}/position/${m.position_id}/candidate/${m.candidate_id}/conversation`;
    console.log(`\n--- Replying to ${m.candidate_name} ---`);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(m.subject ? { subject: m.subject, body: m.body } : { body: m.body }),
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text.slice(0, 500));

    log.sent.push({
      candidate_id: m.candidate_id,
      candidate_name: m.candidate_name,
      position_id: m.position_id,
      body: m.body,
      status: res.status,
      sent_date: new Date().toISOString(),
      ok: res.status >= 200 && res.status < 300,
    });
  }

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  // Clear the approved-queue file so a re-run doesn't double-send.
  fs.writeFileSync(APPROVED_PATH, JSON.stringify([], null, 2));
  console.log(`\nDone. ${approved.length} repl${approved.length === 1 ? "y" : "ies"} processed.`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
