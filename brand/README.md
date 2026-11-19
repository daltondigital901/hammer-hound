# Hammer Hound brand assets

Hammer Hound is a trade name (DBA) of Dalton Enterprises LLC.
Tagline: **Real Jobs. Local Pros. Tracked Down.**

## Files

| Folder | File | Use |
| --- | --- | --- |
| badge | `badge.png` | Mascot badge, transparent background. Use on white, grey, yellow, orange |
| badge | `badge-on-dark.png` | Same badge with a white outline. Use on black |
| badge | `badge-square-256.png`, `-512`, `-1024` | Badge centred on a transparent square, for profile pictures |
| wordmark | `wordmark-black.svg`, `wordmark-white.svg` | Vector "hammer hound". Black on light, white on dark |
| wordmark | `wordmark-black.png`, `wordmark-white.png` | Same, 1408 x 198 px |
| lockup | `lockup-horizontal-light.png`, `-dark.png` | Badge, wordmark and tagline side by side |
| lockup | `lockup-stacked-light.png`, `-dark.png` | Badge above wordmark and tagline |
| lockup | `header-logo-light@2x.png`, `-dark@2x.png` | Site header logo (badge and wordmark, no tagline), shown at 48 px tall |
| favicon | `favicon.ico`, `favicon-16x16.png`, `-32x32`, `-48x48` | Browser tab icon. Close-up of the hound's head so it reads at small sizes |
| favicon | `apple-touch-icon.png` | iPhone home screen icon, 180 px, yellow background |
| favicon | `android-chrome-192x192.png`, `-512x512.png`, `maskable-512x512.png` | Android icons |
| favicon | `site.webmanifest` | Web app manifest |
| social | `og-image-1200x630.png` | Default share image for every page |

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| Asphalt | `#1D2125` | Text, dark headers |
| Orange | `#F15A22` | Tagline on black, accents |
| Orange text | `#B5390B` | Tagline and small orange text on white |
| Yellow | `#FFC20E` | Buttons, app icon background |
| White | `#FFFFFF` | Page background |
| Concrete | `#F0F1F2` | Section background |

## Tagline type

Archivo Bold, all capitals, letter spacing 0.08em. `#F15A22` on black, `#B5390B` on white, `#1D2125` on yellow.

## HTML head

Copy the contents of `favicon/` to the site root, and `social/og-image-1200x630.png` to `/og-image-1200x630.png`.

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1D2125">
<meta property="og:site_name" content="Hammer Hound">
<meta property="og:image" content="https://hammerhound.com/og-image-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Hammer Hound","legalName":"Dalton Enterprises LLC","url":"https://hammerhound.com","logo":"https://hammerhound.com/android-chrome-512x512.png","slogan":"Real Jobs. Local Pros. Tracked Down."}
</script>
```

## Footer

`© {current year} Dalton Enterprises LLC, DBA Hammer Hound. All rights reserved.` The year comes from the current date, never typed in.

## Source

The badge is cut from the supplied logo image (2720 x 1536 px), so `badge.png` tops out at 800 x 966 px. For print larger than about 3 inches tall, a higher-resolution original is needed.
