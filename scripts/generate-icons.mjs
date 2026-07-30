import sharp from 'sharp'

// Motif « Ondes » P3 — graphite & perle, deux couleurs pleines
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#2b2b2b"/>
  <g fill="none" stroke="#d6d3cd" stroke-width="24">
    <circle cx="256" cy="256" r="72"/>
    <circle cx="256" cy="256" r="152"/>
  </g>
  <circle cx="256" cy="256" r="32" fill="#d6d3cd"/>
</svg>`)

await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(svg).resize(180, 180).png().toFile('src/app/apple-icon.png')
await sharp(svg).resize(64, 64).png().toFile('src/app/icon.png')
console.log('icons ok')
