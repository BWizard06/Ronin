import { init, parse } from 'es-module-lexer';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// HTTP-only verification: no browser, DOM emulation or browser automation.
await init();
const args = process.argv.slice(2);
const origin = new URL(args.find(arg => arg.startsWith('http')) ?? 'http://127.0.0.1:4330/');
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const snapshotPath = option('--snapshot');
const verifyPath = option('--verify-snapshot');

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return { body: await response.text(), type: response.headers.get('content-type') ?? '' };
}

if (verifyPath) {
  const urls = JSON.parse(await readFile(verifyPath, 'utf8'));
  for (const url of urls) {
    if (new URL(url).origin !== origin.origin) throw new Error('Snapshot does not match the preview origin.');
    await get(url);
  }
  console.log(`All ${urls.length} previously served module URLs are still valid.`);
} else {
  const page = await get(origin);
  const queue = Array.from(page.body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g), match => new URL(match[1].replaceAll('&amp;', '&'), origin).href);
  const visited = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (visited.has(url) || new URL(url).origin !== origin.origin) continue;
    visited.add(url);
    const { body, type } = await get(url);
    if (!/(?:javascript|ecmascript)/i.test(type)) throw new Error(`Expected JavaScript, received ${type}: ${url}`);
    const [imports] = parse(body);
    for (const entry of imports) {
      if (entry.specifier && /^(?:\.|\/)/.test(entry.specifier)) queue.push(new URL(entry.specifier, url).href);
    }
  }
  if (![...visited].some(url => /\/three\.js(?:\?|$)/.test(url))) throw new Error('The page does not load the expected Three.js module.');
  if (![...visited].some(url => url.includes('RoomEnvironment'))) throw new Error('The 3D environment module is missing.');
  if (snapshotPath) {
    await mkdir(dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${JSON.stringify([...visited], null, 2)}\n`);
  }
  console.log(`JavaScript dependency graph OK: ${visited.size} modules, including Three.js and the 3D environment.`);
}
