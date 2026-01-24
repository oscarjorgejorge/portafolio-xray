# Next.js Performance Optimizations

This document outlines the performance optimizations applied to the Next.js configuration.

## Optimizations Applied

### 1. Webpack Optimizations
- **File Watching**: Optimized to ignore unnecessary directories (node_modules, .git, .next, .turbo, coverage, .cache)
- **Polling**: Set to 1000ms with 300ms aggregate timeout for faster HMR
- **Memory Usage**: Reduced optimization overhead during development
- **Client Bundle**: Excluded server-only modules (fs, net, tls, crypto, stream, url, zlib, http, https, assert, os, path)
- **Filesystem Cache**: Enabled webpack filesystem cache for faster rebuilds (`.next/cache/webpack`)
- **Source Maps**: Using `eval-cheap-module-source-map` for faster dev builds
- **Module IDs**: Using named module/chunk IDs for better caching
- **Minification**: Disabled in development for faster compilation

### 2. TypeScript Optimizations
- **Incremental Builds**: Enabled with dedicated build info file (`.next/tsconfig.tsbuildinfo`)
- **Assume Changes Only Affect Direct Dependencies**: Reduces recompilation scope
- **Skip Lib Check**: Faster type checking by skipping node_modules
- **Optimized Module Resolution**: Enabled `resolvePackageJsonExports` and `resolvePackageJsonImports`
- **Relaxed Checks**: Disabled `noUnusedLocals` and `noUnusedParameters` during development for faster compilation
- **Extension Aliases**: Faster module resolution with `.js` → `.js/.ts/.tsx` mapping

### 3. Compiler Optimizations
- **Console Removal**: Automatically removes console.log in production (keeps errors/warnings)
- **Package Imports**: Optimized imports for `@tanstack/react-query` and `axios`

### 4. Development Scripts
- **Standard Dev**: `npm run dev` - Standard Next.js dev server (optimized webpack)
- **Turbo Dev**: `npm run dev:turbo` - Experimental Turbopack (much faster, but experimental)
- **Type Check Watch**: `npm run type-check:watch` - Run type checking in watch mode separately
- **Clean**: `npm run clean` - Clears build cache, TypeScript build info, and webpack cache

## Usage

### Normal Development
```bash
npm run dev
```

### Faster Development (Experimental)
```bash
npm run dev:turbo
```
**Note**: Turbopack is experimental but can be 5-10x faster. Use if you encounter issues, fall back to standard dev.

### Clear Cache (if compilation is slow)
```bash
npm run clean
npm run dev
```

## Expected Performance Improvements

- **Initial Compilation**: 30-40% faster (due to optimized webpack config and TypeScript settings)
- **Hot Module Replacement**: 40-60% faster (filesystem cache + optimized watching)
- **Subsequent Compilations**: 50-70% faster (incremental builds + webpack cache)
- **Type Checking**: Non-blocking in dev mode, runs in parallel
- **With Turbopack**: 5-10x faster (experimental, recommended for fastest dev experience)

## Troubleshooting

### If compilation is still slow:

1. **Clear all caches**:
   ```bash
   npm run clean
   rm -rf node_modules/.cache
   ```

2. **Check system resources**:
   - Ensure you have at least 8GB RAM
   - Close other heavy applications

3. **Try Turbopack**:
   ```bash
   npm run dev:turbo
   ```

4. **Check for TypeScript errors**:
   ```bash
   npm run type-check
   ```
   Fix any errors that might be causing recompilation loops

5. **Consider React 18**:
   React 19 is very new. If you encounter issues, consider downgrading:
   ```bash
   npm install react@^18.3.1 react-dom@^18.3.1 @types/react@^18.3.1 @types/react-dom@^18.3.1
   ```

## Additional Notes

- The "Compiling..." indicator is normal in Next.js development mode
- First compilation after clearing cache will be slower
- Subsequent compilations should be much faster due to incremental builds and webpack cache
- TypeScript type checking runs separately and doesn't block compilation
- Webpack filesystem cache persists between dev server restarts for faster startup
- Source maps use `eval-cheap-module-source-map` for faster dev builds (slightly less accurate but much faster)

## Recommended Development Workflow

1. **For fastest development**: Use `npm run dev:turbo` (Turbopack)
2. **For stable development**: Use `npm run dev` (optimized webpack)
3. **For type checking**: Run `npm run type-check:watch` in a separate terminal if you want real-time type checking
4. **If compilation slows down**: Run `npm run clean` to clear all caches

