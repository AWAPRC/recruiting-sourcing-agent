// One-off audit (2026-09-28): Devanne asked to re-check everyone currently
// sitting in the Adolescent Services Manager "Applied"/screening stage (this
// is where the 2026-09-24 DQ audit put reactivated candidates back) for
// anything that should send them back to Disqualified - reviewing resume,
// questionnaire, notes, missed meetings, and messages. This script pulls
// live data (current candidate list + full stream) for that stage so the
// review is based on today's state, not the 2026-09-24 snapshot in
// data/phone_screen_history_check.json. It makes NO stage moves itself -
// it only dumps data for review. A follow-up one-off script applies any
// moves Devanne/Claude decide on after reading this output.
const fs = require('fs');
const path = require('path');
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;
const POSITION_ID = '70abb2f01e85'; // Adolescent Services Manager
const TARGET_STAGE_ID = 'applied'; // "Applied"/screening stage

function isOurOwnNote(body) {
  if (!body) return false;
  return (
    body.includes('AI Candidate Review') ||
    body.includes('MOVED BACK FROM DISQUALIFIED') ||
    body.includes('FLAGGED FOR RECONSIDERATION') ||
    body.includes('REVERTED - MOVED BACK TO DISQUALIFIED')
  );
}

const INTERVIEW_SIGNAL_TYPES = new Set([
  'candidateInterviewScheduled',
  'candidateInterviewCancel',
  'candidateScorecardSubmitted',
  'candidateEvaluationSubmitted',
]);

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  console.log('Authenticated. Company:', company);

  const candidates = await client.listCandidates(POSITION_ID, company);
  const inStage = (Array.isArray(candidates) ? candidates : []).filter(
    (c) => c.stage && c.stage.id === TARGET_STAGE_ID
  );
  console.log(`Found ${inStage.length} candidates currently in "${TARGET_STAGE_ID}" stage for ${POSITION_ID}.`);

  const results = [];
  for (const c of inStage) {
    const cid = c._id || c.id;
    console.log(`\n--- ${c.name} (${cid}) ---`);
    let full;
    try {
      full = await client.getCandidate(POSITION_ID, cid, company);
    } catch (e) {
      console.log('  ERROR fetching candidate:', e.message);
    }
    let stream = [];
    try {
      stream = await client.getCandidateStream(POSITION_ID, cid, company);
      if (!Array.isArray(stream)) stream = [];
    } catch (e) {
      console.log('  ERROR fetching stream:', e.message);
    }

    const interviewEvents = stream.filter((e) => e && INTERVIEW_SIGNAL_TYPES.has(e.type));
    const humanComments = stream
      .filter((e) => e && e.type === 'companyNotePosted' && e.object && !isOurOwnNote(e.object.body))
      .map((e) => ({ timestamp: e.timestamp, body: (e.object && e.object.body) || '' }));

    results.push({
      candidate_id: cid,
      name: c.name,
      cover_letter: full && full.cover_letter,
      questionnaire: full && full.questionnaire,
      education: full && full.education,
      work_history: full && (full.work_history || full.experience),
      interview_signal_count: interviewEvents.length,
      interview_signals: interviewEvents,
      human_notes: humanComments,
      stream_length: stream.length,
    });
  }

  const outPath = path.join(__dirname, '..', 'data', `dq_reaudit_asm_${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ pulled_at: new Date().toISOString(), position_id: POSITION_ID, stage_id: TARGET_STAGE_ID, results }, null, 2));
  console.log(`\nWrote ${outPath} with ${results.length} candidates.`);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
