(() => {
  'use strict';
  let attempts = 0;

  function install() {
    const remote = window.Zero2FitRemoteSync;
    const evidence = window.Zero2FitHealthKitEvidence;
    if ((!remote?.verifySource || !remote.verifySource.__z28Wrapped || !evidence?.saveEvidence) && attempts < 200) {
      attempts += 1;
      setTimeout(install, 100);
      return;
    }
    if (!remote?.verifySource || remote.verifySource.__z28EvidencePersistWrapped) return;

    const gatedVerify = remote.verifySource.bind(remote);
    const wrapped = async args => {
      const provider = args?.provider;
      if (provider === 'zepp' || provider === 'renpho') {
        const readiness = evidence.verificationReadiness(provider);
        if (!readiness?.ready) throw new Error(`Physical evidence gate: ${readiness?.reason || 'physical evidence is incomplete.'}`);
        await evidence.saveEvidence();
      }
      return gatedVerify(args);
    };
    wrapped.__z28Wrapped = true;
    wrapped.__z28EvidencePersistWrapped = true;
    remote.verifySource = wrapped;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
