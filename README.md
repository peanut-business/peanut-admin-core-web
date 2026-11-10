# Peanut Admin Core Web

5.1.0 adds `createSessionRecovery` and `createSessionFetch` to `@peanut-admin/client`. A host creates one recovery instance for its session and shares it between its Axios adapter and module fetch adapter. The Core owns generation/token checks, in-flight refresh coalescing, per-caller cancellation, one eligible replay and coalesced invalidation. The existing memory refresh coordinator is now owned by client and remains exported by Vue; the browser coordinator still owns its Web Locks/BroadcastChannel behavior. Vue declares the matching client peer dependency.

The host supplies `current`, `isRefreshable`, the actual cookie refresh operation, a definitive `isRefreshRejected` classifier and `invalidate`. Invalidation must compare the expected generation/token before committing local business cleanup and navigating. An expired credential needs no additional remote logout request. A rejected refresh invalidates only the issuing session; network failures, cancellation, forbidden responses and late responses from another login must not clear the current session. `createSessionFetch` additionally requires an origin/audience allow predicate and a response classifier; mark a route replayable only when its authentication rejection happens before business execution. Routes, error codes, account/tenant state, cookie protocol and login navigation belong to the host. Construct these instances per host app/request; do not share SSR sessions globally.

请求 data 类型可通过 `createClient<TRequestData>`、`createNuxtClientTransport<TRequestData>` 和 `createUniAppClientTransport<TRequestData>` 保持到 I/O 回调，默认仍为 `unknown`。Nuxt 回调的 method 为 Client 的七种大写方法；UniApp 的跨端原生方法集为 GET、HEAD、POST、PUT、DELETE、OPTIONS，PATCH 在 adapter 入口拒绝，不转成 POST 或新增备用请求路径。未知响应由 decoder 首次校验，Core 将错误 code/message 规范一次后交给应用错误 hook。

Vue 的 auth/context stores、`useAccess` 和导航 registry 是包根导出的公共能力；context stores 供 `useAccess` 读取当前 audience 的权限，导航 registry 在可信路由和服务端菜单之间按 name 解析并承担模块切换清理。它们不自动接管宿主已有业务登录和菜单实现。UI 的 `defineShellHostConfig` 只接收展示配置，保留未知字段拒绝与展示值规范；身份、令牌、权限及业务配置不进入 shell 配置。UniApp H5 的配置失败停站由应用入口处理，不能替换成自动回退站点。

UI 的按需入口、主题与 Element Plus 语义映射、布局/导航展示合同、完整与模块贡献 slots，以及同一 registry 的默认 → 预设 → 应用覆盖组合见 [ui-vue README](packages/ui-vue/README.md)。主题只作用于宿主拥有的元素；业务请求、权限过滤和路由继续由应用负责。

CI 默认 `mode=production`：固定非空的精确 `expected_source_commit`，一次 inputs/build/pack，再做六包完整性、Client 边界及原生干净消费者安装/Vite 构建。此模式不运行 Vitest 或 Node tooling 完整套件，两组及 full qualification 均记录 **NOT_RUN**。显式 `mode=qualification` 才在同一原生生产链运行上述完整套件；`expected_source_commit` 可选，填写则同样严格校验。`pnpm run verify:a1` 保留默认完整 qualification 行为。

显式 `mode=identity` 仍要求精确 `expected_source_commit`，在两个独立检出中原生制包并逐字节比较；不执行消费者资格、不授予发行准入，`web-core-identity-*` 不能用于 tag 发行。CI 不取消已有运行。

该仓承载 A1 的六个可复用 Web 公共包：`@peanut-admin/client`、`@peanut-admin/vue`、`@peanut-admin/ui-vue`、`@peanut-admin/nuxt`、`@peanut-admin/uniapp` 和 `@peanut-admin/testing`。`client` 不依赖 Vue 或浏览器 DOM；产品业务页面、状态、权限键和固定 API 归 Peanut Admin Code 的负责模块维护。

开发使用 pnpm workspace。所有包输出 `dist` JavaScript 和声明文件，并通过明确的根导出消费。生产输入政策为 `tools/build-inputs.json`：Linux/x64 的官方 Node 22.23.2 分发及实际执行文件 SHA、内置 zlib 版本/由 Node 文件覆盖的身份、npm 11.5.1/pnpm 10.15.0/TypeScript 5.9.3 官方分发 SHA 及完整模块内容身份、源 pnpm 锁、实际脚本/构建配置摘要和固定参数。模块包含其打包附带依赖，不能只用版本字符串代替实际编译器或 pack 工具内容。原生安装生成的 `.bin` 相对链接仅在目标位于已摘要模块、且精确对应同层依赖的 `package.json#bin` 时排除于分发 payload 摘要；其他链接及特殊类型拒绝。安装前缀不写入合同；发行 build 复用现有全包 writer，在各包目录按依赖先后直接用已核 Node 执行已核 TypeScript `bin/tsc -p tsconfig.json`，不经包级 `.bin/tsc` 或 `.bin/node`；资格测试在该 build 后直接执行原 `vitest run`，不再隐式重复日常 build。工具按实际解析的模块和固定 Node 执行，不能以忽略路径掩盖工具查找变化。不采集整机包表、kernel、CPU、机器名或全部 process.versions。

生产顺序是原锁原生安装后，`node scripts/release-identity.mjs inputs` → `node scripts/release-identity.mjs build` → `node scripts/release-identity.mjs pack`。`inputs` 只采集/验证实际输入，不构建、不制包、不授予资格；默认封存到 `.local/build-inputs.json`，`CORE_BUILD_INPUTS` 可选独立候选文件。初次封存成为本候选期望，已存在文件只允许完全相同的有效输入，不覆写为新来源。build 复用既有 Core writer 直接调用已核 Node 和 TypeScript，pack 仍用标准 npm pack；两者在执行前后实际重采，漂移拒绝。子进程排除 ambient npm_config，固定空 Node options/path、不同路径的零字节普通 user/global npm config 与 locale（只安全创建，不截断已有内容；前后重核），项目自身配置仍随 source 记录。日常源码构建入口未变。

`release-identity.json` schema 2 绑定 `build-inputs.json` 原始字节、完整 effective inputs、六包 SHA-256/SHA-512 和消费者锁。`checks.packageConsumer=PASS` 表示原生消费者与包检查完成；`checks.mode` 区分 production/qualification，`checks.vitest`、`checks.tooling` 保存 PASS/NOT_RUN 与计数。仅完整 qualification 成功时 `qualified=true`；production 为 `qualified=false`、`checks.fullQualification=NOT_RUN`，但具备包消费发行准入。只有 pack、identity 比较或缺少 checks 的旧原件均不能发行，不补填未知测试结果。

发行只核指定成功 CI 的原件：真实 Git commit/tree、源码及版本、固定供应政策、seal、消费者锁、包摘要，以及原 seal 的 GitHub run/attempt。保持同树合并规则；发布宿主不必拥有未参与构建的编译器。当前 digest/registry verifier 的 Node/Git 身份另存 `verification-inputs.json`，跨发行步骤漂移拒绝。归档、包消费合格、完整资格与 npm 已发行分别记录。

Client 请求支持可选标准 `AbortSignal`，Nuxt transport 传给 fetch，UniApp transport 连接 `RequestTask.abort()`。预取消不发送请求；在途取消返回 `AbortError`，完成/失败/取消后清理监听，不把取消解码为业务错误或认证失败。Vue async action/list 的 generation 和 scope dispose 继续负责晚到结果与作用域清理；应用按组件/任务传 signal，不能用全局取消中断其他租户或请求。该能力不创建业务事件总线或共享登录态；SSR Client 与业务 runtime 仍按 app/请求创建。

5.0.1 的六包使用统一版本。Client 的认证请求绑定发送时的令牌；会话令牌变化后，晚到的成功、业务失败或认证失败均返回 `CLIENT_SESSION_CHANGED`，不触发旧会话的错误 hook。并发认证失败按令牌合并清理；session 的异步 `clear(expectedToken)` 必须在提交清理前重新比对当前令牌，避免清掉新登录。清理期间切换会话时不触发旧会话的 unauthorized hook；`auth: false` 请求的认证失败不清理登录态或触发全局 unauthorized hook。历史 5.0.0 发行物保留，本次修复使用新的版本身份。

常规验证：Node 22 与 `packageManager` 固定的 pnpm 下运行 `pnpm install --frozen-lockfile && pnpm test`。测试先构建当前 workspace 的包间导出，再仅发现当前 `packages/*/tests`；不会加载 `.worktrees` 中其他分支。`pnpm test:tooling` 验证打包/诊断工具；真实应用 SSR、浏览器和数据库资格由应用仓另验，不把包级单元测试外推为整站通过。

日常开发使用 `dev`；`main` 只承载已批准的发布版本。该仓在 2026-09-17 从原 Core 单体仓的 `packages/web` 拆出，初始开发提交为 `46c17de0ebac8b3b43ba05c7c765b07df751b82b`。

正式包只由 CI 生产，本地开发验证独立，不上传本地包或 GitHub draft transport。macOS native Node 不满足 Linux x64 正式二进制 seal；本地 `pnpm test`/`pnpm test:tooling` 仅在获准测试时运行，不冒充 CI 正式包。CI 在原锁安装后调用现有入口：

```sh
# CI production job 实际入口；只在匹配 tools/build-inputs.json 的 producer 上执行。
TMPDIR="$PWD/.local/tmp" node scripts/verify-a1-packages.mjs production
# 完整资格为独立可选模式（包含测试）：
TMPDIR="$PWD/.local/tmp" node scripts/verify-a1-packages.mjs qualification
```

获准正式生产后，从最终提交所在远端分支 dispatch；SHA 必须与该次 workflow 的 HEAD 完全相同，否则在安装/构建前失败。已有同源码、同政策且原件仍可用的成功 CI 结果直接复用，不重新生产：

```sh
release_repo=peanut-business/peanut-admin-core-web
source_ref=dev
source_commit=$(git ls-remote origin "refs/heads/$source_ref" | cut -f1)
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]]
gh workflow run ci.yml --repo "$release_repo" --ref "$source_ref" \
  -f mode=production -f expected_source_commit="$source_commit"
# 另获完整测试授权时，将 mode=production 改为 mode=qualification。
gh run list --repo "$release_repo" --workflow ci.yml --commit "$source_commit"
```

从上述列表选择实际成功且具有 `web-core-qualified` 的 run（保留 artifact 名称，不表示 full qualification）：

```sh
qualification_run='替换为所选run数字ID'
gh run view "$qualification_run" --repo "$release_repo" \
  --json databaseId,headSha,status,conclusion,url
gh variable set CORE_QUALIFICATION_RUN_ID --repo "$release_repo" --body "$qualification_run"
gh variable get CORE_QUALIFICATION_RUN_ID --repo "$release_repo"
```

生产/变量设置与正式 tag 是分开的授权动作。后续获准后，按既有规则将同树提交进入 main，再创建指向当时 main 的注释式同版本 tag。tag workflow 只下载指定 run 的 `web-core-qualified`，验证后由原 npm OIDC publisher 发行同一次六包原件，不自动再 CI，不 build/test/pack。已有 npm 版本与新发行版本均实际下载 registry tarball 核 SHA-256；完全匹配的已发行包可在同 tag 重跑时跳过发布，随后接续 GitHub Release。

源码/tree、政策、版本、锁、seal 或包摘要变化不得继承原结果；CI artifact 缺失/过期或完整性不符时停止，不能换成本地包或把旧包重标为新来源。保留原证据，按实际失效范围另行授权 CI 生产。运行时刻变化不否定同一次原件的字节证据。

本仓由注释式 `vX.Y.Z` tag 触发六包发行，5.1.0 六包已通过 npm OIDC 实际发布成功。后续复用既有已验证的可信发布者绑定和发布权限，不每次重新授权、设置绑定或轮换凭据；仅仓库、工作流、发布身份变化，或发生真实权限失败时，核对受影响的绑定。每个版本仍须取得当次正式发行授权。当前渠道版本及内容以 npm/GitHub 公开结果为准，开发分支不代表已发行包。
