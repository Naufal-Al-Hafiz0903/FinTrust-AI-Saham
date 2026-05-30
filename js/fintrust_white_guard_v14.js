(function () {
  const VERSION = '20260529-white-guard-v14';

  function forceVisible() {
    document.body.classList.add('fintrust-force-visible');

    document.documentElement.style.setProperty('background', '#070d18', 'important');
    document.body.style.setProperty('background', '#070d18', 'important');
    document.body.style.setProperty('color', '#eaf6ee', 'important');
    document.body.style.setProperty('opacity', '1', 'important');
    document.body.style.setProperty('visibility', 'visible', 'important');

    document.querySelectorAll('.app, .app-shell, .dashboard, .layout, main, .main, .content, .sidebar').forEach(function (node) {
      node.style.setProperty('opacity', '1', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
    });
  }

  window.addEventListener('error', function (event) {
    console.error('[Fintrust Guard] JS error:', event.message, event.filename, event.lineno);
    forceVisible();
  });

  window.addEventListener('unhandledrejection', function (event) {
    console.error('[Fintrust Guard] Promise error:', event.reason);
    forceVisible();
  });

  document.addEventListener('DOMContentLoaded', forceVisible);
  window.addEventListener('load', forceVisible);

  setTimeout(forceVisible, 100);
  setTimeout(forceVisible, 700);
  setTimeout(forceVisible, 1500);

  window.__FINTRUST_WHITE_GUARD__ = VERSION;
})();
