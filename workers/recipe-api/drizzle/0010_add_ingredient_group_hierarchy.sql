CREATE TABLE "ingredient_group_hierarchy" (
	"narrower_group_key" text NOT NULL,
	"broader_group_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_group_hierarchy_pk" PRIMARY KEY("narrower_group_key","broader_group_key"),
	CONSTRAINT "ingredient_group_hierarchy_not_self_check" CHECK ("ingredient_group_hierarchy"."narrower_group_key" <> "ingredient_group_hierarchy"."broader_group_key")
);
--> statement-breakpoint
ALTER TABLE "ingredient_group_hierarchy" ADD CONSTRAINT "ingredient_group_hierarchy_narrower_group_key_ingredient_group_key_fk" FOREIGN KEY ("narrower_group_key") REFERENCES "public"."ingredient_group"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_group_hierarchy" ADD CONSTRAINT "ingredient_group_hierarchy_broader_group_key_ingredient_group_key_fk" FOREIGN KEY ("broader_group_key") REFERENCES "public"."ingredient_group"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_group_hierarchy_broader_group_key_idx" ON "ingredient_group_hierarchy" USING btree ("broader_group_key");
--> statement-breakpoint
CREATE FUNCTION "reject_ingredient_group_hierarchy_cycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM pg_advisory_xact_lock(hashtext('ingredient_group_hierarchy'));
	IF EXISTS (
		WITH RECURSIVE "broader_groups" AS (
			SELECT NEW."broader_group_key" AS "group_key"
			UNION
			SELECT "hierarchy"."broader_group_key"
			FROM "ingredient_group_hierarchy" AS "hierarchy"
			INNER JOIN "broader_groups"
				ON "hierarchy"."narrower_group_key" = "broader_groups"."group_key"
			WHERE NOT (
				TG_OP = 'UPDATE'
				AND "hierarchy"."narrower_group_key" = OLD."narrower_group_key"
				AND "hierarchy"."broader_group_key" = OLD."broader_group_key"
			)
		)
		SELECT 1
		FROM "broader_groups"
		WHERE "group_key" = NEW."narrower_group_key"
	) THEN
		RAISE EXCEPTION 'ingredient group hierarchy cannot contain cycles'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "ingredient_group_hierarchy_cycle_check"
BEFORE INSERT OR UPDATE ON "ingredient_group_hierarchy"
FOR EACH ROW
EXECUTE FUNCTION "reject_ingredient_group_hierarchy_cycle"();
--> statement-breakpoint
INSERT INTO "ingredient_group" ("key", "label", "description")
VALUES
	('chicken', 'Chicken', 'chicken meat, stock and other derivatives'),
	('stock', 'Stock', 'meat and vegetable stocks');
--> statement-breakpoint
INSERT INTO "ingredient_group_hierarchy" ("narrower_group_key", "broader_group_key")
VALUES ('chicken', 'poultry');
--> statement-breakpoint
INSERT INTO "ingredient_group_member" ("group_key", "ingredient_slug")
VALUES
	('chicken', 'chicken-breast'),
	('chicken', 'chicken-thigh'),
	('chicken', 'chicken-stock'),
	('chicken', 'chicken-stock-pot'),
	('stock', 'chicken-stock'),
	('stock', 'chicken-stock-pot'),
	('stock', 'vegetable-stock');
