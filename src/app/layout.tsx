import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Toribio Achaval — Facturación',
  description: 'Sistema de facturación interno',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
