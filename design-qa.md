# Design QA

final result: passed

## Checks

- Production build completed with `npm run build`.
- Menu data checked from `public/menu.csv`: 110 rows loaded.
- Product image mappings checked from `public/product-images.json`: 0 missing mapping, 0 missing file.
- `À partager` keeps the validated first-page structure with 4 dishes and catalog photos.
- Other categories use the selected premium list layout; `Plats` was visually checked at mobile viewport with 7 rows and the 3D table icon loaded from `/table-icon-3d.png`.
- Render/live site comparison showed the botanical decoration was missing from the previous build.
- Botanical decoration is now included as a real transparent image asset: `public/botanical-corner.png` and copied into `dist/botanical-corner.png`.

## Notes

- `node_modules` is intentionally excluded from the final zip.
- The built `dist/` folder is included.
