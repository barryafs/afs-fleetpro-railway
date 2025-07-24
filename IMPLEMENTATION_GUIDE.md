# AFS FleetPro – Service Orders Implementation Guide
Version 1.0 • July 2025

---

## 1. Overview – What Was Implemented
The initial feature set now works end-to-end for **Service Orders**:

Backend (internal-api):
* Full CRUD for service orders, including `DELETE` and status-only patch route.
* MongoDB persistence with tracker history for status changes.
* New supporting CRUD collections:
  * Customers
  * Vehicles
  * Read-only Technicians list
* `/internal/v1/demo-data` to seed realistic sample data.

Frontend (React):
* Global `ApiProvider` (+ `useApi` hook) with Axios instances for all three APIs.
* Rich **ServiceOrders** page:
  * MUI DataGrid listing with search, column sort, pagination, filters.
  * Dialogs for Create, Edit, Delete, Status update.
  * Formik + Yup validation and responsive layout.
* React Router route `/service-orders` wired into the authenticated dashboard.

Everything is styled with Material UI and works on desktop & mobile breakpoints.

---

## 2. How to Test the Functionality

### 2.1 Local quick-start
```bash
# Prerequisites: Docker (for Mongo) + Node ≥18 + Python ≥3.9
git clone https://github.com/your-org/afs-fleetpro-railway.git
cd afs-fleetpro-railway

# Spin up Mongo locally
docker run --name mongo -p 27017:27017 -d mongo:6

# ── Backend ──────────────────────────────────────────
cd services/internal-api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5001
# Optional: seed
curl -X POST http://localhost:5001/internal/v1/demo-data

# ── Frontend ─────────────────────────────────────────
cd ../../frontend
npm install
npm run dev     # http://localhost:5173
# Sign in with demo button → navigate to “Service Orders”
```

### 2.2 API smoke tests (cURL)
```bash
# List orders
curl http://localhost:5001/internal/v1/service-orders

# Create
curl -X POST http://localhost:5001/internal/v1/service-orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"<id>","vehicle_id":"<id>","complaint":"No start"}'

# Update status
curl -X PATCH http://localhost:5001/internal/v1/service-orders/<id>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"tech_assigned"}'
```

### 2.3 Frontend flow
1. Log in (demo button)  
2. “Service Orders” → **New Service Order** → fill form → Save  
3. Row appears instantly. Click row to open edit dialog.  
4. Use kebab-menu icons to delete or update status.

---

## 3. Architecture & File Structure

```
afs-fleetpro-railway/
├─ services/
│  ├─ internal-api/         ← FastAPI (core CRUD)
│  │   └─ app/main.py
│  ├─ portal-api/           ← customer tracker (not changed)
│  ├─ comms-api/            ← messaging / sockets
│  └─ frontend/
│      ├─ src/
│      │   ├─ components/ServiceOrders.jsx
│      │   ├─ contexts/ApiContext.js
│      │   ├─ services/api.js
│      │   └─ App.jsx
│      └─ …
└─ railway.json             ← Railway multi-service manifest
```

Component relationships:

* **ApiContext** – Instantiates Axios for each backend, injects auth header.
* **useApi** – Exposes typed helper methods for every endpoint.
* **ServiceOrders.jsx** – Consumes `useApi`, displays grid & dialogs.
* **App.jsx** – Registers provider & route.

---

## 4. API Endpoints Reference

| Method & Path | Description |
|---------------|-------------|
| `POST /internal/v1/service-orders` | Create new order |
| `GET /internal/v1/service-orders` | List (query: status, customer_id, vehicle_id, skip, limit) |
| `GET /internal/v1/service-orders/{id}` | Get single |
| `PATCH /internal/v1/service-orders/{id}` | Update fields (complaint, cause, etc.) |
| `PATCH /internal/v1/service-orders/{id}/status` | Update **only** status |
| `DELETE /internal/v1/service-orders/{id}` | Delete |
| `POST /internal/v1/demo-data` | Populate customers, vehicles, orders |
| `GET /internal/v1/customers` (+ CRUD) | Customer management |
| `GET /internal/v1/vehicles` (+ CRUD) | Vehicle management |
| `GET /internal/v1/technicians` | List technicians (read-only) |

All endpoints require bearer token; demo mode uses a stub user when none provided.

---

## 5. Front-End Components Created

| File | Responsibility |
|------|----------------|
| `src/contexts/ApiContext.js` | Centralised Axios instances & auth interceptor |
| `src/services/api.js` | `useApi` hook exposing high-level methods |
| `src/components/ServiceOrders.jsx` | Complete UI for CRUD, search, filters |
| `src/App.jsx` (modified) | Registers `ApiProvider`, route, and dashboard layout |

Major UX features:
* Material UI DataGrid (sorting, pagination, inline status chip)
* Formik forms with Yup validation
* Responsive dialogs, Snackbar notifications
* Live filters: status, customer, search text

---

## 6. Next Steps

1. **Vehicles & Customers UI** – leverage existing APIs to build similar grids/forms.
2. **Technician assignment workflow** – multi-select chip field + schedule view.
3. **Messaging system** – real-time chat via `comms-api` (Socket.IO) & notifications panel.
4. **Authentication** – integrate real JWT provider (Keycloak/Auth0) & role-based routes.
5. **CI/CD** – add Vitest, FastAPI tests, GitHub Actions matrix; protect `main`.
6. **Docs** – Swagger is auto-generated; add storybook for React components.
7. **Observability** – enable Railway metrics, add OpenTelemetry for traces.

---

## 7. Deploying & Testing on Railway

1. **Fork repo** → Railway “New Project” → **Deploy from GitHub**.  
2. Railway reads `railway.json` and spins up:  
   * internal-api, portal-api, comms-api (Dockerized)  
   * MongoDB + Redis plugins
3. **Environment variables** (Project → Variables):  
   * `JWT_SECRET_KEY` – **change** default  
   * `STRIPE_API_KEY`, `SENDGRID_API_KEY` (optional)  
   * *Mongo/Redis URIs auto-injected*
4. First deploy finishes → open internal-api domain:  
   `https://internal-api-<hash>.up.railway.app/health`  
5. Seed with demo data:  
   ```bash
   curl -X POST https://internal-api-<hash>.up.railway.app/internal/v1/demo-data
   ```
6. Frontend served at `https://frontend-<hash>.up.railway.app` (Railway autoconfig).  
   * Click **“Sign In”** → Dashboard → Service Orders should display demo rows.
7. Logs & shells:
   ```bash
   railway logs -s internal-api
   railway run -s frontend bash
   ```

Happy shipping! 🚚
