// One-off (2026-09-24): reactivate 23 candidates surfaced by Devanne's expanded
// DQ audit (Business Dev, BHT, Adolescent Services Manager, BH Recruiter).
// Moves each back to Applied and posts a plain note (NOT the AI-review label -
// this is a manual reactivation, not an automated review) so there's a visible
// record in Breezy of why they moved. These candidates are also being added to
// data/reviewed_candidates.json in this same commit so the automated daily
// review pipeline treats them as already-handled and does NOT auto-review or
// auto-disqualify them again.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const NOTE = 'MOVED BACK FROM DISQUALIFIED - SIGNED CLAUDE';
const APPLIED_STAGE_ID = 'applied';

const CANDIDATES = [
  // Business Development & Outreach Representative
  { positionId: '90654c8a703c', candidateId: '1ee3d34239ad', name: 'Deshmuck Kethavath' },
  { positionId: '90654c8a703c', candidateId: 'b7d345d83c11', name: 'Natalie Greene' },
  { positionId: '90654c8a703c', candidateId: '6c6917a0cd17', name: 'Viola Tombeau' },
  // Behavioral Health Technician (PRC Adult Program)
  { positionId: '34e6df6e1c91', candidateId: '8feb707e10e2', name: 'Hannah Brumley' },
  { positionId: '34e6df6e1c91', candidateId: 'c2cafe8a3502', name: 'James Oberhansley' },
  { positionId: '34e6df6e1c91', candidateId: '1e1a5dfd4704', name: 'Beatrice Derastel' },
  { positionId: '34e6df6e1c91', candidateId: '44b025d22241', name: 'Antwan McCarthy' },
  { positionId: '34e6df6e1c91', candidateId: '16569896fd5b', name: 'Esteban Ortiz' },
  { positionId: '34e6df6e1c91', candidateId: '8baa69d5ff75', name: 'Justin Schulman' },
  { positionId: '34e6df6e1c91', candidateId: '659114a9487c', name: 'Natasha Maxwell' },
  { positionId: '34e6df6e1c91', candidateId: 'e91fccc6602b', name: 'Laquela Green' },
  // Adolescent Services Manager
  { positionId: '70abb2f01e85', candidateId: 'ad2a5713c91d', name: 'Tanesha Johnson' },
  { positionId: '70abb2f01e85', candidateId: 'c19955f46fb9', name: 'Manuel Tejeda' },
  { positionId: '70abb2f01e85', candidateId: '2618356b8e74', name: 'Melissa Khan' },
  { positionId: '70abb2f01e85', candidateId: '7f3a686339f6', name: 'Indra Carimbocas' },
  { positionId: '70abb2f01e85', candidateId: '9a6db6a952c8', name: 'Suyapa Serrano' },
  { positionId: '70abb2f01e85', candidateId: 'd3d0694f5793', name: 'Melissa Diaz' },
  // Behavioral Health Recruiter
  { positionId: 'd540d93d12d2', candidateId: '3a0fe9ff7dbe', name: 'Frances Wong' },
  { positionId: 'd540d93d12d2', candidateId: 'd9cb82275451', name: 'Audrey Randolph' },
  { positionId: 'd540d93d12d2', candidateId: '57ce56ae555b', name: 'Justin Babinec' },
  { positionId: 'd540d93d12d2', candidateId: 'b2bcaba5d257', name: 'Fanny Salgado' },
  { positionId: 'd540d93d12d2', candidateId: '256d57f0dbcd', name: 'Sherine Ridley Pinder' },
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
      reactivated_date: new Date().toISOString(),
    });
  }

  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, '..', 'data', 'dq_audit_reactivations.json');
  const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : { reactivated: [] };
  existing.reactivated = existing.reactivated.concat(results);
  fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));

  const failed = results.filter((r) => !r.stage_ok || !r.comment_ok);
  console.log(`\nDone. ${results.length - failed.length}/${results.length} fully succeeded.`);
  if (failed.length) {
    console.log('Issues:', failed.map((f) => f.candidate).join(', '));
    process.exitCode = 1;
  }
})();
