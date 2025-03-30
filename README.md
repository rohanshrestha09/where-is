# Where Is? - JavaScript Function Navigator

[![VS Code Version](https://img.shields.io/badge/VS%20Code-%3E%3D1.96.2-blue)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/rohanshrestha09/where-is/blob/development/LICENSE)

Where Is? is a VS Code extension that helps developers quickly locate and understand JavaScript function definitions and their relationships within a codebase.

## Key Features

### 🎯 Precise Function Navigation
- Jump to function definitions across your JavaScript codebase
- Handle complex function relationships with ease
- Support for both local and imported functions

### 🧠 Smart Code Analysis
- Graph-based analysis of function relationships
- Automatic detection of function implementations
- Context-aware definition lookup
- AST-based parsing for accurate results

### 🛠️ Developer Tools
- Rich hover information with function details
- Diagnostic warnings for naming conventions
- Project-specific activation and configuration
- Registry tree caching for faster lookups

## Requirements

- VS Code version ≥ 1.96.2
- Cursor editor version ≥ 0.47.8
- Windsurf editor version ≥ 1.94.0
- JavaScript files in your workspace
- Node.js and npm for development

## Configuration

Customize the extension behavior through settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `whereIs.enabledProjects` | Projects where extension is active | `["base-project"]` |
| `whereIs.enableHover` | Enable hover information | `true` |
| `whereIs.enableDefinition` | Enable go to definition | `true` |
| `whereIs.enableDiagnostic` | Enable naming convention warnings | `true` |
| `whereIs.enableAutocompletion` | Enable function call autocompletion | `true` |

## Usage

1. Open a JavaScript file in an enabled project
2. Place your cursor on a function call
3. Use `F12` or right-click and select "Go to Definition"
4. The extension will analyze the code and navigate to the function definition

## Known Issues

- Currently supports only JavaScript files
- Function lookup might be slower for very large codebases
- Some complex function relationships might not be detected correctly

## Development

### Building the Extension

```bash
# Install dependencies
npm install

# Start development mode
npm run watch

# Create production build
npm run package
```
## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Project Structure

where-is/
├── src/
│   ├── config/           # Configuration settings and constants
│   ├── constants/        # Constants used throughout the extension
│   ├── disposables/      # Disposable objects for extension lifecycle
│   ├── providers/        # Definition and Hover providers
│   ├── services/         # Core services for function discovery
│   ├── utils/            # Helper utilities and parsers
│   ├── datastructures/   # Graph implementation for call analysis
│   └── extension.ts      # Main entry point
├── dist/                 # Compiled output
└── package.json          # Extension manifest

## License

[MIT License](https://github.com/rohanshrestha09/where-is/blob/development/LICENSE)