/** A referenced service is hidden (soft) to preserve booking history; else removed (hard). */
export function deleteMode(isReferenced: boolean): 'soft' | 'hard' {
  return isReferenced ? 'soft' : 'hard'
}
