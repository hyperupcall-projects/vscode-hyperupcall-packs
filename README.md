# vscode-hyperupcall-packs

My VSCode extension packs for use in [Profiles](https://code.visualstudio.com/docs/editor/profiles) and [Containers](https://code.visualstudio.com/docs/devcontainers/containers).

## Summary

There are three categories of plugin packs:

### 1. Decoration packs

- Base (Things like EditorConfig, TODO highlighting, etc.)
- Core (Contains all decoration packs except itself)
- Icons (Adds [file icon themes](https://code.visualstudio.com/api/extension-guides/file-icon-theme))
- Product Icons (Adds [product icon themes](https://code.visualstudio.com/api/extension-guides/product-icon-theme))
- Syntax (Adds [syntax highlightings](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide))
- Themes (Adds [color themes](https://code.visualstudio.com/api/extension-guides/color-theme))

### 2. Ecosystem packs

- All (All ecosystem packs and platform packs)
- Cpp
- DevOps
- Go
- Java
- LaTeX
- Markdown
- PHP
- Python
- Ruby
- Rust
- Shell
- Web

### 3. Platform packs

- \*nix
- Windows

## Usage

Click the _Extensions_ tab and search for `Edwin's Pack:` to see all the packs. I recommend choosing one extension from each category (they are color-coded). For example, see this [`devcontainer.json`](https://code.visualstudio.com/docs/devcontainers/containers):

```jsonc
{
	"image": "mcr.microsoft.com/devcontainers/typescript-node",
	"forwardPorts": [3000],
	"customizations": {
		"vscode": {
			"extensions": [
				"EdwinKofler.vscode-hyperupcall-pack-core",
				"EdwinKofler.vscode-hyperupcall-pack-web",
				"EdwinKofler.vscode-hyperupcall-pack-unix",
			],
		},
	},
}
```

- C++ Logo: [Jeremy Kratz, Public domain, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:ISO_C%2B%2B_Logo.svg)
- Kubernetes Logo: [Google, Public domain, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Kubernetes_logo_without_workmark.svg)
- Go Logo: [The Go Authors, Public domain, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Go_Logo_Blue.svg)
- Java Logo: [Mark Andersonm, Fair Use, via Wikimedia Commons](https://en.wikipedia.org/wiki/File:Java_programming_language_logo.svg)
- Latex Logo: [Alejo2083, Public domain, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:TeX_logo.svg)
- Markdown Logo: [Dustin Curtis, CC0, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Markdown-mark.svg)
- PHP Logo: [Colin Viebrock, CC BY-SA 4.0, via Wikimedia Commons](https://en.wikipedia.org/wiki/File:PHP-logo.svg)
- Python Logo: [www.python.org, GPL <http://www.gnu.org/licenses/gpl.html>, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Python-logo-notext.svg)
- Ruby Logo: [Yukihiro Matsumoto, Ruby Visual Identity Team, CC BY-SA 2.5 <https://creativecommons.org/licenses/by-sa/2.5>, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ruby_logo.svg)
- Rust Logo: [Rust Foundation, CC BY 4.0 <https://creativecommons.org/licenses/by/4.0>, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rust_programming_language_black_logo.svg)
- JavaScript Logo: [Christopher Williams, Public domain, via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Unofficial_JavaScript_logo_2.svg)
- Unix Logo: [lewing@isc.tamu.edu Larry Ewing and The GIMP, CC0 1.0, via Wikimedia Commons](https://en.wikipedia.org/wiki/File:Tux.svg)
- Windows Logo: [Microsoft, Public domain, via Wikimedia Commons](<https://commons.wikimedia.org/wiki/File:Windows_Logo_(1992-2001).svg>)
