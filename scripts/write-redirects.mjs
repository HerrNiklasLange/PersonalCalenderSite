import { mkdirSync, writeFileSync } from 'node:fs'

// SPA fallback for the deployed site.
//
// This is written at build time rather than kept in public/ on purpose:
// `netlify dev` reads _redirects out of the publish directory, and a `/*`
// rewrite there shadows Vite's dev server — every /src/*.tsx module request
// comes back as index.html and the app fails to boot. Emitting it straight
// into dist/ keeps it out of every directory the dev server looks at.
mkdirSync('dist', { recursive: true })
writeFileSync('dist/_redirects', '/*  /index.html  200\n')
