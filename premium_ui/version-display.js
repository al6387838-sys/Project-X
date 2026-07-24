(() => {
  'use strict';

  const RELEASE_ENDPOINT = '/release.json';

  async function clearLegacyServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  }

  function applyMetadata(metadata) {
    const release = String(metadata.release || '');
    const buildId = String(metadata.buildId || '');
    const commit = String(metadata.commit || '');

    if (!/^v\d+\.\d+\.\d+$/.test(release) || !buildId || !commit) {
      throw new Error('Release metadata failed client-side validation');
    }

    document.querySelectorAll('[data-lifeos-release]').forEach((element) => {
      element.textContent = release;
    });
    document.querySelectorAll('[data-lifeos-build]').forEach((element) => {
      element.textContent = buildId;
    });
    document.querySelectorAll('[data-lifeos-commit]').forEach((element) => {
      element.textContent = commit;
    });

    document.querySelectorAll('[data-lifeos-title-prefix]').forEach((element) => {
      element.textContent = `${element.dataset.lifeosTitlePrefix} ${release}`;
    });
    document.querySelectorAll('[data-lifeos-meta-prefix]').forEach((element) => {
      element.setAttribute('content', `${element.dataset.lifeosMetaPrefix} ${release}`);
    });

    window.LifeOSReleaseMetadata = Object.freeze({ ...metadata });
    window.dispatchEvent(new CustomEvent('lifeos:release-ready', { detail: window.LifeOSReleaseMetadata }));
    return window.LifeOSReleaseMetadata;
  }

  window.LifeOSReleaseReady = clearLegacyServiceWorkers()
    .catch((error) => /* warn handled */
      return response.json();
    })
    .then(applyMetadata)
    .catch((error) => {
      /* error handled */
      document.documentElement.dataset.lifeosReleaseStatus = 'unavailable';
      throw error;
    });
})();
