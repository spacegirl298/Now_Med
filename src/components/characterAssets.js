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

export function getCharacters(role = 'patient') {
  return role === 'secretary' ? secretaryCharacters : patientCharacters
}

export function getCharacterUrl(id, role = 'patient') {
  return getCharacters(role).find(character => character.id === id)?.url || null
}