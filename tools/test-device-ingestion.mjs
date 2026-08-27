import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window:{}, console, Date, Map, Number, String, Math, Array, Object, JSON, Set, Error };
vm.createContext(context);
vm.runInContext(fs.readFileSync('ingestion.js', 'utf8'), context, { filename:'ingestion.js' });
const ingestion = context.window.Zero2FitIngestion;
assert.ok(ingestion, 'ingestion module should expose Zero2FitIngestion');

const csv = [
  'Time of Measurement,Weight(lb),BMI,Body Fat(%),Muscle Mass(lb),Body Water(%)',
  '2026-08-27 08:00:00,238.4,29.8,27.1,164.2,53.4'
].join('\n');
const renpho = ingestion.parseRenphoCsv(csv, 'renpho-test.csv');
assert.equal(renpho.events.length, 5, 'representative RENPHO row should normalize supported fields');
const weight = renpho.events.find(event => event.metric_type === 'weight');
assert.equal(weight.value, 238.4);
assert.equal(weight.unit, 'lb');
assert.equal(weight.confidence, 'measured');
const bodyFat = renpho.events.find(event => event.metric_type === 'body_fat_percentage');
assert.equal(bodyFat.confidence, 'trend_estimate');

const renamedRenpho = ingestion.parseRenphoCsv(csv, 'renamed-export.csv');
for (const event of renpho.events) {
  const renamed = renamedRenpho.events.find(candidate => candidate.metric_type === event.metric_type);
  assert.equal(renamed?.event_id, event.event_id, `RENPHO ${event.metric_type} event ID should not depend on export filename`);
}

const bridge = ingestion.normalizeBundle({
  source_provider:'healthkit_bridge',
  events:[{
    metric_type:'steps', value:7000, unit:'count', observed_at:'2026-08-27T12:00:00-03:00',
    source_provider:'healthkit_bridge', provenance_status:'imported', confidence:'measured', metadata:{aggregation:'daily_total'}
  }]
});
assert.equal(bridge.events.length, 1);
assert.equal(bridge.events[0].metadata.aggregation, 'daily_total');
assert.equal(bridge.events[0].source_provider, 'healthkit_bridge');

const duplicateBridge = ingestion.normalizeBundle({ events:[{
  metric_type:'weight', value:100, unit:'kg', observed_at:'2026-08-27T10:00:00Z', source_provider:'healthkit_bridge', source_record_id:'scale-1'
}] });
const duplicateBridge2 = ingestion.normalizeBundle({ events:[{
  metric_type:'weight', value:100, unit:'kg', observed_at:'2026-08-27T10:00:00Z', source_provider:'healthkit_bridge', source_record_id:'scale-1'
}] });
assert.equal(duplicateBridge.events[0].event_id, duplicateBridge2.events[0].event_id, 'same source record should produce stable event ID');

console.log(`Device ingestion checks passed: ${renpho.events.length} RENPHO fields normalized; renamed exports and bridge records dedupe stably.`);
