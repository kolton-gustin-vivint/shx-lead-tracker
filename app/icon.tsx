import { ImageResponse } from 'next/og';
import { brandFonts, brandIconElement } from '@/brandIcon';

// Browser tab icon — the SHX logo chip.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  return new ImageResponse(brandIconElement(size.width, { rounded: true }), { ...size, fonts: await brandFonts() });
}
