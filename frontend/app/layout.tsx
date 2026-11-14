import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bartr',
  description: 'A foundation for trading what you have for what you need.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
