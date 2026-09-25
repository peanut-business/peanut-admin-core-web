import { rmSync } from 'node:fs';

/**
 * 在调用方本次创建的临时消费者目录中执行同步验证。
 * 只有本次验证完整成功才删除目录；失败保留现场并原样传播错误。
 * 不读取 process.exitCode：进程退出状态不能证明这个切片是否成功。
 */
export const verifyConsumer = (consumer, verify) => {
  let succeeded = false;
  try {
    const result = verify();
    succeeded = true;
    return result;
  } catch (error) {
    console.error(`Clean consumer retained for diagnosis: ${consumer}`);
    throw error;
  } finally {
    if (succeeded) rmSync(consumer, { recursive: true, force: true });
  }
};
