/* ============================================================
   FitAI — Bootstrap
   ============================================================ */
(async function boot() {
  // carrega dados públicos (modalidades) uma vez para landing
  try {
    const site = await fetch('/api/public/site').then((r) => r.json());
    window.__site = site;
  } catch { window.__site = { modalities: [], plans: [], stats: { exercises: 65 } }; }

  await loadSession();

  // rotas registradas em ordem — landing por último
  route('/', (root) => renderLanding(root));

  await renderRoute();
})();
