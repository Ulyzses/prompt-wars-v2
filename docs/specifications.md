# Other Specifications

## Prompt Limits

The following limits are enforced on the prompts that players submit during the game:

- Defence prompts: Maximum of 500 characters
- Attack prompts: Maximum of 500 characters

## Attack Cooldown

To prevent players from spamming attack prompts, a cooldown period is enforced between each attack prompt submission to the same opponent. The cooldown period is set to 5 seconds. A player simply cannot send another attack prompt to the same opponent until the cooldown period has elapsed. However, a player can still send attack prompts to other opponents during this time.

## Attack Phase Player Ordering

In the attack phase, a player's opponents' chat interfaces will be ordered based on the following criteria:

At the start of the game (where all players have 0 points), the order will be index-based, looping through the list of players in the room, starting from the current player's index. For example, if there are 4 players in the room (labeled A, B, C, D), player A will see the chat interfaces in the order B, C, D; player B will see them in the order C, D, A; and so on.

After the first round, the order will be based on the players' scores. The highest scoring player will be the first opponent to be displayed, followed by the second highest scoring player, and so on. In the case of a tie, the order will be based on the difference of their scores from the previous round. For example, if players A, B, and C are tied with 10 points each, but in the previous round, player A scored 5 points, player B scored 2 points, and player C scored 3 points, the order will be A, C, B. If a tie still exists, it will be broken by randomisation.

Player ordering does not change during the attack phase and is only updated at the start of each round. This means that if a player guesses their opponent's special word and scores points, the order of the chat interfaces will not change until the next round.

## Guess Validation

A guess is submitted separately from the attack prompts. When a player submits a guess, it is checked against the opponent's special word. Incorrect guesses will not be penalised, and the player can continue to submit attack prompts to try to guess the special word.

## Leaderboard

The leaderboard at the end of the game is a table that shows the player names and their scores. It recognises the top players based on the number of players in the room. Recognition is in the form of highlighting the rows of the top players based on their placement.

| Number of Players | Top Players Recognized | Highlight Colours    |
| ----------------- | ---------------------- | -------------------- |
| 2 to 3            | 1                      | Gold                 |
| 4 to 5            | 2                      | Gold, Silver         |
| 6+                | 3                      | Gold, Silver, Bronze |

If multiple players are tied for the same placement, they will all get the same and highlight. However, this may cut the number of recognised players short. For example, if there are 4 players in the room and 2 players are tied for first place, they will both be highlighted in gold (marked as 1st place), and the next player will be marked as 3rd place (and not highlighted). If there are 10 players in the room and 1 player is in first place while 3 players are tied for second place, the first player will be highlighted in gold (marked as 1st place), the 3 players tied for second place will all be highlighted in silver (marked as 2nd place), and the next player will be marked as 5th place (and not highlighted).

## Spectating

In the lobby, players will be able to set their status to either "Player" or "Spectator" (default is "Player"). Players who are join the room after the countdown has started will also be considered spectators.

Spectators can view the game in real-time as it progresses in the form of a leaderboard and a visual of attacks. Spectators cannot participate in the game and will not be able to see any of the players' defence prompts or special words.

The visual of attacks will be a representation of the attack prompts being sent to the AI agent. Each player will be a circle on the screen, arranged in a circular pattern. When a player sends an attack prompt or a guess, a bullet (a very small circle) will be fired from the player's circle towards their target opponent's circle. The bullet will travel in a straight line until it reaches the target opponent's circle, at which point it will disappear. If the player guesses correctly, a differently coloured bullet (which is slightly bigger than regular bullets) will shoot instead. The visual of attacks will be updated in real-time as players send attack prompts to the AI agent.

This visual takes up the left half of the screen, while the leaderboard takes up the right half of the screen. The leaderboard will show the player names and their scores, with the top players highlighted based on their placement. The leaderboard will also be updated in real-time as players score points by correctly guessing their opponent's special word.
