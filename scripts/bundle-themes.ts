#!/usr/bin/env node
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as yauzl from 'yauzl'
import { parseArgs } from 'node:util'
import { IncomingMessage } from 'http'
import type { PackageJson } from 'type-fest'
import { merge } from 'es-toolkit'

interface ThemeContribution {
	label: string
	uiTheme: string
	path: string
}

type VSCodePackageJson = PackageJson & {
	displayName?: string
	publisher?: string
	extensionPack?: string[]
	contributes?: {
		themes?: ThemeContribution[]
	}
}

interface PackageJsonConfig {
	name?: string
	displayName?: string
	description?: string
	version?: string
	publisher?: string
	author?: string | { name: string; url: string }
	license?: string
	repository?: string | { type: string; url: string }
	vscodeEngine?: string
}

const packageJsonConfig: PackageJsonConfig = {
	name: 'vscode-hyperupcall-pack-bundled-themes',
	displayName: "Edwin's Pack: Bundled Themes",
	description: 'A bundle of VSCode themes',
	publisher: 'EdwinKofler',
	author: {
		name: 'Edwin Kofler',
		url: 'https://edwinkofler.com',
	},
	license: '',
	repository: 'https://github.com/hyperupcall-projects/vscode-hyperupcall-packs',
	vscodeEngine: '^1.80.0',
}

class ThemeBundler {
	private currentPackageJson: VSCodePackageJson = {}
	private bundledThemes: ThemeContribution[] = []
	private outputDir: string
	private themesDir: string
	private cacheDir: string
	private copiedThemeFiles: Map<string, string> = new Map()

	constructor(outputDir: string = '.') {
		this.outputDir = outputDir
		this.themesDir = path.join(outputDir, 'themes')
		this.cacheDir = path.join(path.dirname(import.meta.dirname), '.cache')
	}

	async initialize() {
		await fs.mkdir(this.outputDir, { recursive: true })
		await fs.rm(this.themesDir, { recursive: true, force: true })
		await fs.mkdir(this.themesDir, { recursive: true })
		await fs.mkdir(this.cacheDir, { recursive: true })

		try {
			const packagePath = path.join(this.outputDir, 'package.json')
			try {
				const data = await fs.readFile(packagePath, 'utf-8')
				this.currentPackageJson = JSON.parse(data)
			} catch (error) {
				console.warn('Could not read current package.json, will create new one')
			}
		} catch (error) {
			console.warn('Could not read current package.json, will create new one')
		}

		if (!this.currentPackageJson.contributes) {
			this.currentPackageJson.contributes = {}
		}
		if (!this.currentPackageJson.contributes.themes) {
			this.currentPackageJson.contributes.themes = []
		}
	}

	async readExtensionsFromPackageJson(packageJsonPath: string): Promise<string[]> {
		const content = await fs.readFile(packageJsonPath, 'utf-8')
		const packageJson: VSCodePackageJson = JSON.parse(content)

		if (!packageJson.extensionPack || !Array.isArray(packageJson.extensionPack)) {
			throw new Error('package.json does not contain a valid "extensionPack" array')
		}

		return packageJson.extensionPack
	}

	private async downloadFile(url: string, destinationPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const file = fsSync.createWriteStream(destinationPath)

			const timeout = setTimeout(() => {
				file.destroy()
				reject(new Error('Download timeout'))
			}, 60000)

			const urlObj = new URL(url)
			const options = {
				hostname: urlObj.hostname,
				path: urlObj.pathname + urlObj.search,
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
					Accept: '*/*',
					'Accept-Encoding': 'gzip, deflate, br',
				},
			}

			https
				.get(options, (response: IncomingMessage) => {
					if (response.statusCode === 302 || response.statusCode === 301) {
						clearTimeout(timeout)
						file.close()
						fs.unlink(destinationPath).catch(() => {})
						const redirectUrl = response.headers.location
						if (!redirectUrl) {
							reject(new Error('Redirect location not found'))
							return
						}
						return this.downloadFile(redirectUrl, destinationPath)
							.then(resolve)
							.catch(reject)
					}
					if (response.statusCode !== 200) {
						clearTimeout(timeout)
						file.close()
						fs.unlink(destinationPath).catch(() => {})
						reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
						return
					}

					response.pipe(file)
					file.on('finish', () => {
						clearTimeout(timeout)
						file.close()
						resolve()
					})
					file.on('error', (err) => {
						clearTimeout(timeout)
						file.close()
						fs.unlink(destinationPath).catch(() => {})
						reject(err)
					})
				})
				.on('error', (err) => {
					clearTimeout(timeout)
					file.close()
					fs.unlink(destinationPath).catch(() => {})
					reject(err)
				})
		})
	}

	private async fetchFromMarketplace(
		extensionId: string,
	): Promise<{ packageJson: VSCodePackageJson; extensionDir: string } | null> {
		try {
			const [publisher, name] = extensionId.split('.')
			if (!publisher || !name) {
				console.error(`Invalid extension ID format: ${extensionId}`)
				return null
			}

			const cachedExtensionDir = path.join(this.cacheDir, extensionId)
			const cachedPackagePath = path.join(cachedExtensionDir, 'package.json')

			try {
				const data = await fs.readFile(cachedPackagePath, 'utf-8')
				const packageJson = JSON.parse(data)
				console.log(`Using cached extension: ${extensionId}`)
				return {
					packageJson,
					extensionDir: cachedExtensionDir,
				}
			} catch (error) {}

			const vsixUrls = [
				`https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/latest/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`,
				`https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${publisher}/vsextensions/${name}/latest/vspackage`,
				`https://${publisher}.gallery.vsassets.io/extensions/${publisher}/${name}/latest/vspackage`,
			]

			console.log(`Downloading ${extensionId} from marketplace...`)

			const tempDir = path.join(this.outputDir, 'temp', extensionId)
			await fs.mkdir(tempDir, { recursive: true })

			const vsixPath = path.join(tempDir, `${extensionId}.vsix`)

			let downloadSuccess = false
			let lastError: Error | null = null
			for (const vsixUrl of vsixUrls) {
				try {
					console.log(`Trying URL: ${vsixUrl}`)
					await this.downloadFile(vsixUrl, vsixPath)

					const stats = await fs.stat(vsixPath)
					if (stats.size < 100) {
						throw new Error('Downloaded file is too small to be a valid VSIX')
					}

					downloadSuccess = true
					console.log(`Successfully downloaded from ${vsixUrl}`)
					break
				} catch (error) {
					lastError = error as Error
					console.warn(
						`Failed to download from ${vsixUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
					)
					try {
						await fs.unlink(vsixPath)
					} catch {}
				}
			}

			if (!downloadSuccess) {
				throw new Error(
					`Could not download extension from any marketplace URL. Last error: ${lastError?.message || 'Unknown'}`,
				)
			}

			await this.extractVsix(vsixPath, tempDir)

			const tempExtensionDir = path.join(tempDir, 'extension')
			const packagePath = path.join(tempExtensionDir, 'package.json')
			try {
				const data = await fs.readFile(packagePath, 'utf-8')
				const packageJson = JSON.parse(data)

				await fs.mkdir(cachedExtensionDir, { recursive: true })
				await fs.cp(tempExtensionDir, cachedExtensionDir, { recursive: true })
				console.log(`Cached extension: ${extensionId}`)

				return {
					packageJson,
					extensionDir: cachedExtensionDir,
				}
			} catch (error) {
				console.error(`Could not read package.json from extracted extension: ${error}`)
			}

			return null
		} catch (error) {
			console.error(`Error downloading from marketplace: ${error}`)
			return null
		}
	}

	private async extractVsix(vsixPath: string, extractDir: string): Promise<void> {
		return new Promise((resolve, reject) => {
			yauzl.open(
				vsixPath,
				{ lazyEntries: true },
				(err: Error | null, zipfile?: yauzl.ZipFile) => {
					if (err) {
						reject(err)
						return
					}

					if (!zipfile) {
						reject(new Error('Failed to open VSIX file'))
						return
					}

					zipfile.readEntry()
					zipfile.on('entry', (entry: yauzl.Entry) => {
						if (/\/$/.test(entry.fileName)) {
							const dirPath = path.join(extractDir, entry.fileName)
							fs.mkdir(dirPath, { recursive: true }).then(() => {
								zipfile.readEntry()
							})
						} else {
							zipfile.openReadStream(
								entry,
								(err: Error | null, readStream?: NodeJS.ReadableStream) => {
									if (err) {
										reject(err)
										return
									}

									if (!readStream) {
										reject(new Error('Failed to create read stream'))
										return
									}

									const filePath = path.join(extractDir, entry.fileName)
									fs.mkdir(path.dirname(filePath), {
										recursive: true,
									}).then(() => {
										const writeStream = fsSync.createWriteStream(filePath)
										readStream.pipe(writeStream)
										writeStream.on('close', () => {
											zipfile.readEntry()
										})
										writeStream.on('error', reject)
									})
								},
							)
						}
					})

					zipfile.on('end', () => {
						resolve()
					})

					zipfile.on('error', reject)
				},
			)
		})
	}

	async fetchExtensionData(
		extensionId: string,
	): Promise<{ packageJson: VSCodePackageJson; extensionDir: string } | null> {
		try {
			const result = await this.fetchFromMarketplace(extensionId)

			if (!result) {
				console.warn(`Could not find extension: ${extensionId}`)
				return null
			}

			return result
		} catch (error) {
			console.error(`Error fetching extension data for ${extensionId}:`, error)
			return null
		}
	}

	async copyThemeFile(
		sourcePath: string,
		themeName: string,
		extensionId: string,
	): Promise<string> {
		const normalizedSourcePath = path.resolve(sourcePath)
		if (this.copiedThemeFiles.has(normalizedSourcePath)) {
			const existingDestPath = this.copiedThemeFiles.get(normalizedSourcePath)!
			console.log(`Theme file already copied, reusing: ${existingDestPath}`)
			return existingDestPath
		}

		const fileName = path.basename(sourcePath)
		const destinationPath = path.join(this.themesDir, fileName)

		let finalDestination = destinationPath
		try {
			await fs.access(destinationPath)
			const ext = path.extname(fileName)
			const nameWithoutExt = path.basename(fileName, ext)
			const extensionName = extensionId.replace(/\./g, '-')
			finalDestination = path.join(
				this.themesDir,
				`${nameWithoutExt}-${extensionName}-${themeName}${ext}`,
			)
		} catch (error) {}

		await fs.copyFile(sourcePath, finalDestination)

		const relativePath = path
			.relative(this.outputDir, finalDestination)
			.replace(/\\/g, '/')

		this.copiedThemeFiles.set(normalizedSourcePath, relativePath)

		return relativePath
	}

	async processExtension(extensionId: string): Promise<void> {
		console.log(`Processing extension: ${extensionId}`)

		const extensionData = await this.fetchExtensionData(extensionId)
		if (!extensionData || !extensionData.packageJson.contributes?.themes) {
			console.warn(`No themes found in extension: ${extensionId}`)
			return
		}

		const { packageJson, extensionDir } = extensionData

		for (const theme of packageJson.contributes?.themes || []) {
			try {
				const themeFilePath = path.resolve(extensionDir, theme.path)

				try {
					await fs.access(themeFilePath)
					const newDestPath = await this.copyThemeFile(
						themeFilePath,
						theme.label,
						extensionId,
					)

					this.bundledThemes.push({
						...theme,
						path: newDestPath,
					})

					console.log(`Added theme: ${theme.label} from ${extensionId}`)
				} catch (error) {
					console.warn(`Theme file not found: ${themeFilePath}`)
				}
			} catch (error) {
				console.error(`Error processing theme ${theme.label}:`, error)
			}
		}
	}

	async savePackageJson(): Promise<void> {
		this.currentPackageJson.contributes!.themes = this.bundledThemes

		const configToMerge: any = {}

		if (packageJsonConfig.name) configToMerge.name = packageJsonConfig.name
		if (packageJsonConfig.displayName)
			configToMerge.displayName = packageJsonConfig.displayName
		if (packageJsonConfig.description)
			configToMerge.description = packageJsonConfig.description
		if (packageJsonConfig.version) configToMerge.version = packageJsonConfig.version
		if (packageJsonConfig.publisher) configToMerge.publisher = packageJsonConfig.publisher
		if (packageJsonConfig.author) configToMerge.author = packageJsonConfig.author
		if (packageJsonConfig.license) configToMerge.license = packageJsonConfig.license
		if (packageJsonConfig.repository) {
			configToMerge.repository = {
				type: 'git',
				url: packageJsonConfig.repository,
			}
		}
		if (packageJsonConfig.vscodeEngine) {
			configToMerge.engines = {
				vscode: packageJsonConfig.vscodeEngine,
			}
		}

		this.currentPackageJson = merge(this.currentPackageJson, configToMerge)

		if (!this.currentPackageJson.categories) {
			this.currentPackageJson.categories = ['Themes']
		}

		const packagePath = path.join(this.outputDir, 'package.json')
		await fs.writeFile(packagePath, JSON.stringify(this.currentPackageJson, null, 2))

		console.log(`Updated package.json with ${this.bundledThemes.length} themes`)
	}

	async bundle(packageJsonPath: string): Promise<void> {
		await this.initialize()

		const extensions = await this.readExtensionsFromPackageJson(packageJsonPath)
		console.log(`Found ${extensions.length} extensions to process`)

		for (const extension of extensions) {
			await this.processExtension(extension)
		}

		await this.savePackageJson()

		const tempDir = path.join(this.outputDir, 'temp')
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {}

		console.log('Theme bundling completed!')
		console.log(`Total themes bundled: ${this.bundledThemes.length}`)
	}
}

async function main() {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			output: {
				type: 'string',
				short: 'o',
				default: '.',
			},
			help: {
				type: 'boolean',
				short: 'h',
				default: false,
			},
		},
		allowPositionals: true,
	})

	if (values.help || positionals.length === 0) {
		console.log(`
VSCode Theme Bundle - Bundle multiple VSCode theme extensions into one

Usage: theme-bundle <package.json> [options]

Arguments:
  <package.json>    Path to package.json with extensionPack property

Options:
  -o, --output <dir>  Output directory (default: ".")
  -h, --help          Show this help message

Example:
  theme-bundle ./package.json -o ./output
  theme-bundle ./my-themes.json --output ./bundled

The package.json must contain an "extensionPack" array with extension IDs:
{
  "extensionPack": [
    "dracula-theme.theme-dracula",
    "github.github-vscode-theme"
  ]
}
`)
		process.exit(values.help ? 0 : 1)
	}

	const packageJsonPath = positionals[0]
	const outputDir = values.output as string

	try {
		const bundler = new ThemeBundler(outputDir)
		await bundler.bundle(packageJsonPath)
	} catch (error) {
		console.error('Error during bundling:', error)
		process.exit(1)
	}
}

main()
