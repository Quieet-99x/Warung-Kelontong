import type {Metadata,Viewport} from "next"; import {Plus_Jakarta_Sans} from "next/font/google"; import "./globals.css";
const font=Plus_Jakarta_Sans({subsets:["latin"],variable:"--font-app"});
export const metadata:Metadata={title:"Buku Kasbon Warung",description:"Catat dan kelola kasbon pelanggan secara praktis, offline, dan aman."};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#116149"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="id"><body className={font.variable}>{children}</body></html>}
