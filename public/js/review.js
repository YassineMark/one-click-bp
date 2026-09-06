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
const CHART_COLORS = ['#0F9D58', '#0B2545', '#B7791F'];

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1) + '%';
}

// Ticks compacts pour les axes de graphiques (ex: "540K DH") — la valeur
// exacte reste affichée dans les tooltips et les cartes KPI via fmtDH.
function fmtCompactDH(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M DH';
  if (abs >= 1000) return Math.round(n / 1000) + 'K DH';
  return Math.round(n) + ' DH';
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ==================== KPI dashboard ====================

function renderDashboardKpis(bp) {
  const grid = document.getElementById('kpiGrid');
  const tresorerieAn1 = bp.bilan.actif.rows[2][1][0];
  const margeNetteAn1 = bp.ratios[0].vals[0];
  const autonomieFinAn1 = bp.ratios[4].vals[0];
  const kpis = [
    { icon: '🏢', label: 'Investissement total', value: fmtDH(bp.inputs.investissements) },
    { icon: '📈', label: 'CA Année 1 (HT)', value: fmtDH(bp.cpc.ca[0]) },
    { icon: '🚀', label: 'CA Année 3 (HT)', value: fmtDH(bp.cpc.ca[2]) },
    { icon: '💵', label: 'Résultat net Année 1', value: fmtDH(bp.cpc.resultatNet[0]), neg: bp.cpc.resultatNet[0] < 0 },
    { icon: '💹', label: 'Résultat net Année 3', value: fmtDH(bp.cpc.resultatNet[2]), neg: bp.cpc.resultatNet[2] < 0 },
    { icon: '🎯', label: 'Seuil de rentabilité (CA)', value: bp.seuilRentabilite ? fmtDH(bp.seuilRentabilite.seuilCA) : 'Non atteignable' },
    { icon: '📊', label: 'Marge nette Année 1', value: fmtPct(margeNetteAn1), neg: margeNetteAn1 < 0 },
    { icon: '🛡️', label: 'Autonomie financière Année 1', value: fmtPct(autonomieFinAn1) },
    { icon: '🏦', label: 'Trésorerie estimée Année 1', value: fmtDH(tresorerieAn1), neg: tresorerieAn1 < 0 },
    { icon: '👥', label: "Nombre d'employés", value: fmtNum(bp.inputs.nbEmployes) },
  ];
  grid.innerHTML = kpis.map((k) => `
    <div class="kpi ${k.neg ? 'neg' : ''}">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>
  `).join('');
}

// ==================== Charts ====================

let chartCaResultat = null;
let chartFinancement = null;

const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const data = chart.config.data.datasets[0].data;
    const total = data.reduce((a, b) => a + b, 0);
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6B7C93';
    ctx.font = "700 10px Inter, sans-serif";
    ctx.fillText('TOTAL', cx, cy - 12);
    ctx.fillStyle = '#0B2545';
    ctx.font = "700 15px 'IBM Plex Mono', monospace";
    ctx.fillText(fmtCompactDH(total), cx, cy + 9);
    ctx.restore();
  },
};

function renderDashboardCharts(bp) {
  const annees = bp.cpc.annees;

  const ctx1 = document.getElementById('chartCaResultat').getContext('2d');
  if (chartCaResultat) chartCaResultat.destroy();
  chartCaResultat = new Chart(ctx1, {
    data: {
      labels: annees,
      datasets: [
        {
          type: 'bar', label: "Chiffre d'affaires", data: bp.cpc.ca,
          backgroundColor: '#0F9D58', borderRadius: 6, maxBarThickness: 46, order: 2,
        },
        {
          type: 'line', label: 'Résultat net', data: bp.cpc.resultatNet,
          borderColor: '#0B2545', backgroundColor: '#0B2545', borderWidth: 2.5,
          pointRadius: 4, pointBackgroundColor: '#0B2545', pointBorderColor: '#fff', pointBorderWidth: 2,
          tension: 0.35, fill: false, order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16, font: { family: 'Inter', size: 11.5 }, color: '#33415C' },
        },
        tooltip: {
          backgroundColor: '#0B2545', titleColor: '#fff', bodyColor: '#EAF2FF', padding: 10, cornerRadius: 8,
          titleFont: { family: 'Space Grotesk', size: 12, weight: '700' }, bodyFont: { family: 'Inter', size: 12 },
          callbacks: { label: (ctx) => `${ctx.dataset.label} : ${fmtDH(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11.5 }, color: '#6B7C93' } },
        y: {
          grid: { color: '#E3E9F2' }, border: { display: false },
          ticks: { callback: (v) => fmtCompactDH(v), font: { family: 'Inter', size: 11 }, color: '#6B7C93' },
        },
      },
    },
  });

  const ressources = bp.pf.ressources.slice(0, 3).filter(([, montant]) => montant > 0);
  const ctx2 = document.getElementById('chartFinancement').getContext('2d');
  if (chartFinancement) chartFinancement.destroy();
  chartFinancement = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ressources.map(([label]) => label),
      datasets: [{
        data: ressources.map(([, montant]) => montant),
        backgroundColor: CHART_COLORS.slice(0, ressources.length),
        borderColor: '#fff', borderWidth: 3, hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14, font: { family: 'Inter', size: 11 }, color: '#33415C' },
        },
        tooltip: {
          backgroundColor: '#0B2545', titleColor: '#fff', bodyColor: '#EAF2FF', padding: 10, cornerRadius: 8,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return `${ctx.label} : ${fmtDH(ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
    plugins: [centerTextPlugin],
  });
}

function renderDashboard(bp) {
  renderDashboardKpis(bp);
  renderDashboardCharts(bp);
}

// ==================== Téléchargement PDF ====================

function setupDashboardDownload() {
  const btn = document.getElementById('downloadDashboardBtn');
  btn.addEventListener('click', async () => {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="dl-spinner"></span> Génération…';
    try {
      const target = document.getElementById('dashboardSection');
      const canvas = await html2canvas(target, { backgroundColor: '#F4F7FB', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('tableau-de-bord-one-click-bp.pdf');
    } catch (e) {
      alert('Impossible de générer le PDF du tableau de bord.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
}

// ==================== Validation ====================

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

// ==================== Sections détaillées ====================

function renderProjetCard(inputs) {
  return `
    <div class="section-card">
      <div class="sc-head"><div class="sc-icon">📁</div><h3>Le projet</h3></div>
      <div class="sc-body">
        <div class="info-grid">
          <div class="info-tile"><div class="it-label">Nom du projet</div><div class="it-value">${escapeHtml(inputs.nomProjet)}</div></div>
          <div class="info-tile"><div class="it-label">Secteur d'activité</div><div class="it-value">${escapeHtml(inputs.secteur)}</div></div>
          <div class="info-tile"><div class="it-label">Ville</div><div class="it-value">${escapeHtml(inputs.ville)}</div></div>
          <div class="info-tile"><div class="it-label">Forme juridique</div><div class="it-value"><span class="badge ok">${escapeHtml(inputs.formeJuridique)}</span></div></div>
        </div>
      </div>
    </div>
  `;
}

function renderProduitsCard(produits) {
  const body = produits.length === 0
    ? '<p class="empty-note">Aucun produit/service détaillé — le CA repose sur votre estimation directe.</p>'
    : `<div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produit / service</th>
              <th class="num">Prix unitaire</th>
              <th class="num">Volume / mois</th>
              <th class="num">CA mensuel estimé</th>
            </tr>
          </thead>
          <tbody>
            ${produits.map((p) => {
              const prix = p.prixVente || 0;
              const volume = p.quantiteEstimeeParMois || 0;
              return `
                <tr>
                  <td class="p-name">${escapeHtml(p.nom || 'Sans nom')}</td>
                  <td class="num">${fmtDH(prix)}</td>
                  <td class="num">${fmtNum(volume)}</td>
                  <td class="num">${fmtDH(prix * volume)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  return `
    <div class="section-card">
      <div class="sc-head"><div class="sc-icon">📦</div><h3>Produits / services</h3></div>
      <div class="sc-body">${body}</div>
    </div>
  `;
}

function renderFinancementCard(bp, inputs) {
  const ecartNeg = bp.pf.ecart < 0;
  const ecartLabel = ecartNeg ? 'Complément à financer' : 'Trésorerie de départ disponible';
  return `
    <div class="section-card">
      <div class="sc-head"><div class="sc-icon">💰</div><h3>Financement</h3></div>
      <div class="sc-body">
        <div class="finance-stats">
          <div class="finance-stat">
            <span class="fs-dot" style="background:#0F9D58;"></span>
            <div><div class="fs-label">Apport personnel</div><div class="fs-value">${fmtDH(inputs.apport)}</div></div>
          </div>
          <div class="finance-stat">
            <span class="fs-dot" style="background:#0B2545;"></span>
            <div><div class="fs-label">Crédit bancaire souhaité</div><div class="fs-value">${fmtDH(inputs.credit)}</div></div>
          </div>
        </div>
        <div class="finance-footer neutral">
          <span class="ff-label">Total besoin (emplois)</span><span class="ff-value">${fmtDH(bp.pf.totalEmplois)}</span>
        </div>
        <div class="finance-footer ${ecartNeg ? 'neg' : ''}">
          <span class="ff-label">${ecartLabel}</span><span class="ff-value">${fmtDH(Math.abs(bp.pf.ecart))}</span>
        </div>
      </div>
    </div>
  `;
}

function renderExploitationCard(bp, inputs) {
  return `
    <div class="section-card">
      <div class="sc-head"><div class="sc-icon">📈</div><h3>Exploitation — Année 1</h3></div>
      <div class="sc-body">
        <div class="stat-tiles">
          <div class="stat-tile"><div class="st-label">Chiffre d'affaires estimé</div><div class="st-value">${fmtDH(bp.cpc.ca[0])}</div></div>
          <div class="stat-tile"><div class="st-label">Charges externes (% CA)</div><div class="st-value">${inputs.chargesExtPct.toFixed(1)}%</div></div>
          <div class="stat-tile"><div class="st-label">Masse salariale annuelle</div><div class="st-value">${fmtDH(inputs.masseSal)}</div></div>
          <div class="stat-tile"><div class="st-label">Nombre d'employés</div><div class="st-value">${fmtNum(inputs.nbEmployes)}</div></div>
        </div>
      </div>
    </div>
  `;
}

function renderLangueCard(bp) {
  const label = LANGUE_LABELS[bp.langueBusinessPlan] || bp.langueBusinessPlan;
  return `
    <div class="section-card">
      <div class="sc-head"><div class="sc-icon">🌐</div><h3>Langue du business plan</h3></div>
      <div class="sc-body">
        <div class="info-tile" style="margin-bottom:14px;">
          <div class="it-label">Document entrepreneur</div>
          <div class="it-value"><span class="badge ok">${escapeHtml(label)}</span></div>
        </div>
        <p class="field-note">Les documents destinés aux banques et aux institutions d'aide sont toujours générés en français, quel que soit ce choix.</p>
      </div>
    </div>
  `;
}

function renderLeftColumn(bp, formData) {
  const left = document.getElementById('leftColumn');
  const inputs = bp.inputs;
  const produits = formData?.produits || [];

  left.innerHTML =
    renderProjetCard(inputs) +
    renderProduitsCard(produits) +
    renderFinancementCard(bp, inputs) +
    renderExploitationCard(bp, inputs) +
    renderLangueCard(bp);
}

// ==================== Init ====================

async function init() {
  if (!projectId) { showError('Aucun projet sélectionné.'); return; }
  const user = await requireAuth();
  if (!user) return;
  try {
    const [{ bp }, { project }] = await Promise.all([
      apiGet(`/api/projects/${projectId}/review`),
      apiGet(`/api/projects/${projectId}`),
    ]);

    renderDashboard(bp);
    renderValidation(bp);
    renderLeftColumn(bp, project.form_data);
    setupDashboardDownload();

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
