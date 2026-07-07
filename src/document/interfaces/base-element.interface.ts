import type { ElementType } from './element-type.enum.js';
import type { ElementStyle } from './style.types.js';

/** Every element in a Section's tree carries a discriminant type and an optional style override. */
export interface BaseElement {
  type: ElementType;
  style?: ElementStyle | undefined;
}
