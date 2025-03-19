# Welcome to Where Is Extension

## What's in the folder

* This folder contains all necessary files for the "where-is" extension.
* `package.json` - The manifest file that declares the extension configuration:
  * Activates on JavaScript files and startup
  * Configures preview modes for definition lookup
  * Defines build scripts and dependencies
* `src/extension.ts` - The main entry point that registers the providers:
  * Exports `activate` function that sets up Definition and Hover providers
  * Manages location and hover information caching

## Setup

* Install the recommended extensions:
  * amodio.tsl-problem-matcher
  * ms-vscode.extension-test-runner
  * dbaeumer.vscode-eslint

## Development

* Press `F5` to open a new window with the extension loaded
* The extension will activate when opening JavaScript files
* Set breakpoints in the provider files to debug the definition lookup process
* Check the debug console for any error messages or logs

## Make changes

* The extension uses esbuild for fast development builds
* Run `npm run watch` to start the development watch mode
* Use `Cmd+R` (Mac) to reload the VS Code window after changes

## Project Structure

* `src/providers/` - Contains the Definition and Hover providers
* `src/services/` - Core services for finding function definitions
* `src/utils/` - Helper utilities for file operations and AST parsing
* `src/datastructures/` - Graph implementation for function call analysis

## Run tests

* Install the Extension Test Runner
* Run `npm run watch` to start the TypeScript compiler in watch mode
* Use the Testing view or `Cmd + ; A` to run tests
* Tests are located in `src/test/` following the `**.test.ts` pattern

## Build and Package

* Run `npm run package` to create a production build
* The extension is bundled using esbuild for optimal size
* Output is generated in the `dist/` directory
* Use `vsce package` to create a VSIX file for distribution

## Next Steps

* Add more language support beyond JavaScript
* Improve the function definition discovery algorithm
* Add configuration options for search paths
* Publish the extension to the VS Code marketplace
