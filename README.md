# Peanut Admin Core Web

Core Web 提供六个公共包。`@peanut-admin/client` 负责请求与会话原语，`@peanut-admin/vue` 负责 Vue 状态和组合函数，`@peanut-admin/ui-vue` 负责通用组件与 Shell。`@peanut-admin/nuxt` 和 `@peanut-admin/uniapp` 适配各自传输，`@peanut-admin/testing` 提供测试辅助。业务页面、状态、权限键及 API 由宿主和所属模块维护。

## 客户端与会话

宿主为每个应用实例或请求创建一个 `createSessionRecovery`，供 Axios 与 `createSessionFetch` 共用。Core 合并同一会话的刷新，检查令牌及会话身份，支持调用者取消，并按宿主声明的路由规则最多重放一次。内存刷新协调器从 Client 导出，Vue 保留公开导出。浏览器刷新协调器负责 Web Locks 和 BroadcastChannel。

宿主提供 `current`、`isRefreshable`、Cookie 刷新操作、明确的 `isRefreshRejected` 判断和 `invalidate`。清理会话与导航前必须再次匹配预期会话和令牌。网络失败、取消、权限拒绝以及旧会话的迟到响应都应保留当前登录。为 `createSessionFetch` 提供受信来源与受众判断及响应分类器。只允许重放在业务执行前就会拒绝无效认证的路由。

请求 data 类型可通过 `createClient<TRequestData>`、`createNuxtClientTransport<TRequestData>` 和 `createUniAppClientTransport<TRequestData>` 保持到 I/O 回调，默认仍为 `unknown`。Nuxt 回调的 method 为 Client 的七种大写方法；UniApp 的跨端原生方法集为 GET、HEAD、POST、PUT、DELETE、OPTIONS，PATCH 在 adapter 入口拒绝，不转成 POST 或新增备用请求路径。未知响应由 decoder 首次校验，Core 将错误 code/message 规范一次后交给应用错误 hook。

Vue 的 auth/context stores、`useAccess` 和导航 registry 是包根导出的公共能力；context stores 供 `useAccess` 读取当前 audience 的权限，导航 registry 在可信路由和服务端菜单之间按 name 解析并承担模块切换清理。它们不自动接管宿主已有业务登录和菜单实现。UI 的 `defineShellHostConfig` 只接收展示配置，保留未知字段拒绝与展示值规范；身份、令牌、权限及业务配置不进入 shell 配置。UniApp H5 的配置失败停站由应用入口处理，不能替换成自动回退站点。

Client 还导出 `createSessionSync`、`readBrowserSession`、`writeBrowserSession`、`newBrowserSessionIdentity`、`createPlatformSession` 和 `formatRequestError`。跨标签页通知传递事件和来源标签页标识。身份和 bearer 通过单次 storage 写入提交。宿主负责实际登录协议、租户切换和路由。

UI 的按需入口、主题、布局、导航与应用覆写见 [ui-vue README](packages/ui-vue/README.md)。

Client 请求支持可选标准 `AbortSignal`，Nuxt transport 传给 fetch，UniApp transport 连接 `RequestTask.abort()`。预取消不发送请求；在途取消返回 `AbortError`，完成/失败/取消后清理监听，不把取消解码为业务错误或认证失败。Vue async action/list 的 generation 和 scope dispose 继续负责晚到结果与作用域清理；应用按组件/任务传 signal，不能用全局取消中断其他租户或请求。该能力不创建业务事件总线或共享登录态；SSR Client 与业务 runtime 仍按 app/请求创建。

认证请求绑定发送时的令牌。会话变化后，旧请求返回 `CLIENT_SESSION_CHANGED`。宿主实现的异步 `clear(expectedToken)` 在提交清理前重新核对当前令牌。`auth: false` 的认证失败不会清理登录态或触发全局 unauthorized hook。

常规验证：Node 22 与 `packageManager` 固定的 pnpm 下运行 `pnpm install --frozen-lockfile && pnpm test`。测试先构建当前 workspace 的包间导出，再仅发现当前 `packages/*/tests`；不会加载 `.worktrees` 中其他分支。`pnpm test:tooling` 验证打包/诊断工具；真实应用 SSR、浏览器和数据库资格由应用仓另验，不把包级单元测试外推为整站通过。

日常开发使用 `dev`；`main` 只承载已批准的发布版本。

## Core 包生产与验证

CI 默认 `mode=production`：固定非空的精确 `expected_source_commit`，一次 inputs/build/pack，再做六包完整性、Client 边界及原生干净消费者安装/Vite 构建。此模式不运行 Vitest 或 Node tooling 完整套件，两组及 full qualification 均记录 **NOT_RUN**。显式 `mode=qualification` 才在同一原生生产链运行上述完整套件；`expected_source_commit` 可选，填写则同样严格校验。`pnpm run verify:a1` 保留默认完整 qualification 行为。

显式 `mode=identity` 仍要求精确 `expected_source_commit`，在两个独立检出中原生制包并逐字节比较；不执行消费者资格、不授予发行准入，`web-core-identity-*` 不能用于 tag 发行。CI 不取消已有运行。

开发使用 pnpm workspace。所有包输出 `dist` JavaScript 和声明文件，并通过明确的根导出消费。生产输入政策为 `tools/build-inputs.json`：Linux/x64 的官方 Node 22.23.2 分发及实际执行文件 SHA、内置 zlib 版本/由 Node 文件覆盖的身份、npm 11.5.1/pnpm 10.15.0/TypeScript 5.9.3 官方分发 SHA 及完整模块内容身份、源 pnpm 锁、实际脚本/构建配置摘要和固定参数。模块包含其打包附带依赖，不能只用版本字符串代替实际编译器或 pack 工具内容。原生安装生成的 `.bin` 相对链接仅在目标位于已摘要模块、且精确对应同层依赖的 `package.json#bin` 时排除于分发 payload 摘要；其他链接及特殊类型拒绝。安装前缀不写入合同；发行 build 复用现有全包 writer，在各包目录按依赖先后直接用已核 Node 执行已核 TypeScript `bin/tsc -p tsconfig.json`，不经包级 `.bin/tsc` 或 `.bin/node`；资格测试在该 build 后直接执行原 `vitest run`，不再隐式重复日常 build。工具按实际解析的模块和固定 Node 执行，不能以忽略路径掩盖工具查找变化。不采集整机包表、kernel、CPU、机器名或全部 process.versions。

生产顺序是原锁原生安装后，`node scripts/release-identity.mjs inputs` → `node scripts/release-identity.mjs build` → `node scripts/release-identity.mjs pack`。`inputs` 只采集/验证实际输入，不构建、不制包、不授予资格；默认封存到 `.local/build-inputs.json`，`CORE_BUILD_INPUTS` 可选独立候选文件。初次封存成为本候选期望，已存在文件只允许完全相同的有效输入，不覆写为新来源。build 复用既有 Core writer 直接调用已核 Node 和 TypeScript，pack 仍用标准 npm pack；两者在执行前后实际重采，漂移拒绝。子进程排除 ambient npm_config，固定空 Node options/path、不同路径的零字节普通 user/global npm config 与 locale（只安全创建，不截断已有内容；前后重核），项目自身配置仍随 source 记录。日常源码构建入口未变。

`release-identity.json` schema 2 绑定 `build-inputs.json` 原始字节、完整 effective inputs、六包 SHA-256/SHA-512 和消费者锁。`checks.packageConsumer=PASS` 表示原生消费者与包检查完成；`checks.mode` 区分 production/qualification，`checks.vitest`、`checks.tooling` 保存 PASS/NOT_RUN 与计数。仅完整 qualification 成功时 `qualified=true`；production 为 `qualified=false`、`checks.fullQualification=NOT_RUN`，但具备包消费发行准入。只有 pack、identity 比较或缺少 checks 的旧原件均不能发行，不补填未知测试结果。

发行只核指定成功 CI 的原件：真实 Git commit/tree、源码及版本、固定供应政策、seal、消费者锁、包摘要，以及原 seal 的 GitHub run/attempt。保持同树合并规则；发布宿主不必拥有未参与构建的编译器。当前 digest/registry verifier 的 Node/Git 身份另存 `verification-inputs.json`，跨发行步骤漂移拒绝。归档、包消费合格、完整资格与 npm 已发行分别记录。

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

本仓通过注释式 `vX.Y.Z` tag 触发六包 npm OIDC 发行。后续复用既有已验证的可信发布者绑定和发布权限，不每次重新授权、设置绑定或轮换凭据；仅仓库、工作流、发布身份变化，或发生真实权限失败时，核对受影响的绑定。每个版本仍须取得当次正式发行授权。当前渠道版本及内容以 npm/GitHub 公开结果为准，开发分支不代表已发行包。
