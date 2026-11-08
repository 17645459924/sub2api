let branding = { name: 'Usage Center', logo: '' }

export function applyPublicBranding(settings: { site_name?: string; site_logo?: string }) {
  let logo = ''
  if (settings.site_logo) {
    try {
      const url = new URL(settings.site_logo, window.location.origin)
      if (url.protocol === 'http:' || url.protocol === 'https:' || /^data:image\//i.test(settings.site_logo)) logo = url.href
    } catch { /* Invalid configured images are omitted. */ }
  }
  branding = { name: settings.site_name?.trim() || 'Usage Center', logo }
  document.title = branding.name
  if (logo) {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement('link')
    icon.rel = 'icon'; icon.href = logo
    if (!icon.parentNode) document.head.appendChild(icon)
  }
}

export const getPublicBranding = () => branding
