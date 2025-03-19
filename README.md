# Where Is

A VS Code extension that helps you quickly find function definitions in JavaScript projects by analyzing the code structure and function call relationships.

## Features

- **Function Definition Lookup**: Jump to function definitions across your JavaScript codebase
- **Smart Path Analysis**: Uses graph-based analysis to track function relationships and find the correct implementation
- **Preview Modes**: Configurable preview options for function definitions
- **Hover Information**: View function details and relationships on hover

## Requirements

- VS Code version 1.98.0 or higher
- JavaScript files in your workspace
- Node.js and npm for development

## Extension Settings

This extension contributes the following settings:

* `whereIs.previewMode`: Configure how function definitions are previewed
  * `off`: Disable preview
  * `definitionPreview`: Only show the function definition
  * `fullPreview`: Show the complete context (default)

## Usage

1. Open a JavaScript file
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
- Preview mode configuration
- Graph-based function relationship analysis
- Hover information support

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