/** 条件で付け外しする class 名をつなぐ。false・undefined は外す。 */
export function joinClassNames(...classNames: readonly (string | false | undefined)[]): string {
  return classNames.filter((className) => typeof className === 'string' && className !== '').join(' ')
}
