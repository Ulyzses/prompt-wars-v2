import { boolean, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  roomName: text('room_name').notNull(),
  hostId: text('host_id').notNull(),
  numRounds: integer('num_rounds').notNull().default(5),
  defTime: integer('def_time').notNull().default(60),
  atkTime: integer('atk_time').notNull().default(180),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Each room can have multiple sessions, which itself have multiple rounds
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id')
    .notNull()
    .references(() => rooms.id),
  numRounds: integer('num_rounds').notNull().default(5),
  defTime: integer('def_time').notNull().default(60),
  atkTime: integer('atk_time').notNull().default(180),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const rounds = pgTable('rounds', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id),
  roundNumber: integer('round_number').notNull(),
  attacking: boolean('attacking').notNull(), // false is defending
  startedAt: timestamp('started_at', { withTimezone: true }),
  endingOn: timestamp('ending_on', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const defPrompts = pgTable(
  'def_prompts',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    playerId: text('player_id').notNull(),
    prompt: text('prompt').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [unique('def_prompts_session_player_unique').on(table.sessionId, table.playerId)]
);

// The frozen participant roster for a session
export const sessionPlayers = pgTable(
  'session_players',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    playerId: text('player_id').notNull(),
    playerName: text('player_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [unique('session_players_session_player_unique').on(table.sessionId, table.playerId)]
);

export const secrets = pgTable(
  'secrets',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    roundNumber: integer('round_number').notNull(),
    playerId: text('player_id').notNull(),
    secret: text('secret').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    unique('secrets_session_round_player_unique').on(
      table.sessionId,
      table.roundNumber,
      table.playerId
    )
  ]
);

// Correct guesses only; unique constraint caps it at one per opponent per round.
// createdAt kept for future rank-based scoring.
export const guesses = pgTable(
  'guesses',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    roundNumber: integer('round_number').notNull(),
    attackerId: text('attacker_id').notNull(), // the guesser
    defenderId: text('defender_id').notNull(), // whose secret was guessed
    points: integer('points').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    unique('guesses_session_round_attacker_defender_unique').on(
      table.sessionId,
      table.roundNumber,
      table.attackerId,
      table.defenderId
    )
  ]
);
