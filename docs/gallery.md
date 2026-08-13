# Gallery workflow

The Gallery is one page backed by `src/data/gallery.json`. The same local
manager and processing pipeline run on macOS and Windows:

```sh
npm run gallery
```

The manager creates a maximum-2560 px display WebP and a 720 px thumbnail,
extracts a safe EXIF subset, detects duplicates by the original file's SHA-256
hash, uploads derivatives to R2, and updates the shared manifest.

Original photographs remain local. They are never uploaded to R2.

## macOS: import from Apple Photos

1. In Photos, create an album named `Website Gallery` and add photographs to it.
2. Open **System Settings → Privacy & Security → Full Disk Access**.
3. Enable the application that actually runs the command: **Visual Studio
   Code** when using its integrated terminal, or **Terminal/iTerm** when using
   that application. Fully quit and reopen it afterward.
4. Run `npm run gallery` and leave **Apple Photos album** selected.
5. Choose whether display images receive the site mark, then start the sync.

`osxphotos` is installed in `~/.local/bin`. It incrementally exports unmodified
originals to `.gallery-cache/source`. After a derivative has uploaded
successfully, the manager deletes only that temporary export and its sidecar.
It never modifies or deletes anything inside Photos.

The manager can also import an ordinary folder on macOS by selecting **Folder**.

## Windows: import a folder directly

1. Pull the latest website repository and run `npm ci` if dependencies are not
   present on that computer.
2. Make sure the local `gallery-r2-config.json` created on the Mac has finished
   syncing through OneDrive. PicGo is not required on Windows.
3. Run `npm run gallery`.
4. Select **Folder**, click **Choose…**, and select the folder containing the
   original photographs.
5. Choose the watermark setting and start the sync.

The folder is scanned recursively. Successfully processed files, duplicates,
and failed files all remain untouched in their original locations. Quoted paths
copied from Windows Explorer are accepted in the path field as well.

## R2 configuration

The manager automatically reads the existing PicGo S3/R2 configuration from:

- macOS: `~/Library/Application Support/picgo/data.json`
- Windows: `%APPDATA%\picgo\data.json`
- PicGo CLI fallback: `~/.picgo/config.json`

It can also read `gallery-r2-config.json`. This ignored local file is useful
when the project itself is synchronized privately between the Mac and Windows
through OneDrive. It contains credentials in plain text: keep the project
private, never commit the file, and remove it before sharing the project folder.

Alternatively, the following local environment variables can be supplied:

```text
GALLERY_R2_ENDPOINT
GALLERY_R2_BUCKET
GALLERY_R2_ACCESS_KEY_ID
GALLERY_R2_SECRET_ACCESS_KEY
GALLERY_R2_FORCE_PATH_STYLE=true   # optional
GALLERY_PUBLIC_ORIGIN=https://img.mockingbird.team   # optional
```

Credentials are never copied into the repository or exposed to the public
Gallery page.

## Titles, places, and descriptions

The import creates editable metadata fields in `src/data/gallery.json`:

```json
{
  "title": { "zh": "", "en": "Optional English title" },
  "caption": { "zh": "", "en": "Longer lightbox description" },
  "location": { "zh": "", "en": "Yangpu District, Shanghai" }
}
```

The archive view uses the optional English title, English county/district or
municipality-level place, exact date, and camera model. The longer caption and
complete technical EXIF remain available in the lightbox. If `title` is absent,
older entries may use `caption` as the title for compatibility.

## Publishing safely from two computers

Before importing, pull the latest `main` branch so the manager sees every photo
already present in `src/data/gallery.json`. After checking `/gallery` locally,
commit and push that manifest. If both computers import at once, reconcile the
manifest before either side pushes.

`.gallery-cache/` is local and ignored by Git. On macOS it includes the
`osxphotos` incremental-export database; do not delete that database unless the
Photos album should be treated as a fresh export.
