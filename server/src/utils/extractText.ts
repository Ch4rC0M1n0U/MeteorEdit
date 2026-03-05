export function extractTextFromTipTap(json: any): string {
  if (!json || !json.content) return '';
  const parts: string[] = [];
  function walk(node: any) {
    if (node.text) parts.push(node.text);
    if (node.content) node.content.forEach(walk);
  }
  walk(json);
  return parts.join(' ').trim();
}
