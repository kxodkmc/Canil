"use strict";
window.RS = window.RS || {};

/* 排版控制面板：滑杆同步与事件（手动微调即退出自动模式） */
RS.stylePanel = (function () {
  const $ = RS.util.$;
  const SLIDERS = [
    ["stFont", "font", "stFontV", v => v + "px"],
    ["stLine", "line", "stLineV", v => v],
    ["stSec",  "secGap", "stSecV", v => v + "px"],
    ["stItem", "itemGap", "stItemV", v => v + "px"],
    ["stPad",  "pad", "stPadV", v => v + "mm"]
  ];

  /* 两套模板各自的默认主题色/页边距：切换时若当前值是另一套的默认，则成对互换 */
  const TPL_DEF = {
    classic: { color: "#2b4c7e", pad: 12 },
    banner:  { color: "#2272b8", pad: 9 }
  };

  function sync() {
    const st = RS.store.cur().style;
    SLIDERS.forEach(([id, key, outId, fmt]) => {
      $(id).value = st[key];
      $(outId).textContent = fmt(st[key]);
    });
    $("stColor").value = st.color;
    $("stAuto").checked = st.autoFit !== false;
    $("stMarks").checked = st.showMarks;
    const tpl = st.template === "banner" ? "banner" : "classic";
    $("stTpl").value = tpl;
  }

  function toggle() {
    $("stylePanel").classList.toggle("open");
  }

  function init() {
    SLIDERS.forEach(([id, key, outId, fmt]) => {
      $(id).addEventListener("input", e => {
        const st = RS.store.cur().style;
        if (st.autoFit !== false) { st.autoFit = false; $("stAuto").checked = false; }
        st[key] = parseFloat(e.target.value);
        $(outId).textContent = fmt(st[key]);
        RS.store.save();
        RS.preview.render();
      });
    });
    $("stAuto").addEventListener("change", e => {
      RS.store.cur().style.autoFit = e.target.checked;
      RS.store.save(); RS.preview.render();
    });
    $("stColor").addEventListener("input", e => {
      RS.store.cur().style.color = e.target.value;
      RS.store.save(); RS.preview.render();
    });
    $("stMarks").addEventListener("change", e => {
      RS.store.cur().style.showMarks = e.target.checked;
      RS.store.save(); RS.preview.render();
    });
    $("stTpl").addEventListener("change", e => {
      const st = RS.store.cur().style;
      const next = e.target.value === "banner" ? "banner" : "classic";
      const other = next === "banner" ? "classic" : "banner";
      /* 主题色/页边距仍是对方默认值时，自动换成新模板的默认，保证开箱即像素级还原 */
      if ((st.color || "").toLowerCase() === TPL_DEF[other].color) { st.color = TPL_DEF[next].color; $("stColor").value = st.color; }
      if (st.pad === TPL_DEF[other].pad) { st.pad = TPL_DEF[next].pad; $("stPad").value = st.pad; $("stPadV").textContent = st.pad + "mm"; }
      st.template = next;
      RS.store.save(); RS.preview.render(); RS.stylePanel.sync();
    });
  }

  return { sync, toggle, init };
})();
