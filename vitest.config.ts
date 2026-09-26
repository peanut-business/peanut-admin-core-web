import { defineConfig } from 'vitest/config';

// 仅发现当前工作树的源码测试，不把仓库内其他 .worktrees 或生成应用当作消费者。
// 包间引用按正式 exports 加载，所以 pnpm test 先构建当前锁定的 workspace。
export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.{test,spec}.{ts,tsx,js,mjs,cjs}'],
  },
});
