import { apiGet, requireAuth, getQueryParam } from './api.js';

const projectId = getQueryParam('projectId');
const loadingScreen = document.getElementById('loadingScreen');
const errorScreen = document.getElementById('errorScreen');
const resultsApp = document.getElementById('resultsApp');

function showError(message) {
  loadingScreen.classList.add('hidden');
  resultsApp.classList.add('hidden');
  errorScreen.classList.remove('hidden');
  document.getElementById('errorMsg').textContent = message || 'Une erreur est survenue.';
}
function showApp() {
  loadingScreen.classList.add('hidden');
  errorScreen.classList.add('hidden');
  resultsApp.classList.remove('hidden');
}

const LANGUE_LABELS = { fr: 'Français', en: 'Anglais', darija: 'الدارجة' };
const STATUT_LABELS = { eligible: 'Éligible', non_eligible: 'Non éligible', zone_grise: 'Potentiellement éligible' };
const STATUT_BADGE_CLASS = { eligible: 'ok', non_eligible: 'no', zone_grise: 'warn' };

// Les lignes renvoyées par /documents proviennent directement de la table SQL
// (colonnes snake_case : doc_type, programme_id) — on normalise ici pour ne pas
// dépendre d'un nommage précis.
function normalizeDoc(d) {
  return {
    id: d.id,
    space: d.space,
    docType: d.docType || d.doc_type,
    programmeId: d.programmeId !== undefined ? d.programmeId : d.programme_id,
    label: d.label,
    langue: d.langue,
  };
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function docRow(doc) {
  const downloadUrl = `/api/projects/${projectId}/documents/${doc.id}/download`;
  return `
    <div class="doc-row">
      <div>
        <div class="doc-label">${escapeHtml(doc.label)}</div>
        <div class="doc-lang">Langue : ${LANGUE_LABELS[doc.langue] || doc.langue || 'fr'}</div>
      </div>
      <a class="btn btn-secondary btn-sm" href="${downloadUrl}">⬇️ Télécharger</a>
    </div>
  `;
}

function renderEntrepreneurCard(docs) {
  return `
    <div class="space-card entrepreneur">
      <div class="space-head">
        <span class="sh-icon">🧑‍💼</span>
        <h3>Espace Entrepreneur</h3>
        <p>Votre business plan complet, dans la langue que vous avez choisie.</p>
      </div>
      <div class="space-body">
        ${docs.length === 0 ? '<p class="empty-note">Aucun document disponible.</p>' : docs.map(docRow).join('')}
      </div>
    </div>
  `;
}

function renderBanqueCard(docs) {
  return `
    <div class="space-card banque">
      <div class="space-head">
        <span class="sh-icon">🏦</span>
        <h3>Espace Institution Financière</h3>
        <p>Dossier bancaire complet — toujours généré en français.</p>
      </div>
      <div class="space-body">
        ${docs.length === 0 ? '<p class="empty-note">Aucun document disponible.</p>' : docs.map(docRow).join('')}
      </div>
    </div>
  `;
}

function renderAideCard(docs, programmes) {
  const groups = (programmes || []).map((prog) => {
    const progDocs = docs.filter((d) => String(d.programmeId) === String(prog.id));
    const badgeClass = STATUT_BADGE_CLASS[prog.statut] || 'warn';
    const badgeLabel = STATUT_LABELS[prog.statut] || prog.statut;
    return `
      <div class="programme-block">
        <div class="pb-head">
          <span class="pb-name">${escapeHtml(prog.nom)}</span>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="pb-resume">${escapeHtml(prog.resume)}</div>
        <div class="pb-docs">
          ${progDocs.length === 0 ? '<p class="empty-note">Aucun document disponible.</p>' : progDocs.map(docRow).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="space-card aide">
      <div class="space-head">
        <span class="sh-icon">🤝</span>
        <h3>Aide aux entrepreneurs</h3>
        <p>Éligibilité et dossiers pour les programmes d'aide (INTELAKA, FORSA…) — toujours en français.</p>
      </div>
      <div class="space-body">
        ${groups || '<p class="empty-note">Aucun programme évalué.</p>'}
      </div>
    </div>
  `;
}

async function init() {
  if (!projectId) { showError('Aucun projet sélectionné.'); return; }
  const user = await requireAuth();
  if (!user) return;
  try {
    const [{ documents }, { bp }] = await Promise.all([
      apiGet(`/api/projects/${projectId}/documents`),
      apiGet(`/api/projects/${projectId}/review`),
    ]);

    const docs = (documents || []).map(normalizeDoc);
    const entrepreneurDocs = docs.filter((d) => d.space === 'entrepreneur');
    const banqueDocs = docs.filter((d) => d.space === 'banque');
    const aideDocs = docs.filter((d) => d.space === 'aide');

    const grid = document.getElementById('spacesGrid');
    grid.innerHTML =
      renderEntrepreneurCard(entrepreneurDocs) +
      renderBanqueCard(banqueDocs) +
      renderAideCard(aideDocs, bp.eligibilites?.programmes || []);

    showApp();
  } catch (err) {
    showError(err.message || 'Impossible de charger vos documents.');
  }
}

init();
