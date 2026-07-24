import { SIZE, cloneGrid } from "../grid";
import { isSolvedGrid } from "../validation";
import type { Grid } from "../types";

/** Deterministic PRNG so randomised sweeps reproduce exactly on failure. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

/** Remove `holes` random cells from a completed grid. */
export function punchHoles(
  solved: Grid,
  holes: number,
  random: () => number,
): Grid {
  const grid = cloneGrid(solved);
  const positions = Array.from({ length: SIZE * SIZE }, (_, i) => i);

  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  for (const position of positions.slice(0, holes)) {
    grid[Math.floor(position / SIZE)][position % SIZE] = 0;
  }
  return grid;
}

/** True when every cell is filled and no rule is broken. */
export function isCompleteAndLegal(grid: Grid): boolean {
  return isSolvedGrid(grid);
}
