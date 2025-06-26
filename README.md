# Recipe Converter to Mela Format

A JavaScript application that converts HTML and YML recipe files to the Mela file format (.melarecipe).

## Features

- **HTML Recipe Support**: Parses HTML files with JSON-LD structured data and microdata
- **YML Recipe Support**: Converts YAML recipe files to Mela format
- **Batch Processing**: Converts all recipes in folders at once
- **Mela Format Compliance**: Generates valid .melarecipe files according to Mela's specification
- **ZIP Archive Creation**: Creates .melarecipes files containing multiple recipes
- **Data Extraction**: Intelligently extracts recipe data including:
  - Title, description, and images
  - Ingredients and instructions
  - Prep time, cook time, and total time
  - Categories/tags
  - Nutritional information
  - Source URLs

## Installation

1. Make sure you have Node.js installed (version 14 or higher)
2. Install dependencies:

```bash
npm install
```

## Directory Structure

Your recipes should be organized as follows:

```
recipes/
├── HTML/
│   ├── recipe1.html
│   ├── recipe2.html
│   └── ...
└── YML/
    ├── recipe1.yml
    ├── recipe2.yml
    └── ...
```

## Usage

### Convert All Recipes (Both Formats)

**Note:** This will create duplicate recipes if you have the same recipe in both HTML and YML formats. Consider using format-specific conversion instead.

```bash
npm run convert
# or
node recipe-converter.js all
```

### Convert Only HTML Recipes

```bash
npm run convert-html
# or
node recipe-converter.js html
```

### Convert Only YML Recipes

```bash
npm run convert-yml
# or
node recipe-converter.js yml
```

## Output

The converter creates an `output/` directory containing:

- Individual `.melarecipe` files for each recipe
- A combined `recipes.melarecipes` file (ZIP archive) containing all recipes

## Supported Input Formats

### HTML Files

The converter supports HTML files with:

- **JSON-LD structured data** (preferred): Looks for `<script type="application/ld+json">` containing Recipe schema
- **Microdata**: Falls back to parsing HTML elements with `itemprop` attributes

Example HTML structure:
```html
<script type="application/ld+json">
{
  "@context": "http://schema.org/",
  "@type": "Recipe",
  "name": "Recipe Title",
  "description": "Recipe description",
  "image": ["image-url"],
  "recipeIngredient": ["ingredient 1", "ingredient 2"],
  "recipeInstructions": [
    {"@type": "HowToStep", "text": "Step 1"},
    {"@type": "HowToStep", "text": "Step 2"}
  ]
}
</script>
```

### YML Files

The converter expects YML files with the following structure:

```yaml
name: Recipe Title
servings: 4 servings
source: https://example.com/recipe
image: https://example.com/image.jpg
prep_time: 5 minutes
cook_time: 10 minutes
tags: |
  Category1
  Category2
ingredients: |
  1 cup flour
  2 eggs
  1/2 cup milk
directions: |
  Mix ingredients together.
  
  Bake for 30 minutes.
notes: Additional recipe notes
nutritional_info: |
  Calories: 200
  Fat: 5g
```

## Mela File Format

The converter generates JSON files compatible with Mela's specification:

```json
{
  "id": "unique-recipe-id",
  "title": "Recipe Title",
  "text": "Recipe description",
  "images": ["base64-encoded-image-or-url"],
  "categories": ["Category1", "Category2"],
  "yield": "4 servings",
  "prepTime": "5m",
  "cookTime": "10m",
  "totalTime": "15m",
  "ingredients": "1 cup flour\n2 eggs\n1/2 cup milk",
  "instructions": "Mix ingredients together.\n\nBake for 30 minutes.",
  "notes": "Additional recipe notes",
  "nutrition": "Calories: 200\nFat: 5g",
  "link": "https://example.com/recipe",
  "favorite": false,
  "wantToCook": false,
  "date": 1640995200
}
```

## Error Handling

The converter includes comprehensive error handling:

- Skips invalid files and continues processing
- Logs warnings for parsing issues
- Provides detailed error messages for debugging

## Customization

The `RecipeConverter` class can be easily extended or modified:

```javascript
const RecipeConverter = require('./recipe-converter');

const converter = new RecipeConverter();
// Customize directories
converter.recipesDir = './my-recipes';
converter.outputDir = './my-output';

// Convert specific files
const recipes = converter.convertAll();
```

## Dependencies

- **jsdom**: HTML parsing and DOM manipulation
- **yaml**: YAML file parsing
- **uuid**: Unique ID generation
- **archiver**: ZIP file creation for .melarecipes files

## Troubleshooting

### Common Issues

1. **Missing dependencies**: Run `npm install` to install required packages
2. **No recipes found**: Ensure your recipes are in the correct directory structure
3. **Parsing errors**: Check that your HTML/YML files are properly formatted
4. **Permission errors**: Ensure the script has write permissions to create the output directory

### Debug Mode

For verbose logging, you can modify the converter to include more detailed output by uncommenting debug statements or adding your own logging.

## License

MIT License - feel free to modify and distribute as needed.
