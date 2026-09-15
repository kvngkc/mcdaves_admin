'use client';

import { apiFetch } from '@/lib/api-client';
import { useCallback, useEffect, useState } from 'react';

interface VtoAsset {
  assetId: string;
  name: string;
  status: string;
  glbUrl: string | null;
  physicalWidthMm: number | null;
  lensWidthMm: number | null;
  bridgeWidthMm: number | null;
  measuredNativeWidth: number | null;
  widthMultiplier: number | null;
  bridge: { x: number | null; y: number | null; z: number | null };
  createdAt: string;
  updatedAt: string;
  attachable: boolean;
}

type CreationMode = 'upload' | 'parametric' | 'image';

export default function VtoAssetsPage() {
  const [assets, setAssets] = useState<VtoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<CreationMode>('upload');
  const [name, setName] = useState('');
  const [variantName, setVariantName] = useState('Custom');
  const [frameWidthMm, setFrameWidthMm] = useState('140');
  const [bridgeWidthMm, setBridgeWidthMm] = useState('18');
  const [lensWidthMm, setLensWidthMm] = useState('50');
  const [lensHeightMm, setLensHeightMm] = useState('40');
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState('round');
  const [materialType, setMaterialType] = useState('acetate');
  const [colorHex, setColorHex] = useState('#1A1A1A');

  const loadAssets = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await apiFetch('/api/vto-assets');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to load VTO assets');
      setAssets(body.assets || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load VTO assets'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const resetMessages = () => { setError(null); setSuccess(null); };

  const uploadAsset = async () => {
    if (!file) return setError('Select a .glb file first.');
    if (!file.name.toLowerCase().endsWith('.glb')) return setError('VTO assets must be .glb files.');
    if (!name.trim()) return setError('Asset name is required.');
    const width = Number(frameWidthMm);
    const bridge = bridgeWidthMm.trim() ? Number(bridgeWidthMm) : null;
    if (!Number.isFinite(width) || width <= 0) return setError('A valid physical frame width is required.');
    if (bridge !== null && (!Number.isFinite(bridge) || bridge <= 0)) return setError('Bridge width must be a positive number.');
    setWorking(true); resetMessages();
    try {
      const urlResponse = await apiFetch('/api/upload-model', { method: 'POST', body: JSON.stringify({ action: 'generate-url', filename: file.name }) });
      const uploadInfo = await urlResponse.json();
      if (!urlResponse.ok) throw new Error(uploadInfo.error || 'Failed to prepare upload');
      const uploadResponse = await fetch(uploadInfo.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'model/gltf-binary' }, body: file });
      if (!uploadResponse.ok) throw new Error('Direct GLB upload failed');
      const processResponse = await apiFetch('/api/upload-model', { method: 'POST', body: JSON.stringify({ action: 'process-model', rawPath: uploadInfo.path, filename: file.name, productName: name.trim(), frameWidthMm: width, bridgeWidthMm: bridge }) });
      const result = await processResponse.json();
      if (!processResponse.ok) throw new Error(result.error || 'VTO asset processing failed');
      setSuccess(`GLB uploaded and registered as ${result.status}. Native width: ${Number(result.measuredNativeWidth).toFixed(4)}, multiplier: ${Number(result.widthMultiplier).toFixed(4)}.`);
      setFile(null); setName('');
      const input = document.getElementById('vto-glb-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadAssets();
    } catch (err) { setError(err instanceof Error ? err.message : 'VTO asset upload failed'); }
    finally { setWorking(false); }
  };

  const generateParametric = async () => {
    if (!name.trim()) return setError('Asset name is required.');
    setWorking(true); resetMessages();
    try {
      const response = await apiFetch('/api/generate-model', { method: 'POST', body: JSON.stringify({ productName: name.trim(), variantName: variantName.trim() || 'Custom', style, materialType, colorHex, frameWidthMm: Number(frameWidthMm), lensWidthMm: Number(lensWidthMm), lensHeightMm: Number(lensHeightMm), bridgeWidthMm: Number(bridgeWidthMm) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Parametric GLB generation failed');
      setSuccess(`Parametric GLB generated and registered as ${body.status || 'REVIEW_REQUIRED'}.`);
      setName(''); await loadAssets();
    } catch (err) { setError(err instanceof Error ? err.message : 'Parametric generation failed'); }
    finally { setWorking(false); }
  };

  const generateFromImage = async () => {
    if (!file) return setError('Select a reference image first.');
    if (!name.trim()) return setError('Asset name is required.');
    const form = new FormData();
    form.append('file', file); form.append('productName', name.trim()); form.append('variantName', variantName.trim() || 'Custom');
    form.append('frameWidthMm', frameWidthMm); form.append('bridgeWidthMm', bridgeWidthMm); form.append('lensWidthMm', lensWidthMm); form.append('lensHeightMm', lensHeightMm);
    setWorking(true); resetMessages();
    try {
      const response = await apiFetch('/api/generate-model', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Image-to-GLB generation failed');
      setSuccess(`Reference image converted to GLB and registered as ${body.status || 'REVIEW_REQUIRED'}.`);
      setFile(null); setName('');
      const input = document.getElementById('vto-source-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadAssets();
    } catch (err) { setError(err instanceof Error ? err.message : 'Image-to-GLB generation failed'); }
    finally { setWorking(false); }
  };

  const transition = async (asset: VtoAsset, status: 'APPROVED' | 'PUBLISHED') => {
    setWorking(true); resetMessages();
    try {
      const response = await apiFetch('/api/vto-assets', { method: 'PATCH', body: JSON.stringify({ assetId: asset.assetId, status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Could not change status to ${status}`);
      setSuccess(`${asset.name} is now ${status}.`); await loadAssets();
    } catch (err) { setError(err instanceof Error ? err.message : 'Lifecycle update failed'); }
    finally { setWorking(false); }
  };

  const numericFields = (
    <>
      <label className="text-xs text-neutral-400">Frame width (mm)<input value={frameWidthMm} onChange={e => setFrameWidthMm(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>
      <label className="text-xs text-neutral-400">Bridge width (mm)<input value={bridgeWidthMm} onChange={e => setBridgeWidthMm(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>
      <label className="text-xs text-neutral-400">Lens width (mm)<input value={lensWidthMm} onChange={e => setLensWidthMm(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>
      <label className="text-xs text-neutral-400">Lens height (mm)<input value={lensHeightMm} onChange={e => setLensHeightMm(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>
    </>
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-200 p-4 sm:p-8 lg:p-10 space-y-8">
      <header><h1 className="text-2xl sm:text-3xl font-black text-white">VTO Asset Manager</h1><p className="text-sm text-neutral-500 mt-1 max-w-3xl">Create or ingest the actual 3D asset, let the server measure and calibrate it, then review and publish it for product variants.</p></header>
      {(error || success) && <div className={`rounded-xl border p-4 text-sm ${error ? 'border-red-900/60 bg-red-950/30 text-red-200' : 'border-emerald-900/60 bg-emerald-950/30 text-emerald-200'}`}>{error || success}</div>}

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-4">
          {([['upload', 'Upload GLB'], ['parametric', 'Generate GLB'], ['image', 'Image → GLB']] as const).map(([value, label]) => <button key={value} onClick={() => { setMode(value); resetMessages(); }} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === value ? 'bg-brand-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>{label}</button>)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="text-xs text-neutral-400">Asset / product name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Slightly Retro Black" className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>
          {mode !== 'upload' && <label className="text-xs text-neutral-400">Variant name<input value={variantName} onChange={e => setVariantName(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>}
          {mode === 'upload' && <label className="text-xs text-neutral-400">Physical frame width (mm)<input value={frameWidthMm} onChange={e => setFrameWidthMm(e.target.value)} inputMode="decimal" placeholder="e.g. 140" className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>}
          {mode === 'upload' && <label className="text-xs text-neutral-400">Bridge width (mm), optional<input value={bridgeWidthMm} onChange={e => setBridgeWidthMm(e.target.value)} inputMode="decimal" placeholder="e.g. 18" className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white" /></label>}
        </div>

        {mode === 'upload' && <div className="space-y-4"><label className="text-xs text-neutral-400 block">Actual GLB file<input id="vto-glb-file" type="file" accept=".glb,model/gltf-binary" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:text-white" />{file && <span className="block mt-1 truncate text-[11px] text-brand-300">Selected: {file.name}</span>}</label><button onClick={uploadAsset} disabled={working || !file} className="rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white">{working ? 'Uploading & processing…' : 'Upload & Register VTO Asset'}</button></div>}

        {mode === 'parametric' && <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{numericFields}<label className="text-xs text-neutral-400">Style<select value={style} onChange={e => setStyle(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white"><option value="round">Round</option><option value="square">Square</option><option value="aviator">Aviator</option><option value="cat-eye">Cat Eye</option></select></label><label className="text-xs text-neutral-400">Material<select value={materialType} onChange={e => setMaterialType(e.target.value)} className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2.5 text-sm text-white"><option value="acetate">Acetate</option><option value="metal">Metal</option><option value="tortoise">Tortoise</option></select></label><label className="text-xs text-neutral-400">Frame color<div className="mt-1 flex items-center gap-2"><input aria-label="Choose frame color" type="color" value={colorHex} onChange={e => setColorHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 p-1" /><span className="font-mono text-xs text-neutral-400">{colorHex}</span></div></label></div><button onClick={generateParametric} disabled={working} className="rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white">{working ? 'Generating & registering…' : 'Generate & Register VTO Asset'}</button></div>}

        {mode === 'image' && <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{numericFields}</div><label className="text-xs text-neutral-400 block">Reference image<input id="vto-source-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:text-white" />{file && <span className="block mt-1 truncate text-[11px] text-brand-300">Selected: {file.name}</span>}</label><button onClick={generateFromImage} disabled={working || !file} className="rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white">{working ? 'Converting & registering…' : 'Convert Image to GLB & Register'}</button></div>}
      </section>

      <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-white">Review and publish</h2><button onClick={loadAssets} disabled={loading} className="text-xs text-brand-400 hover:text-brand-300">Refresh</button></div>
        {loading ? <div className="text-sm text-neutral-500">Loading VTO assets…</div> : assets.length === 0 ? <div className="rounded-2xl border border-neutral-800 p-8 text-sm text-neutral-500">No VTO assets registered.</div> : <div className="grid gap-4">{assets.map(asset => <article key={asset.assetId} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h3 className="font-bold text-white">{asset.name}</h3><p className="text-[11px] font-mono text-neutral-600 mt-1">{asset.assetId}</p><p className="text-xs text-neutral-500 mt-2">Physical {asset.physicalWidthMm ?? '—'} mm · Native {asset.measuredNativeWidth ?? '—'} · Multiplier {asset.widthMultiplier?.toFixed(4) ?? '—'} · Bridge {asset.bridgeWidthMm ?? '—'} mm</p></div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-bold">{asset.status}</span>{asset.status === 'REVIEW_REQUIRED' && <button disabled={working} onClick={() => transition(asset, 'APPROVED')} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white">Approve</button>}{asset.status === 'APPROVED' && <button disabled={working} onClick={() => transition(asset, 'PUBLISHED')} className="rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white">Publish</button>}{asset.glbUrl && <a href={asset.glbUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-400 hover:text-brand-300">GLB</a>}</div></div></article>)}</div>}
      </section>
    </main>
  );
}
