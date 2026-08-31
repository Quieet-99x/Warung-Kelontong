import type {Metadata,Viewport} from "next"; import {Plus_Jakarta_Sans} from "next/font/google"; import "./globals.css"; import "./ui-refinements.css";
import "./inventory.css";
import "./pwa-qris.css";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
const font=Plus_Jakarta_Sans({subsets:["latin"],variable:"--font-app"});
export const metadata:Metadata={
  title:"Buku Kasbon Warung",
  description:"Catat dan kelola kasbon pelanggan secara praktis, offline, dan aman.",
  applicationName:"Buku Warung",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"Buku Warung",statusBarStyle:"default"},
  icons:{apple:"/icons/icon-192x192.png"},
};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#059669"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="id"><body className={font.variable}>{children}<PWAInstallPrompt/></body></html>}
