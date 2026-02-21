const base = import.meta.env.BASE_URL

export function resolveAssetPath(path: string): string {
  if (base.length <= 1 || !path.startsWith('/')) return path
  return base.replace(/\/$/, '') + path
}
