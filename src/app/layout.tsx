import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { HideNumbersProvider } from '@/components/HideNumbers'

export const metadata: Metadata = {
  title: 'Toribio Achaval — Facturación',
  description: 'Sistema de facturación interno',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <HideNumbersProvider>
            {children}
          </HideNumbersProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
