// Discovery only - no writes. Lists positions across BOTH companies, finds
// "Join our Team" pipeline + its stages, and any talent-pool postings.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const companiesRes = await fetch('https://api.breezy.hr/v3/companies', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const companies = await companiesRes.json();
  console.log('COMPANIES:', JSON.stringify(companies.map(c => ({ id: c._id, name: c.name })), null, 2));

  for (const company of companies) {
    console.log(`\n=== ${company.name} (${company._id}) ===`);
    const posRes = await fetch(`https://api.breezy.hr/v3/company/${company._id}/positions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const positions = await posRes.json();
    for (const p of positions) {
      const flag = /join.*team|talent.*network|talent.*pool/i.test(p.name) ? '  <-- MATCH' : '';
      console.log(`${p._id} | ${p.state} | ${p.name}${flag}`);
    }

    // Get full detail on any position matching our targets, to see pipeline/stages
    for (const p of positions) {
      if (/join.*team|talent.*network|talent.*pool/i.test(p.name)) {
        const detailRes = await fetch(`https://api.breezy.hr/v3/company/${company._id}/position/${p._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const detail = await detailRes.json();
        console.log(`\n  Pipeline for "${p.name}":`);
        if (detail.pipeline) {
          for (const stage of detail.pipeline) {
            console.log(`    stage_id=${stage.id || stage._id} name="${stage.name}" type=${stage.type && stage.type.name}`);
          }
        } else {
          console.log('    (no pipeline field found - full detail keys:', Object.keys(detail), ')');
        }
      }
    }
  }
})();
