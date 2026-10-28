import { GLOSSARY_MAP } from '../content/glossary.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'className') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'disabled' || key === 'checked' || key === 'selected' || key === 'value') {
      el[key] = value;
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, value);
    }
  }
  append(el, ...children);
  return el;
}

export function append(el, ...children) {
  for (const child of children) {
    if (child == null || child === false || child === true) continue;
    if (Array.isArray(child)) append(el, ...child);
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function richText(text) {
  const frag = document.createDocumentFragment();
  if (!text) return frag;
  const source = String(text);
  const regex = /\{\{([a-z0-9-]+)\}\}/gi;
  let last = 0;
  let match;
  while ((match = regex.exec(source))) {
    if (match.index > last) {
      frag.appendChild(document.createTextNode(source.slice(last, match.index)));
    }
    const id = match[1];
    const term = GLOSSARY_MAP[id];
    if (term) {
      frag.appendChild(
        h(
          'button',
          {
            type: 'button',
            className: 'term-link',
            dataset: { term: id },
            title: `${term.term} · ${term.en}`,
            'aria-label': `术语：${term.term}（${term.en}）`
          },
          term.term
        )
      );
    } else {
      frag.appendChild(document.createTextNode(match[0]));
    }
    last = match.index + match[0].length;
  }
  if (last < source.length) frag.appendChild(document.createTextNode(source.slice(last)));
  return frag;
}

export function rich(tag, attrs, text) {
  const el = h(tag, attrs);
  el.appendChild(richText(text));
  return el;
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
    2,
    '0'
  )}`;
}

export function relativeTime(ts, now = Date.now()) {
  if (!ts) return '—';
  const diff = ts - now;
  const abs = Math.abs(diff);
  if (abs < 60 * 1000) return diff >= 0 ? '即将' : '刚刚';
  const days = Math.round(abs / (24 * 60 * 60 * 1000));
  if (days >= 1) return diff > 0 ? `${days} 天后` : `${days} 天前`;
  const hours = Math.round(abs / (60 * 60 * 1000));
  if (hours >= 1) return diff > 0 ? `${hours} 小时后` : `${hours} 小时前`;
  const minutes = Math.max(1, Math.round(abs / (60 * 1000)));
  return diff > 0 ? `${minutes} 分钟后` : `${minutes} 分钟前`;
}

let toastTimer = null;

export function toast(message, tone = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  root.innerHTML = '';
  const el = h('div', { className: `toast toast-${tone}`, role: 'status' }, message);
  root.appendChild(el);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

export function openModal({ title, content, wide = false, onClose = null }) {
  const root = document.getElementById('modal-root');
  if (!root) return null;
  clear(root);
  const close = () => {
    clear(root);
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  const dialog = h(
    'div',
    {
      className: `modal ${wide ? 'modal-wide' : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title || '对话框'
    },
    h(
      'div',
      { className: 'modal-head' },
      h('h2', {}, title || ''),
      h('button', { type: 'button', className: 'icon-btn', 'aria-label': '关闭', onClick: close }, '×')
    ),
    h('div', { className: 'modal-body' }, content),
    h(
      'div',
      { className: 'modal-foot' },
      h('button', { type: 'button', className: 'btn btn-ghost', onClick: close }, '关闭')
    )
  );
  const overlay = h(
    'div',
    {
      className: 'modal-overlay',
      onClick: (event) => {
        if (event.target === overlay) close();
      }
    },
    dialog
  );
  root.appendChild(overlay);
  document.addEventListener('keydown', onKey);
  const focusable = dialog.querySelector('button');
  if (focusable) focusable.focus();
  return { close };
}

export function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function progressBar(value, label = '') {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return h(
    'div',
    { className: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label || '进度' },
    h('div', { className: 'progress-fill', style: { width: `${pct}%` } })
  );
}

export function difficultyStars(n) {
  const stars = Math.max(1, Math.min(5, Number(n) || 1));
  return h(
    'span',
    { className: 'difficulty', title: `难度 ${stars}/5`, 'aria-label': `难度 ${stars}/5` },
    '●'.repeat(stars) + '○'.repeat(5 - stars)
  );
}

export function emptyState(title, text, action = null) {
  return h(
    'div',
    { className: 'empty-state' },
    h('div', { className: 'empty-icon', 'aria-hidden': 'true' }, '♠'),
    h('h3', {}, title),
    h('p', {}, text),
    action
  );
}
