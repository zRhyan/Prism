// src/scripts/ui.js
import {
  getParameters, addParameter, removeParameter,
  getEntries, saveEntry, deleteEntry, resetStorage,
  getGoals, setGoal, removeGoal,
  resolveParamName, localDateStr,
} from "./storage.js";
import { renderChart } from "./chart.js";

const getTodayDate = () => localDateStr(new Date());

// Segunda-feira da semana atual como "YYYY-MM-DD".
// Comparação de progresso usa string >= string — válido para ISO dates.
const getWeekStart = () => {
  const today = new Date();
  const day   = today.getDay(); // 0 = Dom
  const diff  = day === 0 ? -6 : 1 - day;
  return localDateStr(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff)
  );
};

export function setupUI() {
  // --- DOM refs: entries ---
  const paramsList       = document.getElementById('paramsList');
  const addParamForm     = document.getElementById('addParamForm');
  const paramNameInput   = document.getElementById('paramName');
  const entryParam       = document.getElementById('entryParam');
  const chartParam       = document.getElementById('chartParam');
  const entriesList      = document.getElementById('entriesList');
  const entryForm        = document.getElementById('entryForm');
  const currentDateSpan  = document.getElementById('currentDate');
  const ratingInput      = document.getElementById('rating');
  const ratingValue      = document.getElementById('ratingValue');
  const commentInput     = document.getElementById('comment');

  // --- DOM refs: goals ---
  const goalsList         = document.getElementById('goalsList');
  const goalForm          = document.getElementById('goalForm');
  const goalParamSelect   = document.getElementById('goalParam');
  const goalTargetInput   = document.getElementById('goalTarget');
  const goalTargetValue   = document.getElementById('goalTargetValue');
  const goalSessionsInput = document.getElementById('goalSessions');
  const goalSessionsValue = document.getElementById('goalSessionsValue');

  currentDateSpan.textContent = new Date().toLocaleDateString();

  // --- Parameters ---
  function renderParams() {
    const params = getParameters();
    paramsList.innerHTML  = '';
    entryParam.innerHTML  = '';
    chartParam.innerHTML  = '';
    if (goalParamSelect) goalParamSelect.innerHTML = '';

    for (const p of params) {
      const li = document.createElement('li');
      li.textContent = p.name;
      const del = document.createElement('button');
      del.textContent = '✕';
      del.className   = 'btn-del';
      del.onclick = () => {
        if (confirm(`Remove parameter "${p.name}"?`)) {
          removeParameter(p.id);
          renderParams();
          renderEntries();
          renderGoals();
          renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
        }
      };
      li.appendChild(del);
      paramsList.appendChild(li);

      // Popula os três selects de uma vez
      const targets = [entryParam, chartParam, goalParamSelect].filter(Boolean);
      for (const sel of targets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
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
      // Desnormalization fix: usa nome atual do parâmetro; cai no nome armazenado
      // se o parâmetro foi deletado
      const displayName = resolveParamName(e.parameterId, e.parameterName);

      const li = document.createElement('li');
      li.className = 'entry-item';
      li.innerHTML = `
        <div>
          <strong>${displayName}</strong>
          <em style="color:var(--muted)">(${e.period})</em> — ${e.rating}
          <div class="comment">${e.comment || ''}</div>
        </div>`;

      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.className   = 'btn-sm';
      del.onclick = () => {
        if (confirm('Delete entry?')) {
          deleteEntry(e.id);
          renderEntries(date);
          renderGoals();
          renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
        }
      };
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
      const paramName   = resolveParamName(paramId, paramId);
      const weekEntries = entries.filter(
        e => e.parameterId === paramId && e.date >= weekStart
      );
      const sessions = weekEntries.length;
      const avg      = sessions === 0
        ? null
        : Number((weekEntries.reduce((s, e) => s + e.rating, 0) / sessions).toFixed(2));

      const avgOk  = avg !== null && avg  >= goal.targetWeeklyAvg;
      const sessOk = sessions >= goal.targetSessions;

      const okStyle   = 'color:#68d391;font-size:13px;margin-left:8px;';
      const missStyle = 'color:#fc8181;font-size:13px;margin-left:8px;';

      const li = document.createElement('li');
      li.className = 'goal-item';
      li.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 0;';
      li.innerHTML = `
        <strong style="flex:1">${paramName}</strong>
        <span style="${avgOk ? okStyle : missStyle}">
          avg ${avg ?? '—'}/${goal.targetWeeklyAvg} ${avgOk ? '✓' : '✗'}
        </span>
        <span style="${sessOk ? okStyle : missStyle}">
          sessions ${sessions}/${goal.targetSessions} ${sessOk ? '✓' : '✗'}
        </span>
        <button class="btn-del" data-param-id="${paramId}" style="margin-left:8px;">✕</button>
      `;
      goalsList.appendChild(li);
    }

    goalsList.querySelectorAll('[data-param-id]').forEach(btn => {
      btn.onclick = () => {
        removeGoal(btn.dataset.paramId);
        renderGoals();
        renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
      };
    });
  }

  // --- Event listeners ---
  addParamForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = paramNameInput.value.trim();
    if (!name) return;
    addParameter(name);
    paramNameInput.value = '';
    renderParams();
  });

  entryForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
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
}