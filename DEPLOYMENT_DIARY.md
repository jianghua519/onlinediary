# OnlineDiary Deployment Journey (English Version)

This is a full write-up of how OnlineDiary went from local dev to a working
Synology NAS deployment with HTTPS and stable login/unlock. I recorded the
exact problems, the root causes, and the fixes, so the next deployment is much
faster and less painful.

---

## 1) The beginning: login failed with "Failed to fetch"

The UI loaded, but login/registration failed with a fetch error.
The backend was running, but the frontend still pointed to
`http://localhost:3000`.

**Root cause**
- The API URL was hard-coded for local dev.
- Real access was via NAS domain or Nginx.

**Fix**
- Make API_BASE configurable, or use same-origin calls.
- Proxy /api to the backend.

---

## 2) Login worked but unlock always failed

After login, the app asked to unlock the diary, but the password always failed.

**Root cause**
- WebCrypto (`crypto.subtle`) only works in a secure context (HTTPS or localhost).
- The page was loaded over HTTP.

**Fix**
- Serve the frontend with HTTPS.
- Ensure the certificate is valid for the domain.

---

## 3) Frontend build errors (TypeScript)

Building on NAS produced many TS errors:
- Unused imports/functions
- Wrong parameter types
- Attachment payload fields mismatched
- SharedArrayBuffer type errors

**Root cause**
- Frontend attachment logic drifted from backend API.
- Buffer/Blob type strictness in TS.

**Fix**
- Align upload fields with backend (`file`, `thumbnail`).
- Treat `encryptedFileKey` as a string, not payload.
- Convert `Uint8Array` to a real `ArrayBuffer` for Blob.
- Remove unused code.

---

## 4) Nginx running, but port 8080 not listening

Nginx looked started, but `curl http://127.0.0.1:8080/api/health` failed.

**Root cause**
- Missing full `http {}` / `events {}` structure.
- Nginx started without `-p/-c`, so it loaded the wrong config.

**Fix**
- Use a complete nginx.conf.
- Start with:
  `nginx -p <nginx_dir> -c conf/nginx.conf`

---

## 5) HTTPS + reverse proxy traps

### Trap A: DSM path rules are not supported
Older DSM versions cannot proxy by path (e.g. `/api`).

**Fix**
- Use a separate API subdomain:
  - Frontend: `diary.xxx`
  - API: `api.xxx`

### Trap B: wrong subdomain spelling
At one point the API domain was mistyped (`apidiary` vs `api.diary`).
DNS and certs were correct, but the hostname was wrong.

### Trap C: port 443 not reachable
DNS resolved, but HTTPS still failed.

**Root cause**
- Router port-forwarding for 443 was not configured.

**Fix**
- Forward public 443 -> NAS 443
- Allow 443 through NAS firewall
- Bind certificate to correct host

---

## 6) CORS failure

Browser error:
```
Access-Control-Allow-Origin: http://localhost:5173
```

**Root cause**
- Backend did not load the correct `.env` because pm2 CWD was wrong.

**Fix**
- Start pm2 with `--cwd /volume1/.../backend`
- Or copy `.env` into the process working directory

---

## 7) Node 18 dependency conflicts

NAS supports Node.js 18 only. Frontend toolchain required newer types.

**Fix**
- Downgrade dev tooling:
  - Vite 5.x
  - plugin-react 4.x
  - Vitest 1.x
  - @types/node 18.x

---

## 8) Final stable architecture

**Frontend**
- Served by Web Station (static site)
- Root: `/volume1/webapps/onlinediary/frontend/dist`

**Backend**
- Node.js 18, pm2 managed
- Port 3000

**Reverse proxy**
- `https://diary.xxx` -> Web Station static site
- `https://api.xxx` -> proxy to `127.0.0.1:3000`

**Configs**
- Backend `.env`:
```
CLIENT_ORIGIN=https://diary.xxx
```
- Frontend `.env.production`:
```
VITE_API_BASE=https://api.xxx
```

---

## 9) Final lesson

Most failures were small details that stacked together:
- HTTP vs HTTPS
- wrong host/port
- wrong CORS origin
- wrong working directory for dotenv

Once HTTPS and CORS were correct, everything worked reliably.
The biggest surprise was that **port 443 was never forwarded**.
That single missing router rule blocked the entire deployment.

---

## Quick checklist

- [ ] 443 port forwarded to NAS
- [ ] Certificate bound to `diary` and `api` subdomains
- [ ] CORS `CLIENT_ORIGIN` matches frontend URL
- [ ] `VITE_API_BASE` points to API domain
- [ ] pm2 running in backend directory
- [ ] Web Station root points to `frontend/dist`
