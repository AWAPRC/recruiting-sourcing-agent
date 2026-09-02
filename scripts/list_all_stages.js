// Discovery: list every open position and its full pipeline stage list,
// so we can identify the correct "Disqualified"/"Not a Fit" stage_id per role
// before wiring up auto-disqualify.
const { BreezyClient } = require('./breezy_client');

const EMAIL = process.env.BREEZY_EMAIL;
const PASSWORD = process.env.BREEZY_PASSWORD;

(async () => {
  const client = new BreezyClient(EMAIL, PASSWORD);
  const token = await client.getToken();
  const company = await client.getCompanyId();
  const positions = await client.api('GET', `/company/${company}/positions`);
  const list = Array.isArray(positions) ? positions : positions.positions || [];

  for (const p of list) {
    if (p.state !== 'published') continue;
    console.log(`\n=== ${p.name} (${p._id}) ===`);
    const detail = await client.api('GET', `/company/${company}/position/${p._id}`);
    const pipelineId = detail.pipeline_id || (detail.pipeline && detail.pipeline._id);
    if (!pipelineId) { console.log('  no pipeline_id found'); continue; }
    const pipeline = await client.api('GET', `/company/${company}/pipeline/${pipelineId}`);
    const stages = pipeline.stages || pipeline.stage_list || pipeline;
    console.log('  stages:', JSON.stringify(stages));
  }
})();
