const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // omit I, O for legibility

export function generateJoinCode(length = 4): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}
