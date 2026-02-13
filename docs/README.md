# FetchQuack Documentation

Documentation website for [FetchQuack](https://github.com/adrian-bueno/fetchquack), built with [Astro Starlight](https://starlight.astro.build/).

## 🚀 Commands

From the docs directory:

| Command | Action |
|---------|--------|
| `npm install` | Installs dependencies |
| `npm run dev` | Starts dev server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview build locally |

Or from the root directory:

| Command | Action |
|---------|--------|
| `npm run docs:dev` | Start docs dev server |
| `npm run docs:build` | Build docs for production |
| `npm run docs:preview` | Preview docs build |

## 📁 Structure

```
docs/
├── src/content/docs/
│   ├── getting-started/     # Getting started guides
│   ├── core/                # Core concepts  
│   ├── features/            # Feature guides
│   ├── integrations/        # Integration guides
│   └── api/                 # API reference
└── astro.config.mjs         # Configuration
```

## 🌐 Deployment

Configured for GitHub Pages at `https://adrian-bueno.github.io/fetchquack/`
