// The mix of choices a bot plays when both sides choose at once (Showdown's opener, ADR 0035,
// 0048): the maximin strategy of a small zero-sum game. Plain arithmetic and comparisons only, so
// every JS engine reaches the same mix (ADR 0001).

/**
 * The row mix that maximises the row player's worst case in the zero-sum game `matrix` (rows: the
 * maximiser's choices, columns: the minimiser's). Up to 3 x 3 it is the exact small solver Best of
 * 3 has always used, so its choices never change; larger games (a Best of 5's opener) use the
 * general one.
 */
export function maximinMix(matrix: readonly (readonly number[])[]): number[] {
  const columns = matrix[0]?.length ?? 0;
  return matrix.length <= 3 && columns <= 3 ? maximinMixSmall(matrix) : maximinMixAny(matrix);
}

/**
 * The mix of rows that maximises the row player's worst case in the zero-sum game `matrix` (rows:
 * the maximiser's choices, columns: the minimiser's), for up to three rows. Exact: the optimum of a
 * game this small is a pure row, a mix of two rows that makes two columns equal, or a mix of three
 * that makes three columns equal, so every candidate is tried. Ties keep the earliest candidate.
 */
function maximinMixSmall(matrix: readonly (readonly number[])[]): number[] {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const at = (row: number, column: number) => matrix[row]?.[column] ?? 0;
  const worst = (mix: readonly number[]) => {
    let lowest = Infinity;
    for (let c = 0; c < columns; c++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) sum += (mix[r] ?? 0) * at(r, c);
      lowest = Math.min(lowest, sum);
    }
    return lowest;
  };
  const pure = (row: number) => Array.from({ length: rows }, (_, r) => (r === row ? 1 : 0));
  const candidates: number[][] = Array.from({ length: rows }, (_, row) => pure(row));
  // Two rows i, j mixed t : 1 - t so that columns c and d pay the same.
  for (let i = 0; i < rows; i++) {
    for (let j = i + 1; j < rows; j++) {
      for (let c = 0; c < columns; c++) {
        for (let d = c + 1; d < columns; d++) {
          const slope = at(i, c) - at(j, c) - (at(i, d) - at(j, d));
          if (slope === 0) continue;
          const t = (at(j, d) - at(j, c)) / slope;
          if (t <= 0 || t >= 1) continue;
          const mix = Array.from({ length: rows }, () => 0);
          mix[i] = t;
          mix[j] = 1 - t;
          candidates.push(mix);
        }
      }
    }
  }
  if (rows === 3 && columns === 3) {
    // All three rows, mixed x, y, 1 - x - y, so that all three columns pay the same.
    const g = (r: number, c: number) => at(r, c) - at(2, c);
    const a1 = g(0, 0) - g(0, 1);
    const b1 = g(1, 0) - g(1, 1);
    const c1 = at(2, 1) - at(2, 0);
    const a2 = g(0, 0) - g(0, 2);
    const b2 = g(1, 0) - g(1, 2);
    const c2 = at(2, 2) - at(2, 0);
    const det = a1 * b2 - a2 * b1;
    if (det !== 0) {
      const x = (c1 * b2 - c2 * b1) / det;
      const y = (a1 * c2 - a2 * c1) / det;
      if (x > 0 && y > 0 && x + y < 1) candidates.push([x, y, 1 - x - y]);
    }
  }
  let best = candidates[0] ?? [];
  let bestValue = worst(best);
  for (const mix of candidates) {
    const value = worst(mix);
    if (value > bestValue + 1e-12) {
      best = mix;
      bestValue = value;
    }
  }
  return best;
}

/** Solves `a x = b` by Gaussian elimination with partial pivoting; undefined when singular. */
function solve(a: number[][], b: number[]): number[] | undefined {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
    }
    if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) return undefined;
    [m[col], m[pivot]] = [m[pivot] ?? [], m[col] ?? []];
    const top = m[col] ?? [];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const row = m[r] ?? [];
      const f = (row[col] ?? 0) / (top[col] ?? 1);
      for (let c = col; c <= n; c++) row[c] = (row[c] ?? 0) - f * (top[c] ?? 0);
    }
  }
  return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

function subsets(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  const go = (start: number, picked: number[]) => {
    if (picked.length === k) {
      out.push(picked);
      return;
    }
    for (let i = start; i < n; i++) go(i + 1, [...picked, i]);
  };
  go(0, []);
  return out;
}

/**
 * The same for any size (ADR 0048, from the Best of 5 measurement's bot): every square support of
 * rows and columns, mixed so those columns pay the same. Ties keep the earliest candidate (smallest
 * supports first).
 */
function maximinMixAny(matrix: readonly (readonly number[])[]): number[] {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const at = (r: number, c: number) => matrix[r]?.[c] ?? 0;
  const worst = (mix: readonly number[]) => {
    let lowest = Infinity;
    for (let c = 0; c < columns; c++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) sum += (mix[r] ?? 0) * at(r, c);
      lowest = Math.min(lowest, sum);
    }
    return lowest;
  };
  let best: number[] = [];
  let bestValue = -Infinity;
  for (let k = 1; k <= Math.min(rows, columns); k++) {
    for (const rs of subsets(rows, k)) {
      for (const cs of subsets(columns, k)) {
        // Unknowns: x over rs, then v. Each column in cs pays v; the mix sums to 1.
        const a = cs.map((c) => [...rs.map((r) => at(r, c)), -1]);
        a.push([...rs.map(() => 1), 0]);
        const x = solve(a, [...cs.map(() => 0), 1]);
        if (x === undefined || rs.some((_, i) => (x[i] ?? 0) < -1e-12)) continue;
        const mix = Array.from({ length: rows }, () => 0);
        rs.forEach((r, i) => (mix[r] = Math.max(0, x[i] ?? 0)));
        const value = worst(mix);
        if (value > bestValue + 1e-12) {
          best = mix;
          bestValue = value;
        }
      }
    }
  }
  return best;
}
