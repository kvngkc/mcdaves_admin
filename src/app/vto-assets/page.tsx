'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import AdminVTOCalibrationStudio, {
  StudioTransform,
  BridgeSource,
} from '@/vto-studio/AdminVTOCalibrationStudio';

// ── Types ─────────────────────────────────────────────────────────────────────

type Vec3 = { x: number; y: number; z: number };
type Variant = { id: string; name: string; sku?: string; product_id: string };
type Asset = {
  assetId: string;
  name: string;
  status: string;
  glbUrl: string | null;
  storagePath: string | null;
  physicalDimensions: any;
  bridge: Vec3;
  bridgeSource?: BridgeSource;   // may be absent on legacy assets
  isOffsetMode?: boolean;        // may be absent on legacy assets
  manualTransform: StudioTransform | null;
  sourceSizeBytes: number | null;
  updatedAt: string;
  attachable: boolean;
};

// ── Validation ────────────────────────────────────────────────────────────────

type DimKey = 'frameWidthMm' | 'lensWidthMm' | 'bridgeWidthMm' | 'templeLengthMm';

const DIM_RANGES: Record<DimKey, { min: number; max: number; label: string }> = {
  frameWidthMm:  { min: 100, max: 180, label: 'Frame width' },
  lensWidthMm:   { min: 30,  max: 65,  label: 'Lens width' },
  bridgeWidthMm: { min: 10,  max: 30,  label: 'Bridge width' },
  templeLengthMm:{ min: 120, max: 160, label: 'Temple length' },
};

function validateDimensions(dims: Record<DimKey, string>): Record<DimKey, string | null> {
  const errors = {} as Record<DimKey, string | null>;
  for (const key of Object.keys(DIM_RANGES) as DimKey[]) {
    const raw = dims[key].trim();
    if (raw === '') { errors[key] = null; continue; }           // blank = omit, allowed
    const n = Number(raw);
    if (isNaN(n)) { errors[key] = 'Must be a number'; continue; }
    if (n <= 0)   { errors[key] = 'Must be > 0'; continue; }
    const { min, max, label } = DIM_RANGES[key];
    if (n < min || n > max) {
      errors[key] = `${label} must be ${min}–${max} mm`;
      continue;
    }
    errors[key] = null;
  }
  return errors;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const initialTransform: StudioTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

const emptyDims: Record<DimKey, string> = {
  frameWidthMm: '',
  lensWidthMm: '',
  bridgeWidthMm: '',
  templeLengthMm: '',
};

/**
 * Infer bridgeSource from the asset record.
 * Legacy rule: if bridgeSource is absent and bridge is non-zero → 'manual'.
 *              if bridgeSource is absent and bridge is zero → 'auto'.
 */
function inferBridgeSource(a: Asset): BridgeSource {
  if (a.bridgeSource) return a.bridgeSource;
  return a.bridge.x !== 0 || a.bridge.y !== 0 || a.bridge.z !== 0 ? 'manual' : 'auto';
}

/**
 * Infer isOffsetMode from the asset record.
 * Legacy migration rule: absent isOffsetMode → false (render exactly as before).
 */
function inferIsOffsetMode(a: Asset): boolean {
  return a.isOffsetMode ?? false;
}

function NumberField({
  label,
  value,
  onChange,
  step = '0.001',
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  error?: string | null;
}) {
  return (
    <label className="block text-xs text-neutral-400">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`mt-1 w-full rounded-lg border bg-neutral-950 px-3 py-2 text-sm text-white ${
          error ? 'border-red-700' : 'border-neutral-800'
        }`}
      />
      {error && <span className="mt-0.5 block text-[10px] text-red-400">{error}</span>}
    </label>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VtoAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [variantId, setVariantId] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [transform, setTransform] = useState<StudioTransform>(initialTransform);
  const [isOffsetMode, setIsOffsetMode] = useState(false);
  const [bridgeSource, setBridgeSource] = useState<BridgeSource>('auto');
  const [dimensions, setDimensions] = useState<Record<DimKey, string>>(emptyDims);
  const [dimErrors, setDimErrors] = useState<Record<DimKey, string | null>>({
    frameWidthMm: null, lensWidthMm: null, bridgeWidthMm: null, templeLengthMm: null,
  });

  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const r = await apiFetch('/api/vto-assets');
    const b = await r.json();
    if (r.ok) setAssets(b.assets || []);
    else setError(b.error || 'Failed to load VTO assets');
  }, []);

  useEffect(() => {
    load();
    (async () => {
      const r = await apiFetch('/api/vto-assets/variants');
      const b = await r.json();
      if (r.ok) setVariants(b.variants || []);
    })();
  }, [load]);

  const choose = (a: Asset) => {
    setSelected(a);
    setTransform(a.manualTransform || initialTransform);
    setIsOffsetMode(inferIsOffsetMode(a));
    setBridgeSource(inferBridgeSource(a));
    setDimensions({
      frameWidthMm: a.physicalDimensions?.frameWidthMm?.toString() || '',
      lensWidthMm: a.physicalDimensions?.lensWidthMm?.toString() || '',
      bridgeWidthMm: a.physicalDimensions?.bridgeWidthMm?.toString() || '',
      templeLengthMm: a.physicalDimensions?.templeLengthMm?.toString() || '',
    });
    setDimErrors({ frameWidthMm: null, lensWidthMm: null, bridgeWidthMm: null, templeLengthMm: null });
    setMessage('');
    setError('');
  };

  // ── Dimension change with live validation ────────────────────────────────────

  const handleDimChange = (key: DimKey, v: number) => {
    const raw = v === 0 ? '' : String(v);
    const next = { ...dimensions, [key]: raw };
    setDimensions(next);
    setDimErrors(validateDimensions(next));
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const upload = async () => {
    if (!file || !variantId) return setError('Select a GLB and product variant.');
    setWorking(true); setError(''); setMessage('Preparing secure upload…');
    try {
      const r = await apiFetch('/api/vto-assets/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'prepare', variantId, filename: file.name, sizeBytes: file.size }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Upload preparation failed');
      const put = await fetch(b.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'model/gltf-binary' },
        body: file,
      });
      if (!put.ok) throw new Error('GLB upload failed');
      setMessage('Verifying GLB in Storage…');
      const vr = await apiFetch('/api/vto-assets/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', assetId: b.assetId, variantId, filename: file.name, sizeBytes: file.size, path: b.path }),
      });
      const vb = await vr.json();
      if (!vr.ok) throw new Error(vb.error || 'GLB verification failed');
      setFile(null);
      await load();
      const ar = await apiFetch(`/api/vto-assets?assetId=${encodeURIComponent(vb.assetId)}`);
      const ab = await ar.json();
      if (ar.ok && ab.assets?.[0]) choose(ab.assets[0]);
      setVariantId('');
      setMessage('GLB verified and registered. Calibrate it before approval.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setWorking(false);
    }
  };

  // ── Save calibration ────────────────────────────────────────────────────────

  const saveCalibration = async () => {
    if (!selected) return;

    // Validate dimensions before saving.
    const errors = validateDimensions(dimensions);
    setDimErrors(errors);
    if (Object.values(errors).some((e) => e !== null)) {
      setError('Fix dimension validation errors before saving.');
      return;
    }

    setWorking(true); setError(''); setMessage('Saving calibration…');
    try {
      const physicalDimensions = Object.fromEntries(
        Object.entries(dimensions).map(([k, v]) => [k, v === '' || Number(v) === 0 ? null : Number(v)]),
      );
      const r = await apiFetch('/api/vto-assets/calibrate', {
        method: 'POST',
        body: JSON.stringify({
          assetId: selected.assetId,
          manualTransform: transform,
          bridge: selected.bridge,
          bridgeSource,
          isOffsetMode,
          physicalDimensions,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Calibration save failed');
      await load();
      const ar = await apiFetch(`/api/vto-assets?assetId=${encodeURIComponent(selected.assetId)}`);
      const ab = await ar.json();
      if (ar.ok && ab.assets?.[0]) choose(ab.assets[0]);
      setMessage('Calibration saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calibration save failed');
    } finally {
      setWorking(false);
    }
  };

  // ── Lifecycle transitions ───────────────────────────────────────────────────

  const transition = async (status: 'APPROVED' | 'PUBLISHED') => {
    if (!selected) return;
    setWorking(true); setError(''); setMessage(`Changing status to ${status}…`);
    try {
      const r = await apiFetch('/api/vto-assets', {
        method: 'PATCH',
        body: JSON.stringify({ assetId: selected.assetId, status }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Lifecycle transition failed');
      await load();
      const ar = await apiFetch(`/api/vto-assets?assetId=${encodeURIComponent(selected.assetId)}`);
      const ab = await ar.json();
      if (ar.ok && ab.assets?.[0]) choose(ab.assets[0]);
      setMessage(`Asset is now ${status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lifecycle transition failed');
    } finally {
      setWorking(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasDimErrors = Object.values(dimErrors).some((e) => e !== null);

  return (
    <main className="min-h-screen bg-neutral-950 p-5 text-neutral-200 sm:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black text-white">VTO Asset Manager</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-500">
          Single authority for GLB upload, live calibration, approval, publication and variant linkage.
        </p>
      </header>

      {(error || message) && (
        <div className={`rounded-xl border p-4 text-sm ${
          error ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-emerald-900 bg-emerald-950/30 text-emerald-200'
        }`}>
          {error || message}
        </div>
      )}

      {/* Upload */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-5">
        <h2 className="font-bold text-white">1. Upload production GLB</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-neutral-400">
            Product variant
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-white"
            >
              <option value="">Select variant</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.sku ? ` · ${v.sku}` : ''}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            GLB file
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-300"
            />
          </label>
        </div>
        <button
          disabled={working || !file || !variantId}
          onClick={upload}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {working ? 'Working…' : 'Upload GLB'}
        </button>
      </section>

      {/* Asset list */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">2. Assets</h2>
          <button onClick={load} className="text-xs text-brand-400">Refresh</button>
        </div>
        <div className="grid gap-3">
          {assets.map((a) => (
            <button
              key={a.assetId}
              onClick={() => choose(a)}
              className={`rounded-xl border p-4 text-left ${
                selected?.assetId === a.assetId
                  ? 'border-brand-500 bg-brand-950/20'
                  : 'border-neutral-800 bg-neutral-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{a.name}</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  {a.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {a.assetId} · {a.sourceSizeBytes
                  ? `${(a.sourceSizeBytes / 1024 / 1024).toFixed(2)} MB`
                  : 'size pending'}
              </div>
            </button>
          ))}
          {!assets.length && (
            <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
              No VTO assets yet.
            </div>
          )}
        </div>
      </section>

      {/* Calibration + metadata */}
      {selected && (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <div className="space-y-5">
            {/* Calibration studio */}
            <AdminVTOCalibrationStudio
              glbUrl={selected.glbUrl || ''}
              bridge={selected.bridge}
              bridgeSource={bridgeSource}
              isOffsetMode={isOffsetMode}
              transform={transform}
              onChange={setTransform}
              onIsOffsetModeChange={setIsOffsetMode}
            />

            {/* Physical metadata */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">4. Physical metadata</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Optional optical measurements stored as metadata. Not used for auto-scaling.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <NumberField
                  label="Frame width mm"
                  step="0.1"
                  value={Number(dimensions.frameWidthMm) || 0}
                  onChange={(v) => handleDimChange('frameWidthMm', v)}
                  error={dimErrors.frameWidthMm}
                />
                <NumberField
                  label="Lens width mm"
                  step="0.1"
                  value={Number(dimensions.lensWidthMm) || 0}
                  onChange={(v) => handleDimChange('lensWidthMm', v)}
                  error={dimErrors.lensWidthMm}
                />
                <NumberField
                  label="Bridge width mm"
                  step="0.1"
                  value={Number(dimensions.bridgeWidthMm) || 0}
                  onChange={(v) => handleDimChange('bridgeWidthMm', v)}
                  error={dimErrors.bridgeWidthMm}
                />
                <NumberField
                  label="Temple length mm"
                  step="0.1"
                  value={Number(dimensions.templeLengthMm) || 0}
                  onChange={(v) => handleDimChange('templeLengthMm', v)}
                  error={dimErrors.templeLengthMm}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={working || hasDimErrors}
                  onClick={saveCalibration}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Save calibration
                </button>
                {selected.status === 'CALIBRATED' && (
                  <button
                    disabled={working}
                    onClick={() => transition('APPROVED')}
                    className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Approve
                  </button>
                )}
                {selected.status === 'APPROVED' && (
                  <button
                    disabled={working}
                    onClick={() => transition('PUBLISHED')}
                    className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Publish
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Asset contract sidebar */}
          <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 h-fit space-y-4">
            <h2 className="font-bold text-white">Asset contract</h2>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-neutral-500">Status</dt>
                <dd className="font-bold text-white">{selected.status}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Production GLB</dt>
                <dd className="break-all text-neutral-300">{selected.storagePath || 'not available'}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Mode</dt>
                <dd className="font-mono text-white">{isOffsetMode ? 'Auto-Fit' : 'Legacy'}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Bridge source</dt>
                <dd className="font-mono text-white">{bridgeSource}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Scale</dt>
                <dd className="font-mono text-white">{transform.scale}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Position</dt>
                <dd className="font-mono text-white">{JSON.stringify(transform.position)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Rotation</dt>
                <dd className="font-mono text-white">{JSON.stringify(transform.rotation)}</dd>
              </div>
            </dl>
            <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-emerald-200">
              Live camera + MediaPipe preview is active. Adjust the transform against your face,
              save, then approve and publish.
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
