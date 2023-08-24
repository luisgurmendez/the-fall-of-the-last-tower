import RenderElement, { RenderFn } from "../render/renderElement";
interface Renderable<RenderOptions = {}> {
  render(options?: RenderOptions): RenderElement;
}

export function isRenderable(object: any): object is Renderable {
  return typeof object === 'object' && object.render !== undefined;
}

export default Renderable;