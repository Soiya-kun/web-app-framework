declare const brandKey: unique symbol

/** 同じ string・number でも、業務上の意味が違う値を取り違えないための印。 */
export type Brand<Base, Name extends string> = Base & { readonly [brandKey]: Name }

/** 印を外した値（保存するときの形）。印のない型（'normal' | 'return' など）はそのまま。 */
export type PlainValue<Value> = Value extends { readonly [brandKey]: string }
  ? Value extends string
    ? string
    : Value extends number
      ? number
      : Value
  : Value

/** エンティティを保存するときの形。項目はエンティティと同じで、値の印だけを外す。 */
export type Stored<Entity> = { readonly [Key in keyof Entity]: PlainValue<Entity[Key]> }
