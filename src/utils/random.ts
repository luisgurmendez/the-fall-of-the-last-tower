
class RandomUtils {

  static getNumberWithVariance(n: number, variance: number): number {
    return n + Math.random() * variance;
  }

  static getValueInRange(bottom: number, top: number): number {
    return Math.random() * (top - bottom) + bottom;
  }

  static getIntegerInRange(bottom: number, top: number): number {
    return Math.floor(RandomUtils.getValueInRange(bottom, top + 1));
  }

  static getRandomValueOf<T>(values: T[]): T {
    let max = values.length - 1;
    let index = RandomUtils.getIntegerInRange(0, max);
    return values[index];
  }

  static getRandomBoolean(prob: number = 0.5) {
    return Math.random() < prob;
  }

  static generateId() {
    const id = Math.round((Math.random() * 10000)).toString(16);
    return id;
  }

  static getNegativeRandomly(n: number, p = 0.5) {
    return (Math.random() > p ? -1 : 1) * n
  }


}

export default RandomUtils;