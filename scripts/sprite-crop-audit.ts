/**
 * For every champion strip (public/assets/champs/<id>/): its frames, and how many opaque
 * pixels touch each frame's edges, the largest per strip: art cut off by its canvas.
 * Usage: bun scripts/sprite-crop-audit.ts [dir]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { decodePng } from './lib/png';
const root = process.argv[2] ?? 'public/assets/champs';
for (const champ of readdirSync(root)) {
  const out: string[] = [];
  for (const file of readdirSync(`${root}/${champ}`).filter(f => f.endsWith('.png') && f !== 'portrait.png').sort()) {
    const img = decodePng(readFileSync(`${root}/${champ}/${file}`));
    const size = img.height; const frames = Math.round(img.width / size);
    let worst = 0, worstSide = '';
    for (let f = 0; f < frames; f++) {
      const ox = f * size;
      const sides: Record<string, number> = { top: 0, left: 0, right: 0, bottom: 0 };
      for (let i = 0; i < size; i++) {
        const a = (x: number, y: number) => img.data[((y) * img.width + ox + x) * 4 + 3] > 40 ? 1 : 0;
        sides.top += a(i, 0); sides.bottom += a(i, size - 1); sides.left += a(0, i); sides.right += a(size - 1, i);
      }
      for (const [side, n] of Object.entries(sides)) if (n > worst) { worst = n; worstSide = side; }
    }
    out.push(`${file.replace('.png','')}:${frames}f${size}px${worst > 0 ? ` CUT(${worstSide} ${worst}px)` : ''}`);
  }
  console.log(champ.padEnd(10), out.join('  '));
}
