import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

type Toast = {
  id: string
  type: ToastType
  title: string
  description?: string
}

type ToastContextType = {
  toast: (options: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    case 'error':
      return <AlertCircle className="h-5 w-5 text-rose-500" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />
    case 'info':
    default:
      return <AlertCircle className="h-5 w-5 text-blue-500" />
  }
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className="pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-950">
      <ToastIcon type={toast.type} />
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {toast.title}
        </div>
        {toast.description && (
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {toast.description}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-sm opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [...prev, { ...options, id }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const contextValue = useCallback(
    () => ({ toast, dismiss }),
    [toast, dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toastItem) => (
          <ToastItem
            key={toastItem.id}
            toast={toastItem}
            onDismiss={() => dismiss(toastItem.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
