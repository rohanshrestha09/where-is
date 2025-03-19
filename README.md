# Where Is

A VS Code extension that helps you quickly find function definitions in JavaScript projects by analyzing the code structure and function call relationships.

## Features

- **Function Definition Lookup**: Jump to function definitions across your JavaScript codebase
- **Smart Path Analysis**: Uses graph-based analysis to track function relationships and find the correct implementation
- **Hover Information**: View function details and relationships on hover
- **Diagnostic Warnings**: Get suggestions for consistent naming conventions

## Requirements

- VS Code version 1.98.0 or higher
- JavaScript files in your workspace
- Node.js and npm for development

## Extension Settings

This extension contributes the following settings:

* `whereIs.enabledProjects`: List of project names where the extension should be enabled
  * Default: `["base-project"]`
* `whereIs.enableHover`: Enable or disable hover information for function calls
  * Default: `true`
* `whereIs.enableDefinition`: Enable or disable go to definition functionality
  * Default: `true`
* `whereIs.enableDiagnostic`: Enable or disable diagnostic warnings for naming conventions
  * Default: `true`

## Usage

1. Open a JavaScript file in an enabled project
2. Place your cursor on a function call
3. Use `F12` or right-click and select "Go to Definition"
4. The extension will analyze the code and navigate to the function definition

## Known Issues

- Currently supports only JavaScript files
- Function lookup might be slower for very large codebases
- Some complex function relationships might not be detected correctly

## Release Notes

### 0.0.1

Initial release with features:
- Basic function definition lookup
- Project-specific activation
- Graph-based function relationship analysis
- Hover information support
- Diagnostic warnings for naming conventions

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

## License

[MIT License](https://github.com/rohanshrestha09/where-is/blob/development/LICENSE)