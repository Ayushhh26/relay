import { useEffect, useState } from 'react'

/** 0–1 normalized mic level for UI meters (Google Meet style). */
export function useAudioLevel(
  track: MediaStreamTrack | null | undefined,
  enabled: boolean,
): number {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!enabled || !track || track.readyState !== 'live') {
      setLevel(0)
      return
    }

    let cancelled = false
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(new MediaStream([track]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.65
    source.connect(analyser)

    const bins = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0

    const tick = () => {
      if (cancelled) return
      analyser.getByteFrequencyData(bins)
      let sum = 0
      for (let i = 0; i < bins.length; i++) sum += bins[i]
      const normalized = Math.min(1, (sum / bins.length / 255) * 2.2)
      setLevel(normalized)
      raf = requestAnimationFrame(tick)
    }

    void ctx.resume().then(() => {
      if (!cancelled) raf = requestAnimationFrame(tick)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      source.disconnect()
      void ctx.close()
    }
  }, [track?.id, track?.readyState, enabled])

  return level
}
