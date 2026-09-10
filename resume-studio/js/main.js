"use strict";
window.RS = window.RS || {};

/* 入口：先恢复会话（云端/本地），再装配各模块。refreshUI 供 store/auth 在外部变更后全量刷新。 */
RS.refreshUI = function () {
  RS.versions.render();
  RS.editor.render();
  RS.preview.render();
  RS.stylePanel.sync();
};

(async function boot() {
  RS.auth.init();
  await RS.store.init();
  RS.versions.init();
  RS.editor.init();
  RS.preview.init();
  RS.stylePanel.init();
  RS.apps.init();
  RS.io.init();
  RS.ai.init();
  RS.toolbar.init();
  RS.resizer.init();
  RS.refreshUI();
  RS.auth.ready();
})();
