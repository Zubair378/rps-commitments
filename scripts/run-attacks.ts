import { mkdir, writeFile } from 'node:fs/promises';
import { ATTACKS, runAttack } from '@rps/adversary-sim';

const results = await Promise.all(ATTACKS.map((attack) => runAttack(attack.id)));
await mkdir('docs/results', { recursive: true });
await writeFile(
  'docs/results/attacks.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n',
);
for (const result of results) {
  console.log(
    `${result.id}: vulnerable=${result.vulnerableSuccess}, blocked=${result.patchedBlocked}`,
  );
  if (!result.vulnerableSuccess || !result.patchedBlocked) process.exitCode = 1;
}
