#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { BreezyClient } = require("./breezy_client");

const OUT_DIR = path.join(__dirname, "..", "data");
const DATE = process.argv[2] || new Date().toISOString().slice(0, 10);

(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const positions = await client.listPositions();
  console.log(`Total positions returned (default/unfiltered): ${positions.length}`);
  positions.forEach(p => console.log(`  id=${p._id} name="${p.name}" state=${p.state}`));

  const states = ["open", "closed", "on hold", "filled", "draft", "internal", "cancelled"];
  const allById = {};
  positions.forEach(p => allById[p._id] = p);
  for (const s of states) {
    try {
      const ps = await client.listPositions(s);
      ps.forEach(p => { if (!allById[p._id]) { console.log(`  [state=${s}] NEW id=${p._id} name="${p.name}" state=${p.state}`); allById[p._id] = p; } });
    } catch (e) {
      console.log(`  state=${s} filter failed: ${e.message}`);
    }
  }

  const allPositions = Object.values(allById);
  console.log(`\nTotal unique positions across all state filters: ${allPositions.length}`);

  const out = { pulled_at: DATE, positions: [] };

  for (const position of allPositions) {
    console.log(`\n=== Pulling candidates for: ${position.name} (${position._id}, state=${position.state}) ===`);
    let candidates = [];
    try {
      candidates = await client.listCandidates(position._id);
    } catch (e) {
      console.log(`  failed to list candidates: ${e.message}`);
      continue;
    }
    console.log(`  ${candidates.length} candidates`);
    const detailed = [];
    for (const c of candidates) {
      try {
        const full = await client.getCandidate(position._id, c._id);
        detailed.push(full);
      } catch (e) {
        console.log(`  failed to fetch candidate ${c._id}: ${e.message}`);
        detailed.push(c);
      }
    }
    out.positions.push({ position, candidates: detailed });
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `all_pipelines_full_${DATE}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outFile}`);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
