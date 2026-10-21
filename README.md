# Caffe Padrino

Web app for Caffe Padrino, Paraćin: guests order from their table, collect points and follow events; staff confirm and serve orders; the owner manages everything.

React + Vite + TypeScript, with Supabase for the database, logins and live updates.

## Run locally

```
npm install
npm run dev
```

`.env` holds the Supabase URL and publishable key (both public by design). Secrets never go in this repo.

## Preview mode

Add `?demo` to any address to see the screens with sample data and no database
(`?demo=waiter`, `?demo=admin` or `?demo=owner` for the staff views). Remove `src/lib/demo.ts` before launch.

## Hosting

`public/_redirects` (Netlify) and `vercel.json` (Vercel) make links to any page work when opened directly.
