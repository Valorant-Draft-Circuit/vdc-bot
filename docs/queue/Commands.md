
# Queue Commands

This document describes the queue and match-related slash commands implemented in the bot, the arguments they accept, how they behave (based on the current implementation), and permission notes. The content below was synced from the command handlers and command structure in the codebase.

## `/match cancel`

- Description: Player-facing command to start or cast a vote to cancel an active match.
- Current behavior (code): Implemented. When run the command:
  - Resolves the current match ID from the caller's `vdc:player:{id}.currentQueueId` (so it should be run from the match context or a user in the match).
  - Verifies the caller is marked `in_match` and is a participant of the match.
  - Adds the caller to the `vdc:match:{id}:cancel_votes_yes` set and removes them from the `...:cancel_votes_no` set.
  - If the yes vote percentage meets or exceeds the configured `queue.cancelThreshold` (default ~80%), the match is cancelled: players' `status` reset to `idle`, match keys and vote keys deleted, and the bot attempts channel cleanup.
  - If no formal vote is active yet, the command will post a pinned vote message in the match chat with Yes/No buttons and set a short TTL (vote state stored in Redis for ~5 minutes).

- Args: none.
- Permissions: only players in the match (the code checks the player's in-match state and membership in the match roster).

## Match submission (use `/submit` or the match embed Submit button)

- Description: Finalize a match by submitting an external Tracker.gg match URL (manual end). This currently uses a modal to collect a Tracker.gg URL, validates/extracts the Riot gameID, and posts to the Numbers service to mark the match completed and unlock players.
- Args: none (modal collects the Tracker URL).
- Permissions: only members of the match may submit results.

## `/queue join`

- Description: Join the Combines queue for the player's resolved tier.
- Usage: `/queue join` (no arguments).
- Current behavior (code): The command:
  - Defers the reply (ephemeral).
  - Verifies queue is enabled via the queue configuration.
  - Resolves player context (tier, MMR, league status, gameCount) via `resolvePlayerQueueContext`.
  - Maps the player's league status to a priority bucket and checks per-tier flags.
  - Calls the atomic Lua `join` script (via `runLua('join', ...)`) which performs queue membership checks and list insertion.
  - On success replies with a confirmation including tier, bucket, queue position, league status, and (if configured) MMR.
  - Errors are mapped to friendly messages (examples include `LEAGUE_STATE_NOT_COMBINES`, `TIER_CLOSED`, `ALREADY_QUEUED`, `IN_MATCH`, `PLAYER_LOCKED`, `ON_COOLDOWN`, `DUPLICATE_IN_QUEUE`).

- Args: none. The command uses the calling user's profile to determine tier/priority.
- Permissions / requirements: the user must have a resolvable player profile (registered). If the player context can't be resolved the command replies with an explanatory message.

## `/queue leave`

- Description: Leave the Combines queue if currently queued.
- Usage: `/queue leave` (no arguments).
- Current behavior (code): The command:
  - Defers the reply (ephemeral).
  - Calls the atomic Lua `leave` script which removes the player from any queue lists and returns a payload.
  - On success: replies `You have been removed from the <tier> queue.`
  - Known error mappings: `NOT_QUEUED` -> `You're not currently queued.`, `IN_MATCH` -> `You can't leave the queue because you're in an active match.`

- Args: none.
- Permissions: any user may call this command; it only takes effect when the player is currently queued.

## Admin command(s)

There are admin-only queue controls implemented in the codebase (permission is enforced by the command registration; Discord will only show these to users with Manage Guild / Administrator permissions). The implementation relies on Discord-level permission hiding and returns ephemeral replies where appropriate.

Common files: admin handlers are implemented in `src/interactions/subcommands/queue/admin.js`.

### `status`

- Description: Show a live snapshot of the queue configuration and status.
- Usage: `/queueadmin status` (or the registered admin top-level/subcommand).
- Behavior: Builds an embed (title `Queue Status`) that shows flags like Enabled, Display MMR, Channel management, Cancel threshold, Relax timeout, Scout role, active map pool, and game requirements.

### `open` / `close`

- Description: Open or close queues for a tier or ALL tiers.
- Usage: `/queueadmin open tier:<tier>` and `/queueadmin close tier:<tier>`
- Args: `tier` (required) — `ALL` or a specific tier choice (configured tiers include Recruit, Prospect, Apprentice, Expert, Mythic, and any discovered in Redis).
- Behavior: Resolves tiers (from Prisma enum + `vdc:tiers` Redis set), sets `vdc:tier:{tier}:open` = `1` for open or `0` for closed. When closing, queued players in those tiers are cleared/reset.

### `build`

- Description: Trigger the matchmaker to run immediately for a tier (or all tiers).
- Usage: `/queueadmin build tier:<tier>`
- Args: `tier` (required) — `ALL` or a specific tier.
- Behavior: Calls the matchmaker worker's `runMatchmakerOnce(client, tierSelection)` and replies confirming the trigger.

### `kill`

- Description: Force-cancel a match record (server-side) and reset affected players.
- Usage: `/queueadmin kill queue_id:<id>`
- Args: `queue_id` (required) — the internal queue identifier used in `vdc:match:{id}`.
- Behavior: Reads the match hash, resets affected players (`status=idle`, clears queue fields, sets a short TTL), deletes the match and its cancel vote keys, and attempts to cleanup match channels.

### `reset`

- Description: Clear all queues and match records and reset player profiles.
- Usage: `/queueadmin reset` (no args)
- Behavior: Iterates known tiers, deletes queue lists (including completed sibling lists), scans and deletes `vdc:match:*` keys (attempting channel cleanup), and resets player hashes to `status=idle`.

### `reload-config`

- Description: Reload queue configuration from the Control Panel.
- Usage: `/queueadmin reload-config` (no args)
- Behavior: Invalidates the queue config cache and forces a refresh via `getQueueConfig({ forceRefresh: true })`.

### `create-dummies`

- Description: Create ephemeral dummy players and enqueue them for testing the matchmaker.
- Usage: `/queueadmin create-dummies tier:<tier> count:<n> bucket:<DE|FA|RFA|SIGNED> [games:<n>] [completed:<bool>]`
- Args:
  - `tier` (required) — Tier to which dummy players belong (choices include All, Recruit, Prospect, Apprentice, Expert, Mythic).
  - `count` (required integer) — Number of dummy players to create (1-50).
  - `bucket` (required string) — Which queue bucket: `DE`, `FA`, `RFA`, or `SIGNED`.
  - `games` (optional integer) — set the dummy player's gameCount (for completed/eligible logic).
  - `completed` (optional boolean) — if true, push to the `:completed` sibling queue.
- Behavior (current implementation): For each dummy the command:
  - creates a `vdc:player:{dummyId}` hash (status=`queued`, tier, queueJoinedAt, mmr=`1000`, optional gameCount),
  - sets a short TTL (5 minutes / 300000 ms) so dummies expire,
  - pushes the dummy id to the chosen `vdc:tier:{tier}:queue:{bucket}` or `...:queue:{bucket}:completed` list.
  - Replies indicating how many dummy players were created and queued.

Notes: the previous doc contained duplicate/conflicting TTL notes; the implementation sets a short 5-minute TTL for dummy player hashes.

---

Notes and related files
- Command structure definitions: `utils/commandsStructure/queue.js` (command registration for `queue` subcommands).
- Queue subcommand handlers: `src/interactions/subcommands/queue/join.js`, `leave.js`, `admin.js`.
- Match command: `src/interactions/commands/match.js` (handles `cancel`).
- Scout commands: `src/interactions/commands/scout.js`.
- Lua core scripts used by join/leave/build: `utils/lua/join.lua`, `utils/lua/leave.lua`, `utils/lua/build_match.lua`.


## `/scout` (Scout utilities)

- Description: Tools for users with the Scout role to follow players and receive DMs and temporary access when those players are matched.

- Subcommands:
  - `/scout follow player:<@user>` — Start following a player. The scout will be DMed and granted per-match access when that player is matched.
  - `/scout unfollow player:<@user>` — Stop following the specified player.
  - `/scout unfollowall` — Stop following all players you're currently following.
  - `/scout list` — List players you are currently following.

- Behavior and implementation notes (code):
  - Implemented in `src/interactions/commands/scout.js`.
  - Follows are stored in Redis sets: `vdc:scouts:followers:{playerId}` and `vdc:scouts:following:{scoutId}`.
  - When a match is built that includes a followed player, scouts are DMed and added to allowedUserIds when creating match channels, so they receive view access for that match.

- Control Panel configuration: the scout role ID should be set in the queue config (the code reads `vdc:config:queue` and uses `scoutRoleId`). If not configured the commands will inform the caller.

- Permissions: only guild members who have the configured Scout role can use `/scout follow`, `/scout unfollow`, `/scout unfollowall`, and `/scout list`.


