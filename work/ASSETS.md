# Dropping real media into the work pages

The proposal pages currently show styled placeholder slots. Each slot is tagged
with a filename. To fill one:

1. Export the image/video from Figma (file: "Mo Bashagha", key `5ehmgdbvqJ0tVR3iT1K9p8`).
2. Save it as `work-src/assets/<exact filename below>`.
3. Rebuild: `node tools/build-work.mjs --password '<your password>'` and commit `work/`.

Assets are embedded **inside the encrypted payload** as data URIs, so they are
not readable from the public repo. Keep videos short/compressed (a few MB max —
GitHub Pages serves the whole page in one file).

| Filename | What | Where to export from |
|---|---|---|
| `intro-status.png` | The "Hi, I'm Mo" Status mockup phone | Deck intro slide (node `84:1865`) |
| `channels-phone.png` | Channels UI on a phone | Channels sample slides |
| `status-phone.png` | Status / Updates tab UI | Status sample slides (title `142:4871`) |
| `status-in-chats.mp4` | Prototype video, hand holding phone | Status in Chats slide (node `90:4245`) |
| `haptics-phone.png` | Haptics Simulator UI | Haptics slide (node `93:4252`) |
| `logo-apple-ibm.png` | Apple + IBM lockup card | Work-history slide (node `142:5209`) |
| `logo-wise.png` | Wise logo card | Work-history slide (node `142:5209`) |
| `logo-facebook.png` | Facebook logo card | Work-history slide (node `142:5223`) |
| `about-garden.jpg` | Gardening photo | "About me" slides |
| `about-snowboard.jpg` | Snowboarding photo | "About me" slides |
| `about-gigs.jpg` | Gigs & festivals photo | "About me" slides |
| `about-film.jpg` | Film photography photo | "About me" slides |
| `about-pizza.jpg` | Pizza photo | "About me" slides |
| `about-family.jpg` | Emma & Jude photo | "About me" slides |

Portrait phone slots are 9:19.5-ish; export at 2x. `about-*` slots are roughly
square. Any slot left unfilled keeps its intentional-looking placeholder, so you
can fill these incrementally.
