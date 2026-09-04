/** Thin DOM helpers shared by the view layer. */

/** `document.getElementById`, shortened. */
export const el = id => document.getElementById(id);

/** Show a transient status message. Only one is on screen at a time. */
export function toast(msg){
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

/** True while the keyboard focus sits in a field, so hotkeys must stand down. */
export function isTyping(){
  const a = document.activeElement;
  return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
}
