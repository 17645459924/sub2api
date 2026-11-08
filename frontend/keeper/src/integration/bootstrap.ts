window.__APP_BASE_PATH__ = '/keeper'
// Seed upstream preferences once; Keeper's own controls continue to own them.
if (!localStorage.getItem('cpa-usage-keeper-language')) {
  const language = localStorage.getItem('sub2api_locale') || navigator.language
  localStorage.setItem('cpa-usage-keeper-language', language.startsWith('zh') ? 'zh' : 'en')
}
if (!localStorage.getItem('cpa-usage-theme') && window.parent !== window) {
  const dark = window.parent.document.documentElement.classList.contains('dark')
  localStorage.setItem('cpa-usage-theme', JSON.stringify({ state: { theme: dark ? 'dark' : 'white' }, version: 0 }))
}
