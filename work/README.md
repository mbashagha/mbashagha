# /work — password-protected portfolio proposals

Three proposal pages for a work/portfolio section, all hidden behind a password.
The landing page (`/index.html`) is untouched.

- `/work/` — password gate (styled to match the lawn), then links to:
  - `/work/deck/` — **Proposal A: Deck mode.** Full-screen slides mirroring the Figma deck. Arrow keys / swipe / click to navigate.
  - `/work/story/` — **Proposal B: Scroll story.** One dark scrolling case-study page.
  - `/work/retro/` — **Proposal C: 8-bit retro.** The landing page's world continues — work history as levels, samples as trophies.

**Password: `letmemow`** (change it — see below).

## How the protection works

The repo is public, so a cosmetic password prompt would protect nothing. Instead
each page's real HTML is encrypted with **AES-256-GCM** (key derived from the
password via PBKDF2-SHA256, 300k iterations) and committed only as a base64
payload inside an empty shell page. The browser decrypts it locally via
WebCrypto after you enter the password at `/work/`; the password is kept in
`sessionStorage` for the tab session. Wrong password = decryption fails = nothing
renders. No server involved, works fine on GitHub Pages. Media dropped into the
pages is embedded inside the encrypted payload too (see `ASSETS.md`).

The plaintext sources live in `work-src/` which is **gitignored — never commit
it**. If you're on a machine without `work-src/`, recover the sources first:

```
node tools/decrypt-work.mjs work/deck/index.html --password 'letmemow'
node tools/decrypt-work.mjs work/story/index.html --password 'letmemow'
node tools/decrypt-work.mjs work/retro/index.html --password 'letmemow'
```

## Editing content / changing the password

1. Edit `work-src/{deck,story,retro}.html` (plain HTML, everything inline).
2. Rebuild with whatever password you want to be current:
   `node tools/build-work.mjs --password 'new-password-here'`
3. Commit the regenerated `work/**/index.html` files.

## Trying it locally

```
python3 -m http.server 8000   # from the repo root
# open http://localhost:8000/work/
```

## Shipping later

Merge this branch into `main` — GitHub Pages serves `main`, so `/work/` goes
live at mobashagha.com/work/ the moment it lands. The gate page carries
`noindex, nofollow`, and there are deliberately no links from the landing page,
so it stays unlisted until you decide otherwise.
