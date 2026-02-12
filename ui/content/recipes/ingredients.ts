import type { IngredientContent } from "@/lib/domain/recipe/ingredient";

export const ingredients: IngredientContent[] = [
  // Proteins
  { name: "chicken breast", category: "protein" },
  { name: "turkey mince", category: "protein" },
  { name: "chorizo", category: "protein" },
  { name: "bacon", category: "protein" },
  { name: "pork sausages", category: "protein" },

  // Vegetables
  { name: "white onion", category: "vegetable" },
  { name: "red onion", category: "vegetable" },
  { name: "onion", category: "vegetable" },
  { name: "bell pepper", category: "vegetable" },
  { name: "red pepper", category: "vegetable" },
  { name: "garlic", category: "vegetable" },
  { name: "peas", category: "vegetable" },
  { name: "chopped tomatoes", category: "vegetable" },
  { name: "tomato passata", category: "vegetable" },
  { name: "frozen vegetables", category: "vegetable" },
  { name: "fresh tomatoes", category: "vegetable" },
  { name: "garlic puree", category: "vegetable" },
  { name: "tomato puree", category: "vegetable" },
  { name: "frozen peas", category: "vegetable" },
  { name: "fresh parsley", category: "vegetable" },
  { name: "spinach", category: "vegetable" },
  { name: "mixed beans", category: "vegetable" },

  // Dairy
  { name: "butter", category: "dairy" },
  { name: "double cream", category: "dairy" },
  { name: "single cream", category: "dairy" },
  { name: "creme fraiche", category: "dairy" },
  { name: "mascarpone", category: "dairy" },
  { name: "milk", category: "dairy" },
  { name: "cheddar cheese", category: "dairy" },
  { name: "parmesan", category: "dairy" },
  { name: "grana padano", category: "dairy" },
  { name: "cream cheese", category: "dairy" },
  { name: "greek yoghurt", category: "dairy" },

  // Grains & Pasta
  { name: "rice", category: "grain" },
  { name: "arborio rice", category: "grain" },
  { name: "macaroni", category: "grain" },
  { name: "penne pasta", category: "grain" },
  { name: "large pasta shells", category: "grain" },
  { name: "pasta", category: "grain" },
  { name: "long grain rice", category: "grain" },
  { name: "paella rice", category: "grain" },
  { name: "tortilla wraps", category: "grain" },
  { name: "rolled oats", category: "grain" },

  // Spices & Seasonings
  { name: "curry powder", category: "spice" },
  { name: "hot chilli powder", category: "spice" },
  { name: "ground coriander", category: "spice" },
  { name: "cayenne pepper", category: "spice" },
  { name: "paprika", category: "spice" },
  { name: "smoked paprika", category: "spice" },
  { name: "chilli", category: "spice" },
  { name: "chilli flakes", category: "spice" },
  { name: "tikka curry powder", category: "spice" },
  { name: "italian seasoning", category: "spice" },
  { name: "salt", category: "spice" },
  { name: "black pepper", category: "spice" },
  { name: "oregano", category: "spice" },
  { name: "peri peri salt", category: "spice" },
  { name: "cajun seasoning", category: "spice" },
  { name: "dried parsley", category: "spice" },
  { name: "turmeric", category: "spice" },
  { name: "saffron", category: "spice" },
  { name: "cumin", category: "spice" },
  { name: "garlic granules", category: "spice" },
  { name: "onion salt", category: "spice" },
  { name: "cinnamon", category: "spice" },

  // Condiments & Sauces
  { name: "basil pesto", category: "condiment" },
  { name: "soy sauce", category: "condiment" },
  { name: "lime juice", category: "condiment" },
  { name: "peanut butter", category: "condiment" },
  { name: "honey", category: "condiment" },
  { name: "sweet chilli sauce", category: "condiment" },
  { name: "chipotle paste", category: "condiment" },
  { name: "almond butter", category: "condiment" },

  // Oils & Fats
  { name: "olive oil", category: "oil-fat" },
  { name: "coconut milk", category: "oil-fat" },

  // Liquids
  { name: "chicken stock", category: "liquid" },
  { name: "vegetable stock", category: "liquid" },
  { name: "water", category: "liquid" },

  // Fruit
  { name: "banana", category: "fruit" },
  { name: "strawberries", category: "fruit" },
  { name: "raspberries", category: "fruit" },

  // Other
  { name: "plain flour", category: "other" },
  { name: "brown sugar", category: "other" },
  { name: "prawn crackers", category: "other" },
  { name: "garlic bread", category: "other" },
  { name: "chia seeds", category: "other" },
  { name: "mixed nuts", category: "other" },
];
