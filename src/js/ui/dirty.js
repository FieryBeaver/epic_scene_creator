/**
 * Unsaved-changes mark.
 *
 * The board autosaves to this browser and, when connected, to the repo — but
 * the file on disk only changes when someone exports. A dot on the export
 * button says which of those is out of date, without a banner claiming the
 * work is at risk when it is not.
 */

import { t } from '../i18n/index.js';

import { dirty } from '../core/state.js';
import { el } from '../util/dom.js';

export function renderDirty(){
  const button = el('bExport');
  if (!button) return;
  const dot = button.querySelector('.dirty');
  if (!dot) return;
  dot.hidden = !dirty;
  button.title = dirty ? t('top.exportDirty') : t('top.exportTip');
}
