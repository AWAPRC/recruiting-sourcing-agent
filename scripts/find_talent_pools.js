// Read-only: tries several ways to surface Talent Pool objects (org_type=pool)
// that don't show up in the plain /positions call.
const { BreezyClient } = require('./breezy_client');
const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

async function tryGet(label, url, token) {
  console.log(`\n--- ${label} ---`);
  console.log('GET', url);
  const res = await fetch(url, { headers: { Authorization: token } });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text.slice(0, 1500));
}

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  await tryGet('positions with org_type=pool', `https://api.breezy.hr/v3/company/${company}/positions?org_type=pool`, token);
  await tryGet('positions with type=pool', `https://api.breezy.hr/v3/company/${company}/positions?type=pool`, token);
  await tryGet('dedicated /pools endpoint', `https://api.breezy.hr/v3/company/${company}/pools`, token);
  await tryGet('dedicated /talent-pools endpoint', `https://api.breezy.hr/v3/company/${company}/talent-pools`, token);

  // Also dump full raw detail of one known position to inspect its org_type field for comparison
  const res = await fetch(`https://api.breezy.hr/v3/company/${company}/position/2ffecbf54808`, { headers: { Authorization: token } });
  const detail = await res.json();
  console.log('\n--- Join Our Talent Network! org_type ---');
  console.log('org_type:', detail.org_type);
})();
