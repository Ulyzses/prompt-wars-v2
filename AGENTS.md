# Project Overview

Prompt Wars is a real-time browser-based multiplayer attack and defence game where players compete against each other by creating and executing prompts to hide their special word while trying to guess their opponents'. For a set number of rounds, players alternate between defending where they create prompts to protect their special word and attacking where they talk to an AI agent to give their opponent's special word.

For detailed information about the game (terminology, game lifecycle, scoring), see [the game mechanics document](docs/game-mechanics.md).

Architectural decisions are documented in [the architecture document](docs/architecture.md).

If you're working on a feature, you must first understand how the game works and how it is structured.

## Conventions

Unless absolutely necessary to explain weird or otherwise unconventional implementation details, comments in the codebase are kept to a minimum and verbose, multi-line comments are avoided. Instead, the codebase should be self-documenting, and any additional context should be documented in the `docs` folder.
