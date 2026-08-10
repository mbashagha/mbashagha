#!/usr/bin/env node
// Recovers the plaintext source of a built /work page back into work-src/.
//   node tools/decrypt-work.mjs work/deck/index.html --password 'your-password'

import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
const argIdx = process.argv.indexOf('--password');
const password = argIdx > -1 ? process.argv[argIdx + 1] : (process.env.WORK_PASSWORD || 'letmemow');
if (!file) {
    console.error('usage: node tools/decrypt-work.mjs work/<page>/index.html [--password ...]');
    process.exit(1);
}

const html = readFileSync(file, 'utf8');
const m = html.match(/const PAYLOAD = '([A-Za-z0-9+/=]+)'/);
if (!m) {
    console.error('no payload found in that file');
    process.exit(1);
}
const raw = Buffer.from(m[1], 'base64');
const salt = raw.subarray(0, 16);
const iv = raw.subarray(16, 28);
const ct = raw.subarray(28, raw.length - 16);
const tag = raw.subarray(raw.length - 16);
const key = pbkdf2Sync(password, salt, 300000, 32, 'sha256');
const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);
let plaintext;
try {
    plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
} catch {
    console.error('decryption failed — wrong password?');
    process.exit(1);
}
const name = basename(dirname(file)) + '.html';
mkdirSync(join(ROOT, 'work-src'), { recursive: true });
const out = join(ROOT, 'work-src', name);
writeFileSync(out, plaintext);
console.log(`recovered ${out}`);
