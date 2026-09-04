/**
 * Language in the interface: filling the static markup, and the switcher.
 *
 * Everything rendered from JavaScript picks up the current language on the
 * next render. The markup in index.html cannot, so it carries `data-i18n`
 * (text) and `data-i18n-attr` (attributes) and is filled in from here.
 */

import { t, getLocale, setLocale, onLocaleChange, applyDocumentLang, LOCALES }
  from '../i18n/index.js';
import { esc } from '../util/html.js';
import { el } from '../util/dom.js';

/** Fill every element in the markup that declares a key. */
export function applyStaticText(root = document){
  root.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(node => {
    node.getAttribute('data-i18n-attr').split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(x => x.trim());
      if (attr && key) node.setAttribute(attr, t(key));
    });
  });
}

export function renderLangChoice(){
  const box = el('langChoice');
  if (!box) return;
  const current = getLocale();
  box.innerHTML = LOCALES.map(([code, name]) =>
    `<button class="lang${code === current ? ' on' : ''}" data-lang="${esc(code)}"
      lang="${esc(code)}" aria-pressed="${code === current}">${esc(name)}</button>`).join('');
}

/**
 * @param {() => void} repaint  called after a switch, to redraw everything
 *   that was rendered in the old language
 */
export function initLanguage(repaint){
  applyDocumentLang();
  applyStaticText();
  renderLangChoice();

  document.addEventListener('click', ev => {
    const button = ev.target.closest('[data-lang]');
    if (!button) return;
    // Keep the menu open: switching is something you may want to see undone.
    ev.stopPropagation();
    setLocale(button.getAttribute('data-lang'));
  });

  onLocaleChange(() => {
    applyStaticText();
    renderLangChoice();
    repaint();
  });
}
