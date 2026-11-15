import type { Metadata } from 'next';
import './globals.css';
import { WorkspaceProvider } from '@/components/workspace/provider';
import { WorkspaceShell } from '@/components/workspace/shell';

export const metadata: Metadata = {
  title: 'Bartr',
  description: 'Trade what you have for what you need. Prepare your items and interests for local, money-free bundle exchanges.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>
          <WorkspaceShell>{children}</WorkspaceShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
