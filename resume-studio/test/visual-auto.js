"use strict";
/* 可视化走查自动动作：等 boot 完成后按 URL hash 打开对应界面。
   #cur → 投递记录·本版投递；#map → 投递记录·全部总览画布；默认 → 主界面 */
(function () {
  let n = 60;
  (function poll() {
    if (window.RS && RS.store && RS.store.get() && RS.apps) {
      RS.refreshUI();
      if (location.hash === "#cur") RS.apps.open();
      if (location.hash === "#map") {
        RS.apps.open();
        document.querySelector('[data-action="tab-all"]').click();
      }
      return;
    }
    if (--n > 0) setTimeout(poll, 100);
  })();
})();
