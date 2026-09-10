"use strict";
window.RS = window.RS || {};

/* 顶部工具栏：唯一的 data-action 分发中心 */
RS.toolbar = (function () {
  const $ = RS.util.$;

  function toggleEditor(btn) {
    const ed = $("editor");
    const hidden = ed.style.display === "none";
    ed.style.display = hidden ? "" : "none";
    $("resizer").style.display = hidden ? "" : "none";
    btn.textContent = hidden ? "收起面板" : "展开面板";
    RS.preview.fitPreview();
  }

  function onClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const act = btn.dataset.action;
    if (["save-as", "rename-version", "delete-version"].includes(act)) return RS.versions.actions(act);
    if (act === "toggle-style") RS.stylePanel.toggle();
    if (act === "toggle-editor") toggleEditor(btn);
    if (act === "open-apps") RS.apps.open();
    if (act === "export-json") RS.io.exportJSON();
    if (act === "import-json") $("importFile").click();
    if (act === "copy-prompt") RS.ai.copyPrompt();
    if (act === "import-html") RS.ai.openImport();
    if (act === "print") window.print();
  }

  function init() {
    $("toolbar").addEventListener("click", onClick);
  }

  return { init };
})();
