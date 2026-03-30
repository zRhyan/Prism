// src/scripts/ui.js
import {
  getParameters, addParameter, removeParameter,
  getEntries, saveEntry, deleteEntry, resetStorage,
  getGoals, setGoal, removeGoal,
  resolveParamName, localDateStr,
  getSnapshots,
} from './storage.js';
import { renderChart } from './chart.js';

const getTodayDate = () => localDateStr(new Date());

const getWeekStart = () => {
  const today = new Date();
  const day   = today.getDay();
  const diff  = day === 0 ? -6 : 1 - day;
  return localDateStr(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff)
  );
};

const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className')       node.className = v;
    else if (k === 'style')      Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else                         node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(
      typeof child === 'string' ? document.createTextNode(child) : child
    );
  }
  return node;
};

export function setupUI() {
  // --- DOM refs ---
  const paramsList        = document.getElementById('paramsList');
  const addParamForm      = document.getElementById('addParamForm');
  const paramNameInput    = document.getElementById('paramName');
  const entryParam        = document.getElementById('entryParam');
  const chartParam        = document.getElementById('chartParam');
  const entriesList       = document.getElementById('entriesList');
  const entryForm         = document.getElementById('entryForm');
  const currentDateSpan   = document.getElementById('currentDate');
  const ratingInput       = document.getElementById('rating');
  const ratingValue       = document.getElementById('ratingValue');
  const commentInput      = document.getElementById('comment');
  const goalsList         = document.getElementById('goalsList');
  const goalForm          = document.getElementById('goalForm');
  const goalParamSelect   = document.getElementById('goalParam');
  const goalTargetInput   = document.getElementById('goalTarget');
  const goalTargetValue   = document.getElementById('goalTargetValue');
  const goalSessionsInput = document.getElementById('goalSessions');
  const goalSessionsValue = document.getElementById('goalSessionsValue');
  const weeklyHistoryDiv  = document.getElementById('weeklyHistory');

  currentDateSpan.textContent = new Date().toLocaleDateString();

  window.addEventListener('prism:quotaExceeded', () => {
    alert('[Prism] Storage limit reached. Export your data and clear old entries.');
  });

  // --- Parameters ---
  function renderParams() {
    paramsList.innerHTML = '';
    entryParam.innerHTML = '';
    chartParam.innerHTML = '';
    if (goalParamSelect) goalParamSelect.innerHTML = '';

    for (const p of getParameters()) {
      const li  = el('li');
      const del = el('button', { className: 'btn-del' }, '✕');
      del.onclick = () => {
        if (confirm(`Remove parameter "${p.name}"?`)) {
          removeParameter(p.id);
          renderParams();
          renderEntries();
          renderGoals();
          renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
        }
      };
      li.appendChild(document.createTextNode(p.name));
      li.appendChild(del);
      paramsList.appendChild(li);

      for (const sel of [entryParam, chartParam, goalParamSelect].filter(Boolean)) {
        sel.appendChild(el('option', { value: p.id }, p.name));
      }
    }
  }

  // --- Entries ---
  function renderEntries(date = getTodayDate()) {
    entriesList.innerHTML = '';
    const entries = getEntries().filter(e => e.date === date);

    if (entries.length === 0) {
      entriesList.innerHTML = '<li class="muted">No entries for today</li>';
      return;
    }

    entries.sort((a, b) => a.parameterName.localeCompare(b.parameterName));

    for (const e of entries) {
      const displayName = resolveParamName(e.parameterId, e.parameterName);
      const nameStrong  = el('strong', {}, displayName);
      const periodEm    = el('em', { style: { color: 'var(--muted)' } }, `(${e.period})`);
      const commentDiv  = el('div', { className: 'comment' }, e.comment || '');
      const infoDiv     = el('div', {});
      infoDiv.appendChild(nameStrong);
      infoDiv.appendChild(document.createTextNode(' '));
      infoDiv.appendChild(periodEm);
      infoDiv.appendChild(document.createTextNode(` — ${e.rating}`));
      infoDiv.appendChild(commentDiv);

      const del = el('button', { className: 'btn-sm' }, 'Delete');
      del.onclick = () => {
        if (confirm('Delete entry?')) {
          deleteEntry(e.id);
          renderEntries(getTodayDate());
          renderGoals();
          renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
        }
      };

      const li = el('li', { className: 'entry-item' });
      li.appendChild(infoDiv);
      li.appendChild(del);
      entriesList.appendChild(li);
    }
  }

  // --- Goals ---
  function renderGoals() {
    if (!goalsList) return;
    const goals     = getGoals();
    const entries   = getEntries();
    const weekStart = getWeekStart();

    goalsList.innerHTML = '';

    if (Object.keys(goals).length === 0) {
      goalsList.innerHTML = '<li class="muted">No goals set yet.</li>';
      return;
    }

    for (const [paramId, goal] of Object.entries(goals)) {
      const paramName      = resolveParamName(paramId, paramId);
      const weekEntries    = entries.filter(
        e => e.parameterId === paramId && e.date >= weekStart
      );
      const uniqueSessions = new Set(
        weekEntries.map(e => `${e.date}__${e.period}`)
      ).size;
      const avg = weekEntries.length === 0
        ? null
        : Number((weekEntries.reduce((s, e) => s + e.rating, 0) / weekEntries.length).toFixed(2));

      const avgOk  = avg  !== null && avg  >= goal.targetWeeklyAvg;
      const sessOk = uniqueSessions >= goal.targetSessions;
      const ok     = '#68d391';
      const miss   = '#fc8181';

      const nameStrong = el('strong', { style: { flex: '1' } }, paramName);
      const avgSpan    = el('span', {
        style: { color: avgOk ? ok : miss, fontSize: '13px', marginLeft: '8px' },
      }, `avg ${avg ?? '—'}/${goal.targetWeeklyAvg} ${avgOk ? '✓' : '✗'}`);
      const sessSpan   = el('span', {
        style: { color: sessOk ? ok : miss, fontSize: '13px', marginLeft: '8px' },
      }, `sessions ${uniqueSessions}/${goal.targetSessions} ${sessOk ? '✓' : '✗'}`);
      const delBtn     = el('button', { className: 'btn-del', style: { marginLeft: '8px' } }, '✕');
      delBtn.onclick   = () => {
        removeGoal(paramId);
        renderGoals();
        renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
      };

      const li = el('li', { className: 'goal-item',
        style: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' },
      });
      li.append(nameStrong, avgSpan, sessSpan, delBtn);
      goalsList.appendChild(li);
    }
  }

  // --- Weekly History ---
  function renderWeeklyHistory() {
    if (!weeklyHistoryDiv) return;
    const snapshots = getSnapshots();
    weeklyHistoryDiv.innerHTML = '';

    if (snapshots.length === 0) {
      weeklyHistoryDiv.appendChild(
        el('p', { className: 'muted' }, 'No history yet. Snapshots are taken automatically every Monday.')
      );
      return;
    }

    for (const snap of snapshots) {
      // Cabeçalho do card
      const header = el('div', {
        style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
      },
        el('strong', {}, `${snap.weekStart} → ${snap.weekEnd}`),
        el('span', { className: 'muted', style: { fontSize: '12px' } },
          `saved ${new Date(snap.takenAt).toLocaleDateString()}`
        )
      );

      // Tabela de rows
      const table = el('table', { style: { width: '100%', fontSize: '13px', borderCollapse: 'collapse' } });
      const thead = el('thead');
      thead.appendChild(el('tr', {},
        el('th', { style: { textAlign: 'left', paddingBottom: '4px' } }, 'Parameter'),
        el('th', { style: { textAlign: 'right' } }, 'Avg'),
        el('th', { style: { textAlign: 'right' } }, 'Sessions'),
        el('th', { style: { textAlign: 'center' } }, 'Goals'),
      ));
      table.appendChild(thead);

      const tbody = el('tbody');
      for (const row of snap.rows) {
        const avgDisplay  = row.avgRating    ?? '—';
        const goalAvgTxt  = row.goalTargetWeeklyAvg !== null ? `/${row.goalTargetWeeklyAvg}` : '';
        const goalSesTxt  = row.goalTargetSessions  !== null ? `/${row.goalTargetSessions}`  : '';

        // Indicador de goals: ✓✓ ambos, ✓✗ só avg, etc. null se sem goal
        let goalIndicator = '—';
        if (row.avgMet !== null || row.sessionsMet !== null) {
          const a = row.avgMet      === null ? '·' : row.avgMet      ? '✓' : '✗';
          const s = row.sessionsMet === null ? '·' : row.sessionsMet ? '✓' : '✗';
          const aColor = row.avgMet      ? '#68d391' : '#fc8181';
          const sColor = row.sessionsMet ? '#68d391' : '#fc8181';
          const aSpan  = el('span', { style: { color: aColor } }, `avg${a}`);
          const sSpan  = el('span', { style: { color: sColor, marginLeft: '6px' } }, `ses${s}`);
          goalIndicator = el('span', {});
          goalIndicator.append(aSpan, sSpan);
        }

        const tr = el('tr', { style: { borderTop: '1px solid var(--border, #333)' } },
          el('td', { style: { padding: '3px 0' } }, row.parameterName),
          el('td', { style: { textAlign: 'right' } }, `${avgDisplay}${goalAvgTxt}`),
          el('td', { style: { textAlign: 'right' } }, `${row.uniqueSessions}${goalSesTxt}`),
          el('td', { style: { textAlign: 'center' } }),
        );
        // Insere o goalIndicator (pode ser string ou nó DOM)
        tr.cells[3].appendChild(
          typeof goalIndicator === 'string'
            ? document.createTextNode(goalIndicator)
            : goalIndicator
        );
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);

      const card = el('div', {
        style: {
          border:       '1px solid var(--border, #333)',
          borderRadius: '6px',
          padding:      '10px',
          marginBottom: '10px',
        },
      });
      card.appendChild(header);
      card.appendChild(table);
      weeklyHistoryDiv.appendChild(card);
    }
  }

  // --- Events ---
  addParamForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = paramNameInput.value.trim();
    if (!name) return;
    addParameter(name);
    paramNameInput.value = '';
    renderParams();
  });

  let isSubmitting = false;
  entryForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    const today     = getTodayDate();
    const paramId   = entryParam.value;
    const paramName = entryParam.selectedOptions[0].text;
    const period    = entryForm.period.value;
    const rating    = ratingInput.value;
    const comment   = commentInput.value.trim();

    saveEntry({ date: today, period, parameterId: paramId, parameterName: paramName, rating, comment });

    ratingInput.value       = 7;
    ratingValue.textContent = '7';
    commentInput.value      = '';

    renderEntries(today);
    renderGoals();
    renderChart(paramId, paramName);

    setTimeout(() => { isSubmitting = false; }, 300);
  });

  ratingInput.addEventListener('input', () => {
    ratingValue.textContent = ratingInput.value;
  });

  goalForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const paramId   = goalParamSelect.value;
    const paramName = goalParamSelect.selectedOptions[0].text;
    setGoal(paramId, {
      targetWeeklyAvg: goalTargetInput.value,
      targetSessions:  goalSessionsInput.value,
    });
    renderGoals();
    renderChart(paramId, paramName);
  });

  goalTargetInput?.addEventListener('input', () => {
    goalTargetValue.textContent = goalTargetInput.value;
  });

  goalSessionsInput?.addEventListener('input', () => {
    goalSessionsValue.textContent = goalSessionsInput.value;
  });

  chartParam.addEventListener('change', () => {
    renderChart(chartParam.value, chartParam.selectedOptions[0].text);
  });

  // --- Init ---
  renderParams();
  renderEntries();
  renderGoals();
  renderWeeklyHistory();
  renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);

  const resetBtn = document.getElementById('reset-storage');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('This will delete ALL data. Continue?')) {
        resetStorage();
        location.reload();
      }
    });
  }

  // Expõe refresh para main.js acionar re-render após virada de semana
  function refresh() {
    currentDateSpan.textContent = new Date().toLocaleDateString();
    renderParams();
    renderEntries();
    renderGoals();
    renderWeeklyHistory();
    renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
  }

  return { refresh };
}