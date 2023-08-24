export type PressedKeysMapping = { [key: string]: boolean }
class Keyboard {

  private static instance: Keyboard;
  private pressedKeys: PressedKeysMapping;

  private constructor() {
    this.pressedKeys = {};

    document.addEventListener('keydown', this.keyDownHanlder)
    document.addEventListener('keyup', this.keyUpHanlder)
  }

  private keyUpHanlder = (e: KeyboardEvent) => {
    this.pressedKeys[e.key] = false;
  }

  private keyDownHanlder = (e: KeyboardEvent) => {
    this.pressedKeys[e.key] = true;
  }

  public isKeyPressed = (key: string) => {
    return !!this.pressedKeys[key]
  }

  public clearPressedKeys() {
    this.pressedKeys = {};
  }

  public clean() {
    document.removeEventListener('keydown', this.keyDownHanlder)
    document.removeEventListener('keyup', this.keyUpHanlder)
  }

  public static getInstance(): Keyboard {
    if (!Keyboard.instance) {
      Keyboard.instance = new Keyboard();
    }

    return Keyboard.instance;
  }

  public isPressingAnyKey() {
    return Object.keys(this.pressedKeys).some(key => this.pressedKeys[key]);
  }
}

export default Keyboard;
