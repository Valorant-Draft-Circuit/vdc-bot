# Queue Commands

This document describes the available queue and match-related slash commands implemented in the bot, their arguments, current behavior (based on code), and permission notes.

## `/match cancel`

- Description: Player-facing command intended to initiate a cancel vote for an active match.
- Current behavior (code): Not yet implemented — the command handler replies ephemerally: "Match cancel voting will be enabled soon. For now, please contact a queue admin." (`src/interactions/commands/match.js`).
- Intended / planned behavior (requirements): When live, only players in the match (or DM mirror) should be able to run this. Calling the command adds the voter to `vdc:match:{id}:cancel_votes`. If votes meet the configured threshold (design docs reference ~80% of players), the match is marked canceled, players are unlocked, channels are removed/archived, and no backfill occurs.
- Args: none (should be invoked from the match context/thread or DM mirror so the bot can resolve the match id).
- Permissions: only members of the match (implementation planned).

## `/match submit`

- Description: Finalize a match by submitting an external Tracker.gg match URL (manual end).
- Current behavior (code): Not yet implemented — the command handler replies ephemerally: "Match submission via Tracker link is not live yet. Stay tuned!" (`src/interactions/commands/match.js`).
- Intended / planned behavior: When implemented this command should open a modal that asks for a Tracker.gg match URL. The bot should validate the URL/format (requirements include a regex for the tracker URL), extract the Riot gameID, POST the data to the Numbers service, mark the match completed, and unlock players.
- Args: none (modal will collect the Tracker URL).
- Permissions: only members of the match (implementation planned).

## `/queue join`

- Description: Join the Combines queue for the player's resolved tier.
- Usage: `/queue join` (no arguments).
- Current behavior (code): The command:
	- Defers the reply (ephemeral).
	- Validates queue availability via queue config (`queueConfig.enabled`).
	- Resolves the player's queue context (tier, MMR, league status) via `resolvePlayerQueueContext`.
	- Checks per-tier configuration and resolves a priority bucket.
	- Runs the atomic Lua `join` script (`utils/lua/join.lua`) with keys/args to add the player to the appropriate queue lists.
	- On success replies with queue confirmation, queue position, league status and (if enabled) MMR.
	- Error cases are mapped to friendly messages (examples):
		- `LEAGUE_STATE_NOT_COMBINES` -> "Queues only run during Combines."
		- `TIER_CLOSED` -> "The <tier> queue is currently closed."
		- `ALREADY_QUEUED` -> "You're already queued for ..."
		- `IN_MATCH` -> "You're currently in a match (<id>)."
		- `PLAYER_LOCKED`, `ON_COOLDOWN`, `DUPLICATE_IN_QUEUE` -> appropriate messages.
	(See `src/interactions/subcommands/queue/join.js` for the mapping and flow.)
- Args: none. The command uses the calling user's profile to determine tier/priority.
- Permissions / requirements: the user must have a resolvable player profile (registered). If the player context can't be resolved, the command returns an explanatory error.

## `/queue leave`

- Description: Leave the Combines queue if currently queued.
- Usage: `/queue leave` (no arguments).
- Current behavior (code): The command runs the atomic Lua `leave` script (`utils/lua/leave.lua`) and returns one of:
	- Success: "You have been removed from the <tier> queue."
	- Errors: `NOT_QUEUED` -> "You're not currently queued.", `IN_MATCH` -> "You can't leave the queue because you're in an active match.", or a generic error message.
	(See `src/interactions/subcommands/queue/leave.js`.)
- Args: none.
- Permissions: any user may call, but they must be queued for the command to have effect.

## `/queueadmin <subcommand>` (admin top-level command)

Admin functionality was moved to a top-level command to avoid Discord limitations on hiding subcommands. Use `/queueadmin <subcommand>` instead of `/queue admin <subcommand>`.

Permission check: the caller must either have the Discord Administrator permission or have the configured queue admin role id from queue config (`queueConfig.adminRoleId`) — see `hasQueueAdminPrivileges()` in `src/interactions/subcommands/queue/admin.js`.

Common note: Replies are ephemeral when appropriate.

### `/queueadmin status`

- Description: Shows a live snapshot of basic queue controls.
- Usage: `/queue admin status` (no args)
- Current behavior (code): Builds an embed with fields such as Enabled (yes/no) and Admin Role, plus color/footer. (`buildQueueStatusEmbed`).

### `/queueadmin open`

- Description: Open a queue for a specific tier (or ALL).
- Usage: `/queue admin open tier:<tier>`
- Args:
	- `tier` (required string) — choice from configured tiers (e.g. All, Recruit, Prospect, Apprentice, Expert, Mythic). The command accepts `ALL` or a specific tier.
- Current behavior (code): Resolves tiers (including existing tiers discovered in Redis), then sets `vdc:tier:{tier}:open` = `1` for each selected tier and returns a confirmation message.

### `/queueadmin close`

- Description: Close a queue for a specific tier (or ALL).
- Usage: `/queue admin close tier:<tier>`
- Args: same as `open`.
- Current behavior (code): Sets `vdc:tier:{tier}:open` = `0` for the selected tiers and returns a confirmation message.

### `/queueadmin build`

- Description: Force-run the matchmaker for a tier (or ALL).
- Usage: `/queue admin build tier:<tier>`
- Args:
	- `tier` (required string) — `ALL` or a specific tier.
- Current behavior (code): Calls `runMatchmakerOnce(client, tierSelection)` from the matchmaker worker and replies indicating the matchmaker was triggered for the selected tier(s).

### `/queueadmin kill`

- Description: Force-cancel a match record and reset affected players.
- Usage: `/queue admin kill match_id:<id>`
- Args:
	- `match_id` (required string) — the internal queue match identifier (the key portion used with `vdc:match:{id}`).
- Current behavior (code): Reads `vdc:match:{id}` from Redis, sets each player's `status` to `idle`, removes queue and match-related fields (`queuePriority`, `queueJoinedAt`, `currentMatchId`), deletes the match key and its cancel_votes, and returns a message. It also attempts to clean up match channels (category/text/voice) if present (`cleanupMatchChannels`). (`src/interactions/subcommands/queue/admin.js`).

### `/queueadmin reset`

- Description: Clear all queues, match records, and reset player profiles.
- Usage: `/queue admin reset` (no args)
- Current behavior (code): Iterates over known tiers stored in `vdc:tiers`, deletes queue lists (`vdc:tier:{tier}:queue:*`), scans for `vdc:match:*` keys and deletes them (attempting channel cleanup for matches), and resets affected player hashes to `status=idle` and removes queue/match fields. Returns a summary of cleared entries, matches, and reset players.

### `/queueadmin reload-config`

- Description: Reload queue configuration from the Control Panel.
- Usage: `/queue admin reload-config` (no args)
- Current behavior (code): Invalidates the queue config cache and forces a refresh via `getQueueConfig({ forceRefresh: true })`. Replies with a confirmation message.

---

Notes and related files:
- Command structure definitions: `utils/commandsStructure/queue.js`.
- Queue subcommand handlers: `src/interactions/subcommands/queue/*.js` (join.js, leave.js, admin.js).
- Admin match-manipulation & reset logic: `src/interactions/subcommands/queue/admin.js`.
- Lua core scripts used by join/leave/build: `utils/lua/join.lua`, `utils/lua/leave.lua`, `utils/lua/build_match.lua`.
- Button quick-join helpers (voice invites) exist in `src/interactions/buttons/queueManager.js` (for join lobby/attackers/defenders quick actions).


