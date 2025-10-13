# Queue System — Requirements (Combines Only)

> **Scope:** Add a self-contained `/queue` system used **only** when `league_state = 'combines'`.  
> **Repos:**  
> - Bot: https://github.com/Valorant-Draft-Circuit/vdc-bot (This Repo)
> - Database: https://github.com/Valorant-Draft-Circuit/vdc-prisma (prisma folder)

---
# TODO: Make it work with db schema.  Playerstatus check and such.
# TODO: Add priority checking for DE -> FA / RFA -> Signed.  Make sure it wont break anti-rematch.


## 1) Goals

- Single **`/queue`** command for players; bot auto-routes to their **tier** from MMR (no menus).
  - TODO: Fix the above
- Admins can **open/close** queues per tier and teams are locked to 5 players total.
- When enough players join a queue, the system **creates a match**, DMs teams, and creates **VCs** (`Lobby`, `Team A`, `Team B`).
- **Never auto-requeue**; players must explicitly run `/queue` each time.
- **Anti-rematch** safety: avoid back-to-back repeats; relax after ~3 minutes if pool is shallow.
- **Manual end:** `/match submit` opens a **modal** requesting the Tracker URL; on submit, mark **completed** and unlock players.
- **Cancel path:** `/match cancel` → majority vote cancels match; no backfill.
- **Scale safely**: withstand “100+ users press `/queue` at once” without DB outages.

## 2) Non-Goals

- No ELO/MMR recalculation logic (out of scope).  
- No cross-tier matchmaking.  
- No auto backfill of missing players.  
- No league modes other than **Combines**.

---

## 3) Architecture Overview

- **Redis (authoritative for live queue state)**  
  - All hot-path operations (join, build match, cancel vote bookkeeping) are **atomic Lua** scripts.  
  - Pub/Sub or Streams deliver events to workers.

- **Worker(s)**  
  - Consumes Redis events to:  
    - DM players & create Discord VCs  
    - Persist matches to **MariaDB** (durable sink) using batched/idempotent writes


TODO: FIX TABLE DEFS
- **MariaDB (Prisma)**  
  - Stores `Match` and `MatchPlayer` rows and final tracker URL.  
  - Kept simple; not part of the hot path → **no table locks** required.

---

## 4) Slash Commands & UX

### Player
- **`/queue`**  
  - Response (ephemeral): “You have joined the **{TierName}** combine queue.”  
  - Errors: “Queues only available during Combines.” / “Queue closed.” / “Already in queue or match.” / “On cooldown.”

- **`/match cancel`** *(only inside match thread)*  
  - Adds a cancel vote; bot updates progress: `7/10 voted to cancel`.

- **`/match submit`** → Modal *(Tracker URL required)*  
  - On submit: marks match **completed**, unlocks players.

-  **`/queue leave`** if still queued (not matched).

### Admin
- **`/queue admin open <tier|all>` / `close <tier|all>`**
- **`/queue admin status`** (per-tier counts; Redis only)
- **`/queue admin reset`** (emergency: clears queues & unlocks all)
TODO: Add admin kill match


---

## 5) Redis Data Model
```
vdc:league_state                         -> "combines" | (others)        (STR)  
vdc:tiers                                -> {prospect,mythic,...}        (SET)  
vdc:tier:{tier}:open                     -> "1" | "0"                    (STR)  
vdc:tier:{tier}:queue                    -> [userId, ...]                (LIST or ZSET)  
vdc:player:{userId}                      -> {status,tier,currentMatchId, cooldownUntil,lastMatchAt}   (HASH)  
vdc:player:{userId}:recent               -> {otherUserIds...}            (SET, TTL ~180s)  
vdc:match:{matchId}                      -> {tier,playersJSON,status,...}(HASH)  
vdc:match:{matchId}:cancel_votes         -> {userIds...}                 (SET)  
vdc:events                               -> Redis Stream or Pub/Sub channel  
vdc:metrics:*                            -> counters for ops (optional)
```
TODO: WHY Locked  
**Statuses:** `idle | queued | in_match | locked`  
**Relax rule:** anti-rematch is enforced unless queue starved > 180s.

---

## 6) Database (Prisma) Models
TODO: Redo entire example DB cause it made its own and its wrong.
```prisma
TODO: This is very wrong.  We cant just change the Match schema.  If it wants ids it should be internal to redis.  The submit command should just run the current submit code but auto fill tier cause bot will know.

model Match {  
  id           String   @id @default(cuid())  
  tier         String  
  status       String   // 'pending' | 'active' | 'canceled' | 'completed'  
  createdAt    DateTime @default(now())  
  startedAt    DateTime?  
  endedAt      DateTime?  
  trackerUrl   String?  
  teamA        Json?  
  teamB        Json?  
  players      MatchPlayer[]  
  hashKey      String?  @db.VarChar(191) // optional dedupe/audit key  

  @@index([status, tier, createdAt])  
}

model MatchPlayer {  
  id        String   @id @default(cuid())  
  matchId   String  
  userId    String   // Discord user id  
  team      String   // 'A' | 'B'  
  joinedAt  DateTime @default(now())  
  mmr       Int?  
  tier      String?  

  Match     Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)  

  @@index([userId])  
}
```
> Works on MariaDB now; compatible with PostgreSQL later if you switch.

---

## 7) Core Flows

### 7.1 Join Queue (`/queue`)
1. Validate `league_state == 'combines'`.
   1. TODO: Move this to when admins open queues not per queue
2. Resolve player tier from profile cache (Redis) or hydrate once from DB (MMR→tier).
3. **Lua (atomic)**:
   - Ensure player not `queued/in_match`, tier open.  
   - Push userId into `vdc:tier:{tier}:queue`.  
   - Set `status=queued`, `tier`, `joinedAt`.  
   - Emit `queue_join` event.
4. Reply with tier confirmation.

### 7.2 Build Match (Worker)
1. Poll tiers or consume `queue_join` events.
2. When `queue.length >= teamSize*teams`:
   - **Lua (atomic)** picks N users, avoiding `recent` conflicts; if starved > 180s, relax.
   - Pop users, set `status=in_match`, set `currentMatchId`.
TODO: TTL should be set at submission not on match start
   - Create `vdc:match:{id}`; add `recent` pairs with TTL.
   - Emit `match_created`.
3. Worker:
   TODO: Rework how it will create channels and such
   - DM players with teams; optionally create VC category + channels.
     - TODO: Players should get DMs with links to Lobby, and Team channels.
   - Persist to DB: `Match` + `MatchPlayer[]` (bulk). Idempotent on `matchId`.
  
  TODO: YEAH... IDK about this cause db may kill itself if I have to change schema.  Make it work with current one.

### 7.3 Cancel
- `/match cancel` adds user to `vdc:match:{id}:cancel_votes`.  
TODO: Add the below as an control_panel table option.
- If votes > 80% (configurable):  
  - Mark match `canceled` (Redis + DB), unlock players (`status=idle`), delete VCs, archive thread.

### 7.4 Report / Complete
- `/match submit` → Modal (Tracker URL).  
- On submit: update Redis match (`status=completed`, `trackerUrl`, `endedAt`), unlock players.
  TODO: Check how DB will handle matches.
- Persist to DB (`UPDATE Match`).  
- Cleanup VCs.

---

## 8) Concurrency, Scale & Safety

- **No table locks**; all hot concurrency handled by Redis + Lua (atomic).  
- One **writer worker** (or tiny pool) performs DB writes; each operation is a short transaction.  
  TODO: Again need to check schema of db table.
- **Idempotency:** use `matchId` as natural key; safe retries on DB failure.  
- **Backpressure:** if Discord API rate limits, queue bot actions; **players are already matched** (state held in Redis).  
- **Never auto-requeue:** no code path triggers requeue.

---

## 9) Anti-Rematch Rules

- Maintain per-player `recent` set; TTL ~180s.  
- Greedy selection avoids pairing players who just played together/against.  
- If insufficient unique candidates after **relax window** (~3 min), allow repeats.

---

## 10) Permissions & Security

- Gate admin commands to a configured **Admin role ID**.  
- Only a player in a match thread may call `/match cancel` or `/match submit` for that match.  Can be run inside a users DMs with the bot.  
- Validate Tracker URL format (basic URL regex.  See below for valid regex).
  - Valid Regex for Tracker: `/^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/`

---

## 11) Configuration
TODO: Define where config is stored. URLs are ENV rest are controlpanel
- `REDIS_URL`, `DATABASE_URL`  
- `QUEUE_RELAX_SECONDS` (default 180)
- `MATCH_CANCEL_THRESHOLD` (default 80%)
---

## 12) Observability

- Redis counters: `vdc:metrics:queues_joined`, `matches_created`, `matches_canceled`, `matches_completed`.  
- Worker logs per event with `matchId`.  
- Health command: `/queue admin status` shows per-tier queue length & open/closed.

---

## 13) Failure Modes & Recovery

- **Redis down:** `/queue` disabled; show friendly error.  
- **DB down:** Matches still proceed; worker retries persistence (idempotent). 
TODO: If db down should should also friendly error. 
- **Discord rate limits:** Delay DMs/VC creation; state is safe in Redis.  
- **Emergency reset:** `/queue admin reset` clears queues and unlocks all players.

---

## 14) Testing Plan

- Unit test Lua decision paths (join preconditions, cooldown, tier closed).  
- Load test join bursts (100–500 concurrent `/queue`) → ensure unique pop of N per match.  
- Integration test end-to-end: join → match → cancel → requeue; join → match → report.

---

## 15) Rollout Plan

1. Deploy Redis + load Lua scripts.  
2. Ship bot with `/queue` + worker.  
3. Dry-run in a test guild; verify DB writes & idempotency.  
4. Enable in production when `league_state = combines`; monitor `/queue admin status`.  

---

## 16) File/Code Additions (Bot Repo)

TODO: Need to compare with current bot structure and make sure it wont change how it works. 

TODO: Sub commands should live in the subcommands folder and not just queue-open.ts

- `src/redis/index.ts` (client + loader)  
- `src/redis/scripts/join.lua`, `build_match.lua`  
- `src/workers/matcher.ts`  
- Commands:  
  - `src/commands/queue.ts`  
  - `src/commands/match-cancel.ts`  
  - `src/commands/match-submit.ts`  
  - `src/commands/admin/queue-open.ts`, `queue-close.ts`, `queue-cfg.ts`, `queue-status.ts`, `queue-reset.ts`

---

## 17) Future Work (Nice-to-Have)

- Post-match auto-pull of results from Tracker URL.  
  - Once players mark game as done it will pull the id automagicly from riot and submit it.
- Optional team balancing heuristics (MMR variance minimization).  
TODO: The below may just be a prometheus dashboard
- Web dashboard for live queue/match visibility.

---

## 18) Acceptance Criteria

- `/queue` routes to correct tier without user choice; success message shown.  
- With **10 players** in a tier, a **match is created**; all players DM’d with teams and voice channel links.  
- `/match cancel` cancels with majority; players unlocked.  
- `/match submit` with valid Tracker URL **completes** match; players unlocked.  
- No auto-requeue at any time.  
- System handles **100+ simultaneous joins** without DB slowdowns or crashes.  
- Feature only works when `league_state = 'combines'`.

---