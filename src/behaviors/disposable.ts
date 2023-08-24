
interface Disposable {
  shouldDispose: boolean;
  dispose?: () => void | undefined;
}

export function isDisposable(obj: any): obj is Disposable {
  return typeof obj === 'object' && obj.shouldDispose !== undefined;
}

export default Disposable
