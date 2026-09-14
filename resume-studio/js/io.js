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

  /* 纯文本复制：把当前版本简历整理为易粘贴的纯文本（剥离 b/i/u 行内标签） */
  function buildPlainText() {
    const d = RS.store.cur().data;
    const strip = s => String(s || "").replace(/<\/?(b|i|u)>/g, "");
    const lines = [];
    if ((d.profile.name || "").trim()) lines.push(strip(d.profile.name).trim());
    d.profile.fields.forEach(f => {
      const v = strip(f.value).trim();
      if (v) lines.push(strip(f.label).trim() + "：" + v);
    });
    d.sections.filter(s => s.visible).forEach(sec => {
      const secLines = [];
      sec.items.forEach(it => {
        const head = [strip(it.date), strip(it.title), strip(it.role)].map(x => x.trim()).filter(Boolean).join("　");
        if (head) secLines.push(head);
        const link = strip(it.link).trim();
        if (link) secLines.push(link);
        const desc = strip(it.desc).trim();
        if (desc) secLines.push(desc);
        it.bullets.map(strip).map(b => b.trim()).filter(Boolean).forEach(b => secLines.push("· " + b));
      });
      if (secLines.length) {
        if (lines.length) lines.push("");
        lines.push("【" + strip(sec.title).trim() + "】");
        lines.push(...secLines);
      }
    });
    return lines.join("\n");
  }

  async function copyText(btn) {
    const text = buildPlainText();
    if (!text.trim()) return alert("当前简历没有可复制的内容。");
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      /* 非安全上下文等场景的兜底：临时文本域 + execCommand */
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "已复制 ✓";
      btn.disabled = true;
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
    }
  }

  function init() {
    RS.util.$("importFile").addEventListener("change", onImportFile);
  }

  return { exportJSON, copyText, buildPlainText, init };
})();
