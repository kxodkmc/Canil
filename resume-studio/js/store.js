"use strict";
window.RS = window.RS || {};

/* 状态存取：唯一持有 state 的模块，数据只存云端。
   登录后：版本与服务端一一对应（id = "r" + 服务端 id），所有同步必须由用户
   点击「保存更改到云端」手动触发（save 仅标脏，flush 才推送）；
   未登录：仅持有内存空状态供遮罩下的 UI 渲染，不落任何本地存储。 */
RS.store = (function () {
  let state = null;
  let user = null;
  let revs = {};       // 版本 id -> 服务端 revision（乐观锁）
  let dirty = new Set();   // 待同步云端的版本 id（编辑时标记，手动保存成功后摘除）
  let pushing = null;      // 进行中的推送 Promise：所有推送严格串行，杜绝并发 409

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
    dirty.clear();
    markDirtyUI();
    user = null;
    revs = {};
    state = RS.model.freshState();
  }

  async function pullCloud() {
    dirty.clear();
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
    dirty.delete(id);
    state.order = state.order.filter(x => x !== id);
    if (state.currentId === id) state.currentId = state.order[0];
  }

  /* 任何本地变更都经 save()：仅标记当前版本为脏（内存态），绝不自动推送。
     同步云端必须由用户点击工具栏「保存更改到云端」触发 flush()。 */
  function save() {
    if (state && state.currentId) dirty.add(state.currentId);
    markDirtyUI();
  }

  /* 未保存版本数（供 UI 提示） */
  function dirtyCount() { return dirty.size; }

  /* 保存按钮状态：有未保存更改时高亮提示 */
  function markDirtyUI() {
    const btn = document.getElementById("saveCloudBtn");
    if (!btn) return;
    const n = dirty.size;
    btn.classList.toggle("dirty", n > 0);
    btn.textContent = n > 0 ? "保存更改到云端 · 有未保存更改" : "保存更改到云端";
  }

  /* 手动推送（唯一同步入口，由「保存更改到云端」按钮触发）。
     失败的版本进入 failed 隔离，本轮不再重试，保留脏标记等待下次手动保存。 */
  async function flush() {
    if (pushing) return pushing;                 // 串行：在途推送未结束时复用同一 Promise
    pushing = (async () => {
      const failed = new Set();
      try {
        while (dirty.size) {
          const ids = [...dirty].filter(id => !failed.has(id));
          if (!ids.length) break;
          for (const id of ids) {
            dirty.delete(id);
            if (!state.versions[id]) continue;   // 已被删除的版本
            try { await syncVersion(id); }
            catch (e) { failed.add(id); await onSaveError(e, id); }
          }
        }
        await RS.api.putState({ order: state.order, currentId: state.currentId });
      } catch (e) {
        if (e && e.status === 401) RS.auth.sessionExpired();
        else { console.error("保存到云端失败：", e); alert("保存到云端失败：" + (e && e.message ? e.message : e)); }
      } finally {
        pushing = null;
        markDirtyUI();
      }
    })();
    return pushing;
  }

  async function syncVersion(id, opts) {
    const v = state.versions[id];
    const full = await RS.api.updateResume(id.slice(1), {
      name: v.name, data: v.data, style: v.style,
      applications: v.applications || [], revision: revs[id]
    }, opts);
    revs[id] = full.revision;
  }

  async function onSaveError(e, id) {
    if (!state.versions[id]) return;
    if (e.status === 409) {
      if (confirm("「" + state.versions[id].name + "」已在其他设备被修改。\n\n确定 = 用当前内容覆盖远端\n取消 = 拉取远端最新版（放弃本次修改）")) {
        if (e.detail && e.detail.revision) revs[id] = e.detail.revision;
        try { await syncVersion(id); } catch (err) { dirty.add(id); alert("覆盖失败：" + err.message); }
      } else {
        await pullVersion(id);
        RS.refreshUI();
      }
    } else if (e.status === 401) {
      dirty.add(id);                             // 刷新会话后由 flush 接力重试
      RS.auth.sessionExpired();
    } else {
      dirty.add(id);                             // 网络类错误：保留脏标记，下次 save/flush 重试
      console.error("保存到云端失败：", e);
    }
  }

  /* 未保存数据时阻止直接关闭页面，提醒用户先点击「保存更改到云端」。
     注意：不做任何自动推送——同步只由用户手动触发。 */
  window.addEventListener("beforeunload", e => {
    if (dirty.size) { e.preventDefault(); e.returnValue = ""; }
  });

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
    init, get, cur, save, flush, dirtyCount, findSec, findItem,
    userEmail, isAdmin, enterCloud, leaveCloud, newVersion, deleteVersion
  };
})();
