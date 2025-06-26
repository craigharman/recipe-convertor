#!/usr/bin/env node

const RecipeConverter = require('./recipe-converter');

// Example: Basic usage
console.log('=== Basic Usage ===');
const converter = new RecipeConverter();
const recipes = converter.convertAll();
console.log(`Converted ${recipes.length} recipes`);

// Example: Custom directories
console.log('\n=== Custom Directories ===');
const customConverter = new RecipeConverter();
customConverter.recipesDir = './my-recipes';  // Change source directory
customConverter.outputDir = './my-output';     // Change output directory
// customConverter.convertAll(); // Uncomment to run with custom paths

// Example: Convert only specific format
console.log('\n=== Convert Specific Format ===');
const htmlOnlyConverter = new RecipeConverter();
const htmlRecipes = htmlOnlyConverter.convertHTMLFiles();
console.log(`Converted ${htmlRecipes.length} HTML recipes`);

const ymlOnlyConverter = new RecipeConverter();
const ymlRecipes = ymlOnlyConverter.convertYMLFiles();
console.log(`Converted ${ymlRecipes.length} YML recipes`);

// Example: Processing individual recipe
console.log('\n=== Individual Recipe Processing ===');
if (recipes.length > 0) {
    const firstRecipe = recipes[0];
    console.log(`Sample recipe: "${firstRecipe.title}"`);
    console.log(`Categories: ${firstRecipe.categories.join(', ')}`);
    console.log(`Prep time: ${firstRecipe.prepTime}`);
    console.log(`Cook time: ${firstRecipe.cookTime}`);
    console.log(`Servings: ${firstRecipe.yield}`);
    console.log(`Ingredients count: ${firstRecipe.ingredients.split('\n').length}`);
}

// Example: Filter recipes by category
console.log('\n=== Filter by Category ===');
const pastaRecipes = recipes.filter(recipe => 
    recipe.categories.some(cat => cat.toLowerCase().includes('pasta'))
);
console.log(`Found ${pastaRecipes.length} pasta recipes`);

// Example: Export specific recipes to separate file
console.log('\n=== Export Specific Recipes ===');
const fs = require('fs');
const path = require('path');

if (pastaRecipes.length > 0) {
    const pastaDir = path.join(converter.outputDir, 'pasta-recipes');
    if (!fs.existsSync(pastaDir)) {
        fs.mkdirSync(pastaDir, { recursive: true });
    }
    
    pastaRecipes.forEach(recipe => {
        const filename = `${recipe.id}.melarecipe`;
        const filepath = path.join(pastaDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(recipe, null, 2));
    });
    
    console.log(`Exported ${pastaRecipes.length} pasta recipes to pasta-recipes/`);
}

console.log('\n=== Conversion Summary ===');
console.log(`Total recipes processed: ${recipes.length}`);
console.log(`Output files created: ${recipes.length + 1} (.melarecipe files + 1 .melarecipes archive)`);
console.log(`Output directory: ${converter.outputDir}`);
