import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AlertDialogContextType = {
  open: boolean
  setOpen: (open: boolean) => void
}

const AlertDialogContext = createContext<AlertDialogContextType | null>(null)

function useAlertDialogContext() {
  const context = useContext(AlertDialogContext)
  if (!context) {
    throw new Error('AlertDialog components must be used within an AlertDialog')
  }
  return context
}

type AlertDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <AlertDialogContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

type AlertDialogTriggerProps = {
  children: ReactNode
  asChild?: boolean
}

function AlertDialogTrigger({ children }: AlertDialogTriggerProps) {
  const { setOpen } = useAlertDialogContext()
  return <div onClick={() => setOpen(true)}>{children}</div>
}

type AlertDialogContentProps = {
  children: ReactNode
  className?: string
}

function AlertDialogContent({ children, className }: AlertDialogContentProps) {
  const { open, setOpen } = useAlertDialogContext()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative z-50 w-full max-w-md rounded-xl bg-white p-6 shadow-lg dark:bg-gray-950',
          className
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </button>
        {children}
      </div>
    </div>
  )
}

type AlertDialogHeaderProps = {
  children: ReactNode
  className?: string
}

function AlertDialogHeader({ children, className }: AlertDialogHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}>
      {children}
    </div>
  )
}

type AlertDialogTitleProps = {
  children: ReactNode
  className?: string
}

function AlertDialogTitle({ children, className }: AlertDialogTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h2>
  )
}

type AlertDialogDescriptionProps = {
  children: ReactNode
  className?: string
}

function AlertDialogDescription({ children, className }: AlertDialogDescriptionProps) {
  return (
    <p className={cn('text-sm text-gray-500 dark:text-gray-400', className)}>
      {children}
    </p>
  )
}

type AlertDialogFooterProps = {
  children: ReactNode
  className?: string
}

function AlertDialogFooter({ children, className }: AlertDialogFooterProps) {
  return (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)}>
      {children}
    </div>
  )
}

type AlertDialogActionProps = {
  children: ReactNode
  onClick?: () => void
  className?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

function AlertDialogAction({
  children,
  onClick,
  className,
  variant = 'default',
}: AlertDialogActionProps) {
  const { setOpen } = useAlertDialogContext()

  const handleClick = () => {
    onClick?.()
    setOpen(false)
  }

  return (
    <Button variant={variant} onClick={handleClick} className={className}>
      {children}
    </Button>
  )
}

type AlertDialogCancelProps = {
  children: ReactNode
  className?: string
}

function AlertDialogCancel({ children, className }: AlertDialogCancelProps) {
  const { setOpen } = useAlertDialogContext()

  return (
    <Button variant="outline" onClick={() => setOpen(false)} className={className}>
      {children}
    </Button>
  )
}

// Hook for simple confirm dialog
type ConfirmDialogOptions = {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

function useConfirmDialog() {
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

  const ConfirmDialogComponent = useMemo(() => {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{options.cancelText || '取消'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              variant={options.variant || 'default'}
            >
              {options.confirmText || '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }, [open, options, handleConfirm])

  return { confirm, ConfirmDialogComponent }
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  useConfirmDialog,
}
