// ⚠️  DEV SCRIPT — REWRITES SOURCE FILES IN PLACE.
// Rewrites the import order in the listed components. Moved out of the
// repository root (step 5.5) so it cannot be run by accident.
// Run explicitly: `node scripts/fix-imports.js`.
const fs = require('fs');
const files = [
  './src/components/VariantModal.tsx',
  './src/components/Sidebar.tsx',
  './src/components/ProductModal.tsx',
  './src/components/AuthOverlay.tsx',
  './src/app/products/page.tsx',
  './src/app/orders/page.tsx',
  './src/app/intents/page.tsx'
];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.startsWith('import { apiFetch }')) {
    content = content.replace(/import \{ apiFetch \} from '@\/lib\/api-client';\r?\nuse client';/g, '\'use client\';\nimport { apiFetch } from \'@/lib/api-client\';');
    content = content.replace(/import { apiFetch } from \"@\/lib\/api-client\";\r?\nuse client';/g, '\'use client\';\nimport { apiFetch } from \"@/lib/api-client\";');
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
});
