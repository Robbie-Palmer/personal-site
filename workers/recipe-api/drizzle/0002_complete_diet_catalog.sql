insert into "ingredient_group_member" ("group_key", "ingredient_slug")
values
  ('dairy', 'milk-chocolate'),
  ('dairy', 'white-chocolate'),
  ('dairy', 'white-chocolate-chips')
on conflict ("group_key", "ingredient_slug") do nothing;
--> statement-breakpoint
create or replace view drizzle.__schema_migration_manifest as
select migrations.tag, migrations.created_at
from (
  values
    ('0000_baseline'::text, 1784267759415::bigint),
    ('0001_diet_catalog'::text, 1784270301462::bigint),
    ('0002_complete_diet_catalog'::text, 1784272689191::bigint)
) as migrations(tag, created_at);
