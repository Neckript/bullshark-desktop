type Parsed = { nums: number[]; pre: string };

const parse = (v: string): Parsed => {
  const cleaned = v.trim().replace(/^v/i, '');
  const [core, pre = ''] = cleaned.split('-', 2);
  const nums = core.split('.').map((n) => {
    const x = parseInt(n, 10);
    return Number.isFinite(x) ? x : 0;
  });
  return { nums, pre };
};

export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const na = pa.nums[i] ?? 0;
    const nb = pb.nums[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre > pb.pre) return 1;
  if (pa.pre < pb.pre) return -1;
  return 0;
};
