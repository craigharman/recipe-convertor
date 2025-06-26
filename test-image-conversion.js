const RecipeConverter = require('./recipe-converter');
const path = require('path');
const fs = require('fs');

async function testSingleRecipe() {
    const converter = new RecipeConverter();
    converter.outputDir = './test-output';
    
    // Test with salmon gnocchi recipe
    const testFile = './recipes/YML/15_minute_salmon_gnocchi_175085368981225108.yml';
    
    console.log('Testing image conversion with single recipe...');
    
    const recipe = converter.parseYMLRecipe(testFile);
    if (recipe) {
        console.log(`Original images: ${JSON.stringify(recipe.images)}`);
        
        // Convert images to base64
        console.log('Converting images to base64...');
        recipe.images = await converter.convertImagesToBase64(recipe.images);
        
        console.log(`Converted images count: ${recipe.images.length}`);
        if (recipe.images.length > 0) {
            console.log(`First image preview: ${recipe.images[0].substring(0, 100)}...`);
        }
        
        // Save the result
        const outputPath = path.join(converter.outputDir, `${recipe.id}.melarecipe`);
        fs.writeFileSync(outputPath, JSON.stringify(recipe, null, 2));
        console.log(`✓ Test file saved: ${outputPath}`);
    } else {
        console.log('Failed to parse test recipe');
    }
}

testSingleRecipe().catch(console.error);
