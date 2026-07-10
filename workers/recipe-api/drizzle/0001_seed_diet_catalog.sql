insert into "ingredient_group" ("key", "label", "description")
values
  ('meat', 'Meat', 'beef, pork, lamb'),
  ('poultry', 'Poultry', 'chicken, turkey'),
  ('fish', 'Fish', 'salmon, tuna'),
  ('shellfish', 'Shellfish', 'prawns, mussels'),
  ('dairy', 'Dairy', 'milk, cheese'),
  ('egg', 'Egg', 'egg and egg yolk'),
  ('gluten', 'Gluten', 'wheat, barley, rye'),
  ('wheat', 'Wheat', 'wheat flour, pasta'),
  ('legumes', 'Legumes', 'beans, lentils'),
  ('nuts', 'Tree nuts', 'almond, cashew'),
  ('peanut', 'Peanut', 'peanut products'),
  ('soy', 'Soy', 'soy sauce, tofu'),
  ('onion', 'Onion', 'onions, shallots'),
  ('garlic', 'Garlic', 'garlic, granules'),
  ('chilli', 'Chilli', 'fresh or dried'),
  ('alcohol', 'Alcohol', 'wine, beer, spirits')
on conflict ("key") do update set
  "label" = excluded."label",
  "description" = excluded."description",
  "updated_at" = now();

insert into "diet_preset" ("key", "label", "description")
values
  ('vegetarian', 'Vegetarian', 'no meat or fish'),
  ('vegan', 'Vegan', 'no animal products'),
  ('pescatarian', 'Pescatarian', 'no meat, fish ok'),
  ('dairy-free', 'Dairy-free', 'no milk or cheese'),
  ('gluten-free', 'Gluten-free', 'no wheat or gluten'),
  ('low-fodmap', 'Low-FODMAP review', 'flag common triggers')
on conflict ("key") do update set
  "label" = excluded."label",
  "description" = excluded."description",
  "updated_at" = now();

insert into "diet_preset_excluded_group" ("preset_key", "group_key")
values
  ('vegetarian', 'meat'),
  ('vegetarian', 'poultry'),
  ('vegetarian', 'fish'),
  ('vegetarian', 'shellfish'),
  ('vegan', 'meat'),
  ('vegan', 'poultry'),
  ('vegan', 'fish'),
  ('vegan', 'shellfish'),
  ('vegan', 'dairy'),
  ('vegan', 'egg'),
  ('pescatarian', 'meat'),
  ('pescatarian', 'poultry'),
  ('dairy-free', 'dairy'),
  ('gluten-free', 'gluten'),
  ('low-fodmap', 'onion'),
  ('low-fodmap', 'garlic'),
  ('low-fodmap', 'wheat'),
  ('low-fodmap', 'legumes')
on conflict ("preset_key", "group_key") do nothing;
