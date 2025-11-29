# 📦 MyKeys MCP Server Installation Guide

## Installation Options

### Option 1: Clone Repository (Recommended for Development)

```bash
# Clone the repository
git clone https://github.com/your-org/mykeys.git
cd mykeys

# Install dependencies
npm install

# The MCP server is at: ./mcp-server.ts
```

**Path to use in config:** `/path/to/mykeys/mcp-server.ts` (or `E:\path\to\mykeys\mcp-server.ts` on Windows)

### Option 2: npm Global Install (Future)

```bash
npm install -g @mykeys/mcp-server
```

**Path to use in config:** `@mykeys/mcp-server` (npx will handle it)

### Option 3: Local npm Package

```bash
npm install @mykeys/mcp-server
```

**Path to use in config:** `node_modules/@mykeys/mcp-server/dist/index.js`

### Option 4: winget (Windows - Future)

```powershell
winget install MyKeys.MCP-Server
```

**Path to use in config:** Will be determined after winget installation

## Platform-Specific Path Examples

### Windows
```
E:\zip-myl-mykeys-api\mcp-server.ts
E:/zip-myl-mykeys-api/mcp-server.ts
C:\Users\YourName\mykeys\mcp-server.ts
```

### macOS / Linux
```
/usr/local/lib/mykeys/mcp-server.ts
~/mykeys/mcp-server.ts
/home/username/mykeys/mcp-server.ts
```

## Configuration

After installation, use the [MCP Config Generator](https://mykeys.zip/mcp-config-generator.html) to create your Cursor configuration.

The generator will automatically detect:
- TypeScript files (`.ts`) → uses `npx tsx`
- JavaScript files (`.js`) → uses `node`
- npm packages → uses `npx`

## Requirements

- Node.js 18+ installed
- `tsx` available (installed automatically with `npm install` or via `npx`)

## Troubleshooting

**"Cannot find module" error:**
- Verify the path is correct
- Use absolute paths (not relative)
- On Windows, use forward slashes or escaped backslashes: `E:\\path\\to\\file.ts`

**"tsx not found" error:**
- Run `npm install` in the mykeys directory
- Or use `npx tsx` which will download it automatically

**Path not working:**
- Try using forward slashes: `E:/path/to/file.ts`
- Or escaped backslashes: `E:\\path\\to\\file.ts`
- Verify the file exists at that location




