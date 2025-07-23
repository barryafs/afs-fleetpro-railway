# 🚀 Deploy AFS FleetPro to Railway – Step-by-Step

*Last updated: **July 2025***

---

## 0  What You’ll Need

| Item | Why |
|------|-----|
| **GitHub account** | Host the repo that triggers builds |
| **Railway account** *(free)* | Build & run the stack |
| **This repository** | Contains all services with `nixpacks.toml` files |

> **No local Docker or Node/Python needed.** Everything builds in Railway’s cloud.

---

## 1  Fork / Push the Code (≈ 2 min)

1. **Fork or download** this repo.  
2. Create a **new, empty GitHub repo** called `afs-fleetpro` (public or private).  
3. Push all code:

   ```bash
   git remote set-url origin git@github.com:<your-org>/afs-fleetpro.git
   git push -u origin main
   ```

*(Screenshot #1 – GitHub repo with code)*

---

## 2  Create a Railway Project (≈ 3 min)

1. Log in at <https://railway.app>.  
2. Click **➕ New Project** → **“Deploy from GitHub Repo”**.  
3. Select **`afs-fleetpro`**.  
4. Railway auto-detects the **monorepo structure** (thanks to the `nixpacks.toml` files in each service) and lists **4 services** + **2 plugins**:

   | Service | Type |
   |---------|------|
   | `internal-api` | FastAPI |
   | `portal-api`   | FastAPI |
   | `comms-api`    | FastAPI + WebSocket |
   | `frontend`     | React (served by Nginx) |
   | `mongodb`      | Plugin |
   | `redis`        | Plugin |

*(Screenshot #2 – Railway service detection modal)*

5. Click **Deploy**.

Railway now builds all Docker images. The first build takes ~5-7 minutes.

---

## 3  Add / Review Environment Variables (≈ 1 min)

Railway automatically injects:

* `MONGO_URI` (from Mongo plugin)  
* `REDIS_URI` (from Redis plugin)

Still **add** these in **Project → Variables → New Variable**:

| Key | Example Value | Notes |
|-----|---------------|-------|
| `JWT_SECRET_KEY` | `p9o7TBWziZx3hX2uR7eSgq5jF0CvYa` | 32+ random chars |
| `STRIPE_API_KEY` | *(optional)* | For payments |
| `SENDGRID_API_KEY` | *(optional)* | For email |

*(Screenshot #3 – Railway env var panel)*

> Tip: create an **Environment Group** called `production` and attach to all services.

---

## 4  Wait for Health Checks

In **Deploys → Latest**, each service should turn **🟢 Healthy**.

*(Screenshot #4 – All services healthy)*

Typical build times:

| Service | Build | Release |
|---------|-------|---------|
| APIs    | 3-4 min | ~20 s |
| Frontend| 2 min  | ~10 s |

---

## 5  Open Your Live URLs

Find them under **Settings → Domains**:

```
https://internal-api-xxxxx.up.railway.app
https://portal-api-xxxxx.up.railway.app
https://comms-api-xxxxx.up.railway.app
https://frontend-xxxxx.up.railway.app
```

Test:

```bash
curl https://internal-api-xxxxx.up.railway.app/health
open https://frontend-xxxxx.up.railway.app
```

*(Screenshot #5 – Live site in browser)*

---

## 6  Seed Demo Data *(optional)*

Run once:

```bash
# Internal API demo
railway run -s internal-api curl -X POST http://localhost:8000/internal/v1/demo-data

# Comms API demo
railway run -s comms-api curl -X POST http://localhost:8000/comms/v1/demo-data
```

Then visit **`/tracker`** on the frontend to see a live tracker demo.

---

## 7  Automatic CI/CD Workflow

```
git push → GitHub Webhook → Railway builds → Zero-downtime rollout
```

* Feature branches open a **Preview Environment** with its own sub-domain.
* Click **Deploys → History** to rollback.

---

## 8  Railway CLI Cheatsheet  (install: `npm i -g @railway/cli`)

| Command | Purpose |
|---------|---------|
| `railway link` | Bind local repo → project |
| `railway status` | Show builds & domains |
| `railway logs -s internal-api` | Tail logs |
| `railway run -s portal-api bash` | Shell inside container |

*(Screenshot #6 – Railway logs in terminal)*

---

## 9  Custom Domain (👍 Recommended)

1. Project → **Settings → Domains → Add Domain**.  
2. Create a **CNAME** in your DNS pointing to `cname.up.railway.app`.  
3. Railway auto-provisions HTTPS in ±1 minute.

---

## 10  Next Steps

1. Build business logic in `services/*/app`.  
2. Commit → push → watch Railway deploy.  
3. Enjoy **DevOps-free** fleet-repair management! 🚚💨

---

### Need Help?

* Railway Docs – <https://docs.railway.app>  
* FastAPI Docs – <https://fastapi.tiangolo.com>  
* Community Discord – <https://discord.gg/railway>  

Happy Shipping! ✨
