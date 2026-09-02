// Discovery only - no writes. Lists positions across BOTH companies, finds
// "Join our Team" pipeline + its stages, and any talent-pool postings.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  console.log('Token acquired:', token ? token.slice(0, 12) + '...' : '(none)');
  const companiesRes = await fetch('https://api.breezy.hr/v3/companies', {
    headers: { Authorization: token },
  });
  const companiesRaw = await companiesRes.json();
  console.log('Raw /companies status:', companiesRes.status);
  console.log('Raw /companies body:', JSON.stringify(companiesRaw));
  const companies = Array.isArray(companiesRaw) ? companiesRaw : (companiesRaw.companies || companiesRaw.data || []);
  console.log('COMPANIES:', JSON.stringify(companies.map(c => ({ id: c._id, name: c.name })), null, 2));

  for (const company of companies) {
    console.log(`\n=== ${company.name} (${company._id}) ===`);
    const posRes = await fetch(`https://api.breezy.hr/v3/company/${company._id}/positions`, {
      headers: { Authorization: token },
    });
    const positionsRaw = await posRes.json();
    if (!Array.isArray(positionsRaw)) {
      console.log('  Non-array positions response, status', posRes.status, ':', JSON.stringify(positionsRaw));
      continue;
    }
    const positions = positionsRaw;
    for (const p of positions) {
      const flag = /join.*team|talent.*network|talent.*pool/i.test(p.name) ? '  <-- MATCH' : '';
      console.log(`${p._id} | ${p.state} | ${p.name}${flag}`);
    }

    // Get full detail on any position matching our targets, to see pipeline/stages
    for (const p of positions) {
      if (/join.*team|talent.*network|talent.*pool/i.test(p.name)) {
        const detailRes = await fetch(`https://api.breezy.hr/v3/company/${company._id}/position/${p._id}`, {
          headers: { Authorization: token },
        });
        const detail = await detailRes.json();
        console.log(`\n  Position "${p.name}" pipeline_id: ${detail.pipeline_id}`);
        if (detail.pipeline_id) {
          const pipeRes = await fetch(`https://api.breezy.hr/v3/company/${company._id}/pipeline/${detail.pipeline_id}`, {
            headers: { Authorization: token },
          });
          const pipeline = await pipeRes.json();
          console.log('  Pipeline detail:', JSON.stringify(pipeline, null, 2));
        }
      }
    }
  }
})();
