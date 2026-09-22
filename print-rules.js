// 试印规则：开印校验、缺字核对、版本文案与常量
"use strict";

const PRINT_RULES = {
  minPressure: 2,
  maxPressure: 8,
  minPlacements: 3,
  maxVersions: 24
};

const INK_COLORS = [
  { value: "pine", label: "松烟墨", hex: "#2f2921" },
  { value: "cinnabar", label: "朱砂红", hex: "#a64037" },
  { value: "indigo", label: "靛青", hex: "#365f7d" }
];

const VERSION_STATUS = {
  proofing: { label: "试印中", tone: "info" },
  passed: { label: "试印通过", tone: "ok" },
  voided: { label: "已作废", tone: "muted" },
  adopted: { label: "已采用", tone: "gold" }
};

function getInkColor(value) {
  return INK_COLORS.find((ink) => ink.value === value) || INK_COLORS[0];
}

// 统计版面落字对字模的占用：{ typeId: 使用数 }
function countUsage(placements) {
  return placements.reduce((acc, placement) => {
    acc[placement.typeId] = (acc[placement.typeId] || 0) + 1;
    return acc;
  }, {});
}

// 缺字清单：用量超过库存的字模
function findShortages(placements, inventory) {
  const usage = countUsage(placements);
  return inventory
    .filter((item) => (usage[item.id] || 0) > item.quantity)
    .map((item) => ({ type: item, used: usage[item.id], missing: usage[item.id] - item.quantity }));
}

// 开试印前整单校验；任一不过则整次拒绝，版面不变
function validatePrintRun({ placements, inventory, pressure, hasOpenProof }) {
  const errors = [];
  if (!Number.isFinite(pressure) || pressure < PRINT_RULES.minPressure || pressure > PRINT_RULES.maxPressure) {
    errors.push(`压力需在${PRINT_RULES.minPressure}–${PRINT_RULES.maxPressure}之间`);
  }
  if (placements.length < PRINT_RULES.minPlacements) {
    errors.push(`落字少于${PRINT_RULES.minPlacements}处`);
  }
  if (hasOpenProof) {
    errors.push("已有未结试印，请先通过或作废旧版");
  }
  const shortages = findShortages(placements, inventory);
  if (shortages.length) {
    const detail = shortages.map((item) => `${item.type.char}缺${item.missing}枚`).join("、");
    errors.push(`字模超量：${detail}`);
  }
  return { ok: errors.length === 0, errors, shortages };
}
