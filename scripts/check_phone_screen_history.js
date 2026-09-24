// One-off (2026-09-24): before reactivating the 43 DQ-audit candidates,
// check whether any of them were disqualified AFTER a real human phone
// screen/interview (not just an automated resume-stage disqualify). Pulls
// each candidate's full stream and looks for signs of human interview
// activity: scheduled interviews, submitted scorecards/evaluations, stage
// history showing they passed through Phone Screening (or later) before
// landing in Disqualified, and any team notes.
const fs = require('fs');
const path = require('path');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

const CANDIDATES = [
  // Business Development & Outreach Representative
  { positionId: '90654c8a703c', candidateId: '1ee3d34239ad', name: 'Deshmuck Kethavath' },
  { positionId: '90654c8a703c', candidateId: '1909a9a050dc', name: 'Adam Lance Leibowitz' },
  { positionId: '90654c8a703c', candidateId: 'b7d345d83c11', name: 'Natalie Greene' },
  { positionId: '90654c8a703c', candidateId: '6c6917a0cd17', name: 'Viola Tombeau' },
  // Behavioral Health Technician
  { positionId: '34e6df6e1c91', candidateId: '8feb707e10e2', name: 'Hannah Brumley' },
  { positionId: '34e6df6e1c91', candidateId: 'c2cafe8a3502', name: 'James Oberhansley' },
  { positionId: '34e6df6e1c91', candidateId: '1e1a5dfd4704', name: 'Beatrice Derastel' },
  { positionId: '34e6df6e1c91', candidateId: '44b025d22241', name: 'Antwan McCarthy' },
  { positionId: '34e6df6e1c91', candidateId: '16569896fd5b', name: 'Esteban Ortiz' },
  { positionId: '34e6df6e1c91', candidateId: '8baa69d5ff75', name: 'Justin Schulman' },
  { positionId: '34e6df6e1c91', candidateId: '659114a9487c', name: 'Natasha Maxwell' },
  { positionId: '34e6df6e1c91', candidateId: 'e91fccc6602b', name: 'Laquela Green' },
  // Adolescent Services Manager (round 1)
  { positionId: '70abb2f01e85', candidateId: 'ad2a5713c91d', name: 'Tanesha Johnson' },
  { positionId: '70abb2f01e85', candidateId: 'c19955f46fb9', name: 'Manuel Tejeda' },
  { positionId: '70abb2f01e85', candidateId: '2618356b8e74', name: 'Melissa Khan' },
  { positionId: '70abb2f01e85', candidateId: '7f3a686339f6', name: 'Indra Carimbocas' },
  { positionId: '70abb2f01e85', candidateId: '9a6db6a952c8', name: 'Suyapa Serrano' },
  { positionId: '70abb2f01e85', candidateId: 'd3d0694f5793', name: 'Melissa Diaz' },
  // BH Recruiter (round 1)
  { positionId: 'd540d93d12d2', candidateId: '3a0fe9ff7dbe', name: 'Frances Wong' },
  { positionId: 'd540d93d12d2', candidateId: 'd9cb82275451', name: 'Audrey Randolph' },
  { positionId: 'd540d93d12d2', candidateId: '57ce56ae555b', name: 'Justin Babinec' },
  { positionId: 'd540d93d12d2', candidateId: 'b2bcaba5d257', name: 'Fanny Salgado' },
  { positionId: 'd540d93d12d2', candidateId: '256d57f0dbcd', name: 'Sherine Ridley Pinder' },
  // Adolescent Services Manager (round 2)
  { positionId: '70abb2f01e85', candidateId: '1f559c94f002', name: 'David Salamon' },
  { positionId: '70abb2f01e85', candidateId: '6b26abe51c1b', name: 'E. Michelle Cohen' },
  { positionId: '70abb2f01e85', candidateId: 'c71d4767cdcc', name: 'Christopher Rublino' },
  { positionId: '70abb2f01e85', candidateId: '3a7b0bd9201a', name: 'Andrew Parker' },
  { positionId: '70abb2f01e85', candidateId: '8e0fcdda6370', name: 'Ted Monticello' },
  { positionId: '70abb2f01e85', candidateId: '7d4a40d1855b', name: 'Chelssea McAllister' },
  { positionId: '70abb2f01e85', candidateId: '1e0765c38edb', name: 'Raymond Massey' },
  { positionId: '70abb2f01e85', candidateId: '311ae9500edb', name: 'Ana Christina Lazo' },
  { positionId: '70abb2f01e85', candidateId: '998b08838451', name: 'Nadine Smith-Johnson' },
  { positionId: '70abb2f01e85', candidateId: 'd8c4c5d0664c', name: 'Carlene Gooden' },
  { positionId: '70abb2f01e85', candidateId: '8e446d41003d', name: 'Brianna Vella' },
  { positionId: '70abb2f01e85', candidateId: '4f3c411f10ea', name: 'Perry Egelsky' },
  { positionId: '70abb2f01e85', candidateId: 'e38c88bf436f', name: 'Guerline Anderson' },
  { positionId: '70abb2f01e85', candidateId: 'b145eba85ab0', name: 'Rick Peraza' },
  { positionId: '70abb2f01e85', candidateId: '63c46f679dbb', name: 'Antonella Santiago' },
  { positionId: '70abb2f01e85', candidateId: 'cfcdf142118a', name: 'Marika Simpson' },
  { positionId: '70abb2f01e85', candidateId: '4d89f3e6bdd0', name: 'Ileana Madera' },
  { positionId: '70abb2f01e85', candidateId: '438614d1a448', name: 'Nelly Cossio' },
  // BH Recruiter (round 2)
  { positionId: 'd540d93d12d2', candidateId: '83a97a29e020', name: 'Manuchka Joseph' },
  { positionId: 'd540d93d12d2', candidateId: 'e55c3ec9b903', name: 'Richard Johnson' },
];

// Stream event types that indicate real human interview/screening activity
// happened, as opposed to pure automated/administrative events.
const INTERVIEW_SIGNAL_TYPES = new Set([
  'candidateInterviewScheduled',
  'candidateInterviewCancel',
  'candidateScorecardSubmitted',
  'candidateEvaluationSubmitted',
]);

// Comment bodies we posted ourselves (so we don't flag our own automated
// notes as "human activity").
function isOurOwnNote(body) {
  if (!body) return false;
  return (
    body.includes('AI Candidate Review') ||
    body.includes('MOVED BACK FROM DISQUALIFIED') ||
    body.includes('FLAGGED FOR RECONSIDERATION')
  );
}

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log(`Authenticated. Company: ${company}. Checking stream history for ${CANDIDATES.length} candidates.`);

  const results = [];
  for (const c of CANDIDATES) {
    console.log(`\n--- ${c.name} (${c.candidateId}) ---`);
    let stream;
    try {
      stream = await client.getCandidateStream(c.positionId, c.candidateId, company);
    } catch (e) {
      console.log('  ERROR fetching stream:', e.message);
      results.push({ ...c, error: e.message });
      continue;
    }
    if (!Array.isArray(stream)) stream = [];

    const interviewEvents = stream.filter((e) => e && INTERVIEW_SIGNAL_TYPES.has(e.type));
    const stageEvents = stream
      .filter((e) => e && e.type === 'candidateStatusUpdated')
      .map((e) => ({ timestamp: e.timestamp, raw: e }));
    const humanComments = stream
      .filter((e) => e && e.type === 'companyNotePosted' && e.object && !isOurOwnNote(e.object.body))
      .map((e) => ({ timestamp: e.timestamp, author: e.actor || e.author || null, body: (e.object && e.object.body) || '' }));

    console.log(`  interview signal events: ${interviewEvents.length}, stage-change events: ${stageEvents.length}, human notes: ${humanComments.length}`);

    results.push({
      ...c,
      stream_length: stream.length,
      interview_signal_count: interviewEvents.length,
      interview_signals: interviewEvents,
      stage_change_events: stageEvents,
      human_notes: humanComments,
    });
  }

  const outPath = path.join(__dirname, '..', 'data', 'phone_screen_history_check.json');
  fs.writeFileSync(outPath, JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2));
  console.log(`\nWrote ${outPath}`);

  const flagged = results.filter((r) => (r.interview_signal_count || 0) > 0 || (r.human_notes || []).length > 0);
  console.log(`\n${flagged.length}/${results.length} candidates have some sign of human interview activity or notes - review before reactivating.`);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
