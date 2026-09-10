"use strict";
window.RS = window.RS || {};

/* 数据模型：纯数据构造，不碰 DOM、不碰存储 */
RS.model = (function () {
  const uid = () => RS.util.uid();

  /* 条目：{ id, date(左), title(中), role(右), link, desc, bullets:[] } */
  const entry = (date, title, role, desc, bullets, link) =>
    ({ id: uid(), date, title, role, desc, bullets: bullets || [], link: link || "" });

  /* 模块：{ id, title, visible, items:[] } */
  const section = (title, items) => ({ id: uid(), title, visible: true, items });

  /* 模板：classic=经典极简，banner=商务蓝横幅 */
  const defaultStyle = () =>
    ({ font: 13.5, line: 1.5, secGap: 10, itemGap: 7, pad: 12, color: "#2b4c7e", showMarks: true, autoFit: true, template: "classic" });

  /* 空白简历：全新打开时的初始模板，不预置任何个人数据 */
  const blankResume = () => ({
    profile: {
      name: "",
      photo: null,
      fields: [
        { id: uid(), label: "出生年月", value: "" },
        { id: uid(), label: "电话", value: "" },
        { id: uid(), label: "邮箱", value: "" },
        { id: uid(), label: "求职意向", value: "" }
      ]
    },
    sections: [
      section("教育背景", [entry("", "", "", "", [])]),
      section("技能与证书", [entry("", "", "", "", [])]),
      section("实习经历", [entry("", "", "", "", [])]),
      section("项目经历", [entry("", "", "", "", [])])
    ]
  });

  const freshState = () => {
    const id = uid();
    return {
      versions: { [id]: { name: "我的简历", data: blankResume(), style: defaultStyle() } },
      order: [id],
      currentId: id
    };
  };

  return { entry, section, defaultStyle, blankResume, freshState };
})();
