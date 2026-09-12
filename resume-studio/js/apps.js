"use strict";
window.RS = window.RS || {};

/* 投递记录：挂在当前简历版本上，随版本保存/复制/导出。
   双 Tab：「本版投递」编辑当前版本的记录；「全部投递总览」为思维导图式画布
   （根节点 → 岗位节点 → 简历版本节点），支持拖拽平移与滚轮缩放。
   另负责预览页顶部的「本版投递速览条」（#appsStrip，屏幕可见、打印隐藏）。 */
RS.apps = (function () {
  const { uid, esc } = RS.util;
  let maskEl, panelEl, bodyEl, subEl, addBtn, stripEl, filterEl, filterListEl;
  let tab = "cur"; // cur=本版投递 | all=全部投递总览
  let companyFilter = ""; // 公司名筛选（不区分大小写的包含匹配）

  /* 旧版本数据没有 applications 字段，补默认值 */
  function getApps() {
    const v = RS.store.cur();
    if (!Array.isArray(v.applications)) v.applications = [];
    return v.applications;
  }

  /* 公司名筛选：不区分大小写的包含匹配；空串放行全部 */
  function matchCompany(a) {
    if (!companyFilter) return true;
    return String(a.company || "").toLowerCase().includes(companyFilter.toLowerCase());
  }

  /* 收集候选公司名（全部版本去重），用于筛选框的 datalist 建议 */
  function companyOptions() {
    const set = {};
    const state = RS.store.get();
    state.order.forEach(vid => {
      (Array.isArray(state.versions[vid].applications) ? state.versions[vid].applications : [])
        .forEach(a => { const c = (a.company || "").trim(); if (c) set[c] = 1; });
    });
    return Object.keys(set).sort();
  }

  /* ---------- 本版投递（卡片式编辑列表） ---------- */
  function renderCur() {
    const apps = getApps().filter(matchCompany);
    subEl.textContent = "记录「" + RS.store.cur().name + "」投递的岗位";
    if (!apps.length) {
      bodyEl.innerHTML = '<div class="ap-empty">'
        + '<div class="ap-empty-ico">🗂️</div>'
        + '<div>' + (companyFilter ? "没有公司名含「" + esc(companyFilter) + "」的投递记录" : "还没有投递记录") + '</div>'
        + '<div class="ap-empty-sub">' + (companyFilter ? "换个关键词，或清空筛选条件试试。" : "点下方「＋ 添加一条投递」，记下公司、岗位和招聘页网址，方便之后复盘。") + '</div>'
        + '</div>';
      return;
    }
    bodyEl.innerHTML = apps.map(a =>
      '<div class="ap-item" data-aid="' + a.id + '">'
      +  '<div class="ap-item-head">'
      +    '<span class="ap-item-dot"></span>'
      +    '<input class="ap-job-input" data-field="job" value="' + esc(a.job) + '" placeholder="岗位名称，如：产品经理实习生">'
      +    '<button class="icon-btn ap-del" data-action="del-app" data-aid="' + a.id + '" title="删除这条记录">✕</button>'
      +  '</div>'
      +  '<div class="ap-grid">'
      +    '<label class="ap-f"><span>投递日期</span><input type="date" data-field="date" value="' + esc(a.date || "") + '"></label>'
      +    '<label class="ap-f"><span>公司名称</span><input data-field="company" value="' + esc(a.company || "") + '" placeholder="如：腾讯（可按公司筛选）"></label>'
      +    '<label class="ap-f"><span>岗位链接</span><input class="ap-url" data-field="url" value="' + esc(a.url) + '" placeholder="招聘页网址，可留空"></label>'
      +    '<label class="ap-f"><span>公司招聘链接</span><input class="ap-url" data-field="companyUrl" value="' + esc(a.companyUrl || "") + '" placeholder="公司招聘官网，可留空"></label>'
      +    '<label class="ap-f ap-f-full"><span>备注</span><input data-field="note" value="' + esc(a.note || "") + '" placeholder="进展 / 内推人 / 渠道等（可选）"></label>'
      +  '</div>'
      +  ((a.url || a.companyUrl) ? '<div class="ap-meta">'
      +    (a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">🔗 打开招聘页</a>' : "")
      +    (a.companyUrl ? '<a href="' + esc(a.companyUrl) + '" target="_blank" rel="noopener">🏢 打开公司招聘页</a>' : "")
      +  '</div>' : "")
      + '</div>').join("");
  }

  /* ---------- 全部投递总览（跨版本汇总） ---------- */
  function collectAll() {
    const state = RS.store.get();
    const rows = [];
    state.order.forEach(vid => {
      const v = state.versions[vid];
      (Array.isArray(v.applications) ? v.applications : []).forEach(a =>
        rows.push({ id: a.id, job: a.job || "", url: a.url || "", date: a.date || "", note: a.note || "", company: a.company || "", companyUrl: a.companyUrl || "", vid, vname: v.name }));
    });
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return rows;
  }

  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- 思维导图画布 ---------- */
  const MAP = { rootX: 24, jobX: 250, verX: 620, rootW: 160, jobW: 300, verW: 240, top: 32, jobGap: 16, verGap: 14, jobH: 62, jobHN: 80, verH: 56 };
  let view = null;   // { vp, world, svg, tx, ty, s, dragging, moved }

  function layoutMap(rows) {
    /* 岗位节点：按日期倒序纵向排列；高度随公司行/备注行动态增加 */
    let y = MAP.top;
    const jobs = rows.map(r => {
      const h = MAP.jobH + (r.company ? 17 : 0) + (r.note ? MAP.jobHN - MAP.jobH : 0);
      const n = { r, x: MAP.jobX, y, w: MAP.jobW, h };
      y += h + MAP.jobGap;
      return n;
    });
    /* 版本节点：按所连岗位的平均高度排序，减少连线交叉 */
    const byVid = {};
    jobs.forEach((n, i) => {
      (byVid[n.r.vid] = byVid[n.r.vid] || { vid: n.r.vid, vname: n.r.vname, idxs: [], urls: 0 }).idxs.push(i);
    });
    const vers = Object.values(byVid).map(v => {
      const mean = v.idxs.reduce((s, i) => s + jobs[i].y + jobs[i].h / 2, 0) / v.idxs.length;
      return { vid: v.vid, vname: v.vname, count: v.idxs.length, mean };
    }).sort((a, b) => a.mean - b.mean);
    let vy = MAP.top;
    vers.forEach(v => {
      v.x = MAP.verX; v.w = MAP.verW; v.h = MAP.verH;
      v.y = Math.max(vy, v.mean - v.h / 2);
      vy = v.y + v.h + MAP.verGap;
    });
    const jobsBottom = jobs.length ? jobs[jobs.length - 1].y + jobs[jobs.length - 1].h : MAP.top;
    const versBottom = vers.length ? vers[vers.length - 1].y + vers[vers.length - 1].h : MAP.top;
    const rootH = 96;
    const root = { x: MAP.rootX, y: Math.max(MAP.top, (jobsBottom + MAP.top) / 2 - rootH / 2), w: MAP.rootW, h: rootH };
    return { root, jobs, vers, w: MAP.verX + MAP.verW + 40, h: Math.max(jobsBottom, versBottom, root.y + rootH) + 32 };
  }

  function edge(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    return "M" + x1 + " " + y1 + " C" + mx + " " + y1 + "," + mx + " " + y2 + "," + x2 + " " + y2;
  }

  function renderAll() {
    subEl.textContent = "全部版本投递一览：岗位 → 简历版本；点版本节点可直接跳转";
    const all = collectAll();
    const rows = all.filter(matchCompany);
    if (!all.length) {
      bodyEl.innerHTML = '<div class="ap-empty">'
        + '<div class="ap-empty-ico">🗺️</div>'
        + '<div>所有版本都还没有投递记录</div>'
        + '<div class="ap-empty-sub">回到「本版投递」添加第一条，这里会自动生成投递地图。</div>'
        + '</div>';
      return;
    }
    if (!rows.length) {
      bodyEl.innerHTML = '<div class="ap-empty">'
        + '<div class="ap-empty-ico">🔍</div>'
        + '<div>没有公司名含「' + esc(companyFilter) + '」的投递记录</div>'
        + '<div class="ap-empty-sub">换个关键词，或清空筛选条件试试。</div>'
        + '</div>';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const in7 = rows.filter(r => r.date && r.date >= daysAgoISO(7) && r.date <= today).length;
    const in30 = rows.filter(r => r.date && r.date >= daysAgoISO(30) && r.date <= today).length;
    const companies = new Set(rows.map(r => r.company).filter(Boolean));
    const stat = '<div class="ap-stat"><span>共 <b>' + rows.length + '</b> 条投递</span>'
      + '<span>最近 7 天 <b>' + in7 + '</b> 条</span>'
      + '<span>最近 30 天 <b>' + in30 + '</b> 条</span>'
      + '<span>涉及 <b>' + new Set(rows.map(r => r.vid)).size + '</b> 个简历版本</span>'
      + '<span><b>' + companies.size + '</b> 家公司</span>'
      + (companyFilter ? '<span class="ap-filter-on">筛选：公司名含「' + esc(companyFilter) + '」</span>' : "")
      + '</div>';

    const L = layoutMap(rows);
    const paths = [];
    L.jobs.forEach(n => {
      paths.push('<path class="map-e map-e-root" data-aid="' + n.r.id + '" d="'
        + edge(L.root.x + L.root.w, L.root.y + L.root.h / 2, n.x, n.y + n.h / 2) + '"/>');
      const v = L.vers.find(v => v.vid === n.r.vid);
      if (v) paths.push('<path class="map-e map-e-ver" data-aid="' + n.r.id + '" data-vid="' + v.vid + '" d="'
        + edge(n.x + n.w, n.y + n.h / 2, v.x, v.y + v.h / 2) + '"/>');
    });

    const rootNode = '<div class="map-node map-root" style="left:' + L.root.x + 'px;top:' + L.root.y + 'px;width:' + L.root.w + 'px;height:' + L.root.h + 'px">'
      + '<div class="map-root-ico">🧭</div><div class="map-root-t">投递总览</div>'
      + '<div class="map-root-n">' + rows.length + ' 条记录</div></div>';

    const jobNodes = L.jobs.map(n =>
      '<div class="map-node map-job" data-aid="' + n.r.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.w + 'px;height:' + n.h + 'px">'
      + '<div class="map-job-date">' + esc(n.r.date || "未填日期") + '</div>'
      + '<div class="map-job-name">' + (esc(n.r.job) || '<span class="ap-empty-inline">（未填岗位）</span>')
      +   (n.r.url ? '<a class="map-job-link" href="' + esc(n.r.url) + '" target="_blank" rel="noopener" title="打开招聘页" data-aid="' + n.r.id + '">🔗</a>' : "")
      + '</div>'
      + (n.r.company ? '<div class="map-job-co">🏢 '
      +   (n.r.companyUrl ? '<a href="' + esc(n.r.companyUrl) + '" target="_blank" rel="noopener" title="打开公司招聘页">' + esc(n.r.company) + '</a>' : esc(n.r.company))
      + '</div>' : "")
      + (n.r.note ? '<div class="map-job-note">' + esc(n.r.note) + '</div>' : "")
      + '</div>').join("");

    const verNodes = L.vers.map(v =>
      '<div class="map-node map-ver" data-action="go-version" data-vid="' + v.vid + '" title="切换到这个简历版本" '
      + 'style="left:' + v.x + 'px;top:' + v.y + 'px;width:' + v.w + 'px;height:' + v.h + 'px">'
      + '<div class="map-ver-name">📄 ' + esc(v.vname) + '</div>'
      + '<div class="map-ver-n">' + v.count + ' 条投递 · 点击跳转</div>'
      + '</div>').join("");

    bodyEl.innerHTML = stat
      + '<div class="map-wrap">'
      +  '<div class="map-toolbar">'
      +    '<button class="btn small" data-action="map-reset">复位视图</button>'
      +    '<span class="map-hint">拖拽空白处平移 · 滚轮缩放 · 悬停高亮连线</span>'
      +  '</div>'
      +  '<div class="map-viewport" id="mapVp">'
      +    '<div class="map-world" id="mapWorld" style="width:' + L.w + 'px;height:' + L.h + 'px">'
      +      '<svg class="map-edges" width="' + L.w + '" height="' + L.h + '">' + paths.join("") + '</svg>'
      +      rootNode + jobNodes + verNodes
      +    '</div>'
      +  '</div>'
      + '</div>';
    initView(L);
  }

  /* 画布视口：平移 / 缩放 / 复位 */
  function applyView() {
    view.world.style.transform = "translate(" + view.tx + "px," + view.ty + "px) scale(" + view.s + ")";
  }

  function fitView() {
    const vw = view.vp.clientWidth, vh = view.vp.clientHeight;
    if (!vw || !vh) { view.tx = 16; view.ty = 12; view.s = 1; return applyView(); }
    view.s = Math.min(1, (vw - 32) / view.L.w, (vh - 24) / view.L.h);
    view.tx = Math.max(16, (vw - view.L.w * view.s) / 2);
    view.ty = Math.max(12, (vh - view.L.h * view.s) / 2);
    applyView();
  }

  function initView(L) {
    const vp = RS.util.$("mapVp");
    view = { vp, world: RS.util.$("mapWorld"), L, tx: 0, ty: 0, s: 1, drag: null, moved: false };
    fitView();

    vp.addEventListener("pointerdown", e => {
      if (e.target.closest("a")) return;             // 链接直接放行
      view.drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      view.moved = false;
      vp.setPointerCapture(e.pointerId);
      vp.classList.add("grabbing");
    });
    vp.addEventListener("pointermove", e => {
      if (!view.drag) return;
      const dx = e.clientX - view.drag.x, dy = e.clientY - view.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) view.moved = true;
      view.tx = view.drag.tx + dx;
      view.ty = view.drag.ty + dy;
      applyView();
    });
    ["pointerup", "pointercancel"].forEach(ev => vp.addEventListener(ev, () => {
      view.drag = null;
      vp.classList.remove("grabbing");
    }));
    vp.addEventListener("wheel", e => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const ns = Math.min(2.5, Math.max(0.3, view.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      view.tx = px - (px - view.tx) * (ns / view.s);
      view.ty = py - (py - view.ty) * (ns / view.s);
      view.s = ns;
      applyView();
    }, { passive: false });

    /* 悬停高亮相关连线 */
    bodyEl.querySelectorAll(".map-job, .map-ver").forEach(n => {
      n.addEventListener("mouseenter", () => highlight(n, true));
      n.addEventListener("mouseleave", () => highlight(n, false));
    });
  }

  function highlight(node, on) {
    const aid = node.dataset.aid, vid = node.dataset.vid;
    bodyEl.querySelectorAll(".map-e").forEach(p => {
      const hit = (aid && p.dataset.aid === aid) || (vid && !aid && p.dataset.vid === vid)
        || (vid && node.classList.contains("map-ver") && p.dataset.vid === vid);
      p.classList.toggle("hl", !!(on && hit));
    });
  }

  /* ---------- 预览页顶部速览条（屏幕可见，打印隐藏） ---------- */
  function renderStrip() {
    if (!stripEl) return;
    const v = RS.store.cur();
    const apps = (v && Array.isArray(v.applications)) ? v.applications.filter(a => a.job) : [];
    if (!apps.length) { stripEl.hidden = true; stripEl.innerHTML = ""; return; }
    const sorted = apps.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const MAX = 5;
    const chips = sorted.slice(0, MAX).map(a =>
      '<button class="as-chip" data-action="strip-open" title="' + esc((a.date || "") + (a.company ? " " + a.company : "") + " " + a.job) + '">'
      + esc(a.company ? a.company + " · " + a.job : a.job) + '</button>').join("");
    stripEl.innerHTML = '<span class="as-label">📮 本版已投递 <b>' + apps.length + '</b> 个岗位</span>'
      + chips
      + (apps.length > MAX ? '<span class="as-more">+' + (apps.length - MAX) + '</span>' : "")
      + '<button class="as-open" data-action="strip-open">投递记录 ›</button>';
    stripEl.hidden = false;
  }

  /* ---------- 弹层骨架 ---------- */
  function render() {
    maskEl.querySelectorAll(".ap-tab").forEach(b =>
      b.classList.toggle("active", b.dataset.action === (tab === "cur" ? "tab-cur" : "tab-all")));
    panelEl.classList.toggle("wide", tab === "all");
    addBtn.style.display = tab === "cur" ? "" : "none";
    if (filterEl) {
      filterEl.value = companyFilter;
      if (filterListEl) filterListEl.innerHTML = companyOptions().map(c => '<option value="' + esc(c) + '"></option>').join("");
    }
    if (tab === "cur") renderCur(); else renderAll();
  }

  function open() { tab = "cur"; companyFilter = ""; render(); maskEl.classList.add("open"); }
  function close() { maskEl.classList.remove("open"); RS.store.flush(); renderStrip(); }

  /* 总览中点版本节点：切换到该版本并回到本版投递视图 */
  function goVersion(vid) {
    RS.store.get().currentId = vid;
    RS.store.save();
    RS.refreshUI();
    tab = "cur";
    render();
  }

  function onMaskClick(e) {
    if (view && view.moved && e.target.closest(".map-node")) return;   // 拖拽后误触节点，忽略
    const el = e.target.closest("[data-action]");
    const act = (el || {}).dataset;
    if (act && act.action === "close-apps") return close();
    if (act && act.action === "tab-cur") { tab = "cur"; return render(); }
    if (act && act.action === "tab-all") { tab = "all"; return render(); }
    if (act && act.action === "go-version") return goVersion(act.vid);
    if (act && act.action === "map-reset") { if (view) fitView(); return; }
    if (act && act.action === "add-app") {
      companyFilter = "";                    // 新增时清空公司筛选，避免新卡片被过滤隐藏
      if (filterEl) filterEl.value = "";
      getApps().unshift({ id: uid(), job: "", company: "", companyUrl: "", url: "", date: new Date().toISOString().slice(0, 10), note: "" });
      RS.store.save(); render(); renderStrip();
      const inp = bodyEl.querySelector(".ap-item .ap-job-input");
      if (inp) inp.focus();
      return;
    }
    if (act && act.action === "del-app") {
      const v = RS.store.cur();
      v.applications = v.applications.filter(a => a.id !== act.aid);
      RS.store.save(); render(); renderStrip(); return;
    }
    if (e.target === maskEl) close();
  }

  /* 输入即保存（不重建面板，不丢焦点） */
  function onInput(e) {
    const inp = e.target.closest("input[data-field]");
    if (!inp) return;
    const item = getApps().find(a => a.id === inp.closest(".ap-item").dataset.aid);
    if (item) { item[inp.dataset.field] = inp.value; RS.store.save(); }
  }

  function onStripClick(e) {
    if (e.target.closest('[data-action="strip-open"]')) open();
  }

  function init() {
    maskEl = RS.util.$("appsMask");
    panelEl = RS.util.$("appsPanel");
    bodyEl = RS.util.$("apBody");
    subEl = RS.util.$("apSub");
    stripEl = RS.util.$("appsStrip");
    filterEl = RS.util.$("apCompanyFilter");
    filterListEl = RS.util.$("apCompanyList");
    addBtn = maskEl.querySelector('[data-action="add-app"]');
    maskEl.addEventListener("click", onMaskClick);
    bodyEl.addEventListener("input", onInput);
    if (filterEl) {
      filterEl.addEventListener("input", () => {
        companyFilter = filterEl.value.trim();
        if (tab === "cur") renderCur(); else renderAll();
      });
    }
    if (stripEl) stripEl.addEventListener("click", onStripClick);
  }

  return { open, init, renderStrip };
})();
