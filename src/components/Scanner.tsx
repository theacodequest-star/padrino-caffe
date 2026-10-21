import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { useI18n } from '../lib/i18n'

// Camera QR scanner. The browser asks for camera permission the first time.
export function Scanner({ onResult, paused }: { onResult: (text: string) => void; paused?: boolean }) {
  const { t } = useI18n()
  const video = useRef<HTMLVideoElement>(null)
  const latest = useRef(onResult)
  latest.current = onResult
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (paused || !video.current) return
    const scanner = new QrScanner(video.current, r => latest.current(r.data), {
      preferredCamera: 'environment', highlightScanRegion: true, maxScansPerSecond: 5, returnDetailedScanResult: true,
    })
    scanner.start().then(() => setFailed(false)).catch(() => setFailed(true))
    return () => { scanner.stop(); scanner.destroy() }
  }, [paused])

  if (paused) return null
  return (
    <div className="scanner">
      {failed ? <p className="scanner-msg">{t('cameraBlocked')}</p> : <video ref={video} muted playsInline />}
    </div>
  )
}
