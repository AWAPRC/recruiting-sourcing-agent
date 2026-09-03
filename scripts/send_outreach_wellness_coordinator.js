// Sends approved outreach for the Wellness Coordinator (Davie) role to 3
// past candidates sourced from the closed "Wellness Coordinator - Adolescent
// Mental Health" positions. Approved by Devanne 2026-09-03.
// Logs each send to data/sent_outreach.json so the daily reply-check picks it up.
const fs = require('fs');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

const MESSAGES = [
  {
    candidate_id: '77923262fa15',
    candidate_name: 'Junie Lorfils',
    position_id: '92878de8dc81', // Wellness Coordinator - Adolescent Mental Health
    subject: "Part-Time Wellness Coordinator Opening - Davie, FL",
    body: `Hi Junie,\n\nYour background as a Youth Care Specialist and Mental Health Technician stood out from a previous application with us, and we have a part-time Wellness Coordinator opening at our Davie, FL location that looks like a strong match. The schedule is Monday-Friday, 3p-8p, starting at $18/hr and moving to $19/hr once training is complete. Spanish fluency is required, which your profile already confirms.\n\nWould you be interested in learning more? If so, reply here or call us back at your convenience and we'll set up a quick conversation.\n\nBest,\nDevanne`,
  },
  {
    candidate_id: '60bc454e1036',
    candidate_name: 'Samantha Reilly',
    position_id: '261fb59293da', // Wellness Coordinator - Adolescent Mental Health
    subject: "Part-Time Wellness Coordinator Opening - Davie, FL",
    body: `Hi Samantha,\n\nYour experience as a Behavioral Health Technician stood out from a previous application with us, and we have a part-time Wellness Coordinator opening at our Davie, FL location that looks like a strong match. The schedule is Monday-Friday, 3p-8p, starting at $18/hr and moving to $19/hr once training is complete. Spanish fluency is required, which your profile already confirms.\n\nWould you be interested in learning more? If so, reply here or call us back at your convenience and we'll set up a quick conversation.\n\nBest,\nDevanne`,
  },
  {
    candidate_id: 'd4253e7be389',
    candidate_name: 'Grueicy Soares Santos',
    position_id: '92878de8dc81', // Wellness Coordinator - Adolescent Mental Health
    subject: "Part-Time Wellness Coordinator Opening - Davie, FL",
    body: `Hi Grueicy,\n\nYour experience as a Lead Technician / Behavioral Health Aide stood out from a previous application with us, and we have a part-time Wellness Coordinator opening at our Davie, FL location that looks like a strong match. The schedule is Monday-Friday, 3p-8p, starting at $18/hr and moving to $19/hr once training is complete. Spanish fluency is required, which your profile already confirms.\n\nWould you be interested in learning more? If so, reply here or call us back at your convenience and we'll set up a quick conversation.\n\nBest,\nDevanne`,
  },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();

  const sentPath = 'data/sent_outreach.json';
  const sentData = JSON.parse(fs.readFileSync(sentPath));

  for (const m of MESSAGES) {
    const url = `https://api.breezy.hr/v3/company/${company}/position/${m.position_id}/candidate/${m.candidate_id}/conversation`;
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
        position_id: m.position_id,
        target_stage_id: null,
        sent_date: new Date().toISOString(),
      });
    }
  }

  fs.writeFileSync(sentPath, JSON.stringify(sentData, null, 2));
})();

