/**
 * URL for a file served out of public/.
 *
 * These paths are built at runtime, so Vite never sees them and cannot rewrite
 * them the way it does imported assets. Without the base prefix they resolve
 * against the domain root, which 404s on any host that serves the site from a
 * sub-path — GitHub Pages being the obvious one.
 *
 * BASE_URL always carries its trailing slash.
 */
export const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`
