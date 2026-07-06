import { X } from 'lucide-react'

// Generic confirmation / form modal. Confirming and cancelling always use
// visually distinct buttons so a destructive action is never ambiguous.
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel = 'Confirm',
  onConfirm = null,
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
  hideFooter = false,
  confirmDisabled = false,
}) {
  if (!isOpen) return null

  const confirmClasses = confirmVariant === 'danger'
    ? 'bg-red text-white hover:opacity-90'
    : 'bg-rose text-white hover:bg-plum'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sand">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {!hideFooter && (
          <div className="flex gap-3 px-6 py-4 border-t border-sand">
            <button
              onClick={onClose}
              className="flex-1 border border-stone text-ink rounded-xl py-3 font-medium hover:border-rose transition-colors"
            >
              {cancelLabel}
            </button>
            {onConfirm && (
              <button
                onClick={onConfirm}
                disabled={confirmDisabled}
                className={`flex-1 rounded-xl py-3 font-medium transition-colors disabled:opacity-50 ${confirmClasses}`}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
