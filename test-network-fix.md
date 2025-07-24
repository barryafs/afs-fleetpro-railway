# Network-Fix Verification Guide  
*File: `test-network-fix.md`*  
Version 1.0 • July 2025

---

## 1  Prerequisites

| Tool / Access | Purpose |
|---------------|---------|
| Browser (Chrome / Firefox) | Front-end testing & dev-tools |
| cURL or Postman | Direct API calls |
| Railway project access | View deploy logs if needed |

**Environment URLs**

| Service | URL |
|---------|-----|
| Front-end | https://frontend-production-3e4a.up.railway.app |
| Internal API | https://internal-api-production-5aca.up.railway.app |
| Portal API | https://portal-api-production-3cd3.up.railway.app |
| Comms API | https://comms-api-production.up.railway.app |

---

## 2  Step-by-Step Test: Service Orders Page

1. **Open the App**  
   Visit  
   ```
   https://frontend-production-3e4a.up.railway.app
   ```  

2. **Sign-in (Demo Mode)**  
   Click **“Sign In”** → You should be redirected to `/dashboard`.

3. **Navigate**  
   In the left drawer click **Service Orders**.  
   The URL becomes `/service-orders`.

4. **Observe the Data Grid**  
   • Rows should appear within ~2 s.  
   • Table shows Order #, Customer, Vehicle, Complaint, Status, Created.

5. **Create New Order (optional)**  
   • Click **New Service Order** → fill form → **Create**.  
   • New row appears instantly and status chip is **“Service Requested”**.

---

## 3  Creating / Resetting Demo Data

If the table is empty:

```bash
curl -X POST \
  https://internal-api-production-5aca.up.railway.app/internal/v1/demo-data
```

Response example:

```json
{
  "message": "Demo data created successfully",
  "customers": 2,
  "vehicles": 3,
  "service_orders": 2
}
```

Refresh the Service Orders page – demo rows are now visible.

---

## 4  Browser Console Checks

1. Press **F12** → *Console* tab.  
2. On App load you should see:

```
[ApiProvider] internalApiUrl: https://internal-api-production-5aca.up.railway.app
[ApiProvider] portalApiUrl  : https://portal-api-production-3cd3.up.railway.app
[ApiProvider] commsApiUrl   : https://comms-api-production.up.railway.app
```

3. When the grid loads:

```
GET https://internal-api-production-5aca.up.railway.app/internal/v1/service-orders 200
```

4. **No** CORS errors like *“has been blocked by CORS policy”* should appear.  
5. If an API call fails, error interceptor logs:

```
[Internal] API error: ...
```

Use it to grab status code & message.

---

## 5  Expected Results & Troubleshooting

| Observation | Expected | If Not – What to Do |
|-------------|----------|---------------------|
| Console URLs use `https://internal-api-production...` etc. | ✅ | If they show `http://localhost`, env-vars are missing – redeploy frontend or set `VITE_*_API_URL`. |
| Table populates within 2 s | ✅ | Check **Network** tab → request status. Should be **200**. |
| CORS error | ❌ should not happen | Confirm backend logs show `Allowed CORS origins` list. Ensure frontend domain is present or set `CORS_ORIGINS` env-var. |
| Network error 500/404 | ❌ | Hit `/health` endpoints; check Railway logs for stack-trace. |
| Create/Edit/Delete actions work | ✅ | If fail, examine payload in Network tab, compare with **API reference** below. |

---

## 6  Direct API Endpoint Tests

### 6.1  List Service Orders

```bash
curl -s https://internal-api-production-5aca.up.railway.app/internal/v1/service-orders | jq .
```

Expected: JSON array with order objects.

### 6.2  Create Order

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"<id>","vehicle_id":"<id>","complaint":"Oil leak"}' \
  https://internal-api-production-5aca.up.railway.app/internal/v1/service-orders
```

Returns new order JSON.

### 6.3  Update Status

```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"status":"tech_assigned"}' \
  https://internal-api-production-5aca.up.railway.app/internal/v1/service-orders/<id>/status
```

### 6.4  CORS Pre-flight Check

```bash
curl -I -X OPTIONS \
  -H "Origin: https://frontend-production-3e4a.up.railway.app" \
  -H "Access-Control-Request-Method: GET" \
  https://internal-api-production-5aca.up.railway.app/internal/v1/service-orders
```

`Access-Control-Allow-Origin` should echo the frontend URL.

---

## 7  Where to Look for Logs

| Location | Command / Path |
|----------|----------------|
| **Front-end console** | Press F12 |
| **Front-end network** | Dev-tools → Network tab |
| **Backend (Railway)** | `railway logs -s internal-api` |
| **Backend local** | Run `uvicorn`, logs show **Allowed CORS origins: [...]** |

---

## 8  Summary

This guide confirms:

1. Front-end uses live Railway URLs (no `localhost`).  
2. Back-end services allow CORS from the production front-end.  
3. API endpoints respond with **200** and expected JSON.  
4. Browser console and Railway logs provide clear diagnostics if issues recur.

Perform each section in order; if all checks pass the original *Network Error* is resolved and Service Orders functionality is fully operational.
