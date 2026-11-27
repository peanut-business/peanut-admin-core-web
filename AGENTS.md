# peanut-admin-core-web

**最高研发基准条款：Core 提供底层依赖、Scaffold 提供通用底座、Module 应用开发并发行共用能力、业务应用基于脚手架安装模块后实现业务。**

下位研发规则不能修改这四层职责。Web Core 仅负责通用无业务的客户端、Vue/Nuxt/UniApp 适配及基础 UI；共用业务组件/SDK 由 Module 作者，应用专属页面/状态由业务应用维护。实际 Core 无变化时不因模块功能更新重复构建发行。

Framework-neutral client, generic UI, Vue/Nuxt/UniApp adapters and testing. Code owns only the generic host shell; reusable business pages, state and Module SDKs belong to the Module author, while application-specific business pages/state belong to each business app.

Before editing, locate the authorized peanut-admin-project using Git common-dir/repos mapping; do not assume worktrees are adjacent. Treat Project `AGENTS.md` as the L0 entry, load `python3 scripts/docs-governance read --core --content`, then select only the task route(s) required by the current write set/risk. Read only the current task/stage portions of Project state documents when relevant; do not load STATUS/PLAN wholesale. Approval/implementation state lives only in Project, not copied here. Unavailable authoritative rules: report and limit to safe read-only inspection.

Use Project `docs-governance read --areas <areas>` only to locate domain rule IDs and `read --ids <ids> --content` for exact rules actually needed; follow Project AGENTS when a selected public Code rule requires an explicit Code candidate. After context compression/summary, model or executor switch, Session recovery, `history_lost`, or loss of certainty about the current task/write set/routes, reload Project AGENTS → core → current task route before the next rule-dependent write or expensive validation. Run full governance `check` only at the appropriate governance boundary, and run affected behavior tests for the actual Web Core change. Do not load entire handbook/API/migration data by default or file self-certified reading receipts. Rules suspected wrong: report evidence/impact and await the user's decision before changing semantics; pause only affected work.

Use the existing dev tree for ordinary serial changes; create isolated worktrees only for demonstrated concurrent write conflicts or an explicitly required qualification boundary. Preserve concurrent work; normal validated integration/push to dev, verify remote refs; never force/rewrite history. main, formal publication/deployment, real customer/financial data, paid plans, visibility and license changes require applicable authorization. No private rules, credentials or customer data in public repos.

Absorb useful rules/open issues before deleting confirmed duplicates or unused one-time tools; no archive/redirect stubs. Preserve live tests, migrations, licenses and others' resources. Docs-only changes neither prove runtime acceptance nor require repinning packages or unrelated product tests.
