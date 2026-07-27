CREATE TABLE "attacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"round_number" integer NOT NULL,
	"attacker_id" text NOT NULL,
	"defender_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"response" text,
	"correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attacks" ADD CONSTRAINT "attacks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attacks_session_created_idx" ON "attacks" USING btree ("session_id","created_at");--> statement-breakpoint
-- Feeds each defender's live history log
ALTER PUBLICATION supabase_realtime ADD TABLE attacks;