"use strict";
/* 命名空间与通用工具。各模块只通过 RS.* 互相调用，不感知文件顺序之外的依赖。 */
window.RS = window.RS || {};

RS.util = {
  uid() {
    return "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
  clone(o) {
    return JSON.parse(JSON.stringify(o));
  },
  esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  },
  /* 行内富文本：数据字符串只允许 <b>/<i>/<u> 三种标签。
     escRich = 先整体转义再放行白名单标签，其余 HTML 一律按纯文本渲染； */
  escRich(s) {
    return RS.util.esc(s).replace(/&lt;(\/?)(b|i|u)&gt;/g, "<$1$2>");
  },
  /* sanitizeRich = 把 contenteditable 产出的 HTML 清洗回「纯文本 + 白名单标签」字符串，
     防止粘贴/编辑引入任意标签与属性 */
  sanitizeRich(html) {
    const box = document.createElement("div");
    box.innerHTML = html == null ? "" : String(html);
    const RICH = ["b", "i", "u"];
    function walk(node) {
      let s = "";
      node.childNodes.forEach(c => {
        if (c.nodeType === 3) s += c.textContent;
        else if (c.nodeType === 1) {
          const tag = c.tagName.toLowerCase();
          if (tag === "br") s += "\n";
          else if (RICH.includes(tag)) s += "<" + tag + ">" + walk(c) + "</" + tag + ">";
          else s += walk(c);
        }
      });
      return s;
    }
    return walk(box);
  },
  $(id) {
    return document.getElementById(id);
  }
};
