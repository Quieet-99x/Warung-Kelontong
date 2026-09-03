import { BookOpenCheck, HardDrive, ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";

export default function LoginScreen({ configured }: { configured: boolean }) {
  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><BookOpenCheck size={26}/></div>
      <span className="auth-eyebrow">BUKU WARUNG DIGITAL</span>
      <h1>Kelola warung dari perangkat Anda</h1>
      <p>Masuk untuk membuka aplikasi. Setiap akun dimulai kosong dan memiliki data lokalnya sendiri pada browser ini.</p>
      <div className="auth-notes">
        <div><HardDrive size={18}/><span><strong>Tersimpan di perangkat</strong><small>Data tidak otomatis tersinkron ke HP atau komputer lain.</small></span></div>
        <div><ShieldCheck size={18}/><span><strong>Terpisah per akun</strong><small>Akun lain pada browser yang sama tidak membaca data Anda.</small></span></div>
      </div>
      {configured ? <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
        <button className="google-signin" type="submit"><GoogleMark/> Masuk dengan Google</button>
      </form> : <p className="auth-config-warning" role="alert">Login Google belum dikonfigurasi. Tambahkan AUTH_SECRET, AUTH_GOOGLE_ID, dan AUTH_GOOGLE_SECRET di environment Vercel.</p>}
      <small className="auth-footnote">Login melindungi akses aplikasi, bukan membuat cadangan cloud. Gunakan checkpoint saat pindah perangkat.</small>
    </section>
  </main>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.93A6 6 0 0 1 6.09 12c0-.67.12-1.32.31-1.93V7.45H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.55l3.34-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.45l3.34 2.62C7.19 7.7 9.4 5.94 12 5.94Z"/></svg>;
}
