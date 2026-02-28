# ============================================================
# CDN / Edge Cache Headers
# Works on: Cloudflare Pages, Alibaba Cloud ESA Pages, Netlify
# ============================================================

# Service Worker: NEVER cache at CDN edge
# Browser must always get the latest version for update checks to work
/service-worker.js
  Cache-Control: no-cache, no-store, must-revalidate
  Content-Type: application/javascript; charset=utf-8

# index.html: Always revalidate (SPA entry point)
# CDN can use 304 Not Modified, but must check origin every time
/index.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache

# manifest.json: Short cache, revalidate regularly
/manifest.json
  Cache-Control: no-cache

# Recovery pages: Never cache (must always be fresh)
/clear-cache.html
  Cache-Control: no-cache, no-store

# Hashed assets from Vite build: immutable, cache forever
# Vite adds content hash to filenames, so old files are never requested again
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# ONNX models: Long cache (large files, rarely change)
/models/*
  Cache-Control: public, max-age=604800

# Security headers (all pages)
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
