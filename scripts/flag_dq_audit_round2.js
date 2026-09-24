// One-off (2026-09-24): round 2 of the expanded DQ audit. Devanne confirmed
// this should match round 1 - move each back to Applied AND post a note
// (not comment-only after all). This script's own code never emails the
// candidate either way - it only calls the stage PUT and a team-visible
// stream comment. Whether Breezy itself has an automatic candidate email
// wired to the Applied stage is a platform/pipeline setting outside this
// script's control and wasn't verified before running.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const NOTE = 'MOVED BACK FROM DISQUALIFIED - SIGNED CLAUDE';
const APPLIED_STAGE_ID = 'applied';

const CANDIDATES = [
  // BH/recovery ops leaders (Adolescent Services Manager)
  { positionId: '70abb2f01e85', candidateId: '6b26abe51c1b', name: 'E. Michelle Cohen' },
  { positionId: '70abb2f01e85', candidateId: 'c71d4767cdcc', name: 'Christopher Rublino' },
  { positionId: '70abb2f01e85', candidateId: '3a7b0bd9201a', name: 'Andrew Parker' },
  { positionId: '70abb2f01e85', candidateId: '8e0fcdda6370', name: 'Ted Monticello' },
  { positionId: '70abb2f01e85', candidateId: '311ae9500edb', name: 'Ana Christina Lazo' },
  { positionId: '70abb2f01e85', candidateId: '998b08838451', name: 'Nadine Smith-Johnson' },
  // Human-services leaders (Adolescent Services Manager)
  { positionId: '70abb2f01e85', candidateId: '8e446d41003d', name: 'Brianna Vella' },
  { positionId: '70abb2f01e85', candidateId: '4f3c411f10ea', name: 'Perry Egelsky' },
  // Healthcare-facility ops managers (Adolescent Services Manager)
  { positionId: '70abb2f01e85', candidateId: 'b145eba85ab0', name: 'Rick Peraza' },
  { positionId: '70abb2f01e85', candidateId: '63c46f679dbb', name: 'Antonella Santiago' },
  { positionId: '70abb2f01e85', candidateId: 'cfcdf142118a', name: 'Marika Simpson' },
  // BH Recruiter additions
  { positionId: 'd540d93d12d2', candidateId: '83a97a29e020', name: 'Manuchka Joseph' },
  { positionId: 'd540d93d12d2', candidateId: 'e55c3ec9b903', name: 'Richard Johnson' },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log(`Authenticated. Company: ${company}. Reactivating ${CANDIDATES.length} candidates.`);

  const results = [];
  for (const c of CANDIDATES) {
    console.log(`\n--- ${c.name} (${c.candidateId}) — position ${c.positionId} ---`);

    const stageUrl = `https://api.breezy.hr/v3/company/${company}/position/${c.positionId}/candidate/${c.candidateId}/stage`;
    const stageRes = await fetch(stageUrl, {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: APPLIED_STAGE_ID }),
    });
    console.log('Stage move status:', stageRes.status);

    const streamUrl = `https://api.breezy.hr/v3/company/${company}/position/${c.positionId}/candidate/${c.candidateId}/stream`;
    const commentRes = await fetch(streamUrl, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'comment', body: NOTE }),
    });
    console.log('Comment status:', commentRes.status);

    results.push({
      candidate: c.name,
      candidate_id: c.candidateId,
      position_id: c.positionId,
      stage_status: stageRes.status,
      stage_ok: stageRes.status >= 200 && stageRes.status < 300,
      comment_status: commentRes.status,
      comment_ok: commentRes.status >= 200 && commentRes.status < 300,
      flagged_date: new Date().toISOString(),
    });
  }

  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, '..', 'data', 'dq_audit_flagged_round2.json');
  fs.writeFileSync(outPath, JSON.stringify({ flagged: results }, null, 2));

  const failed = results.filter((r) => !r.comment_ok || !r.stage_ok);
  console.log(`\nDone. ${results.length - failed.length}/${results.length} fully succeeded.`);
  if (failed.length) {
    console.log('Issues:', failed.map((f) => f.candidate).join(', '));
    process.exitCode = 1;
  }
})();
