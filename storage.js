const Storage = (() => {
  const KEY = "zfl16-movable-type-workshop";

  function load(fallback) {
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== "object") return structuredClone(fallback);
    return {
      ...structuredClone(fallback),
      ...parsed,
      settings: { ...fallback.settings, ...(parsed.settings || {}) },
      versions: Array.isArray(parsed.versions) ? parsed.versions : fallback.versions,
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : fallback.drafts,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : fallback.inventory,
      placements: Array.isArray(parsed.placements) ? parsed.placements : fallback.placements
    };
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // 隐私模式或配额受限时静默失败，不影响当次使用
    }
  }

  return { KEY, load, save };
})();
