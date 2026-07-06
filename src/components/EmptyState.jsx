// Contextual message + action shown instead of a dead-end blank screen.
export default function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-mist flex items-center justify-center mb-4">
          <Icon size={26} className="text-rose" />
        </div>
      )}
      <p className="text-ink font-semibold mb-1">{title}</p>
      {message && <p className="text-slate text-sm max-w-sm mb-5">{message}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-rose text-white rounded-xl px-5 py-3 text-sm font-medium hover:bg-plum transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
