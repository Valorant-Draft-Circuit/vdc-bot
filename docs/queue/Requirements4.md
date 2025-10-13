# Queue System — Requirements (Combines Only) — v3

> **Scope:** Add a self-contained `/queue` system used **only** when `league_state = 'combines'`.  
> **Repos:**  
> - Bot: https://github.com/Valorant-Draft-Circuit/vdc-bot 
> - Database: https://github.com/Valorant-Draft-Circuit/vdc-prisma

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
- **Do not change existing game storage** (`games`, `PlayerStats`, `matches` schedule). New tables allowed but **not required**.

---

## 2) Non-Goals

- No MMR/ELO recalculation.
- No cross-tier matchmaking.
- No backfill.
- No non-Combines modes.

---

## 3) Architecture Overview

- **Redis (live state):** atomic **Lua** for join/build/cancel bookkeeping; Streams/PubSub events.
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
  - ``**Match ID**: {INTERNAL_ID}`` (internal queue match id, **not** Riot gameID)  
  - `**Map**: {MAP_NAME}`
- Fields (inline):  
  - `Defenders Roster` (5 names, one per line)  
  - `Attackers Roster` (5 names, one per line)
- Image: valorant map splash URL
  - Map images can be fetched from valorant-api.com  https://valorant-api.com/v1/maps
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
  - **Redis down** → bot replies with “Queues are temporarily paused”.
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

## 10) Configuration (UPDATED — DB-backed via ControlPanel)

**ENV (still in `.env`):**
- `REDIS_URL` — required
- `DATABASE_URL` — required

**Everything else comes from `ControlPanel` rows** where `name LIKE 'queue_%'`.  
Values are stored as strings; the loader coerces them to the right types.

**Required keys (add these rows):**
- `queue_relax_seconds` → number (default 180)  
  Anti-rematch relax window before allowing repeats/priority relax.
- `queue_cancel_threshold` → number (default 80)  
  Percent of players required to cancel (`0–100`).
- `queue_vc_create` → boolean `"true"|"false"` (default `"true"`)  
  Whether to create Lobby/TeamA/TeamB voice channels.
- `queue_staff_role_id` → string (Discord role id) (optional)  
  If present, grant view/manage/move to this role.
- `queue_health_check_interval_ms` → number (default 5000)
- `queue_health_db_timeout_ms` → number (default 1000)
- `queue_enabled` → boolean `"true"|"false"` (default `"true"`)  
  Master toggle (admin commands also modify this, mirrors `global_paused` in Redis).
- `queue_map_pool` → comma list (optional)  
  If present, overrides the `MAP_POOL` row for Combines queue maps (e.g., `"CORRODE,ASCENT,BIND,HAVEN,LOTUS,SUNSET,ABYSS"`).

**Existing global keys reused (already in your table):**
- `league_state` → must equal `COMBINES` for queues to operate
- `MAP_POOL` → used if `queue_map_pool` is not set

**Optional per-tier flags (if you want finer control without code changes):**
- `queue_open_recruit` / `queue_open_prospect` / … → `"true"|"false"`  
  If absent, falls back to Redis admin open/close. If present, **AND** logic applies (`tier open` AND this flag must be true).

**Type coercion rules:**
- `"true"`/`"false"` → booleans
- digits → numbers (base 10)
- everything else → strings
- comma lists → arrays of trimmed strings

**Caching & invalidation:**
- Loader caches the parsed config in Redis key `vdc:config:queue` (JSON) with **TTL 30s**.
- Admin commands that change queue config **write to ControlPanel** and **invalidate** the Redis key immediately.
- If ControlPanel is unreachable, loader falls back to last good value in Redis; if neither is available, uses hard defaults above and sets `global_paused=true`.

**Failure behavior:**
- Missing key → default value used.
- Unparseable value → log warning, use default.
- Health monitor treats DB outage as **paused** regardless of local cache.
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

## 15) File/Code Additions (preserving your layout) — UPDATED WITH CONFIG LOADER

> JS-first; minimal edits only. New files fit existing folders.

### 15.1 New runtime helpers
- **`src/core/redis.js`** — ioredis client + Lua loader (`runLua(name, args)`).
- **`src/core/config.js`** — **NEW**: ControlPanel loader with Redis cache.
- **`src/core/health.js`** — health monitor (DB ping + Redis ping) toggles `vdc:queue:global_paused`.
- **`src/core/matchChannels.js`** — category/chan create/delete, perms.

### 15.2 Lua scripts
- `utils/lua/join.lua` — atomic join (eligibility + priority + cooldown + open checks).
- `utils/lua/build_match.lua` — atomic select of 10 (priority, anti-rematch, relax).

### 15.3 Commands
- `src/interactions/commands/queue.js` — `/queue` + `/queue leave` (reads config via `getQueueConfig()`).
- `src/interactions/commands/match.js` — `/match cancel` + `/match submit` (modal + Numbers POST).
- `src/interactions/commands/admin/queue-config.js` — **optional** admin command to set/view `queue_*` keys (writes ControlPanel and invalidates Redis cache key).

### 15.4 Buttons
- `src/interactions/buttons/queueManager.js` — handles `joinLobby|joinAttackers|joinDef|submit`.

### 15.5 Minimal edits to existing files
- `src/events/ready.js` — start health monitor:
  ```js
  const { startHealthMonitor } = require('../core/health');
  startHealthMonitor(client);
    ```
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
