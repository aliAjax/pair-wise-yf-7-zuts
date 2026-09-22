const Versions = (() => {
  const STATUS = {
    TRIAL: "trial", // 试印中，版面冻结；继续编辑即作废
    VOID: "void", // 已作废，保留冻结快照只读
    ADOPTED: "adopted" // 已采用，只读
  };

  const MODE = {
    DRAFT: "draft",
    TRIAL: "trial",
    ADOPTED: "adopted"
  };

  function activeTrial(state) {
    return state.versions.find((v) => v.status === STATUS.TRIAL) || null;
  }

  function adoptedVersion(state) {
    return state.versions.find((v) => v.id === state.activeVersionId && v.status === STATUS.ADOPTED) || null;
  }

  // 当前版面处于什么模式：试印冻结 / 已采用只读 / 草稿可编辑
  function currentMode(state) {
    const trial = activeTrial(state);
    if (trial) return { mode: MODE.TRIAL, version: trial };
    const adopted = adoptedVersion(state);
    if (adopted) return { mode: MODE.ADOPTED, version: adopted };
    return { mode: MODE.DRAFT, version: null };
  }

  function startTrial(state, shortageSummary) {
    const version = {
      id: crypto.randomUUID(),
      kind: "trial",
      title: (state.settings.workTitle || "").trim() || "未命名作品",
      number: state.versions.length + 1,
      status: STATUS.TRIAL,
      settings: structuredClone(state.settings),
      placements: structuredClone(state.placements),
      shortages: structuredClone(shortageSummary || []),
      startedAt: new Date().toISOString(),
      closedAt: null
    };
    state.versions.unshift(version);
    state.activeVersionId = version.id;
    return version;
  }

  // 试印期间发生增删、移动或换字：本次作废，冻结快照保留
  function voidActive(state, reason) {
    const trial = activeTrial(state);
    if (!trial) return null;
    trial.status = STATUS.VOID;
    trial.closedAt = new Date().toISOString();
    trial.voidReason = reason || "版面被修改";
    state.activeVersionId = null;
    return trial;
  }

  function adoptActive(state) {
    const trial = activeTrial(state);
    if (!trial) return null;
    trial.status = STATUS.ADOPTED;
    trial.closedAt = new Date().toISOString();
    state.activeVersionId = trial.id;
    return trial;
  }

  // 采用版本只读，继续编辑须另存为草稿：版面复制为草稿，版本记录不动
  function forkDraft(state) {
    state.activeVersionId = null;
  }

  return { STATUS, MODE, activeTrial, adoptedVersion, currentMode, startTrial, voidActive, adoptActive, forkDraft };
})();
