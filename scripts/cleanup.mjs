// ⚠️  DESTRUCTIVE DEV SCRIPT — DO NOT RUN IN PRODUCTION.
// Reads `.env.local` and deletes orphaned rows from the `vto_asset_calibrations`
// table using the service-role key. Moved out of the repository root (step 5.5)
// so it cannot be run by accident. Run explicitly: `node scripts/cleanup.mjs`.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'vto-models';

async function cleanup() {
  console.log('Fetching VTO asset records from database...');
  const { data: assets, error } = await supabase.from('vto_asset_calibrations').select('asset_id, storage_path, source_storage_path');
  
  if (error) {
    console.error('Error fetching assets:', error);
    process.exit(1);
  }

  console.log(`Found ${assets.length} records. Verifying storage files...`);
  let deletedCount = 0;

  for (const asset of assets) {
    const path = asset.storage_path || asset.source_storage_path;
    if (!path) {
      console.log(`Asset ${asset.asset_id} has no storage path, deleting...`);
      await supabase.from('vto_asset_calibrations').delete().eq('asset_id', asset.asset_id);
      deletedCount++;
      continue;
    }

    const folder = path.substring(0, path.lastIndexOf('/'));
    const filename = path.substring(path.lastIndexOf('/') + 1);
    
    const { data: files, error: listError } = await supabase.storage.from(BUCKET).list(folder);
    if (listError) {
      console.error(`Error listing folder ${folder}:`, listError);
      continue;
    }
    
    const exists = files && files.some(f => f.name === filename);

    if (!exists) {
      console.log(`GLB not found in storage for asset ${asset.asset_id} (${path}). Deleting DB record...`);
      const { error: delError } = await supabase.from('vto_asset_calibrations').delete().eq('asset_id', asset.asset_id);
      if (delError) {
         console.error(`Failed to delete ${asset.asset_id}:`, delError);
      } else {
         deletedCount++;
      }
    }
  }

  console.log(`\nCleanup complete! Deleted ${deletedCount} orphaned database records.`);
}

cleanup();
