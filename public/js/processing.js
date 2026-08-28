import { requireAuth, getQueryParam } from './api.js';

const projectId = getQueryParam('projectId');
const checklist = document.getElementById('checklist');
const doneState = document.getElementById('doneState');
const bloqueState = document.getElementById('bloqueState');
const erreurState = document.getElementById('erreurState');

let stepEls = {};

function iconFor(status) {
  if (status === 'termine') return '✓';
  if (status === 'annule') return '✕';
  if (status === 'en_cours') return '<div class="spinner sm" style="border-color:rgba(255,255,255,.4);border-top-color:#fff;"></div>';
  return '';
}

function renderChecklist(steps) {
  checklist.innerHTML = '';
  stepEls = {};
  steps.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'gen-step';
    row.innerHTML = `
      <div class="gs-icon"></div>
      <div>
        <div class="gs-label">${s.label}</div>
        <div class="gs-detail"></div>
      </div>
    `;
    checklist.appendChild(row);
    stepEls[s.id] = row;
  });
}

function updateStep(stepId, status, detail) {
  const row = stepEls[stepId];
  if (!row) return;
  row.className = `gen-step ${status}`;
  row.querySelector('.gs-icon').innerHTML = iconFor(status);
  const detailEl = row.querySelector('.gs-detail');
  if (detail) {
    detailEl.textContent = summarizeDetail(stepId, detail);
  }
}

function summarizeDetail(stepId, detail) {
  try {
    if (detail.nbHypotheses !== undefined) return `${detail.nbHypotheses} hypothèses construites`;
    if (detail.caAnnee1 !== undefined) return `CA Année 1 : ${Number(detail.caAnnee1).toLocaleString('fr-FR')} DH`;
    if (detail.besoinTotal !== undefined) return `Besoin total : ${Number(detail.besoinTotal).toLocaleString('fr-FR')} DH`;
    if (detail.erreurs !== undefined) return `${detail.erreurs} erreur(s), ${detail.avertissements} avertissement(s)`;
    if (detail.programmes) return detail.programmes.map((p) => `${p.nom} (${p.statut})`).join(', ');
    if (detail.nbDocuments !== undefined) return `${detail.nbDocuments} document(s) généré(s)`;
    if (detail.raison) return detail.raison;
  } catch (e) { /* ignore */ }
  return '';
}

function startGeneration() {
  const es = new EventSource(`/api/projects/${projectId}/generate/stream`, { withCredentials: true });

  es.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);
    renderChecklist(data.steps);
  });

  es.addEventListener('step', (e) => {
    const data = JSON.parse(e.data);
    updateStep(data.stepId, data.status, data.detail);
  });

  es.addEventListener('bloque', (e) => {
    const data = JSON.parse(e.data);
    document.getElementById('bloqueMsg').textContent = data.message;
    document.getElementById('bloqueBackBtn').href = `review.html?projectId=${projectId}`;
    bloqueState.classList.remove('hidden');
    es.close();
  });

  es.addEventListener('done', (e) => {
    const data = JSON.parse(e.data);
    doneState.classList.remove('hidden');
    es.close();
    setTimeout(() => {
      window.location.href = `results.html?projectId=${projectId}`;
    }, 1200);
  });

  es.addEventListener('erreur', (e) => {
    let message = 'Une erreur est survenue pendant la génération.';
    try { message = JSON.parse(e.data).message || message; } catch (err) { /* ignore */ }
    document.getElementById('erreurMsg').textContent = message;
    erreurState.classList.remove('hidden');
    es.close();
  });

  es.onerror = () => {
    // La connexion SSE a été coupée de façon inattendue (pas un événement "erreur" métier).
    if (!doneState.classList.contains('hidden') || !bloqueState.classList.contains('hidden') || !erreurState.classList.contains('hidden')) {
      return; // déjà géré par un des événements ci-dessus
    }
    document.getElementById('erreurMsg').textContent = "La connexion avec le serveur a été interrompue pendant la génération.";
    erreurState.classList.remove('hidden');
    es.close();
  };
}

document.getElementById('retryBtn').addEventListener('click', () => {
  window.location.reload();
});

async function init() {
  if (!projectId) { window.location.href = 'index.html'; return; }
  const user = await requireAuth();
  if (!user) return;
  startGeneration();
}

init();
