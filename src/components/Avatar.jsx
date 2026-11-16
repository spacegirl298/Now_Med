import { getCharacterUrl } from './characterAssets'

// Shows a profile photo if one exists, otherwise the chosen character, otherwise
// initials on a rose circle. role picks the character set: 'patient' (default)
// or 'secretary' (use it for secretaries and doctors).
export default function Avatar({ name = '', photoUrl = null, character = '', role = 'patient', size = 40 }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || '?'

  const style = { width: size, height: size, fontSize: size * 0.4 }

  const characterUrl = getCharacterUrl(character, role)

  if (photoUrl || characterUrl) {
    return (
      <img
        src={photoUrl || characterUrl}
        alt={name}
        style={style}
        className="rounded-full object-cover shrink-0"
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
