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
    .catch((error) => console.warn('LifeOS legacy cache cleanup failed', error))
    .then(() => fetch(RELEASE_ENDPOINT, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    }))
    .then((response) => {
      if (!response.ok) throw new Error(`Release metadata returned HTTP ${response.status}`);
      return response.json();
    })
    .then(applyMetadata)
    .catch((error) => {
      console.error('LifeOS release metadata unavailable', error);
      document.documentElement.dataset.lifeosReleaseStatus = 'unavailable';
      throw error;
    });
})();
