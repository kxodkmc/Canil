"use strict";
window.RS = window.RS || {};

/* AI 协作：标准提示词 + resume-data v1 格式校验 + HTML 导入 */
RS.ai = (function () {
  const { uid, esc, clone } = RS.util;
  let maskEl, pasteEl, msgEl;

  /* ---------- 标准提示词：内容写作要求在前（决定质量），模板规范在后（决定格式） ---------- */
  const RESUME_PROMPT = `你是一名资深简历编辑，有 10 年帮求职者改简历的经验，熟悉 HR 的真实筛选方式：一份简历平均只被扫 6–10 秒，能留住 HR 的只有事实、数字和与岗位的贴合度。请把【我的简历内容】改写成一份 HR 愿意多看 30 秒的简历，填写进下方的 HTML 数据模板，只输出完整 HTML 代码，不要输出任何解释或 Markdown 代码块标记。

============================================================
第一部分 内容写作要求（先读这部分，这是质量底线）
============================================================

一、真实性是底线，禁止编造
1. 只能使用用户提供的素材。用户没给的公司、项目、数字、奖项、技能，一律不得虚构。
2. 用户没提供量化数据时，禁止编造精确百分比（如"提升 37%"）。可以写真实的规模、频率、对象、产出物："独立完成部门月度数据报告""覆盖全校 12 个社团""每周产出 3 篇"。
3. 允许压缩、重组、换表达，但不允许无中生有。面试时编出来的东西一问就穿。

二、要点（bullet）的写法
1. 每条要点 = 动作动词开头 + 具体做了什么 + 可验证的结果。
2. 每段经历只保留 2–3 条最能打的要点。把"负责公众号运营，撰写推文"这种岗位说明书式的描述删掉——它只证明你干过，不证明你干得好。
3. 动词开头，避免每句都以"负责"开头：主导、搭建、协调、优化、独立完成、从零做起，按实际情况选用。
4. 不要每条要点同构同长。有的要点给数据，有的只给事实，长短错开。也不是每段经历都必须凑满 3 条。
5. 结果无法量化时写清规模或产出："参与 200 人规模的校园活动统筹，方案被校团委采纳"，比空泛的"取得良好效果"有力得多。

三、贴合目标岗位（用户给了 JD 时必须执行）
1. 提取 JD 里的关键词和硬性要求（工具、技能、经验年限），简历里使用与 JD 一致的用词。
2. 把与 JD 最相关的模块和经历排在前面；与岗位无关的内容压缩或删除。
3. 求职意向字段直接写 JD 对应的岗位名称。

四、禁止事项（这些是一眼假的"AI 味"，HR 看到直接扔）
1. 禁止空洞自我评价：吃苦耐劳、学习能力强、性格开朗、责任心强、有团队精神。如需自我评价模块，改成 2–3 句可验证的事实：工作年限、核心技能、一件拿得出手的成果。
2. 禁止升华式结尾："提升了综合能力""积累了宝贵经验""锻炼了沟通协作能力"——直接删。
3. 禁止浮夸修饰词：极大地、全方位、多维度、深度赋能、闭环、抓手、深耕、生态、同频共振。没有数据支撑的"显著提升"也删掉。
4. 禁止对称凑数：每段经历恰好 3 条、每条恰好一个百分比、排比句式。真实材料就是不均匀的。
5. 技能栏写真实程度："熟练使用 Excel（数据透视表、VLOOKUP）"，不写"精通 Office"。

五、正反对照（体会差距，不要照抄措辞）
差：负责公司公众号运营，撰写文章，提升粉丝量，取得良好效果。
好：独立运营公司公众号，通过分析阅读数据调整选题，3 个月粉丝从 5000 涨到 1.2 万，平均打开率从 3% 到 8%。

差：本人性格开朗，吃苦耐劳，有较强的沟通能力和团队合作精神。
好：2 年新媒体运营经验，独立运营账号从 0 做到 10 万粉丝，单篇最高阅读 85 万。

差：参与校园活动，协助老师完成组织工作，锻炼了组织协调能力。
好：协调 5 个院系社团联动举办打卡活动，活动覆盖 2000 余人，新增报名 327 人。

============================================================
第二部分 模板规范 resume-data v1（格式要求，严格遵守）
============================================================
1. 根节点必须是 <resume-data version="1">，所有内容放在其中。
2. <profile> 内：必须有且只有一个 <name>姓名</name>；随后是若干个 <field label="标签">内容</field>，常用标签：出生年月、电话、邮箱、求职意向、民族、政治面貌，可按需增删。
3. 每个大模块是一个 <section title="模块名">，模块顺序即简历中的先后，按与目标岗位的相关性排序；常用模块：教育背景、技能与证书、实习经历、项目经历、荣誉奖项、自我评价。
4. 模块内每条经历是一个 <item>，属性全部可选：date="时间段" title="公司/学校/项目名称" role="职位/角色" link="项目链接"。
5. <item> 内：<desc>一段补充说明</desc>（可选，最多一段，如主修课程）；<bullet>一条要点</bullet>（每条 1–2 行，按第一部分要求写）。
6. 文本中的 & < > 必须转义为 &amp; &lt; &gt;；不要使用模板以外的任何标签或属性。
7. 内容总量按 1 页 A4 控制，写不下的从最不相关的开始删。

【空白模板示例】
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>简历数据</title></head>
<body>
<resume-data version="1">
  <profile>
    <name>张三</name>
    <field label="电话">13800000000</field>
    <field label="邮箱">example@qq.com</field>
    <field label="求职意向">目标岗位</field>
  </profile>
  <section title="教育背景">
    <item date="2023.09–2027.06" title="某某大学" role="某某专业（本科）">
      <desc>主修课程：……</desc>
    </item>
  </section>
  <section title="实习经历">
    <item date="2026.07–2026.09" title="某公司" role="某岗位实习生">
      <bullet>动作动词开头 + 具体做了什么 + 可验证的结果</bullet>
    </item>
  </section>
  <section title="项目经历">
    <item date="2026.05–至今" title="某项目" role="个人项目" link="github.com/xxx">
      <bullet>……</bullet>
    </item>
  </section>
  <section title="技能与证书">
    <item>
      <bullet>熟练使用 Excel（数据透视表、VLOOKUP）……</bullet>
    </item>
  </section>
</resume-data>
</body>
</html>

============================================================
【我的简历内容】
（在下面粘贴你的简历原文 / 经历素材。有目标岗位 JD 的话务必一并粘贴，并注明哪部分是 JD，AI 会按 JD 针对性排序和用词）`;

  /* ---------- 复制提示词（带降级方案） ---------- */
  function copyPrompt() {
    const ok = () => alert("提示词已复制！\n\n使用方式：\n1. 粘贴给任意 AI（ChatGPT / Claude / Kimi 等）\n2. 在末尾附上你的简历内容；有目标岗位 JD 务必一并粘贴并注明\n3. 让 AI 输出完整 HTML 代码\n4. 回到这里点「AI 导入」——直接粘贴文本或选择文件均可，会自动校验并新建版本");
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(RESUME_PROMPT).then(ok, () => fallbackCopy(ok));
    else fallbackCopy(ok);
  }
  function fallbackCopy(ok) {
    const ta = document.createElement("textarea");
    ta.value = RESUME_PROMPT;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); ok(); }
    catch (e) { alert("复制失败，请检查浏览器权限后重试。"); }
    document.body.removeChild(ta);
  }

  /* ---------- 解析并校验 AI 生成的 HTML（resume-data v1）。返回 { errors, warnings, data } ---------- */
  function parseResumeHTML(text) {
    const errors = [], warnings = [];
    const clean = s => (s == null ? "" : String(s)).trim();
    if (!/<resume-data[\s>]/i.test(text)) {
      errors.push("未找到 <resume-data> 根节点：这不是按「AI 提示词」模板生成的文件。");
      return { errors, warnings };
    }
    const doc = new DOMParser().parseFromString(text, "text/html");
    const root = doc.querySelector("resume-data");
    const kids = el => Array.from(el.children);
    const is = (el, tag) => el.tagName.toUpperCase() === tag;

    /* 个人信息 */
    let name = "", photo = null;
    const fields = [];
    const profEl = kids(root).find(el => is(el, "PROFILE"));
    if (!profEl) errors.push("缺少 <profile> 节点。");
    else {
      const nameEl = kids(profEl).find(el => is(el, "NAME"));
      name = clean(nameEl && nameEl.textContent);
      if (!name) errors.push("缺少姓名：<profile> 内必须有非空的 <name> 节点。");
      kids(profEl).filter(el => is(el, "FIELD")).forEach((f, i) => {
        const label = clean(f.getAttribute("label"));
        if (!label) { errors.push("第 " + (i + 1) + " 个 <field> 缺少 label 属性。"); return; }
        fields.push({ id: uid(), label, value: clean(f.textContent) });
      });
      const photoEl = kids(profEl).find(el => is(el, "PHOTO"));
      if (photoEl && clean(photoEl.textContent)) {
        const src = clean(photoEl.textContent);
        if (/^(https?:\/\/|data:image\/)/i.test(src)) photo = src;
        else warnings.push("<photo> 不是有效图片地址（http(s):// 或 data:image/），已忽略。");
      }
    }

    /* 内容模块 */
    const secEls = kids(root).filter(el => is(el, "SECTION"));
    if (!secEls.length) errors.push("未找到任何 <section> 模块节点。");
    const sections = [];
    secEls.forEach((sec, si) => {
      const title = clean(sec.getAttribute("title"));
      if (!title) { errors.push("第 " + (si + 1) + " 个 <section> 缺少 title 属性（模块名）。"); return; }
      const items = [];
      kids(sec).filter(el => is(el, "ITEM")).forEach(it => {
        const descEl = kids(it).find(el => is(el, "DESC"));
        const bullets = kids(it).filter(el => is(el, "BULLET")).map(b => clean(b.textContent)).filter(Boolean);
        const itm = RS.model.entry(
          clean(it.getAttribute("date")), clean(it.getAttribute("title")),
          clean(it.getAttribute("role")), clean(descEl && descEl.textContent),
          bullets, clean(it.getAttribute("link")));
        const empty = !itm.date && !itm.title && !itm.role && !itm.desc && !itm.bullets.length && !itm.link;
        if (empty) warnings.push("模块「" + title + "」中有一条完全空白的 <item>，已跳过。");
        else items.push(itm);
      });
      if (!items.length) warnings.push("模块「" + title + "」没有任何有效 <item>。");
      sections.push(RS.model.section(title, items));
    });

    return { errors, warnings, data: { profile: { name, photo, fields }, sections } };
  }

  /* ---------- 导入：校验通过才新建版本并切换；当前编辑的版本已在本地自动保存，绝不被修改 ---------- */
  async function importHTMLText(text, onError) {
    const r = parseResumeHTML(String(text || ""));
    if (r.errors.length) {
      onError("发现 " + r.errors.length + " 处格式错误：\n" +
        r.errors.slice(0, 8).map((x, i) => (i + 1) + ". " + x).join("\n") +
        "\n\n当前简历未受任何影响。可把错误信息反馈给 AI，让它修正后重新生成。");
      return false;
    }
    const state = RS.store.get();
    const base = (r.data.profile.name || "未命名") + " · AI 导入";
    let name = base, n = 2;
    while (state.order.some(id => state.versions[id].name === name)) name = base + " (" + (n++) + ")";
    state.currentId = await RS.store.newVersion({
      name, data: r.data, style: clone(RS.store.cur().style), applications: []
    });
    RS.versions.refreshAll();
    alert("导入成功！已新建版本「" + name + "」并切换过去，原版本保持不变。" +
      (r.warnings.length ? "\n\n提醒：\n" + r.warnings.slice(0, 6).map((x, i) => (i + 1) + ". " + x).join("\n") : ""));
    return true;
  }

  /* ---------- 导入弹层 ---------- */
  function showMsg(text) {
    msgEl.className = "err";
    msgEl.style.display = "block";
    msgEl.textContent = text;
  }
  function openImport() {
    msgEl.className = ""; msgEl.style.display = "none"; msgEl.textContent = "";
    maskEl.classList.add("open");
    pasteEl.focus();
  }
  function closeImport() { maskEl.classList.remove("open"); }

  async function onMaskClick(e) {
    const act = (e.target.closest("[data-action]") || {}).dataset;
    if (act && act.action === "close-html") return closeImport();
    if (act && act.action === "import-html-file") return RS.util.$("importHTMLFile").click();
    if (act && act.action === "import-html-paste") {
      const text = pasteEl.value;
      if (!text.trim()) return showMsg("粘贴框是空的：先把 AI 返回的 HTML 全文粘进来，或改用文件导入。");
      const ok = await importHTMLText(text, showMsg);
      if (ok) { pasteEl.value = ""; closeImport(); }
      return;
    }
    if (e.target === maskEl) closeImport();
  }

  function onImportFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await importHTMLText(String(reader.result || ""), showMsg);
      if (ok) { pasteEl.value = ""; closeImport(); }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  function init() {
    maskEl = RS.util.$("htmlMask");
    pasteEl = RS.util.$("htmlPaste");
    msgEl = RS.util.$("htmlImportMsg");
    maskEl.addEventListener("click", onMaskClick);
    RS.util.$("importHTMLFile").addEventListener("change", onImportFile);
  }

  return { copyPrompt, openImport, init };
})();
