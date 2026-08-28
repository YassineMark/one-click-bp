import { apiGet, apiPatch, apiUpload, requireAuth, getQueryParam, fmtNum } from './api.js';

const projectId = getQueryParam('projectId');
// Arrivée via un lien "Corriger" ou "Modifier" depuis le récapitulatif : après
// enregistrement, on ramène l'utilisateur au récapitulatif plutôt que de
// poursuivre le parcours normal du formulaire, pour qu'il puisse voir les
// autres sections à corriger et répéter jusqu'à ce que tout soit bon.
const cameFromReview = Boolean(getQueryParam('step'));

let project = null;
let steps = [];
let currentIndex = 0;
let maxReached = 0;
let currentFieldEntries = [];

const loadingScreen = document.getElementById('loadingScreen');
const errorScreen = document.getElementById('errorScreen');
const wizardApp = document.getElementById('wizardApp');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const autosaveNote = document.getElementById('autosaveNote');

function showError(message) {
  loadingScreen.classList.add('hidden');
  wizardApp.classList.add('hidden');
  errorScreen.classList.remove('hidden');
  document.getElementById('errorMsg').textContent = message || 'Une erreur est survenue.';
}

function showApp() {
  loadingScreen.classList.add('hidden');
  errorScreen.classList.add('hidden');
  wizardApp.classList.remove('hidden');
}

/* ---------------- Path helpers ---------------- */
function getPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}
function normalizeOptions(options) {
  return (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}
function fieldValue(field, root) {
  let v = getPath(root, field.path);
  if (v === undefined || v === null) {
    if (field.default !== undefined) v = field.default;
    else if (field.type === 'number') v = '';
    else if (field.type === 'boolean') v = false;
    else if (field.type === 'list') v = [];
    else v = '';
    // Un défaut affiché à l'écran doit exister dans l'état dès le rendu,
    // sinon la validation "requis" échoue tant que l'utilisateur n'a pas
    // lui-même touché un champ déjà pré-rempli visuellement.
    if (field.type !== 'list') setPath(root, field.path, v);
  }
  return v;
}

/* ---------------- Field rendering ---------------- */
function renderFieldWrapper(field, root, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.dataset.path = field.path;
  if (field.type === 'textarea') wrap.classList.add('full');

  let input;
  const value = fieldValue(field, root);

  if (field.type !== 'radio' && field.type !== 'boolean') {
    const label = document.createElement('label');
    label.innerHTML = `${field.label}${field.required ? ' <span class="req">*</span>' : ''}`;
    wrap.appendChild(label);
  }

  switch (field.type) {
    case 'textarea':
      input = document.createElement('textarea');
      input.value = value;
      break;
    case 'select': {
      input = document.createElement('select');
      const optEmpty = document.createElement('option');
      optEmpty.value = '';
      optEmpty.textContent = '— Sélectionner —';
      input.appendChild(optEmpty);
      normalizeOptions(field.options).forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (String(value) === String(o.value)) opt.selected = true;
        input.appendChild(opt);
      });
      break;
    }
    case 'number':
      input = document.createElement('input');
      input.type = 'number';
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      input.step = field.step !== undefined ? field.step : 'any';
      input.value = value;
      break;
    case 'boolean': {
      wrap.classList.add('full');
      const row = document.createElement('div');
      row.className = 'toggle-row';
      const sw = document.createElement('label');
      sw.className = 'toggle-switch';
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(value);
      const slider = document.createElement('span');
      slider.className = 'toggle-slider';
      sw.appendChild(input);
      sw.appendChild(slider);
      row.appendChild(sw);
      const lbl = document.createElement('span');
      lbl.className = 'rl-label';
      lbl.style.cssText = 'font-weight:600;color:var(--navy);font-size:14px;';
      lbl.textContent = field.label + (field.required ? ' *' : '');
      row.appendChild(lbl);
      wrap.appendChild(row);
      break;
    }
    case 'radio': {
      wrap.classList.add('full');
      const group = document.createElement('div');
      group.className = 'radio-group';
      normalizeOptions(field.options).forEach((o) => {
        const optLabel = document.createElement('label');
        optLabel.className = 'radio-option' + (String(value) === String(o.value) ? ' checked' : '');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = field.path;
        radio.value = o.value;
        radio.checked = String(value) === String(o.value);
        radio.addEventListener('change', () => {
          group.querySelectorAll('.radio-option').forEach((el) => el.classList.remove('checked'));
          optLabel.classList.add('checked');
          onChange(o.value);
        });
        const span = document.createElement('span');
        span.className = 'rl-label';
        span.textContent = o.label;
        optLabel.appendChild(radio);
        optLabel.appendChild(span);
        group.appendChild(optLabel);
      });
      wrap.appendChild(group);
      break;
    }
    default:
      input = document.createElement('input');
      input.type = 'text';
      input.value = value ?? '';
  }

  if (input && field.type !== 'radio') {
    if (field.placeholder) input.placeholder = field.placeholder;
    const evtName = field.type === 'select' || field.type === 'boolean' ? 'change' : 'input';
    input.addEventListener(evtName, () => {
      let v;
      if (field.type === 'number') v = input.value === '' ? '' : Number(input.value);
      else if (field.type === 'boolean') v = input.checked;
      else v = input.value;
      onChange(v);
    });
    // Le champ boolean a déjà placé son <input> à l'intérieur du toggle
    // (.toggle-switch) plus haut : il ne faut pas le déplacer dans wrap.
    if (field.type !== 'boolean') wrap.appendChild(input);
  }

  if (field.help) {
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = field.help;
    wrap.appendChild(hint);
  } else if (field.unit && field.type === 'number') {
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = `Unité : ${field.unit}`;
    wrap.appendChild(hint);
  }

  const errorMsg = document.createElement('div');
  errorMsg.className = 'error-msg';
  wrap.appendChild(errorMsg);

  return { wrap, input, field };
}

function renderListField(field, root) {
  const wrap = document.createElement('div');
  wrap.className = 'field full';
  wrap.dataset.path = field.path;

  const label = document.createElement('label');
  label.innerHTML = `${field.label}${field.minItems ? ' <span class="req">*</span>' : ''}`;
  wrap.appendChild(label);

  const listContainer = document.createElement('div');
  listContainer.className = 'list-group';
  wrap.appendChild(listContainer);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-item-btn';
  addBtn.textContent = `+ Ajouter ${field.itemLabel ? 'un(e) ' + field.itemLabel.toLowerCase() : 'un élément'}`;
  wrap.appendChild(addBtn);

  function getItems() {
    let arr = getPath(root, field.path);
    if (!Array.isArray(arr)) {
      arr = [];
      setPath(root, field.path, arr);
    }
    return arr;
  }

  function renderItems() {
    const items = getItems();
    listContainer.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-note';
      empty.textContent = 'Aucun élément ajouté pour l\'instant.';
      listContainer.appendChild(empty);
    }
    items.forEach((item, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'list-item';
      const head = document.createElement('div');
      head.className = 'list-item-head';
      const title = document.createElement('div');
      title.className = 'list-item-title';
      title.textContent = `${field.itemLabel || 'Élément'} ${idx + 1}`;
      head.appendChild(title);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Supprimer cet élément';
      removeBtn.addEventListener('click', () => {
        items.splice(idx, 1);
        renderItems();
      });
      head.appendChild(removeBtn);
      itemEl.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'item-fields-grid';
      (field.itemFields || []).forEach((itemField) => {
        const { wrap: fwrap } = renderFieldWrapper(itemField, item, (v) => {
          setPath(item, itemField.path, v);
        });
        if (itemField.type === 'textarea') fwrap.classList.add('full');
        grid.appendChild(fwrap);
      });
      itemEl.appendChild(grid);
      listContainer.appendChild(itemEl);
    });
  }

  addBtn.addEventListener('click', () => {
    const items = getItems();
    const newItem = {};
    (field.itemFields || []).forEach((itemField) => {
      if (itemField.default !== undefined) newItem[itemField.path] = itemField.default;
    });
    items.push(newItem);
    renderItems();
  });

  renderItems();

  const errorMsg = document.createElement('div');
  errorMsg.className = 'error-msg';
  wrap.appendChild(errorMsg);

  return { wrap, input: null, field };
}

/* ---------------- Validation ---------------- */
function showFieldError(wrap, message) {
  wrap.classList.add('has-error');
  const em = wrap.querySelector('.error-msg');
  if (em) em.textContent = message;
  const input = wrap.querySelector('input, select, textarea');
  if (input) input.classList.add('invalid');
}
function clearFieldError(wrap) {
  wrap.classList.remove('has-error');
  const em = wrap.querySelector('.error-msg');
  if (em) em.textContent = '';
  const input = wrap.querySelector('input, select, textarea');
  if (input) input.classList.remove('invalid');
}

function validateCurrentStep() {
  let valid = true;
  currentFieldEntries.forEach(({ field, wrap }) => {
    if (wrap.style.display === 'none') { clearFieldError(wrap); return; }

    if (field.type === 'list') {
      const items = getPath(project.form_data, field.path) || [];
      if (field.minItems && items.length < field.minItems) {
        showFieldError(wrap, `Ajoutez au moins ${field.minItems} élément(s).`);
        valid = false;
        return;
      }
      let itemsValid = true;
      items.forEach((item) => {
        (field.itemFields || []).forEach((itf) => {
          if (itf.required) {
            const v = getPath(item, itf.path);
            if (v === undefined || v === null || v === '') itemsValid = false;
          }
        });
      });
      if (!itemsValid) {
        showFieldError(wrap, 'Merci de compléter les champs obligatoires de chaque élément (marqués en gras).');
        valid = false;
      } else clearFieldError(wrap);
      return;
    }

    const value = getPath(project.form_data, field.path);
    if (field.required && field.type !== 'boolean') {
      if (value === undefined || value === null || value === '') {
        showFieldError(wrap, 'Ce champ est requis.');
        valid = false;
        return;
      }
    }
    if (field.type === 'number' && value !== undefined && value !== null && value !== '') {
      const num = Number(value);
      if (field.min !== undefined && num < field.min) {
        showFieldError(wrap, `La valeur doit être supérieure ou égale à ${field.min}.`);
        valid = false;
        return;
      }
      if (field.max !== undefined && num > field.max) {
        showFieldError(wrap, `La valeur doit être inférieure ou égale à ${field.max}.`);
        valid = false;
        return;
      }
    }
    clearFieldError(wrap);
  });
  if (!valid) {
    const firstError = document.querySelector('.field.has-error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

/* ---------------- Upload block (situationFinanciereActuelle) ---------------- */
function renderUploadBlock(container, step) {
  const upload = step.upload;
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginTop = '10px';
  card.innerHTML = `
    <h3 style="font-size:16px;margin-bottom:8px;">📂 ${upload.label}</h3>
    <p class="field-note" style="margin-bottom:14px;">${upload.help}</p>
  `;
  const dz = document.createElement('div');
  dz.className = 'dropzone';
  dz.innerHTML = `
    <div class="dz-icon">📄</div>
    <div class="dz-text">Cliquez ou glissez-déposez votre fichier ici</div>
    <div class="dz-formats">Formats acceptés : ${upload.acceptedFormats.join(', ').toUpperCase()} — max ${upload.maxSizeMB} Mo</div>
    <div class="dz-file"></div>
  `;
  const input = document.createElement('input');
  input.type = 'file';
  input.style.display = 'none';
  input.accept = upload.acceptedFormats.map((f) => '.' + f).join(',');
  dz.appendChild(input);
  card.appendChild(dz);

  const resultEl = document.createElement('div');
  resultEl.className = 'balance-result';
  card.appendChild(resultEl);
  container.appendChild(card);

  const dzFile = dz.querySelector('.dz-file');

  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('drag');
    if (e.dataTransfer.files.length) handleBalanceFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files.length) handleBalanceFile(e.target.files[0]);
  });

  async function handleBalanceFile(file) {
    dzFile.textContent = `📎 ${file.name}`;
    resultEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13.5px;margin-top:12px;"><div class="spinner sm"></div> Analyse du fichier en cours…</div>`;
    const fd = new FormData();
    fd.append('balance', file);
    try {
      const data = await apiUpload(`/api/projects/${projectId}/balance-upload`, fd);
      const a = data.analysis;
      resultEl.innerHTML = `
        <div class="alert success" style="margin-top:12px;">Fichier analysé avec succès${data.detection ? ` (${data.detection})` : ''}.</div>
        <div class="balance-kpis">
          <div class="balance-kpi"><div class="bk-label">Chiffre d'affaires</div><div class="bk-value">${fmtNum(a.chiffreAffaires)} DH</div></div>
          <div class="balance-kpi"><div class="bk-label">Charges</div><div class="bk-value">${fmtNum(a.charges)} DH</div></div>
          <div class="balance-kpi"><div class="bk-label">Résultat estimé</div><div class="bk-value">${fmtNum(a.resultatEstime)} DH</div></div>
          <div class="balance-kpi"><div class="bk-label">Trésorerie</div><div class="bk-value">${fmtNum(a.tresorerie)} DH</div></div>
          <div class="balance-kpi"><div class="bk-label">Dettes</div><div class="bk-value">${fmtNum(a.dettes)} DH</div></div>
          <div class="balance-kpi"><div class="bk-label">Créances</div><div class="bk-value">${fmtNum(a.creances)} DH</div></div>
        </div>
        ${a.anomalies && a.anomalies.length ? `<div class="alert warn" style="margin-top:12px;"><strong>Points d'attention :</strong><ul>${a.anomalies.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      `;
      project.form_data.situationFinanciereActuelle = project.form_data.situationFinanciereActuelle || {};
      project.form_data.situationFinanciereActuelle.balanceUploadId = data.uploadId;
    } catch (err) {
      resultEl.innerHTML = `<div class="alert error" style="margin-top:12px;">${err.message}</div><div class="field-note">Vous pouvez continuer sans importer de fichier : ce n'est pas obligatoire.</div>`;
    }
  }
}

/* ---------------- Step rendering ---------------- */
function renderStep(index) {
  currentIndex = index;
  const step = steps[index];
  const container = document.getElementById('stepContent');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'step-header';
  header.innerHTML = `<span class="step-icon">${step.icon || ''}</span><h1>${step.title}</h1>`;
  container.appendChild(header);

  if (step.description) {
    const desc = document.createElement('div');
    desc.className = 'lang-help-box';
    desc.textContent = step.description;
    container.appendChild(desc);
  }

  if (step.id === 'langue') {
    const note = document.createElement('div');
    note.className = 'lang-help-box';
    note.innerHTML = '🌐 <strong>Important :</strong> ce choix de langue concerne uniquement le document destiné à l\'entrepreneur. Les documents pour les banques et les institutions d\'aide sont toujours générés en français, quel que soit votre choix ici.';
    container.appendChild(note);
  }

  let totalBox = null;
  let totalValueEl = null;
  if (step.computedTotal) {
    totalBox = document.createElement('div');
    totalBox.className = 'computed-total';
    totalBox.innerHTML = `<span class="ct-label">Total de cette étape</span><span class="ct-value">0 DH</span>`;
    container.appendChild(totalBox);
    totalValueEl = totalBox.querySelector('.ct-value');
  }

  const grid = document.createElement('div');
  grid.className = 'fields-grid';
  container.appendChild(grid);

  const fieldEntries = [];

  function applyShowIf() {
    fieldEntries.forEach(({ field, wrap }) => {
      if (field.showIf) {
        const cond = Boolean(getPath(project.form_data, field.showIf));
        wrap.style.display = cond ? '' : 'none';
      }
    });
  }

  function recomputeTotal() {
    if (!step.computedTotal || !totalValueEl) return;
    let sum = 0;
    step.fields.forEach((f) => {
      // Les montants en DH n'ont jamais de "max" dans ce schéma (contrairement
      // aux durées/taux, ex. dureeCredit, tauxInteret) : on exclut ces derniers
      // du total pour ne sommer que des montants monétaires homogènes.
      if (f.type === 'number' && f.max === undefined) sum += Number(getPath(project.form_data, f.path)) || 0;
    });
    totalValueEl.textContent = `${fmtNum(sum)} DH`;
  }

  step.fields.forEach((field) => {
    let entry;
    if (field.type === 'list') {
      entry = renderListField(field, project.form_data);
    } else {
      entry = renderFieldWrapper(field, project.form_data, (v) => {
        setPath(project.form_data, field.path, v);
        applyShowIf();
        recomputeTotal();
      });
    }
    if (field.type === 'textarea' || field.type === 'boolean' || field.type === 'radio' || field.type === 'list') {
      entry.wrap.classList.add('full');
    }
    fieldEntries.push(entry);
    grid.appendChild(entry.wrap);
  });

  applyShowIf();
  recomputeTotal();

  if (step.id === 'situationFinanciereActuelle') {
    renderUploadBlock(container, step);
  }

  currentFieldEntries = fieldEntries;
  updateNavButtons();
  updateSidebarActive();
  updateMobileProgress();
}

/* ---------------- Sidebar / progress ---------------- */
function renderSidebar() {
  const stepList = document.getElementById('stepList');
  stepList.innerHTML = '';
  steps.forEach((step, idx) => {
    const item = document.createElement('div');
    item.className = 'step-item';
    item.dataset.idx = String(idx);
    item.innerHTML = `<span class="step-num">${idx + 1}</span><span class="step-label">${step.icon || ''} ${step.title}</span>`;
    stepList.appendChild(item);
  });
  updateSidebarActive();
}

function updateSidebarActive() {
  document.querySelectorAll('.step-item').forEach((item) => {
    const idx = Number(item.dataset.idx);
    item.classList.toggle('current', idx === currentIndex);
    item.classList.toggle('done', idx < currentIndex);
    const clickable = idx <= maxReached && idx !== currentIndex;
    item.classList.toggle('clickable', clickable);
    item.classList.toggle('locked', !clickable && idx !== currentIndex);
  });
}

function updateMobileProgress() {
  document.getElementById('mpStepLabel').textContent = steps[currentIndex].title;
  document.getElementById('mpStepCount').textContent = `${currentIndex + 1} / ${steps.length}`;
  document.getElementById('mpFill').style.width = `${Math.round(((currentIndex + 1) / steps.length) * 100)}%`;
}

function updateNavButtons() {
  prevBtn.style.visibility = currentIndex === 0 ? 'hidden' : 'visible';
  if (cameFromReview) {
    nextBtn.textContent = '💾 Mettre à jour et retourner au récapitulatif';
  } else {
    nextBtn.textContent = currentIndex === steps.length - 1 ? 'Voir le récapitulatif →' : 'Suivant →';
  }
}

/* ---------------- Save / navigation ---------------- */
async function saveProgress(targetIndex) {
  autosaveNote.textContent = 'Enregistrement…';
  const stepToSave = Math.max(project.current_step || 0, targetIndex);
  const data = await apiPatch(`/api/projects/${projectId}`, { formData: project.form_data, currentStep: stepToSave });
  project = data.project;
  autosaveNote.textContent = 'Enregistré ✓';
  setTimeout(() => { autosaveNote.textContent = ''; }, 1500);
}

nextBtn.addEventListener('click', async () => {
  if (!validateCurrentStep()) return;
  nextBtn.disabled = true;
  try {
    if (cameFromReview) {
      await saveProgress(currentIndex);
      window.location.href = `review.html?projectId=${projectId}`;
      return;
    }
    const isLast = currentIndex === steps.length - 1;
    await saveProgress(isLast ? currentIndex : currentIndex + 1);
    if (isLast) {
      window.location.href = `review.html?projectId=${projectId}`;
      return;
    }
    currentIndex += 1;
    maxReached = Math.max(maxReached, currentIndex);
    renderStep(currentIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    autosaveNote.textContent = `Erreur : ${err.message}`;
  } finally {
    nextBtn.disabled = false;
  }
});

prevBtn.addEventListener('click', async () => {
  if (currentIndex === 0) return;
  prevBtn.disabled = true;
  try {
    await saveProgress(Math.max(project.current_step || 0, currentIndex));
    currentIndex -= 1;
    renderStep(currentIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    autosaveNote.textContent = `Erreur : ${err.message}`;
  } finally {
    prevBtn.disabled = false;
  }
});

document.getElementById('stepList').addEventListener('click', async (e) => {
  const item = e.target.closest('.step-item');
  if (!item) return;
  const idx = Number(item.dataset.idx);
  if (idx === currentIndex || idx > maxReached) return;
  try {
    await saveProgress(Math.max(project.current_step || 0, currentIndex));
  } catch (err) { /* non-blocking */ }
  currentIndex = idx;
  renderStep(currentIndex);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------------- Init ---------------- */
async function init() {
  if (!projectId) { showError('Aucun projet sélectionné. Retournez à l\'accueil pour en créer un.'); return; }
  const user = await requireAuth();
  if (!user) return;
  try {
    const { project: p } = await apiGet(`/api/projects/${projectId}`);
    project = p;
    project.form_data = project.form_data || {};
    const schema = await apiGet(`/api/wizard/schema?projectType=${project.project_type}`);
    steps = schema.steps;
    currentIndex = Math.min(Math.max(project.current_step || 0, 0), steps.length - 1);
    // Permet d'arriver directement sur une étape précise (ex: lien "corriger" depuis le récapitulatif).
    const requestedStepId = getQueryParam('step');
    if (requestedStepId) {
      const idx = steps.findIndex((s) => s.id === requestedStepId);
      if (idx >= 0) currentIndex = idx;
    }
    maxReached = Math.max(project.current_step || 0, currentIndex);
    renderSidebar();
    renderStep(currentIndex);
    showApp();
  } catch (err) {
    showError(err.message || 'Impossible de charger le projet.');
  }
}

init();
