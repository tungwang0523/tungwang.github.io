import { spawnSync } from 'node:child_process';

const message = process.argv.slice(2).join(' ').trim();

if (!message) {
  console.error('用法：npm run publish -- "更新说明"');
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npm', ['run', 'build']);
run('git', ['add', '--all']);

const staged = spawnSync('git', ['diff', '--cached', '--quiet']);
if (staged.status === 0) {
  console.log('没有需要提交的改动。');
  process.exit(0);
}
if (staged.status !== 1) process.exit(staged.status ?? 1);

run('git', ['commit', '-m', message]);
run('git', ['push', 'origin', 'main']);

console.log('已推送到 GitHub；Vercel 将自动开始部署。');
