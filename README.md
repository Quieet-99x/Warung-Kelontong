# Buku Kasbon Warung

Aplikasi pencatatan kasbon pelanggan yang mobile-first dan offline-first. Data disimpan di perangkat melalui `localStorage`; tidak memerlukan akun atau backend.

## Fitur MVP

- Catat kasbon baru dan cari pelanggan/barang
- Tambah nominal/barang ke kasbon aktif
- Catat pembayaran parsial atau pelunasan
- Riwayat kasbon yang sudah lunas
- Pengingat WhatsApp dengan pesan otomatis
- Profil warung dan informasi pembayaran
- Persistensi offline di browser

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Quality checks

```bash
npm run check
```

Perintah tersebut menjalankan ESLint, TypeScript, 10 unit tests, dan production build.

## Catatan data

Semua data tersimpan hanya di browser/perangkat yang digunakan. Menghapus site data/browser storage akan menghapus catatan kasbon. Untuk MVP ini belum tersedia sinkronisasi antarperangkat atau backup cloud.
