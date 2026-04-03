// src/scripts/ui.js
import {
  getParameters, addParameter, removeParameter,
  getEntries, saveEntry, deleteEntry, resetStorage,
  getGoals, setGoal, removeGoal,
  resolveParamName, localDateStr, getWeekStart,
  setParameterThresholds,
  getWeeklySnapshots, getMonthlySnapshots, getYearlySnapshots,
} from './storage.js';
import { renderChart, computeAverages } from './chart.js';

const getTodayDate = () => localDateStr(new Date());

// getWeekStart imported from storage — no local duplicate

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

  // ─── DOM refs: entry form ───────────────────────────────────────────────────
  const paramsList      = document.getElementById('paramsList');
  const addParamForm    = document.getElementById('addParamForm');
  const paramNameInput  = document.getElementById('paramName');
  const entryParam      = document.getElementById('entryParam');
  const entriesList     = document.getElementById('entriesList');
  const entryForm       = document.getElementById('entryForm');
  const currentDateSpan = document.getElementById('currentDate');
  const ratingInput     = document.getElementById('rating');
  const ratingValue     = document.getElementById('ratingValue');
  const durationInput   = document.getElementById('duration');
  const commentInput    = document.getElementById('comment');

  // ─── DOM refs: chart controls ───────────────────────────────────────────────
  const chartParam          = document.getElementById('chartParam');
  const chartModeSelect     = document.getElementById('chartMode');
  const chartIntervalSelect = document.getElementById('chartInterval');
  const trendToggle         = document.getElementById('trendToggle');
  const statsCardsDiv       = document.getElementById('statsCards');

  // ─── DOM refs: goals ────────────────────────────────────────────────────────
  const goalsList          = document.getElementById('goalsList');
  const goalForm           = document.getElementById('goalForm');
  const goalParamSelect    = document.getElementById('goalParam');
  const goalModeSelect     = document.getElementById('goalMode');
  const goalIntervalSelect = document.getElementById('goalInterval');
  const goalTargetInput    = document.getElementById('goalTarget');
  const goalTargetValue    = document.getElementById('goalTargetValue');

  // ─── DOM refs: history ──────────────────────────────────────────────────────
  const historyDiv = document.getElementById('weeklyHistory');

  // ─── DOM refs: regression thresholds ───────────────────────────────────────
  const thresholdForm          = document.getElementById('thresholdForm');
  const thresholdParamSelect   = document.getElementById('thresholdParam');
  const thresholdWeeklyInput   = document.getElementById('thresholdWeekly');
  const thresholdMonthlyInput  = document.getElementById('thresholdMonthly');
  const thresholdYearlyInput   = document.getElementById('thresholdYearly');

  currentDateSpan.textContent = new Date().toLocaleDateString();

  window.addEventListener('prism:quotaExceeded', () => {
    alert('[Prism] Storage limit reached. Export your data and clear old entries.');
  });

  // ─── Chart state ────────────────────────────────────────────────────────────
  const chartState = { mode: 'rating', interval: 'weekly', showTrend: false };

  function rerenderChart() {
    const paramId   = chartParam?.value;
    const paramName = chartParam?.selectedOptions[0]?.text;
    if (!paramId) return;
    renderChart({ paramId, paramName, ...chartState });
    renderStatsCards(paramId, chartState.mode);
  }

  // ─── Parameters ─────────────────────────────────────────────────────────────
  function renderParams() {
    paramsList.innerHTML = '';
    entryParam.innerHTML = '';
    chartParam.innerHTML = '';
    if (goalParamSelect)     goalParamSelect.innerHTML     = '';
    if (thresholdParamSelect) thresholdParamSelect.innerHTML = '';

    for (const p of getParameters()) {
      const li  = el('li');
      const del = el('button', { className: 'btn-del' }, '✕');
      del.onclick = () => {
        if (confirm(`Remove parameter "${p.name}"?`)) {
          removeParameter(p.id);
          renderParams();
          renderEntries();
          renderGoals();
          rerenderChart();
        }
      };
      li.appendChild(document.createTextNode(p.name));
      li.appendChild(del);
      paramsList.appendChild(li);

      for (const sel of [entryParam, chartParam, goalParamSelect, thresholdParamSelect].filter(Boolean)) {
        sel.appendChild(el('option', { value: p.id }, p.name));
      }
    }
  }

  // ─── Entries ─────────────────────────────────────────────────────────────────
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
      const durText     = e.duration != null ? ` · ${e.duration}min` : '';

      const nameStrong = el('strong', {}, displayName);
      const periodEm   = el('em', { style: { color: 'var(--muted)' } }, `(${e.period})`);
      const infoDiv    = el('div', {});
      infoDiv.appendChild(nameStrong);
      infoDiv.appendChild(document.createTextNode(' '));
      infoDiv.appendChild(periodEm);
      infoDiv.appendChild(document.createTextNode(` — ${e.rating}${durText}`));
      if (e.comment) infoDiv.appendChild(el('div', { className: 'comment' }, e.comment));

      const del = el('button', { className: 'btn-sm' }, 'Delete');
      del.onclick = () => {
        if (confirm('Delete entry?')) {
          deleteEntry(e.id);
          renderEntries(getTodayDate());
          renderGoals();
          rerenderChart();
        }
      };

      const li = el('li', { className: 'entry-item' });
      li.appendChild(infoDiv);
      li.appendChild(del);
      entriesList.appendChild(li);
    }
  }

  // ─── Goals ───────────────────────────────────────────────────────────────────
  // Uses computeAverages from chart.js — no duplicated aggregation logic
  function renderGoals() {
    if (!goalsList) return;
    const goals = getGoals(); // now an array
    goalsList.innerHTML = '';

    if (goals.length === 0) {
      goalsList.innerHTML = '<li class="muted">No goals set yet.</li>';
      return;
    }

    for (const goal of goals) {
      const paramName = resolveParamName(goal.parameterId, goal.parameterId);
      const avgs      = computeAverages(goal.parameterId, goal.mode);
      const actual    = avgs[goal.interval] ?? null;
      const met       = actual !== null ? actual >= goal.target : null;

      const ok      = '#68d391';
      const miss    = '#fc8181';
      const neutral = 'var(--muted)';
      const unitLbl = goal.mode === 'duration' ? 'min' : '';
      const modeLbl = { rating: 'Score', duration: 'Time', weighted: 'Weighted' }[goal.mode] ?? goal.mode;
      const intLbl  = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[goal.interval] ?? goal.interval;

      const nameStrong   = el('strong', { style: { flex: '1' } }, paramName);
      const metaSpan     = el('span', {
        style: { color: neutral, fontSize: '12px', marginLeft: '8px' },
      }, `${intLbl} ${modeLbl}`);
      const progressSpan = el('span', {
        style: { color: met === null ? neutral : met ? ok : miss, fontSize: '13px', marginLeft: '8px' },
      }, `${actual ?? '—'}${unitLbl} / ${goal.target}${unitLbl} ${met === null ? '' : met ? '✓' : '✗'}`);
      const delBtn = el('button', { className: 'btn-del', style: { marginLeft: '8px' } }, '✕');
      delBtn.onclick = () => {
        removeGoal(goal.id);
        renderGoals();
        rerenderChart();
      };

      const li = el('li', { className: 'goal-item',
        style: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' },
      });
      li.append(nameStrong, metaSpan, progressSpan, delBtn);
      goalsList.appendChild(li);
    }
  }

  // ─── Stats cards ─────────────────────────────────────────────────────────────
  function renderStatsCards(paramId, mode) {
    if (!statsCardsDiv || !paramId) return;
    const avgs    = computeAverages(paramId, mode);
    const unitLbl = mode === 'duration' ? ' min' : '';
    const modeLbl = { rating: 'Score', duration: 'Time', weighted: 'Weighted' }[mode] ?? mode;
    statsCardsDiv.innerHTML = '';

    const wrapper = el('div', {
      style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' },
    });

    for (const [interval, value] of Object.entries(avgs)) {
      const label = { weekly: 'This week', monthly: 'This month', yearly: 'This year' }[interval] ?? interval;
      const card  = el('div', {
        style: {
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          padding:        '8px 14px',
          border:         '1px solid var(--border, #333)',
          borderRadius:   '6px',
          minWidth:       '90px',
        },
      });
      card.appendChild(el('span', { style: { fontSize: '11px', color: neutral } }, label));
      card.appendChild(el('strong', { style: { fontSize: '18px', margin: '4px 0' } },
        value !== null ? `${value}${unitLbl}` : '—'
      ));
      card.appendChild(el('span', { style: { fontSize: '11px', color: neutral } }, modeLbl));
      wrapper.appendChild(card);
    }

    statsCardsDiv.appendChild(wrapper);
  }

  // ─── History ─────────────────────────────────────────────────────────────────
  function renderHistory() {
    if (!historyDiv) return;
    historyDiv.innerHTML = '';

    const sections = [
      { label: 'Weekly',  snapshots: getWeeklySnapshots()  },
      { label: 'Monthly', snapshots: getMonthlySnapshots() },
      { label: 'Yearly',  snapshots: getYearlySnapshots()  },
    ];

    let anyData = false;

    for (const { label, snapshots } of sections) {
      if (snapshots.length === 0) continue;
      anyData = true;

      historyDiv.appendChild(
        el('h3', { style: { margin: '12px 0 6px', fontSize: '14px' } }, `${label} History`)
      );

      for (const snap of snapshots) {
        const header = el('div', {
          style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
        },
          el('strong', {}, `${snap.periodStart} → ${snap.periodEnd}`),
          el('span', { className: 'muted', style: { fontSize: '12px' } },
            `saved ${new Date(snap.takenAt).toLocaleDateString()}`
          )
        );

        const table = el('table', {
          style: { width: '100%', fontSize: '13px', borderCollapse: 'collapse' },
        });
        const thead = el('thead');
        thead.appendChild(el('tr', {},
          el('th', { style: { textAlign: 'left',    paddingBottom: '4px' } }, 'Parameter'),
          el('th', { style: { textAlign: 'right'  } }, 'Score'),
          el('th', { style: { textAlign: 'right'  } }, 'Time'),
          el('th', { style: { textAlign: 'right'  } }, 'Weighted'),
          el('th', { style: { textAlign: 'right'  } }, 'Sessions'),
          el('th', { style: { textAlign: 'center' } }, 'Goals'),
        ));
        table.appendChild(thead);

        const tbody = el('tbody');
        for (const row of snap.rows) {
          // Build goal indicator nodes — one badge per goal result
          const goalCell = el('span', {});
          if (row.goals.length === 0) {
            goalCell.appendChild(document.createTextNode('—'));
          } else {
            for (const g of row.goals) {
              const modeShort = { rating: 'S', duration: 'T', weighted: 'W' }[g.mode] ?? '?';
              const intShort  = { weekly: 'w', monthly: 'm', yearly: 'y' }[g.interval]  ?? '?';
              const color     = g.met === null ? 'var(--muted)' : g.met ? '#68d391' : '#fc8181';
              const mark      = g.met === null ? '·'           : g.met ? '✓'       : '✗';
              goalCell.appendChild(
                el('span', { style: { color, marginRight: '4px', fontSize: '12px' } },
                  `${modeShort}${intShort}${mark}`
                )
              );
            }
          }

          const tr = el('tr', { style: { borderTop: '1px solid var(--border, #333)' } },
            el('td', { style: { padding: '3px 0' } },          row.parameterName),
            el('td', { style: { textAlign: 'right' } },         row.avgRating    ?? '—'),
            el('td', { style: { textAlign: 'right' } },
              row.avgDuration != null ? `${row.avgDuration}m`  : '—'),
            el('td', { style: { textAlign: 'right' } },         row.weightedScore ?? '—'),
            el('td', { style: { textAlign: 'right' } },         String(row.uniqueSessions)),
            el('td', { style: { textAlign: 'center' } }),
          );
          tr.cells[5].appendChild(goalCell);
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
        historyDiv.appendChild(card);
      }
    }

    if (!anyData) {
      historyDiv.appendChild(
        el('p', { className: 'muted' },
          'No history yet. Snapshots are taken automatically at each week, month, and year boundary.')
      );
    }
  }

  // ─── Events ──────────────────────────────────────────────────────────────────

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
    const duration  = durationInput?.value?.trim() || null;
    const comment   = commentInput.value.trim();

    saveEntry({ date: today, period, parameterId: paramId, parameterName: paramName,
                rating, duration, comment });

    ratingInput.value       = 7;
    ratingValue.textContent = '7';
    if (durationInput) durationInput.value = '';
    commentInput.value      = '';

    renderEntries(today);
    renderGoals();
    rerenderChart();

    setTimeout(() => { isSubmitting = false; }, 300);
  });

  ratingInput.addEventListener('input', () => {
    ratingValue.textContent = ratingInput.value;
  });

  chartParam?.addEventListener('change',           () => rerenderChart());
  chartModeSelect?.addEventListener('change',      () => { chartState.mode     = chartModeSelect.value;     rerenderChart(); });
  chartIntervalSelect?.addEventListener('change',  () => { chartState.interval = chartIntervalSelect.value; rerenderChart(); });
  trendToggle?.addEventListener('change',          () => { chartState.showTrend = trendToggle.checked;      rerenderChart(); });

  goalForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    setGoal({
      parameterId: goalParamSelect.value,
      mode:        goalModeSelect?.value     ?? 'rating',
      interval:    goalIntervalSelect?.value ?? 'weekly',
      target:      goalTargetInput.value,
    });
    renderGoals();
    rerenderChart();
  });

  goalTargetInput?.addEventListener('input', () => {
    if (goalTargetValue) goalTargetValue.textContent = goalTargetInput.value;
  });

  thresholdForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const paramId = thresholdParamSelect?.value;
    if (!paramId) return;
    setParameterThresholds(paramId, {
      weekly:  thresholdWeeklyInput?.value  ?? 3,
      monthly: thresholdMonthlyInput?.value ?? 12,
      yearly:  thresholdYearlyInput?.value  ?? 52,
    });
    if (chartState.showTrend) rerenderChart();
  });

  // ─── Init ────────────────────────────────────────────────────────────────────

  renderParams();
  renderEntries();
  renderGoals();
  renderHistory();
  rerenderChart();

  const resetBtn = document.getElementById('reset-storage');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('This will delete ALL data. Continue?')) {
        resetStorage();
        location.reload();
      }
    });
  }

  function refresh() {
    currentDateSpan.textContent = new Date().toLocaleDateString();
    renderParams();
    renderEntries();
    renderGoals();
    renderHistory();
    rerenderChart();
  }

  return { refresh };
}

// Module-scoped neutral color used by renderStatsCards
const neutral = 'var(--muted)';