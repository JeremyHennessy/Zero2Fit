import assert from 'node:assert/strict';
import * as core from '../activation-handoff-core.mjs';

assert.equal(core.activationTarget('?activation=healthkit'), 'healthkit');
assert.equal(core.activationTarget('activation=healthkit&foo=bar'), 'healthkit');
assert.equal(core.activationTarget('?activation=HealthKit'), null);
assert.equal(core.activationTarget('?activation=healthkit&bundle=com.vendor.secret'), 'healthkit');
assert.equal(core.activationTarget('?activation=other'), null);
assert.equal(core.activationTarget(''), null);

const live = core.liveHealthKitEvidenceUrl();
const liveUrl = new URL(live);
assert.equal(liveUrl.origin, 'https://jeremyhennessy.github.io');
assert.equal(liveUrl.pathname, '/Zero2Fit/');
assert.deepEqual([...liveUrl.searchParams.keys()], ['activation']);
assert.equal(liveUrl.searchParams.get('activation'), 'healthkit');
assert.ok(!/bundle|source|weight|heart|sleep|token|email|user/i.test(liveUrl.search));

assert.equal(
  core.sanitizedActivationUrl('https://jeremyhennessy.github.io/Zero2Fit/?activation=healthkit'),
  '/Zero2Fit/'
);
assert.equal(
  core.sanitizedActivationUrl('https://jeremyhennessy.github.io/Zero2Fit/?foo=bar&activation=healthkit#x'),
  '/Zero2Fit/?foo=bar#x'
);

console.log('Build 031 activation handoff core tests passed.');
