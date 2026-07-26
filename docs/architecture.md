# Architecture

## Supabase Realtime

Rather than using external real-time services, we leverage Supabase's built-in real-time capabilities to handle the game's state.

### Players

Players use presence channels to communicate whether they are in a room or not. This allows the game to know when a player has joined or left a room, and to update the game state accordingly.

### Rounds

When a game session starts, all rounds and secret words are precomputed and stored in the database. This is then communicated to all players in the room via a broadcast channel. Clients then use this information to determine the current round based on the current time and the round duration. This allows for a synchronised experience for all players, even without a central server managing the game state.
