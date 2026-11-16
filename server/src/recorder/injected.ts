export const INJECTED_RECORDER = `
(() => {
  if (window.__rpaRecorderInstalled) return;
  window.__rpaRecorderInstalled = true;

  const box = document.createElement('div');
  box.id = '__rpa_hover';
  box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #0f766e;background:rgba(15,118,110,0.12);display:none;';
  const mount = () => {
    const parent = document.documentElement || document.body;
    if (parent && !box.isConnected) parent.appendChild(box);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  function cssAttr(value) {
    return String(value).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
  }

  function implicitRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'submit' || type === 'button') return 'button';
    }
    return el.getAttribute('role');
  }

  function selectorFor(el) {
    if (!(el instanceof Element)) return 'body';
    const testid = el.getAttribute('data-testid');
    if (testid) return '[data-testid="' + cssAttr(testid) + '"]';
    if (el.id) {
      const idSel = '#' + CSS.escape(el.id);
      if (document.querySelectorAll(idSel).length === 1) return idSel;
    }
    const name = el.getAttribute('name');
    if (name) {
      const sel = el.tagName.toLowerCase() + '[name="' + cssAttr(name) + '"]';
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch (err) {}
    }
    const role = implicitRole(el);
    const label = el.getAttribute('aria-label');
    if (role && label) return 'role=' + role + '[name="' + cssAttr(label) + '"]';
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift('#' + CSS.escape(node.id));
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
        if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ') || 'body';
  }

  function emit(payload) {
    const send = window.__rpaEmit;
    if (typeof send === 'function') Promise.resolve(send(payload)).catch(() => {});
  }

  document.addEventListener('mouseover', (event) => {
    const el = event.target;
    if (!(el instanceof Element) || el.id === '__rpa_hover') return;
    mount();
    const rect = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = Math.max(rect.width, 2) + 'px';
    box.style.height = Math.max(rect.height, 2) + 'px';
  }, true);

  document.addEventListener('click', (event) => {
    const el = event.target;
    if (!(el instanceof Element) || el.id === '__rpa_hover') return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    emit({ kind: 'click', selector: selectorFor(el), url: location.href });
  }, true);

  let fillTimer = 0;
  let pending = null;
  function flushFill() {
    if (!pending) return;
    emit({ kind: 'fill', selector: pending.selector, value: pending.value, url: location.href });
    pending = null;
  }
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
    if (el.id === '__rpa_hover') return;
    pending = { selector: selectorFor(el), value: el.value };
    window.clearTimeout(fillTimer);
    fillTimer = window.setTimeout(flushFill, 400);
  }, true);
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLSelectElement)) return;
    emit({ kind: 'select', selector: selectorFor(el), value: el.value, url: location.href });
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    flushFill();
    const el = event.target;
    if (!(el instanceof Element)) return;
    emit({ kind: 'press', key: 'Enter', selector: selectorFor(el), url: location.href });
  }, true);
  window.addEventListener('load', () => {
    if (window.top !== window) return;
    if (!location.href || location.href === 'about:blank') return;
    emit({ kind: 'openUrl', url: location.href });
  });
})();
`
