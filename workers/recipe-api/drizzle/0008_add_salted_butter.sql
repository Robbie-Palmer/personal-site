insert into "ingredient" ("slug", "name", "category", "created_at", "updated_at")
values ('salted-butter', 'salted butter', 'dairy', now(), now())
on conflict ("slug") do update
set "name" = excluded."name", "category" = excluded."category", "updated_at" = now();
--> statement-breakpoint
insert into "ingredient_group_member" ("group_key", "ingredient_slug", "created_at")
values ('dairy', 'salted-butter', now())
on conflict do nothing;
