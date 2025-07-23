# AFS FleetPro 🚚 – Railway One-Click Deployment Guide  
Version 1.0 • July 2025

> This monorepo is pre-configured for **Railway** so you can go from zero to a live, cloud-hosted instance of AFS FleetPro in **≈ 10 minutes** with no local dev environment.

---

## 1  Prerequisites

| Tool | Purpose | Link |
| ---- | ------- | ---- |
| GitHub account | Host the repo & trigger CI | https://github.com |
| Railway account | PaaS that auto-builds this monorepo | https://railway.app |
| (Optional) Railway CLI | Logs, shell access | `npm i -g @railway/cli` |

No Docker installation is required—Railway builds the Dockerfile for you.

---

## 2  Repository Setup (≈ 2 min)

1. **Fork / Clone**  
   ```bash
   git clone https://github.com/your-org/afs-fleetpro-railway.git
   cd afs-fleetpro-railway
   ```

2. **Create a new private GitHub repo**  
   - Repo name: `afs-fleetpro`
   - Visibility: *Private* is fine (Railway still builds)

3. **Push code**  
   ```bash
   git remote set-url origin git@github.com:<your-org>/afs-fleetpro.git
   git push -u origin main
   ```

---

## 3  Railway Project (≈ 3 min)

1. Log into **Railway** → click **“New Project”**.  
2. Select **“Deploy from GitHub repo”** → pick `afs-fleetpro`.  
3. Railway auto-detects the **`railway.json`** manifest and shows three services:  
   - `internal-api` (FastAPI)  
   - `portal-api` (FastAPI)  
   - `comms-api` (FastAPI + WebSocket)  

   Plus two plugins it will provision automatically:  
   - **MongoDB**  
   - **Redis**

4. Hit **“Deploy”**. Railway queues the first build using the top-level **Dockerfile** (multi-stage, caches layers).

---

## 4  Environment Variables (stop ‑ read!)

All secrets live in **Environment Groups** → `Production`.

| Key | Description | Default |
| --- | ----------- | ------- |
| `JWT_SECRET_KEY` | Auth signing key | `change-me` |
| `MONGO_URI` | Filled by Railway Mongo plugin | *auto* |
| `REDIS_URI` | Filled by Railway Redis plugin | *auto* |
| `STRIPE_API_KEY` | For payments (optional) |  _add_ |
| `SENDGRID_API_KEY` | Email (optional) |  _add_ |

After Railway creates the Mongo & Redis plugins the corresponding `*_URI` variables are injected—no action needed. **Edit the rest** under Project → Variables → “New Variable”.

---

## 5  Deployment Flow

```
Git push → GitHub → Railway Webhook → Build → Deploy → Live
```

• Each push to `main` triggers an image rebuild & zero-downtime rollout.  
• Branch previews: create feature branch, open PR → Railway spins up an **ephemeral environment** with its own sub-domain.

---

## 6  First Launch (≈ 2 min)

1. Wait until all three services show **“Healthy”**.  
2. Open the **Domains** tab – you’ll see auto-generated URLs like  
   ```
   https://internal-api-<hash>.up.railway.app
   https://portal-api-<hash>.up.railway.app
   https://comms-api-<hash>.up.railway.app
   ```
3. Test health endpoints:  
   ```
   curl https://internal-api-<hash>.up.railway.app/health
   curl https://portal-api-<hash>.up.railway.app/health
   curl https://comms-api-<hash>.up.railway.app/health
   ```
4. Open the **customer tracker demo**:  
   ```
   https://portal-api-<hash>.up.railway.app/portal/v1/tracker/demo1234567890abcdef1234567890ab
   ```

---

## 7  Useful Railway CLI Commands

```bash
railway login                       # one-time
railway link                        # run inside repo to bind project
railway status                      # view deploys
railway logs -s internal-api        # tail logs
railway run -s portal-api bash      # shell into container
```

---

## 8  Custom Domains (optional)

1. Project → Settings → Domains → “Add Domain”.  
2. Point your DNS `CNAME` to Railway’s target.  
3. Railway auto-provisions HTTPS.

---

## 9  CI/CD Tips

| Task | How |
| ---- | --- |
| **Staging env** | Create `staging` branch → Railway creates parallel environment |
| **Secrets per env** | Environment Groups → attach to each deploy target |
| **Rollback** | Deploys → click the previous successful build → *“Redeploy”* |

---

## 10  Next Steps

1. **Seed Data** – `POST /internal/v1/service-orders` to start creating orders.  
2. **Add Auth** – Plug in Keycloak or Auth0 (env vars + callback URL).  
3. **Enable Payments** – Add `STRIPE_API_KEY` and Stripe webhook secret.  
4. **Connect Domain** – Point `portal.yourdomain.com` to portal-api URL.

---

## 11  Support

• Railway docs: https://docs.railway.app  
• FastAPI docs: https://fastapi.tiangolo.com  
• React docs: https://react.dev  

If something goes sideways, run:

```bash
railway logs -s <service> --since 15m
```

and check error output.

---

Happy shipping 🚀  
*– AFS FleetPro Engineering*
