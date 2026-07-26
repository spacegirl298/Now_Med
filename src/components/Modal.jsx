import { X, ChevronLeft } from 'lucide-react'

// Generic confirmation / form modal. Confirming and cancelling always use
// visually distinct buttons so a destructive action is never ambiguous.
//
// headerVariant / onBack / hideClose are optional and default to the
// original light-header look everywhere they aren't passed, so existing
// call sites (SecretarySchedule, etc.) render exactly as before.
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
  headerVariant = 'light', // 'light' (default) | 'dark'
  onBack = null, // if set, shows a back chevron instead of the close X
  hideClose = false, // hide the header icon entirely (back or close)
}) {
  if (!isOpen) return null

  const confirmClasses = confirmVariant === 'danger'
    ? 'bg-red text-white hover:opacity-90'
    : 'bg-rose text-white hover:bg-plum'

  const isDark = headerVariant === 'dark'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div
          className={`flex items-center gap-3 px-6 py-4 border-b ${
            isDark ? 'bg-rose border-rose' : 'border-sand'
          }`}
        >
          {!hideClose && onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className={isDark ? 'text-white hover:opacity-80' : 'text-slate hover:text-ink'}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className={`text-lg font-semibold flex-1 ${isDark ? 'text-white' : 'text-ink'}`}>
            {title}
          </h2>
          {!hideClose && !onBack && (
            <button
              onClick={onClose}
              className={isDark ? 'text-white hover:opacity-80' : 'text-slate hover:text-ink'}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
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