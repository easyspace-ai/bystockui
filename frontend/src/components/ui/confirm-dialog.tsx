import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConfirmDialogOptions = {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

type ConfirmDialogContextType = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider')
  }
  return context
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmDialogOptions>({
    title: '',
    description: '',
  })
  const [resolvePromise, setResolvePromise] = useState<
    ((value: boolean) => void) | null
  >(null)

  const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
    setOptions(opts)
    setOpen(true)
    return new Promise((resolve) => {
      setResolvePromise(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    resolvePromise?.(true)
    setOpen(false)
  }, [resolvePromise])

  const handleCancel = useCallback(() => {
    resolvePromise?.(false)
    setOpen(false)
  }, [resolvePromise])

  const contextValue = useMemo(
    () => ({ confirm }),
    [confirm]
  )

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={handleCancel}
          />

          {/* Dialog */}
          <div className="relative z-50 w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-gray-950">
            <button
              type="button"
              onClick={handleCancel}
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </button>

            <div className="flex flex-col space-y-2 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                {options.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {options.description}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">
              <Button variant="outline" onClick={handleCancel}>
                {options.cancelText || '取消'}
              </Button>
              <Button
                variant={options.variant || 'default'}
                onClick={handleConfirm}
              >
                {options.confirmText || '确认'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  )
}
