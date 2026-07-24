import type { Difficulty, Puzzle } from "./types";

/**
 * Sample puzzles, one per difficulty tier. Every entry has exactly one solution.
 *
 * `evil` is the well known brute-force stress test: a row-major backtracker that
 * tries digits 1-9 in order stalls on it for minutes, which is precisely why the
 * solver picks cells by fewest candidates instead. It is kept here so the
 * behaviour stays covered by a puzzle a user can actually click.
 */
export const PUZZLES: Puzzle[] = [
  {
    id: "easy",
    label: "Easy",
    difficulty: "easy",
    cells:
      "530070000" +
      "600195000" +
      "098000060" +
      "800060003" +
      "400803001" +
      "700020006" +
      "060000280" +
      "000419005" +
      "000080079",
  },
  {
    id: "medium",
    label: "Medium",
    difficulty: "medium",
    cells:
      "200080300" +
      "060070084" +
      "030500209" +
      "000105408" +
      "000000000" +
      "402706000" +
      "301007040" +
      "720040060" +
      "004010003",
  },
  {
    id: "hard",
    label: "Hard",
    difficulty: "hard",
    cells:
      "000000907" +
      "000420180" +
      "000705026" +
      "100904000" +
      "050000040" +
      "000507009" +
      "920108000" +
      "034059000" +
      "507000000",
  },
  {
    id: "evil",
    label: "Evil",
    difficulty: "evil",
    cells:
      "000000010" +
      "400000000" +
      "020000000" +
      "000050407" +
      "008000300" +
      "001090000" +
      "300400200" +
      "050100000" +
      "000806000",
  },
];

export function getPuzzle(difficulty: Difficulty): Puzzle {
  const puzzle = PUZZLES.find((entry) => entry.difficulty === difficulty);
  if (!puzzle) throw new Error(`Unknown difficulty: ${difficulty}`);
  return puzzle;
}
