"use strict";
window.RS = window.RS || {};

/* 版本管理：下拉选择、另存为、重命名、删除（创建/删除经 store 同步云端或本地） */
RS.versions = (function () {
  const { esc, clone } = RS.util;
  let selectEl;

  function render() {
    const state = RS.store.get();
    selectEl.innerHTML = state.order
      .map(id => '<option value="' + id + '"' + (id === state.currentId ? " selected" : "") + ">"
        + esc(state.versions[id].name) + "</option>").join("");
  }

  function refreshAll() {
    RS.store.save();
    render();
    RS.editor.render();
    RS.preview.render();
    RS.stylePanel.sync();
    RS.apps.renderStrip();
  }

  async function actions(act) {
    const state = RS.store.get(), v = RS.store.cur();
    if (act === "save-as") {
      const name = prompt("新版本名称（建议带岗位方向）：", v.name + " · 副本");
      if (!name) return;
      state.currentId = await RS.store.newVersion({
        name, data: clone(v.data), style: clone(v.style), applications: clone(v.applications || [])
      });
    }
    else if (act === "rename-version") {
      const name = prompt("重命名版本：", v.name);
      if (name) v.name = name;
    }
    else if (act === "delete-version") {
      if (state.order.length <= 1) return alert("至少保留一个版本。");
      if (!confirm("删除版本「" + v.name + "」？此操作不可恢复。")) return;
      await RS.store.deleteVersion(state.currentId);
    }
    else return;
    refreshAll();
  }

  function init() {
    selectEl = RS.util.$("versionSelect");
    selectEl.addEventListener("change", () => {
      RS.store.get().currentId = selectEl.value;
      RS.store.save();
      RS.editor.render();
      RS.preview.render();
      RS.stylePanel.sync();
      RS.apps.renderStrip();
    });
  }

  return { render, actions, refreshAll, init };
})();
