#!/usr/bin/env node
// Fetches resume PDFs for a fixed candidate list, extracts text, and scans
// for Spanish/bilingual mentions. Writes results to data/.
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");
const pdfParse = require("pdf-parse");

const CANDIDATES = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "dq_candidates_to_check.json"), "utf8"));
const OUT_DIR = path.join(__dirname, "..", "data");

const KEYWORDS = ["spanish", "espanol", "español", "bilingual", "bilingüe", "bilingue", "fluent in", "hablo"];

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const token = await client.getToken();
  const results = [];

  for (const cand of CANDIDATES) {
    const url = `https://api.breezy.hr/v3/company/c08ef698bd78/position/${cand.position_id}/candidate/${cand.id}/resume`;
    let text = "";
    let error = null;
    try {
      const res = await fetch(url, { headers: { Authorization: token } });
      if (res.status !== 200) {
        error = `HTTP ${res.status}`;
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        const parsed = await pdfParse(buf);
        text = parsed.text || "";
      }
    } catch (e) {
      error = e.message;
    }
    const lower = text.toLowerCase();
    const hits = KEYWORDS.filter(k => lower.includes(k));
    const result = {
      name: cand.name,
      id: cand.id,
      email: cand.email,
      phone: cand.phone,
      region: cand.region,
      headline: cand.headline,
      spanish_mentioned: hits.length > 0,
      keyword_hits: hits,
      error,
      resume_excerpt: hits.length > 0 ? extractContext(text, hits[0]) : null,
    };
    console.log(`${cand.name}: spanish_mentioned=${result.spanish_mentioned} error=${error || "none"}`);
    results.push(result);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "resume_spanish_scan.json"), JSON.stringify(results, null, 2));
  console.log(`\nWrote data/resume_spanish_scan.json (${results.length} candidates)`);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });

function extractContext(text, keyword) {
  const idx = text.toLowerCase().indexOf(keyword);
  if (idx === -1) return null;
  return text.slice(Math.max(0, idx - 80), idx + 120).replace(/\s+/g, " ").trim();
}
