import sharp from 'sharp'

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#f97316"/>
  <circle cx="176" cy="336" r="44" fill="#fff"/>
  <path d="M132 212a168 168 0 0 1 168 168h-60a108 108 0 0 0-108-108z" fill="#fff"/>
  <path d="M132 108a272 272 0 0 1 272 272h-60a212 212 0 0 0-212-212z" fill="#fff"/>
</svg>`)

await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(svg).resize(180, 180).png().toFile('src/app/apple-icon.png')
console.log('icons ok')
