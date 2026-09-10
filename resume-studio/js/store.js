"use strict";
window.RS = window.RS || {};

/* 状态存取：唯一持有 state 的模块，数据只存云端。
   登录后：版本与服务端一一对应（id = "r" + 服务端 id），变更防抖同步；
   未登录：仅持有内存空状态供遮罩下的 UI 渲染，不落任何本地存储。 */
RS.store = (function () {
  let state = null;
  let user = null;
  let revs = {};       // 版本 id -> 服务端 revision（乐观锁）
  let saveTimer = null;

  async function init() {
    try {
      user = await RS.api.me();
      await pullCloud();
    } catch (e) {
      user = null;
      state = RS.model.freshState();
    }
  }

  async function enterCloud(u) {
    user = u;
    await pullCloud();
  }

  function leaveCloud() {
    user = null;
    revs = {};
    state = RS.model.freshState();
  }

  async function pullCloud() {
    const list = await RS.api.listResumes();
    const versions = {};
    const order = [];
    for (const s of list) {
      const full = await RS.api.getResume(s.id);
      const id = "r" + full.id;
      versions[id] = {
        name: full.name, data: full.data, style: full.style,
        applications: full.applications || []
      };
      revs[id] = full.revision;
      order.push(id);
    }
    const ui = (user && user.ui_state) || {};
    const savedOrder = (ui.order || []).filter(id => versions[id]);
    const finalOrder = savedOrder.concat(order.filter(id => !savedOrder.includes(id)));
    state = {
      versions,
      order: finalOrder,
      currentId: ui.currentId && versions[ui.currentId] ? ui.currentId : (finalOrder[0] || null)
    };
    if (!finalOrder.length) {
      state.currentId = await newVersion({
        name: "我的简历", data: RS.model.blankResume(),
        style: RS.model.defaultStyle(), applications: []
      });
    }
    await RS.api.putState({ order: state.order, currentId: state.currentId });
  }

  function get() { return state; }
  function cur() { return state.versions[state.currentId]; }
  function userEmail() { return user ? user.email : ""; }
  function isAdmin() { return !!(user && user.is_admin); }

  async function newVersion(v) {
    v.applications = v.applications || [];
    const created = await RS.api.createResume(v);
    const id = "r" + created.id;
    state.versions[id] = v;
    revs[id] = created.revision;
    state.order.push(id);
    return id;
  }

  async function deleteVersion(id) {
    try { await RS.api.deleteResume(id.slice(1)); }
    catch (e) { if (e.status !== 404) throw e; }
    delete state.versions[id];
    delete revs[id];
    state.order = state.order.filter(x => x !== id);
    if (state.currentId === id) state.currentId = state.order[0];
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushCloud, 250);
  }

  async function pushCloud() {
    try {
      await syncCurrent();
      await RS.api.putState({ order: state.order, currentId: state.currentId });
    } catch (e) { await onSaveError(e); }
  }

  async function syncCurrent() {
    const id = state.currentId;
    const v = state.versions[id];
    const full = await RS.api.updateResume(id.slice(1), {
      name: v.name, data: v.data, style: v.style,
      applications: v.applications || [], revision: revs[id]
    });
    revs[id] = full.revision;
  }

  async function onSaveError(e) {
    const id = state.currentId;
    if (e.status === 409) {
      if (confirm("「" + state.versions[id].name + "」已在其他设备被修改。\n\n确定 = 用当前内容覆盖远端\n取消 = 拉取远端最新版（放弃本次修改）")) {
        if (e.detail && e.detail.revision) revs[id] = e.detail.revision;
        try { await syncCurrent(); } catch (err) { alert("覆盖失败：" + err.message); }
      } else {
        await pullVersion(id);
        RS.refreshUI();
      }
    } else if (e.status === 401) {
      RS.auth.sessionExpired();
    } else {
      alert("保存到云端失败：" + e.message);
    }
  }

  async function pullVersion(id) {
    const full = await RS.api.getResume(id.slice(1));
    state.versions[id] = {
      name: full.name, data: full.data, style: full.style,
      applications: full.applications || []
    };
    revs[id] = full.revision;
  }

  function findSec(sid) { return cur().data.sections.find(s => s.id === sid); }
  function findItem(sid, iid) {
    const s = findSec(sid);
    return s ? s.items.find(i => i.id === iid) : null;
  }

  return {
    init, get, cur, save, findSec, findItem,
    userEmail, isAdmin, enterCloud, leaveCloud, newVersion, deleteVersion
  };
})();
