import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jay-Z — Walkman',
  description: 'Random Jay-Z verses on shuffle',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
