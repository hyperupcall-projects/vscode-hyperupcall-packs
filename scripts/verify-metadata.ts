#!/usr/bin/env node
import type { PackageJson } from 'type-fest'
import fs from 'node:fs'
import path from 'node:path'

let hasError = false

const logError = (pack: string, message: string) => {
	console.error(`[${pack}] Error: ${message}`)
	hasError = true
}

for (const stat of fs.readdirSync('./', { withFileTypes: true })) {
	if (!stat.isDirectory() || !stat.name.startsWith('pack-')) {
		continue
	}
	const packDir = stat.name
	const packageJsonPath = path.join(packDir, 'package.json')
	const readmePath = path.join(packDir, 'README.md')

	if (!fs.existsSync(packageJsonPath)) {
		logError(packDir, 'package.json not found')
		continue
	}
	if (!fs.existsSync(readmePath)) {
		logError(packDir, 'README.md not found')
		continue
	}

	const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
	const readmeLines = fs.readFileSync(readmePath, 'utf-8').split('\n')

	// Assert that readme title is equivalent to the display name.
	if (!packageJson.name) {
		logError(packDir, 'package.json missing name')
		continue
	}
	if (readmeLines[0].replace(/\\/g, '') !== `# ${packageJson.displayName}`) {
		logError(
			packDir,
			`README title "${readmeLines[0]}" is not equal to "# ${packageJson.displayName}"`,
		)
	}

	// Assert that config.namePretty matches the last part of displayName.
	const config = (packageJson as any).config
	if (!config || !config.namePretty) {
		logError(packDir, 'package.json missing config.namePretty')
	} else if (packageJson.displayName) {
		const lastPart = packageJson.displayName.split(':').at(-1).trim()
		if (lastPart !== config.namePretty) {
			logError(
				packDir,
				`config.namePretty "${config.namePretty}" does not match last part of displayName "${lastPart}"`,
			)
		}
	}

	// Assert that readme has correct marketplace links.
	if (!packageJson.publisher) {
		logError(packDir, 'package.json missing publisher')
		continue
	}
	const expectedVSMarketplaceLink = `See on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=${packageJson.publisher}.${packageJson.name})`
	const expectedOpenVSXLink = `See on [Open VSX](https://open-vsx.org/extension/${packageJson.publisher}/${packageJson.name})`
	if (readmeLines[2] !== `- ${expectedVSMarketplaceLink}`) {
		logError(
			packDir,
			`Link "${readmeLines[2]}" is not equal to "- ${expectedVSMarketplaceLink}"`,
		)
	}
	if (readmeLines[3] !== `- ${expectedOpenVSXLink}`) {
		logError(
			packDir,
			`Link "${readmeLines[3]}" is not equal to "- ${expectedOpenVSXLink}"`,
		)
	}

	// Assert that readme has a line with "Includes:".
	if (readmeLines[5] !== 'Includes:') {
		logError(packDir, 'README missing "Includes:" line')
	}

	// Assert that extensions in readme and package.json are equivalent and in the same order.
	let extensionPack = (packageJson.extensionPack as string[]) || []
	if (packDir === 'pack-decoration-bundled-themes') {
		const themesPackageJson: PackageJson = JSON.parse(
			fs.readFileSync(path.join('pack-decoration-themes', 'package.json'), 'utf-8'),
		)
		extensionPack = (themesPackageJson.extensionPack as string[]) || []
	}
	const readmeExtensions: string[] = []
	const extensionLinkRegex = /^- \[.*?\]\(.*?itemName=([^)]+)\)/
	for (const line of readmeLines) {
		const match = line.match(extensionLinkRegex)
		if (match) {
			readmeExtensions.push(match[1])
		}
	}
	if (extensionPack.length !== readmeExtensions.length) {
		logError(
			packDir,
			`Extension count mismatch. package.json: ${extensionPack.length}; README: ${readmeExtensions.length}`,
		)
	} else {
		for (let i = 0; i < extensionPack.length; i++) {
			if (extensionPack[i] !== readmeExtensions[i]) {
				logError(
					packDir,
					`Extension mismatch at index ${i}. package.json: ${extensionPack[i]}, README: ${readmeExtensions[i]}`,
				)
			}
		}
	}
}

if (hasError) {
	process.exit(1)
} else {
	console.info('Success!')
}
