#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { JSDOM } = require("jsdom")
const yaml = require("yaml")
const { v4: uuidv4 } = require("uuid")
const https = require("https")
const http = require("http")

// Helper function to convert a string to proper case (capitalize first letter, rest lower case)
function toProperCase(str) {
	if (!str) return ""
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Helper function to format minutes as 'Xh Ym' if >= 60, otherwise 'Xm'
function formatMinutesToHM(minutes) {
	if (!minutes || isNaN(minutes)) return ""
	minutes = parseInt(minutes)
	if (minutes < 60) return `${minutes}m`
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	return m === 0 ? `${h}h` : `${h}h ${m}m`
}

class RecipeConverter {
	constructor() {
		this.recipesDir = "./recipes"
		this.outputDir = "./output"
		this.ensureOutputDir()
	}

	ensureOutputDir() {
		if (!fs.existsSync(this.outputDir)) {
			fs.mkdirSync(this.outputDir, { recursive: true })
		}
	}

	// Parse HTML recipe files
	async parseHTMLRecipe(filePath) {
		try {
			const htmlContent = fs.readFileSync(filePath, "utf-8")
			const dom = new JSDOM(htmlContent)
			const document = dom.window.document

			// Try to find JSON-LD structured data first
			const jsonLdScript = document.querySelector(
				'script[type="application/ld+json"]'
			)
			let structuredData = null

			if (jsonLdScript) {
				try {
					structuredData = JSON.parse(jsonLdScript.textContent)
				} catch (e) {
					console.warn(`Failed to parse JSON-LD in ${filePath}:`, e.message)
				}
			}

			// Extract and format times
			const prepMins = this.parseTimeToMinutes(
				this.extractPrepTime(structuredData, document)
			)
			const cookMins = this.parseTimeToMinutes(
				this.extractCookTime(structuredData, document)
			)
			const otherMins = 0 // Add logic if you have other_time
			const totalMins = prepMins + cookMins + otherMins

			// Extract recipe data
			const recipe = {
				id: this.generateId(filePath),
				title: toProperCase(this.extractTitle(structuredData, document)),
				text: this.extractDescription(structuredData, document),
				images: this.extractImages(structuredData, document),
				categories: this.extractCategories(structuredData, document),
				yield: this.extractYield(structuredData, document),
				prepTime: formatMinutesToHM(prepMins),
				cookTime: formatMinutesToHM(cookMins),
				totalTime: formatMinutesToHM(totalMins),
				ingredients: this.extractIngredients(structuredData, document),
				instructions: this.extractInstructions(structuredData, document),
				notes: this.extractNotes(structuredData, document),
				nutrition: this.extractNutrition(structuredData, document),
				link: this.extractSource(structuredData, document),
				favorite: false,
				wantToCook: false,
				date: Date.now() / 1000, // Current timestamp
			}

			// Convert images to base64
			console.log(`  Processing images for: ${recipe.title}`)
			recipe.images = await this.convertImagesToBase64(recipe.images)

			return recipe
		} catch (error) {
			console.error(`Error parsing HTML recipe ${filePath}:`, error.message)
			return null
		}
	}

	// Parse YML recipe files
	parseYMLRecipe(filePath) {
		try {
			const ymlContent = fs.readFileSync(filePath, "utf-8")
			const data = yaml.parse(ymlContent)

			// Extract and format times
			const prepMins = this.parseTimeToMinutes(data.prep_time)
			const cookMins = this.parseTimeToMinutes(data.cook_time)
			const otherMins = this.parseTimeToMinutes(data.other_time)
			const totalMins = prepMins + cookMins + otherMins

			const recipe = {
				id: this.generateId(filePath),
				title: toProperCase(data.name || ""),
				text: data.notes || "",
				images: data.image ? [data.image] : [],
				categories: this.parseYMLTags(data.tags),
				yield: data.servings || "",
				prepTime: formatMinutesToHM(prepMins),
				cookTime: formatMinutesToHM(cookMins),
				otherTime: formatMinutesToHM(otherMins),
				totalTime: formatMinutesToHM(totalMins),
				ingredients: this.formatYMLIngredients(data.ingredients),
				instructions: this.formatYMLDirections(data.directions),
				notes: data.notes || "",
				nutrition: data.nutritional_info || "",
				link: data.source || "",
				favorite: data.favorite === "yes" || data.on_favorites === "yes",
				wantToCook: false,
				date: this.parseYMLDate(data.created) || Date.now() / 1000,
			}

			return recipe
		} catch (error) {
			console.error(`Error parsing YML recipe ${filePath}:`, error.message)
			return null
		}
	}

	// Helper methods for HTML parsing
	extractTitle(structuredData, document) {
		if (structuredData && structuredData.name) {
			return structuredData.name
		}
		const titleElement = document.querySelector('[itemprop="name"], h1')
		return titleElement ? titleElement.textContent.trim() : ""
	}

	extractDescription(structuredData, document) {
		if (structuredData && structuredData.description) {
			return structuredData.description
		}
		const descElement = document.querySelector('[itemprop="description"]')
		return descElement ? descElement.textContent.trim() : ""
	}

	extractImages(structuredData, document) {
		const images = []

		if (structuredData && structuredData.image) {
			if (Array.isArray(structuredData.image)) {
				images.push(...structuredData.image)
			} else {
				images.push(structuredData.image)
			}
		}

		// Also check for img elements
		const imgElements = document.querySelectorAll('[itemprop="image"], img')
		imgElements.forEach((img) => {
			const src = img.getAttribute("src") || img.getAttribute("content")
			if (src && !images.includes(src)) {
				images.push(src)
			}
		})

		return images
	}

	extractCategories(structuredData, document) {
		const categories = []

		if (structuredData) {
			if (structuredData.recipeCategory) {
				const cats = Array.isArray(structuredData.recipeCategory)
					? structuredData.recipeCategory
					: [structuredData.recipeCategory]
				categories.push(...cats)
			}
			if (structuredData.keywords) {
				const keywords = structuredData.keywords.split(",").map((k) => k.trim())
				categories.push(...keywords)
			}
		}

		return categories
	}

	extractYield(structuredData, document) {
		if (structuredData && structuredData.recipeYield) {
			return Array.isArray(structuredData.recipeYield)
				? structuredData.recipeYield.join(", ")
				: structuredData.recipeYield
		}
		const yieldElement = document.querySelector('[itemprop="recipeYield"]')
		return yieldElement ? yieldElement.textContent.trim() : ""
	}

	extractPrepTime(structuredData, document) {
		if (structuredData && structuredData.prepTime) {
			return this.formatDuration(structuredData.prepTime)
		}
		const prepElement = document.querySelector('[itemprop="prepTime"]')
		return prepElement ? prepElement.textContent.trim() : ""
	}

	extractCookTime(structuredData, document) {
		if (structuredData && structuredData.cookTime) {
			return this.formatDuration(structuredData.cookTime)
		}
		const cookElement = document.querySelector('[itemprop="cookTime"]')
		return cookElement ? cookElement.textContent.trim() : ""
	}

	extractTotalTime(structuredData, document) {
		if (structuredData && structuredData.totalTime) {
			return this.formatDuration(structuredData.totalTime)
		}
		const totalElement = document.querySelector('[itemprop="totalTime"]')
		return totalElement ? totalElement.textContent.trim() : ""
	}

	extractIngredients(structuredData, document) {
		let ingredients = []

		if (structuredData && structuredData.recipeIngredient) {
			ingredients = Array.isArray(structuredData.recipeIngredient)
				? structuredData.recipeIngredient
				: [structuredData.recipeIngredient]
		} else {
			const ingredientElements = document.querySelectorAll(
				'[itemprop="recipeIngredient"]'
			)
			ingredients = Array.from(ingredientElements).map((el) =>
				el.textContent.trim()
			)
		}

		return ingredients.join("\n")
	}

	extractInstructions(structuredData, document) {
		let instructions = []

		if (structuredData && structuredData.recipeInstructions) {
			instructions = Array.isArray(structuredData.recipeInstructions)
				? structuredData.recipeInstructions
				: [structuredData.recipeInstructions]

			instructions = instructions.map((instruction) => {
				if (typeof instruction === "object" && instruction.text) {
					return instruction.text
				}
				return instruction.toString()
			})
		} else {
			const instructionElements = document.querySelectorAll(
				'[itemprop="recipeInstruction"]'
			)
			instructions = Array.from(instructionElements).map((el) =>
				el.textContent.trim()
			)
		}

		return instructions.join("\n\n")
	}

	extractNotes(structuredData, document) {
		if (structuredData && structuredData.notes) {
			return structuredData.notes
		}
		return ""
	}

	extractNutrition(structuredData, document) {
		if (structuredData && structuredData.nutrition) {
			return structuredData.nutrition
		}
		const nutritionElement = document.querySelector('[itemprop="nutrition"]')
		return nutritionElement ? nutritionElement.textContent.trim() : ""
	}

	extractSource(structuredData, document) {
		if (structuredData && structuredData.author) {
			if (
				typeof structuredData.author === "object" &&
				structuredData.author.url
			) {
				return structuredData.author.url
			}
			if (typeof structuredData.author === "string") {
				return structuredData.author
			}
		}

		const sourceElement = document.querySelector('[itemprop="author"]')
		return sourceElement ? sourceElement.textContent.trim() : ""
	}

	// Helper methods for YML parsing
	parseYMLTags(tags) {
		if (!tags) return []
		if (typeof tags === "string") {
			return tags
				.split("\n")
				.filter((tag) => tag.trim())
				.map((tag) => tag.trim())
		}
		return []
	}

	formatYMLIngredients(ingredients) {
		if (!ingredients) return ""
		if (typeof ingredients === "string") {
			return ingredients
				.split("\n")
				.filter((line) => line.trim())
				.join("\n")
		}
		return ""
	}

	formatYMLDirections(directions) {
		if (!directions) return ""
		if (typeof directions === "string") {
			return directions
				.split("\n")
				.filter((line) => line.trim())
				.join("\n\n")
		}
		return ""
	}

	calculateTotalTime(prepTime, cookTime, otherTime) {
		const prep = this.parseTimeToMinutes(prepTime)
		const cook = this.parseTimeToMinutes(cookTime)
		const other = this.parseTimeToMinutes(otherTime)
		const total = prep + cook + other
		return formatMinutesToHM(total)
	}

	parseTimeToMinutes(timeStr) {
		if (!timeStr) return 0
		const match = timeStr.match(/(\d+)\s*minutes?/i)
		return match ? parseInt(match[1]) : 0
	}

	parseYMLDate(dateStr) {
		if (!dateStr) return null
		// Parse timestamps like "CookBook App (1750853689812)"
		const match = dateStr.match(/\((\d+)\)/)
		if (match) {
			return parseInt(match[1]) / 1000 // Convert to seconds
		}
		return null
	}

	// Image download and conversion methods
	async downloadImageAsBase64(url, redirectCount = 0) {
		const MAX_REDIRECTS = 5
		const TIMEOUT_MS = 15000
		return new Promise((resolve, reject) => {
			if (!url || typeof url !== "string") {
				resolve(null)
				return
			}

			const protocol = url.startsWith("https:") ? https : http
			const request = protocol.get(url, (response) => {
				// Handle redirects (3xx)
				if (
					response.statusCode >= 300 &&
					response.statusCode < 400 &&
					response.headers.location
				) {
					if (redirectCount < MAX_REDIRECTS) {
						const redirectUrl = response.headers.location.startsWith("http")
							? response.headers.location
							: url.replace(/^(https?:\/\/[^\/]+).*/, "$1") +
							  response.headers.location
						response.destroy()
						resolve(this.downloadImageAsBase64(redirectUrl, redirectCount + 1))
						return
					} else {
						console.warn(`Too many redirects for image: ${url}`)
						resolve(null)
						return
					}
				}

				if (response.statusCode !== 200) {
					console.warn(
						`Failed to download image: ${url} (Status: ${response.statusCode})`
					)
					resolve(null)
					return
				}

				const contentType = response.headers["content-type"] || ""
				if (!contentType.startsWith("image/")) {
					console.warn(
						`URL did not return an image: ${url} (Content-Type: ${contentType})`
					)
					resolve(null)
					return
				}

				const chunks = []
				response.on("data", (chunk) => chunks.push(chunk))
				response.on("end", () => {
					try {
						const buffer = Buffer.concat(chunks)
						const base64 = buffer.toString("base64")
						const dataUrl = `data:${contentType};base64,${base64}`
						resolve(dataUrl)
					} catch (error) {
						console.warn(
							`Error converting image to base64: ${url}`,
							error.message
						)
						resolve(null)
					}
				})
			})

			request.on("error", (error) => {
				console.warn(`Error downloading image: ${url}`, error.message)
				resolve(null)
			})

			// Add timeout
			request.setTimeout(TIMEOUT_MS, () => {
				console.warn(`Timeout downloading image: ${url}`)
				request.abort()
				resolve(null)
			})
		})
	}

	async convertImagesToBase64(imageUrls) {
		if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
			return []
		}

		const base64Images = []
		for (const url of imageUrls) {
			if (
				url &&
				typeof url === "string" &&
				(url.startsWith("http://") || url.startsWith("https://"))
			) {
				console.log(`  Downloading image: ${url}`)
				const base64Image = await this.downloadImageAsBase64(url)
				if (base64Image) {
					// Remove data URL prefix and escape all slashes as \/
					const base64Raw = base64Image
						.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")
						.replace(/\//g, "\\/") // Note: Add an additional slash to make replacement easier during file write (see note below)
					base64Images.push(base64Raw)
				}
			}
		}
		return base64Images
	}

	// Utility methods
	generateId(filePath) {
		// Use filename without extension as base, or generate UUID
		const basename = path.basename(filePath, path.extname(filePath))
		return basename || uuidv4()
	}

	formatDuration(duration) {
		// Convert ISO 8601 duration to readable format
		if (duration.startsWith("PT")) {
			const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
			if (match) {
				const hours = parseInt(match[1] || 0)
				const minutes = parseInt(match[2] || 0)
				if (hours && minutes) {
					return `${hours}h ${minutes}m`
				} else if (hours) {
					return `${hours}h`
				} else if (minutes) {
					return `${minutes}m`
				}
			}
		}
		return duration
	}

	// Main conversion methods
	async convertHTMLFiles() {
		const htmlDir = path.join(this.recipesDir, "HTML")
		if (!fs.existsSync(htmlDir)) {
			console.log("HTML directory not found")
			return []
		}

		const htmlFiles = fs
			.readdirSync(htmlDir)
			.filter((file) => file.endsWith(".html"))
		const convertedRecipes = []

		for (const file of htmlFiles) {
			console.log(`Converting HTML: ${file}`)
			const filePath = path.join(htmlDir, file)
			const recipe = await this.parseHTMLRecipe(filePath)

			if (recipe) {
				const outputPath = path.join(this.outputDir, `${recipe.id}.melarecipe`)
				fs.writeFileSync(outputPath, json)
				convertedRecipes.push(recipe)
				console.log(`✓ Converted: ${outputPath}`)
			}
		}

		return convertedRecipes
	}

	async convertYMLFiles() {
		const ymlDir = path.join(this.recipesDir, "YML")
		if (!fs.existsSync(ymlDir)) {
			console.log("YML directory not found")
			return []
		}

		const ymlFiles = fs
			.readdirSync(ymlDir)
			.filter((file) => file.endsWith(".yml"))
		const convertedRecipes = []

		for (const file of ymlFiles) {
			console.log(`Converting YML: ${file}`)
			const filePath = path.join(ymlDir, file)
			const recipe = this.parseYMLRecipe(filePath)

			if (recipe) {
				// Convert images to base64
				console.log(`  Processing images for: ${recipe.title}`)
				recipe.images = await this.convertImagesToBase64(recipe.images)

				const outputPath = path.join(this.outputDir, `${recipe.id}.melarecipe`)
				// Note: MelaRecipe images have this termination that screws with JSON.stringify so manually fix
				const escapedRecipe = JSON.stringify(recipe, null, 2).replace(
					/\\\//g,
					"/"
				)
				fs.writeFileSync(outputPath, escapedRecipe)
				convertedRecipes.push(recipe)
				console.log(`✓ Converted: ${outputPath}`)
			}
		}

		// Create ZIP file if recipes were converted
		if (convertedRecipes.length > 0) {
			this.createMelaRecipesFile(convertedRecipes)
		}

		return convertedRecipes
	}

	async convertAll() {
		console.log("Starting recipe conversion...")

		const htmlRecipes = await this.convertHTMLFiles()
		const ymlRecipes = await this.convertYMLFiles()

		const allRecipes = [...htmlRecipes, ...ymlRecipes]

		// Create a combined .melarecipes file (ZIP)
		if (allRecipes.length > 0) {
			this.createMelaRecipesFile(allRecipes)
		}

		console.log(`\nConversion complete!`)
		console.log(`HTML recipes converted: ${htmlRecipes.length}`)
		console.log(`YML recipes converted: ${ymlRecipes.length}`)
		console.log(`Total recipes: ${allRecipes.length}`)
		console.log(`Output directory: ${this.outputDir}`)

		return allRecipes
	}

	createMelaRecipesFile(recipes) {
		const archiver = require("archiver")
		const output = fs.createWriteStream(
			path.join(this.outputDir, "recipes.melarecipes")
		)
		const archive = archiver("zip", { zlib: { level: 9 } })

		output.on("close", () => {
			console.log(`✓ Created recipes.melarecipes (${archive.pointer()} bytes)`)
		})

		archive.on("error", (err) => {
			throw err
		})

		archive.pipe(output)

		recipes.forEach((recipe) => {
			archive.append(JSON.stringify(recipe, null, 2), {
				name: `${recipe.id}.melarecipe`,
			})
		})

		archive.finalize()
	}
}

// CLI usage
if (require.main === module) {
	const converter = new RecipeConverter()

	const args = process.argv.slice(2)
	const command = args[0]

	;(async () => {
		try {
			switch (command) {
				case "html":
					await converter.convertHTMLFiles()
					break
				case "yml":
					await converter.convertYMLFiles()
					break
				case "all":
				default:
					await converter.convertAll()
					break
			}
		} catch (error) {
			console.error("Error during conversion:", error)
			process.exit(1)
		}
	})()
}

module.exports = RecipeConverter
