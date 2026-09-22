import { getCharacterUrl } from './characterAssets'

// Shows a profile photo if one exists, otherwise falls back to initials on a rose circle.
export default function Avatar({ name = '', photoUrl = null, character = '', size = 40 }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || '?'

  const style = { width: size, height: size, fontSize: size * 0.4 }

  const characterUrl = getCharacterUrl(character)

  if (photoUrl || characterUrl) {
    return (
      <img
        src={photoUrl || characterUrl}
        alt={name}
        style={style}
        className="rounded-full object-cover"
      />
    )
  }

  return (
    <div
      style={style}
      className="rounded-full bg-rose text-white flex items-center justify-center font-semibold shrink-0"
    >
      {initials}
    </div>
  )
}
