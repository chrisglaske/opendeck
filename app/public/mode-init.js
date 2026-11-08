// Runs before first paint (blocking, no imports) so dark-mode users never see
// a flash of light UI. Mirrors readStoredMode + resolveMode + applyResolvedMode
// in src/theme/colorMode.ts.
;(function () {
  var mode = 'system'
  try {
    var stored = window.localStorage.getItem('opendeck.v2.colorMode')
    if (stored === 'light' || stored === 'dark') mode = stored
  } catch (e) {}
  try {
    if (mode === 'system') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.setAttribute('data-mode', mode)
    document.documentElement.style.colorScheme = mode
  } catch (e) {}
})()
