# Peanut Admin Core Web

CI 默认 `mode=qualification` 保留完整资格。显式 `mode=identity` 须填写精确 `expected_source_commit`，仅在两个独立源码检出中按同一 pnpm 锁安装、构建，并由原生 `release-identity.mjs pack` 各生成六包；逐字节比较产物和输入清单，保存 `web-core-identity-*` artifact。该模式不运行测试或消费者资格、不标记 qualified、不发布；其 artifact 不能用于 tag 发行。CI 不取消已有运行。

该仓承载 A1 的六个可复用 Web 公共包：`@peanut-admin/client`、`@peanut-admin/vue`、`@peanut-admin/ui-vue`、`@peanut-admin/nuxt`、`@peanut-admin/uniapp` 和 `@peanut-admin/testing`。`client` 不依赖 Vue 或浏览器 DOM；产品业务页面、状态、权限键和固定 API 归 Peanut Admin Code 的负责模块维护。

开发使用 pnpm workspace。所有包输出 `dist` JavaScript 和声明文件，并通过明确的根导出消费。生产输入政策为 `tools/build-inputs.json`：Linux/x64 的官方 Node 22.23.2 分发及实际执行文件 SHA、内置 zlib 版本/由 Node 文件覆盖的身份、npm 11.5.1/pnpm 10.15.0/TypeScript 5.9.3 官方分发 SHA 及完整模块内容身份、源 pnpm 锁、实际脚本/构建配置摘要和固定参数。模块包含其打包附带依赖，不能只用版本字符串代替实际编译器或 pack 工具内容。原生安装生成的 `.bin` 相对链接仅在目标位于已摘要模块、且精确对应同层依赖的 `package.json#bin` 时排除于分发 payload 摘要；其他链接及特殊类型拒绝。安装前缀不写入合同；发行 build 复用现有全包 writer，在各包目录按依赖先后直接用已核 Node 执行已核 TypeScript `bin/tsc -p tsconfig.json`，不经包级 `.bin/tsc` 或 `.bin/node`；资格测试在该 build 后直接执行原 `vitest run`，不再隐式重复日常 build。工具按实际解析的模块和固定 Node 执行，不能以忽略路径掩盖工具查找变化。不采集整机包表、kernel、CPU、机器名或全部 process.versions。

生产顺序是原锁原生安装后，`node scripts/release-identity.mjs inputs` → `node scripts/release-identity.mjs build` → `node scripts/release-identity.mjs pack`。`inputs` 只采集/验证实际输入，不构建、不制包、不授予资格；默认封存到 `.local/build-inputs.json`，`CORE_BUILD_INPUTS` 可选独立候选文件。初次封存成为本候选期望，已存在文件只允许完全相同的有效输入，不覆写为新来源。build 复用既有 Core writer 直接调用已核 Node 和 TypeScript，pack 仍用标准 npm pack；两者在执行前后实际重采，漂移拒绝。子进程排除 ambient npm_config，固定空 Node options/path 与用户/全局 npm config、locale，项目自身配置仍随 source 记录。日常源码构建入口未变。

`release-identity.json` schema 2 绑定 `build-inputs.json` 原始字节摘要及全部 effective inputs，再封存六包 SHA-256/SHA-512 和消费者锁。仓内 `verify-a1` 在 build 前封存输入，执行原完整资格并实际消费六个最终包；只有成功才 qualified。资格核本次真实 producer 输入，发行读取原包时核可信 run、真实 Git 对象/tree、源码政策/固定供应约束、seal、qualified 和实际包摘要；不要求未参与重建的发布宿主拥有全部 compiler 二进制。当前 digest/registry verifier 的 Node/Git 实际身份另保存在 `verification-inputs.json`，跨发行步骤发生漂移也拒绝。旧 schema/缺字段不是新合同 PASS，旧 CI 的未知环境不补填。归档或输入采集不等于资格或 npm 已发行。

Client 请求支持可选标准 `AbortSignal`，Nuxt transport 传给 fetch，UniApp transport 连接 `RequestTask.abort()`。预取消不发送请求；在途取消返回 `AbortError`，完成/失败/取消后清理监听，不把取消解码为业务错误或认证失败。Vue async action/list 的 generation 和 scope dispose 继续负责晚到结果与作用域清理；应用按组件/任务传 signal，不能用全局取消中断其他租户或请求。该能力不创建业务事件总线或共享登录态；SSR Client 与业务 runtime 仍按 app/请求创建。

5.0.1 的六包使用统一版本。Client 的认证请求绑定发送时的令牌；会话令牌变化后，晚到的成功、业务失败或认证失败均返回 `CLIENT_SESSION_CHANGED`，不触发旧会话的错误 hook。并发认证失败按令牌合并清理；session 的异步 `clear(expectedToken)` 必须在提交清理前重新比对当前令牌，避免清掉新登录。清理期间切换会话时不触发旧会话的 unauthorized hook；`auth: false` 请求的认证失败不清理登录态或触发全局 unauthorized hook。历史 5.0.0 发行物保留，本次修复使用新的版本身份。

常规验证：Node 22 与 `packageManager` 固定的 pnpm 下运行 `pnpm install --frozen-lockfile && pnpm test`。测试先构建当前 workspace 的包间导出，再仅发现当前 `packages/*/tests`；不会加载 `.worktrees` 中其他分支。`pnpm test:tooling` 验证打包/诊断工具；真实应用 SSR、浏览器和数据库资格由应用仓另验，不把包级单元测试外推为整站通过。

日常开发使用 `dev`；`main` 只承载已批准的发布版本。该仓在 2026-09-17 从原 Core 单体仓的 `packages/web` 拆出，初始开发提交为 `46c17de0ebac8b3b43ba05c7c765b07df751b82b`。

正式发行先显式运行 CI 的完整资格，通过后将本仓 Actions variable `CORE_QUALIFICATION_RUN_ID` 固定到该成功 run。tag 工作流只下载该 CI run 的 `web-core-qualified` artifact，按上述角色合同核输入，核对最终包字节和消费者锁，直接发布这六个资格包，不另行打包或解析依赖。生产输入或包有差异必须重新资格，不继承旧结果；commit 可因无内容变化的合并而不同，但真实 tree、政策和原包 seal 必须匹配。已有 npm 版本及新发布版本都必须实际下载 registry tarball 并核 SHA-256，不能只相信 metadata integrity。归档缺失或过期时停止，不自动改用新包。执行时间、run ID 由 Actions 留存，不用其变化否定主发行物字节证据。

本仓已准备由注释式 `vX.Y.Z` tag 触发六包发行的工作流源码。正式发布前须逐包确认 npm 可信发布者绑定及直接发布权限，并取得当前版本的发行授权；工作流存在不代表包已上架。npm 的既有发布版本仍是历史事实，不应将本仓的开发分支视为已发布包。
