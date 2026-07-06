export default function Card({ children, className = '', padded = true }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}
