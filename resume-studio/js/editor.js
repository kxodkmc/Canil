"use strict";
window.RS = window.RS || {};

/* 左侧结构化编辑器：渲染 + 输入/按钮事件 + 拖拽排序 + 照片上传 */
RS.editor = (function () {
  const { uid, esc } = RS.util;
  let editorEl;

  /* 折叠状态：纯 UI 态，存内存、不进云端数据，避免被保存冲突回滚/刷新重置 */
  const fold = { sec: {}, item: {} };
  function secOpen(sec) { return fold.sec[sec.id] !== undefined ? fold.sec[sec.id] : !!sec._open; }
  function itemOpen(it) { return fold.item[it.id] !== undefined ? fold.item[it.id] : it._open !== false; }

  function fieldRow(label, inner) {
    return '<div class="field-row"><label>' + label + '</label>' + inner + '</div>';
  }

  /* 文本域随内容自动增高 */
  function growTa(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }
  function growAll() {
    editorEl.querySelectorAll("textarea").forEach(growTa);
  }

  function render() {
    const d = RS.store.cur().data;
    let h = "";

    /* 个人信息卡片 */
    h += '<div class="ed-card expanded" data-kind="profile">'
      +   '<div class="ed-card-head"><span style="width:14px"></span>'
      +     '<span style="flex:1;font-weight:600">个人信息</span></div>'
      +   '<div class="ed-card-body">'
      +     fieldRow("姓名", '<input data-scope="profile" data-field="name" value="' + esc(d.profile.name) + '">');
    d.profile.fields.forEach(f => {
      h += '<div class="kv-row">'
        +    '<input class="kv-label" data-scope="pfield" data-fid="' + f.id + '" data-field="label" value="' + esc(f.label) + '" placeholder="标签">'
        +    '<input class="kv-value" data-scope="pfield" data-fid="' + f.id + '" data-field="value" value="' + esc(f.value) + '" placeholder="内容">'
        +    '<button class="icon-btn" data-action="del-pfield" data-fid="' + f.id + '" title="删除">✕</button>'
        +  '</div>';
    });
    const photoHtml = d.profile.photo
      ? '<button class="btn small" data-action="del-photo">移除</button><span class="photo-ok">已设置 ✓</span>'
      : '<span class="hint" style="display:inline;margin:0 0 0 6px">未设置（可选）</span>';
    h +=   '<button class="add-btn" data-action="add-pfield">+ 添加字段（如：民族 / 政治面貌）</button>'
      +   '<div class="field-row photo-row"><label>照片</label>'
      +     '<button class="btn small primary" data-action="upload-photo">上传照片</button>'
      +     photoHtml
      + '</div></div></div>';

    /* 各内容模块 */
    d.sections.forEach(sec => {
      h += '<div class="ed-card' + (secOpen(sec) ? " expanded" : "") + (sec.visible ? "" : " is-hidden") + '" draggable="true" data-kind="section" data-sid="' + sec.id + '">'
        +   '<div class="ed-card-head" data-action="toggle-open" data-sid="' + sec.id + '" title="点击空白处折叠/展开">'
        +     '<span class="drag-handle" title="拖拽调整模块顺序">⋮⋮</span>'
        +     '<input class="sec-title" data-scope="section" data-sid="' + sec.id + '" value="' + esc(sec.title) + '">'
        +     '<button class="icon-btn" data-action="toggle-open" data-sid="' + sec.id + '" title="折叠/展开（点击标题栏空白处也可）"><span class="fold">▸</span></button>'
        +     '<button class="icon-btn" data-action="toggle-visible" data-sid="' + sec.id + '" title="在简历中显示/隐藏该模块（不是折叠）">' + (sec.visible ? "👁" : "🚫") + '</button>'
        +     '<button class="icon-btn" data-action="del-section" data-sid="' + sec.id + '" title="删除模块">✕</button>'
        +   '</div>'
        +   '<div class="ed-card-body">';
      sec.items.forEach(it => {
        const name = it.title || it.role || (it.bullets[0] || "").slice(0, 18) || "（空条目）";
        h += '<div class="ed-item' + (itemOpen(it) ? " open" : "") + '" draggable="true" data-sid="' + sec.id + '" data-iid="' + it.id + '">'
          +   '<div class="ed-item-head" data-action="toggle-item-open" data-sid="' + sec.id + '" data-iid="' + it.id + '" title="点击折叠/展开">'
          +     '<span class="drag-handle" title="拖拽调整条目顺序">⋮⋮</span>'
          +     '<span class="item-name">' + esc(name) + '</span>'
          +     '<span class="fold">▸</span>'
          +     '<button class="icon-btn" data-action="del-item" data-sid="' + sec.id + '" data-iid="' + it.id + '" title="删除条目">✕</button>'
          +   '</div>'
          +   '<div class="ed-item-body">'
          +     fieldRow("时间/左", '<input data-scope="item" data-sid="' + sec.id + '" data-iid="' + it.id + '" data-field="date" value="' + esc(it.date) + '" placeholder="如 2026.07–2026.09">')
          +     fieldRow("标题/中", '<input data-scope="item" data-sid="' + sec.id + '" data-iid="' + it.id + '" data-field="title" value="' + esc(it.title) + '" placeholder="公司 / 学校 / 项目名">')
          +     fieldRow("职位/右", '<input data-scope="item" data-sid="' + sec.id + '" data-iid="' + it.id + '" data-field="role" value="' + esc(it.role) + '" placeholder="岗位 / 角色">')
          +     fieldRow("链接", '<input data-scope="item" data-sid="' + sec.id + '" data-iid="' + it.id + '" data-field="link" value="' + esc(it.link || "") + '" placeholder="项目链接，可留空">')
          +     fieldRow("描述", '<textarea rows="2" data-scope="item" data-sid="' + sec.id + '" data-iid="' + it.id + '" data-field="desc" placeholder="一段补充说明（可留空）">' + esc(it.desc) + '</textarea>')
          +     '<div class="hint">要点：每行一条，预览中自动加圆点。直接粘贴 AI 文本即可，永远是纯文本。</div>'
          +     '<textarea rows="4" data-scope="bullets" data-sid="' + sec.id + '" data-iid="' + it.id + '" placeholder="每行一条要点">' + esc(it.bullets.join("\n")) + '</textarea>'
          +   '</div>'
          + '</div>';
      });
      h +=  '<button class="add-btn" data-action="add-item" data-sid="' + sec.id + '">+ 添加一条</button>'
        + '</div></div>';
    });

    h += '<button class="add-btn" data-action="add-section">+ 添加新模块（如：荣誉奖项 / 自我评价）</button>'
      +  '<div class="ed-footer-tip">提示：<b>直接点击右侧简历上的文字即可修改</b>，所见即所得；<br>拖动 ⋮⋮ 手柄调整模块与条目次序；所有修改自动保存在本机浏览器中。</div>';

    editorEl.innerHTML = h;
    growAll();
  }

  /* ---------- 输入：写回数据，不重建编辑器（避免丢焦点） ---------- */
  function onInput(e) {
    const t = e.target, scope = t.dataset.scope;
    if (!scope) return;
    const d = RS.store.cur().data;
    if (scope === "profile") d.profile[t.dataset.field] = t.value;
    else if (scope === "pfield") {
      const f = d.profile.fields.find(x => x.id === t.dataset.fid);
      if (f) f[t.dataset.field] = t.value;
    }
    else if (scope === "section") { const s = RS.store.findSec(t.dataset.sid); if (s) s.title = t.value; }
    else if (scope === "item") { const it = RS.store.findItem(t.dataset.sid, t.dataset.iid); if (it) it[t.dataset.field] = t.value; }
    else if (scope === "bullets") {
      const it = RS.store.findItem(t.dataset.sid, t.dataset.iid);
      if (it) it.bullets = t.value.split("\n");
    }
    RS.store.save();
    if (t.tagName === "TEXTAREA") growTa(t);
    RS.preview.render();
  }

  /* ---------- 按钮 ---------- */
  function onClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const act = btn.dataset.action, sid = btn.dataset.sid, iid = btn.dataset.iid;
    const d = RS.store.cur().data;

    if (act === "add-pfield") d.profile.fields.push({ id: uid(), label: "", value: "" });
    else if (act === "del-pfield") d.profile.fields = d.profile.fields.filter(f => f.id !== btn.dataset.fid);
    else if (act === "upload-photo") return pickPhoto();
    else if (act === "del-photo") d.profile.photo = null;
    else if (act === "toggle-open") {
      if (e.target.closest("input,.drag-handle")) return;   // 点击标题输入框 / 拖拽手柄不触发折叠
      const s = RS.store.findSec(sid);
      fold.sec[sid] = !secOpen(s);
      const card = btn.closest(".ed-card");
      card.classList.toggle("expanded", fold.sec[sid]);
      if (fold.sec[sid]) card.querySelectorAll("textarea").forEach(growTa);   // 收起时量不到高度，展开后重算
      return;   // 纯 UI 态：不写数据、不触发保存，任何云端回滚都不会重置它
    }
    else if (act === "toggle-item-open") {
      if (e.target.closest(".drag-handle,button")) return;  // 拖拽手柄与删除按钮不触发
      const it = RS.store.findItem(sid, iid);
      fold.item[iid] = !itemOpen(it);
      const el = btn.closest(".ed-item");
      el.classList.toggle("open", fold.item[iid]);
      if (fold.item[iid]) el.querySelectorAll("textarea").forEach(growTa);
      return;
    }
    else if (act === "toggle-visible") { const s = RS.store.findSec(sid); s.visible = !s.visible; }
    else if (act === "del-section") {
      if (confirm("删除整个模块「" + (RS.store.findSec(sid) || {}).title + "」及其全部内容？"))
        d.sections = d.sections.filter(s => s.id !== sid);
    }
    else if (act === "add-item") {
      const s = RS.store.findSec(sid);
      s.items.push(RS.model.entry("", "", "", "", []));
      s._open = true;
    }
    else if (act === "del-item") { const s = RS.store.findSec(sid); s.items = s.items.filter(i => i.id !== iid); }
    else if (act === "add-section") {
      const title = prompt("新模块名称：", "荣誉奖项");
      if (title) d.sections.push(Object.assign(RS.model.section(title, [RS.model.entry("", "", "", "", [])]), { _open: true }));
    }
    else return;
    RS.store.save(); render(); RS.preview.render();
  }

  /* ---------- 照片：base64 存入版本数据，自动压缩到 400px 宽 ---------- */
  function pickPhoto() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => {
      const file = inp.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 400 / img.width);
          const c = document.createElement("canvas");
          c.width = img.width * scale; c.height = img.height * scale;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          RS.store.cur().data.profile.photo = c.toDataURL("image/jpeg", 0.85);
          RS.store.save(); render(); RS.preview.render();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  /* ---------- 原生 HTML5 拖拽排序（模块与条目通用） ---------- */
  let dragCtx = null; // {type:'section'|'item', id, sid?}

  function onDragStart(e) {
    const item = e.target.closest(".ed-item");
    const card = e.target.closest(".ed-card[data-kind=section]");
    if (item) dragCtx = { type: "item", sid: item.dataset.sid, id: item.dataset.iid };
    else if (card) dragCtx = { type: "section", id: card.dataset.sid };
    else return;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", "drag"); } catch (_) {}
  }
  function onDragOver(e) {
    if (!dragCtx) return;
    const isItem = dragCtx.type === "item";
    const target = e.target.closest(isItem ? ".ed-item" : ".ed-card[data-kind=section]");
    if (!target) return;
    if (isItem && target.dataset.sid !== dragCtx.sid) return; // 条目只允许同模块内排序
    e.preventDefault();
    const r = target.getBoundingClientRect();
    const before = (e.clientY - r.top) < r.height / 2;
    target.classList.toggle("drag-over-top", before);
    target.classList.toggle("drag-over-bottom", !before);
    target._dropBefore = before;
  }
  function onDragLeave(e) {
    const t = e.target.closest(".drag-over-top,.drag-over-bottom");
    if (t) t.classList.remove("drag-over-top", "drag-over-bottom");
  }
  function onDrop(e) {
    if (!dragCtx) return;
    const isItem = dragCtx.type === "item";
    const target = e.target.closest(isItem ? ".ed-item" : ".ed-card[data-kind=section]");
    e.preventDefault();
    editorEl.querySelectorAll(".drag-over-top,.drag-over-bottom")
      .forEach(x => x.classList.remove("drag-over-top", "drag-over-bottom"));
    if (target) {
      const arr = isItem ? RS.store.findSec(dragCtx.sid).items : RS.store.cur().data.sections;
      const fromId = dragCtx.id;
      const toId = isItem ? target.dataset.iid : target.dataset.sid;
      if (fromId !== toId) {
        const from = arr.findIndex(x => x.id === fromId);
        const [moved] = arr.splice(from, 1);
        let to = arr.findIndex(x => x.id === toId);
        if (!target._dropBefore) to += 1;
        arr.splice(to, 0, moved);
        RS.store.save(); render(); RS.preview.render();
      }
    }
    dragCtx = null;
  }

  /* 预览区改过后，聚焦时同步最新值（不整棵重建，不打断操作） */
  function onFocusIn(e) {
    const t = e.target, scope = t.dataset.scope;
    if (!scope) return;
    const d = RS.store.cur().data;
    if (scope === "profile") t.value = d.profile[t.dataset.field] || "";
    else if (scope === "pfield") { const f = d.profile.fields.find(x => x.id === t.dataset.fid); if (f) t.value = f[t.dataset.field] || ""; }
    else if (scope === "section") { const s = RS.store.findSec(t.dataset.sid); if (s) t.value = s.title; }
    else if (scope === "item") { const it = RS.store.findItem(t.dataset.sid, t.dataset.iid); if (it) t.value = it[t.dataset.field] || ""; }
    else if (scope === "bullets") { const it = RS.store.findItem(t.dataset.sid, t.dataset.iid); if (it) t.value = it.bullets.join("\n"); }
    if (t.tagName === "TEXTAREA") growTa(t);
  }

  function init() {
    editorEl = RS.util.$("editor");
    editorEl.addEventListener("input", onInput);
    editorEl.addEventListener("click", onClick);
    editorEl.addEventListener("focusin", onFocusIn);
    editorEl.addEventListener("dragstart", onDragStart);
    editorEl.addEventListener("dragover", onDragOver);
    editorEl.addEventListener("dragleave", onDragLeave);
    editorEl.addEventListener("drop", onDrop);
    editorEl.addEventListener("dragend", () => { dragCtx = null; });
  }

  return { render, init };
})();
