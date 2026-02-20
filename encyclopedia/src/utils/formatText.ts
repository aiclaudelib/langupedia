export function formatText(text: string | null | undefined): string {
  if (!text) return ''
  // bold: **text**
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // italic: *text*
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return result
}
