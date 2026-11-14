import type { Metadata } from 'next';
import './globals.css';
import { WorkspaceProvider } from '@/components/workspace/provider';
import { WorkspaceShell } from '@/components/workspace/shell';

export const metadata: Metadata = {
  title: 'Bartr',
  description: 'A foundation for trading what you have for what you need.',
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
