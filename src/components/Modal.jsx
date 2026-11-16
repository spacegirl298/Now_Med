import { useEffect } from "react";
import { X, ChevronLeft } from "lucide-react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel = "Confirm",
  onConfirm = null,
  confirmVariant = "primary",
  cancelLabel = "Cancel",
  hideFooter = false,
  confirmDisabled = false,
  headerVariant = "light",
  onBack = null,
  hideClose = false,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const confirmClasses =
    confirmVariant === "danger"
      ? "bg-red text-white hover:opacity-90"
      : "bg-rose text-white hover:bg-plum";

  const isDark = headerVariant === "dark";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-lg max-h-[92dvh] sm:max-h-[90dvh] flex flex-col">
        <div
          className={`shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 border-b rounded-t-2xl ${
            isDark ? "bg-rose border-rose" : "border-sand"
          }`}
        >
          {!hideClose && onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className={`w-11 h-11 -m-2 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                isDark
                  ? "text-white hover:bg-white/10"
                  : "text-slate hover:text-ink hover:bg-mist"
              }`}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2
            className={`text-lg font-semibold flex-1 min-w-0 break-words ${isDark ? "text-white" : "text-ink"}`}
          >
            {title}
          </h2>
          {!hideClose && !onBack && (
            <button
              onClick={onClose}
              aria-label="Close"
              className={`w-11 h-11 -m-2 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                isDark
                  ? "text-white hover:bg-white/10"
                  : "text-slate hover:text-ink hover:bg-mist"
              }`}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>

        {!hideFooter && (
          <div className="shrink-0 flex gap-3 px-4 sm:px-6 py-4 border-t border-sand safe-bottom">
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
  );
}
