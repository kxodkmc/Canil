"use strict";
/* 拆分版冒烟测试：内置静态服务器 + jsdom 真实加载 index.html 并执行全部模块脚本，验证初始化与关键交互。
   用内存版 fetch mock 模拟云端 API，覆盖「登录态 + 纯云端存储」路径，并断言本地零落盘。 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const file = path.join(ROOT, req.url === "/" ? "index.html" : decodeURIComponent(req.url));
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* 内存版云端：覆盖 store 用到的全部端点，行为与真实后端契约一致 */
function makeCloud() {
  const db = {
    user: { id: 1, email: "test@example.com", is_admin: false, ui_state: {} },
    resumes: [], seq: 1
  };
  const res = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
  return {
    db,
    fetch: async (url, opts = {}) => {
      const u = new URL(url, "http://localhost").pathname;
      const method = opts.method || "GET";
      const body = opts.body ? JSON.parse(opts.body) : {};
      if (u === "/api/v1/me" && method === "GET") return res(db.user);
      if (u === "/api/v1/me/state" && method === "PUT") { db.user.ui_state = body; return res(db.user); }
      if (u === "/api/v1/resumes" && method === "GET") return res(db.resumes.map(({ id, name }) => ({ id, name })));
      if (u === "/api/v1/resumes" && method === "POST") {
        const r = { id: db.seq++, name: body.name, data: body.data, style: body.style, applications: body.applications || [], revision: 1 };
        db.resumes.push(r);
        return res(r, 201);
      }
      const m = u.match(/^\/api\/v1\/resumes\/(\d+)$/);
      if (m) {
        const r = db.resumes.find(x => x.id === +m[1]);
        if (!r) return res({ code: "not_found", message: "不存在" }, 404);
        if (method === "GET") return res(r);
        if (method === "PUT") {
          Object.assign(r, { name: body.name, data: body.data, style: body.style, applications: body.applications || [] });
          r.revision = body.revision + 1;
          return res(r);
        }
        if (method === "DELETE") { db.resumes = db.resumes.filter(x => x !== r); return res(null, 204); }
      }
      return res({ code: "not_found", message: "no route: " + method + " " + u }, 404);
    }
  };
}

let passed = 0, failed = 0;
const ok = (name, cond) => { if (cond) { passed++; console.log("  PASS  " + name); } else { failed++; console.log("  FAIL  " + name); } };
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const cloud = makeCloud();
  const dom = await JSDOM.fromURL(base + "/index.html", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    beforeParse(window) { window.fetch = cloud.fetch; }   // 脚本执行前接管 fetch
  });
  const finish = code => { server.close(); process.exit(code); };
  const w = dom.window;
  const errors = [];
  w.addEventListener("error", e => errors.push(e.message));
  w.prompt = () => "测试副本";   // jsdom 未实现 prompt，统一替换
  w.confirm = () => true;
  w.alert = () => {};

  /* 等所有脚本（含网络加载）与异步 boot 完成（boot 中拉取云端会话与数据） */
  const waitReady = n => new Promise(resolve => {
    if ((w.RS && w.RS.resizer && w.RS.store.get()) || n <= 0) return resolve();
    setTimeout(() => waitReady(n - 1).then(resolve), 200);
  });
  await waitReady(25);
  await new Promise(r => setTimeout(r, 100));

  const d = w.document;
  console.log("== 模块加载 ==");
  ["util", "icons", "model", "api", "store", "auth", "editor", "preview", "stylePanel", "versions", "apps", "io", "ai", "toolbar", "resizer"].forEach(m =>
    ok("RS." + m, !!(w.RS && w.RS[m])));
  ok("无脚本运行时错误", errors.length === 0);
  if (errors.length) console.log("     错误: " + errors.join(" | "));
  ok("云端会话就绪", w.RS.store.userEmail() === "test@example.com");

  console.log("== 初始渲染 ==");
  ok("版本下拉有 1 个选项", d.querySelectorAll("#versionSelect option").length === 1);
  ok("编辑器渲染 5 张卡片(1资料+4模块)", d.querySelectorAll("#editor .ed-card").length === 5);
  ok("5 张卡片均为 #editor 直接子级(无嵌套泄漏)", d.querySelectorAll("#editor > .ed-card").length === 5);
  ok("预览渲染 4 个模块", d.querySelectorAll("#resume .rs-sec").length === 4);
  ok("页数徽标已更新", /约 [\d.]+ 页/.test(d.getElementById("pageBadge").textContent));
  ok("页数边界线 2 条", d.querySelectorAll(".page-mark").length === 2);
  ok("排版面板已同步(字号)", d.getElementById("stFontV").textContent === "13.5px");

  console.log("== 编辑器交互 ==");
  const nameInput = d.querySelector('input[data-scope="profile"][data-field="name"]');
  nameInput.value = "张三";
  nameInput.dispatchEvent(new w.Event("input", { bubbles: true }));
  ok("姓名写回数据", w.RS.store.cur().data.profile.name === "张三");
  await new Promise(r => setTimeout(r, 200));   // 预览重绘 150ms 防抖
  ok("预览同步姓名", d.querySelector('[data-pf="__name"]').textContent === "张三");

  const firstBullet = d.querySelector('textarea[data-scope="bullets"]');
  firstBullet.value = "第一行\n第二行";
  firstBullet.dispatchEvent(new w.Event("input", { bubbles: true }));
  const sec0 = w.RS.store.cur().data.sections[0];
  ok("要点按行拆分写回", JSON.stringify(sec0.items[0].bullets) === JSON.stringify(["第一行", "第二行"]));

  d.querySelector('[data-action="add-pfield"]').click();
  ok("添加资料字段后重渲染", d.querySelectorAll("#editor .kv-row").length === 5);

  console.log("== 预览所见即所得 ==");
  const titleEl = d.querySelector("#resume .rs-title[contenteditable]");
  titleEl.textContent = "教育经历改";
  titleEl.dispatchEvent(new w.Event("input", { bubbles: true }));
  ok("模块标题写回", w.RS.store.cur().data.sections[0].title === "教育经历改");

  console.log("== 预览富文本(滑选加粗) ==");
  ok("快捷菜单已创建", !!d.getElementById("selMenu"));
  const bulEl = d.querySelector("#resume .rs-bullets");
  const li0 = bulEl.querySelector("li");
  li0.innerHTML = "前半<b>加粗词</b>后半";
  bulEl.dispatchEvent(new w.Event("input", { bubbles: true }));
  ok("加粗写回为白名单标签", w.RS.store.cur().data.sections[0].items[0].bullets[0] === "前半<b>加粗词</b>后半");
  li0.innerHTML = '纯文本<i>斜体</i><span onclick="alert(1)">危险</span><script>bad()</script>';
  bulEl.dispatchEvent(new w.Event("input", { bubbles: true }));
  ok("非白名单标签被清洗", w.RS.store.cur().data.sections[0].items[0].bullets[0] === "纯文本<i>斜体</i>危险bad()");
  li0.innerHTML = "前半<b>加粗词</b>后半";
  bulEl.dispatchEvent(new w.Event("input", { bubbles: true }));
  w.RS.preview.render();
  ok("重渲染后加粗可见", !!d.querySelector("#resume .rs-bullets li b"));

  console.log("== 复制文本 ==");
  const plain = w.RS.io.buildPlainText();
  ok("纯文本含姓名与模块标题", plain.includes("张三") && plain.includes("【教育经历改】"));
  ok("纯文本剥离行内标签", plain.includes("前半加粗词后半") && !plain.includes("<b>"));

  console.log("== 版本操作 ==");
  await w.RS.versions.actions("save-as");
  ok("另存为版本", w.RS.store.get().order.length === 2 && w.RS.store.cur().name === "测试副本");
  ok("版本下拉同步 2 项", d.querySelectorAll("#versionSelect option").length === 2);

  console.log("== AI 导入 ==");
  d.querySelector('[data-action="import-html"]').click();
  ok("导入弹层开启", d.getElementById("htmlMask").classList.contains("open"));
  const paste = d.getElementById("htmlPaste");
  paste.value = "这不是合法的简历 HTML";
  d.querySelector('[data-action="import-html-paste"]').click();
  await tick();
  ok("非法内容被拦截并提示", d.getElementById("htmlImportMsg").className === "err");
  ok("当前版本未受影响", w.RS.store.get().order.length === 2);

  const valid = '<html><body><resume-data version="1"><profile><name>李四</name>'
    + '<field label="电话">13800000000</field></profile>'
    + '<section title="教育背景"><item date="2023.09-2027.06" title="某大学" role="本科"><bullet>测试要点</bullet></item></section>'
    + '</resume-data></body></html>';
  paste.value = valid;
  d.querySelector('[data-action="import-html-paste"]').click();
  await tick();
  ok("合法内容导入成功", w.RS.store.get().order.length === 3);
  ok("导入后切换到新版本", w.RS.store.cur().name === "李四 · AI 导入");
  ok("新版本数据正确", w.RS.store.cur().data.profile.name === "李四" && w.RS.store.cur().data.sections[0].items[0].bullets[0] === "测试要点");
  ok("弹层自动关闭", !d.getElementById("htmlMask").classList.contains("open"));

  console.log("== 投递记录 ==");
  d.querySelector('[data-action="open-apps"]').click();
  ok("弹层开启并显示空态", d.getElementById("appsMask").classList.contains("open") && !!d.querySelector(".ap-empty"));
  d.querySelector('[data-action="add-app"]').click();
  ok("添加一条记录(卡片)", d.querySelectorAll(".ap-item").length === 1);
  const jobInput = d.querySelector('.ap-item input[data-field="job"]');
  jobInput.value = "产品实习生";
  jobInput.dispatchEvent(new w.Event("input", { bubbles: true }));
  ok("岗位写回", w.RS.store.cur().applications[0].job === "产品实习生");
  d.querySelector('[data-action="close-apps"]').click();
  await tick();
  ok("关闭弹层后速览条出现", d.getElementById("appsStrip").hidden === false);
  ok("速览条含岗位 chip", d.querySelector("#appsStrip .as-chip").textContent === "产品实习生");

  console.log("== 投递总览(思维导图画布) ==");
  // 给另一个版本预置一条较早的投递，验证跨版本汇总、连线与跳转
  const st0 = w.RS.store.get();
  const otherVid = st0.order.find(id => id !== st0.currentId);
  (st0.versions[otherVid].applications = st0.versions[otherVid].applications || [])
    .unshift({ id: "test-ov1", job: "数据工程师", url: "", date: "2026-09-01", note: "" });
  w.RS.store.save();
  d.querySelector('[data-action="open-apps"]').click();
  d.querySelector('[data-action="tab-all"]').click();
  ok("总览 Tab 弹层加宽", d.getElementById("appsPanel").classList.contains("wide"));
  ok("画布渲染根节点", !!d.querySelector(".map-node.map-root"));
  ok("画布跨版本汇总 2 个岗位节点", d.querySelectorAll(".map-node.map-job").length === 2);
  ok("画布渲染 2 个版本节点", d.querySelectorAll(".map-node.map-ver").length === 2);
  ok("含两个版本的记录", d.getElementById("mapWorld").textContent.includes("产品实习生") && d.getElementById("mapWorld").textContent.includes("数据工程师"));
  ok("连线：根→岗位 2 条 + 岗位→版本 2 条", d.querySelectorAll(".map-e-root").length === 2 && d.querySelectorAll(".map-e-ver").length === 2);
  ok("岗位按日期倒序(最新在最上)", d.querySelector(".map-node.map-job .map-job-date").textContent === new Date().toISOString().slice(0, 10));
  ok("统计行显示总数与版本数", d.querySelector(".ap-stat").textContent.includes("共 2 条") && d.querySelector(".ap-stat").textContent.includes("2 个简历版本"));
  d.querySelector('.map-ver[data-vid="' + otherVid + '"]').click();
  await tick();
  ok("点版本节点跳转并切回本版视图", w.RS.store.get().currentId === otherVid && !!d.querySelector(".ap-item"));
  ok("速览条随版本切换更新", d.getElementById("appsStrip").textContent.includes("数据工程师"));

  console.log("== 排版面板 ==");
  d.querySelector('[data-action="toggle-style"]').click();
  ok("面板可展开", d.getElementById("stylePanel").classList.contains("open"));
  const fontSlider = d.getElementById("stFont");
  fontSlider.value = "14";
  fontSlider.dispatchEvent(new w.Event("input", { bubbles: true }));
  ok("字号写回并退出自动模式", w.RS.store.cur().style.font === 14 && w.RS.store.cur().style.autoFit === false);

  console.log("== 模板切换 ==");
  const tpl = d.getElementById("stTpl");
  tpl.value = "banner";
  tpl.dispatchEvent(new w.Event("change", { bubbles: true }));
  ok("切换商务蓝：根节点带 t2 类", d.getElementById("resume").classList.contains("t2"));
  ok("商务蓝：基本信息条渲染", !!d.querySelector("#resume .t2-profile-head"));
  ok("商务蓝：默认色/边距自动互换", w.RS.store.cur().style.color === "#2272b8" && w.RS.store.cur().style.pad === 9);
  tpl.value = "classic";
  tpl.dispatchEvent(new w.Event("change", { bubbles: true }));
  ok("切回经典：t2 类移除、标题条消失", !d.getElementById("resume").classList.contains("t2") && !d.querySelector("#resume .t2-profile-head"));
  ok("经典默认色/边距换回", w.RS.store.cur().style.color === "#2b4c7e" && w.RS.store.cur().style.pad === 12);

  console.log("== 工具栏其余动作 ==");
  d.querySelector('[data-action="toggle-editor"]').click();
  ok("编辑面板可收起", d.getElementById("editor").style.display === "none");
  d.querySelector('[data-action="toggle-editor"]').click();
  ok("编辑面板可展开", d.getElementById("editor").style.display === "");

  console.log("== 云端同步（仅手动） ==");
  await new Promise(r => setTimeout(r, 400));
  ok("未写任何本地存储", w.localStorage.getItem("resume-studio-v1") === null);
  ok("手动保存前 UI 状态未同步", (cloud.db.user.ui_state.order || []).length === 1);
  ok("保存按钮呈未保存高亮态", d.getElementById("saveCloudBtn").classList.contains("dirty"));
  d.querySelector('[data-action="save-cloud"]').click();
  await w.RS.store.flush();
  ok("3 个版本均已同步云端且版本号递增", cloud.db.resumes.length === 3 && cloud.db.resumes.every(r => r.revision >= 1));
  ok("云端 UI 状态已保存", cloud.db.user.ui_state.order.length === 3);
  ok("保存后按钮恢复常态", !d.getElementById("saveCloudBtn").classList.contains("dirty"));
  console.log("\n结果: " + passed + " 通过, " + failed + " 失败");
  finish(failed ? 1 : 0);
})().catch(e => { console.error("加载失败:", e); process.exit(1); });
