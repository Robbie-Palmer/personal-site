update "ingredient"
set "category" = 'dairy', "updated_at" = now()
where "slug" = 'almond-milk';
--> statement-breakpoint
do $$
declare
  old_slug constant text := 'cajun-powder';
  new_slug constant text := 'cajun-seasoning';
begin
  insert into "ingredient" (
    "slug",
    "name",
    "category",
    "created_at",
    "updated_at"
  )
  values (new_slug, 'cajun seasoning', 'spice', now(), now())
  on conflict do nothing;

  insert into "diet_preset_excluded_ingredient" (
    "preset_key",
    "ingredient_slug",
    "created_at"
  )
  select "preset_key", new_slug, "created_at"
  from "diet_preset_excluded_ingredient"
  where "ingredient_slug" = old_slug
  on conflict do nothing;

  insert into "ingredient_group_member" (
    "group_key",
    "ingredient_slug",
    "created_at"
  )
  select "group_key", new_slug, "created_at"
  from "ingredient_group_member"
  where "ingredient_slug" = old_slug
  on conflict do nothing;

  insert into "user_diet_excluded_ingredient" (
    "user_id",
    "ingredient_slug",
    "created_at"
  )
  select "user_id", new_slug, "created_at"
  from "user_diet_excluded_ingredient"
  where "ingredient_slug" = old_slug
  on conflict do nothing;

  update "recipe"
  set
    "body" = replace(
      "body",
      '"' || old_slug || '"',
      '"' || new_slug || '"'
    ),
    "updated_at" = now()
  where "body" like '%"' || old_slug || '"%';

  delete from "ingredient"
  where "slug" = old_slug;
end
$$;
