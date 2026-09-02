// Read-only: pulls full detail for all candidates in "Join Our Talent Network!"
// so we can classify each as AWA (adolescent) vs PRC (adult) before any writes.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '2ffecbf54808';

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  const candsRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidates`, {
    headers: { Authorization: token },
  });
  const cands = await candsRes.json();
  console.log(`Found ${cands.length} candidates in Join Our Talent Network!`);

  for (const c of cands) {
    const detailRes = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${c._id}`, {
      headers: { Authorization: token },
    });
    const d = await detailRes.json();
    console.log('\n=================================');
    console.log('Name:', d.name, '| id:', d._id);
    console.log('Headline:', d.headline);
    console.log('Cover letter:', d.cover_letter);
    console.log('Summary:', d.summary);
    console.log('Questionnaire:');
    for (const q of (d.questionnaire || [])) {
      console.log(`  Q: ${q.text}\n  A: ${q.response}`);
    }
    console.log('Work history titles:', (d.work_history || []).map(w => w.title + ' @ ' + w.company_name).join(' | '));
  }
})();
