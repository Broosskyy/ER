export const DEFAULT_COLLAPSED_LINE_COUNT = 7;

export function shouldCollapseDescription(
  text: string,
  collapsedLineCount = DEFAULT_COLLAPSED_LINE_COUNT,
): boolean {
  const lineCount = text.split(/\n/).length;
  if (lineCount > collapsedLineCount) {
    return true;
  }
  return text.length > collapsedLineCount * 90;
}
