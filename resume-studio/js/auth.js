"use strict";
window.RS = window.RS || {};

/* 登录/注册/会话：遮罩表单 + 工具栏账号按钮。会话数据由 RS.store 管理，本模块只管 UI 与交互。 */
RS.auth = (function () {
  const $ = RS.util.$;
  let mask, panel, loading, form, emailEl, passEl, msgEl, submitBtn, modeBtn, titleEl, authBtn;
  let isRegister = false;

  /* show(formVisible)：true 显示表单，false 显示加载态。默认：未登录显示表单 */
  function show(formVisible) {
    mask.classList.add("open");
    const showForm = formVisible !== undefined ? formVisible : !RS.store.userEmail();
    loading.style.display = showForm ? "none" : "";
    form.style.display = showForm ? "" : "none";
  }

  function hide() { mask.classList.remove("open"); }

  function showMsg(text) {
    msgEl.hidden = false;
    msgEl.textContent = text;
  }

  function syncForm() {
    titleEl.textContent = isRegister ? "注册" : "登录";
    submitBtn.textContent = isRegister ? "注册并登录" : "登录";
    modeBtn.textContent = isRegister ? "已有账号？去登录" : "没有账号？注册";
    passEl.placeholder = isRegister ? "设置密码（至少 8 位）" : "密码";
    msgEl.hidden = true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const email = emailEl.value.trim();
    const password = passEl.value;
    submitBtn.disabled = true;
    try {
      const user = isRegister ? await RS.api.register(email, password) : await RS.api.login(email, password);
      await RS.store.enterCloud(user);
      RS.refreshUI();
      syncButton();
      hide();
    } catch (err) {
      showMsg(err.message || "操作失败，请稍后再试");
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function onAuthBtn() {
    if (!RS.store.userEmail()) {
      isRegister = false;
      syncForm();
      return show(true);
    }
    if (!confirm("退出登录？云端数据将不再同步。")) return;
    try { await RS.api.logout(); } catch (e) { /* 会话已失效也继续退出 */ }
    RS.store.leaveCloud();
    RS.refreshUI();
    syncButton();
    isRegister = false;
    syncForm();
    show(true);
  }

  function sessionExpired() {
    alert("登录已过期，请重新登录。");
    isRegister = false;
    syncForm();
    show(true);
  }

  function syncButton() {
    const loggedIn = !!RS.store.userEmail();
    authBtn.textContent = loggedIn ? RS.store.userEmail() + " · 退出" : "登录 / 注册";
    $("adminLink").hidden = !(loggedIn && RS.store.isAdmin());
  }

  /* 启动完成后的落点：已登录直接进入；否则必须登录 */
  function ready() {
    syncButton();
    if (RS.store.userEmail()) return hide();
    isRegister = false;
    syncForm();
    show(true);
  }

  function init() {
    mask = $("authMask");
    panel = $("authPanel");
    loading = $("authLoading");
    form = $("authForm");
    emailEl = $("authEmail");
    passEl = $("authPass");
    msgEl = $("authMsg");
    submitBtn = $("authSubmit");
    modeBtn = $("authModeBtn");
    titleEl = $("authTitle");
    authBtn = $("authBtn");
    form.addEventListener("submit", onSubmit);
    modeBtn.addEventListener("click", () => { isRegister = !isRegister; syncForm(); });
    authBtn.addEventListener("click", onAuthBtn);
    syncForm();
    show(false);   // 启动时先显示加载态，ready() 再决定去留
  }

  return { init, ready, sessionExpired };
})();
