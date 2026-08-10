#!/usr/bin/env node
// Builds the password-protected /work pages from plaintext sources in work-src/.
//
//   node tools/build-work.mjs --password 'your-password'
//   (or WORK_PASSWORD env var; falls back to the current default)
//
// Output format per page: base64( salt[16] | iv[12] | AES-256-GCM(page html) )
// Key: PBKDF2-SHA256(password, salt, 300000 iterations) — matches the WebCrypto
// decryptor embedded in the generated shells, so pages decrypt entirely in the
// browser and GitHub Pages never sees a secret.
//
// work-src/ is gitignored on purpose: committing plaintext would defeat the
// encryption (the repo is public). To edit content later, decrypt with
// tools/decrypt-work.mjs or re-create sources, then re-run this script.

import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'work-src');
const OUT = join(ROOT, 'work');
const ITERATIONS = 300000;

const PAGES = [
    { src: 'deck.html', out: 'deck', label: 'A · DECK MODE' },
    { src: 'story.html', out: 'story', label: 'B · SCROLL STORY' },
    { src: 'retro.html', out: 'retro', label: 'C · 8-BIT RETRO' },
];

const argIdx = process.argv.indexOf('--password');
const password = argIdx > -1 ? process.argv[argIdx + 1] : (process.env.WORK_PASSWORD || 'letmemow');
if (!password) {
    console.error('No password given (--password or WORK_PASSWORD).');
    process.exit(1);
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm' };

function encrypt(plaintext) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    return Buffer.concat([salt, iv, ct]).toString('base64');
}

// Swap <div class="ph" data-asset="name.ext" ...> placeholders for real media
// when the file exists in work-src/assets/. Assets are embedded as data URIs so
// they live inside the encrypted payload, not as readable files in the repo.
function inlineAssets(html) {
    const dir = join(SRC, 'assets');
    const available = existsSync(dir) ? readdirSync(dir) : [];
    return html.replace(/<div class="ph([^"]*)" data-asset="([^"]+)"([^>]*)><\/div>/g, (match, phClasses, name, rest) => {
        if (!available.includes(name)) return match;
        const ext = extname(name).toLowerCase();
        const mime = MIME[ext];
        if (!mime) return match;
        const data = readFileSync(join(dir, name)).toString('base64');
        const uri = `data:${mime};base64,${data}`;
        if (mime.startsWith('video/')) {
            return `<video class="ph-media${phClasses}" autoplay muted loop playsinline src="${uri}"></video>`;
        }
        return `<img class="ph-media${phClasses}" alt="" src="${uri}">`;
    });
}

function fill(template, vars) {
    return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`__${k}__`, v), template);
}

const shellTemplate = readFileSync(join(ROOT, 'tools', 'shell.template.html'), 'utf8');
const gateTemplate = readFileSync(join(ROOT, 'tools', 'gate.template.html'), 'utf8');

for (const page of PAGES) {
    const srcPath = join(SRC, page.src);
    if (!existsSync(srcPath)) {
        console.error(`missing source: ${srcPath} — skipped`);
        continue;
    }
    const html = inlineAssets(readFileSync(srcPath, 'utf8'));
    const shell = fill(shellTemplate, { PAYLOAD: encrypt(html), SLUG: page.out });
    const outDir = join(OUT, page.out);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), shell);
    console.log(`built work/${page.out}/index.html (${(html.length / 1024).toFixed(0)} KB source)`);
}

writeFileSync(join(OUT, 'index.html'), fill(gateTemplate, { CANARY: encrypt('mow-ok') }));
console.log('built work/index.html (gate)');
console.log(`password: ${password === 'letmemow' ? "default 'letmemow'" : '(custom)'}`);
