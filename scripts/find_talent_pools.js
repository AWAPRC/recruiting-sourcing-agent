// Read-only: lists ALL positions (any state) under the AWA company account,
// to find "AWA Talent Pool" and "PRC Talent Pool" (not in our original
// published-only discovery).
const { BreezyClient } = require('./breezy_client');
const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  const res = await fetch(`https://api.breezy.hr/v3/company/${company}/positions`, {
    headers: { Authorization: token },
  });
  const positions = await res.json();
  console.log(`Total positions (any state): ${positions.length}`);
  for (const p of positions) {
    const flag = /talent pool/i.test(p.name) ? '  <-- MATCH' : '';
    console.log(`${p._id} | ${p.state} | ${p.name}${flag}`);
  }
})();
