declare const brandKey: unique symbol

/** 同じ string・number でも、業務上の意味が違う値を取り違えないための印。 */
export type Brand<Base, Name extends string> = Base & { readonly [brandKey]: Name }
