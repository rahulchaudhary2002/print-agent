/**
 * Step 6 — a minimal, license-free placeholder icon (a filled rounded square with a printer
 * glyph) so every Linux package has *something* to show in a menu/dock rather than a broken
 * icon reference. SVG renders correctly for `.desktop` `Icon=` entries and AppImage AppDir
 * icons on every mainstream desktop environment; swap for real artwork in
 * `installer/assets/` when available (see `installer/assets/README.md`).
 */
export function generatePlaceholderIconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">
  <rect x="2" y="2" width="60" height="60" rx="10" fill="#2563eb"/>
  <rect x="14" y="16" width="36" height="20" rx="2" fill="#ffffff"/>
  <rect x="18" y="34" width="28" height="14" fill="#e5e7eb"/>
  <rect x="22" y="38" width="20" height="3" fill="#2563eb"/>
  <rect x="22" y="43" width="14" height="3" fill="#2563eb"/>
</svg>
`;
}
