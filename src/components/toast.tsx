import { useState, useEffect, useCallback } from 'react'

type Toast = {
  id: number
  message: string
}

let toastId = 0
let addToastGlobal: ((message: string) => void) | null = null

export function showToast(message: string) {
  addToastGlobal?.(message)
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Array<Toast>>([])

  const addToast = useCallback((message: string) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }, [])

  useEffect(() => {
    addToastGlobal = addToast
    return () => { addToastGlobal = null }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary shadow-lg animate-[toast-in_0.2s_ease-out]"
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
