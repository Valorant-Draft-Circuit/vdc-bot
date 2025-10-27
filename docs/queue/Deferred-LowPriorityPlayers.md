# Deferred Feature — Low-Priority Queue for Completed Combines

Players who have completed their required number of Combines games should still be able to queue, but they should move behind players who still need games—while keeping the DE → FA/RFA → SIGNED priority order.

## Proposed Approach

1. **Join-time classifier & TTL**  
   - When `/queue join` runs, check a cached "combines games played" entry.  
   - If the player meets the requirement, enqueue them in a secondary queue; otherwise keep them in the primary queue.  
   - Cache entries should include `gamesPlayed`/`combinesComplete` and refresh every ~12 h to limit DB hits.

2. **Secondary "completed" queues**  
   - Add dedicated lists per tier/priority (e.g. `vdc:tier:{tier}:queue:DE:completed`).  
   - Join logic chooses primary vs. completed list based on the classifier above.

3. **Match Builder**  
   - Update `build_match.lua` to drain queues in order `primary` → `completed` for each priority bucket.  
   - Keep anti-rematch, relax window, and cleanup logic unchanged.
   - Add +1 to a player once a match has been found for them in their player key.  

4. **Cache refresh**  
   - Extend the existing cache file(s) (likely `cache/mmrCache.json`, which the join flow reads first) or add a sibling cache that stores a `combinesComplete`/`gamesPlayed` field + timestamp so DB hits are avoided during the TTL window.

5. **UX Updates**  
   - `/queue join` response should mention when the player is in the lower-priority pool.  
   - Admin status embeds/dashboards should surface counts for both primary/completed queues.

6. **DB Check - TODO**  
   - [ ] Query Prisma for combines games played when cache misses occur (add table/field details when implementing).  
   - [ ] Update the cache entry after the DB read so subsequent joins within ~12 h use cached data.

## Notes

- Tier open/close commands must clear both primary and completed queues.  
- Kill/reset paths already reset player state; ensure they also clear `combinesComplete` if needed.  
- Rollout order: schema flag → Lua updates → command changes → docs/tests.  
