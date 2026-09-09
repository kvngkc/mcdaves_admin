import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBucket() {
  console.log("Checking bucket 'vto-models'...");
  const { data, error } = await supabase.storage.getBucket('vto-models');
  if (error) {
    console.error("Bucket Error:", error);
  } else {
    console.log("Bucket exists:", data.name);
  }
  
  console.log("Attempting test upload...");
  const dummyBuffer = Buffer.from("test data");
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('vto-models')
    .upload('test-upload-vto.txt', dummyBuffer, {
      contentType: 'text/plain',
      upsert: true,
    });
    
  if (uploadError) {
    console.error("Upload Error:", uploadError);
  } else {
    console.log("Upload Success:", uploadData);
    // clean up
    await supabase.storage.from('vto-models').remove(['test-upload-vto.txt']);
  }
}

testBucket();
