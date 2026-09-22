const characterFiles = import.meta.glob('../assets/Character_*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})

export const characters = Object.entries(characterFiles)
  .map(([path, url]) => {
    const match = path.match(/Character_(\d+)\.png$/)
    return match ? { id: match[1].padStart(2, '0'), url } : null
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id))

export function getCharacterUrl(id) {
  return characters.find(character => character.id === id)?.url || null
}
