# Queue System — Requirements (Combines Only)

> **Scope:** Add a self-contained `/queue` system used **only** when `league_state = 'combines'`.  
> **Repos:**  
> - Bot: this repo  
> - Database: https://github.com/Valorant-Draft-Circuit/vdc-prisma (schema stays as-is)

---

## 1) Goals

- Single **`/queue`** command (no menus). Tier is auto-detected from profile/MMR.
- Admins can **open/close** queues per tier; default 5v5.
- When enough players join, a **match** is formed and a temporary category is created with:
  - **Text:** `match-chat`
  - **Voice:** `Lobby`, `Team A`, `Team B`
- Post a **match card embed** with buttons (see §4.1).
- **Never auto-requeue**; players must run `/queue` each time.
- **Anti-rematch**: avoid immediate repeats; relax after ~3 minutes if pool is shallow.
- **Manual end:** `/match submit` modal asks for Tracker URL → POST to Numbers → unlock players.
- **Cancel path:** `/match cancel` → majority vote cancels; no backfill.
- **Stability:** handles “100+ users press `/queue` at once”.
- **Health gate:** if **Redis OR DB** is down, **queues pause/stop** (see §8).
- **DO NOT change existing DB game storage** (games/PlayerStats/matches schedule). You may add new tables if needed, but none are required for MVP.

---

## 2) Non-Goals

- No MMR/ELO recalculation.
- No cross-tier matchmaking.
- No backfill.
- No non-Combines modes.

---

## 3) Architecture Overview

- **Redis (live state):** atomic **Lua** for join/build/cancel bookkeeping; Streams/PubSub for events.
- **Worker:** reacts to events → DMs, channel creation, Numbers POST on submit.  
  (Does **not** write to existing game tables.)
- **MariaDB (Prisma):** unchanged for gameplay; optional new audit table is allowed but not required.

---

## 4) UX: Commands, Embed, Buttons

### 4.1 Match card embed (posted in `match-chat`)
- Title: `MATCH FOUND!`
- Author: `VDC Queue Manager`
- Description:  
  - `**Tier**: {TIER}`  
  - ``**Match ID**: `{INTERNAL_ID}``` (internal queue match id, **not** Riot gameID)  
  - `**Map**: {MAP_NAME}`
- Fields (inline):  
  - `Defenders Roster` (5 names, one per line)  
  - `Attackers Roster` (5 names, one per line)
- Image: valorant map splash URL
- Buttons: `Join Lobby VC`, `Join Attackers`, `Join Def`, `Submit Game`
- Message: ping the 10 players once; pin the card.

### 4.2 Player commands
- **`/queue`** → joins the correct tier queue (ephemeral confirmation).  
  Errors: not combines, closed tier, already queued/in match, cooldown, **ineligible status**, **queues paused**.
- **`/queue leave`** → only if still queued.
- **`/match cancel`** → only by players in that match; shows running tally (e.g., `7/10`).
- **`/match submit`** → modal for Tracker URL; parse Riot **`gameID`** and POST to Numbers; unlock players.

### 4.3 Admin commands
- **`/queue admin open <tier|all>` / `close <tier|all>`**
- **`/queue admin status`** (sizes, open/closed, paused, health summary)
- **`/queue admin reset`** (clear queues, unlock all; cleanup channels/categories)
- **`/queue admin pause` / `resume`** (global switch, same flag health-gate uses)
- **`/queue admin kill <match>`** (force cancel + cleanup)

---

## 5) Eligibility & Priority (Combines)

- Allowed statuses: `DRAFT_ELIGIBLE`, `FREE_AGENT`, `RESTRICTED_FREE_AGENT`, `SIGNED`.
- **Priority order:** DE → FA/RFA → SIGNED.
- Implementation: **three queues per tier** (`DE`, `FA_RFA`, `SIGNED`). Matchmaker pulls in that order, respecting anti-rematch; after ~180s starvation, relax anti-rematch (and optionally priority) to fill.

---

## 6) Redis Data Model

- `vdc:league_state` → `"combines"`
- `vdc:queue:global_paused` → `"1"|"0"`
- `vdc:tiers` → set of tier IDs
- `vdc:tier:{tier}:open` → `"1"|"0"`
- `vdc:tier:{tier}:queue:DE` → LIST of userIds
- `vdc:tier:{tier}:queue:FA_RFA` → LIST of userIds
- `vdc:tier:{tier}:queue:SIGNED` → LIST of userIds
- `vdc:player:{userId}` → HASH `{status,tier,currentMatchId,cooldownUntil,lastMatchAt}`
- `vdc:player:{userId}:recent` → SET of other userIds, TTL ~180s
- `vdc:match:{internalId}` → HASH `{tier, teamAJSON, teamBJSON, channelIdsJSON, status, createdAt}`
- `vdc:match:{internalId}:cancel_votes` → SET userIds
- `vdc:events` → stream/channel for `queue_join`, `match_created`, `match_canceled`, `match_completed`

Statuses: `idle | queued | in_match | locked`.  
Internal ID: cuid/uuid generated at match creation (not Riot `gameID`).

---

## 7) Core Flows

### 7.1 Join (`/queue`)
1) **Health gate**: if paused → friendly reject.  
2) Confirm combines + tier open.  
3) Resolve tier (cache → DB hydrate on miss).  
4) Validate **eligibility** ∈ {DE, FA, RFA, SIGNED} → map to priority.  
5) **Lua (atomic)**: not queued/in_match/locked, cooldown OK → `LPUSH` into tier+priority list, set player hash, emit event.  
6) Reply with tier confirmation.

### 7.2 Match build (worker)
1) If total across 3 queues ≥ 10:  
2) **Lua (atomic)**: select 10 by **priority**, avoid `recent`; after ~180s relax; pop lists; set player `in_match`, set `currentMatchId`; create `vdc:match:{internalId}`; add `recent` pairs; emit `match_created`.  
3) Worker: create category + channels; post **embed** + buttons, ping players; save channelIds in the match record.

### 7.3 Cancel
- `/match cancel` adds voter; if votes ≥ threshold (default 80%): mark `canceled`, set players `idle`, delete channels/category, archive thread.

### 7.4 Submit / Complete (Tracker → Numbers)
- Modal input: `Tracker URL`.  
- Validate via regex; parse Riot **`gameID`**.  
- POST → `https://numbers.vdc.gg/gameSubmit` with `{ gameID, tier, type: 'combines' }`.  
- On success: mark `completed`, `endedAt`, unlock players (short cooldown optional), delete channels/category.

> We **do not** touch existing tables (games/PlayerStats/matches). Numbers owns game persistence, and `gameID` exists only after the game ends.

---

## 8) Health Gating (pause queues if Redis **or** DB down)

- Background monitor toggles `vdc:queue:global_paused`:
  - **Redis down** → bot replies with “Queues are temporarily paused” (cannot proceed anyway).
  - **DB down** → set paused; block new joins and new matches; show friendly message.
- Auto-resume when healthy; admin can `/queue admin pause|resume` override.
- `/queue admin status` shows health + paused state.

Notes:
- DB health is a fast `SELECT 1` with short timeout and exponential backoff.

---

## 9) Permissions & Security

- Admin gating via configured role ID.
- `/match cancel` & `/match submit` only usable by players in that match.
- Category perms:
  - `@everyone`: no view
  - 10 players: view; VC connect per team
  - Staff (optional): view/manage/move

---

## 10) Configuration

- `REDIS_URL`, `DATABASE_URL`
- `QUEUE_RELAX_SECONDS` (≈180)
- `MATCH_CANCEL_THRESHOLD` (≈80)
- `VC_CREATE=true|false`
- `STAFF_ROLE_ID` (optional)
- `HEALTH_CHECK_INTERVAL_MS` (≈5000)
- `HEALTH_DB_TIMEOUT_MS` (≈1000)

---

## 11) Observability

- Counters: `queues_joined`, `matches_created`, `matches_canceled`, `matches_completed`
- Health transitions logged; Numbers submit results logged
- `/queue admin status`: per-tier sizes, open/closed, paused, health summary

---

## 12) Failure Modes & Recovery

- **Redis down:** show friendly error; keep paused.  
- **DB down:** set paused; block new joins/matches; resume when healthy.  
- **Discord rate limits:** delay DMs/VC creation; state is safe in Redis (idempotent via internalId).  
- **Emergency reset:** `/queue admin reset` clears queues, unlocks players, cleans categories/channels.

---

## 13) Testing Plan

- Unit test Lua (join/build): eligibility, priority, anti-rematch, relax.  
- Load test `/queue` bursts (100–500) → exactly 10 unique per match.  
- Health-gate tests: simulate Redis/DB failures → pause/resume.  
- E2E: join → match → cancel → requeue; join → match → submit → unlock.

---

## 14) Rollout Plan

1) Deploy Redis + Lua.  
2) Ship bot with `/queue`, `/match cancel`, `/match submit`, worker, **health gate**.  
3) Staging guild dry-run; verify perms, embed/buttons, Numbers POST.  
4) Enable under `league_state='combines'`; monitor `/queue admin status`.

---

## 15) File/Code Additions (respecting current layout)

> **JS-first**; keep new code under existing folders. Only minimal edits to two existing files (noted below).

### New runtime helpers
- **`src/core/redis.js`** — ioredis client + Lua loader (exposes `runLua(name, args)`).
- **`src/core/health.js`** — health monitor (DB `SELECT 1`, Redis ping) → sets/clears `vdc:queue:global_paused`.
- **`src/core/matchChannels.js`** — create/delete category + channels; apply perms; return channel IDs.

### Lua scripts (repo-local)
- **`utils/lua/join.lua`** — atomic join (eligibility + priority + cooldown + open checks).
- **`utils/lua/build_match.lua`** — atomic selection of 10 (priority-aware; anti-rematch; relax window).

### Commands (align with `src/interactions/commands`)
- **`src/interactions/commands/queue.js`** — implements `/queue` and `/queue leave`.
- **`src/interactions/commands/match.js`** — subcommands:
  - `/match cancel`
  - `/match submit` (opens modal, validates URL, parses `gameID`, POST to Numbers)

> Note: There is already a `submit.js` command in this folder for other flows. Keeping **`/match submit`** inside `match.js` avoids collisions.

### Buttons (align with `src/interactions/buttons`)
- **`src/interactions/buttons/queueManager.js`** — handles:
  - `Join Lobby VC` → move member to Lobby
  - `Join Attackers` → move member to Team B
  - `Join Def` → move member to Team A
  - `Submit Game` (button opens same modal as `/match submit` for convenience)

### Minimal edits to existing files
- **`src/events/ready.js`** — import and start the health monitor:
  - `const { startHealthMonitor } = require('../core/health');`
  - `startHealthMonitor(client);`
- **`src/events/interactionCreate.js`** — route new buttons & modal submit:
  - Add handling for customIds beginning with `vdc:joinLobby|vdc:joinAttackers|vdc:joinDef|vdc:submit`
  - Route `/queue`, `/match` command names to the new handlers

### Optional (docs & examples)
- **`docs/Requirements4.md`** — this file
- **`docs/embed_example.png`** — kept as reference (already present)

> No changes to `prisma/` files required; your `prismadb.js` stays the same.

---

## 16) Acceptance Criteria

- `/queue` routes to correct tier; eligibility enforced; friendly errors when paused.
- With 10 ready players, a match is created; **category + match-chat + Lobby + Team A + Team B** exist with correct perms; embed posted and pinned; buttons work.
- `/match cancel` cancels with majority; players unlocked; channels removed.
- `/match submit` validates Tracker URL, extracts `gameID`, POSTs to Numbers; players unlocked.
- **No writes** to existing `games` / `PlayerStats` / `matches` tables by this system.
- Handles **100+ simultaneous joins** without DB issues.
- **Queues pause** if **Redis OR DB** is down; resume automatically when healthy.
- Operates **only** when `league_state='combines'`.

