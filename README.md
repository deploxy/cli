# Deploxy CLI

A tool for deploying STDIO-based MCP (Model Context Protocol) servers to a hosted environment while publishing proxy packages to npm.

## Overview

When you create a STDIO-based MCP server as an npm package, your source code becomes publicly visible. This tool solves that problem by:

- **Hosting your MCP server privately** on a secure server infrastructure
- **Publishing a proxy package** to npm that calls your hosted server
- **Keeping your source code private** while maintaining npm package compatibility

## How It Works

1. **Upload**: Your MCP server source code is uploaded to a private hosting service
2. **Build & Deploy**: The server builds and deploys your MCP server in a secure environment
3. **Proxy Generation**: A proxy npm package is automatically generated and published
4. **Client Connection**: Users install your npm package, which proxies requests to your hosted server

## Features

- 🔒 **Private Source Code**: Keep your MCP server implementation private
- 📦 **NPM Compatibility**: Publish as a standard npm package
- 🚀 **Automatic Deployment**: Seamless build and deployment process
- ✅ **NPM Validation**: Validates package permissions and version compatibility
- 📋 **Smart File Detection**: Automatically detects necessary files for deployment
- 🧹 **Clean Process**: Handles temporary files and cleanup automatically

## Setup

### 1. Init Project

Run init command in your project root.

```bash
npx @deploxy/cli init
```

### 2. Copy Deploy Environment Configuration

Go to [Deploxy new project](https://www.deploxy.com/dashboard/new), generate environment values.

Then copy values in your project root `.deploxy.json` file.

### 3. Configure NPM Authentication

Create a `.npmrc` file in your project root:

```npmrc
//registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN_HERE
```

### 4. Project Requirements

Your project must have:

- A valid `package.json` with a `bin` field (required for MCP servers)
- A `tsconfig.json` or `tsconfig.build.json` file
- Source code in directories specified by your TypeScript configuration

## Publish NPM package

After Setup done, you can run deploy command to publish your NPM package.

```bash
npx @deploxy/cli deploy
```

## Process Flow

1. **🔍 Environment Validation**: Reads authentication tokens from `.deploxy.json`
2. **📦 Package Analysis**: Parses `package.json` and TypeScript configuration
3. **✅ NPM Validation**:
   - Checks if package exists on npm registry
   - Validates version is higher than existing versions
   - Verifies publish permissions
4. **📋 File Collection**: Automatically detects files needed for deployment
5. **📦 Compression**: Creates a zip archive of necessary files
6. **📤 Upload**: Securely uploads to the hosting service
7. **🧹 Cleanup**: Removes temporary files

## File Inclusion

The tool automatically includes:

### Always Included

- `package.json`
- `tsconfig.json` or `tsconfig.build.json`

### Source Code (from TypeScript config)

- Files matching `include` patterns (default: `src/**/*`)
- Excludes files matching `exclude` patterns

### Additional Files (if present)

- `README.md`, `LICENSE`, `CHANGELOG.md`
- `.npmignore`, `.gitignore`
- Build configuration files:
  - `jest.config.js/ts`, `webpack.config.js`, `rollup.config.js`
  - `vite.config.js/ts`, `babel.config.js/json`, `.babelrc`
  - `eslint.config.js`, `.eslintrc.js/json`
  - `prettier.config.js`, `.prettierrc`

### Excluded Files

- `dist/**/*` (build artifacts)
- `node_modules/**/*` (dependencies)
- `.git/**/*` (git history)
- Other temporary files and build outputs

## Example MCP Server Package Structure

```
my-mcp-server/
├── package.json          # Must include "bin" field
├── tsconfig.json
├── .deploxy.json         # Deploy configs
├── .npmrc                # NPM authentication
├── src/
│   ├── index.ts          # Your MCP server entry point
│   └── lib/
│       └── example.ts    # Your MCP server biz logic
└── README.md
```

## package.json Requirements

Your `package.json` must include a `bin` field for MCP servers:

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "bin": {
    "my-mcp-server": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist/**/*"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

## Error Handling

The tool provides comprehensive error messages for common issues:

- Missing authentication tokens or wrong configs in `.deploxy.json`
- Invalid package.json or TypeScript configuration
- NPM permission issues
- Version conflicts
- Network connectivity problems
