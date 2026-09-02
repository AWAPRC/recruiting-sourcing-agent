#!/usr/bin/env node
const { BreezyClient } = require("./breezy_client");
(async () => {
  const client = new BreezyClient(process.env.BREEZY_EMAIL, process.env.BREEZY_PASSWORD);
  const positions = await client.listPositions();
  console.log(`Total positions: ${positions.length}`);
  positions.forEach(p => console.log(`  id=${p._id}  name="${p.name}"  state=${p.state}`));
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
