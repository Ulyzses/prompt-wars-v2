CREATE TABLE "single_attacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "single_def_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "single_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"secret" text NOT NULL,
	"def_prompt_id" integer NOT NULL,
	"duration" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"solved" boolean DEFAULT false NOT NULL,
	"solve_ms" integer,
	"player_name" text,
	"contact" text,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "single_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"duration" integer DEFAULT 180 NOT NULL,
	"vocabulary" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "single_attacks" ADD CONSTRAINT "single_attacks_session_id_single_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."single_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "single_sessions" ADD CONSTRAINT "single_sessions_def_prompt_id_single_def_prompts_id_fk" FOREIGN KEY ("def_prompt_id") REFERENCES "public"."single_def_prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "single_attacks_session_created_idx" ON "single_attacks" USING btree ("session_id","created_at");--> statement-breakpoint
-- Closed to the anon key: these hold the secret, the defence prompt, and contact
-- details. The app reads them over the direct Postgres connection, which is
-- unaffected by RLS.
ALTER TABLE "single_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "single_def_prompts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "single_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "single_attacks" ENABLE ROW LEVEL SECURITY;
