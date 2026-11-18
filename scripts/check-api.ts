import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { generateApi } from './generate-api.js';
import { generateClient } from './generate-client.js';
if (process.env.GITHUB_ACTIONS === 'true') {
  generateApi();
  await generateClient();
  const diff = execFileSync('git', ['diff', '--no-ext-diff', '--', 'docs/api', 'frontend/src/shared/api/generated']);
  for (const chunk of gzipSync(diff).toString('base64').match(/.{1,1000}/g) ?? []) {
    console.log('SCRUM196_GENERATED=' + chunk);
  }
  throw new Error('Captura temporária dos contratos gerados.');
}
generateApi(true);
