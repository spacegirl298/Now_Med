// Semantic status badge. Kept deliberately separate from the brand (rose) palette
// so appointment status is never confused with a decorative or branding colour.
const STATUS_STYLES = {
  booked: 'bg-pastel-blue text-blue',
  confirmed: 'bg-pastel-green text-green',
  scheduled: 'bg-pastel-blue text-blue',
  pending: 'bg-pastel-blue text-blue',
  delayed: 'bg-pastel-amber text-amber',
  cancelled: 'bg-pastel-red text-red',
  'no-show': 'bg-pastel-red text-red',
}

const LABELS = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  pending: 'Pending',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
}

export default function Badge({ status, className = '' }) {
  const style = STATUS_STYLES[status] || 'bg-sand text-slate'
  const label = LABELS[status] || status
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  )
}