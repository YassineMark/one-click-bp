import { apiGet, requireAuth, getQueryParam, fmtDH, fmtNum } from './api.js';

const projectId = getQueryParam('projectId');
const loadingScreen = document.getElementById('loadingScreen');
const errorScreen = document.getElementById('errorScreen');
const reviewApp = document.getElementById('reviewApp');

function showError(message) {
  loadingScreen.classList.add('hidden');
  reviewApp.classList.add('hidden');
  errorScreen.classList.remove('hidden');
  document.getElementById('errorMsg').textContent = message || 'Une erreur est survenue.';
}
function showApp() {
  loadingScreen.classList.add('hidden');
  errorScreen.classList.add('hidden');
  reviewApp.classList.remove('hidden');
}

const LANGUE_LABELS = { fr: 'Français', en: 'Anglais', darija: 'الدارجة' };

function renderKpis(bp) {
  const grid = document.getElementById('kpiGrid');
  const kpis = [
    { label: 'Investissement total', value: fmtDH(bp.inputs.investissements) },
    { label: "CA Année 1 (HT)", value: fmtDH(bp.cpc.ca[0]) },
    { label: 'Résultat net Année 1', value: fmtDH(bp.cpc.resultatNet[0]), neg: bp.cpc.resultatNet[0] < 0 },
    { label: "Nombre d'employés", value: fmtNum(bp.inputs.nbEmployes) },
  ];
  grid.innerHTML = kpis.map((k) => `
    <div class="kpi ${k.neg ? 'neg' : ''}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>
  `).join('');
}

function stepLinks(item) {
  if (!item.etapes || item.etapes.length === 0) return '';
  return item.etapes.map((e) => `<a class="step-fix-link" href="wizard.html?projectId=${projectId}&step=${encodeURIComponent(e.id)}">${e.icone || ''} Corriger « ${escapeHtml(e.titre)} »</a>`).join(' ');
}

function renderValidation(bp) {
  const area = document.getElementById('validationArea');
  const { erreurs, avertissements, bloquant } = bp.validation;
  let html = '';
  if (erreurs.length) {
    html += `<div class="alert error"><span class="alert-icon">⛔</span><div><strong>Erreurs bloquantes — la génération est désactivée tant qu'elles ne sont pas corrigées :</strong>
      <ul>${erreurs.map((e) => `<li>${e.message} ${stepLinks(e)}</li>`).join('')}</ul></div></div>`;
  }
  if (avertissements.length) {
    html += `<div class="alert warn"><span class="alert-icon">⚠️</span><div><strong>Points de vigilance (non bloquants) :</strong>
      <ul>${avertissements.map((a) => `<li>${a.message} ${stepLinks(a)}</li>`).join('')}</ul></div></div>`;
  }
  if (!erreurs.length && !avertissements.length) {
    html += `<div class="alert success"><span class="alert-icon">✅</span><div>Aucune anomalie détectée : votre dossier est prêt à être généré.</div></div>`;
  }
  area.innerHTML = html;

  const generateBtn = document.getElementById('generateBtn');
  const blockingNote = document.getElementById('blockingNote');
  if (bloquant) {
    generateBtn.disabled = true;
    blockingNote.classList.remove('hidden');
    blockingNote.textContent = 'La génération est désactivée : corrigez les erreurs bloquantes listées ci-dessus (bouton "Modifier") avant de continuer.';
  } else {
    generateBtn.disabled = false;
    blockingNote.classList.add('hidden');
  }
}

function renderLeftColumn(bp, formData) {
  const left = document.getElementById('leftColumn');
  const inputs = bp.inputs;

  const projetCard = `
    <div class="card">
      <h3 style="font-size:16px;margin-bottom:14px;">📁 Le projet</h3>
      <div class="summary-row"><span class="sr-label">Nom du projet</span><span class="sr-value">${escapeHtml(inputs.nomProjet)}</span></div>
      <div class="summary-row"><span class="sr-label">Secteur d'activité</span><span class="sr-value">${escapeHtml(inputs.secteur)}</span></div>
      <div class="summary-row"><span class="sr-label">Ville</span><span class="sr-value">${escapeHtml(inputs.ville)}</span></div>
      <div class="summary-row"><span class="sr-label">Forme juridique</span><span class="sr-value">${escapeHtml(inputs.formeJuridique)}</span></div>
    </div>
  `;

  const produits = formData?.produits || [];
  const produitsCard = `
    <div class="card">
      <h3 style="font-size:16px;margin-bottom:14px;">📦 Produits / services</h3>
      ${produits.length === 0
        ? '<p class="empty-note">Aucun produit/service détaillé — le CA repose sur votre estimation directe.</p>'
        : `<div class="products-list">${produits.map((p) => `
            <div class="product-row">
              <div>
                <div class="p-name">${escapeHtml(p.nom || 'Sans nom')}</div>
                <div class="p-meta">${fmtNum(p.quantiteEstimeeParMois || 0)} / mois · ${fmtNum(p.frequenceVenteParAn || 12)} mois/an</div>
              </div>
              <div class="sr-value">${fmtDH(p.prixVente || 0)}</div>
            </div>
          `).join('')}</div>`}
    </div>
  `;

  const ecartLabel = bp.pf.ecart >= 0 ? 'Trésorerie de départ disponible' : 'Complément à financer';
  const financementCard = `
    <div class="card">
      <h3 style="font-size:16px;margin-bottom:14px;">💰 Financement</h3>
      <div class="summary-row"><span class="sr-label">Apport personnel</span><span class="sr-value">${fmtDH(inputs.apport)}</span></div>
      <div class="summary-row"><span class="sr-label">Crédit bancaire souhaité</span><span class="sr-value">${fmtDH(inputs.credit)}</span></div>
      <div class="summary-row"><span class="sr-label">Total besoin (emplois)</span><span class="sr-value">${fmtDH(bp.pf.totalEmplois)}</span></div>
      <div class="summary-row"><span class="sr-label">${ecartLabel}</span><span class="sr-value" style="${bp.pf.ecart < 0 ? 'color:var(--warn);' : ''}">${fmtDH(Math.abs(bp.pf.ecart))}</span></div>
    </div>
  `;

  const exploitationCard = `
    <div class="card">
      <h3 style="font-size:16px;margin-bottom:14px;">📈 Exploitation — Année 1</h3>
      <div class="summary-row"><span class="sr-label">Chiffre d'affaires estimé</span><span class="sr-value">${fmtDH(bp.cpc.ca[0])}</span></div>
      <div class="summary-row"><span class="sr-label">Charges externes (% CA)</span><span class="sr-value">${inputs.chargesExtPct.toFixed(1)}%</span></div>
      <div class="summary-row"><span class="sr-label">Masse salariale annuelle</span><span class="sr-value">${fmtDH(inputs.masseSal)}</span></div>
      <div class="summary-row"><span class="sr-label">Nombre d'employés</span><span class="sr-value">${fmtNum(inputs.nbEmployes)}</span></div>
    </div>
  `;

  const langueCard = `
    <div class="card">
      <h3 style="font-size:16px;margin-bottom:10px;">🌐 Langue du business plan</h3>
      <div class="summary-row"><span class="sr-label">Document entrepreneur</span><span class="sr-value">${LANGUE_LABELS[bp.langueBusinessPlan] || bp.langueBusinessPlan}</span></div>
      <p class="field-note" style="margin-top:10px;">Les documents destinés aux banques et aux institutions d'aide sont toujours générés en français, quel que soit ce choix.</p>
    </div>
  `;

  left.innerHTML = projetCard + produitsCard + financementCard + exploitationCard + langueCard;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function init() {
  if (!projectId) { showError('Aucun projet sélectionné.'); return; }
  const user = await requireAuth();
  if (!user) return;
  try {
    const [{ bp }, { project }] = await Promise.all([
      apiGet(`/api/projects/${projectId}/review`),
      apiGet(`/api/projects/${projectId}`),
    ]);

    renderKpis(bp);
    renderValidation(bp);
    renderLeftColumn(bp, project.form_data);

    document.getElementById('editBtn').addEventListener('click', () => {
      const premiereEtape = bp.validation.erreurs.find((e) => e.etapes?.length)?.etapes[0];
      const target = premiereEtape ? `wizard.html?projectId=${projectId}&step=${encodeURIComponent(premiereEtape.id)}` : `wizard.html?projectId=${projectId}`;
      window.location.href = target;
    });
    document.getElementById('generateBtn').addEventListener('click', () => {
      if (bp.validation.bloquant) return;
      window.location.href = `processing.html?projectId=${projectId}`;
    });

    showApp();
  } catch (err) {
    showError(err.message || 'Impossible de charger le récapitulatif.');
  }
}

init();
