import { apiPost } from './api.js';

const HISTORY_KEY = 'ocbp_chat_history';
const ARABIC_RE = /[؀-ۿ]/;
const MAX_HISTORY = 20;

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // stockage indisponible (navigation privée, quota) — l'historique reste en mémoire pour cette page
  }
}

function injectStyles() {
  if (document.getElementById('chatbot-styles')) return;
  const style = document.createElement('style');
  style.id = 'chatbot-styles';
  style.textContent = `
    #cb-toggle{ position:fixed; right:22px; bottom:22px; z-index:9998; width:56px; height:56px; border-radius:50%;
      background:var(--emerald,#0F9D58); color:#fff; border:none; box-shadow:0 6px 18px rgba(11,37,69,.28);
      font-size:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    #cb-toggle:hover{ filter:brightness(1.05); }
    #cb-panel{ position:fixed; right:22px; bottom:88px; z-index:9998; width:340px; max-width:92vw; height:460px;
      max-height:70vh; background:var(--card,#fff); border:1px solid var(--line,#E3E9F2); border-radius:16px;
      box-shadow:0 14px 40px rgba(11,37,69,.22); display:flex; flex-direction:column; overflow:hidden;
      font-family:Inter,system-ui,sans-serif; }
    #cb-panel.hidden{ display:none; }
    #cb-header{ background:var(--navy,#0B2545); color:#fff; padding:12px 14px; font-weight:600; font-size:14px;
      display:flex; align-items:center; justify-content:space-between; }
    #cb-header button{ background:none; border:none; color:#fff; font-size:16px; cursor:pointer; opacity:.85; }
    #cb-messages{ flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }
    .cb-bubble{ max-width:85%; padding:8px 11px; border-radius:12px; font-size:13px; line-height:1.4; white-space:pre-wrap; }
    .cb-user{ align-self:flex-end; background:var(--emerald,#0F9D58); color:#fff; border-bottom-right-radius:3px; }
    .cb-assistant{ align-self:flex-start; background:var(--paper,#F4F7FB); color:var(--ink,#0B2545); border-bottom-left-radius:3px; }
    .cb-error{ align-self:center; color:var(--warn,#C0392B); font-size:12px; text-align:center; }
    .cb-rtl{ direction:rtl; text-align:right; }
    #cb-form{ display:flex; gap:6px; padding:10px; border-top:1px solid var(--line,#E3E9F2); }
    #cb-input{ flex:1; resize:none; border:1px solid var(--line,#E3E9F2); border-radius:10px; padding:8px 10px;
      font-size:13px; font-family:inherit; max-height:70px; }
    #cb-send{ background:var(--emerald,#0F9D58); color:#fff; border:none; border-radius:10px; padding:0 14px;
      font-weight:600; cursor:pointer; font-size:13px; }
    #cb-send:disabled{ opacity:.5; cursor:default; }
    #cb-intro{ color:var(--muted,#6B7C93); font-size:12.5px; padding:2px 4px 6px; }
  `;
  document.head.appendChild(style);
}

function bubbleEl(role, content) {
  const div = document.createElement('div');
  div.className = 'cb-bubble ' + (role === 'user' ? 'cb-user' : 'cb-assistant');
  if (ARABIC_RE.test(content)) div.classList.add('cb-rtl');
  div.textContent = content;
  return div;
}

function errorEl(text) {
  const div = document.createElement('div');
  div.className = 'cb-bubble cb-error';
  div.textContent = text;
  return div;
}

function mount() {
  injectStyles();

  const toggle = document.createElement('button');
  toggle.id = 'cb-toggle';
  toggle.type = 'button';
  toggle.title = 'Assistant One Click BP';
  toggle.textContent = '💬';

  const panel = document.createElement('div');
  panel.id = 'cb-panel';
  panel.className = 'hidden';
  panel.innerHTML = `
    <div id="cb-header">
      <span>🤖 Assistant One Click BP</span>
      <button type="button" id="cb-close" aria-label="Fermer">✕</button>
    </div>
    <div id="cb-messages">
      <div id="cb-intro">Posez vos questions en français, en anglais ou en arabe/darija — sur le business plan, INTELAKA ou FORSA.</div>
    </div>
    <form id="cb-form">
      <textarea id="cb-input" rows="1" placeholder="Écrivez votre question…"></textarea>
      <button id="cb-send" type="submit">Envoyer</button>
    </form>
  `;

  document.body.appendChild(toggle);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#cb-messages');
  const input = panel.querySelector('#cb-input');
  const sendBtn = panel.querySelector('#cb-send');
  const form = panel.querySelector('#cb-form');

  let history = loadHistory();
  for (const m of history) messagesEl.appendChild(bubbleEl(m.role, m.content));

  toggle.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) input.focus();
  });
  panel.querySelector('#cb-close').addEventListener('click', () => panel.classList.add('hidden'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    history.push({ role: 'user', content: text });
    messagesEl.appendChild(bubbleEl('user', text));
    input.value = '';
    saveHistory(history);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    sendBtn.disabled = true;
    input.disabled = true;
    try {
      const { reply } = await apiPost('/api/chatbot/message', { messages: history });
      history.push({ role: 'assistant', content: reply });
      messagesEl.appendChild(bubbleEl('assistant', reply));
      saveHistory(history);
    } catch (err) {
      const message =
        err.status === 503
          ? "L'assistant n'est pas encore configuré sur ce déploiement."
          : err.status === 401
          ? 'Connectez-vous pour utiliser l’assistant.'
          : "L'assistant est momentanément indisponible, réessayez.";
      messagesEl.appendChild(errorEl(message));
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  form.querySelector('#cb-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
