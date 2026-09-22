const Rules = (() => {
  const MIN_PRESSURE = 2;
  const MAX_PRESSURE = 8;
  const MIN_PLACEMENTS = 3;

  const PAPERS = {
    postcard: { label: "明信片", cols: 16, rows: 10 },
    bookmark: { label: "书签", cols: 7, rows: 18 },
    square: { label: "方形小笺", cols: 12, rows: 12 }
  };

  const INKS = {
    pine: { label: "松烟墨", color: "#2f2921" },
    cinnabar: { label: "朱砂", color: "#a64037" },
    indigo: { label: "靛蓝", color: "#365f7d" },
    ochre: { label: "赭石", color: "#8a5a24" }
  };

  function getGrid(paperSize) {
    return PAPERS[paperSize] ? { cols: PAPERS[paperSize].cols, rows: PAPERS[paperSize].rows } : { cols: PAPERS.postcard.cols, rows: PAPERS.postcard.rows };
  }

  // 返回各字模落字数；字模已被删除的用量归入 missing（缺字提示的依据）
  function summarizeUsage(placements, inventory) {
    const byType = placements.reduce((acc, p) => {
      acc[p.typeId] = (acc[p.typeId] || 0) + 1;
      return acc;
    }, {});
    const shortages = [];
    for (const [typeId, used] of Object.entries(byType)) {
      const item = inventory.find((t) => t.id === typeId);
      if (!item) {
        shortages.push({ typeId, char: "缺", label: "字模已删除", used, quantity: 0, missing: true });
      } else if (used > item.quantity) {
        shortages.push({ typeId, char: item.char, label: item.style, used, quantity: item.quantity, missing: false });
      }
    }
    return { byType, shortages };
  }

  // 试印整次校验：任何一项不通过都拒绝，版面不变
  function evaluateTrial({ settings, placements, inventory, hasActiveTrial }) {
    const errors = [];
    const pressure = Number(settings.pressure);
    if (!Number.isFinite(pressure) || pressure < MIN_PRESSURE || pressure > MAX_PRESSURE) {
      errors.push(`压力需在 ${MIN_PRESSURE}–${MAX_PRESSURE} 之间`);
    }
    if (placements.length < MIN_PLACEMENTS) {
      errors.push(`落字少于 ${MIN_PLACEMENTS} 处`);
    }
    const { shortages } = summarizeUsage(placements, inventory);
    if (shortages.length) {
      errors.push(
        shortages
          .map((s) => (s.missing ? `「${s.label}」${s.used}处` : `「${s.char}」用${s.used}/${s.quantity}`))
          .join("，")
      );
    }
    if (hasActiveTrial) {
      errors.push("已有未结试印");
    }
    return { ok: errors.length === 0, errors, shortages };
  }

  return {
    MIN_PRESSURE,
    MAX_PRESSURE,
    MIN_PLACEMENTS,
    PAPERS,
    INKS,
    getGrid,
    summarizeUsage,
    evaluateTrial
  };
})();
