// One-off (2026-09-24): round 2 of the expanded DQ audit. Devanne asked for
// COMMENT ONLY this time - no stage moves. These 20 candidates stay in
// Disqualified; this just posts a visible note on each so Devanne (or a
// hiring manager) can find and reconsider them manually.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const NOTE = 'FLAGGED FOR RECONSIDERATION - DQ AUDIT - SIGNED CLAUDE\n\nSurfaced in a review of disqualified candidates as a possible strong fit against this role\'s must-haves. No stage change made - flagging only for Devanne\'s manual review.';

const CANDIDATES = [
  // BH/recovery ops leaders (Adolescent Services Manager)
  { positionId: '70abb2f01e85', candidateId: '1f559c94f002', name: 'David Salamon' },
  { positionId: '70abb2f01e85', candidateId: '6b26abe51c1b', name: 'E. Michelle Cohen' },
  { positionId: '70abb2f01e85', candidateId: 'c71d4767cdcc', name: 'Christopher Rublino' },
  { positionId: '70abb2f01e85', candidateId: '3a7b0bd9201a', name: 'Andrew Parker' },
  { positionId: '70abb2f01e85', candidateId: '8e0fcdda6370', name: 'Ted Monticello' },
  { positionId: '70abb2f01e85', candidateId: '7d4a40d1855b', name: 'Chelssea McAllister' },
  { positionId: '70abb2f01e85', candidateId: '1e0765c38edb', name: 'Raymond Massey' },
  { positionId: '70abb2f01e85', candidateId: '311ae9500edb', name: 'Ana Christina Lazo' },
  { positionId: '70abb2f01e85', candidateId: '998b08838451', name: 'Nadine Smith-Johnson' },
  // Human-services leaders (Adolescent Services Manager)
  { positionId: '70abb2f01e85', candidateId: 'd8c4c5d0664c', name: 'Carlene Gooden' },
  { positionId: '70abb2f01e85', candidateId: '8e446d41003d', name: 'Brianna Vella' },
  { positionId: '70abb2f01e85', candidateId: '4f3c411f10ea', name: 'Perry Egelsky' },
  { positionId: '70abb2f01e85', candidateId: 'e38c88bf436f', name: 'Guerline Anderson' },
  // Healthcare-facility ops managers (Adolescent Services Manager)
  { positionId: '70abb2f01e85', candidateId: 'b145eba85ab0', name: 'Rick Peraza' },
  { positionId: '70abb2f01e85', candidateId: '63c46f679dbb', name: 'Antonella Santiago' },
  { positionId: '70abb2f01e85', candidateId: 'cfcdf142118a', name: 'Marika Simpson' },
  { positionId: '70abb2f01e85', candidateId: '4d89f3e6bdd0', name: 'Ileana Madera' },
  { positionId: '70abb2f01e85', candidateId: '438614d1a448', name: 'Nelly Cossio' },
  // BH Recruiter additions
  { positionId: 'd540d93d12d2', candidateId: '83a97a29e020', name: 'Manuchka Joseph' },
  { positionId: 'd540d93d12d2', candidateId: 'e55c3ec9b903', name: 'Richard Johnson' },
];

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log(`Authenticated. Company: ${company}. Flagging ${CANDIDATES.length} candidates (comment only, no stage move).`);

  const results = [];
  for (const c of CANDIDATES) {
    console.log(`\n--- ${c.name} (${c.candidateId}) — position ${c.positionId} ---`);
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
      comment_status: commentRes.status,
      comment_ok: commentRes.status >= 200 && commentRes.status < 300,
      flagged_date: new Date().toISOString(),
    });
  }

  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, '..', 'data', 'dq_audit_flagged_round2.json');
  fs.writeFileSync(outPath, JSON.stringify({ flagged: results }, null, 2));

  const failed = results.filter((r) => !r.comment_ok);
  console.log(`\nDone. ${results.length - failed.length}/${results.length} succeeded.`);
  if (failed.length) {
    console.log('Issues:', failed.map((f) => f.candidate).join(', '));
    process.exitCode = 1;
  }
})();
