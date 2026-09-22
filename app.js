const starterInventory = [
  { id: crypto.randomUUID(), char: "山", style: "宋体旧字", size: 30, quantity: 4, wear: "微磨" },
  { id: crypto.randomUUID(), char: "月", style: "宋体旧字", size: 30, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "风", style: "楷体木刻", size: 28, quantity: 2, wear: "微磨" },
  { id: crypto.randomUUID(), char: "花", style: "楷体木刻", size: 28, quantity: 2, wear: "新" },
  { id: crypto.randomUUID(), char: "茶", style: "黑体铅字", size: 24, quantity: 3, wear: "旧痕" },
  { id: crypto.randomUUID(), char: "雨", style: "仿宋细字", size: 22, quantity: 4, wear: "新" }
];

const defaultState = {
  inventory: starterInventory,
  selectedTypeId: starterInventory[0].id,
  placements: [],
  drafts: [],
  versions: [],
  activeVersionId: null,
  settings: {
    paperSize: "postcard",
    inkColor: "pine",
    pressure: 5,
    flowMode: "horizontal",
    gridGap: 8,
    workTitle: "晚风小笺"
  }
};

let state = Storage.load(defaultState);

const els = {
  paperSize: document.querySelector("#paperSize"),
  inkColor: document.querySelector("#inkColor"),
  pressure: document.querySelector("#pressure"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  stage: document.querySelector("#stage"),
  typeList: document.querySelector("#typeList"),
  typeForm: document.querySelector("#typeForm"),
  charInput: document.querySelector("#charInput"),
  styleInput: document.querySelector("#styleInput"),
  sizeInput: document.querySelector("#sizeInput"),
  quantityInput: document.querySelector("#quantityInput"),
  wearInput: document.querySelector("#wearInput"),
  inventorySearch: document.querySelector("#inventorySearch"),
  styleFilter: document.querySelector("#styleFilter"),
  selectedTypeLabel: document.querySelector("#selectedTypeLabel"),
  shortageBadge: document.querySelector("#shortageBadge"),
  usageList: document.querySelector("#usageList"),
  draftList: document.querySelector("#draftList"),
  versionList: document.querySelector("#versionList"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn"),
  trialBtn: document.querySelector("#trialBtn"),
  adoptBtn: document.querySelector("#adoptBtn"),
  voidBtn: document.querySelector("#voidBtn"),
  forkDraftBtn: document.querySelector("#forkDraftBtn"),
  modeBanner: document.querySelector("#modeBanner"),
  notice: document.querySelector("#notice")
};

let noticeTimer = null;

function flash(text, tone = "info") {
  els.notice.textContent = text;
  els.notice.className = `notice show ${tone}`;
  els.notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    els.notice.hidden = true;
    els.notice.classList.remove("show");
  }, 3200);
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

function getUsage() {
  return Rules.summarizeUsage(state.placements, state.inventory);
}

// 所有版面改动（增删、移动、换字、清空）的唯一入口：
// 试印中先作废本次并保留冻结快照；已采用版本只读，直接拒绝。
function mutateBoard(reason, mutation) {
  const ctx = Versions.currentMode(state);
  if (ctx.mode === Versions.MODE.ADOPTED) {
    flash("当前采用版本为只读，请先「另存为草稿」再编辑。", "error");
    return false;
  }
  if (ctx.mode === Versions.MODE.TRIAL) {
    Versions.voidActive(state, reason);
    flash(`试印 #${ctx.version.number} 因「${reason}」作废，冻结快照已保留。`, "warn");
  }
  mutation();
  renderAll();
  return true;
}

function renderModeBanner() {
  const ctx = Versions.currentMode(state);
  if (ctx.mode === Versions.MODE.TRIAL) {
    els.modeBanner.hidden = false;
    els.modeBanner.className = "mode-banner trial";
    els.modeBanner.textContent = `试印 #${ctx.version.number} 进行中：版面已冻结，任何增删、移动或换字都会作废本次试印。`;
  } else if (ctx.mode === Versions.MODE.ADOPTED) {
    els.modeBanner.hidden = false;
    els.modeBanner.className = "mode-banner adopted";
    els.modeBanner.textContent = `采用版本 #${ctx.version.number}（只读）。要继续调整，请「另存为草稿」。`;
  } else {
    els.modeBanner.hidden = true;
    els.modeBanner.textContent = "";
  }
}

function renderActionState() {
  const ctx = Versions.currentMode(state);
  const draft = ctx.mode === Versions.MODE.DRAFT;
  const trial = ctx.mode === Versions.MODE.TRIAL;
  const adopted = ctx.mode === Versions.MODE.ADOPTED;

  els.trialBtn.disabled = !draft;
  els.adoptBtn.disabled = !trial;
  els.voidBtn.disabled = !trial;
  els.forkDraftBtn.disabled = !adopted;
  els.saveDraftBtn.disabled = !draft;
  els.clearBoardBtn.disabled = !draft;

  [els.paperSize, els.inkColor, els.pressure, els.flowMode, els.gridGap, els.workTitle].forEach((input) => {
    input.disabled = !draft;
  });
  els.stage.classList.toggle("locked", !draft);
}

function renderSettings() {
  els.paperSize.value = state.settings.paperSize;
  els.inkColor.value = state.settings.inkColor;
  els.pressure.value = state.settings.pressure;
  els.flowMode.value = state.settings.flowMode;
  els.gridGap.value = state.settings.gridGap;
  els.workTitle.value = state.settings.workTitle;
  const ink = Rules.INKS[state.settings.inkColor] || Rules.INKS.pine;
  document.documentElement.style.setProperty("--ink-color", ink.color);
}

function renderStyleFilter() {
  const current = els.styleFilter.value || "all";
  const styles = [...new Set(state.inventory.map((item) => item.style))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  els.styleFilter.innerHTML = `<option value="all">全部风格</option>${styles
    .map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`)
    .join("")}`;
  els.styleFilter.value = styles.includes(current) ? current : "all";
}

function renderInventory() {
  const keyword = els.inventorySearch.value.trim();
  const style = els.styleFilter.value;
  const { byType } = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    return matchesKeyword && matchesStyle;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模`;
  els.typeList.innerHTML = items
    .map((item) => {
      const used = byType[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      const over = used > item.quantity ? "over" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span class="${over}">${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}</span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function renderStage() {
  const { cols, rows } = Rules.getGrid(state.settings.paperSize);
  const map = new Map(state.placements.map((item) => [placementKey(item.row, item.col), item]));
  els.stage.className = `stage ${state.settings.paperSize} ${els.stage.classList.contains("locked") ? "locked" : ""}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${state.settings.gridGap}px`;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const placement = map.get(placementKey(row, col));
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = state.settings.flowMode === "vertical" ? "vertical" : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" draggable="${type ? "true" : "false"}"
          data-row="${row}" data-col="${col}" ${type ? `data-move="${placementKey(row, col)}"` : ""}
          type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
}

function renderUsage() {
  const { byType, shortages } = getUsage();
  const entries = state.inventory.filter((item) => byType[item.id]);
  els.placedCount.textContent = `${state.placements.length}个落字`;

  els.shortageBadge.textContent = shortages.length ? `${shortages.length}处缺字/超量` : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType ? `当前：${selectedType.char} · ${selectedType.style}` : "未选择字模";

  const missingLines = shortages
    .filter((s) => s.missing)
    .map((s) => `<div class="usage-item warn"><strong>缺字 · ${escapeHtml(s.label)}</strong><span>已落${s.used}处</span></div>`)
    .join("");

  els.usageList.innerHTML =
    entries
      .map((item) => {
        const used = byType[item.id];
        const warn = used > item.quantity ? "warn" : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${escapeHtml(item.char)} ${escapeHtml(item.style)}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") +
    missingLines || `<p class="empty">还没有落字。</p>`;
}

function statusMeta(status) {
  if (status === Versions.STATUS.TRIAL) return { label: "试印中", cls: "v-trial" };
  if (status === Versions.STATUS.ADOPTED) return { label: "已采用", cls: "v-adopted" };
  return { label: "已作废", cls: "v-void" };
}

function renderVersions() {
  if (!state.versions.length) {
    els.versionList.innerHTML = `<p class="empty">还没有试印版本。</p>`;
    return;
  }
  els.versionList.innerHTML = state.versions
    .map((version) => {
      const meta = statusMeta(version.status);
      const paper = Rules.PAPERS[version.settings.paperSize]?.label || version.settings.paperSize;
      const ink = Rules.INKS[version.settings.inkColor]?.label || version.settings.inkColor;
      // 缺字提示与当前字模库同步：字模被删或超量都会标红
      const { shortages } = Rules.summarizeUsage(version.placements, state.inventory);
      const shortageHtml = shortages.length
        ? `<ul class="v-shortage">${shortages
            .map((s) =>
              s.missing
                ? `<li>缺字：${escapeHtml(s.label)}（快照中${s.used}处）</li>`
                : `<li>「${escapeHtml(s.char)}」超量 ${s.used}/${s.quantity}</li>`
            )
            .join("")}</ul>`
        : `<span class="v-ok">字模齐备</span>`;
      const actions = [];
      if (version.status === Versions.STATUS.TRIAL) {
        actions.push(`<button type="button" data-adopt-version="${version.id}">标记采用</button>`);
        actions.push(`<button type="button" data-void-version="${version.id}">作废</button>`);
      } else {
        actions.push(`<button type="button" data-fork-version="${version.id}">另存为草稿</button>`);
      }
      const closed = version.closedAt ? new Date(version.closedAt).toLocaleString("zh-CN") : "";
      return `
        <article class="version-item ${meta.cls} ${state.activeVersionId === version.id ? "active" : ""}">
          <div class="v-head">
            <strong>#${version.number} ${escapeHtml(version.title)}</strong>
            <span class="v-status">${meta.label}</span>
          </div>
          <span class="v-meta">${paper} · ${ink} · 压力${version.settings.pressure} · ${version.placements.length}字</span>
          <span class="v-time">起：${new Date(version.startedAt).toLocaleString("zh-CN")}${closed ? ` ／ 结：${closed}` : ""}</span>
          ${version.voidReason ? `<span class="v-reason">作废原因：${escapeHtml(version.voidReason)}</span>` : ""}
          ${shortageHtml}
          <div class="draft-actions">${actions.join("")}</div>
        </article>
      `;
    })
    .join("");
}

function renderDrafts() {
  els.draftList.innerHTML =
    state.drafts
      .map(
        (draft) => `
          <article class="draft-item">
            <strong>${escapeHtml(draft.title)}</strong>
            <span>${draft.placements.length}个落字 · ${new Date(draft.savedAt).toLocaleString("zh-CN")}</span>
            <div class="draft-actions">
              <button type="button" data-load-draft="${draft.id}">载入</button>
              <button type="button" data-delete-draft="${draft.id}">删除</button>
            </div>
          </article>
        `
      )
      .join("") || `<p class="empty">还没有保存草稿。</p>`;
}

function renderAll() {
  Storage.save(state);
  renderSettings();
  renderModeBanner();
  renderActionState();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderVersions();
  renderDrafts();
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId) return;
  mutateBoard("落字/换字", () => {
    const existingIndex = state.placements.findIndex((item) => item.row === row && item.col === col);
    if (existingIndex >= 0) {
      if (state.placements[existingIndex].typeId === typeId) {
        state.placements.splice(existingIndex, 1);
      } else {
        state.placements[existingIndex].typeId = typeId;
      }
    } else {
      state.placements.push({ row, col, typeId });
    }
  });
}

function moveType(fromRow, fromCol, toRow, toCol) {
  if (fromRow === toRow && fromCol === toCol) return;
  mutateBoard("移动活字", () => {
    const fromIndex = state.placements.findIndex((item) => item.row === fromRow && item.col === fromCol);
    if (fromIndex < 0) return;
    const [moving] = state.placements.splice(fromIndex, 1);
    const toIndex = state.placements.findIndex((item) => item.row === toRow && item.col === toCol);
    if (toIndex >= 0) {
      // 目标格已有活字：交换位置
      const target = state.placements[toIndex];
      target.row = fromRow;
      target.col = fromCol;
    }
    moving.row = toRow;
    moving.col = toCol;
    state.placements.push(moving);
  });
}

function addType(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    char: els.charInput.value.trim(),
    style: els.styleInput.value.trim(),
    size: Number(els.sizeInput.value),
    quantity: Number(els.quantityInput.value),
    wear: els.wearInput.value
  };
  if (!item.char || !item.style) return;
  state.inventory.unshift(item);
  state.selectedTypeId = item.id;
  els.typeForm.reset();
  els.sizeInput.value = 24;
  els.quantityInput.value = 3;
  renderAll();
}

function startTrial() {
  const result = Rules.evaluateTrial({
    settings: state.settings,
    placements: state.placements,
    inventory: state.inventory,
    hasActiveTrial: Boolean(Versions.activeTrial(state))
  });
  if (!result.ok) {
    flash(`试印被拒绝：${result.errors.join("；")}。版面未改动。`, "error");
    return;
  }
  const version = Versions.startTrial(state, result.shortages);
  flash(`试印 #${version.number} 已开启：纸张、墨色、压力已锁定，版面冻结。`, "info");
  renderAll();
}

function adoptTrial() {
  const trial = Versions.activeTrial(state);
  if (!trial) return;
  Versions.adoptActive(state);
  flash(`试印 #${trial.number} 已标记采用，版本只读。`, "info");
  renderAll();
}

function voidTrialManual() {
  const trial = Versions.activeTrial(state);
  if (!trial) return;
  Versions.voidActive(state, "手动作废");
  flash(`试印 #${trial.number} 已作废，冻结快照保留在版本记录中。`, "warn");
  renderAll();
}

function forkDraftFromVersion(versionId) {
  const version = state.versions.find((v) => v.id === versionId);
  if (!version || version.status === Versions.STATUS.TRIAL) return;
  Versions.forkDraft(state);
  state.settings = { ...structuredClone(defaultState.settings), ...structuredClone(version.settings) };
  state.placements = structuredClone(version.placements);
  flash(`已由${version.status === Versions.STATUS.ADOPTED ? "采用版本" : "作废快照"} #${version.number} 另存草稿，可继续编辑。`, "info");
  renderAll();
}

function saveDraft() {
  const title = state.settings.workTitle.trim() || "未命名作品";
  state.drafts.unshift({
    id: crypto.randomUUID(),
    title,
    settings: structuredClone(state.settings),
    placements: structuredClone(state.placements),
    savedAt: new Date().toISOString()
  });
  state.drafts = state.drafts.slice(0, 8);
  renderAll();
}

function exportPreview() {
  const { cols, rows } = Rules.getGrid(state.settings.paperSize);
  const cell = state.settings.paperSize === "bookmark" ? 44 : 56;
  const gap = state.settings.gridGap;
  const margin = 48;
  const width = cols * cell + (cols - 1) * gap + margin * 2;
  const height = rows * cell + (rows - 1) * gap + margin * 2 + 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const ink = Rules.INKS[state.settings.inkColor] || Rules.INKS.pine;
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = ink.color;
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = ink.color;
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(state.settings.workTitle || "未命名作品", margin, 50);
  state.placements.forEach((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = ink.color;
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  const link = document.createElement("a");
  link.download = `${state.settings.workTitle || "movable-type"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---- 设置区（仅草稿可改） ----
els.paperSize.addEventListener("change", () => {
  state.settings.paperSize = els.paperSize.value;
  const { cols, rows } = Rules.getGrid(state.settings.paperSize);
  state.placements = state.placements.filter((item) => item.row < rows && item.col < cols);
  renderAll();
});

els.inkColor.addEventListener("change", () => {
  state.settings.inkColor = els.inkColor.value;
  renderAll();
});

els.pressure.addEventListener("change", () => {
  state.settings.pressure = Number(els.pressure.value);
  renderAll();
});

els.flowMode.addEventListener("change", () => {
  state.settings.flowMode = els.flowMode.value;
  renderAll();
});

els.gridGap.addEventListener("input", () => {
  state.settings.gridGap = Number(els.gridGap.value);
  renderAll();
});

els.workTitle.addEventListener("input", () => {
  state.settings.workTitle = els.workTitle.value;
  Storage.save(state);
});

// ---- 字模库 ----
els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);

els.typeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    const usedOnBoard = state.placements.some((item) => item.typeId === typeId);
    if (usedOnBoard) {
      const removedCount = state.placements.filter((item) => item.typeId === typeId).length;
      const allowed = mutateBoard(`删除字模（移除${removedCount}处落字）`, () => {
        state.inventory = state.inventory.filter((item) => item.id !== typeId);
        state.placements = state.placements.filter((item) => item.typeId !== typeId);
        if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
      });
      if (!allowed) return;
    } else {
      state.inventory = state.inventory.filter((item) => item.id !== typeId);
      if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
      renderAll();
    }
    return;
  }
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  state.selectedTypeId = card.dataset.typeId;
  renderAll();
});

els.typeList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-type-id]");
  if (!card) return;
  event.dataTransfer.setData("application/x-type-id", card.dataset.typeId);
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

// ---- 版面 ----
els.stage.addEventListener("dragstart", (event) => {
  const cell = event.target.closest("[data-move]");
  if (!cell) return;
  event.dataTransfer.setData("application/x-move", cell.dataset.move);
  event.dataTransfer.setData("text/plain", cell.dataset.move);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  event.preventDefault();
  const moveData = event.dataTransfer.getData("application/x-move");
  if (moveData) {
    const [fromRow, fromCol] = moveData.split(":").map(Number);
    moveType(fromRow, fromCol, Number(cell.dataset.row), Number(cell.dataset.col));
    return;
  }
  const typeId = event.dataTransfer.getData("application/x-type-id") || event.dataTransfer.getData("text/plain");
  if (typeId) placeType(Number(cell.dataset.row), Number(cell.dataset.col), typeId);
});

els.stage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  placeType(Number(cell.dataset.row), Number(cell.dataset.col));
});

// ---- 版本动作 ----
els.trialBtn.addEventListener("click", startTrial);
els.adoptBtn.addEventListener("click", adoptTrial);
els.voidBtn.addEventListener("click", voidTrialManual);
els.forkDraftBtn.addEventListener("click", () => {
  const adopted = Versions.adoptedVersion(state);
  if (adopted) forkDraftFromVersion(adopted.id);
});

els.versionList.addEventListener("click", (event) => {
  const adopt = event.target.closest("[data-adopt-version]");
  const voidBtn = event.target.closest("[data-void-version]");
  const fork = event.target.closest("[data-fork-version]");
  if (adopt && Versions.activeTrial(state)?.id === adopt.dataset.adoptVersion) {
    adoptTrial();
    return;
  }
  if (voidBtn && Versions.activeTrial(state)?.id === voidBtn.dataset.voidVersion) {
    voidTrialManual();
    return;
  }
  if (fork) {
    forkDraftFromVersion(fork.dataset.forkVersion);
  }
});

// ---- 草稿 ----
els.saveDraftBtn.addEventListener("click", saveDraft);
els.exportBtn.addEventListener("click", exportPreview);
els.clearBoardBtn.addEventListener("click", () => {
  mutateBoard("清空版面", () => {
    state.placements = [];
  });
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    const ctx = Versions.currentMode(state);
    if (ctx.mode === Versions.MODE.TRIAL) {
      Versions.voidActive(state, "载入草稿");
      flash(`试印 #${ctx.version.number} 已作废，已载入草稿「${draft.title}」。`, "warn");
    } else if (ctx.mode === Versions.MODE.ADOPTED) {
      Versions.forkDraft(state);
      flash(`已从采用版本另存草稿并载入「${draft.title}」。`, "info");
    }
    state.settings = { ...structuredClone(defaultState.settings), ...structuredClone(draft.settings) };
    state.placements = structuredClone(draft.placements);
    renderAll();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

renderAll();
