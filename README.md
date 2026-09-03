# Buku Kasbon Warung

Aplikasi operasional warung yang mobile-first dan local-first. Pengguna masuk dengan Google melalui Auth.js, sedangkan seluruh data bisnis tetap disimpan di perangkat melalui `localStorage` yang dipisahkan per akun.

## Fitur MVP

- Catat kasbon baru dan cari pelanggan/barang
- Tambah nominal/barang ke kasbon aktif
- Catat pembayaran parsial atau pelunasan
- Riwayat kasbon yang sudah lunas
- Pengingat WhatsApp dengan pesan otomatis
- Profil warung dan informasi pembayaran
- Persistensi offline di browser
- Login Google tanpa database cloud

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Konfigurasi login Google

Tambahkan environment berikut pada `.env.local` untuk development dan pada Vercel Project Settings untuk Production/Preview:

```bash
AUTH_SECRET="buat-dengan-npx-auth-secret"
AUTH_GOOGLE_ID="google-oauth-client-id"
AUTH_GOOGLE_SECRET="google-oauth-client-secret"
```

Buat secret lokal dengan `npx auth secret`. Di Google Cloud Console, tambahkan callback berikut sebagai Authorized redirect URI:

- Lokal: `http://localhost:3000/api/auth/callback/google`
- Production: `https://warung-kelontong.vercel.app/api/auth/callback/google`
- Custom domain: `https://DOMAIN-ANDA/api/auth/callback/google`

Jangan menaruh nilai environment tersebut di source control atau `localStorage`.

## Quality checks

```bash
npm run check
```

Perintah tersebut menjalankan ESLint, TypeScript, seluruh unit test, dan production build.

## Catatan data

Semua akun baru dimulai kosong. Data testing lama yang memakai key tanpa namespace tidak dibaca oleh akun yang login. Data tersimpan hanya di browser/perangkat yang digunakan dan dipisahkan berdasarkan ID akun Google; login dengan akun yang sama pada perangkat lain tetap menghasilkan data kosong. Menghapus site data/browser storage akan menghapus catatan. Belum tersedia sinkronisasi antarperangkat atau backup cloud, sehingga checkpoint tetap diperlukan saat pindah perangkat.
