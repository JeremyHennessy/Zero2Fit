export const HEALTHKIT_ACTIVATION = 'healthkit';

export function activationTarget(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/,''));
  return params.get('activation') === HEALTHKIT_ACTIVATION ? HEALTHKIT_ACTIVATION : null;
}

export function sanitizedActivationUrl(input) {
  const url = new URL(input, 'https://example.invalid/');
  url.searchParams.delete('activation');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function liveHealthKitEvidenceUrl(base = 'https://jeremyhennessy.github.io/Zero2Fit/') {
  const url = new URL(base);
  url.searchParams.set('activation', HEALTHKIT_ACTIVATION);
  return url.toString();
}
