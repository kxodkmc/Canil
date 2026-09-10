"use strict";
window.RS = window.RS || {};

/* 模块标题 → 图标（按关键词匹配，未命中用通用圆点） */
RS.icons = (function () {
  const ICONS = {
    info:    '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14Z"/></svg>',
    edu:     '<svg viewBox="0 0 24 24"><path d="M12 3 1 8l11 5 9-4.1V15h2V8L12 3Zm-6 9.7V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.3l-6 2.7-6-2.7Z"/></svg>',
    skill:   '<svg viewBox="0 0 24 24"><path d="M22.7 19 13.6 9.9a6 6 0 0 0-7.5-7.5l3.8 3.8-2.8 2.8L3.3 5.2a6 6 0 0 0 7.5 7.5l9.1 9.1a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4Z"/></svg>',
    work:    '<svg viewBox="0 0 24 24"><path d="M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm-10-2h4v2h-4V4Z"/></svg>',
    project: '<svg viewBox="0 0 24 24"><path d="M18 2H8a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h12V2ZM8 20a2 2 0 0 1 0-4h8v4H8Z"/></svg>',
    custom:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'
  };

  function iconFor(title) {
    if (/教育|学业/.test(title)) return ICONS.edu;
    if (/技能|证书|语言/.test(title)) return ICONS.skill;
    if (/实习|工作|经历(?!.*项目)/.test(title) && !/项目/.test(title)) return ICONS.work;
    if (/项目|作品|科研|竞赛/.test(title)) return ICONS.project;
    if (/个人信息|求职/.test(title)) return ICONS.info;
    return ICONS.custom;
  }

  return { iconFor };
})();
