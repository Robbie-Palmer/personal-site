update "ingredient"
set "category" = 'dairy', "updated_at" = now()
where "slug" = 'almond-milk';
--> statement-breakpoint
insert into "diet_preset_excluded_ingredient" (
  "preset_key",
  "ingredient_slug",
  "created_at"
)
select "preset_key", 'cajun-seasoning', "created_at"
from "diet_preset_excluded_ingredient"
where "ingredient_slug" = 'cajun-powder'
on conflict do nothing;
--> statement-breakpoint
insert into "ingredient_group_member" (
  "group_key",
  "ingredient_slug",
  "created_at"
)
select "group_key", 'cajun-seasoning', "created_at"
from "ingredient_group_member"
where "ingredient_slug" = 'cajun-powder'
on conflict do nothing;
--> statement-breakpoint
insert into "user_diet_excluded_ingredient" (
  "user_id",
  "ingredient_slug",
  "created_at"
)
select "user_id", 'cajun-seasoning', "created_at"
from "user_diet_excluded_ingredient"
where "ingredient_slug" = 'cajun-powder'
on conflict do nothing;
--> statement-breakpoint
delete from "ingredient"
where "slug" = 'cajun-powder';
