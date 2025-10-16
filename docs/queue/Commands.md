# Queue Commands

This document describes the available queue and match-related slash commands implemented in the bot, their arguments, current behavior (based on code), and permission notes.

## `/match cancel`

- Description: Player-facing command intended to initiate a cancel vote for an active match.
- Current behavior (code): Not yet implemented — the command handler replies ephemerally: "Match cancel voting will be enabled soon. For now, please contact a queue admin." (`src/interactions/commands/match.js`).
- Intended / planned behavior (requirements): When live, only players in the match (or DM mirror) should be able to run this. Calling the command adds the voter to `vdc:match:{id}:cancel_votes`. If votes meet the configured threshold (design docs reference ~80% of players), the match is marked canceled, players are unlocked, channels are removed/archived, and no backfill occurs.
- Args: none (should be invoked from the match context/thread or DM mirror so the bot can resolve the queue id).
- Permissions: only members of the match (implementation planned).

## Match submission (use `/submit` or the match embed Submit button)

- Description: Finalize a match by submitting an external Tracker.gg match URL (manual end). Use the global `/submit` command or the Submit button on the match embed.

- Behavior: Opening the Submit modal (via `/submit` or the match embed) asks for a Tracker.gg match URL. The bot validates the URL/format, extracts the Riot gameID, POSTS to the Numbers service, marks the match completed, and unlocks players.

- Args: none (modal collects the Tracker URL).

- Permissions: only members of the match may submit results.

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
- Usage: `/queue admin kill queue_id:<id>`
- Args:
	- `queue_id` (required string) — the internal queue identifier (Queue ID) (the key portion used with `vdc:match:{id}`).
-- Current behavior (code): Reads `vdc:match:{id}` from Redis, sets each player's `status` to `idle`, removes queue and match-related fields (`queuePriority`, `queueJoinedAt`, `currentQueueId`), deletes the match key and its cancel_votes, and returns a message. It also attempts to clean up match channels (category/text/voice) if present (`cleanupMatchChannels`). (`src/interactions/subcommands/queue/admin.js`).

### `/queueadmin reset`

- Description: Clear all queues, match records, and reset player profiles.
- Usage: `/queue admin reset` (no args)
- Current behavior (code): Iterates over known tiers stored in `vdc:tiers`, deletes queue lists (`vdc:tier:{tier}:queue:*`), scans for `vdc:match:*` keys and deletes them (attempting channel cleanup for matches), and resets affected player hashes to `status=idle` and removes queue/match fields. Returns a summary of cleared entries, matches, and reset players.

### `/queueadmin reload-config`

- Description: Reload queue configuration from the Control Panel.
- Usage: `/queue admin reload-config` (no args)
- Current behavior (code): Invalidates the queue config cache and forces a refresh via `getQueueConfig({ forceRefresh: true })`. Replies with a confirmation message.

### `/queueadmin create-dummies`

- Description: Create dummy players and add them to a specified queue for testing the matchmaker.
- Usage: `/queue admin create-dummies tier:<tier> count:<n> bucket:<DE|FA_RFA|SIGNED>`
- Args:
	- `tier` (required) — Tier to which dummy players belong (choices include All, Recruit, Prospect, Apprentice, Expert, Mythic).
	- `count` (required integer) — Number of dummy players to create (1–50).
	- `bucket` (required string) — Which queue bucket to place them in: `DE`, `FA_RFA`, or `SIGNED`.
- Current behavior (code): Creates ephemeral dummy player hashes in Redis (keys `vdc:player:dummy_*`) with `status=queued`, sets a 12-hour TTL, and pushes them onto the specified `vdc:tier:{tier}:queue:{bucket}` list. Replies with a summary of how many dummies were queued.
 - Current behavior (code): Creates ephemeral dummy player hashes in Redis (keys `vdc:player:dummy_*`) with `status=queued`, sets a short 5-minute TTL, and pushes them onto the specified `vdc:tier:{tier}:queue:{bucket}` list. Replies with a summary of how many dummies were queued.

---

Notes and related files:
- Command structure definitions: `utils/commandsStructure/queue.js`.
- Queue subcommand handlers: `src/interactions/subcommands/queue/*.js` (join.js, leave.js, admin.js).
- Admin match-manipulation & reset logic: `src/interactions/subcommands/queue/admin.js`.
- Lua core scripts used by join/leave/build: `utils/lua/join.lua`, `utils/lua/leave.lua`, `utils/lua/build_match.lua`.
- Button quick-join helpers (voice invites) exist in `src/interactions/buttons/queueManager.js` (for join lobby/attackers/defenders quick actions).


## ` /scout` (Scout utilities)

- Description: Tools for users with the Scout role to follow players and receive notifications and access when those players are matched. Useful for scouts who want to spectate or monitor specific players.

- Subcommands:
	- `/scout follow player:<@user>`
		- Description: Start following a player. The scout will receive a DM when that player is matched and will be granted access to the match category/channels for that match.
		- Args: `player` — the Discord user to follow (required).
		- Notes: Requires the configured Scout role (see Control Panel key below).

	- `/scout unfollow player:<@user>`
		- Description: Stop following a player. Removes the scout from the follow list so they no longer receive DMs for that player.
		- Args: `player` — the Discord user to unfollow (required).

	- `/scout list`
		- Description: List players you are currently following.
		- Args: none.

- Behavior and implementation notes (code):
	- The commands are implemented in `src/interactions/commands/scout.js`.
	- Follow state is stored in Redis using two sets:
		- `vdc:scouts:followers:{playerId}` — set of scout user IDs following the player.
		- `vdc:scouts:following:{scoutId}` — set of player IDs a scout follows.
	- When the matchmaker builds a match that includes a player a scout is following, the scout user IDs are:
		- DMed with the match embed and a link to the match chat.
		- Added to the allowedUserIds passed to `createMatchChannels`, so scouts get permission to view the match category and its channels for that match.

- Control Panel configuration:
	- The scout role ID should be set in the Control Panel. The code checks for the following keys (in this order) and uses the first match:
		- `queue_scout_role_id`
		- `queue_scout_rold_id` (common typo — supported for backward compatibility)
		- `queue_scout_roldid`
	- If no scout role is configured, the /scout commands will inform the caller that the scout role is missing.

- Permissions:
	- Only members who have the configured Scout role may use the `/scout follow`, `/scout unfollow`, and `/scout list` commands.
	- Scouts who follow a player are granted per-match access to the match category and channels (same permissions as players) so they can view chat and join voice.


