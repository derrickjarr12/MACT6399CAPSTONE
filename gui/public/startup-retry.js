(function startupRetryGuard() {
  var RETRY_KEY = 'saion_startup_retry_attempts';
  var PANEL_ID = 'saion-startup-recovery-panel';
  var MAX_RETRIES = 1;
  var RETRY_DELAY_MS = 7000;

  function safeGetAttempts() {
    try {
      var value = window.sessionStorage.getItem(RETRY_KEY);
      var parsed = Number.parseInt(value || '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (_error) {
      return 0;
    }
  }

  function safeSetAttempts(value) {
    try {
      window.sessionStorage.setItem(RETRY_KEY, String(value));
    } catch (_error) {
      // Ignore storage failures and continue without persistence.
    }
  }

  function safeResetAttempts() {
    try {
      window.sessionStorage.removeItem(RETRY_KEY);
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function isMounted() {
    if (window.__SAION_APP_MOUNTED__) return true;

    var root = document.getElementById('root');
    return Boolean(root && root.childElementCount > 0);
  }

  function removeFallbackPanel() {
    var existing = document.getElementById(PANEL_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function createActionButton(label, onClick, secondary) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cursor = 'pointer';
    button.style.padding = '10px 14px';
    button.style.borderRadius = '10px';
    button.style.border = secondary ? '1px solid #51607f' : '1px solid #57d4ff';
    button.style.background = secondary ? '#1a243b' : '#0d3553';
    button.style.color = '#e8f2ff';
    button.style.fontFamily = 'Space Grotesk, sans-serif';
    button.style.fontSize = '13px';
    button.style.fontWeight = '600';
    button.addEventListener('click', onClick);
    return button;
  }

  function showFallbackPanel(reason) {
    if (isMounted()) return;

    var existing = document.getElementById(PANEL_ID);
    if (existing) return;

    var root = document.getElementById('root') || document.body;
    if (!root) return;

    var wrapper = document.createElement('div');
    wrapper.id = PANEL_ID;
    wrapper.style.position = 'fixed';
    wrapper.style.inset = '0';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.padding = '20px';
    wrapper.style.background = 'radial-gradient(circle at 50% 20%, rgba(69, 129, 183, 0.35), rgba(8, 13, 25, 0.96))';
    wrapper.style.zIndex = '9999';

    var card = document.createElement('div');
    card.style.width = 'min(540px, 92vw)';
    card.style.background = 'rgba(9, 16, 31, 0.95)';
    card.style.border = '1px solid rgba(92, 152, 221, 0.45)';
    card.style.borderRadius = '14px';
    card.style.padding = '20px';
    card.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.45)';
    card.style.color = '#e6eeff';
    card.style.fontFamily = 'Space Grotesk, sans-serif';

    var title = document.createElement('div');
    title.textContent = 'SAION is taking longer than expected to start';
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    title.style.marginBottom = '10px';

    var detail = document.createElement('p');
    detail.style.margin = '0 0 14px 0';
    detail.style.fontSize = '14px';
    detail.style.lineHeight = '1.5';
    detail.style.color = '#c3d5ff';
    detail.textContent = reason === 'offline'
      ? 'Your browser appears to be offline. Reconnect and try again.'
      : 'We already performed one automatic refresh. Use the buttons below to try again.';

    var actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.flexWrap = 'wrap';
    actionRow.style.gap = '10px';

    var refreshButton = createActionButton('Try Again', function () {
      safeSetAttempts(0);
      window.location.reload();
    }, false);

    var hardRefreshButton = createActionButton('Hard Refresh', function () {
      safeSetAttempts(0);
      window.location.href = window.location.origin + window.location.pathname + window.location.search;
    }, true);

    actionRow.appendChild(refreshButton);
    actionRow.appendChild(hardRefreshButton);

    card.appendChild(title);
    card.appendChild(detail);
    card.appendChild(actionRow);
    wrapper.appendChild(card);
    root.appendChild(wrapper);
  }

  function markMounted() {
    if (!isMounted()) return;
    removeFallbackPanel();
    safeResetAttempts();
    window.__SAION_APP_MOUNTED__ = true;
  }

  window.addEventListener('saion:app-mounted', markMounted);
  window.addEventListener('load', markMounted);

  window.setTimeout(function onStartupTimeout() {
    if (isMounted()) {
      markMounted();
      return;
    }

    if (navigator.onLine === false) {
      showFallbackPanel('offline');
      return;
    }

    var attempts = safeGetAttempts();
    if (attempts >= MAX_RETRIES) {
      showFallbackPanel('retry_exhausted');
      return;
    }

    safeSetAttempts(attempts + 1);
    window.location.reload();
  }, RETRY_DELAY_MS);
})();
