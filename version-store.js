// 版本状态：试印单的开印、通过、作废、采用与草稿另存
"use strict";

function createVersionStore() {
  return {
    activeProof: null, // 未结试印：{ id, title, settings, placements, startedAt }
    versions: [] // 版本记录：{ id, title, status, settings, placements, createdAt, resolvedAt, note }
  };
}

function hasOpenProof(store) {
  return store.activeProof !== null;
}

// 开试印：冻结当前版面为试印快照。调用前须先过 validatePrintRun
function openProof(store, { title, settings, placements }) {
  const proof = {
    id: crypto.randomUUID(),
    title,
    settings: structuredClone(settings),
    placements: structuredClone(placements),
    startedAt: new Date().toISOString()
  };
  store.activeProof = proof;
  return proof;
}

function pushVersion(store, version) {
  store.versions.unshift(version);
  store.versions = store.versions.slice(0, PRINT_RULES.maxVersions);
}

// 试印通过：未结单转为 passed 版本，版面可继续编辑
function passProof(store) {
  const proof = store.activeProof;
  if (!proof) return null;
  const version = {
    id: proof.id,
    title: proof.title,
    status: "passed",
    settings: structuredClone(proof.settings),
    placements: structuredClone(proof.placements),
    createdAt: proof.startedAt,
    resolvedAt: new Date().toISOString(),
    note: ""
  };
  pushVersion(store, version);
  store.activeProof = null;
  return version;
}

// 作废：试印中改动版面即触发，保留冻结快照与原因
function voidProof(store, note) {
  const proof = store.activeProof;
  if (!proof) return null;
  const version = {
    id: proof.id,
    title: proof.title,
    status: "voided",
    settings: structuredClone(proof.settings),
    placements: structuredClone(proof.placements),
    createdAt: proof.startedAt,
    resolvedAt: new Date().toISOString(),
    note
  };
  pushVersion(store, version);
  store.activeProof = null;
  return version;
}

// 标记采用：passed 版本转为 adopted，此后只读
function adoptVersion(store, versionId) {
  const version = store.versions.find((item) => item.id === versionId);
  if (!version || version.status !== "passed") return null;
  version.status = "adopted";
  version.resolvedAt = new Date().toISOString();
  return version;
}

// 另存草稿：把版本快照存回草稿箱，供继续编辑
function saveVersionAsDraft(state, versionId) {
  const version = state.versions.find((item) => item.id === versionId);
  if (!version) return null;
  const draft = {
    id: crypto.randomUUID(),
    title: `${version.title} · 续排`,
    settings: structuredClone(version.settings),
    placements: structuredClone(version.placements),
    savedAt: new Date().toISOString()
  };
  state.drafts.unshift(draft);
  state.drafts = state.drafts.slice(0, 8);
  return draft;
}
