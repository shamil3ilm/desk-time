# desk-time

Shared multi-tenant work-hours tracker for the Zil Money HR ATS. One Cloudflare Worker + D1 database serves ~10 colleagues. Each user signs up, HR password encrypted at rest, dashboard at `https://desk-time.<subdomain>.workers.dev/`.

**Status: scaffold (Phase 1 of 6).** Not yet deployed. See `docs/DESIGN.md` for the full plan.

Local Windows-tracker (personal, per-machine) lives at [shamil3ilm/time](https://github.com/shamil3ilm/time). This repo is the always-on shared version.

---

## Trust model (must-read before signup)

Colleagues' HR passwords are encrypted at rest with a master AES-GCM key held in Cloudflare Secrets. The deployer (repo owner) can technically decrypt them by accessing the deployment env. Every colleague must explicitly accept this before signing up.

Full details: `docs/TRUST-MODEL.md` (Phase 4).

---

## For the deployer

```bash
git clone https://github.com/shamil3ilm/desk-time.git
cd desk-time
npm install

# 1. Cloudflare + D1 setup
npx wrangler login
npx wrangler d1 create desk-time
# → paste the returned database_id into wrangler.toml

# 2. Apply schema
npm run db:migrate:remote

# 3. Set secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler secret put MASTER_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   | npx wrangler secret put SESSION_SECRET
# Optional (for Telegram alerts):
#   npx wrangler secret put TELEGRAM_BOT_TOKEN

# 4. Deploy
npm run deploy
```

Once deployed, share the deployment URL with colleagues. They visit `/signup`.

Local development: `npm run dev` runs a local Worker with a local D1 instance.

---

## For colleagues (Phase 3 onward)

1. Visit the deployment URL
2. Sign up with your Zil Money HR email + password
3. Bookmark the URL
4. (Optional) Set up Telegram alerts via profile page

No local install. Data lives on Cloudflare's edge. Runs regardless of whether your laptop is on.

---

## Roadmap

- **P1 (this scaffold)** — Cloudflare account, Worker deployed, D1 created, secrets set, `/health` responds
- **P2** — Single-user MVP: hardcoded user, signup/login/dashboard, sync working end-to-end
- **P3** — Multi-user: users table, signup flow, cookie sessions, cron fan-out
- **P4** — Telegram alerts, password rotation, admin tools
- **P5** — Data migration from `shamil3ilm/time` local SQLite
- **P6** — Onboard first colleagues

Detailed plan and open decisions in `docs/DESIGN.md`.
