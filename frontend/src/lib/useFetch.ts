import { useEffect, useRef, useState } from 'react'

interface Result<T> {
  id: string
  data?: T
  error?: Error
}

/**
 * Minimal data-fetching hook. `key` identifies the request (change it to refetch);
 * `reload()` refetches with the same key. While reloading, the previous `data` is kept
 * so the UI can dim it instead of flashing a skeleton.
 */
export function useFetch<T>(key: string, fetcher: () => Promise<T>) {
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const fetcherRef = useRef(fetcher)
  const requestId = `${key}#${tick}`

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let cancelled = false
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setResult({ id: requestId, data })
      },
      (error: unknown) => {
        if (!cancelled) setResult({ id: requestId, error: error instanceof Error ? error : new Error(String(error)) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [requestId])

  return {
    data: result?.data,
    error: result?.id === requestId ? result.error : undefined,
    loading: result?.id !== requestId,
    reload: () => setTick((t) => t + 1),
  }
}
