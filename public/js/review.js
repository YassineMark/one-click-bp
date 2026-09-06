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
const COLOR_EMERALD = '#0F9D58';
const COLOR_EMERALD_FADED = 'rgba(15,157,88,.28)';
const COLOR_NAVY = '#0B2545';
const COLOR_AMBER = '#B7791F';
const COLOR_WARN = '#C0392B';

const TOOLTIP_BASE = {
  backgroundColor: '#0B2545', titleColor: '#fff', bodyColor: '#EAF2FF', padding: 10, cornerRadius: 8,
  titleFont: { family: 'Space Grotesk', size: 12, weight: '700' }, bodyFont: { family: 'Inter', size: 12 },
};
const AXIS_TICK_FONT = { family: 'Inter', size: 11 };
const LEGEND_LABELS = { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16, font: { family: 'Inter', size: 11.5 }, color: '#33415C' };

// Un seul sélecteur d'année pilote les KPI "par année", le graphique SIG, et
// le point/barre mis en évidence sur les autres graphiques (façon "slicer"
// façon BI) — tout reste calculé côté serveur, on ne fait ici qu'indexer les
// tableaux déjà renvoyés par /review pour l'année choisie.
let selectedYear = 0;
let currentBp = null;

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

// ==================== Sélecteur d'année (slicer) ====================

function renderYearTabs(bp) {
  const container = document.getElementById('yearTabs');
  container.innerHTML = bp.cpc.annees.map((label, i) => `
    <button type="button" class="year-tab ${i === selectedYear ? 'active' : ''}" data-year="${i}">${label}</button>
  `).join('');
  container.querySelectorAll('.year-tab').forEach((btn) => {
    btn.addEventListener('click', () => setSelectedYear(Number(btn.dataset.year)));
  });
}

function setSelectedYear(i) {
  if (i === selectedYear || !currentBp) return;
  selectedYear = i;
  document.querySelectorAll('.year-tab').forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.year) === i));
  const label = currentBp.cpc.annees[i];
  document.getElementById('kpiYearLabel').innerHTML = `<span>📅</span> Résultats — ${label}`;
  document.getElementById('sigSub').textContent = `Résultats détaillés — ${label}`;

  renderYearKpis(currentBp, i);
  if (chartCaResultat) {
    chartCaResultat.data.datasets[0].backgroundColor = barColorsForYear();
    chartCaResultat.update();
  }
  if (chartTresorerie) chartTresorerie.update();
  if (chartRatios) chartRatios.update();
  renderSigChart(currentBp, i);
}

function barColorsForYear() {
  return [0, 1, 2].map((i) => (i === selectedYear ? COLOR_EMERALD : COLOR_EMERALD_FADED));
}

// ==================== KPI dashboard ====================

function kpiCardHtml(k) {
  return `
    <div class="kpi ${k.neg ? 'neg' : ''}">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>
  `;
}

function renderStaticKpis(bp) {
  const grid = document.getElementById('kpiGridStatic');
  const kpis = [
    { icon: '🏢', label: 'Investissement total', value: fmtDH(bp.inputs.investissements) },
    { icon: '🎯', label: 'Seuil de rentabilité (CA)', value: bp.seuilRentabilite ? fmtDH(bp.seuilRentabilite.seuilCA) : 'Non atteignable' },
    { icon: '👥', label: "Nombre d'employés", value: fmtNum(bp.inputs.nbEmployes) },
  ];
  grid.innerHTML = kpis.map(kpiCardHtml).join('');
}

function renderYearKpis(bp, yearIndex) {
  const grid = document.getElementById('kpiGridYear');
  const tresorerie = bp.bilan.actif.rows[2][1][yearIndex];
  const margeNette = bp.ratios[0].vals[yearIndex];
  const autonomieFin = bp.ratios[4].vals[yearIndex];
  const ca = bp.cpc.ca[yearIndex];
  const rn = bp.cpc.resultatNet[yearIndex];
  const kpis = [
    { icon: '📈', label: "Chiffre d'affaires (HT)", value: fmtDH(ca) },
    { icon: '💵', label: 'Résultat net', value: fmtDH(rn), neg: rn < 0 },
    { icon: '📊', label: 'Marge nette', value: fmtPct(margeNette), neg: margeNette < 0 },
    { icon: '🛡️', label: 'Autonomie financière', value: fmtPct(autonomieFin) },
    { icon: '🏦', label: 'Trésorerie estimée', value: fmtDH(tresorerie), neg: tresorerie < 0 },
  ];
  grid.innerHTML = kpis.map(kpiCardHtml).join('');
  grid.querySelectorAll('.kpi').forEach((el) => {
    el.classList.add('updating');
    setTimeout(() => el.classList.remove('updating'), 350);
  });
}

// ==================== Charts ====================

let chartCaResultat = null;
let chartFinancement = null;
let chartSig = null;
let chartTresorerie = null;
let chartRatios = null;

function yearClickHandler(chart) {
  return (evt) => {
    const points = chart.getElementsAtEventForMode(evt, 'x', { intersect: false }, true);
    if (points.length) setSelectedYear(points[0].index);
  };
}

function renderChartCaResultat(bp) {
  const ctx = document.getElementById('chartCaResultat').getContext('2d');
  if (chartCaResultat) chartCaResultat.destroy();
  chartCaResultat = new Chart(ctx, {
    data: {
      labels: bp.cpc.annees,
      datasets: [
        {
          type: 'bar', label: "Chiffre d'affaires", data: bp.cpc.ca,
          backgroundColor: barColorsForYear(), borderRadius: 6, maxBarThickness: 46, order: 2,
        },
        {
          type: 'line', label: 'Résultat net', data: bp.cpc.resultatNet,
          borderColor: COLOR_NAVY, backgroundColor: COLOR_NAVY, borderWidth: 2.5,
          pointRadius: (c) => (c.dataIndex === selectedYear ? 7 : 4),
          pointBackgroundColor: COLOR_NAVY, pointBorderColor: '#fff', pointBorderWidth: 2,
          tension: 0.35, fill: false, order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick(evt, _els, chart) { yearClickHandler(chart)(evt); },
      plugins: {
        legend: { position: 'bottom', labels: LEGEND_LABELS },
        tooltip: { ...TOOLTIP_BASE, callbacks: { label: (c) => `${c.dataset.label} : ${fmtDH(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11.5 }, color: '#6B7C93' } },
        y: { grid: { color: '#E3E9F2' }, border: { display: false }, ticks: { callback: (v) => fmtCompactDH(v), font: AXIS_TICK_FONT, color: '#6B7C93' } },
      },
    },
  });
}

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

function renderChartFinancement(bp) {
  const ressources = bp.pf.ressources.slice(0, 3).filter(([, montant]) => montant > 0);
  const ctx = document.getElementById('chartFinancement').getContext('2d');
  if (chartFinancement) chartFinancement.destroy();
  chartFinancement = new Chart(ctx, {
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
        legend: { position: 'bottom', labels: { ...LEGEND_LABELS, boxWidth: 8, padding: 14, font: { family: 'Inter', size: 11 } } },
        tooltip: {
          ...TOOLTIP_BASE,
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

function renderChartTresorerie(bp) {
  const ctx = document.getElementById('chartTresorerie').getContext('2d');
  if (chartTresorerie) chartTresorerie.destroy();
  chartTresorerie = new Chart(ctx, {
    type: 'line',
    data: {
      labels: bp.cpc.annees,
      datasets: [{
        label: 'Trésorerie estimée', data: bp.bilan.actif.rows[2][1],
        borderColor: COLOR_NAVY, backgroundColor: 'rgba(11,37,69,.08)', fill: true, tension: 0.35, borderWidth: 2.5,
        pointRadius: (c) => (c.dataIndex === selectedYear ? 7 : 4),
        pointBackgroundColor: (c) => (c.dataIndex === selectedYear ? COLOR_EMERALD : COLOR_NAVY),
        pointBorderColor: '#fff', pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick(evt, _els, chart) { yearClickHandler(chart)(evt); },
      plugins: {
        legend: { display: false },
        tooltip: { ...TOOLTIP_BASE, callbacks: { label: (c) => `Trésorerie : ${fmtDH(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11.5 }, color: '#6B7C93' } },
        y: { grid: { color: '#E3E9F2' }, border: { display: false }, ticks: { callback: (v) => fmtCompactDH(v), font: AXIS_TICK_FONT, color: '#6B7C93' } },
      },
    },
  });
}

function renderChartRatios(bp) {
  const ctx = document.getElementById('chartRatios').getContext('2d');
  if (chartRatios) chartRatios.destroy();
  chartRatios = new Chart(ctx, {
    type: 'line',
    data: {
      labels: bp.cpc.annees,
      datasets: [
        {
          label: 'Marge nette', data: bp.ratios[0].vals,
          borderColor: COLOR_EMERALD, backgroundColor: COLOR_EMERALD, borderWidth: 2.5, tension: 0.35, fill: false,
          pointRadius: (c) => (c.dataIndex === selectedYear ? 7 : 4), pointBackgroundColor: COLOR_EMERALD, pointBorderColor: '#fff', pointBorderWidth: 2,
        },
        {
          label: 'Autonomie financière', data: bp.ratios[4].vals,
          borderColor: COLOR_AMBER, backgroundColor: COLOR_AMBER, borderWidth: 2.5, tension: 0.35, fill: false,
          pointRadius: (c) => (c.dataIndex === selectedYear ? 7 : 4), pointBackgroundColor: COLOR_AMBER, pointBorderColor: '#fff', pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick(evt, _els, chart) { yearClickHandler(chart)(evt); },
      plugins: {
        legend: { position: 'bottom', labels: LEGEND_LABELS },
        tooltip: { ...TOOLTIP_BASE, callbacks: { label: (c) => `${c.dataset.label} : ${fmtPct(c.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11.5 }, color: '#6B7C93' } },
        y: { grid: { color: '#E3E9F2' }, border: { display: false }, ticks: { callback: (v) => v.toFixed(0) + '%', font: AXIS_TICK_FONT, color: '#6B7C93' } },
      },
    },
  });
}

// Les Soldes Intermédiaires de Gestion (SIG) sont les cascades officielles du
// moteur financier (server/services/financialEngine.js::genererSIG) — on ne
// reprend ici que les lignes "bold" (soldes) déjà calculées, pour l'année
// sélectionnée, sans aucun recalcul côté client.
function renderSigChart(bp, yearIndex) {
  const rows = bp.sig.filter((r) => r.bold);
  const labels = rows.map((r) => r.label.replace(/^=\s*/, ''));
  const data = rows.map((r) => r.vals[yearIndex]);
  const colors = data.map((v) => (v < 0 ? COLOR_WARN : COLOR_EMERALD));

  const ctx = document.getElementById('chartSig').getContext('2d');
  if (chartSig) chartSig.destroy();
  chartSig = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Montant', data, backgroundColor: colors, borderRadius: 6, maxBarThickness: 26 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...TOOLTIP_BASE, callbacks: { label: (c) => fmtDH(c.parsed.x) } },
      },
      scales: {
        x: { grid: { color: '#E3E9F2' }, border: { display: false }, ticks: { callback: (v) => fmtCompactDH(v), font: AXIS_TICK_FONT, color: '#6B7C93' } },
        y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11.5 }, color: '#33415C' } },
      },
    },
  });
}

function renderDashboard(bp) {
  currentBp = bp;
  selectedYear = 0;
  renderYearTabs(bp);
  renderStaticKpis(bp);
  renderYearKpis(bp, selectedYear);
  renderChartCaResultat(bp);
  renderChartFinancement(bp);
  renderSigChart(bp, selectedYear);
  renderChartTresorerie(bp);
  renderChartRatios(bp);
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
