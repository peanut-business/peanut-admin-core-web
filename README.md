# Peanut Admin Core Web

该仓承载 A1 的六个可复用 Web 公共包：`@peanut-admin/client`、`@peanut-admin/vue`、`@peanut-admin/ui-vue`、`@peanut-admin/nuxt`、`@peanut-admin/uniapp` 和 `@peanut-admin/testing`。`client` 不依赖 Vue 或浏览器 DOM；产品业务页面、状态、权限键和固定 API 归 Peanut Admin Code 的负责模块维护。

开发使用 pnpm workspace。所有包输出 `dist` JavaScript 和声明文件，并通过明确的根导出消费。仓内 `scripts/verify-a1-packages.mjs` 在 Node 22（至少 22.12）下构建、测试、生成六个本地候选 tgz，再在干净临时目录安装并用 Vite 构建。候选 tgz 只用于本地资格验证，不代表已经发布到 npm。

日常开发使用 `dev`；`main` 只承载已批准的发布版本。该仓在 2026-09-17 从原 Core 单体仓的 `packages/web` 拆出，初始开发提交为 `46c17de0ebac8b3b43ba05c7c765b07df751b82b`。

发布工作流尚待从旧仓迁移和资格确认。在此之前，npm 的既有发布版本仍是历史事实，不应将本仓的开发分支视为已发布包。
