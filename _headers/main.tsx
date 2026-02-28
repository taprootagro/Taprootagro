# Cloudflare Pages / Netlify custom headers
# This file should be copied to dist/ during build

/service-worker.js
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.json
  Cache-Control: no-cache, must-revalidate
  Content-Type: application/manifest+json

/taprootagro/global/*
  Cache-Control: no-cache, no-store, must-revalidate
  Access-Control-Allow-Origin: *

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/models/*
  Cache-Control: public, max-age=604800

/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
