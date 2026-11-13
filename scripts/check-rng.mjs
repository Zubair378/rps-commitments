import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['packages/crypto-core/src', 'apps/server/src'];
let failed = false;
function check(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, item.name);
    if (item.isDirectory()) check(full);
    else if (
      /\.[cm]?[jt]s$/.test(item.name) &&
      /Math\.random\s*\(/.test(readFileSync(full, 'utf8'))
    ) {
      process.stderr.write(`Insecure RNG found in ${full}\n`);
      failed = true;
    }
  }
}
for (const root of roots) check(root);
if (failed) process.exitCode = 1;
