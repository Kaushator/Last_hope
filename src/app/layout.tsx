import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HTX Analytics - Personal Trading Analytics Platform',
  description: 'Personal HTX analytics platform with AI-powered insights',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  )
}