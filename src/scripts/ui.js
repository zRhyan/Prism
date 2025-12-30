// src/scripts/ui.js
import {
  getParameters,
  addParameter,
  removeParameter,
  getEntries,
  saveEntry,
  deleteEntry,
  resetStorage
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
  const commentInput = document.getElementById("comment");
  
  // Removido: ratingValue (não existe mais no DOM)

  const formatDate = (d) => d.toISOString().slice(0, 10);
  const date = formatDate(new Date());
  
  if(currentDateSpan) {
      currentDateSpan.textContent = new Date().toLocaleDateString();
  }

  function renderParams() {
    const params = getParameters();
    paramsList.innerHTML = "";
    entryParam.innerHTML = "";
    chartParam.innerHTML = "";

    // Se não houver parâmetros, evita erros
    if (params.length === 0) return;

    for (const p of params) {
      // 1. Lista de parâmetros (com botão deletar)
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
          // Verifica se ainda existem opções antes de renderizar gráfico
          if (chartParam.options.length > 0) {
             renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
          }
        }
      };
      li.appendChild(del);
      paramsList.appendChild(li);

      // 2. Select do Formulário
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      entryParam.appendChild(opt);

      // 3. Select do Gráfico
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

    // Ordena por horário de criação (assumindo que novos ficam embaixo) ou alfabético
    // Mantive sua lógica original alfabética, mas para logs diários, 
    // cronológico reverso costuma ser melhor. Deixei como estava.
    entries.sort((a, b) => a.parameterName.localeCompare(b.parameterName));

    for (const e of entries) {
      const li = document.createElement("li");
      li.className = "entry-item";
      
      // Ajuste visual: Mostra "min" se for um número alto, ou só o valor
      li.innerHTML = `
        <div>
            <strong>${e.parameterName}</strong> 
            <em style="color:var(--muted)">(${e.period})</em> — 
            <span style="color:var(--accent)">${e.rating}</span>
            <div class="comment">${e.comment || ""}</div>
        </div>`;
      
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.className = "btn-sm";
      del.onclick = () => {
        if (confirm("Delete entry?")) {
          deleteEntry(e.id);
          renderEntries(date);
          if (chartParam.options.length > 0) {
            renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
          }
        }
      };
      li.appendChild(del);
      entriesList.appendChild(li);
    }
  }

  // --- Event Listeners ---

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
    // Proteção contra envio sem parâmetros definidos
    if (!paramId) return; 

    const paramName = entryParam.selectedOptions[0].text;
    const period = entryForm.period.value;
    const rating = ratingInput.value;
    const comment = commentInput.value.trim();

    if (!rating) return; // Não salva vazio

    saveEntry({ date, period, parameterId: paramId, parameterName: paramName, rating, comment });
    
    // RESET DO FORMULÁRIO (Adaptado para Input Numérico)
    ratingInput.value = ""; // Limpa o campo
    commentInput.value = "";
    
    renderEntries(date);
    renderChart(paramId, paramName);
  });

  // Removido o listener de 'input' do ratingInput pois não há mais display visual

  chartParam.addEventListener("change", () => {
    const id = chartParam.value;
    const name = chartParam.selectedOptions[0].text;
    renderChart(id, name);
  });

  // --- Inicialização ---
  renderParams();
  renderEntries();
  
  // Renderiza gráfico inicial se houver parâmetros
  if (chartParam.options.length > 0) {
      renderChart(chartParam.value, chartParam.selectedOptions[0]?.text);
  }

  // Reset Button
  const resetBtn = document.getElementById("reset-storage");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("This will delete ALL data. Continue?")) {
        resetStorage();
        location.reload();
      }
    });
  }
}