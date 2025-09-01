import './globals.css';
import { ReactNode } from 'react';
import Link from 'next/link';
import HeaderClient from './HeaderClient';
import { CurrencyProvider } from './currency/CurrencyContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { ToastProvider } from './ui/ToastContext';

export const metadata = {
  title: 'Celebrate – Find and book event venues',
  description: 'Discover, compare, and book venues for weddings, birthdays, graduations, and corporate events.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <LanguageProvider>
        <CurrencyProvider>
        <ToastProvider>
        <header style={{display:'flex',gap:16,alignItems:'center',padding:16,borderBottom:'1px solid #eee'}}>
          <Link href="/">🎉 Celebrate</Link>
          <nav style={{display:'flex',gap:12}}>
            <Link href="/search">Search</Link>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
          <div style={{marginLeft:'auto'}}>
            <HeaderClient />
          </div>
        </header>
        <main style={{maxWidth:1000,margin:'0 auto',padding:16}}>{children}</main>
        </ToastProvider>
        </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
