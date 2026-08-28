import { apiGet, apiPost, apiDelete } from './api.js';

const loadingScreen = document.getElementById('loadingScreen');
const authView = document.getElementById('authView');
const onboardingView = document.getElementById('onboardingView');
const projectsView = document.getElementById('projectsView');

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

let currentUser = null;

async function init() {
  try {
    const data = await apiGet('/api/auth/me');
    currentUser = data.user;
    hide(loadingScreen);
    await loadProjectsAndRoute();
  } catch (e) {
    hide(loadingScreen);
    show(authView);
  }
}

/**
 * Après connexion : si l'utilisateur a déjà des projets, on affiche
 * "Mes projets" en premier ; sinon on va directement à l'onboarding
 * (choix du type de projet), pour ne pas montrer une liste vide inutile.
 */
async function loadProjectsAndRoute() {
  setGreeting(currentUser);
  show(projectsView);
  hide(onboardingView);
  document.getElementById('projectsListLoading').classList.remove('hidden');
  document.getElementById('projectsEmpty').classList.add('hidden');
  document.getElementById('projectsGrid').innerHTML = '';

  try {
    const data = await apiGet('/api/projects');
    document.getElementById('projectsListLoading').classList.add('hidden');
    if (!data.projects || data.projects.length === 0) {
      hide(projectsView);
      showOnboarding({ fromList: false });
      return;
    }
    renderProjects(data.projects);
  } catch (err) {
    document.getElementById('projectsListLoading').classList.add('hidden');
    // Si le chargement de la liste échoue, on ne bloque pas l'utilisateur : on l'envoie créer un projet.
    hide(projectsView);
    showOnboarding({ fromList: false });
  }
}

function setGreeting(user) {
  const text = user?.fullName ? `Bonjour, ${user.fullName}` : (user?.email || '');
  document.getElementById('userGreeting').textContent = text;
  document.getElementById('userGreetingProjects').textContent = text;
}

function showOnboarding({ fromList } = {}) {
  setGreeting(currentUser);
  hide(projectsView);
  show(onboardingView);
  document.getElementById('backToProjectsBtn').classList.toggle('hidden', !fromList);
  onboardingError.classList.add('hidden');
}

/* ---------------- Mes projets : rendu ---------------- */
const TYPE_LABELS = { nouvelle_entreprise: 'Nouvelle entreprise', nouvelle_activite: 'Nouvelle activité' };
const TYPE_ICONS = { nouvelle_entreprise: '🏢', nouvelle_activite: '🔀' };

function fmtDate(iso) {
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function renderProjects(projects) {
  const grid = document.getElementById('projectsGrid');
  const empty = document.getElementById('projectsEmpty');
  if (projects.length === 0) {
    grid.innerHTML = '';
    show(empty);
    return;
  }
  hide(empty);
  grid.innerHTML = projects.map((p) => {
    const isGenerated = p.status === 'generated';
    const statusBadge = isGenerated
      ? '<span class="badge ok">✅ Généré</span>'
      : '<span class="badge warn">📝 Brouillon</span>';
    const actions = isGenerated
      ? `<a class="btn btn-primary btn-sm" href="results.html?projectId=${encodeURIComponent(p.id)}">Voir les résultats</a>
         <a class="btn btn-secondary btn-sm" href="wizard.html?projectId=${encodeURIComponent(p.id)}">Modifier et régénérer</a>`
      : `<a class="btn btn-primary btn-sm" href="wizard.html?projectId=${encodeURIComponent(p.id)}">Continuer</a>`;
    return `
      <div class="project-card" data-id="${p.id}">
        <div class="project-card-top">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="project-card-icon">${TYPE_ICONS[p.project_type] || '📁'}</div>
            <div>
              <h3>${escapeHtml(p.nomProjet || 'Projet sans nom')}</h3>
              <div class="p-type">${TYPE_LABELS[p.project_type] || p.project_type}</div>
            </div>
          </div>
          ${statusBadge}
        </div>
        <div class="p-meta">Dernière modification : ${fmtDate(p.updated_at)}</div>
        <div class="p-actions">
          ${actions}
          <button type="button" class="p-delete" data-delete-id="${p.id}" title="Supprimer ce projet">🗑</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => deleteProjectCard(btn.dataset.deleteId, btn.closest('.project-card')));
  });
}

async function deleteProjectCard(id, cardEl) {
  const name = cardEl.querySelector('h3')?.textContent || 'ce projet';
  if (!window.confirm(`Supprimer définitivement « ${name} » ? Cette action est irréversible : le projet et tous ses documents générés seront supprimés.`)) return;
  cardEl.style.opacity = '.5';
  cardEl.style.pointerEvents = 'none';
  try {
    await apiDelete(`/api/projects/${encodeURIComponent(id)}`);
    cardEl.remove();
    const grid = document.getElementById('projectsGrid');
    if (grid.children.length === 0) show(document.getElementById('projectsEmpty'));
  } catch (err) {
    cardEl.style.opacity = '';
    cardEl.style.pointerEvents = '';
    window.alert(err.message || 'Impossible de supprimer ce projet.');
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.getElementById('newProjectBtn').addEventListener('click', () => showOnboarding({ fromList: true }));
document.getElementById('newProjectBtnEmpty').addEventListener('click', () => showOnboarding({ fromList: true }));
document.getElementById('backToProjectsBtn').addEventListener('click', () => loadProjectsAndRoute());
document.getElementById('logoutBtnProjects').addEventListener('click', async () => {
  try { await apiPost('/api/auth/logout', {}); } catch (e) { /* ignore */ }
  window.location.reload();
});

/* ---------------- Auth tabs ---------------- */
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authError = document.getElementById('authError');

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    authTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    authError.style.display = 'none';
    if (tab.dataset.tab === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
  });
});

function showAuthError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.style.display = 'none';
  const submitBtn = document.getElementById('loginSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion…';
  try {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const data = await apiPost('/api/auth/login', { email, password });
    currentUser = data.user;
    hide(authView);
    await loadProjectsAndRoute();
  } catch (err) {
    showAuthError(err.message || 'Impossible de se connecter.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.style.display = 'none';
  const submitBtn = document.getElementById('registerSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Création…';
  try {
    const fullName = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const data = await apiPost('/api/auth/register', { email, password, fullName });
    currentUser = data.user;
    hide(authView);
    // Un nouveau compte n'a jamais de projet existant : on va direct à l'onboarding.
    showOnboarding({ fromList: false });
  } catch (err) {
    showAuthError(err.message || 'Impossible de créer le compte.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Créer mon compte';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await apiPost('/api/auth/logout', {}); } catch (e) { /* ignore */ }
  window.location.reload();
});

/* ---------------- Onboarding choice ---------------- */
const onboardingError = document.getElementById('onboardingError');

async function selectProjectType(type, cardEl) {
  onboardingError.classList.add('hidden');
  document.querySelectorAll('.choice-card').forEach((c) => c.classList.add('loading'));
  const btn = cardEl.querySelector('.btn');
  const originalText = btn.textContent;
  btn.textContent = 'Création du projet…';
  try {
    const data = await apiPost('/api/projects', { projectType: type });
    window.location.href = `wizard.html?projectId=${encodeURIComponent(data.project.id)}`;
  } catch (err) {
    document.querySelectorAll('.choice-card').forEach((c) => c.classList.remove('loading'));
    btn.textContent = originalText;
    onboardingError.textContent = err.message || "Impossible de créer le projet.";
    onboardingError.classList.remove('hidden');
  }
}

document.querySelectorAll('.choice-card').forEach((card) => {
  const type = card.dataset.type;
  card.querySelector('.btn').addEventListener('click', (e) => {
    e.stopPropagation();
    selectProjectType(type, card);
  });
  card.addEventListener('click', () => selectProjectType(type, card));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProjectType(type, card); }
  });
});

init();
