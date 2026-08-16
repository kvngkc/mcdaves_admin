# McDaves Admin Portal (`iamadmin.mcdaves.com.ng`)

Standalone administration console for McDaves Eyewear & Optical Supplies.

## 🚀 Features

- **CRM Leads & Order Intents**: Live triage for customers requesting frames/lenses, with instant Paystack payment link generation and WhatsApp tracking.
- **Confirmed Paid Orders**: Real-time view of verified Paystack orders.
- **Product Catalog Management**: Full CRUD for eyewear products (create, edit prices, descriptions, optical dimensions, status).
- **Variant & Colorway Manager**: Add colorways, price overrides, inventory stock levels, and attach 3D GLB models.
- **Direct 3D GLB Model Uploader**: Upload `.glb` binary assets directly to Supabase Storage.
- **Supabase Powered**: Uses the shared PostgreSQL database so all changes reflect immediately on `mcdaves.com.ng`.

---

## 🛠️ Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Verify environment variables in `.env.local`:
   ```env
   ADMIN_PASSKEY=mcdaves-admin-.....
   NEXT_PUBLIC_SUPABASE_URL=https://uijncyzhguftcdonkcdg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   PAYSTACK_SECRET_KEY=sk_test_...
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```
   Admin panel will be accessible at: `http://localhost:3001`

---

## ☁️ Vercel Deployment & Subdomain Configuration

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "feat: McDaves standalone admin console"
git remote add origin https://github.com/YOUR_ORG/mcdaves-admin.git
git push -u origin main
```

### 2. Import Project in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import the `mcdaves-admin` repository.
3. In **Environment Variables**, add:
   - `ADMIN_PASSKEY`
   - `ADMIN_SESSION_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PAYSTACK_SECRET_KEY`
   - `NEXT_PUBLIC_STORE_URL` (`https://mcdaves.com.ng`)
4. Click **Deploy**.

### 3. Attach Subdomain in Vercel
1. In your Vercel Project $\rightarrow$ **Settings** $\rightarrow$ **Domains**.
2. Add: `iamadmin.mcdaves.com.ng` (or `iamadmin.mcdaves.com`).
3. In your DNS provider (e.g. Cloudflare, Namecheap, GoDaddy):
   - **Type:** `CNAME`
   - **Name:** `iamadmin`
   - **Target:** `cname.vercel-dns.com` (or `@`)
4. Vercel will automatically provision an SSL/TLS certificate within minutes.
