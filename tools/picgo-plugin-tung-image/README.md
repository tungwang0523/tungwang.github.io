# PicGo Tung Image Plugin

This local PicGo plugin processes every image before the configured uploader receives it:

```text
resize to a maximum edge -> convert to WebP -> apply watermark -> upload
```

It passes the processed image to the S3/R2 uploader as binary data, avoiding
the incorrect `Content-Encoding: base64` metadata produced by PicGo's Base64 path.

## Defaults

- Maximum edge: `2560px`
- WebP: lossy, quality `88`
- Watermark: `public/pictures/watermark.png`
- Watermark width: `6%` of the processed image width (maximum `10%`)
- Transparency: `0%` (fully opaque)
- Right and bottom margin: at least `64px`

## Installation

Install the plugin dependency once:

```bash
cd "/Users/tungwang/Websites/Tung Wang/tools/picgo-plugin-tung-image"
npm install
```

In PicGo, open `Plugins Settings`, choose the local-plugin installation option, and select this folder:

```text
tools/picgo-plugin-tung-image
```

Then open the plugin settings, confirm the watermark path, and keep this plugin enabled. Do not also enable `picgo-plugin-compress` or `picgo-plugin-watermark`; this plugin replaces both.
