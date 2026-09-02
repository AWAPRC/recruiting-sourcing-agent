// Sends the approved outreach emails via Breezy's conversation endpoint
// (POST .../candidate/{id}/conversation), and logs each to
// data/sent_outreach.json so the daily reply-check picks them up.
const fs = require('fs');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '2ffecbf54808'; // Join Our Talent Network! (where these candidates live)

const MESSAGES = [
  {
    candidate_id: '066fa8a486aa',
    candidate_name: 'Modeline Lubin',
    target_position_id: '07381f72ce9c', // Adolescent Mental Health Technician
    target_stage_id: null, // moving them into the actual role's pipeline is a separate step if she's hired on; for now this just sends the message
    subject: "You're a great fit for our Adolescent Mental Health Technician opening",
    body: `Hi Modeline,\n\nThanks for joining our talent network with Adolescent Wellness Academy — we wanted to reach out because your background lines up well with a role we currently have open: Adolescent Mental Health Technician.\n\nYour experience as a Registered Behavior Technician and your background in Applied Behavior Analysis stood out to us, especially given how closely that work aligns with supporting adolescents in a treatment setting.\n\nYou can view the full role details here: https://adolescent-wellness-academy.breezy.hr/p/07381f72ce9c-adolescent-mental-health-technician\n\nIf you're interested, just reply to let us know and our team will follow up to schedule a time to talk.\n\nBest,\nAdolescent Wellness Academy`,
  },
  {
    candidate_id: '9e26e23c6abc',
    candidate_name: 'Tamar Gerber',
    target_position_id: '70abb2f01e85', // Adolescent Services Manager
    target_stage_id: null,
    subject: "You're a great fit for our Adolescent Services Manager opening",
    body: `Hi Tamar,\n\nThanks for joining our talent network with Adolescent Wellness Academy — we wanted to reach out because your background lines up well with a role we currently have open: Adolescent Services Manager.\n\nYour experience as a Family Support Specialist and your background as an Assistant Director and Program Administrator overseeing services for families and children stood out to us as a strong match for this role.\n\nYou can view the full role details here: https://adolescent-wellness-academy.breezy.hr/p/70abb2f01e85-adolescent-services-manager\n\nIf you're interested, just reply to let us know and our team will follow up to schedule a time to talk.\n\nBest,\nAdolescent Wellness Academy`,
  },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  const sentPath = 'data/sent_outreach.json';
  const sentData = JSON.parse(fs.readFileSync(sentPath));

  for (const m of MESSAGES) {
    const url = `https://api.breezy.hr/v3/company/${company}/position/${POSITION_ID}/candidate/${m.candidate_id}/conversation`;
    console.log(`\n--- Sending to ${m.candidate_name} ---`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: m.subject, body: m.body }),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text.slice(0, 500));

    if (res.status >= 200 && res.status < 300) {
      sentData.sent.push({
        candidate_id: m.candidate_id,
        candidate_name: m.candidate_name,
        position_id: POSITION_ID, // where the candidate record + stream lives, for reply-checking
        target_stage_id: null,
        sent_date: new Date().toISOString(),
      });
    }
  }

  fs.writeFileSync(sentPath, JSON.stringify(sentData, null, 2));
})();
