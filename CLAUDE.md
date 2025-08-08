# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **@deploxy/cli**, a tool for deploying STDIO-based MCP (Model Context Protocol) servers to a hosted environment while publishing proxy packages to npm. It solves the problem of keeping MCP server source code private while maintaining npm package compatibility.

### Core Functionality
- Hosts MCP servers privately on secure infrastructure
- Publishes proxy npm packages that call the hosted servers
- Supports both JavaScript/TypeScript and Python MCP servers
- Handles npm package validation and publishing permissions
- Automates file compression, upload, and deployment processes

## Architecture

### Entry Point (`src/index.ts`)
- **CLI Commands**: Uses Commander.js with `init` and `deploy` commands
- **Main Functions**:
  - `runInit()`: Creates `.deploxy.json` config and sets up project
  - `runDeploy()`: Orchestrates the entire deployment process
  - `deployJsPackage()`: Handles JavaScript/TypeScript MCP server deployment
  - `deployPythonPackage()`: Handles Python MCP server deployment

### Core Libraries (`src/lib/`)
- **`constant.ts`**: Configuration constants (API URLs, runtime options, memory sizes)
- **`metadata.ts`**: Configuration parsing, package.json handling, file inclusion logic
- **`npm.ts`**: NPM registry validation, credential handling, package ownership checks
- **`python.ts`**: Python package handling, pyproject.toml parsing, wheel file detection
- **`upload.ts`**: File upload to Deploxy hosting service
- **`zip.ts`**: Archive creation for both JS and Python packages

### Configuration System
- **`.deploxy.json`**: Main configuration file with auth tokens, runtime settings, memory allocation
- **Environment Variable Substitution**: Supports `${process.env.VAR_NAME}` syntax in config files
- **Package Type Detection**: Automatically handles both `js` and `py` package types

### Validation Pipeline
1. **Config Validation**: Checks `.deploxy.json` for required fields and valid runtime/memory settings
2. **Package Validation**: Validates npm package existence, version conflicts, and publish permissions
3. **File System Validation**: Ensures required files exist (package.json, tsconfig.json, etc.)
4. **Pre-upload Validation**: Verifies package structure before deployment

## Common Development Commands

### Build and Run
```bash
# Build TypeScript to JavaScript
npm run build

# Run the built CLI
npm start

# Run with arguments
node dist/index.js init
node dist/index.js deploy
```

### Package Management
```bash
# Deploy to npm (requires proper credentials)
npm run deploy

# Install dependencies
pnpm install
```

### Testing the CLI
```bash
# Test initialization
node dist/index.js init ./test-project

# Test deployment
node dist/index.js deploy ./test-project
```

## Development Notes

### TypeScript Configuration
- **Target**: ES2022 with NodeNext module resolution
- **Output**: Compiled to `dist/` directory
- **Module System**: ESM with `.js` extensions in imports

### Package Structure Requirements
- **For JS/TS packages**: Must have `bin` field in package.json with exactly one entry
- **For Python packages**: Must have `pyproject.toml` and generated wheel files in `dist/`
- **Authentication**: Requires `.npmrc` file with npm auth token

### File Inclusion Strategy
- **JavaScript packages**: Based on `files` field in package.json
- **Python packages**: Includes wheel files from `dist/` directory
- **Always included**: `package.json`, TypeScript config files
- **Automatically excluded**: `node_modules/`, `.git/`, `dist/` (for JS), temporary files

### Error Handling Patterns
- Comprehensive validation with clear error messages
- Early exit on validation failures with specific error codes
- Cleanup of temporary files even on failure
- Network timeout handling for API calls

### Key Dependencies
- **commander**: CLI framework for command parsing
- **adm-zip**: Archive creation and compression
- **minimatch**: File pattern matching for inclusion/exclusion
- **smol-toml**: TOML parsing for Python pyproject.toml files