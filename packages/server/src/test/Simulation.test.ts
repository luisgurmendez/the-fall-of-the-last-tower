/**
 * Tests for the headless simulation framework itself.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { Simulation, FrameRenderer, Raster } from '../sim';
import { LanePath } from '../navigation/LanePath';
import { Vector } from '@siege/shared';

describe('Simulation', () => {
  test('runs a match headlessly and records frames and a log', () => {
    const sim = new Simulation({ seed: 1, jungle: false });
    try {
      sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue' });
      sim.run(10);

      expect(sim.time).toBeCloseTo(10, 1);
      expect(sim.recorder.frames.length).toBeGreaterThan(50);
      expect(sim.recorder.log.some(entry => entry.kind === 'spawn' && entry.text.includes('vex'))).toBe(true);
      expect(sim.report().markdown).toContain('| p1 | vex | blue |');
    } finally {
      sim.dispose();
    }
  });

  test('commands go through the input handler', () => {
    const sim = new Simulation({ seed: 1, jungle: false, structures: false, minionWaves: false });
    try {
      const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue', at: { x: 0, y: 0 } });
      expect(sim.move('p1', 300, 0)).toBe(true);
      sim.run(2);
      expect(champion.position.x).toBeGreaterThan(50);
    } finally {
      sim.dispose();
    }
  });

  test('a seed makes runs reproducible', () => {
    const run = () => {
      const sim = new Simulation({ seed: 7 });
      try {
        sim.addChampion({ playerId: 'a', championId: 'vex', side: 'blue', bot: 'lane' });
        sim.addChampion({ playerId: 'b', championId: 'vile', side: 'red', bot: 'lane' });
        sim.run(40);
        return sim.entities(e => e.kind === 'minion' || e.kind === 'champion').map(e => `${e.id}:${e.x},${e.y},${e.hp}`).join('|');
      } finally {
        sim.dispose();
      }
    };
    expect(run()).toBe(run());
  });

  test('starting level and ability ranks can be set', () => {
    const sim = new Simulation({ seed: 1, jungle: false, structures: false, minionWaves: false });
    try {
      const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue', level: 6 });
      expect(champion.level).toBe(6);
      expect(champion.abilityRanks.R).toBe(1);
      expect(champion.skillPoints).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});

describe('FrameRenderer', () => {
  test('renders a frame to a valid PNG', () => {
    const sim = new Simulation({ seed: 1 });
    try {
      sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue' });
      sim.run(1);
      const image = new FrameRenderer({ px: 200 }).render(sim.frame());
      const png = image.toPNG();
      expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(image.width).toBe(200);
    } finally {
      sim.dispose();
    }
  });

  test('raster text and shapes draw pixels', () => {
    const raster = new Raster(40, 20, [0, 0, 0, 1]);
    raster.text(1, 1, 'HI', [255, 255, 255, 1], 1, null);
    raster.fillCircle(30, 10, 3, [255, 0, 0, 1]);
    const lit = Array.from({ length: 40 * 20 }, (_, i) => raster.pixels[i * 4]).filter(v => v > 0).length;
    expect(lit).toBeGreaterThan(20);
  });
});

describe('LanePath', () => {
  const path = new LanePath([new Vector(0, 0), new Vector(100, 0), new Vector(100, 100)]);

  test('projects points onto the path by arc length', () => {
    expect(path.length).toBe(200);
    expect(path.project(new Vector(50, 10)).distance).toBeCloseTo(50);
    expect(path.project(new Vector(110, 50)).distance).toBeCloseTo(150);
    expect(path.project(new Vector(110, 50)).offset).toBeCloseTo(10);
  });

  test('finds points and the next waypoint by distance', () => {
    expect(path.pointAt(150).equals(new Vector(100, 50))).toBe(true);
    expect(path.nextWaypointIndex(50)).toBe(1);
    expect(path.nextWaypointIndex(150)).toBe(2);
  });
});

describe('Fountain', () => {
  test('heals champions standing in their own fountain', () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    try {
      const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue' });
      champion.health = champion.maxHealth * 0.2;
      sim.run(8);
      expect(champion.health).toBeCloseTo(champion.maxHealth, 0);
    } finally {
      sim.dispose();
    }
  });
});

describe('Shop', () => {
  test('items can only be bought at the fountain', () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    try {
      const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue', at: { x: 0, y: 0 } });
      (champion as { gold: number }).gold = 1000;
      sim.buy('p1', 'long_sword');
      sim.run(0.1);
      expect(champion.items.some(item => item?.definitionId === 'long_sword')).toBe(false);

      champion.position = sim.context.mapConfig.CHAMPION_SPAWN.BLUE.clone();
      sim.buy('p1', 'long_sword');
      sim.run(0.1);
      expect(champion.items.some(item => item?.definitionId === 'long_sword')).toBe(true);
    } finally {
      sim.dispose();
    }
  });
});
