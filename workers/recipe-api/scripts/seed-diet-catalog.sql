with keys as (
  select
    'alcohol'::text as alcohol,
    'chilli'::text as chilli,
    'dairy'::text as dairy,
    'dairy-free'::text as dairy_free,
    'egg'::text as egg,
    'fish'::text as fish,
    'garlic'::text as garlic,
    'gluten'::text as gluten,
    'gluten-free'::text as gluten_free,
    'legumes'::text as legumes,
    'low-fodmap'::text as low_fodmap,
    'meat'::text as meat,
    'nuts'::text as nuts,
    'onion'::text as onion,
    'peanut'::text as peanut,
    'pescatarian'::text as pescatarian,
    'poultry'::text as poultry,
    'shellfish'::text as shellfish,
    'soy'::text as soy,
    'vegan'::text as vegan,
    'vegetarian'::text as vegetarian,
    'wheat'::text as wheat
),
upsert_groups as (
  insert into "ingredient_group" ("key", "label", "description")
  select groups."key", groups."label", groups."description"
  from keys
  cross join lateral (
    values
      (keys.meat, 'Meat', 'beef, pork, lamb'),
      (keys.poultry, 'Poultry', 'chicken, turkey'),
      (keys.fish, 'Fish', 'salmon, tuna'),
      (keys.shellfish, 'Shellfish', 'prawns, mussels'),
      (keys.dairy, 'Dairy', 'milk, cheese'),
      (keys.egg, 'Egg', 'egg and egg yolk'),
      (keys.gluten, 'Gluten', 'wheat, barley, rye'),
      (keys.wheat, 'Wheat', 'wheat flour, pasta'),
      (keys.legumes, 'Legumes', 'beans, lentils'),
      (keys.nuts, 'Tree nuts', 'almond, cashew'),
      (keys.peanut, 'Peanut', 'peanut products'),
      (keys.soy, 'Soy', 'soy sauce, tofu'),
      (keys.onion, 'Onion', 'onions, shallots'),
      (keys.garlic, 'Garlic', 'garlic, granules'),
      (keys.chilli, 'Chilli', 'fresh or dried'),
      (keys.alcohol, 'Alcohol', 'wine, beer, spirits')
  ) as groups("key", "label", "description")
  on conflict ("key") do update set
    "label" = excluded."label",
    "description" = excluded."description",
    "updated_at" = now()
  returning "key"
),
upsert_presets as (
  insert into "diet_preset" ("key", "label", "description")
  select presets."key", presets."label", presets."description"
  from keys
  cross join lateral (
    values
      (keys.vegetarian, 'Vegetarian', 'no meat or fish'),
      (keys.vegan, 'Vegan', 'no animal products'),
      (keys.pescatarian, 'Pescatarian', 'no meat, fish ok'),
      (keys.dairy_free, 'Dairy-free', 'no milk or cheese'),
      (keys.gluten_free, 'Gluten-free', 'no wheat or gluten'),
      (keys.low_fodmap, 'Low-FODMAP review', 'flag common triggers')
  ) as presets("key", "label", "description")
  on conflict ("key") do update set
    "label" = excluded."label",
    "description" = excluded."description",
    "updated_at" = now()
  returning "key"
)
insert into "diet_preset_excluded_group" ("preset_key", "group_key")
select exclusions.preset_key, exclusions.group_key
from keys
cross join lateral (
  values
    (keys.vegetarian, keys.meat),
    (keys.vegetarian, keys.poultry),
    (keys.vegetarian, keys.fish),
    (keys.vegetarian, keys.shellfish),
    (keys.vegan, keys.meat),
    (keys.vegan, keys.poultry),
    (keys.vegan, keys.fish),
    (keys.vegan, keys.shellfish),
    (keys.vegan, keys.dairy),
    (keys.vegan, keys.egg),
    (keys.pescatarian, keys.meat),
    (keys.pescatarian, keys.poultry),
    (keys.dairy_free, keys.dairy),
    (keys.gluten_free, keys.gluten),
    (keys.low_fodmap, keys.onion),
    (keys.low_fodmap, keys.garlic),
    (keys.low_fodmap, keys.wheat),
    (keys.low_fodmap, keys.legumes)
) as exclusions(preset_key, group_key)
inner join upsert_presets on upsert_presets."key" = exclusions.preset_key
inner join upsert_groups on upsert_groups."key" = exclusions.group_key
on conflict ("preset_key", "group_key") do nothing;
