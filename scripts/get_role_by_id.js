#!/usr/bin/env node
// Pulls position + full candidate detail for a fixed list of position IDs
// (used for closed/archived positions that don't show up in listPositions()
// without a state filter, e.g. the old "Wellness Coordinator" postings).
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const POSITION_IDS = process.argv.slice(2);
const OUT_DIR = path.join(__dirname, "..", "data");

if (POSITION_IDS.length === 0) {
  console.error("Usage: node get_role_by_id.js <position_id> [more_ids...]");
  process.exit(1);
}

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const company = await client.getCompanyId();

  for (const positionId of POSITION_IDS) {
    const position = await client.getPosition(positionId);
    console.log(`Found: ${position.name} (id=${position._id}, state=${position.state})`);

    const candidates = await client.listCandidates(positionId);
    console.log(`Candidates: ${candidates.length}`);

    const detailed = [];
    for (const c of candidates) {
      try {
        const full = await client.getCandidate(positionId, c._id);
        detailed.push(full);
      } catch (e) {
        console.error(`  failed to fetch candidate ${c._id}: ${e.message}`);
        detailed.push(c);
      }
    }

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    const slug = position.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const outFile = path.join(OUT_DIR, `closed_role_${slug}_${positionId}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ position, candidates: detailed }, null, 2));
    console.log(`Wrote ${outFile}`);
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });

