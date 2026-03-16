import { NextResponse } from 'next/server';

import { generateBannerGifBuffer, normalizeBottomLineOffsetX } from '@/lib/banner-gif';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bottomLineOffsetX = normalizeBottomLineOffsetX(searchParams.get('bottomLineOffsetX'));
    const gifBuffer = await generateBannerGifBuffer({ bottomLineOffsetX });

    return new Response(gifBuffer, {
      status: 200,
      headers: {
        'content-type': 'image/gif',
        'content-disposition': `attachment; filename="memoo-banner-${bottomLineOffsetX}.gif"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'No se pudo exportar el GIF.';
    return NextResponse.json({ detail }, { status: 500 });
  }
}
