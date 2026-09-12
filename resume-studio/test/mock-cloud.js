"use strict";
/* 可视化走查用的内存云端 mock：拦截 fetch，模拟后端契约并预置投递数据。
   仅被 test/visual-harness.html 引用，生产页面不加载。 */
(function () {
  const blank = () => RS.model.blankResume();
  const style = () => RS.model.defaultStyle();
  const db = {
    user: { id: 1, email: "demo@example.com", is_admin: false, ui_state: {} },
    resumes: [], seq: 1
  };
  function seed(name, apps) {
    const r = { id: db.seq++, name, data: blank(), style: style(), applications: apps, revision: 1 };
    r.data.profile.name = "王鹏";
    db.resumes.push(r);
  }
  seed("米哈游-数据产品经理", [
    { id: "a1", job: "数据产品经理", url: "https://jobs.mihoyo.com/example", date: "2026-09-10", note: "官网投递" }
  ]);
  seed("游戏项目管理", [
    { id: "a2", job: "游戏项目管理", url: "", date: "2026-09-10", note: "" },
    { id: "a5", job: "手游运营管培生", url: "", date: "2026-09-06", note: "内推" }
  ]);
  seed("VIVO", [
    { id: "a3", job: "AI产品经理-27届秋招", url: "https://hr.vivo.com/example", date: "2026-09-10", note: "" }
  ]);
  seed("新浪微博", [
    { id: "a4", job: "集团产品管培生", url: "", date: "2026-09-10", note: "测评已做" },
    { id: "a6", job: "商业化产品实习生", url: "", date: "2026-08-28", note: "" }
  ]);

  const res = (data, status = 200) => Promise.resolve({
    ok: status < 400, status,
    json: async () => data
  });

  window.fetch = (url, opts = {}) => {
    const u = new URL(url, location.origin).pathname;
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
        r.revision = (body.revision || 0) + 1;
        return res(r);
      }
      if (method === "DELETE") { db.resumes = db.resumes.filter(x => x !== r); return res(null, 204); }
    }
    return res({ code: "not_found", message: "no route" }, 404);
  };
})();
