// 界面与交互：字模库、版面落字、试印流程与版本台
"use strict";

let state = loadState();
let notice = null; // { text, tone: "ok" | "warn" }
let viewVersionId = null; // 非空时版面只读展示该版本快照

const els = {
  paperSize: document.querySelector("#paperSize"),
  flowMode: document.querySelector("#flowMode"),
  gridGap: document.querySelector("#gridGap"),
  workTitle: document.querySelector("#workTitle"),
  inkColor: document.querySelector("#inkColor"),
  pressure: document.querySelector("#pressure"),
  pressureValue: document.querySelector("#pressureValue"),
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
  versionCount: document.querySelector("#versionCount"),
  proofBanner: document.querySelector("#proofBanner"),
  noticeBar: document.querySelector("#noticeBar"),
  placedCount: document.querySelector("#placedCount"),
  inventoryCount: document.querySelector("#inventoryCount"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  startProofBtn: document.querySelector("#startProofBtn"),
  passProofBtn: document.querySelector("#passProofBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearBoardBtn: document.querySelector("#clearBoardBtn")
};

function persist() {
  saveState(state);
}

function setNotice(text, tone = "ok") {
  notice = text ? { text, tone } : null;
}

function getGrid(size = state.settings.paperSize) {
  if (size === "bookmark") return { cols: 7, rows: 18 };
  if (size === "square") return { cols: 12, rows: 12 };
  return { cols: 16, rows: 10 };
}

function placementKey(row, col) {
  return `${row}:${col}`;
}

function getSelectedType() {
  return state.inventory.find((item) => item.id === state.selectedTypeId) || null;
}

function getUsage() {
  return countUsage(state.placements);
}

function getViewVersion() {
  return viewVersionId ? state.versions.find((item) => item.id === viewVersionId) || null : null;
}

// 版面当前展示的内容：只读版本快照或实时草稿
function getBoardView() {
  const version = getViewVersion();
  if (version) {
    return { placements: version.placements, settings: version.settings, readonly: true };
  }
  return { placements: state.placements, settings: state.settings, readonly: false };
}

// 试印中改动版面即作废本次，保留冻结快照
function guardBoardEdit(note) {
  if (!state.activeProof) return;
  voidProof(state, note);
  setNotice(`试印已作废：${note}，快照已存入版本记录`, "warn");
}

function renderSettings() {
  els.paperSize.value = state.settings.paperSize;
  els.flowMode.value = state.settings.flowMode;
  els.gridGap.value = state.settings.gridGap;
  els.workTitle.value = state.settings.workTitle;
  els.inkColor.value = state.settings.inkColor;
  els.pressure.value = state.settings.pressure;
  els.pressureValue.textContent = `压力 ${state.settings.pressure}`;
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
  const usage = getUsage();
  const items = state.inventory.filter((item) => {
    const matchesKeyword = !keyword || `${item.char}${item.style}${item.wear}`.includes(keyword);
    const matchesStyle = style === "all" || item.style === style;
    return matchesKeyword && matchesStyle;
  });

  els.inventoryCount.textContent = `${state.inventory.length}枚字模`;
  els.typeList.innerHTML = items
    .map((item) => {
      const used = usage[item.id] || 0;
      const selected = item.id === state.selectedTypeId ? "selected" : "";
      return `
        <article class="type-card ${selected}" draggable="true" data-type-id="${item.id}">
          <div class="glyph" style="font-size:${Math.min(item.size, 36)}px">${escapeHtml(item.char)}</div>
          <div class="type-meta">
            <strong>${escapeHtml(item.char)} · ${escapeHtml(item.style)}</strong>
            <span>${item.size}px · ${escapeHtml(item.wear)} · 已用${used}/${item.quantity}</span>
          </div>
          <button class="mini-btn" title="删除字模" data-delete-type="${item.id}" type="button">×</button>
        </article>
      `;
    })
    .join("");
}

function renderStage() {
  const view = getBoardView();
  const { cols, rows } = getGrid(view.settings.paperSize);
  const map = new Map(view.placements.map((item) => [placementKey(item.row, item.col), item]));
  const ink = getInkColor(view.settings.inkColor);
  els.stage.className = `stage ${view.settings.paperSize}${view.readonly ? " readonly" : ""}`;
  els.stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  els.stage.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  els.stage.style.gap = `${view.settings.gridGap}px`;
  els.stage.style.setProperty("--print-ink", ink.hex);
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const placement = map.get(placementKey(row, col));
      const type = placement ? state.inventory.find((item) => item.id === placement.typeId) : null;
      const vertical = view.settings.flowMode === "vertical" ? "vertical" : "";
      cells.push(`
        <button class="cell ${type ? "used" : ""} ${vertical}" data-row="${row}" data-col="${col}" type="button" aria-label="第${row + 1}行第${col + 1}列">
          ${type ? escapeHtml(type.char) : ""}
        </button>
      `);
    }
  }
  els.stage.innerHTML = cells.join("");
}

function renderUsage() {
  const usage = getUsage();
  const entries = state.inventory.filter((item) => usage[item.id]);
  els.placedCount.textContent = `${state.placements.length}个落字`;

  // 缺字提示与试印校验共用同一份规则，保持同步
  const shortages = findShortages(state.placements, state.inventory);
  els.shortageBadge.textContent = shortages.length
    ? `缺字：${shortages.map((item) => `${item.type.char}×${item.missing}`).join("、")}`
    : "数量充足";
  els.shortageBadge.className = `badge ${shortages.length ? "warn" : "ok"}`;

  const selectedType = getSelectedType();
  els.selectedTypeLabel.textContent = selectedType ? `当前：${selectedType.char} · ${selectedType.style}` : "未选择字模";

  els.usageList.innerHTML =
    entries
      .map((item) => {
        const used = usage[item.id];
        const warn = used > item.quantity ? "warn" : "";
        return `
          <div class="usage-item ${warn}">
            <strong>${escapeHtml(item.char)} ${escapeHtml(item.style)}</strong>
            <span>${used}/${item.quantity}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">还没有落字。</p>`;
}

function renderProof() {
  const proof = state.activeProof;
  const view = getViewVersion();
  els.proofBanner.hidden = !proof && !view;
  if (view) {
    const status = VERSION_STATUS[view.status];
    els.proofBanner.className = `proof-banner ${status.tone}`;
    els.proofBanner.innerHTML = `
      <strong>只读查看 · ${escapeHtml(view.title)}（${status.label}）</strong>
      <span>版本快照不可改动，另存草稿或点「返回草稿」继续编辑。</span>
      <button type="button" data-exit-view>返回草稿</button>
    `;
  } else if (proof) {
    els.proofBanner.className = "proof-banner proofing";
    els.proofBanner.innerHTML = `
      <strong>试印中 · ${escapeHtml(proof.title)}</strong>
      <span>${getInkColor(proof.settings.inkColor).label} · 压力${proof.settings.pressure} · 开印于${new Date(proof.startedAt).toLocaleString("zh-CN")}</span>
      <span>试印中增删、移动或换字将作废本次试印。</span>
    `;
  }
  els.passProofBtn.hidden = !proof;
  els.startProofBtn.hidden = Boolean(proof);
}

function renderNotice() {
  els.noticeBar.hidden = !notice;
  if (!notice) return;
  els.noticeBar.className = `notice ${notice.tone}`;
  els.noticeBar.textContent = notice.text;
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

function renderVersions() {
  els.versionCount.textContent = state.versions.length ? `${state.versions.length}个版本` : "";
  els.versionList.innerHTML =
    state.versions
      .map((version) => {
        const status = VERSION_STATUS[version.status];
        const adopted = version.status === "adopted";
        const actions = [];
        if (version.status === "passed") {
          actions.push(`<button type="button" data-adopt-version="${version.id}">标记采用</button>`);
        }
        if (!adopted) {
          actions.push(`<button type="button" data-load-version="${version.id}">载入续排</button>`);
        }
        actions.push(`<button type="button" data-view-version="${version.id}">查看</button>`);
        actions.push(`<button type="button" data-save-as-draft="${version.id}">另存草稿</button>`);
        return `
          <article class="version-item ${adopted ? "adopted" : ""}">
            <div class="version-head">
              <strong>${escapeHtml(version.title)}</strong>
              <span class="badge ${status.tone}">${status.label}</span>
            </div>
            <span>${version.placements.length}个落字 · ${getInkColor(version.settings.inkColor).label} · 压力${version.settings.pressure}</span>
            <span>${new Date(version.createdAt).toLocaleString("zh-CN")}${version.note ? ` · ${escapeHtml(version.note)}` : ""}</span>
            <div class="draft-actions">${actions.join("")}</div>
          </article>
        `;
      })
      .join("") || `<p class="empty">还没有试印版本。</p>`;
}

function renderAll() {
  persist();
  renderSettings();
  renderStyleFilter();
  renderInventory();
  renderStage();
  renderUsage();
  renderProof();
  renderNotice();
  renderDrafts();
  renderVersions();
}

function placeType(row, col, typeId = state.selectedTypeId) {
  if (!typeId || getViewVersion()) return; // 只读查看版本时版面不可改动
  const existingIndex = state.placements.findIndex((item) => item.row === row && item.col === col);
  if (existingIndex >= 0 && state.placements[existingIndex].typeId === typeId) {
    guardBoardEdit("试印中删字");
    state.placements.splice(existingIndex, 1);
  } else if (existingIndex >= 0) {
    guardBoardEdit("试印中换字");
    state.placements[existingIndex].typeId = typeId;
  } else {
    guardBoardEdit("试印中增字");
    state.placements.push({ row, col, typeId });
  }
  renderAll();
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
  setNotice(`草稿「${title}」已保存`);
  renderAll();
}

// 开试印：整单校验，任一不过则整次拒绝，版面不变
function startPrintRun() {
  const result = validatePrintRun({
    placements: state.placements,
    inventory: state.inventory,
    pressure: Number(state.settings.pressure),
    hasOpenProof: hasOpenProof(state)
  });
  if (!result.ok) {
    setNotice(`试印被拒绝：${result.errors.join("；")}`, "warn");
    renderAll();
    return;
  }
  const title = state.settings.workTitle.trim() || "未命名作品";
  openProof(state, { title, settings: state.settings, placements: state.placements });
  viewVersionId = null;
  setNotice(`试印开印：${getInkColor(state.settings.inkColor).label} · 压力${state.settings.pressure}`);
  renderAll();
}

function passCurrentProof() {
  const version = passProof(state);
  if (!version) return;
  viewVersionId = null;
  setNotice(`试印通过，版本「${version.title}」已记录，可标记采用`);
  renderAll();
}

function exportPreview() {
  const view = getBoardView();
  const { cols, rows } = getGrid(view.settings.paperSize);
  const ink = getInkColor(view.settings.inkColor);
  const cell = view.settings.paperSize === "bookmark" ? 44 : 56;
  const gap = view.settings.gridGap;
  const margin = 48;
  const width = cols * cell + (cols - 1) * gap + margin * 2;
  const height = rows * cell + (rows - 1) * gap + margin * 2 + 70;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = ink.hex;
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = ink.hex;
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(view.settings.workTitle || "未命名作品", margin, 50);
  ctx.font = "bold 30px serif";
  view.placements.forEach((placement) => {
    const type = state.inventory.find((item) => item.id === placement.typeId);
    if (!type) return;
    const x = margin + placement.col * (cell + gap);
    const y = margin + 45 + placement.row * (cell + gap);
    ctx.fillStyle = ink.hex;
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "#fff5df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(type.size + 8, 42)}px serif`;
    ctx.fillText(type.char, x + cell / 2, y + cell / 2);
  });
  const link = document.createElement("a");
  link.download = `${view.settings.workTitle || "movable-type"}.png`;
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

els.paperSize.addEventListener("change", () => {
  state.settings.paperSize = els.paperSize.value;
  const { cols, rows } = getGrid();
  state.placements = state.placements.filter((item) => item.row < rows && item.col < cols);
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
  persist();
});

els.inkColor.addEventListener("change", () => {
  state.settings.inkColor = els.inkColor.value;
  renderAll();
});

els.pressure.addEventListener("input", () => {
  state.settings.pressure = Number(els.pressure.value);
  renderAll();
});

els.typeForm.addEventListener("submit", addType);
els.inventorySearch.addEventListener("input", renderInventory);
els.styleFilter.addEventListener("change", renderInventory);
els.saveDraftBtn.addEventListener("click", saveDraft);
els.startProofBtn.addEventListener("click", startPrintRun);
els.passProofBtn.addEventListener("click", passCurrentProof);
els.exportBtn.addEventListener("click", exportPreview);
els.clearBoardBtn.addEventListener("click", () => {
  guardBoardEdit("试印中清空版面");
  state.placements = [];
  renderAll();
});

els.typeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) {
    const typeId = deleteButton.dataset.deleteType;
    const removedPlacements = state.placements.some((item) => item.typeId === typeId);
    if (removedPlacements) guardBoardEdit("试印中删字模");
    state.inventory = state.inventory.filter((item) => item.id !== typeId);
    state.placements = state.placements.filter((item) => item.typeId !== typeId);
    if (state.selectedTypeId === typeId) state.selectedTypeId = state.inventory[0]?.id || null;
    renderAll();
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
  event.dataTransfer.setData("text/plain", card.dataset.typeId);
});

els.stage.addEventListener("dragover", (event) => {
  if (event.target.closest(".cell")) event.preventDefault();
});

els.stage.addEventListener("drop", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || getViewVersion()) return;
  event.preventDefault();
  placeType(Number(cell.dataset.row), Number(cell.dataset.col), event.dataTransfer.getData("text/plain"));
});

els.stage.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || getViewVersion()) return;
  placeType(Number(cell.dataset.row), Number(cell.dataset.col));
});

els.draftList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-draft]");
  const deleteButton = event.target.closest("[data-delete-draft]");
  if (loadButton) {
    const draft = state.drafts.find((item) => item.id === loadButton.dataset.loadDraft);
    if (!draft) return;
    guardBoardEdit("试印中载入草稿");
    state.settings = structuredClone(draft.settings);
    state.placements = structuredClone(draft.placements);
    viewVersionId = null;
    renderAll();
  }
  if (deleteButton) {
    state.drafts = state.drafts.filter((item) => item.id !== deleteButton.dataset.deleteDraft);
    renderAll();
  }
});

els.versionList.addEventListener("click", (event) => {
  const adoptButton = event.target.closest("[data-adopt-version]");
  const loadButton = event.target.closest("[data-load-version]");
  const viewButton = event.target.closest("[data-view-version]");
  const draftButton = event.target.closest("[data-save-as-draft]");

  if (adoptButton) {
    const version = adoptVersion(state, adoptButton.dataset.adoptVersion);
    if (version) setNotice(`版本「${version.title}」已采用，转为只读`);
    renderAll();
    return;
  }
  if (loadButton) {
    const version = state.versions.find((item) => item.id === loadButton.dataset.loadVersion);
    if (!version || version.status === "adopted") return;
    guardBoardEdit("试印中载入版本");
    state.settings = structuredClone(version.settings);
    state.placements = structuredClone(version.placements);
    viewVersionId = null;
    setNotice(`已载入版本「${version.title}」继续排版`);
    renderAll();
    return;
  }
  if (viewButton) {
    viewVersionId = viewButton.dataset.viewVersion;
    renderAll();
    return;
  }
  if (draftButton) {
    const draft = saveVersionAsDraft(state, draftButton.dataset.saveAsDraft);
    if (draft) setNotice(`已另存草稿「${draft.title}」`);
    renderAll();
  }
});

els.proofBanner.addEventListener("click", (event) => {
  if (!event.target.closest("[data-exit-view]")) return;
  viewVersionId = null;
  renderAll();
});

renderAll();
