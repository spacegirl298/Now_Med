// Profile pictures live in src/assets and are picked up by file name:
//   Patient_Pfp_01.PNG, Patient_Pfp_02.PNG, ...     -> patients (and their children)
//   Secretary_Pfp_01.png, Secretary_Pfp_02.png, ... -> secretaries and doctors
// The two-digit number is what gets saved to Firestore as `profileCharacter`.
// import.meta.glob needs literal patterns, so each set has its own call.
const patientFiles = import.meta.glob('../assets/Patient_Pfp_*.PNG', {
  eager: true,
  import: 'default',
  query: '?url',
})

const secretaryFiles = import.meta.glob('../assets/Secretary_Pfp_*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})

function buildList(files, prefix) {
  const pattern = new RegExp(`${prefix}_Pfp_(\\d+)\\.png$`, 'i')
  return Object.entries(files)
    .map(([path, url]) => {
      const match = path.match(pattern)
      return match ? { id: match[1].padStart(2, '0'), url } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export const patientCharacters = buildList(patientFiles, 'Patient')
export const secretaryCharacters = buildList(secretaryFiles, 'Secretary')

// role: 'patient' (default) or 'secretary'
export function getCharacters(role = 'patient') {
  return role === 'secretary' ? secretaryCharacters : patientCharacters
}

export function getCharacterUrl(id, role = 'patient') {
  return getCharacters(role).find(character => character.id === id)?.url || null
}