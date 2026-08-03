# PicGo Tung Image Plugin

This local PicGo plugin processes every image before the configured uploader receives it:

```text
resize to a maximum edge -> convert to WebP -> apply watermark -> upload
```

## Defaults

- Maximum edge: `4096px`
- WebP: lossless, quality `100`
- Watermark: `public/pictures/watermark.png`
- Watermark width: `6%` of the processed image width (maximum `10%`)
- Transparency: `0%` (fully opaque)
- Right and bottom margin: at least `64px`

## Installation

Install the plugin dependency once:

```bash
cd "/Users/tungwang/Library/CloudStorage/OneDrive-Personal/Library/Websites/Tung Wang/tools/picgo-plugin-tung-image"
npm install
```

In PicGo, open `Plugins Settings`, choose the local-plugin installation option, and select this folder:

```text
tools/picgo-plugin-tung-image
```

Then open the plugin settings, confirm the watermark path, and keep this plugin enabled. Do not also enable `picgo-plugin-compress` or `picgo-plugin-watermark`; this plugin replaces both.
