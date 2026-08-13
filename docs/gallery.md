# Gallery workflow

The Gallery is a single page backed by `src/data/gallery.json`. Public image
derivatives live in the existing `tungwang-images` R2 bucket; originals remain
in Apple Photos.

## One-time macOS setup

1. In Photos, create an album named `Website Gallery`.
2. Open **System Settings → Privacy & Security → Full Disk Access**.
3. Enable the terminal application used to run the website, then restart that
   terminal.

`osxphotos` is installed in `~/.local/bin` through `uv`. The Gallery manager
uses that absolute path, so no shell PATH change is required.

## Daily use

1. Add photographs to the `Website Gallery` album in Photos.
2. In the website directory, run `npm run gallery`.
3. In the local manager, choose whether display images receive the site mark.
4. Click **Sync, Process & Upload**.
5. Run `npm run dev` to inspect `/gallery`.
6. Commit and push `src/data/gallery.json` when the selection is ready.

The manager exports only unmodified originals that it has not processed
before. It creates a 720 px thumbnail and a maximum-2560 px display WebP,
uploads both to R2, extracts a safe subset of EXIF into the manifest, and then
deletes only its temporary exported copy. It never modifies or deletes assets
inside Photos.

## Local state

`.gallery-cache/` contains the `osxphotos` incremental-export database and
temporary source files. It is ignored by Git. Do not delete its export database
unless the Photos selection needs to be treated as entirely new.

The manager reads the existing PicGo S3/R2 configuration locally from:

`~/Library/Application Support/picgo/data.json`

Credentials are never copied into the repository or exposed to the public
Gallery page.
