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
  $(id) {
    return document.getElementById(id);
  }
};
