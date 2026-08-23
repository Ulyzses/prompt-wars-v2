# Game Mechanics

## Multiplayer

### Terminology

- **Special word**: The word that is associated with a player and that they must protect from their opponents. Each player has a unique special word per round.
- **Room**: A virtual space where players can join to play the game together, associated with a unique room code.
- **Room Code**: A unique 6-character alphanumeric code that identifies a room and allows players to join it.
- **Host**: The player who creates the room and has the ability to modify its settings and start the game.
- **Spectator**: A player who joins a room but does not participate in the game.
- **Guard**: An AI agent that has knowledge of the special words and responds to players' prompts during the attack phase.
- **Session**: A single instance of the game that takes place in a room, consisting of multiple rounds.
- **Round**: A single turn in the game consisting of both a defence phase and an attack phase.
- **Defence phase**: The phase of the round where all players create prompts to protect their special word from being guessed by their opponent.
- **Attack phase**: The phase of the round where all players attempt to guess their opponent's special word by interacting with an AI agent who has knowledge of the special words.

### Game Lifecycle

#### 1. Room Creation and Waiting Period

A player creates a new room and they are given a unique room code. This player becomes the host of the room and can modify its settings, such as the number of rounds and the time limit for each phase.

Other players can join the room using the unique room code. Once all players have joined, the host can start the game.

#### 2. Countdown

When the host starts the game, a new session is created and a countdown timer begins. During this time, new players may no longer join the room, and the game prepares for the first round.

#### 3. Rounds

The game proceeds through a fixed number of rounds, as determined by the host. Each round consists of two phases: the defence phase and the attack phase.

**Defence Phase**

Each player gets to set their defence prompts to protect their special word. The prompts are used for the corresponding attack phase.

Defence prompts also carry over across rounds, meaning that players can use and see their previous prompts in subsequent rounds and will only be replaced if they choose to update them. Players cannot see their opponent's defence prompts.

**Attack Phase**

For each opponent, players will see a chat interface where they can interact with an AI agent. The AI agent has knowledge of the special words and will respond to the player's prompts. Players must submit attack prompts (messages) to try to go around their opponent's defence prompts to have the AI agent reveal their opponent's special word.

The model to be used for the AI agent is whatever is set in the environment variable `OPENAI_MODEL`. Its payload will be the following:

| Parameter    | Value                                 |
| ------------ | ------------------------------------- |
| model        | `OPENAI_MODEL` environment variable   |
| instructions | The special word is `<special word>`. |
| input        | `<defence prompt>\n\n<attack prompt>` |

If the AI agent reveals the opponent's special word, the player may submit it as their guess. If the guess is correct, the player scores a point for that round (see [Scoring](#scoring)).

#### 4. Game End

After all rounds have been completed, the game ends and the top players will be displayed on a leaderboard (see [Specifications/Leaderboard](specifications.md#leaderboard)).

Afterwards, the host can choose to start a new session in the same room, leading back to the countdown phase.

### Scoring

Scores are calculated per round based on how many players have correctly guessed their opponent's special word and how many players there are in the room. The scoring system is as follows:

| Number of Players      | 2   | 3   | 4   | 5   | 6+  |
| ---------------------- | --- | --- | --- | --- | --- |
| 1st Correct Guesser    | 5   | 5   | 5   | 5   | 5   |
| 2nd Correct Guesser    | -   | 3   | 3   | 4   | 4   |
| 3rd Correct Guesser    | -   | -   | 2   | 3   | 3   |
| Correct Guesser (4th+) | -   | -   | -   | 2   | 2   |

An additional 5 points are also awarded to players who successfully defend their special word from being guessed by any opponent for that round.

### Sundries

Other specific details about the game can be found in the [specifications document](specifications.md). These go into detail about:

- Prompt limits
- Attack cooldown
- Attack phase player ordering
- Guess validation
- Leaderboard
- Spectating

## Singleplayer

The singleplayer variant is a special time-limited variant of Prompt Wars, wherein the player enters a PvE mode. Rather than players attacking and defending each other. The admin sets a custom defence prompt and list of words allowed to be used as special words. The player effectively enters a singular offence round as one session.

### Terminology

- **Special word**: The word that a player has to guess from the environment. Each session selects a new word.
- **Vocabulary**: The list of words allowed to become a special word in a session.
- **Admin**: A special type of user that can access the site and set session information.
- **Defence Prompt**: The prompt set by an admin to defend the special word.
- **Session**: A single instance of the game, consisting of one round.
- **Round**: The duration in which players have to guess the special word.
- **Guard**: An AI agent that has knowledge of the special word and responds to the player's prompts during the round. 

### Game Lifecycle

#### 0. Admin Settings

An admin sets the Defence Prompt, session length, and vocabulary in a dedicated route. This action can be taken at any time, but will only be applied to sessions that are created after the settings are saved.

#### 1. Session

A player starts the session which rounds for the duration set by the admin. The player will see a chat interface where they can interact with the Guard. The Guard has knowledge of the special word and will respond to the player's prompts. The player must submit attack prompts (messages) to try to go around the Defence Prompt and have the Guard reveal the special word.

#### 2. Game End

The game ends when a player guesses the special word or the time allotted for the session ends. At that point, if the player manages to guess the special word, they are asked for their name and contact information. Then, the top players will be displayed on a leaderboard (see [Specifications/Leaderboard/Singleplayer Variant](specifications.md#singpleplayer-variant). Afterwards, the player continues and shows back the screen to start another session.