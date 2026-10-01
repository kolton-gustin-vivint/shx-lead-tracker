/**
 * The SHX logo chip as an image: brand green (the Lead Tracker's --primary,
 * hsl(145 50% 38%)) with white "SHX" in Inter Bold. Used by app/icon.tsx
 * (browser tab) and app/apple-icon.tsx (iOS home screen).
 *
 * next/og only ships a regular-weight font, so the bold comes from
 * src/assets/inter-bold-shx.woff: Inter Bold (SIL Open Font License) subset by
 * Google Fonts to just the glyphs S, H and X — under 2 KB.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const BRAND_GREEN = '#309159';

export async function brandFonts() {
  const data = await readFile(join(process.cwd(), 'src/assets/inter-bold-shx.woff'));
  return [{ name: 'Inter', data, weight: 700 as const, style: 'normal' as const }];
}

export function brandIconElement(px: number, { rounded }: { rounded: boolean }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND_GREEN,
        borderRadius: rounded ? Math.round(px * 0.22) : 0,
        color: '#ffffff',
        fontFamily: 'Inter',
        fontSize: Math.round(px * 0.4),
        fontWeight: 700,
        letterSpacing: -px * 0.02,
      }}
    >
      SHX
    </div>
  );
}
