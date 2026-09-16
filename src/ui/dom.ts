export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (found == null) throw new Error(`#${id} not found`)
  return found as T
}
