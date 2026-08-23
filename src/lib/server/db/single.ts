import { boolean, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Schema for the singleplayer variant. Deliberately shares no table with the
// multiplayer schema so the whole feature can be dropped in one migration.

// Single row (id 1), upserted by the admin. The defence prompt lives in its own
// history table rather than here.
export const singleSettings = pgTable('single_settings', {
  id: integer('id').primaryKey(),
  duration: integer('duration').notNull().default(180),
  vocabulary: text('vocabulary').notNull().default(''), // newline-delimited, kept raw
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Append-only. The newest row is the prompt any new session is played against;
// sessions keep a reference so an old run always resolves to the text it faced.
export const singleDefPrompts = pgTable('single_def_prompts', {
  id: serial('id').primaryKey(),
  prompt: text('prompt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const singleSessions = pgTable('single_sessions', {
  id: serial('id').primaryKey(),
  playerId: text('player_id').notNull(),
  secret: text('secret').notNull(),
  defPromptId: integer('def_prompt_id')
    .notNull()
    .references(() => singleDefPrompts.id),
  duration: integer('duration').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  solved: boolean('solved').notNull().default(false),
  solveMs: integer('solve_ms'), // reported by the browser, clamped to the duration
  playerName: text('player_name'),
  contact: text('contact'),
  submittedAt: timestamp('submitted_at', { withTimezone: true })
});

// Every guard exchange, written once the reply has finished streaming. Doubles
// as the prompt count behind the leaderboard tiebreaker.
export const singleAttacks = pgTable(
  'single_attacks',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => singleSessions.id),
    prompt: text('prompt').notNull(),
    response: text('response'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index('single_attacks_session_created_idx').on(table.sessionId, table.createdAt)]
);
