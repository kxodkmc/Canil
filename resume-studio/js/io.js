"use strict";
window.RS = window.RS || {};

/* JSON 备份导入导出 */
RS.io = (function () {

  function exportJSON() {
    const blob = new Blob([JSON.stringify(RS.store.get(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "简历备份-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onImportFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s.versions || !s.order) throw new Error("bad shape");
        const state = RS.store.get();
        let n = 0, lastId = null;
        for (const id of s.order) {
          const v = s.versions[id];
          if (v && v.data && v.data.profile) {
            lastId = await RS.store.newVersion({
              name: v.name || "导入版本",
              data: v.data,
              style: Object.assign(RS.model.defaultStyle(), v.style),
              applications: v.applications || []
            });
            n++;
          }
        }
        if (!n) throw new Error("no valid version");
        state.currentId = lastId;
        RS.versions.refreshAll();
        alert("成功导入 " + n + " 个版本。");
      } catch (err) { alert("导入失败：文件不是有效的简历备份。"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function init() {
    RS.util.$("importFile").addEventListener("change", onImportFile);
  }

  return { exportJSON, init };
})();
