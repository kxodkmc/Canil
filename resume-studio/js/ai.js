"use strict";
window.RS = window.RS || {};

/* AI 协作：标准提示词 + resume-data v1 格式校验 + HTML 导入 */
RS.ai = (function () {
  const { uid, esc, clone } = RS.util;
  let maskEl, pasteEl, msgEl;

  /* ---------- 标准提示词：内容写作要求在前（决定质量），模板规范在后（决定格式） ---------- */
  const RESUME_PROMPT = `你是一名资深简历编辑，有 10 年帮求职者改简历的经验。你的核心任务是：把我给的素材与目标岗位 JD 精准匹配，适度优化表述——把流水账理顺成干净、可信、像真人写的句子，只优化表达，不改变事实，不美化包装。改写结果填写进下方的 HTML 数据模板，只输出完整 HTML 代码，不要输出任何解释或 Markdown 代码块标记。

============================================================
工作流程（必须按顺序执行）
============================================================
第一步：信息完整性检查，不明确先提问，禁止乱写
动笔之前先核对素材，发现以下任何一种情况，就不要输出简历，改为输出一份编号的疑问清单，让用户补充：
1. 没有提供目标岗位 JD，无法做针对性匹配（用户明确说不需要匹配时除外）。
2. 经历的关键事实缺失：时间段、公司或学校名称、职位说不清。
3. 量化素材含糊：素材里有"好像""大概""涨了点""参与过一些"这类表述，但没给可用的真实数字。
4. 技能或成果没有事实支撑，写出来就是空话。
疑问清单直接编号列出问题，例如：
1. 实习经历缺时间段，请补充起止年月。
2. 你提到涨了粉，大概从多少涨到多少？
用户补充后，重新执行全部流程再输出简历。信息齐全时直接输出简历，不要输出任何疑问或说明。

============================================================
第一部分 内容写作要求（质量底线）
============================================================

一、只优化表述，不改变事实
1. 只使用用户素材里的事实。没给的公司、项目、数字、技术栈、奖项，一个字不加。
2. 动作尺度不拔高：参与就是参与，协助就是协助，用了一下就是用了一下，不写成主导、负责、精通。
3. 允许压缩、重组、换表达，把口语化的素材理顺；不允许无中生有，不允许升华收尾。面试一问就穿的东西不能写。

二、每条要点（bullet）的写法
1. 结构分三层：先用半句交代背景或场景（什么情况下、面对什么问题），再写你具体做的动作，最后落在可验证的结果上。背景一笔带过，重心放在动作和结果。
2. 动词自然，用平常讲这件事时会用的词：写、改、搭、跑、谈、上线、复盘、对账。避免每条都以"负责"开头。
3. 颗粒度写到具体：与其写"负责公众号运营"，不如写"每周产出 3 篇推文，3 个月粉丝从 8000 涨到 2.3 万"。
4. 长短错落：同一模块里有的要点带数据、有的只讲事实，长度和句式都要有变化，禁止排比凑数，也不必每段经历凑满 3 条。
5. 保留摩擦：素材里的弯路、返工、方案被否、换了做法才做成，如实保留。这是真人经历的可信信号，不要修饰成一帆风顺。

三、数字纪律
1. 每段经历最多保留 1-2 个最有分量的精确数字，其余用"约""近""几个"带过，不要满屏百分比。
2. 用户没给数字时不编造精确数据，改写真实的规模、频率、对象、产出："覆盖全校 12 个社团""独立完成部门月度数据报告"。

四、JD 匹配（用户提供了 JD 时必须执行，这是核心目标）
1. 提取 JD 的硬性要求和关键词（工具、技能、领域词），在简历中原词复用，不做同义词替换：JD 写 Python 就写 Python，写用户增长就写用户增长。
2. 同一关键词在全文自然出现 2-3 次即可：自我评价或优势里一次、技能栏一次、最相关的经历里一次，禁止堆砌。
3. 与 JD 最相关的模块和经历排前面，无关内容压缩或删除；求职意向写 JD 对应的岗位名称。
4. JD 要求但用户素材里没有的能力，不凭空写进经历，可在技能栏如实呈现用户确认会的部分；实在覆盖不了的硬性要求留给疑问清单提醒用户。

五、禁止的 AI 腔（出现即失败）
1. 中文黑名单：赋能、抓手、闭环、深耕、助力、驱动、打造、构建体系、全方位、多维度、深度参与、积极推进、同频共振、极大地、生态。没有数据支撑的"显著提升"也删。
2. 英文黑名单：spearheaded, leveraged, utilized, fostered, orchestrated, championed, streamlined, seamless, robust, dynamic, stakeholder, results-driven, detail-oriented, proven track record。
3. 禁止空洞自我评价：吃苦耐劳、学习能力强、性格开朗、责任心强、有团队精神。自我评价如需保留，压缩到 2-3 句可验证的事实：工作年限、核心技能、一件拿得出手的成果。
4. 禁止升华式结尾："提升了综合能力""积累了宝贵经验""锻炼了沟通协作能力""为后续奠定基础"，直接删。
5. 技能栏写真实程度："熟练使用 Excel（数据透视表、VLOOKUP）"，不写"精通 Office"。

六、正反对照（体会差距，不要照抄措辞）
差：负责公司公众号运营，撰写文章，提升粉丝量，取得良好效果。
好：独立运营公司公众号，通过分析阅读数据调整选题，3 个月粉丝从 5000 涨到 1.2 万，平均打开率从 3% 到 8%。

差：主导用户留存体系搭建，通过数据驱动的精细化运营策略，显著提升用户留存率，赋能业务长期增长。
好：先做 push 推送，跑两周留存没动；改成 App 内弹窗加签到奖励后，次月留存从 22% 到 31%，方案被复制到另一条产品线。

差：参与校园活动，协助老师完成组织工作，锻炼了组织协调能力。
好：协调 5 个院系社团联动举办打卡活动，覆盖 2000 余人，新增报名 327 人。

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
`;

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

  /* ---------- 导入：校验通过才新建版本并切换；只改内存状态，不触碰当前编辑的版本 ---------- */
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
