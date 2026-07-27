# Architecture

## Supabase Realtime

Rather than using external real-time services, we leverage Supabase's built-in real-time capabilities to handle the game's state.

### Players

Players use presence channels to communicate whether they are in a room or not. This allows the game to know when a player has joined or left a room, and to update the game state accordingly.

### Rounds

When a game session starts, all rounds and secret words are precomputed and stored in the database. This is then communicated to all players in the room via a broadcast channel. Clients then use this information to determine the current round based on the current time and the round duration. This allows for a synchronised experience for all players, even without a central server managing the game state.

### History Log

Attacks are persisted to the `attacks` table and reach defenders as row inserts, not broadcasts. Broadcasts only reach clients that are connected at the moment they fire, so a player who reloads or joins late would lose everything sent before — acceptable for the spectator visual, whose bullets are ephemeral by design, but not for a log a player is expected to read back through. Persisting also lets a player's own chat transcripts be rebuilt after a reload, and lets the guess lock on a cracked opponent be restored rather than reset.

A guard exchange is written once its reply has finished streaming, so the defender receives a whole prompt-and-response pair rather than an empty shell that fills in later. The cost is that an attack surfaces in the defender's log only after the guard has answered.

`attacks` is separate from `guesses`, which is deduplicated by a unique constraint and exists purely to compute scores. The log needs the opposite: every attempt, including incorrect and repeated guesses.
