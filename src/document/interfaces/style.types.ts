export enum TextAlignment {
  Left = 'left',
  Center = 'center',
  Right = 'right',
}

export enum FontFamily {
  A = 'A',
  B = 'B',
}

export enum CharacterSize {
  Normal = 'normal',
  DoubleWidth = 'double-width',
  DoubleHeight = 'double-height',
  DoubleWidthHeight = 'double-width-height',
}

export interface Margins {
  top?: number | undefined;
  bottom?: number | undefined;
  left?: number | undefined;
  right?: number | undefined;
}

/**
 * A style is always a *partial* set of overrides. Document, Section, and Element each carry
 * one; renderers resolve the final style by layering them (see styles/style-resolver.ts).
 */
export interface ElementStyle {
  align?: TextAlignment | undefined;
  font?: FontFamily | undefined;
  bold?: boolean | undefined;
  underline?: boolean | undefined;
  inverse?: boolean | undefined;
  characterSize?: CharacterSize | undefined;
  margins?: Margins | undefined;
  lineHeight?: number | undefined;
  letterSpacing?: number | undefined;
}

/** A style with every field populated — what you get after resolving inheritance. */
export type ResolvedStyle = {
  [K in keyof ElementStyle]-?: K extends 'margins' ? { [M in keyof Margins]-?: NonNullable<Margins[M]> } : NonNullable<ElementStyle[K]>;
};
