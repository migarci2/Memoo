import { NextResponse } from 'next/server';

import { API_BASE_URL_SERVER } from '@/lib/config';

export async function POST(
  _req: Request,
  context: { params?: { captureId?: string } | Promise<{ captureId?: string }> },
) {
  try {
    const resolvedParams = await Promise.resolve(context?.params);
    const captureId = resolvedParams?.captureId;
    if (!captureId) {
      return NextResponse.json({ detail: 'Missing capture id' }, { status: 400 });
    }

    const upstreamUrl = `${API_BASE_URL_SERVER}/captures/${captureId}/compile`;
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') ?? 'application/json';

    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': contentType },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream compile request failed';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
