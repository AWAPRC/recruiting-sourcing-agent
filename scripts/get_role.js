#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const ROLE_NAME = process.argv[2];
const DATE = process.argv[3] || new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(__dirname, "..", "data");

if (!ROLE_NAME) {
  console.error("Usage: node get_role.js \"<role name substring>\" [YYYY-MM-DD]");
  process.exit(1);
}

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const positions = await client.listPositions();
  const matches = positions.filter(p => p.name.toLowerCase().includes(ROLE_NAME.toLowerCase()));

  if (matches.length === 0) {
    console.error(`No position found matching "${ROLE_NAME}". Open positions:`);
    positions.forEach(p => console.error(`  - ${p.name} (${p.state})`));
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Multiple positions match "${ROLE_NAME}":`);
    matches.forEach(p => console.error(`  - ${p.name}  id=${p._id}  state=${p.state}`));
    process.exit(1);
  }

  const position = matches[0];
  console.log(`Found: ${position.name} (id=${position._id}, state=${position.state})`);

  const candidates = await client.listCandidates(position._id);
  console.log(`Candidates: ${candidates.length}`);

  const detailed = [];
  for (const c of candidates) {
    try {
      const full = await client.getCandidate(position._id, c._id);
      detailed.push(full);
    } catch (e) {
      console.error(`  failed to fetch candidate ${c._id}: ${e.message}`);
      detailed.push(c);
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const slug = position.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const outFile = path.join(OUT_DIR, `role_${slug}_${DATE}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ position, candidates: detailed, pulled_at: DATE }, null, 2));
  console.log(`Wrote ${outFile}`);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
