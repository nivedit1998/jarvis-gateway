import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const file of ['public/index.html', 'public/style.css', 'public/status.js']) await access(file);
JSON.parse(await readFile('vercel.json', 'utf8'));
for (const file of ['api/health.js', 'api/capabilities.js', 'api/connection.js', 'lib/http.js', 'lib/capabilities.js', 'public/status.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Gateway build checks passed; static assets and Node functions are ready.');
