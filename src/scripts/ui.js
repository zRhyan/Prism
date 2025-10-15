// src/scripts/ui.js
import {
  getParameters,
  addParameter,
  removeParameter,
  getEntries,
  saveEntry,
  deleteEntry,
} from "./storage.js";
import { renderChart } from "./chart.js";

export function setupUI() {
  const paramsList = document.getElementById("paramsList");
  const addParamForm = document.getElementById("addParamForm");
  const paramNameInput = document.getElementById("paramName");
  const entryParam = document.getElementById("entryParam");
  const chartParam = document.getElementById("chartParam");
  const entriesList = document.getElementById("entriesList");
  const entryForm = document.getElementById("entryForm");
  const currentDateSpan = document.getElementById("currentDate");
  const ratingInput = document.getElementById("rating");
  const ratingValue = document.getElementById("ratingValue");
  const commentInput = document.getElementById("comment");

  const formatDate = (d) => d.toISOString().slice(0, 10);
  const date = formatDate(new Date());
  currentDateSpan.textContent = new Date().toLocaleDateString();

  function renderParams() {
    const params = getParameters();
    paramsList.innerHTML = "";
    entryParam.innerHTML = "";
    chartParam.innerHTML = "";
    for (const p of params) {
      const li = document.createElement("li");
      li.textContent = p.name;
      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "btn-del";
      del.onclick = () => {
        if (confirm(`Remove parameter "${p.name}"?`)) {
          removeParameter(p.id);
          renderParams();
          renderEntries();
          renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
        }
      };
      li.appendChild(del);
      paramsList.appendChild(li);

      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      entryParam.appendChild(opt);

      const opt2 = document.createElement("option");
      opt2.value = p.id;
      opt2.textContent = p.name;
      chartParam.appendChild(opt2);
    }
  }

  function renderEntries(date = formatDate(new Date())) {
    entriesList.innerHTML = "";
    const entries = getEntries().filter((e) => e.date === date);
    if (entries.length === 0) {
      entriesList.innerHTML = '<li class="muted">No entries for today</li>';
      return;
    }
    entries.sort((a, b) => a.parameterName.localeCompare(b.parameterName));
    for (const e of entries) {
      const li = document.createElement("li");
      li.className = "entry-item";
      li.innerHTML = `<div><strong>${e.parameterName}</strong> <em style="color:var(--muted)">(${e.period})</em> — ${e.rating}
                      <div class="comment">${e.comment || ""}</div></div>`;
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.className = "btn-sm";
      del.onclick = () => {
        if (confirm("Delete entry?")) {
          deleteEntry(e.id);
          renderEntries(date);
          renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
        }
      };
      li.appendChild(del);
      entriesList.appendChild(li);
    }
  }

  addParamForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = paramNameInput.value.trim();
    if (!name) return;
    addParameter(name);
    paramNameInput.value = "";
    renderParams();
  });

  entryForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const paramId = entryParam.value;
    const paramName = entryParam.selectedOptions[0].text;
    const period = entryForm.period.value;
    const rating = ratingInput.value;
    const comment = commentInput.value.trim();
    saveEntry({ date, period, parameterId: paramId, parameterName: paramName, rating, comment });
    ratingInput.value = 7;
    ratingValue.textContent = "7";
    commentInput.value = "";
    renderEntries(date);
    renderChart(paramId, paramName);
  });

  ratingInput.addEventListener("input", () => {
    ratingValue.textContent = ratingInput.value;
  });

  chartParam.addEventListener("change", () => {
    const id = chartParam.value;
    const name = chartParam.selectedOptions[0].text;
    renderChart(id, name);
  });

  renderParams();
  renderEntries();
  renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
}
