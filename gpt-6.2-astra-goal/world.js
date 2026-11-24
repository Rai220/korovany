'use strict';
const CENTERS = [
  [-50, -50],
  [50, -50],
  [-50, 50],
  [50, 50],
];
const WORLD_LIMIT = 144;
const PERIOD = 2 * WORLD_LIMIT;
// Signed shortest displacement on the continuous ring roads.
const wrapped = (n) => n - PERIOD * Math.floor((n + WORLD_LIMIT) / PERIOD);
const nearest = (n, observer) => observer + wrapped(n - observer);
const rimBlend = (x, z) => {
  const t = Math.min(1, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 94) / 43));
  return t * t * (3 - 2 * t);
};
const zoneAt = (x, z) => (wrapped(x) >= 0 ? 1 : 0) + (wrapped(z) >= 0 ? 2 : 0);
function terrainFade(from, to, value) {
  const u = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return u * u * (3 - 2 * u);
}
// Heights surveyed along the watershed. Low knots form foot passes through the same mesh people walk on.
const northDivide = [
  [2, 0],
  [12, 9],
  [19, 22],
  [24, 15],
  [31, 30],
  [36, 20],
  [43, 5],
  [48, 0],
  [53, 0],
  [61, 13],
  [69, 24],
  [73, 19],
  [79, 32],
  [83, 22],
  [90, 3],
  [94, 1.4],
  [100, 9],
  [109, 26],
  [116, 17],
  [122, 11],
  [135, 0],
];
const eastDivide = [
  [6, 0],
  [15, 9],
  [23, 20],
  [27, 13],
  [32, 23],
  [38, 11],
  [45, 1],
  [48, 0],
  [52, 0],
  [59, 8],
  [65, 19],
  [72, 29],
  [78, 12],
  [84, 2],
  [88, 1],
  [95, 14],
  [102, 23],
  [108, 12],
  [114, 16],
  [126, 2],
  [133, 0],
];
const fortSpur = [
  [49, 0],
  [59, 5],
  [66, 11],
  [71, 7],
  [79, 16],
  [82, 11],
  [88, 21],
  [95, 13],
  [101, 18],
  [106, 9],
  [117, 0],
];
function crestHeight(knots, t) {
  if (t <= knots[0][0] || t >= knots[knots.length - 1][0]) return 0;
  let left = 0,
    right = knots.length - 1;
  while (right - left > 1) {
    const mid = (left + right) >> 1;
    if (t < knots[mid][0]) right = mid;
    else left = mid;
  }
  const [a, h] = knots[left],
    [b, k] = knots[right];
  return h + (k - h) * ((t - a) / (b - a));
}
function ridgeFlank(distance, lee, windward) {
  const t = Math.max(0, 1 - Math.abs(distance) / (distance < 0 ? lee : windward));
  return t * t * (1.82 - 0.82 * t);
}
const highTracks = [
  [
    [55, 62],
    [71, 68],
    [87, 75],
    [94, 86],
    [93, 100],
    [96, 112],
    [102, 126],
  ],
  [
    [71, 68],
    [79, 71],
    [89, 79],
    [99, 85],
    [114, 86],
    [126, 83],
    [133, 80],
  ],
];
function highTrackDistanceSquared(x, z) {
  if (x < 46 || z < 52) return Infinity;
  let closest = Infinity;
  for (const path of highTracks) {
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1],
        [bx, bz] = path[i],
        dx = bx - ax,
        dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      const ex = x - ax - t * dx,
        ez = z - az - t * dz;
      closest = Math.min(closest, ex * ex + ez * ez);
    }
  }
  return closest;
}
const highTrackClear = (x, z, margin) => highTrackDistanceSquared(x, z) >= margin * margin;
const settlementPads = [
  [-79, -31, -68, -20],
  [-69, -30, 34, 69],
  [38, 85, -79, -37],
  [38, 85, 23, 64],
];
function surveyedGround(x, z) {
  x = wrapped(x);
  z = wrapped(z);
  const road = Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50));
  const rim = rimBlend(x, z);
  const edge = (Math.PI * 2) / PERIOD;
  const meadow = 1.4 * Math.cos(edge * (3 * x + z)) + 1.1 * Math.sin(edge * (x - 2 * z));
  let base = 3.35 * terrainFade(4, 40, x) * terrainFade(1.1, 23, z) * (1 - rim);
  // The four settlements sit on surveyed level terraces. Roads, bridges and thresholds keep their grade.
  let openGround = 20;
  for (const [west, east, north, south] of settlementPads) {
    openGround = Math.min(openGround, Math.max(west - x, x - east, north - z, z - south));
  }
  const wild =
    terrainFade(0, 11, openGround) * terrainFade(4.1, 13.5, road) * terrainFade(4.5, 13, Math.abs(z));
  if (wild) {
    let relief = 0.65 * meadow + 0.58 * Math.sin(edge * (5 * x + 3 * z));
    // A ravine winds through the western woods. At the main road its banks flatten into a natural ford.
    if (x < -10 && z > 11) {
      const bank = x + 87 - 0.19 * (z - 71) - 5.4 * Math.sin(z * 0.088);
      const extent = terrainFade(11, 31, z) * (1 - terrainFade(116, 139, z));
      const trough = ridgeFlank(bank, 8.7, 5.2);
      const shoulder = ridgeFlank(bank + 10.2, 11, 8.4);
      relief += extent * (3.6 * shoulder - 4.3 * trough);
    }
    // Sandstone bluffs above the mill and a shallow paleochannel through the grazing common.
    if (x < -9 && z < -11) {
      const trace = z + 91 - 0.18 * (x + 78) - 3.5 * Math.sin(x * 0.097);
      const bluff = ridgeFlank(trace, 22, 10) * terrainFade(-139, -117, x) * (1 - terrainFade(-82, -28, x));
      relief += bluff * (5.6 + 1.6 * Math.cos(x * 0.22));
      const runoff = x + 103 + 5 * Math.cos(z * 0.072);
      relief -= 2.8 * ridgeFlank(runoff, 11, 6) * terrainFade(-135, -96, z);
    }
    base += wild * relief;
  }
  if (x > 2 && z > 4 && openGround > 0) {
    const north = z - (93 + (x - 68) * 0.18 + 4.2 * Math.sin(x * 0.104) + 1.6 * Math.sin(x * 0.23));
    const east = x - (109 + (z - 67) * 0.16 + 4.5 * Math.sin(z * 0.1));
    const spur = z - (11.3 + (x - 58) * 0.22 + 1.7 * Math.sin(x * 0.16));
    const n = Math.abs(north) < 36 ? crestHeight(northDivide, x) * ridgeFlank(north, 28, 36) : 0;
    const e = Math.abs(east) < 33 ? crestHeight(eastDivide, z) * ridgeFlank(east, 33, 24) : 0;
    const k = Math.abs(spur) < 12 ? crestHeight(fortSpur, x) * ridgeFlank(spur, 11.5, 12) : 0;
    const folds = Math.max(n, e, k);
    if (folds) {
      const ledges = 0.75 * Math.sin(x * 0.61 + z * 0.31) + 0.44 * Math.sin(z * 0.54 - x * 0.33);
      base +=
        terrainFade(4.2, 9, z) *
        (1 - terrainFade(131, 143, Math.max(x, z))) *
        terrainFade(0, 7, openGround) *
        terrainFade(2.8, 9, road) *
        (folds + terrainFade(1.5, 9, folds) * ledges);
    }
  }
  base += rim * meadow * terrainFade(4, 15, road);
  if (x > 45 && z > 52) {
    const track = highTrackDistanceSquared(x, z);
    if (track < 72.25) {
      // Mule tracks follow a bench cut into each saddle. The grade and camber are continuous at the fork.
      const shelf =
        3.35 +
        2.8 * terrainFade(64, 92, z) * (1 - terrainFade(97, 129, z)) +
        0.42 * terrainFade(96, 116, x) -
        2.45 * terrainFade(115, 134, x);
      base += (shelf - base) * (1 - terrainFade(1.45, 8.5, Math.sqrt(track)));
    }
  }
  return base;
}
// Each knot surveys a ridge crest in metres. The fourth and fifth coordinates give the width
// of its respective flanks. Smaller branches share their parent mountain's upper edge.
const rockRanges = [
  [
    [-38, -32, 0, 8, 7],
    [-33, -28, 5, 15, 10],
    [-27, -27, 10, 14, 12],
    [-23, -24, 16, 18, 13],
    [-20, -25, 13, 16, 12],
    [-15, -28, 22, 19, 14],
    [-13, -26, 21, 19, 13],
    [-9, -25, 30, 20, 16],
    [-6, -24, 26, 19, 15],
    [-2, -23, 20, 19, 14],
    [1, -21, 22, 19, 13],
    [5, -20, 14, 19, 13],
    [10, -19, 11, 18, 11],
    [16, -17, 5, 15, 11],
    [23, -16, 0, 11, 8],
  ],
  [
    [-9, -25, 27, 7, 9],
    [-7, -29, 21, 8, 10],
    [-1, -35, 13, 10, 9],
    [4, -38, 6, 10, 7],
    [10, -41, 0, 8, 6],
  ],
  [
    [-20, -25, 13, 7, 9],
    [-21, -20, 13, 7, 9],
    [-22, -15, 9, 9, 7],
    [-27, -10, 0, 6, 6],
  ],
  // Split limestone crown beyond the forest common. The south-facing scar is physically part of the hillside.
  [
    [-43, 21, 0, 7, 9],
    [-38, 21, 5, 9, 12],
    [-35, 19, 9, 10, 11],
    [-33, 18, 13, 10, 12],
    [-31, 18, 14, 11, 12],
    [-29, 16.5, 17, 11, 11],
    [-26, 16, 14, 12, 12],
    [-23, 18, 19, 12, 14],
    [-20, 19, 16, 12, 13],
    [-18, 20, 12, 13, 12],
    [-14, 21, 9, 12, 12],
    [-7, 24, 4, 12, 9],
    [2, 24, 0, 9, 9],
  ],
  [
    [-23, 18, 16, 6, 8],
    [-24, 23, 12, 6, 8],
    [-23, 27, 8, 8, 8],
    [-18, 32, 3, 8, 6],
    [-12, 34, 0, 6, 6],
  ],
  // The granite watershed behind the fort. Two mule gaps interrupt its broken crest.
  [
    [6, 88, 0, 8, 13],
    [14, 86, 4, 12, 15],
    [21, 86, 9, 14, 17],
    [26, 88, 14, 13, 18],
    [29, 89, 12, 16, 18],
    [32, 89, 19, 15, 17],
    [35, 87, 13, 14, 18],
    [39, 87, 7, 13, 15],
    [47, 90, 0, 13, 12],
  ],
  [
    [56, 93, 0, 10, 13],
    [62, 93, 6, 13, 17],
    [68, 96, 12, 16, 18],
    [72, 97, 14, 16, 16],
    [75, 99, 11, 17, 18],
    [80, 100, 21, 18, 17],
    [84, 101, 14, 16, 19],
    [89, 103, 7, 15, 16],
    [96, 106, 0, 13, 13],
  ],
  [
    [80, 100, 14, 8, 10],
    [81, 97, 13, 8, 10],
    [84, 95, 10, 9, 9],
    [84, 92, 12, 7, 8],
    [87, 91, 8, 7, 9],
    [88, 87, 6, 8, 7],
    [87, 82, 0, 7, 6],
  ],
  [
    [71, 96, 10, 9, 8],
    [70, 92, 9, 9, 9],
    [66, 89, 8, 11, 9],
    [65, 86, 6, 9, 9],
    [60, 81, 0, 8, 7],
  ],
  [
    [97, 99, 0, 8, 12],
    [101, 102, 9, 13, 15],
    [105, 107, 17, 14, 17],
    [109, 109, 15, 14, 16],
    [112, 110, 18, 15, 15],
    [116, 112, 11, 14, 16],
    [125, 113, 0, 14, 10],
  ],
  [
    [112, 52, 0, 12, 13],
    [112, 58, 8, 17, 13],
    [114, 64, 15, 18, 13],
    [116, 67, 13, 18, 13],
    [115, 72, 21, 18, 14],
    [117, 76, 12, 17, 15],
    [118, 81, 5, 15, 13],
    [122, 87, 0, 10, 10],
  ],
  [
    [92, 20, 0, 11, 11],
    [99, 23, 6, 15, 13],
    [103, 28, 12, 16, 14],
    [107, 33, 15, 18, 14],
    [109, 38, 10, 13, 12],
    [111, 46, 0, 10, 8],
  ],
  // West-country downland, cut by sandstone benches and the shallow heads of streams.
  [
    [-136, -112, 0, 9, 14],
    [-129, -109, 7, 13, 17],
    [-125, -106, 13, 15, 19],
    [-120, -102, 18, 17, 17],
    [-116, -103, 16, 17, 20],
    [-111, -101, 25, 17, 22],
    [-107, -98, 19, 19, 21],
    [-103, -95, 17, 19, 18],
    [-101, -90, 14, 17, 17],
    [-93, -86, 9, 17, 15],
    [-87, -81, 5, 14, 13],
    [-82, -73, 0, 11, 9],
  ],
  [
    [-133, 34, 0, 12, 10],
    [-128, 29, 12, 16, 12],
    [-123, 26, 16, 19, 14],
    [-120, 24, 22, 18, 13],
    [-116, 20, 18, 17, 14],
    [-112, 18, 14, 16, 12],
    [-108, 14, 11, 15, 12],
    [-102, 12, 7, 15, 9],
    [-91, 10, 0, 10, 7],
  ],
];
let mountainSurvey;
function upliftSurvey() {
  if (mountainSurvey) return mountainSurvey;
  const stride = PERIOD + 1,
    height = new Float32Array(stride * stride);
  function stamp(a, b, c) {
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 0.001) return;
    const minX = Math.max(-143, Math.floor(Math.min(a[0], b[0], c[0]))),
      maxX = Math.min(143, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minZ = Math.max(-143, Math.floor(Math.min(a[1], b[1], c[1]))),
      maxZ = Math.min(143, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let z = minZ; z <= maxZ; z++)
      for (let x = minX; x <= maxX; x++) {
        const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / den,
          v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / den,
          w = 1 - u - v;
        if (Math.min(u, v, w) < -0.0001) continue;
        const k = (z + WORLD_LIMIT) * stride + x + WORLD_LIMIT;
        height[k] = Math.max(height[k], a[2] * u + b[2] * v + c[2] * w);
      }
  }
  for (let id = 0; id < rockRanges.length; id++) {
    const path = rockRanges[id],
      widths = [-1, -0.79, -0.54, -0.39, -0.15, 0, 0.12, 0.26, 0.54, 0.87, 1],
      profiles = [0, 0.045, 0.19, 0.38, 0.7, 1, 0.83, 0.76, 0.31, 0.055, 0];
    let prev = null;
    for (let i = 0; i < path.length; i++) {
      const [x, z, h, lee, wind] = path[i],
        before = path[Math.max(0, i - 1)],
        after = path[Math.min(path.length - 1, i + 1)];
      const length = Math.hypot(after[0] - before[0], after[1] - before[1]),
        nx = -(after[1] - before[1]) / length,
        nz = (after[0] - before[0]) / length;
      const strip = widths.map((fraction, j) => {
        const shoulder = Math.sin(Math.PI * Math.abs(fraction)),
          seed = id * 7.151 + i * 2.792;
        const lateral =
          fraction * (fraction < 0 ? lee : wind) * (1 + 0.19 * Math.sin(seed)) +
          0.93 * Math.sin(seed + j * 0.53) * shoulder;
        const along = shoulder * (2.15 * Math.sin(seed - 0.813 * j) + 0.68 * Math.cos(seed * 1.63 + 0.48 * j));
        const elev = Math.max(
          0,
          h * (profiles[j] + shoulder * (0.12 * Math.cos(seed * 0.91 + j * 0.71) + 0.052 * Math.sin(seed + j))),
        );
        return [x + nx * lateral + nz * along, z + nz * lateral - nx * along, elev];
      });
      if (prev)
        for (let j = 1; j < strip.length; j++) {
          stamp(prev[j - 1], strip[j - 1], strip[j]);
          stamp(prev[j - 1], strip[j], prev[j]);
        }
      prev = strip;
    }
  }
  const protectedSites = [
    [-87, -24, 4],
    [-95, -7, 3],
    [-77, 75, 5],
    [-80, 29, 4],
    [-105, 91, 4],
    [-112, -6, 4],
    [-114, 77, 4],
    [63, 68, 4],
    [26, 61, 4],
    [94, 99, 4],
    [67, 80, 4],
    [-93, 40, 10],
    [25, -95, 10],
    [95, 117, 17],
  ];
  for (let z = -143; z <= 143; z++)
    for (let x = -143; x <= 143; x++) {
      const k = (z + WORLD_LIMIT) * stride + x + WORLD_LIMIT;
      const uplands = x > 5 && z > 8 && x < 135 && z < 135,
        old = uplands ? surveyedGround(x, z) : 0;
      if (height[k] === 0 && old < 7) continue;
      const road = Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50));
      let terrace = Infinity;
      for (const [west, east, north, south] of settlementPads)
        terrace = Math.min(terrace, Math.max(west - x, x - east, north - z, z - south));
      for (const [a, b, r] of protectedSites) terrace = Math.min(terrace, Math.hypot(a - x, b - z) - r);
      let mask =
        terrainFade(4, 12, road) *
        terrainFade(1, 10, terrace) *
        terrainFade(4.8, 13, Math.abs(z)) *
        (1 - terrainFade(133, 143, Math.max(Math.abs(x), Math.abs(z))));
      if (x > 45 && z > 52) mask *= terrainFade(2.5, 10, Math.sqrt(highTrackDistanceSquared(x, z)));
      if (old > 7) {
        // Plucked rock and crossing joints cut terraces on both sides of the older watershed.
        const exposure = terrainFade(7, 17, old),
          plane = x * 0.17 + z * 0.13 + old * 0.81;
        const joint = plane / 3.22 + 0.27 * Math.sin(x * 0.23 + z * 0.12) + 0.13 * Math.cos(z * 0.53);
        const edge = joint - Math.floor(joint),
          step = 2.8 * (terrainFade(0.7, 0.93, edge) - edge);
        const spur = Math.abs(Math.sin(x * 0.19 - z * 0.14 + 1.18 * Math.sin(z * 0.103))) ** 0.83;
        const gully = (1 - Math.abs(Math.sin(x * 0.143 + z * 0.216 + 0.92 * Math.cos(x * 0.139)))) ** 3;
        height[k] +=
          exposure *
          (-0.19 * (old - 7) + step + 3.65 * spur - 3.95 * gully + 0.6 * Math.sin(x * 0.72 + z * 0.47));
        // Three oblique clefts actually interrupt the skyline instead of drawing a seam across it.
        for (const [cx, cz, heading, rate, reach] of [
          [77, 98, 0.32, 0.39, 19],
          [110, 67, -0.61, 0.3, 15],
          [30, 90, 0.53, 0.32, 16],
        ]) {
          const axial = z - cz,
            cross = x - cx - heading * axial - 0.8 * Math.sin(axial * 0.39);
          const cut = (1 - terrainFade(0, 3.25, Math.abs(cross))) * (1 - terrainFade(4, reach, Math.abs(axial)));
          height[k] -= Math.max(0, old + height[k] - 11) * rate * cut;
        }
        const lifted = old + height[k],
          bed = (lifted + 0.19 * x - 0.14 * z + 0.63 * Math.sin(x * 0.24 + z * 0.18)) / 5.75,
          f = bed - Math.floor(bed);
        height[k] += exposure * terrainFade(9, 18, lifted) * 3.75 * (terrainFade(0.5, 0.93, f) - f);
      }
      height[k] *= mask;
    }
  mountainSurvey = height;
  return height;
}
function rockUplift(x, z) {
  const survey = upliftSurvey(),
    stride = PERIOD + 1,
    u = wrapped(x) + WORLD_LIMIT,
    v = wrapped(z) + WORLD_LIMIT;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * stride + i;
  return a + b <= 1
    ? survey[k] + a * (survey[k + 1] - survey[k]) + b * (survey[k + stride] - survey[k])
    : survey[k + stride + 1] +
        (1 - a) * (survey[k + stride] - survey[k + stride + 1]) +
        (1 - b) * (survey[k + 1] - survey[k + stride + 1]);
}
let playableHeightGrid;
function upliftedGround(x, z, base, rise) {
  if (!playableHeightGrid || rise === 0) return base + rise;
  const { positions, xSteps, zSteps } = playableHeightGrid,
    az = Math.abs(z);
  const gridZ =
    Math.sign(z) * (az < 8.64 ? az / 0.3 : 28.8 + ((az - 8.64) * (WORLD_LIMIT - 28.8)) / (WORLD_LIMIT - 8.64));
  const u = ((x + WORLD_LIMIT) * xSteps) / PERIOD,
    v = ((gridZ + WORLD_LIMIT) * zSteps) / PERIOD;
  const i = Math.min(xSteps - 1, Math.max(0, Math.floor(u))),
    j = Math.min(zSteps - 1, Math.max(0, Math.floor(v)));
  const a = u - i,
    b = v - j,
    n = xSteps + 1,
    k = j * n + i;
  const height =
    a + b <= 1
      ? positions.getY(k) * (1 - a - b) + positions.getY(k + 1) * a + positions.getY(k + n) * b
      : positions.getY(k + n + 1) * (a + b - 1) +
        positions.getY(k + n) * (1 - a) +
        positions.getY(k + 1) * (1 - b);
  const blend = terrainFade(0, 0.22, Math.abs(rise));
  return base + rise + (height - base - rise) * blend;
}
function ground(x, z) {
  x = wrapped(x);
  z = wrapped(z);
  return upliftedGround(x, z, surveyedGround(x, z), rockUplift(x, z));
}
function canClimbStep(x, z, nx, nz) {
  if (Math.abs(rockUplift(nx, nz)) < 0.35) return true;
  const change = ground(nx, nz) - ground(x, z);
  return change <= Math.hypot(wrapped(nx - x), wrapped(nz - z)) * 1.08 + 0.012;
}
class RealmGeometry {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.6, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    $('view').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb2b5a5);
    this.scene.fog = new THREE.FogExp2(0xb4bdad, 0.0062);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.06, 430);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.skylight = new THREE.HemisphereLight(0xd5e8fb, 0x787354, 1.32);
    this.scene.add(this.skylight);
    const sun = new THREE.DirectionalLight(0xffda9e, 2.05);
    sun.position.set(-70, 95, -45);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.055;
    sun.shadow.bias = -0.00035;
    this.matCache = new Map();
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.stone = new THREE.IcosahedronGeometry(1, 2);
    this.head = new THREE.SphereGeometry(1, 16, 12);
    this.log = new THREE.CylinderGeometry(1, 1, 1, 18);
    this.spire = new THREE.ConeGeometry(1, 1, 7);
    this.buckets = new Map();
    this.seed = 13777;
    this.obstacles = [];
    this.obstacleCells = new Map();
    this.trees = [];
    this.actors = new Map();
    this.tmp = new THREE.Object3D();
    this.prepareMaterials();
    this.build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  rnd() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  mat(c) {
    if (!this.matCache.has(c))
      this.matCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.94, flatShading: true }));
    return this.matCache.get(c);
  }
  matrix(x, y, z, w, h, d, ry = 0, rz = 0, rx = 0) {
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(rx, ry, rz);
    this.tmp.scale.set(w, h, d);
    this.tmp.updateMatrix();
    return this.tmp.matrix;
  }
  put(geo, c, x, y, z, w, h, d, ry = 0, rz = 0, rx = 0) {
    const k = [geo.uuid, c, Math.floor(x / 48), Math.floor(z / 48)].join('/');
    if (!this.buckets.has(k)) this.buckets.set(k, { geo, mat: this.mat(c), items: [] });
    this.buckets
      .get(k)
      .items.push(this.matrix(x, y + (this.buildHeight || 0), z, w, h, d, ry, rz, rx).clone());
  }
  block(x, y, z, w, h, d, c, ry = 0, rz = 0, rx = 0) {
    this.put(this.box, c, x, y, z, w, h, d, ry, rz, rx);
  }
  part(group, geo, c, x, y, z, w, h, d, rz = 0) {
    const o = new THREE.Mesh(geo, this.mat(c));
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    o.rotation.z = rz;
    o.castShadow = true;
    o.receiveShadow = true;
    group.add(o);
    return o;
  }
  bound(x, z, w, d) {
    const bounds = [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
    this.obstacles.push(bounds);
    for (let i = Math.floor(bounds[0] / 12); i <= Math.floor(bounds[1] / 12); i++)
      for (let j = Math.floor(bounds[2] / 12); j <= Math.floor(bounds[3] / 12); j++) {
        const key = this.cellKey(i, j);
        if (!this.obstacleCells.has(key)) this.obstacleCells.set(key, []);
        this.obstacleCells.get(key).push(bounds);
      }
  }
  cellKey(i, j) {
    const cells = PERIOD / 12;
    return (((i % cells) + cells) % cells) * cells + (((j % cells) + cells) % cells);
  }
  free(x, z, r = 0.34) {
    for (let i = Math.floor((x - r) / 12); i <= Math.floor((x + r) / 12); i++)
      for (let j = Math.floor((z - r) / 12); j <= Math.floor((z + r) / 12); j++) {
        const cell = this.obstacleCells.get(this.cellKey(i, j));
        if (!cell) continue;
        for (const [left, right, top, bottom] of cell) {
          const dx = wrapped(x - (left + right) / 2),
            dz = wrapped(z - (top + bottom) / 2);
          if (Math.abs(dx) < (right - left) / 2 + r && Math.abs(dz) < (bottom - top) / 2 + r) return false;
        }
      }
    return true;
  }
  resize() {
    this.refreshFrame = true;
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  build() {
    this.tiles = [];
    this.terrain();
    this.sky();
    for (let i = 0; i < 4; i++) {
      const [x, z] = CENTERS[i];
      this.buildHeight = ground(x, z);
      this.market(x - 6, z + 4);
      if (i === 0 || i === 2) {
        [
          [-12, -9],
          [9, -11],
          [15, 7],
          [-13, 11],
        ].forEach(([a, b], j) => this.house(x + a, z + b, j, i === 2));
      } else this.castle(x + 18, z, i === 3);
    }
    this.buildHeight = 0;
    for (let i = 0; i < 1100; i++) {
      const x = this.rnd() * 224 - 112,
        z = this.rnd() * 224 - 112;
      const q = zoneAt(x, z);
      if (
        Math.min(Math.abs(Math.abs(x) - 50), Math.abs(Math.abs(z) - 50)) < 3.5 ||
        !highTrackClear(x, z, 2.1) ||
        !this.treeSite(x, z) ||
        CENTERS.some(([a, b]) => Math.hypot(x - a, z - b) < (q === 2 ? 18 : 23))
      )
        continue;
      if (q === 2 || this.rnd() < 0.15) {
        this.plantTree({ x, z, y: ground(x, z), h: 9 + this.rnd() * 13, a: this.rnd() * 6.2, near: null }, 0.58);
      } else if (this.rnd() < 0.11) {
        const scale = 0.37 + this.rnd() * 0.85;
        this.fieldStone(x, z, scale, this.rnd() * Math.PI * 2);
      }
    }
    this.dressSettlements();
    this.pastures();
    for (const b of this.buckets.values()) {
      const m = new THREE.InstancedMesh(b.geo, b.mat, b.items.length);
      b.items.forEach((v, i) => m.setMatrixAt(i, v));
      m.computeBoundingSphere();
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
    this.buckets.clear();
    this.collectScenery();
    this.treeMeshes();
    this.makeWagon();
    this.makeWeapon();
    this.makeChair();
    this.makeMarker();
    this.atmosphere();
    this.makeRelics();
    this.makeWeather();
  }
  market(x, z) {
    for (const a of [-1, 1])
      for (const b of [-1, 1]) this.block(x + a * 1.75, 1.52, z + b, 0.13, 3.04, 0.13, 0x5a4434);
    for (let i = 0; i < 7; i++)
      this.block(x + (i - 3) * 0.56, 3.06, z, 0.58, 0.13, 2.7, i % 2 ? 0xd0bda0 : 0x934d39, 0, 0, -0.14);
    this.block(x, 0.85, z, 3.7, 1.25, 1.5, 0x826445);
    this.bound(x, z, 3.7, 1.5);
    for (let box = 0; box < 3; box++) {
      const cx = x - 1.17 + 1.11 * box;
      this.block(cx, 1.5, z, 0.99, 0.08, 0.76, 0x897454);
      for (const sign of [-1, 1]) {
        this.block(cx + sign * 0.49, 1.61, z, 0.06, 0.22, 0.8, 0x897454);
        this.block(cx, 1.6, z + sign * 0.37, 1, 0.19, 0.06, 0x897454);
      }
      for (let j = 0; j < 9; j++)
        this.put(
          this.head,
          [0x9e5437, 0x929654, 0xc4904c][box],
          cx + ((j % 3) - 1) * 0.25,
          1.66 + (j === 4 ? 0.12 : 0),
          z + (Math.floor(j / 3) - 1) * 0.21,
          0.135,
          0.122,
          0.13,
        );
    }
    this.block(x + 1.81, 2.34, z + 0.96, 0.62, 0.07, 0.09, 0x594431);
    this.block(x + 1.99, 2.09, z + 0.96, 0.042, 0.48, 0.04, 0x514f48);
    this.put(this.log, 0xad8e58, x + 1.99, 1.85, z + 0.96, 0.2, 0.05, 0.2);
  }
  castle(x, z, dark) {
    const color = dark ? 0x585956 : 0x969384,
      roof = dark ? 0x43494a : 0x545e61;
    const tower = (a, b, r, h) => {
      this.put(this.log, color, a, h / 2, b, r, h, r);
      this.bound(a, b, r * 1.5, r * 1.5);
      this.put(this.log, color, a, h - 0.3, b, r * 1.14, 0.9, r * 1.14);
      if (dark) {
        for (let i = 0; i < 7; i++) {
          if ((i + Math.round(a + b)) % 5 === 0) continue;
          const direction = (i * Math.PI * 2) / 7;
          this.block(
            a + r * Math.sin(direction),
            h + 0.32,
            b + r * Math.cos(direction),
            0.63,
            0.85,
            0.55,
            color,
            direction,
          );
        }
      } else
        for (let j = 0; j < 8; j++)
          this.block(
            a + Math.sin(j * 0.785) * r,
            h + 0.36,
            b + Math.cos(j * 0.785) * r,
            0.64,
            0.78,
            0.64,
            color,
          );
      this.block(a, h * 0.7, b + r * 0.94, 0.42, 1.35, 0.13, 0x3a3d37);
    };
    for (const a of [-12, 12]) {
      tower(x + a, z - 15, 2.55, 8);
      tower(x + a, z - 5, 1.85, 6);
      this.block(x + a, 2.4, z - 10, 0.95, 4.8, 10, color);
      this.bound(x + a, z - 10, 0.95, 10);
    }
    this.block(x, 2.9, z - 15, 24, 5.8, 1, color);
    this.bound(x, z - 15, 24, 1);
    for (let j = -11; j < 12; j += 2) this.block(x + j, 6.15, z - 15, 0.95, 0.85, 1, color);
    this.block(x, 4.3, z - 19, 9, 8.6, 7, color);
    this.bound(x, z - 19, 9, 7);
    this.put(this.spire, roof, x, 10.1, z - 19, 6.1, 4.5, 5, 0.7);
    for (const a of [-1, 1]) {
      this.block(x + a * 7.8, 2.3, z - 5, 7.6, 4.6, 0.96, color);
      this.bound(x + a * 7.8, z - 5, 7.6, 0.96);
      this.block(x + a * 4, 3, z - 5, 1.8, 6, 1.8, color);
      this.block(x + a * 4, 4.3, z - 3.97, 0.85, 2.1, 0.1, dark ? 0x4c2a29 : 0x873f31);
    }
    this.block(x, 5.4, z - 5, 8, 1.1, 1.3, color);
    this.block(x - 3.8, 7.3, z - 5, 0.1, 3, 0.1, 0x665644);
    this.block(x - 3.12, 8.2, z - 5, 1.3, 0.75, 0.07, dark ? 0x453941 : 0x974b38);
  }
  makeChair() {
    const chair = new THREE.Group();
    this.scene.add(chair);
    this.chair = chair;
    const rim = new THREE.TorusGeometry(0.43, 0.045, 6, 16);
    this.wheels = [-1, 1].map((side) => {
      const wheel = new THREE.Group();
      wheel.position.set(0.46 * side, 0.47, 0);
      const ring = this.part(wheel, rim, 0x514b3c, 0, 0, 0, 1, 1, 1);
      ring.rotation.y = Math.PI / 2;
      for (let j = 0; j < 5; j++) {
        const spoke = this.part(wheel, this.box, 0x967d54, 0, 0, 0, 0.045, 0.8, 0.045);
        spoke.rotation.x = (j * Math.PI) / 5;
      }
      chair.add(wheel);
      this.part(chair, this.box, 0x745637, 0.42 * side, 0.77, -0.1, 0.09, 0.09, 0.72);
      this.part(chair, this.box, 0x67523c, 0.26 * side, 0.24, -0.48, 0.32, 0.07, 0.29);
      return wheel;
    });
    this.part(chair, this.box, 0x594a37, 0, 0.52, 0, 0.78, 0.13, 0.63);
    this.part(chair, this.box, 0x594a37, 0, 0.77, 0.29, 0.78, 0.52, 0.12);
  }
  makeMarker() {
    this.marker = new THREE.Group();
    const arrow = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: 0xe9c18b }),
    );
    arrow.scale.y = 1.45;
    this.marker.add(arrow);
    this.scene.add(this.marker);
  }
  display(s, t, attackAnim, bob, target) {
    if (s.dungeon) {
      renderDungeon(this, s, t, attackAnim, bob);
      return;
    }
    if (this.arrow3d.parent !== this.scene) this.scene.add(this.arrow3d);
    if (s.inside) {
      this.roomView(s, t, bob);
      return;
    }
    if (this.camera.parent !== this.scene) this.scene.add(this.camera);
    const c = this.camera;
    this.placeScenery(s.x, s.z);
    c.position.set(
      s.x,
      walkingSurface(s.x, s.z) + (s.leg === 'lost' ? 0.78 : s.leg === 'chair' ? 1.32 : 1.71) + s.air + bob,
      s.z,
    );
    c.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    this.skyMesh.position.copy(c.position);
    this.chair.visible = s.leg === 'chair';
    if (this.chair.visible) {
      this.chair.position.set(s.x, walkingSurface(s.x, s.z), s.z);
      this.chair.rotation.y = s.yaw;
      this.wheels.forEach((w) => (w.rotation.x = (s.x + s.z) / 0.43));
    }
    s.actors.forEach((a) => {
      let m = this.actors.get(a.id);
      if (!m) {
        m = this.person(a.kind, a.tag);
        m.userData.groundShadow = footShade();
        this.scene.add(m.userData.groundShadow);
        if (a.hp <= 0) m.userData.fellAt = t - 3;
        this.actors.set(a.id, m);
      }
      if (a.hp <= 0 && m.userData.fellAt == null) m.userData.fellAt = t;
      const fall = a.hp <= 0 ? Math.min(1, (t - m.userData.fellAt) * 3) : 0;
      m.position.set(nearest(a.x, s.x), walkingSurface(a.x, a.z), nearest(a.z, s.z));
      const range = distance(a, s);
      m.visible = range < 85;
      const contact = m.userData.groundShadow;
      contact.visible = range < 30;
      if (contact.visible) {
        contact.rotation.y = a.angle || 0;
        contact.scale.set(0.78 + fall * 0.16, 1, 0.66 + fall * 1.13);
        const offset = -0.62 * fall;
        contact.position.set(
          m.position.x + offset * Math.sin(a.angle || 0),
          walkingSurface(a.x, a.z) + 0.026,
          m.position.z + offset * Math.cos(a.angle || 0),
        );
      }
      m.rotation.set(0, a.angle || 0, 0);
      if (m.visible) animateCastActor(m, a, t, a.hp <= 0 && t - m.userData.fellAt > 2.5);
    });
    for (const [id, m] of this.actors)
      if (!s.actors.some((a) => a.id === id)) {
        this.scene.remove(m, m.userData.groundShadow);
        releaseCharacter(m);
        this.actors.delete(id);
      }
    const w = s.wagon;
    this.wagon.position.set(nearest(w.x, s.x), walkingSurface(w.x, w.z), nearest(w.z, s.z));
    this.wagon.rotation.y = w.angle;
    this.marker.visible = !!target;
    if (target) {
      this.marker.position.set(
        nearest(target.x, s.x),
        ground(target.x, target.z) + 3.8 + 0.18 * Math.sin(t * 2),
        nearest(target.z, s.z),
      );
      this.marker.rotation.y = t;
    }
    this.animateDetails(s, t, attackAnim, bob);
    if (typeof frameHeroCamera === 'function') frameHeroCamera(this, s, t, attackAnim);
    if (s.delivery) setDeliveryCamera(this, s, t);
    updateFieldEffects(this, s, t);
    this.updateRiverMirror(s, t, c);
    drawExploration(this,s,t);
    drawHunts(this,s,t);
    drawDragon(this,s,t);
    this.renderer.render(this.scene, c);
  }
  clearPeople() {
    for (const m of this.actors.values()) {
      this.scene.remove(m, m.userData.groundShadow);
      releaseCharacter(m);
    }
    this.actors.clear();
  }
}
