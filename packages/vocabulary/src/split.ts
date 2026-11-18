/**
 * 識別子を単語に分けるため。camelCase・PascalCase・snake_case・kebab-case を区切り、小文字にそろえる。
 * 数字は単語として扱わない。
 */
export function splitWords(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z]+/)
    .filter((part) => part !== '')
    .map((part) => part.toLowerCase())
}
