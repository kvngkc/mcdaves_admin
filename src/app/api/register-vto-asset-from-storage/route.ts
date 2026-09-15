import { NextRequest, NextResponse } from 'next/server';
import { requireManagerOrHigher } from '@/lib/auth/admin-auth';
import { registerStoredVtoAsset } from '@/lib/vto/register-stored-asset';
import { ClientAssetCalibrationEvidence } from '@/lib/vto/vto-validation-core';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireManagerOrHigher(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    if (!body.storagePath || !body.evidence) return NextResponse.json({ error: 'storagePath and evidence are required' }, { status: 400 });
    const result = await registerStoredVtoAsset({
      storagePath: body.storagePath,
      evidence: body.evidence as ClientAssetCalibrationEvidence,
      clientValidationStatus: body.clientValidationStatus || null,
      tmpGlbUrl: body.tmpGlbUrl || null,
    });
    return NextResponse.json(result, { status: result.success ? 201 : 422 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to register VTO asset' }, { status: 500 });
  }
}
