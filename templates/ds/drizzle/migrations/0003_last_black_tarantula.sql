CREATE TYPE "public"."scalar_specimen_kind" AS ENUM('REFERENCE', 'EDGE_CASE');--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scalar_specimens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specimen_code" varchar(64) NOT NULL,
	"fixed_code" char(8) NOT NULL,
	"notes" text NOT NULL,
	"slug_insensitive" "citext" NOT NULL,
	"slug_insensitive_optional" "citext",
	"rank_small" smallint NOT NULL,
	"count_int" integer NOT NULL,
	"token_big" bigint NOT NULL,
	"token_big_optional" bigint,
	"amount_decimal" numeric(14, 4) NOT NULL,
	"amount_decimal_optional" numeric(14, 4),
	"ratio_float" real NOT NULL,
	"ratio_double" double precision NOT NULL,
	"is_reference" boolean DEFAULT true NOT NULL,
	"effective_on" date NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"opens_at" time with time zone NOT NULL,
	"duration_ms" interval NOT NULL,
	"duration_ms_optional" interval,
	"host_ip" "inet" NOT NULL,
	"host_ip_optional" "inet",
	"network_cidr" "cidr" NOT NULL,
	"network_cidr_optional" "cidr",
	"nic_mac" "macaddr" NOT NULL,
	"nic_mac_optional" "macaddr",
	"kind" "scalar_specimen_kind" DEFAULT 'REFERENCE' NOT NULL,
	"kind_optional" "scalar_specimen_kind",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "label" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "item_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "user_labels" ADD CONSTRAINT "user_labels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_labels" ADD CONSTRAINT "user_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "labels_label_idx" ON "labels" USING btree ("label");--> statement-breakpoint
CREATE INDEX "scalar_specimens_specimen_code_idx" ON "scalar_specimens" USING btree ("specimen_code");--> statement-breakpoint
CREATE INDEX "user_labels_user_id_idx" ON "user_labels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_labels_label_id_idx" ON "user_labels" USING btree ("label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_labels_user_id_label_id_uniq" ON "user_labels" USING btree ("user_id","label_id") WHERE "user_labels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" USING btree ("name");--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_lines_item_id_idx" ON "order_lines" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quantity_positive" CHECK ("order_lines"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_label_min_length" CHECK (char_length("tags"."label") >= 2);