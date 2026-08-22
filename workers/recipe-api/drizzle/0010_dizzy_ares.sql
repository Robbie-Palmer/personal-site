CREATE TABLE "ingredient_group_parent" (
	"group_key" text NOT NULL,
	"parent_group_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_group_parent_pk" PRIMARY KEY("group_key","parent_group_key"),
	CONSTRAINT "ingredient_group_parent_not_self_check" CHECK ("ingredient_group_parent"."group_key" <> "ingredient_group_parent"."parent_group_key")
);
--> statement-breakpoint
ALTER TABLE "ingredient_group_parent" ADD CONSTRAINT "ingredient_group_parent_group_key_ingredient_group_key_fk" FOREIGN KEY ("group_key") REFERENCES "public"."ingredient_group"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_group_parent" ADD CONSTRAINT "ingredient_group_parent_parent_group_key_ingredient_group_key_fk" FOREIGN KEY ("parent_group_key") REFERENCES "public"."ingredient_group"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_group_parent_parent_group_key_idx" ON "ingredient_group_parent" USING btree ("parent_group_key");
--> statement-breakpoint
INSERT INTO "ingredient_group" ("key", "label", "description")
VALUES
	('chicken', 'Chicken', 'chicken meat, stock and other derivatives'),
	('stock', 'Stock', 'meat and vegetable stocks');
--> statement-breakpoint
INSERT INTO "ingredient_group_parent" ("group_key", "parent_group_key")
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
