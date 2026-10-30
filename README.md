# Lahoti Export Documentation Assistant

Builds the export document set (commercial invoice, packing list, B/L / LR, certificate of origin,
bill of exchange, beneficiary certificates) from the sale contract, the LC and the pre-shipment invoice.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · MongoDB Atlas · Next.js API Routes · Gemini

## Project layout

```
src/
  app/
    layout.tsx, page.tsx, globals.css   Next.js shell (page renders the client app)
    api/                                API routes
      extract-contract | extract-lc | extract-preshipment | extract-amendment
      classify-clauses | reconcile-lc   Gemini extraction / analysis (POST)
      ledger/[lcNo]/shipments           LC ledger in MongoDB (GET / PUT / POST / DELETE)
      health                            configured keys and models
  components/                           UI: one component per workflow stage
    ExportAssistantApp.tsx              the 5-stage workflow
    ui/                                 shadcn/ui components (npx shadcn@latest add <name>)
  lib/                                  browser + shared logic: document generators, PDF / DOCX
                                        export, LC ledger maths, cn() helper
  server/                               server-only code used by the API routes
    gemini/                             client with key / model failover, JSON repair
    extractors/                         prompt + response schema for each extraction
    ledger/store.ts                     MongoDB store (cached connection), file store for local dev
    http.ts                             route wrappers and error responses
  middleware.ts                         optional Basic-auth protection
  types.ts, data/, image/
tests/                                  document generator tests (npm test)
```

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in GEMINI_API_KEY and MONGODB_URI
npm run dev                  # http://localhost:3000
npm test                     # document generator checks
npm run build                # production build (type-checks)
```

## Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel, **Add New → Project**, import the repository (framework preset: Next.js, no other settings needed).
3. Add the environment variables from `.env.example` (`GEMINI_API_KEY`, `MONGODB_URI`, `MONGODB_DB`,
   optionally `APP_BASIC_AUTH_USER` / `APP_BASIC_AUTH_PASSWORD`).
4. In MongoDB Atlas → Network Access, allow Vercel to connect (Vercel has no fixed IPs: allow `0.0.0.0/0`
   with a strong database password, or use the Vercel ↔ MongoDB Atlas integration).
5. Deploy. Every push to the main branch redeploys; pull requests get preview URLs.

Note: Vercel limits a request body to 4.5 MB. Uploads are sent as page images, so a long scanned
document (many pages) can exceed it; split such a file or upload fewer pages.
