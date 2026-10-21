import { useCallback, useEffect, useState } from 'react'

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)

  const reload = useCallback(async () => {
    try { setData(await run()); setError(null) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [run])

  useEffect(() => { setLoading(true); reload() }, [reload])
  return { data, error, loading, reload, setData }
}
