"use strict";
window.RS = window.RS || {};

/* 投递记录：挂在当前简历版本上，随版本保存/复制/导出。
   双 Tab：「本版投递」编辑当前版本的记录；「全部投递总览」跨版本汇总，便于复盘。 */
RS.apps = (function () {
  const { uid, esc } = RS.util;
  let maskEl, bodyEl, subEl, addBtn;
  let tab = "cur"; // cur=本版投递 | all=全部投递总览

  /* 旧版本数据没有 applications 字段，补默认值 */
  function getApps() {
    const v = RS.store.cur();
    if (!Array.isArray(v.applications)) v.applications = [];
    return v.applications;
  }

  /* ---------- 本版投递（可编辑列表） ---------- */
  function renderCur() {
    const apps = getApps();
    subEl.textContent = "记录「" + RS.store.cur().name + "」投递的岗位";
    if (!apps.length) {
      bodyEl.innerHTML = '<div class="ap-empty">还没有记录。点下方「+ 添加一条投递」，记下岗位名称和招聘页网址，方便之后复盘。</div>';
      return;
    }
    bodyEl.innerHTML = apps.map(a =>
      '<div class="ap-item" data-aid="' + a.id + '">'
      +  '<div class="ap-row"><label>岗位名称</label><input data-field="job" value="' + esc(a.job) + '" placeholder="如：产品运营实习生（某公司）"></div>'
      +  '<div class="ap-row"><label>网址</label><input class="ap-url" data-field="url" value="' + esc(a.url) + '" placeholder="招聘页链接，可留空"></div>'
      +  '<div class="ap-row"><label>投递日期</label><input type="date" data-field="date" value="' + esc(a.date || "") + '"></div>'
      +  '<div class="ap-row"><label>备注</label><input data-field="note" value="' + esc(a.note || "") + '" placeholder="可选：进展 / 内推人 / 渠道等"></div>'
      +  '<div class="ap-meta">'
      +    (a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">🔗 打开链接</a>' : '<span></span>')
      +    '<span style="flex:1"></span>'
      +    '<button class="icon-btn" data-action="del-app" data-aid="' + a.id + '" title="删除这条记录">✕ 删除</button>'
      +  '</div>'
      + '</div>').join("");
  }

  /* ---------- 全部投递总览（跨版本汇总，日期倒序） ---------- */
  function collectAll() {
    const state = RS.store.get();
    const rows = [];
    state.order.forEach(vid => {
      const v = state.versions[vid];
      (Array.isArray(v.applications) ? v.applications : []).forEach(a =>
        rows.push({ id: a.id, job: a.job || "", url: a.url || "", date: a.date || "", note: a.note || "", vid, vname: v.name }));
    });
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return rows;
  }

  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function renderAll() {
    subEl.textContent = "全部版本投递一览，按日期倒序；点版本名可直接跳转";
    const rows = collectAll();
    if (!rows.length) {
      bodyEl.innerHTML = '<div class="ap-empty">所有版本都还没有投递记录。回到「本版投递」添加第一条。</div>';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const in7 = rows.filter(r => r.date && r.date >= daysAgoISO(7) && r.date <= today).length;
    const in30 = rows.filter(r => r.date && r.date >= daysAgoISO(30) && r.date <= today).length;
    const stat = '<div class="ap-stat">共 <b>' + rows.length + '</b> 条投递'
      + ' · 最近 7 天 <b>' + in7 + '</b> 条'
      + ' · 最近 30 天 <b>' + in30 + '</b> 条</div>';
    const trs = rows.map(r =>
      '<tr>'
      +  '<td class="ap-date">' + esc(r.date || "—") + '</td>'
      +  '<td><div class="ap-job">' + (esc(r.job) || '<span class="ap-empty-inline">（未填岗位）</span>') + '</div>'
      +    (r.note ? '<div class="ap-note">' + esc(r.note) + '</div>' : "")
      +  '</td>'
      +  '<td><button class="ap-vid" data-action="go-version" data-vid="' + r.vid + '" title="切换到这个简历版本">' + esc(r.vname) + '</button></td>'
      +  '<td>' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">打开</a>' : '<span class="ap-empty-inline">—</span>') + '</td>'
      + '</tr>').join("");
    bodyEl.innerHTML = stat
      + '<table class="ap-table"><thead><tr><th>日期</th><th>岗位 / 备注</th><th>简历版本</th><th>链接</th></tr></thead>'
      + '<tbody>' + trs + '</tbody></table>';
  }

  function render() {
    maskEl.querySelectorAll(".ap-tab").forEach(b =>
      b.classList.toggle("active", b.dataset.action === (tab === "cur" ? "tab-cur" : "tab-all")));
    addBtn.style.display = tab === "cur" ? "" : "none";
    if (tab === "cur") renderCur(); else renderAll();
  }

  function open() { tab = "cur"; render(); maskEl.classList.add("open"); }
  function close() { maskEl.classList.remove("open"); }

  /* 总览中点版本名：切换到该版本并回到本版投递视图 */
  function goVersion(vid) {
    RS.store.get().currentId = vid;
    RS.store.save();
    RS.refreshUI();
    tab = "cur";
    render();
  }

  function onMaskClick(e) {
    const el = e.target.closest("[data-action]");
    const act = (el || {}).dataset;
    if (act && act.action === "close-apps") return close();
    if (act && act.action === "tab-cur") { tab = "cur"; return render(); }
    if (act && act.action === "tab-all") { tab = "all"; return render(); }
    if (act && act.action === "go-version") return goVersion(act.vid);
    if (act && act.action === "add-app") {
      getApps().unshift({ id: uid(), job: "", url: "", date: new Date().toISOString().slice(0, 10), note: "" });
      RS.store.save(); render(); return;
    }
    if (act && act.action === "del-app") {
      const v = RS.store.cur();
      v.applications = v.applications.filter(a => a.id !== act.aid);
      RS.store.save(); render(); return;
    }
    if (e.target === maskEl) close();
  }

  /* 输入即保存（不重建面板，不丢焦点） */
  function onInput(e) {
    const inp = e.target.closest("input[data-field]");
    if (!inp) return;
    const item = getApps().find(a => a.id === inp.closest(".ap-item").dataset.aid);
    if (item) item[inp.dataset.field] = inp.value;
    RS.store.save();
  }

  function init() {
    maskEl = RS.util.$("appsMask");
    bodyEl = RS.util.$("apBody");
    subEl = RS.util.$("apSub");
    addBtn = maskEl.querySelector('[data-action="add-app"]');
    maskEl.addEventListener("click", onMaskClick);
    bodyEl.addEventListener("input", onInput);
  }

  return { open, init };
})();
