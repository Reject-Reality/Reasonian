const { execSync } = require('child_process');
const tags = execSync('git tag -l', { cwd: __dirname }).toString().trim().split('\n');
for (const tag of tags) {
  if (tag !== 'v0.1.0' && tag) {
    try {
      execSync(`git tag -d "${tag}"`, { cwd: __dirname });
      console.log(`Deleted: ${tag}`);
    } catch {}
  }
}
