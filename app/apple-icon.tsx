import { ImageResponse } from 'next/og';
import { brandFonts, brandIconElement } from '@/brandIcon';

// iOS home-screen icon. Square corners: iOS applies its own rounded mask.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  return new ImageResponse(brandIconElement(size.width, { rounded: false }), { ...size, fonts: await brandFonts() });
}
