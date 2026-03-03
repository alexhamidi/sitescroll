personal sites are a wonderful fragment of someones identity but not easily discoverable

browse random personal sites, vote on them, submit your own

arrow keys or Option+scroll (scroll down = next, scroll up = previous) to navigate; upvote/downvote to curate the collection

**Optional: Neon Data API (no cold start)**  
To load random sites from the client and avoid Next.js cold start:

1. Run `scripts/create-get-random-sites.sql` in the Neon SQL Editor (create the RPC). If you get "role does not exist", delete the `GRANT` line and add one that grants to a role that exists in your branch (e.g. check Data API / Auth settings for the role name).
2. Set in `.env`:
   - `NEXT_PUBLIC_NEON_DATA_API_URL` — your Data API URL (e.g. `https://ep-xxx.apirest.xxx.aws.neon.tech/neondb/rest/v1`)
   - `NEXT_PUBLIC_NEON_DATA_API_KEY` — a **JWT** that the Data API accepts. Neon Data API does not use the Neon Console "API keys" (those are for the management API). You get a JWT from **Neon Auth** (e.g. enable it, then anonymous sign-in or email sign-in and use the token) or from another provider you connect to the Data API. The client sends it as `Authorization: Bearer <token>`.

**Client-side key / JWT:** Anything in `NEXT_PUBLIC_*` is visible in the browser, so anyone can see and reuse the token. The only safe approach is to use a role that has **minimal permissions** (e.g. can only run `get_random_sites`, no write access). Then the "point" is: no backend cold start and simple setup. The **pit**: you can’t rate-limit by IP for that RPC (anyone can call it), and if the JWT’s role can do more than read random sites, exposing it is risky.

If the env vars are not set, the app falls back to `GET /api/random` (Next.js backend).

mostly for fun/whimsy
