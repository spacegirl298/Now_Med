const VARIANTS = {
  primary: 'bg-rose text-white hover:bg-plum disabled:opacity-50',
  secondary: 'bg-white text-ink border border-stone hover:border-rose disabled:opacity-50',
  danger: 'bg-white text-red border border-red hover:bg-pastel-red disabled:opacity-50',
  ghost: 'bg-transparent text-slate hover:text-ink',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  fullWidth = false,
}) {
  const sizeClasses = size === 'sm' ? 'px-3 py-2 text-sm' : 'px-5 py-3 text-sm'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${VARIANTS[variant]} ${sizeClasses} ${fullWidth ? 'w-full' : ''} rounded-xl font-medium transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
