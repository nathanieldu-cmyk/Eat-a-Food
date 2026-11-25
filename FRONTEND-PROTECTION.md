# Production frontend protection

Run `npm ci`, `npm test`, `npm run build`, and `npm run test:production` with Node 20 or newer.
Vercel uses `vercel.json` to build and serve only `dist/`.

The build obfuscates all ten first-party scripts, including game logic and food/relic definitions, with renamed identifiers and encoded strings. It disables source maps. Runtime assets are copied from an explicit allowlist; tests, build tools, package files, trailer tools and original game scripts are excluded from deployment. Third-party libraries keep their original code and license notices. Editable source files and existing save formats remain unchanged. Script URLs and their version parameters remain compatible with multiplayer's update check.

This is a deterrent to casual inspection and modification, not encryption or an anti-cheat boundary. Players control their browser, JavaScript runtime and localStorage. Do not put secrets or encryption keys in frontend files. A determined player can still alter saves, intercept functions or run a modified client. Peer-hosted multiplayer also trusts the host's browser. Strong cheat prevention requires a trusted server to own inventory, currency, rewards, rolls and game rules, and validate every client action.

Never deploy the repository root or bypass the production build. The local Python static server still serves editable development files; preview `dist/` to inspect the protected version.
