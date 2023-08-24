import { Shape } from "../objects/shapes";

interface Pressable {
  pressArea: Shape;
  onPress: () => void;
}

export function isPressable(obj: any): obj is Pressable {
  return typeof obj === 'object' && obj.onPress !== undefined;
}

export default Pressable;