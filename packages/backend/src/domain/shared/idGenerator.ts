/** ID を採番する仕組み。本番は UUID、テストは連番にする。 */
export type IdGenerator = {
  generate(): string
}
