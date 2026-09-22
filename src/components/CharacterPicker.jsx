import { characters } from './characterAssets'

export default function CharacterPicker({ value, onChange }) {
  if (characters.length === 0) return null

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
