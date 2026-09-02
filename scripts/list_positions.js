#!/usr/bin/env node
const { BreezyClient } = require("./breezy_client");
(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const positions = await client.listPositions();
  const matches = positions.filter(p => /business development/i.test(p.name));
  console.log(`Total positions: ${positions.length}`);
  console.log("Matches for 'Business Development':");
  matches.forEach(p => console.log(`  id=${p._id}  name="${p.name}"  state=${p.state}  candidates=${p.candidate_stats ? p.candidate_stats.total : "?"}`));
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
