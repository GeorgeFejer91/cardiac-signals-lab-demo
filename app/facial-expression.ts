// Reused from GeorgeFejer91/minimal-social-threat-webxr under its MIT license.
// Canonical project-authored cubic-Bezier facial geometry; not a validated emotion stimulus.

export const BASE_FACE_EMOTIONS = [
  "neutral",
  "happiness",
  "sadness",
  "fear",
  "anger",
  "surprise",
  "disgust",
] as const;

export type BaseFaceEmotion = (typeof BASE_FACE_EMOTIONS)[number];
export type ScenarioExpression = "calm" | "alert" | "afraid" | "angry";

export interface FacePoint {
  x: number;
  y: number;
}

export interface CubicSegment {
  control1: FacePoint;
  control2: FacePoint;
  to: FacePoint;
}

export interface SvgFeaturePath {
  start: FacePoint;
  segments: readonly CubicSegment[];
  closed: boolean;
}

export type FaceFeatureName =
  | "leftBrow"
  | "rightBrow"
  | "leftEye"
  | "rightEye"
  | "leftPupil"
  | "rightPupil"
  | "nose"
  | "mouth";

export type FaceGeometry = Record<FaceFeatureName, SvgFeaturePath>;

export interface FaceMorph {
  from: BaseFaceEmotion;
  to: BaseFaceEmotion;
  progress: number;
}

export interface SphereFaceProjection {
  horizontalArc: number;
  verticalArc: number;
}

export interface FaceSvgOptions {
  stroke?: string;
  eyeFill?: string;
  title?: string;
  description?: string;
}

export interface TriangleMeshData {
  positions: number[];
  indices: number[];
}

export interface SphereFaceMeshData {
  strokes: TriangleMeshData;
  eyeFills: TriangleMeshData;
  darkFills: TriangleMeshData;
}

export const DEFAULT_SPHERE_FACE_PROJECTION: Readonly<SphereFaceProjection> = Object.freeze({
  horizontalArc: Math.PI * 0.37,
  verticalArc: Math.PI * 0.31,
});

export const FACE_FEATURE_NAMES: readonly FaceFeatureName[] = [
  "leftBrow",
  "rightBrow",
  "leftEye",
  "rightEye",
  "leftPupil",
  "rightPupil",
  "nose",
  "mouth",
];

const KAPPA = 0.5522847498307936;

function point(x: number, y: number): FacePoint {
  return { x, y };
}

function segment(
  control1X: number,
  control1Y: number,
  control2X: number,
  control2Y: number,
  toX: number,
  toY: number,
): CubicSegment {
  return {
    control1: point(control1X, control1Y),
    control2: point(control2X, control2Y),
    to: point(toX, toY),
  };
}

function brow(startX: number, startY: number, endX: number, endY: number, archY: number): SvgFeaturePath {
  const width = endX - startX;
  return {
    start: point(startX, startY),
    segments: [segment(startX + width * 0.3, archY, startX + width * 0.7, archY, endX, endY)],
    closed: false,
  };
}

function ellipse(cx: number, cy: number, rx: number, ry: number, rotation = 0): SvgFeaturePath {
  const rotate = (x: number, y: number) => {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return point(cx + x * cosine - y * sine, cy + x * sine + y * cosine);
  };
  const left = rotate(-rx, 0);
  const top = rotate(0, -ry);
  const right = rotate(rx, 0);
  const bottom = rotate(0, ry);
  const leftTop1 = rotate(-rx, -ry * KAPPA);
  const leftTop2 = rotate(-rx * KAPPA, -ry);
  const rightTop1 = rotate(rx * KAPPA, -ry);
  const rightTop2 = rotate(rx, -ry * KAPPA);
  const rightBottom1 = rotate(rx, ry * KAPPA);
  const rightBottom2 = rotate(rx * KAPPA, ry);
  const leftBottom1 = rotate(-rx * KAPPA, ry);
  const leftBottom2 = rotate(-rx, ry * KAPPA);
  return {
    start: left,
    segments: [
      { control1: leftTop1, control2: leftTop2, to: top },
      { control1: rightTop1, control2: rightTop2, to: right },
      { control1: rightBottom1, control2: rightBottom2, to: bottom },
      { control1: leftBottom1, control2: leftBottom2, to: left },
    ],
    closed: true,
  };
}

function nose(
  startX: number,
  startY: number,
  middleX: number,
  middleY: number,
  endX: number,
  endY: number,
  bend = 0.07,
): SvgFeaturePath {
  return {
    start: point(startX, startY),
    segments: [
      segment(startX - bend, startY + 0.06, middleX - bend, middleY - 0.04, middleX, middleY),
      segment(middleX + bend, middleY + 0.02, endX + bend, endY - 0.02, endX, endY),
    ],
    closed: false,
  };
}

function mouth(
  leftX: number,
  leftY: number,
  topY: number,
  rightX: number,
  rightY: number,
  bottomY: number,
  topX = 0,
  bottomX = 0,
): SvgFeaturePath {
  const topWidth = (topX - leftX) * 0.56;
  const rightTopWidth = (rightX - topX) * 0.44;
  const bottomWidth = (bottomX - rightX) * 0.56;
  const leftBottomWidth = (leftX - bottomX) * 0.44;
  return {
    start: point(leftX, leftY),
    segments: [
      segment(leftX + topWidth, leftY, topX - rightTopWidth, topY, topX, topY),
      segment(topX + rightTopWidth, topY, rightX - topWidth, rightY, rightX, rightY),
      segment(rightX + bottomWidth, rightY, bottomX - leftBottomWidth, bottomY, bottomX, bottomY),
      segment(bottomX + leftBottomWidth, bottomY, leftX - bottomWidth, leftY, leftX, leftY),
    ],
    closed: true,
  };
}

function face(overrides: Partial<FaceGeometry>): FaceGeometry {
  const neutral = {
    leftBrow: brow(-0.68, -0.49, -0.14, -0.49, -0.53),
    rightBrow: brow(0.14, -0.49, 0.68, -0.49, -0.53),
    leftEye: ellipse(-0.39, -0.23, 0.2, 0.11),
    rightEye: ellipse(0.39, -0.23, 0.2, 0.11),
    leftPupil: ellipse(-0.39, -0.22, 0.052, 0.065),
    rightPupil: ellipse(0.39, -0.22, 0.052, 0.065),
    nose: nose(0, -0.08, -0.055, 0.11, 0.065, 0.19),
    mouth: mouth(-0.34, 0.38, 0.35, 0.34, 0.38, 0.42),
  } satisfies FaceGeometry;
  return { ...neutral, ...overrides };
}

// These prototypes are compact geometric approximations of recurring FACS
// configurations. They are evidence-grounded design targets, not normed stimuli.
export const FACE_PROTOTYPES: Readonly<Record<BaseFaceEmotion, FaceGeometry>> = Object.freeze({
  neutral: face({}),
  // AU 6/12/25: narrowed eyes, raised lip corners, parted lips.
  happiness: face({
    leftEye: ellipse(-0.39, -0.2, 0.21, 0.068, -0.04),
    rightEye: ellipse(0.39, -0.2, 0.21, 0.068, 0.04),
    leftPupil: ellipse(-0.39, -0.195, 0.046, 0.045),
    rightPupil: ellipse(0.39, -0.195, 0.046, 0.045),
    mouth: mouth(-0.47, 0.3, 0.39, 0.47, 0.3, 0.55),
  }),
  // AU 1/4/15/17: raised inner brows and depressed lip corners.
  sadness: face({
    leftBrow: brow(-0.68, -0.44, -0.14, -0.59, -0.61),
    rightBrow: brow(0.14, -0.59, 0.68, -0.44, -0.61),
    leftEye: ellipse(-0.39, -0.21, 0.2, 0.105, -0.06),
    rightEye: ellipse(0.39, -0.21, 0.2, 0.105, 0.06),
    mouth: mouth(-0.4, 0.52, 0.36, 0.4, 0.52, 0.45),
  }),
  // AU 1/2/4/5/20/25: tense raised brows, wide eyes, stretched open mouth.
  fear: face({
    leftBrow: brow(-0.69, -0.59, -0.12, -0.63, -0.7),
    rightBrow: brow(0.12, -0.63, 0.69, -0.59, -0.7),
    leftEye: ellipse(-0.39, -0.2, 0.21, 0.19),
    rightEye: ellipse(0.39, -0.2, 0.21, 0.19),
    leftPupil: ellipse(-0.39, -0.18, 0.05, 0.075),
    rightPupil: ellipse(0.39, -0.18, 0.05, 0.075),
    nose: nose(0, -0.06, -0.045, 0.12, 0.055, 0.2),
    mouth: mouth(-0.46, 0.42, 0.28, 0.46, 0.42, 0.6),
  }),
  // AU 4/7/24: lowered converging brows, tightened lids, pressed lips.
  anger: face({
    leftBrow: brow(-0.7, -0.54, -0.12, -0.32, -0.5),
    rightBrow: brow(0.12, -0.32, 0.7, -0.54, -0.5),
    leftEye: ellipse(-0.39, -0.19, 0.21, 0.075, 0.08),
    rightEye: ellipse(0.39, -0.19, 0.21, 0.075, -0.08),
    leftPupil: ellipse(-0.36, -0.18, 0.05, 0.045),
    rightPupil: ellipse(0.36, -0.18, 0.05, 0.045),
    mouth: mouth(-0.4, 0.48, 0.4, 0.4, 0.48, 0.51),
  }),
  // AU 1/2/5/25/26: raised brows, wide eyes, rounded open mouth.
  surprise: face({
    leftBrow: brow(-0.68, -0.65, -0.14, -0.66, -0.72),
    rightBrow: brow(0.14, -0.66, 0.68, -0.65, -0.72),
    leftEye: ellipse(-0.39, -0.2, 0.21, 0.205),
    rightEye: ellipse(0.39, -0.2, 0.21, 0.205),
    leftPupil: ellipse(-0.39, -0.18, 0.052, 0.072),
    rightPupil: ellipse(0.39, -0.18, 0.052, 0.072),
    mouth: mouth(-0.23, 0.45, 0.2, 0.23, 0.45, 0.7),
  }),
  // AU 9/10/17: nose wrinkle, raised upper lip, lower-face emphasis.
  disgust: face({
    leftBrow: brow(-0.68, -0.46, -0.14, -0.38, -0.49),
    rightBrow: brow(0.14, -0.38, 0.68, -0.46, -0.49),
    leftEye: ellipse(-0.39, -0.18, 0.2, 0.072, 0.04),
    rightEye: ellipse(0.39, -0.18, 0.2, 0.072, -0.04),
    leftPupil: ellipse(-0.39, -0.175, 0.045, 0.042),
    rightPupil: ellipse(0.39, -0.175, 0.045, 0.042),
    nose: nose(-0.03, -0.08, -0.13, 0.12, 0.1, 0.17, 0.13),
    mouth: mouth(-0.42, 0.49, 0.28, 0.42, 0.36, 0.55, -0.07, 0.08),
  }),
});

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function smoothMorphProgress(value: number) {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

function mixPoint(from: FacePoint, to: FacePoint, progress: number): FacePoint {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function interpolatePath(from: SvgFeaturePath, to: SvgFeaturePath, progress: number): SvgFeaturePath {
  if (from.segments.length !== to.segments.length || from.closed !== to.closed) {
    throw new Error("Facial SVG paths must share topology before they can be morphed.");
  }
  return {
    start: mixPoint(from.start, to.start, progress),
    segments: from.segments.map((fromSegment, index) => {
      const toSegment = to.segments[index];
      return {
        control1: mixPoint(fromSegment.control1, toSegment.control1, progress),
        control2: mixPoint(fromSegment.control2, toSegment.control2, progress),
        to: mixPoint(fromSegment.to, toSegment.to, progress),
      };
    }),
    closed: from.closed,
  };
}

export function interpolateFaceGeometry(
  from: FaceGeometry,
  to: FaceGeometry,
  progress: number,
  eased = true,
): FaceGeometry {
  const amount = eased ? smoothMorphProgress(progress) : clamp01(progress);
  if (amount === 0) return from;
  if (amount === 1) return to;
  return Object.fromEntries(FACE_FEATURE_NAMES.map((name) => [
    name,
    interpolatePath(from[name], to[name], amount),
  ])) as FaceGeometry;
}

export function morphFace({ from, to, progress }: FaceMorph): FaceGeometry {
  return interpolateFaceGeometry(FACE_PROTOTYPES[from], FACE_PROTOTYPES[to], progress);
}

export function blendFaceEmotions(weights: Partial<Record<BaseFaceEmotion, number>>): FaceGeometry {
  const active = BASE_FACE_EMOTIONS
    .map((emotion) => ({ emotion, weight: Math.max(0, weights[emotion] ?? 0) }))
    .filter((item) => item.weight > 0);
  const total = active.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return FACE_PROTOTYPES.neutral;
  let accumulatedWeight = active[0].weight;
  let result = FACE_PROTOTYPES[active[0].emotion];
  for (const item of active.slice(1)) {
    const nextWeight = accumulatedWeight + item.weight;
    result = interpolateFaceGeometry(result, FACE_PROTOTYPES[item.emotion], item.weight / nextWeight, false);
    accumulatedWeight = nextWeight;
  }
  return result;
}

const CALM_FACE = interpolateFaceGeometry(FACE_PROTOTYPES.neutral, FACE_PROTOTYPES.happiness, 0.68);

export function scenarioFaceGeometry(expression: ScenarioExpression, fear: number): FaceGeometry {
  if (expression === "calm") return CALM_FACE;
  if (expression === "alert") {
    return interpolateFaceGeometry(CALM_FACE, FACE_PROTOTYPES.surprise, clamp01(fear / 0.46));
  }
  if (expression === "afraid") {
    return interpolateFaceGeometry(FACE_PROTOTYPES.surprise, FACE_PROTOTYPES.fear, clamp01((fear - 0.46) / 0.54));
  }
  return FACE_PROTOTYPES.anger;
}

function formatNumber(value: number) {
  return Number(value.toFixed(4)).toString();
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function featureToSvgPath(feature: SvgFeaturePath) {
  const segments = feature.segments.map((item) => (
    `C ${formatNumber(item.control1.x)} ${formatNumber(item.control1.y)} ${formatNumber(item.control2.x)} ${formatNumber(item.control2.y)} ${formatNumber(item.to.x)} ${formatNumber(item.to.y)}`
  ));
  return `M ${formatNumber(feature.start.x)} ${formatNumber(feature.start.y)} ${segments.join(" ")}${feature.closed ? " Z" : ""}`;
}

export function faceGeometryToSvg(geometry: FaceGeometry, options: string | FaceSvgOptions = {}) {
  const resolved = typeof options === "string" ? { stroke: options } : options;
  const stroke = resolved.stroke ?? "#17231e";
  const eyeFill = resolved.eyeFill ?? "#effff7";
  const accessibleName = resolved.title ? `<title>${escapeXml(resolved.title)}</title>` : "";
  const accessibleDescription = resolved.description ? `<desc>${escapeXml(resolved.description)}</desc>` : "";
  const paths = FACE_FEATURE_NAMES.map((name) => {
    const fill = name === "mouth" || name.endsWith("Pupil") ? stroke : name.endsWith("Eye") ? eyeFill : "none";
    return `<path data-feature="${name}" d="${featureToSvgPath(geometry[name])}" fill="${fill}" stroke="${stroke}" />`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="-1 -1 2 2" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision">${accessibleName}${accessibleDescription}<g stroke-width="0.055" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

export function faceGeometryToSphereSvg(
  geometry: FaceGeometry,
  projection: SphereFaceProjection = DEFAULT_SPHERE_FACE_PROJECTION,
  options: string | FaceSvgOptions = {},
) {
  const resolved = typeof options === "string" ? { stroke: options } : options;
  const stroke = resolved.stroke ?? "#17231e";
  const eyeFill = resolved.eyeFill ?? "#effff7";
  const accessibleName = resolved.title ? `<title>${escapeXml(resolved.title)}</title>` : "";
  const accessibleDescription = resolved.description ? `<desc>${escapeXml(resolved.description)}</desc>` : "";
  const scaleX = projection.horizontalArc / Math.PI;
  const scaleY = projection.verticalArc / Math.PI;
  const paths = FACE_FEATURE_NAMES.map((name) => {
    const fill = name === "mouth" || name.endsWith("Pupil") ? stroke : name.endsWith("Eye") ? eyeFill : "none";
    return `<path data-feature="${name}" d="${featureToSvgPath(geometry[name])}" fill="${fill}" stroke="${stroke}" />`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 2 1" preserveAspectRatio="none" shape-rendering="geometricPrecision">${accessibleName}${accessibleDescription}<g transform="translate(0.5 0.5) scale(${formatNumber(scaleX)} ${formatNumber(scaleY)})" stroke-width="0.055" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}

export function drawFaceGeometry(
  context: CanvasRenderingContext2D,
  geometry: FaceGeometry,
  centerX: number,
  centerY: number,
  scaleX: number,
  scaleY = scaleX,
  stroke = "#17231e",
) {
  context.save();
  context.translate(centerX, centerY);
  context.scale(scaleX, scaleY);
  context.lineWidth = 0.055;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = stroke;

  for (const name of FACE_FEATURE_NAMES) {
    const path = new Path2D(featureToSvgPath(geometry[name]));
    if (name === "mouth" || name.endsWith("Pupil")) {
      context.fillStyle = stroke;
      context.fill(path);
    } else if (name.endsWith("Eye")) {
      context.fillStyle = "rgba(239, 255, 247, .88)";
      context.fill(path);
      context.stroke(path);
    } else {
      context.stroke(path);
    }
  }
  context.restore();
}

export function facePointToSphereUv(
  value: FacePoint,
  projection: SphereFaceProjection = DEFAULT_SPHERE_FACE_PROJECTION,
) {
  return {
    // Three.js SphereGeometry places local +Z at u=0.25. Keeping the facial
    // center there preserves the same forward axis as the former +Z plane.
    u: 0.25 + (value.x * projection.horizontalArc) / (Math.PI * 2),
    v: 0.5 - (value.y * projection.verticalArc) / Math.PI,
  };
}

export function facePointToSphere(
  value: FacePoint,
  radius = 1,
  projection: SphereFaceProjection = DEFAULT_SPHERE_FACE_PROJECTION,
) {
  const longitude = value.x * projection.horizontalArc;
  const latitude = -value.y * projection.verticalArc;
  const latitudeRadius = Math.cos(latitude) * radius;
  const vertical = Math.sin(latitude) * radius;
  return {
    x: Math.sin(longitude) * latitudeRadius,
    y: Object.is(vertical, -0) ? 0 : vertical,
    z: Math.cos(longitude) * latitudeRadius,
  };
}

function cubicPoint(start: FacePoint, curve: CubicSegment, progress: number): FacePoint {
  const inverse = 1 - progress;
  const inverseSquared = inverse * inverse;
  const progressSquared = progress * progress;
  return {
    x: inverseSquared * inverse * start.x
      + 3 * inverseSquared * progress * curve.control1.x
      + 3 * inverse * progressSquared * curve.control2.x
      + progressSquared * progress * curve.to.x,
    y: inverseSquared * inverse * start.y
      + 3 * inverseSquared * progress * curve.control1.y
      + 3 * inverse * progressSquared * curve.control2.y
      + progressSquared * progress * curve.to.y,
  };
}

export function sampleSvgFeature(feature: SvgFeaturePath, subdivisions = 24): FacePoint[] {
  const steps = Math.max(2, Math.floor(subdivisions));
  const points = [feature.start];
  let start = feature.start;
  for (const curve of feature.segments) {
    for (let index = 1; index <= steps; index += 1) {
      points.push(cubicPoint(start, curve, index / steps));
    }
    start = curve.to;
  }
  if (feature.closed && points.length > 1) {
    const last = points.at(-1)!;
    if (Math.hypot(last.x - points[0].x, last.y - points[0].y) < 1e-8) points.pop();
  }
  return points;
}

function appendSphereVertex(
  target: TriangleMeshData,
  value: FacePoint,
  radius: number,
  projection: SphereFaceProjection,
) {
  const mapped = facePointToSphere(value, radius, projection);
  target.positions.push(mapped.x, mapped.y, mapped.z);
  return target.positions.length / 3 - 1;
}

function triangleCross(a: FacePoint, b: FacePoint, c: FacePoint) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function polygonSignedArea(points: readonly FacePoint[]) {
  let doubledArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    doubledArea += points[index].x * next.y - next.x * points[index].y;
  }
  return doubledArea * 0.5;
}

function pointInTriangle(value: FacePoint, a: FacePoint, b: FacePoint, c: FacePoint) {
  const first = triangleCross(a, b, value);
  const second = triangleCross(b, c, value);
  const third = triangleCross(c, a, value);
  const epsilon = 1e-12;
  const hasNegative = first < -epsilon || second < -epsilon || third < -epsilon;
  const hasPositive = first > epsilon || second > epsilon || third > epsilon;
  return !(hasNegative && hasPositive);
}

function triangulatePolygon(points: readonly FacePoint[]) {
  if (points.length < 3) return [];
  const orientation = polygonSignedArea(points) >= 0 ? 1 : -1;
  const remaining = points.map((_, index) => index);
  const triangles: number[] = [];
  let guard = points.length * points.length;
  while (remaining.length > 3 && guard > 0) {
    let earFound = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const previous = remaining[(index - 1 + remaining.length) % remaining.length];
      const current = remaining[index];
      const next = remaining[(index + 1) % remaining.length];
      if (triangleCross(points[previous], points[current], points[next]) * orientation <= 1e-12) continue;
      const containsPoint = remaining.some((candidate) => (
        candidate !== previous
        && candidate !== current
        && candidate !== next
        && pointInTriangle(points[candidate], points[previous], points[current], points[next])
      ));
      if (containsPoint) continue;
      triangles.push(previous, current, next);
      remaining.splice(index, 1);
      earFound = true;
      break;
    }
    if (!earFound) throw new Error("Facial SVG fill path could not be triangulated without crossing its boundary.");
    guard -= 1;
  }
  if (remaining.length === 3) triangles.push(remaining[0], remaining[1], remaining[2]);
  return triangles;
}

function appendFill(
  target: TriangleMeshData,
  points: readonly FacePoint[],
  radius: number,
  projection: SphereFaceProjection,
) {
  if (points.length < 3) return;
  const ringStart = target.positions.length / 3;
  for (const value of points) appendSphereVertex(target, value, radius, projection);
  const triangles = triangulatePolygon(points);
  const reverseForSphere = polygonSignedArea(points) > 0;
  for (let index = 0; index < triangles.length; index += 3) {
    const first = ringStart + triangles[index];
    const second = ringStart + triangles[index + 1];
    const third = ringStart + triangles[index + 2];
    // Facial coordinates point down while the sphere's local Y points up.
    target.indices.push(first, reverseForSphere ? third : second, reverseForSphere ? second : third);
  }
}

function appendRoundCap(
  target: TriangleMeshData,
  center: FacePoint,
  radius2d: number,
  sphereRadius: number,
  projection: SphereFaceProjection,
) {
  const centerIndex = appendSphereVertex(target, center, sphereRadius, projection);
  const ringStart = target.positions.length / 3;
  const steps = 10;
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    appendSphereVertex(target, {
      x: center.x + Math.cos(angle) * radius2d,
      y: center.y + Math.sin(angle) * radius2d,
    }, sphereRadius, projection);
  }
  for (let index = 0; index < steps; index += 1) {
    const next = (index + 1) % steps;
    target.indices.push(centerIndex, ringStart + next, ringStart + index);
  }
}

function appendStroke(
  target: TriangleMeshData,
  points: readonly FacePoint[],
  closed: boolean,
  strokeWidth: number,
  radius: number,
  projection: SphereFaceProjection,
) {
  if (points.length < 2) return;
  const ringStart = target.positions.length / 3;
  const lastIndex = points.length - 1;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[closed ? (index - 1 + points.length) % points.length : Math.max(0, index - 1)];
    const next = points[closed ? (index + 1) % points.length : Math.min(lastIndex, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const length = Math.max(1e-8, Math.hypot(tangentX, tangentY));
    const offsetX = (-tangentY / length) * strokeWidth * 0.5;
    const offsetY = (tangentX / length) * strokeWidth * 0.5;
    appendSphereVertex(target, { x: points[index].x + offsetX, y: points[index].y + offsetY }, radius, projection);
    appendSphereVertex(target, { x: points[index].x - offsetX, y: points[index].y - offsetY }, radius, projection);
  }
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const next = (index + 1) % points.length;
    const left = ringStart + index * 2;
    const right = left + 1;
    const nextLeft = ringStart + next * 2;
    const nextRight = nextLeft + 1;
    target.indices.push(left, nextLeft, right, nextLeft, nextRight, right);
  }
  if (!closed) {
    appendRoundCap(target, points[0], strokeWidth * 0.5, radius, projection);
    appendRoundCap(target, points[lastIndex], strokeWidth * 0.5, radius, projection);
  }
}

export function faceGeometryToSphereMeshData(
  geometry: FaceGeometry,
  radius = 1,
  projection: SphereFaceProjection = DEFAULT_SPHERE_FACE_PROJECTION,
  subdivisions = 24,
  strokeWidth = 0.055,
): SphereFaceMeshData {
  const result: SphereFaceMeshData = {
    strokes: { positions: [], indices: [] },
    eyeFills: { positions: [], indices: [] },
    darkFills: { positions: [], indices: [] },
  };
  for (const name of FACE_FEATURE_NAMES) {
    const feature = geometry[name];
    const points = sampleSvgFeature(feature, subdivisions);
    if (feature.closed && name.endsWith("Eye")) appendFill(result.eyeFills, points, radius - 0.0007, projection);
    if (feature.closed && (name.endsWith("Pupil") || name === "mouth")) appendFill(result.darkFills, points, radius - 0.00035, projection);
    appendStroke(result.strokes, points, feature.closed, strokeWidth, radius, projection);
  }
  return result;
}

export function drawFaceOnSphereTexture(
  context: CanvasRenderingContext2D,
  geometry: FaceGeometry,
  width: number,
  height: number,
  projection: SphereFaceProjection = DEFAULT_SPHERE_FACE_PROJECTION,
  stroke = "#17231e",
) {
  const horizontalScale = (width * projection.horizontalArc) / (Math.PI * 2);
  const verticalScale = (height * projection.verticalArc) / Math.PI;
  drawFaceGeometry(context, geometry, width * 0.25, height * 0.5, horizontalScale, verticalScale, stroke);
}
