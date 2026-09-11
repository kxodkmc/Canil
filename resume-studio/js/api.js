"use strict";
window.RS = window.RS || {};

/* 后端 HTTP 客户端：统一携带鉴权 Cookie；access 过期时自动刷新一次并重试；
   错误规范化为 { status, code, message, detail } 后抛出。 */
RS.api = (function () {
  const BASE = window.RS_API_BASE || "";
  const PREFIX = "/api/v1";

  async function raw(method, path, body, opts) {
    const res = await fetch(BASE + PREFIX + path, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      keepalive: !!(opts && opts.keepalive)   // 页面关闭/隐藏时兜底发送（body 限制约 64KB）
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.message) || "请求失败");
      err.status = res.status;
      err.code = data && data.code;
      err.detail = data && data.detail;
      throw err;
    }
    return data;
  }

  async function request(method, path, body, opts) {
    try {
      return await raw(method, path, body, opts);
    } catch (e) {
      if (e.status !== 401 || path.startsWith("/auth/")) throw e;
      await raw("POST", "/auth/refresh");
      return raw(method, path, body, opts);
    }
  }

  return {
    login: (email, password) => raw("POST", "/auth/login", { email, password }),
    register: (email, password) => raw("POST", "/auth/register", { email, password }),
    logout: () => raw("POST", "/auth/logout"),
    me: () => request("GET", "/me"),
    putState: (state, opts) => request("PUT", "/me/state", state, opts),
    listResumes: () => request("GET", "/resumes"),
    createResume: v => request("POST", "/resumes", v),
    getResume: id => request("GET", "/resumes/" + id),
    updateResume: (id, v, opts) => request("PUT", "/resumes/" + id, v, opts),
    deleteResume: id => request("DELETE", "/resumes/" + id),

    /* 管理端（仅 is_admin 用户可用，服务端强制校验） */
    listAllowlist: () => request("GET", "/admin/allowlist"),
    addAllowlist: (email, note) => request("POST", "/admin/allowlist", { email, note }),
    removeAllowlist: email => request("DELETE", "/admin/allowlist/" + encodeURIComponent(email)),
    listUsers: () => request("GET", "/admin/users"),
    deleteUser: id => request("DELETE", "/admin/users/" + id)
  };
})();
