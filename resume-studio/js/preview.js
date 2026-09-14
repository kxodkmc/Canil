"use strict";
window.RS = window.RS || {};

/* 右侧 A4 预览：渲染 + 页数估算 + 缩放 + 自动适配 1 页 + 所见即所得编辑 */
RS.preview = (function () {
  const MM_PX = 96 / 25.4;
  const PAGE_H_PX = 297 * MM_PX;

  /* 自动收缩下限与排版面板滑杆下限一致，保证自动结果手动可复现 */
  const FIT_BASE  = { font: 13.5, line: 1.5, secGap: 10, itemGap: 7, pad: 12 };
  const FIT_MIN   = { font: 11.5, line: 1.25, secGap: 4, itemGap: 2, pad: 7 };
  const FIT_STEPS = [["secGap", 1], ["itemGap", 1], ["line", 0.05], ["font", 0.25], ["pad", 0.5]];

  let pageEl, resumeEl, badgeEl, scalerBox, badgeTimer;

  function applyLayoutVars(s) {
    resumeEl.style.setProperty("--rs-font", s.font + "px");
    resumeEl.style.setProperty("--rs-lh", s.line);
    resumeEl.style.setProperty("--rs-sec-gap", s.secGap + "px");
    resumeEl.style.setProperty("--rs-item-gap", s.itemGap + "px");
    resumeEl.style.setProperty("--rs-pad", s.pad + "mm");
  }

  /* 内容变化后自动逼近 1 页：按视觉影响从小到大逐级收缩。
     每轮必须先无进展立刻退出，绝不做无收益的强制重排（重排在长文档上极慢，
     曾导致输入/拖拽后主线程被连续测量卡死）。 */
  function autoFitLayout() {
    const st = RS.store.cur().style;
    const s = Object.assign({}, FIT_BASE);
    applyLayoutVars(s);
    const overflow = () => resumeEl.offsetHeight - PAGE_H_PX;
    if (overflow() <= 0) {
      /* 未超页：回到舒适默认值（避免残留上次收缩值） */
      if (FIT_STEPS.some(([k]) => st[k] !== s[k])) { Object.assign(st, s); RS.stylePanel.sync(); RS.store.save(); }
      return;
    }
    let guard = 60;                       // 实际收敛远用不满 60 轮
    let last = Infinity;
    while (guard-- > 0) {
      const ov = overflow();
      if (ov <= 0) break;
      if (ov >= last - 0.5) break;        // 这一步没换来高度下降 = 无收益，立即停
      last = ov;
      let moved = false;
      for (const [k, d] of FIT_STEPS) {
        const next = Math.round((s[k] - d) * 100) / 100;
        if (next >= FIT_MIN[k]) { s[k] = next; applyLayoutVars(s); moved = true; break; }
      }
      if (!moved) break;                  /* 已到下限仍放不下 = 内容确实超过 1 页，交给页数徽标提示 */
    }
    Object.assign(st, s);
    RS.stylePanel.sync();
  }

  /* 预览缩放适配面板宽度 */
  function fitPreview() {
    const wrap = RS.util.$("previewWrap");
    const pageW = 210 * MM_PX;
    const scale = Math.min(1, (wrap.clientWidth - 40) / pageW);
    pageEl.style.transform = "scale(" + scale + ")";
    scalerBox.style.width = pageW * scale + "px";
    scalerBox.style.height = pageEl.offsetHeight * scale + "px";
  }

  /* 页数估算（打字时也可安全调用，不重建 DOM、不丢光标） */
  function updatePageMeta() {
    const st = RS.store.cur().style;
    if (st.autoFit !== false) autoFitLayout();
    /* 量简历内容的实际高度；pageEl.scrollHeight 会把 1.5 页边界虚线也算进去，不能用 */
    const pages = resumeEl.offsetHeight / PAGE_H_PX;
    badgeEl.textContent = "约 " + (Math.round(pages * 10) / 10) + " 页";
    badgeEl.className = pages <= 1 ? "ok" : (pages <= 1.5 ? "warn" : "bad");
    fitPreview();
  }

  /* 页数/缩放测量合并调度：打字与拖拽的高频路径下，最多 120ms 做一次测量+自适应 */
  let metaTimer;
  function schedulePageMeta() {
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => requestAnimationFrame(updatePageMeta), 120);
  }

  function render() {
    const d = RS.store.cur().data, st = RS.store.cur().style;

    /* 模板：banner=商务蓝横幅（t2 类驱动 resume-t2.css）；minimal=极简留白（t3）；
       classic 走默认样式 */
    const isT2 = st.template === "banner";
    const isT3 = st.template === "minimal";
    resumeEl.classList.toggle("t2", isT2);
    resumeEl.classList.toggle("t3", isT3);

    /* 排版变量 */
    resumeEl.style.setProperty("--rs-font", st.font + "px");
    resumeEl.style.setProperty("--rs-lh", st.line);
    resumeEl.style.setProperty("--rs-sec-gap", st.secGap + "px");
    resumeEl.style.setProperty("--rs-item-gap", st.itemGap + "px");
    resumeEl.style.setProperty("--rs-pad", st.pad + "mm");
    resumeEl.style.setProperty("--rs-accent", st.color);

    /* 个人信息：姓名 + 动态字段，双列网格 + 右侧照片（无照片不占位） */
    const { esc, escRich } = RS.util;
    const cells = [{ id: "__name", label: "姓名", value: d.profile.name }].concat(d.profile.fields)
      .filter(f => (f.value || "").trim() !== "" || f.id === "__name")
      .map(f => '<div class="cell"><span class="lb">' + esc(f.label) + '：</span>'
        + '<span contenteditable="true" spellcheck="false" data-pf="' + f.id + '">' + escRich(f.value) + '</span></div>')
      .join("");
    const photoHtml = d.profile.photo
      ? '<div class="rs-photo"><img src="' + d.profile.photo + '" alt="证件照"></div>'
      : "";

    let h = "";
    /* t2：基本信息标题条 */
    if (isT2)
      h += '<div class="rs-sec-head t2-profile-head"><span class="rs-title">基本信息</span><span class="rs-rule"></span></div>';
    h += '<div class="rs-profile"><div class="rs-grid">' + cells + '</div>' + photoHtml + '</div>';

    /* 内容模块 */
    d.sections.filter(s => s.visible).forEach(sec => {
      h += '<div class="rs-sec"><div class="rs-sec-head">'
        +    '<span class="rs-ico">' + RS.icons.iconFor(sec.title) + '</span>'
        +    '<span class="rs-title" contenteditable="true" spellcheck="false" data-stitle="' + sec.id + '">' + esc(sec.title) + '</span><span class="rs-rule"></span>'
        +  '</div>';
      sec.items.forEach(it => {
        h += '<div class="rs-item">';
        if (it.date || it.title || it.role) {
          h += '<div class="rs-item-line">'
            +    '<span class="d" contenteditable="true" spellcheck="false" data-ie="date" data-sid="' + sec.id + '" data-iid="' + it.id + '">' + escRich(it.date) + '</span>'
            +    '<span class="t" contenteditable="true" spellcheck="false" data-ie="title" data-sid="' + sec.id + '" data-iid="' + it.id + '">' + escRich(it.title) + '</span>'
            +    '<span class="r" contenteditable="true" spellcheck="false" data-ie="role" data-sid="' + sec.id + '" data-iid="' + it.id + '">' + escRich(it.role) + '</span>'
            +  '</div>';
        }
        if ((it.link || "").trim())
          h += '<div class="rs-link" contenteditable="true" spellcheck="false" data-ie="link" data-sid="' + sec.id + '" data-iid="' + it.id + '">' + escRich(it.link) + '</div>';
        if ((it.desc || "").trim())
          h += '<p class="rs-desc" contenteditable="true" spellcheck="false" data-ie="desc" data-sid="' + sec.id + '" data-iid="' + it.id + '">' + escRich(it.desc) + '</p>';
        const bs = it.bullets.map(b => b.trim()).filter(Boolean);
        if (bs.length) {
          h += '<ul class="rs-bullets" contenteditable="true" spellcheck="false" data-bul="1" data-sid="' + sec.id + '" data-iid="' + it.id + '">'
            +  bs.map(b => "<li>" + escRich(b) + "</li>").join("") + "</ul>";
        }
        h += "</div>";
      });
      h += "</div>";
    });
    resumeEl.innerHTML = h;

    /* 页数边界线（1 页 / 1.5 页） */
    pageEl.querySelectorAll(".page-mark").forEach(m => m.remove());
    if (st.showMarks) {
      [[1, "1 页边界"], [1.5, "1.5 页边界"]].forEach(([n, label]) => {
        const m = document.createElement("div");
        m.className = "page-mark";
        m.style.top = (PAGE_H_PX * n) + "px";
        m.innerHTML = "<span>" + label + "</span>";
        pageEl.appendChild(m);
      });
    }

    schedulePageMeta();
  }

  /* 预览区所见即所得：写回数据（经 sanitizeRich 清洗，仅保留 b/i/u 行内标签） */
  function writeBack(t) {
    const d = RS.store.cur().data;
    if (t.dataset.pf !== undefined) {
      if (t.dataset.pf === "__name") d.profile.name = RS.util.sanitizeRich(t.innerHTML);
      else { const f = d.profile.fields.find(x => x.id === t.dataset.pf); if (f) f.value = RS.util.sanitizeRich(t.innerHTML); }
    }
    else if (t.dataset.stitle) { const s = RS.store.findSec(t.dataset.stitle); if (s) { const v = RS.util.sanitizeRich(t.innerHTML); if (v.trim()) s.title = v.trim(); } }
    else if (t.dataset.ie) { const it = RS.store.findItem(t.dataset.sid, t.dataset.iid); if (it) it[t.dataset.ie] = RS.util.sanitizeRich(t.innerHTML); }
    else if (t.dataset.bul !== undefined) {
      const it = RS.store.findItem(t.dataset.sid, t.dataset.iid);
      if (it) it.bullets = Array.from(t.querySelectorAll("li")).map(li => RS.util.sanitizeRich(li.innerHTML));
    }
  }

  function onInput(e) {
    const t = e.target.closest("[contenteditable]");
    if (!t) return;
    writeBack(t);
    RS.store.save();
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(updatePageMeta, 250);
  }

  /* 单行字段回车 = 完成（不换行）；要点列表内回车 = 新增一条要点 */
  function onKeyDown(e) {
    if (e.key !== "Enter") return;
    const t = e.target.closest("[contenteditable]");
    if (t && t.dataset.bul === undefined) { e.preventDefault(); t.blur(); }
  }

  /* 粘贴一律转为纯文本，外部格式永远进不来 */
  function onPaste(e) {
    if (!e.target.closest("[contenteditable]")) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  /* ---------- 选中文本快捷菜单（滑选预览内文字时浮现，目前仅加粗） ---------- */
  let menuEl;

  function hideSelMenu() { menuEl.classList.remove("open"); }

  function syncSelMenu() {
    const sel = document.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return hideSelMenu();
    const node = sel.anchorNode;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !el.closest("#resume [contenteditable]")) return hideSelMenu();
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) return hideSelMenu();
    menuEl.classList.add("open");
    const mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
    let x = r.left + r.width / 2 - mw / 2;
    let y = r.top - mh - 6;
    if (y < 6) y = r.bottom + 6;                       // 选区贴顶时改为下方弹出
    menuEl.style.left = Math.max(6, Math.min(x, window.innerWidth - mw - 6)) + "px";
    menuEl.style.top = y + "px";
  }

  function initSelMenu() {
    menuEl = document.createElement("div");
    menuEl.id = "selMenu";
    menuEl.innerHTML = '<button type="button" data-cmd="bold" title="加粗选中文字"><b>B</b></button>';
    document.body.appendChild(menuEl);
    /* mousedown 阻止默认聚焦，保证点击按钮时选区不塌陷 */
    menuEl.addEventListener("mousedown", e => e.preventDefault());
    menuEl.addEventListener("click", e => {
      const btn = e.target.closest("button[data-cmd]");
      if (!btn) return;
      document.execCommand(btn.dataset.cmd, false, null);   // 触发 input → writeBack 富文本写回
      hideSelMenu();
    });
    /* selectionchange 高频触发，合并到每帧最多测量一次 */
    let selRAF = 0;
    document.addEventListener("selectionchange", () => {
      if (selRAF) return;
      selRAF = requestAnimationFrame(() => { selRAF = 0; syncSelMenu(); });
    });
    window.addEventListener("resize", hideSelMenu);
    pageEl.addEventListener("scroll", hideSelMenu, true);
  }

  function init() {
    pageEl = RS.util.$("page");
    resumeEl = RS.util.$("resume");
    badgeEl = RS.util.$("pageBadge");
    scalerBox = RS.util.$("scalerBox");

    resumeEl.addEventListener("input", onInput);
    resumeEl.addEventListener("keydown", onKeyDown);
    resumeEl.addEventListener("paste", onPaste);
    /* 从编辑器拖拽条目误放到简历上时，禁止浏览器把拖拽内容当文本插入简历 */
    resumeEl.addEventListener("drop", e => e.preventDefault());
    initSelMenu();

    /* 打印前重置缩放，保证 PDF 为真实 A4 尺寸 */
    window.addEventListener("beforeprint", () => { pageEl.style.transform = "none"; });
    window.addEventListener("afterprint", fitPreview);
    window.addEventListener("resize", fitPreview);
  }

  return { render, updatePageMeta, fitPreview, init };
})();
