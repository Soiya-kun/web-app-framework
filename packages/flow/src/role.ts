// 役割。業務フローの担当・議事録の出席者・課題の担当を、人の名前でなく役割で書く。
// 立場は3つ。開発チーム（システムを作る側。PM・エンジニア）、業務部門（システムを使う側。経理担当・営業担当・承認者）、
// 外（業務の相手。顧客。業務フローには出るが打合せには出ない）。
export type RoleSide = 'vendor' | 'business' | 'external'

export type Role = {
  readonly kind: 'role'
  /** 単語帳の名詞（accountant →「経理担当」）。変数の名前と同じにする。 */
  readonly name: string
  readonly side: RoleSide
}

/** 役割を書く。 */
export function defineRole(name: string, definition: { readonly side: RoleSide }): Role {
  return { kind: 'role', name, side: definition.side }
}
