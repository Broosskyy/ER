export function resolveActivityPanelLayout(platformOs: string): 'web-drawer' | 'mobile-modal' {
  return platformOs === 'web' ? 'web-drawer' : 'mobile-modal';
}
