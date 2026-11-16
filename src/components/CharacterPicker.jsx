import { getCharacters } from './characterAssets'

// role picks the image set: 'patient' (Patient_Pfp_*) or 'secretary' (Secretary_Pfp_*).
export default function CharacterPicker({ value, onChange, role = 'patient' }) {
  const characters = getCharacters(role)
  // Don't fail silently: tell whoever is building the app which files are expected.
  if (characters.length === 0) {
    const prefix = role === 'secretary' ? 'Secretary' : 'Patient'
    const extension = role === 'secretary' ? 'png' : 'PNG'
    return (
      <p className="text-sm text-slate">
        No pictures found. Add images named {prefix}_Pfp_01.{extension}, {prefix}_Pfp_02.{extension}, ... to src/assets.
      </p>
    )
  }

  return (
    <fieldset>
      <legend className="sr-only">Choose your character</legend>
      <div className="grid grid-cols-5 gap-3 sm:grid-cols-5" role="radiogroup" aria-label="Profile character">
        {characters.map(character => {
          const selected = value === character.id
          return (
            <button
              key={character.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Character ${character.id}`}
              onClick={() => onChange(character.id)}
              className={`aspect-square rounded-2xl border-2 p-2 transition-colors ${
                selected
                  ? 'border-rose bg-mist'
                  : 'border-transparent hover:border-blush'
              }`}
            >
              <img
                src={character.url}
                alt=""
                className="w-full h-full object-contain"
              />
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}