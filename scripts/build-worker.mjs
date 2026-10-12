import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const files = {
  '/index.html': 'index.html',
  '/styles.css': 'styles.css',
  '/src/app.js': 'src/app.js',
  '/src/events.js': 'src/events.js'
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, file]) => [url, await readFile(path.join(root, file), 'utf8')])));
const template = await readFile(path.join(root, 'worker/index.js'), 'utf8');
if (!template.includes('__LATCHLINE_ASSETS__')) throw new Error('Worker asset marker is missing.');
const output = template.replace('__LATCHLINE_ASSETS__', JSON.stringify(assets));
const target = path.join(root, 'dist/server');
await mkdir(target, { recursive: true });
await mkdir(path.join(root, 'dist/.openai'), { recursive: true });
await writeFile(path.join(target, 'index.js'), output);
await cp(path.join(root, '.openai/hosting.json'), path.join(root, 'dist/.openai/hosting.json'));
console.log('Built Latchline Worker artifact.');
