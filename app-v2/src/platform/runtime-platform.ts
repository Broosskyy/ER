export function isWebRuntime(): boolean {
  return typeof document !== 'undefined';
}
