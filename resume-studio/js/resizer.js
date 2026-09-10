"use strict";
window.RS = window.RS || {};

/* 编辑面板宽度拖拽（宽度记忆在 localStorage） */
RS.resizer = (function () {
  const LS_UI = "resume-studio-ui-v1";

  function init() {
    const editorEl = RS.util.$("editor");
    const resizer = RS.util.$("resizer");

    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "{}");
      if (ui.editorWidth >= 320) {
        editorEl.style.width = ui.editorWidth + "px";
        editorEl.style.flex = "0 0 " + ui.editorWidth + "px";
      }
    } catch (_) {}

    resizer.addEventListener("mousedown", e => {
      e.preventDefault();
      resizer.classList.add("active");
      document.body.style.userSelect = "none";
      const startX = e.clientX, startW = editorEl.offsetWidth;
      const mv = ev => {
        const w = Math.min(720, Math.max(320, startW + ev.clientX - startX));
        editorEl.style.width = w + "px";
        editorEl.style.flex = "0 0 " + w + "px";
        RS.preview.fitPreview();
      };
      const up = () => {
        resizer.classList.remove("active");
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", mv);
        window.removeEventListener("mouseup", up);
        try { localStorage.setItem(LS_UI, JSON.stringify({ editorWidth: editorEl.offsetWidth })); } catch (_) {}
        RS.preview.fitPreview();
      };
      window.addEventListener("mousemove", mv);
      window.addEventListener("mouseup", up);
    });
  }

  return { init };
})();
