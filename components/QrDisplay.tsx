'use client'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

export function QrDisplay({ token }: { token: string }) {
  // Responsive QR size: 200 on narrow mobile, 240 on wider screens
  const [size, setSize] = useState(220)
  useEffect(() => {
    const update = () => setSize(window.innerWidth < 360 ? 180 : window.innerWidth < 480 ? 220 : 240)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <QRCodeSVG value={token} size={size} level="H" includeMargin={false} />
      </div>
      <p className="text-xs text-slate-500 font-mono break-all max-w-xs text-center">
        {token}
      </p>
    </div>
  )
}
