const { BreezyClient } = require('./breezy_client');
const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const IDS = ['07381f72ce9c','70abb2f01e85','90654c8a703c','d540d93d12d2','34e6df6e1c91','2ffecbf54808'];
(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  for (const id of IDS) {
    const r = await fetch(`https://api.breezy.hr/v3/company/${company}/position/${id}`, { headers: { Authorization: token } });
    const d = await r.json();
    console.log(d.name, '| friendly_id:', d.friendly_id, '| id:', d._id);
  }
})();
