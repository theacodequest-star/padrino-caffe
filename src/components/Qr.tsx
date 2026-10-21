import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// Always dark on light paper, in both themes, so scanners can read it.
export function Qr({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#14100A', light: '#FFFDF6' } })
      .then(setSrc).catch(() => setSrc(''))
  }, [value, size])
  return (
    <div className="qr" style={{ width: `min(${size}px, 100%)` }}>
      {src && <img src={src} alt={label} />}
    </div>
  )
}
