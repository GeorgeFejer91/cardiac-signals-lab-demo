'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  FACE_PROTOTYPES,
  faceGeometryToSphereMeshData,
  interpolateFaceGeometry,
  smoothMorphProgress,
  type BaseFaceEmotion,
  type TriangleMeshData,
} from './facial-expression';
import {
  type CueSource,
  type CueWindow,
  type FaceEmotion,
  type IncentiveMode,
  type ScenarioId,
  getCarRoundState,
  getCarTrial,
  getNumberRoundState,
  getNumberTrial,
  getScenario,
  isCueActive,
} from './scenarioCatalog';

type ThreeTableSceneProps = {
  scenarioId: ScenarioId;
  phase: number;
  incentive: IncentiveMode;
  trial: number;
  cueWindow: CueWindow;
  cueSource: CueSource;
};

type RuntimeState = { phase: number; incentive: IncentiveMode; cueWindow: CueWindow; cueSource: CueSource };
type FaceSurface = { group: THREE.Group; strokes: THREE.Mesh; eyeFills: THREE.Mesh; darkFills: THREE.Mesh; signature: string };
type MinimalAvatar = {
  root: THREE.Group;
  head: THREE.Group;
  face: FaceSurface;
  fromEmotion: FaceEmotion;
  toEmotion: FaceEmotion;
  morphStarted: number;
};

const TABLE_WIDTH = 7.1;
const TABLE_DEPTH = 4.1;
const TABLE_QA_MARGIN = 0.1;
const ACTION_BUTTON_GLOW_WIDTH = 1.98;
const ACTION_BUTTON_GLOW_DEPTH = 0.84;
const ACTION_BUTTON_FOOTPRINT_HALF_WIDTH = 0.9925;
const ACTION_BUTTON_FOOTPRINT_HALF_DEPTH = 0.4525;
const ACTION_BUTTON_MAX_PULSE_SCALE = 1.07;
const DESKTOP_ACTION_X = 2.05;
const NARROW_ACTION_X = 1.9;
const DESKTOP_CONTROL_SCALE = 1;
const NARROW_CONTROL_SCALE = 1.25;
const ACTION_BUTTON_SYMMETRY_TOLERANCE = 0.002;
const MAX_PANEL_AVATAR_OVERLAP_RATIO = 0.03;
const MAX_PANEL_PAIR_OVERLAP_RATIO = 0.001;
const PROJECTED_CANVAS_MARGIN_PX = 16;

type QaRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

function roundQa(value: number) {
  return Math.round(value * 1000) / 1000;
}

function overlapRatio(first: QaRect, second: QaRect) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.x, second.x));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y));
  const smallerArea = Math.min(first.width * first.height, second.width * second.height);
  return smallerArea > 0 ? (width * height) / smallerArea : 0;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function projectObjectBounds(
  id: string,
  object: THREE.Object3D,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  sceneRect: DOMRect,
) {
  if (!object.visible || object.scale.x < 0.05) return null;
  const spriteCorners: THREE.Vector3[] = [];
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const cameraUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  object.traverse((child) => {
    if (!(child instanceof THREE.Sprite) || !child.visible) return;
    const center = child.getWorldPosition(new THREE.Vector3());
    const scale = child.getWorldScale(new THREE.Vector3());
    const rotation = child.material.rotation ?? 0;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const xOffsets = [-child.center.x, 1 - child.center.x];
    const yOffsets = [-child.center.y, 1 - child.center.y];
    for (const xOffset of xOffsets) {
      for (const yOffset of yOffsets) {
        const unrotatedX = xOffset * Math.abs(scale.x);
        const unrotatedY = yOffset * Math.abs(scale.y);
        const rotatedX = cosine * unrotatedX - sine * unrotatedY;
        const rotatedY = sine * unrotatedX + cosine * unrotatedY;
        spriteCorners.push(center.clone()
          .addScaledVector(cameraRight, rotatedX)
          .addScaledVector(cameraUp, rotatedY)
          .project(camera));
      }
    }
  });
  const bounds = spriteCorners.length === 0 ? new THREE.Box3().setFromObject(object) : null;
  if (bounds?.isEmpty()) return null;
  const corners = spriteCorners.length > 0
    ? spriteCorners
    : [
        new THREE.Vector3(bounds!.min.x, bounds!.min.y, bounds!.min.z),
        new THREE.Vector3(bounds!.min.x, bounds!.min.y, bounds!.max.z),
        new THREE.Vector3(bounds!.min.x, bounds!.max.y, bounds!.min.z),
        new THREE.Vector3(bounds!.min.x, bounds!.max.y, bounds!.max.z),
        new THREE.Vector3(bounds!.max.x, bounds!.min.y, bounds!.min.z),
        new THREE.Vector3(bounds!.max.x, bounds!.min.y, bounds!.max.z),
        new THREE.Vector3(bounds!.max.x, bounds!.max.y, bounds!.min.z),
        new THREE.Vector3(bounds!.max.x, bounds!.max.y, bounds!.max.z),
      ].map((corner) => corner.project(camera));
  const canvasRect = canvas.getBoundingClientRect();
  const xs = corners.map((corner) => canvasRect.left + ((corner.x + 1) / 2) * canvas.clientWidth);
  const ys = corners.map((corner) => canvasRect.top + ((-corner.y + 1) / 2) * canvas.clientHeight);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  const canvasMargins = {
    left: x - canvasRect.left,
    top: y - canvasRect.top,
    right: canvasRect.right - right,
    bottom: canvasRect.bottom - bottom,
  };
  return {
    id,
    coordinateSpace: 'viewport-css' as const,
    projectionMethod: spriteCorners.length > 0 ? 'sprite-billboard-quad' : 'box3-corners',
    x: roundQa(x),
    y: roundQa(y),
    width: roundQa(right - x),
    height: roundQa(bottom - y),
    right: roundQa(right),
    bottom: roundQa(bottom),
    requiredCanvasMarginPx: PROJECTED_CANVAS_MARGIN_PX,
    canvasMargins: Object.fromEntries(Object.entries(canvasMargins).map(([key, value]) => [key, roundQa(value)])),
    insideCanvas: Object.values(canvasMargins).every((margin) => margin >= PROJECTED_CANVAS_MARGIN_PX),
    insideScene: x >= sceneRect.left - 1 && y >= sceneRect.top - 1
      && right <= sceneRect.right + 1 && bottom <= sceneRect.bottom + 1,
  };
}

function makeLabelTexture(
  label: string,
  width: number,
  height: number,
  options: { background: string; border: string; foreground: string; fontSize: number },
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = options.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = options.border;
  context.lineWidth = Math.max(5, Math.round(width * 0.015));
  context.strokeRect(14, 14, width - 28, height - 28);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = options.foreground;
  const lines = label.split('\n');
  context.font = `800 ${options.fontSize}px Aptos, sans-serif`;
  lines.forEach((line, index) => {
    context.fillText(line, width / 2, height / 2 + (index - (lines.length - 1) / 2) * options.fontSize * 1.08);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCard(label: string) {
  const group = new THREE.Group();
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: '#ff3049', emissive: '#ff1938', emissiveIntensity: 0, transparent: true, opacity: 0,
  });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.075, 1.44), glowMaterial);
  group.add(glow);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.07, 1.34),
    new THREE.MeshStandardMaterial({ color: '#20252b', roughness: 0.52, metalness: 0.12 }),
  );
  body.position.y = 0.004;
  group.add(body);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.87, 1.27),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(label, 320, 448, {
        background: '#f1eee7', border: '#252a31', foreground: '#1d2228', fontSize: 112,
      }),
      toneMapped: false,
    }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.043;
  group.add(face);
  group.userData.glow = glow;
  group.userData.glowMaterial = glowMaterial;
  return group;
}

function makeActionButton(label: string, accent: string) {
  const group = new THREE.Group();
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: '#ff3049', emissive: '#ff1938', emissiveIntensity: 0, transparent: true, opacity: 0,
  });
  const glow = new THREE.Group();
  const horizontalEdge = new THREE.BoxGeometry(ACTION_BUTTON_GLOW_WIDTH, 0.035, 0.065);
  const verticalEdge = new THREE.BoxGeometry(0.065, 0.035, ACTION_BUTTON_GLOW_DEPTH - 0.02);
  [-ACTION_BUTTON_GLOW_DEPTH / 2, ACTION_BUTTON_GLOW_DEPTH / 2].forEach((z) => {
    const edge = new THREE.Mesh(horizontalEdge, glowMaterial);
    edge.position.set(0, 0.086, z);
    glow.add(edge);
  });
  [-(ACTION_BUTTON_GLOW_WIDTH / 2 - 0.03), ACTION_BUTTON_GLOW_WIDTH / 2 - 0.03].forEach((x) => {
    const edge = new THREE.Mesh(verticalEdge, glowMaterial);
    edge.position.set(x, 0.086, 0);
    glow.add(edge);
  });
  group.add(glow);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.12, roughness: 0.46, metalness: 0.12 });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.78, 0.13, 0.68),
    bodyMaterial,
  );
  body.position.y = 0.005;
  group.add(body);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.68, 0.57),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(label, 640, 220, {
        background: accent, border: '#f6f2e9', foreground: '#ffffff', fontSize: label.includes('\n') ? 100 : 104,
      }),
      toneMapped: false,
    }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.076;
  group.add(face);
  const selectionMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.035, 0.045),
    new THREE.MeshBasicMaterial({ color: '#f8f4e9', toneMapped: false }),
  );
  selectionMarker.position.set(0, 0.091, 0.22);
  selectionMarker.visible = false;
  group.add(selectionMarker);
  group.userData.glow = glow;
  group.userData.glowMaterial = glowMaterial;
  group.userData.selectionMarker = selectionMarker;
  group.userData.buttonMaterial = bodyMaterial;
  return group;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function makeInfoPanel(
  title: string,
  rows: Array<{ label: string; value: string }>,
  accent: string,
  worldWidth: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = rows.length === 1 ? 220 : 330;
  const context = canvas.getContext('2d');
  if (context) {
    const singleRow = rows.length === 1;
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawRoundedRect(context, 12, 12, canvas.width - 24, canvas.height - 24, 18);
    context.fillStyle = 'rgba(10, 16, 20, 0.94)';
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 8;
    context.stroke();
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = accent;
    context.font = `800 ${singleRow ? 46 : 40}px Aptos, sans-serif`;
    context.fillText(title, 48, 54);
    const rowHeight = (canvas.height - 98) / rows.length;
    rows.forEach((row, index) => {
      const rowY = 98 + index * rowHeight;
      if (index > 0) {
        context.strokeStyle = 'rgba(255,255,255,.13)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(44, rowY);
        context.lineTo(canvas.width - 44, rowY);
        context.stroke();
      }
      context.fillStyle = '#91a09f';
      context.font = `700 ${singleRow ? 44 : 34}px Aptos, sans-serif`;
      context.fillText(row.label, 48, rowY + rowHeight * (singleRow ? 0.32 : 0.5));
      context.textAlign = 'right';
      context.fillStyle = '#f6f4ed';
      context.font = `800 ${singleRow ? 66 : 46}px Aptos, sans-serif`;
      context.fillText(row.value, canvas.width - 48, rowY + rowHeight * (singleRow ? 0.7 : 0.5));
      context.textAlign = 'left';
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(worldWidth, worldWidth * (canvas.height / canvas.width), 1);
  sprite.renderOrder = 5;
  const group = new THREE.Group();
  group.add(sprite);
  group.userData.spriteMaterial = material;
  return group;
}

function makeHeartSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, 160, 160);
    context.shadowColor = '#ff304f';
    context.shadowBlur = 24;
    context.fillStyle = '#ff4057';
    context.beginPath();
    context.moveTo(80, 136);
    context.bezierCurveTo(68, 119, 25, 92, 25, 56);
    context.bezierCurveTo(25, 29, 58, 18, 80, 45);
    context.bezierCurveTo(102, 18, 135, 29, 135, 56);
    context.bezierCurveTo(135, 92, 92, 119, 80, 136);
    context.closePath();
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 7;
  sprite.userData.spriteMaterial = material;
  return sprite;
}

function makePricePlate(label: string) {
  return makeInfoPanel('CAR PRICE', [{ label: 'FIXED PRICE', value: label }], '#e3b66b', 3);
}

function makeToyCar() {
  const group = new THREE.Group();
  const fallback = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#9ba8a4', roughness: 0.42, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: '#26383d', roughness: 0.25, metalness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#111519', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.3, 0.68), paint);
  body.position.y = 0.27;
  fallback.add(body);
  const bonnet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.6), paint);
  bonnet.position.set(-0.72, 0.34, 0);
  fallback.add(bonnet);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.56), glass);
  cabin.position.set(0.12, 0.53, 0);
  fallback.add(cabin);
  [-0.43, 0.43].forEach((x) => {
    [-0.37, 0.37].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18), rubber);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.15, z);
      fallback.add(wheel);
    });
  });
  group.add(fallback);
  group.userData.fallback = fallback;
  group.userData.paint = paint;
  group.userData.tintMaterials = [];
  return group;
}

function loadCarModel(container: THREE.Group, filename: string, onLoad: () => void) {
  const loader = new GLTFLoader();
  const url = new URL(`models/cars/${filename}`, document.baseURI).href;
  loader.load(url, (gltf) => {
    const model = gltf.scene;
    const initialBox = new THREE.Box3().setFromObject(model);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const longestHorizontalSide = Math.max(initialSize.x, initialSize.z, 0.001);
    model.scale.setScalar(1.9 / longestHorizontalSide);
    model.updateMatrixWorld(true);
    const normalizedBox = new THREE.Box3().setFromObject(model);
    const center = normalizedBox.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -normalizedBox.min.y, -center.z);
    model.rotation.y = Math.PI / 2;

    const tintMaterials: Array<{ material: THREE.MeshStandardMaterial; base: THREE.Color }> = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materials = sourceMaterials.map((source) => source.clone());
      object.material = Array.isArray(object.material) ? materials : materials[0];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          tintMaterials.push({ material, base: material.color.clone() });
        }
      });
    });

    container.userData.tintMaterials = tintMaterials;
    container.add(model);
    const fallback = container.userData.fallback as THREE.Group | undefined;
    if (fallback) fallback.visible = false;
    onLoad();
  });
}

function makeFaceSurface(): FaceSurface {
  const group = new THREE.Group();
  const layer = (color: number, renderOrder: number) => {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }),
    );
    mesh.renderOrder = renderOrder;
    group.add(mesh);
    return mesh;
  };
  const eyeFills = layer(0xeffff7, 1);
  const darkFills = layer(0x17231e, 2);
  const strokes = layer(0x17231e, 3);
  return { group, strokes, eyeFills, darkFills, signature: '' };
}

function updateFaceMesh(mesh: THREE.Mesh, data: TriangleMeshData) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (positions?.array.length === data.positions.length) {
    (positions.array as Float32Array).set(data.positions);
    positions.needsUpdate = true;
  } else {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  }
  const existingIndex = geometry.getIndex();
  if (existingIndex?.array.length === data.indices.length) {
    (existingIndex.array as Uint16Array | Uint32Array).set(data.indices);
    existingIndex.needsUpdate = true;
  } else {
    geometry.setIndex(data.indices);
  }
  geometry.computeBoundingSphere();
}

function renderFace(surface: FaceSurface, from: FaceEmotion, to: FaceEmotion, progress: number) {
  const eased = smoothMorphProgress(progress);
  const signature = `${from}:${to}:${eased.toFixed(3)}`;
  if (surface.signature === signature) return;
  surface.signature = signature;
  const geometry = interpolateFaceGeometry(
    FACE_PROTOTYPES[from as BaseFaceEmotion],
    FACE_PROTOTYPES[to as BaseFaceEmotion],
    eased,
    false,
  );
  const data = faceGeometryToSphereMeshData(geometry, 0.366, undefined, 32);
  updateFaceMesh(surface.strokes, data.strokes);
  updateFaceMesh(surface.eyeFills, data.eyeFills);
  updateFaceMesh(surface.darkFills, data.darkFills);
}

function makeAvatar(color: string, z: number, yaw: number) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.5, 5, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  body.position.y = 0.8;
  root.add(body);
  const head = new THREE.Group();
  head.position.y = 1.55;
  head.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 28, 20),
    new THREE.MeshStandardMaterial({ color: '#b68468', roughness: 0.88 }),
  ));
  const face = makeFaceSurface();
  renderFace(face, 'neutral', 'neutral', 1);
  head.add(face.group);
  root.add(head);
  root.position.set(0, 0, z);
  root.rotation.y = yaw;
  return { root, head, face, fromEmotion: 'neutral' as FaceEmotion, toEmotion: 'neutral' as FaceEmotion, morphStarted: 0 };
}

function updateAvatarFace(avatar: MinimalAvatar, emotion: FaceEmotion, elapsed: number) {
  if (avatar.toEmotion !== emotion) {
    avatar.fromEmotion = avatar.toEmotion;
    avatar.toEmotion = emotion;
    avatar.morphStarted = elapsed;
  }
  const progress = THREE.MathUtils.clamp((elapsed - avatar.morphStarted) / 0.72, 0, 1);
  renderFace(avatar.face, avatar.fromEmotion, avatar.toEmotion, progress);
}

function setEdgeGlow(object: THREE.Group, visible: boolean, beat: number) {
  const glow = object.userData.glow as THREE.Object3D | undefined;
  const material = object.userData.glowMaterial as THREE.MeshStandardMaterial | undefined;
  if (!glow || !material) return;
  glow.visible = visible;
  material.opacity = visible ? 0.54 + beat * 0.38 : 0;
  material.emissiveIntensity = visible ? 1.8 + beat * 5.2 : 0;
  glow.scale.setScalar(1 + beat * 0.07);
}

function setSelected(object: THREE.Group, selected: boolean) {
  const marker = object.userData.selectionMarker as THREE.Mesh | undefined;
  const material = object.userData.buttonMaterial as THREE.MeshStandardMaterial | undefined;
  if (marker) marker.visible = selected;
  if (material) material.emissiveIntensity += ((selected ? 0.42 : 0.12) - material.emissiveIntensity) * 0.2;
}

function animateScale(object: THREE.Object3D, visible: boolean, targetScale: number, speed = 0.12) {
  object.visible = visible || object.scale.x > 0.015;
  const target = visible ? targetScale : 0.001;
  object.scale.lerp(new THREE.Vector3(target, target, target), speed);
  if (!visible && object.scale.x < 0.015) object.visible = false;
}

export default function ThreeTableScene({ scenarioId, phase, incentive, trial, cueWindow, cueSource }: ThreeTableSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RuntimeState>({ phase, incentive, cueWindow, cueSource });

  useEffect(() => { stateRef.current = { phase, incentive, cueWindow, cueSource }; }, [phase, incentive, cueWindow, cueSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const definition = getScenario(scenarioId);
    let disposed = false;
    let lastSceneQaJson = '';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
    camera.position.set(7.4, 5.8, 8.3);
    let cameraBaseX = 7.4;
    let informationScale = 1;
    let sellerConditionScale = 0.7;
    let exactPanelScale = 0.67;
    let rangePanelScale = 1;
    let controlScale = DESKTOP_CONTROL_SCALE;
    camera.lookAt(0, 0.72, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene.add(new THREE.HemisphereLight('#e8fbff', '#18120f', 2.6));
    const key = new THREE.DirectionalLight('#fff1df', 4.4);
    key.position.set(2.8, 6, 4.5);
    scene.add(key);
    const red = new THREE.PointLight('#ff3853', 0, 8, 2);
    red.position.set(-1.3, 2.4, 1.2);
    scene.add(red);

    const tableMaterial = new THREE.MeshStandardMaterial({
      color: '#37423f',
      emissive: '#ff2545',
      emissiveIntensity: 0,
      roughness: 0.64,
      metalness: 0.12,
    });
    const table = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH, 0.24, TABLE_DEPTH), tableMaterial);
    table.position.y = 0.22;
    scene.add(table);

    // Player A is the far-side role (seller or informed player); Player B is the near-side role.
    const avatarYaw = 0.72;
    const avatarA = makeAvatar('#527b7d', -3.45, avatarYaw);
    const avatarB = makeAvatar('#805467', 3.45, Math.PI - avatarYaw);
    scene.add(avatarA.root, avatarB.root);

    const sellerHeart = scenarioId === 'cars' ? makeHeartSprite() : null;
    if (sellerHeart) {
      sellerHeart.position.set(0, 1.04, 0.32);
      sellerHeart.scale.setScalar(0.001);
      sellerHeart.visible = false;
      avatarA.root.add(sellerHeart);
    }

    const carTrial = getCarTrial(trial);
    const toyCar = scenarioId === 'cars' ? makeToyCar() : null;
    if (toyCar) {
      toyCar.position.set(0.85, 0.43, 0.34);
      toyCar.rotation.y = -0.34;
      toyCar.scale.setScalar(0.001);
      scene.add(toyCar);
      loadCarModel(toyCar, carTrial.model, () => {
        if (disposed) return;
        toyCar.rotation.y = -0.34;
      });
    }

    const initialCarRound = getCarRoundState(trial, incentive);
    const sellerBuy = scenarioId === 'cars' ? makeActionButton('RECOMMEND\nBUY', '#4b918c') : null;
    const sellerPass = scenarioId === 'cars' ? makeActionButton('RECOMMEND\nPASS', '#8d7444') : null;
    const buyerBuy = scenarioId === 'cars' ? makeActionButton('BUY', '#4b918c') : null;
    const buyerPass = scenarioId === 'cars' ? makeActionButton('PASS', '#8d7444') : null;
    const sellerCondition = scenarioId === 'cars'
      ? makeInfoPanel('SELLER ONLY', [
           { label: 'INSPECTION', value: carTrial.quality === 'BAD' ? 'BAD CAR' : 'GOOD CAR' },
        ], carTrial.quality === 'BAD' ? '#ff5369' : '#66dbc0', 3)
      : null;
    const conditionReveal = scenarioId === 'cars'
      ? makeInfoPanel('ROUND RESULT', [
          { label: 'CONDITION', value: carTrial.quality === 'BAD' ? 'BAD CAR' : 'GOOD CAR' },
          { label: 'BUYER', value: `${initialCarRound.buyerScore >= 0 ? '+' : ''}${initialCarRound.buyerScore}` },
          { label: 'SELLER', value: `${initialCarRound.sellerScore >= 0 ? '+' : ''}${initialCarRound.sellerScore}` },
        ], carTrial.quality === 'BAD' ? '#ff5369' : '#66dbc0', 3.4)
      : null;
    const pricePanel = scenarioId === 'cars'
      ? makePricePlate(carTrial.price)
      : null;
    const displayedCarBpm = cueSource === 'replay' ? carTrial.replayBpm : carTrial.hrBpm;
    const displayedActivation = cueSource === 'replay' ? carTrial.replayActivation : carTrial.activation;
    const displayedDeltaHr = cueSource === 'replay' ? carTrial.replayDeltaHr : carTrial.deltaHr;
    const physiologyPanel = scenarioId === 'cars' && cueSource !== 'hidden'
      ? makeInfoPanel(cueSource === 'replay' ? 'MATCHED REPLAY' : 'LIVE CARDIAC SIGNAL', [
          { label: 'HEART RATE', value: `${displayedCarBpm} BPM` },
          { label: 'ACTIVATION INDEX', value: `${displayedActivation} / 100` },
          { label: 'HR CHANGE', value: `${displayedDeltaHr >= 0 ? '+' : ''}${displayedDeltaHr} BPM` },
        ], '#ff5369', 3.5)
      : null;
    const carButtons = [sellerBuy, sellerPass, buyerBuy, buyerPass].filter((item): item is THREE.Group => Boolean(item));
    carButtons.forEach((button) => {
      button.scale.setScalar(0.001);
      scene.add(button);
    });
    const controlX = DESKTOP_ACTION_X;
    const farControlZ = -1.3;
    const nearControlZ = 1.3;
    sellerBuy?.position.set(-controlX, 0.4, farControlZ);
    sellerPass?.position.set(controlX, 0.4, farControlZ);
    buyerBuy?.position.set(controlX, 0.4, nearControlZ);
    buyerPass?.position.set(-controlX, 0.4, nearControlZ);
    if (sellerCondition) {
      sellerCondition.position.set(-1, 3.55, -0.72);
      sellerCondition.scale.setScalar(0.001);
      scene.add(sellerCondition);
    }
    if (conditionReveal) {
      conditionReveal.position.set(1.45, 3.95, -0.72);
      conditionReveal.scale.setScalar(0.001);
      scene.add(conditionReveal);
    }
    if (pricePanel) {
      pricePanel.position.set(-1.7, 2.2, 0.42);
      pricePanel.scale.setScalar(0.001);
      scene.add(pricePanel);
    }
    if (physiologyPanel) {
      physiologyPanel.position.set(1.45, 3.95, -0.72);
      physiologyPanel.scale.setScalar(0.001);
      scene.add(physiologyPanel);
    }

    const numberTrial = getNumberTrial(trial);
    const initialNumberRound = getNumberRoundState(trial, incentive);
    const exactPanel = scenarioId === 'numbers' ? makeInfoPanel('INFORMED ONLY', [{ label: 'EXACT TARGET', value: `${numberTrial.target}` }], '#66dcd0', 3) : null;
    const rangePanel = scenarioId === 'numbers' ? makeInfoPanel('LESS-INFORMED ONLY', [{ label: 'TARGET RANGE', value: numberTrial.coarse }], '#d6bb78', 3) : null;
    const strongA = scenarioId === 'numbers' ? makeActionButton('A', '#4b918c') : null;
    const strongB = scenarioId === 'numbers' ? makeActionButton('B', '#8d7444') : null;
    const weakA = scenarioId === 'numbers' ? makeActionButton('A', '#4b918c') : null;
    const weakB = scenarioId === 'numbers' ? makeActionButton('B', '#8d7444') : null;
    const numberOutcome = initialNumberRound.deceptionSucceeded ? 'SUCCEEDED' : initialNumberRound.deceptionResisted ? 'RESISTED' : initialNumberRound.strategicTruth ? 'TRUTHFUL' : 'ACCURATE';
    const targetReveal = scenarioId === 'numbers' ? makeInfoPanel('ROUND RESULT', [
      { label: 'TARGET', value: `${numberTrial.target}` },
      { label: 'CORRECT', value: numberTrial.correct },
      { label: 'OUTCOME', value: numberOutcome },
    ], '#66dcd0', 3.4) : null;
    const numberProps = [
      exactPanel, rangePanel, strongA, strongB, weakA, weakB, targetReveal,
    ].filter((item): item is THREE.Group => Boolean(item));
    numberProps.forEach((card) => {
      card.scale.setScalar(0.001);
      scene.add(card);
    });

    exactPanel?.position.set(1.72, 1.78, -0.96);
    rangePanel?.position.set(-1.72, 1.78, 0.96);
    strongA?.position.set(-controlX, 0.42, farControlZ);
    strongB?.position.set(controlX, 0.42, farControlZ);
    weakA?.position.set(controlX, 0.42, nearControlZ);
    weakB?.position.set(-controlX, 0.42, nearControlZ);
    targetReveal?.position.set(1.45, 3.95, -0.72);

    const optionCards = scenarioId === 'numbers'
      ? [`A\n${numberTrial.a}`, `B\n${numberTrial.b}`].map((label, index) => {
          const card = makeCard(label);
          card.position.set(index === 0 ? -0.78 : 0.78, 0.39, 0.02);
          card.scale.setScalar(0.001);
          scene.add(card);
          return card;
        })
      : [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const narrow = width <= 520;
      informationScale = narrow ? 1.24 : 1;
      sellerConditionScale = narrow ? 0.9 : 0.7;
      exactPanelScale = narrow ? 0.94 : 0.67;
      rangePanelScale = narrow ? 1 : 1;
      controlScale = narrow ? NARROW_CONTROL_SCALE : DESKTOP_CONTROL_SCALE;
      const activeControlX = narrow ? NARROW_ACTION_X : DESKTOP_ACTION_X;
      sellerBuy?.position.set(-activeControlX, sellerBuy.position.y, farControlZ);
      sellerPass?.position.set(activeControlX, sellerPass.position.y, farControlZ);
      buyerBuy?.position.set(activeControlX, buyerBuy.position.y, nearControlZ);
      buyerPass?.position.set(-activeControlX, buyerPass.position.y, nearControlZ);
      strongA?.position.set(-activeControlX, strongA.position.y, farControlZ);
      strongB?.position.set(activeControlX, strongB.position.y, farControlZ);
      weakA?.position.set(activeControlX, weakA.position.y, nearControlZ);
      weakB?.position.set(-activeControlX, weakB.position.y, nearControlZ);
      // Keep the private condition beside—but clear of—the seller, the price plate,
      // and the explanatory bubble at both capture aspect ratios.
      sellerCondition?.position.set(narrow ? 1.25 : 3.6, narrow ? 3.8 : 2.4, -0.72);
      pricePanel?.position.set(narrow ? -1.7 : -2, narrow ? 2.2 : 1.95, 0.42);
      physiologyPanel?.position.set(narrow ? -1.8 : -1.35, narrow ? 2.8 : 2.4, -0.72);
      conditionReveal?.position.set(narrow ? -1.8 : -1.35, narrow ? 2.8 : 2.4, -0.72);
      exactPanel?.position.set(narrow ? 1.7 : 3.2, narrow ? 3.95 : 2.5, narrow ? -0.96 : -1);
      rangePanel?.position.set(narrow ? -1.9 : -2.42, narrow ? 2.8 : 2.08, narrow ? 0.96 : 0.62);
      targetReveal?.position.set(narrow ? -1.8 : -1.3, narrow ? 2.8 : 2.4, -0.72);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const narrowness = Math.max(0, 1.12 - camera.aspect);
      const wideZoom = camera.aspect > 1.85 ? 0.84 : camera.aspect > 1.25 ? 0.92 : 1;
      const distanceScale = (1 + narrowness * 0.52) * wideZoom;
      cameraBaseX = 7.4 * distanceScale;
      camera.position.set(cameraBaseX, 5.8 * distanceScale, 8.3 * distanceScale);
      camera.fov = camera.aspect < 1 ? 39 : 35;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const clock = new THREE.Clock();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const neutralPaint = new THREE.Color('#9ba8a4');
    const goodPaint = new THREE.Color('#3a8e78');
    const badPaint = new THREE.Color('#a83e4d');

    renderer.setAnimationLoop(() => {
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;
      const cueVisible = isCueActive(state.phase, state.cueWindow, state.cueSource);
      const cueBpm = scenarioId === 'cars'
        ? (state.cueSource === 'replay' ? carTrial.replayBpm : carTrial.hrBpm)
        : (state.cueSource === 'replay' ? numberTrial.replayBpm : numberTrial.hrBpm);
      const beatRate = (cueBpm / 60) * Math.PI * 2;
      const beat = Math.max(
        Math.pow(Math.max(0, Math.sin(elapsed * beatRate)), reducedMotion ? 1 : 18),
        Math.pow(Math.max(0, Math.sin(elapsed * beatRate - 0.48)), reducedMotion ? 1 : 20) * 0.66,
      );
      const cardiacPhaseActive = scenarioId === 'cars' && cueVisible && (state.phase === 3 || state.phase === 4);
      const tablePulse = cardiacPhaseActive ? 0.08 + beat * 1.16 : 0;
      tableMaterial.emissiveIntensity += (tablePulse - tableMaterial.emissiveIntensity) * 0.28;
      red.intensity += (((cardiacPhaseActive ? 1.2 + beat * 12 : 0)) - red.intensity) * 0.2;

      if (sellerHeart) {
        sellerHeart.visible = cardiacPhaseActive || sellerHeart.scale.x > 0.01;
        const heartTarget = cardiacPhaseActive ? 0.27 + beat * 0.13 : 0.001;
        sellerHeart.scale.lerp(new THREE.Vector3(heartTarget, heartTarget, 1), 0.24);
        if (!cardiacPhaseActive && sellerHeart.scale.x < 0.01) sellerHeart.visible = false;
        const heartMaterial = sellerHeart.material as THREE.SpriteMaterial;
        heartMaterial.opacity = cardiacPhaseActive ? 0.68 + beat * 0.32 : 0;
      }

      if (scenarioId === 'cars' && toyCar && sellerBuy && sellerPass && buyerBuy && buyerPass) {
        animateScale(toyCar, true, 0.95, 0.1);
        if (pricePanel) animateScale(pricePanel, state.phase <= 2, informationScale, 0.14);
        if (sellerCondition) animateScale(sellerCondition, state.phase === 1 || state.phase === 2, sellerConditionScale, 0.14);
        if (physiologyPanel) {
          const physiologyVisible = cueVisible && (state.phase === 3 || state.phase === 4);
          animateScale(physiologyPanel, physiologyVisible, informationScale, 0.14);
        }
        toyCar.rotation.y = -0.34 + (reducedMotion ? 0 : Math.sin(elapsed * 0.35) * 0.025);
        const paint = toyCar.userData.paint as THREE.MeshStandardMaterial;
        const revealColor = carTrial.quality === 'BAD' ? badPaint : goodPaint;
        paint.color.lerp(state.phase === 5 ? revealColor : neutralPaint, 0.08);
        const tintMaterials = toyCar.userData.tintMaterials as Array<{ material: THREE.MeshStandardMaterial; base: THREE.Color }>;
        tintMaterials.forEach(({ material, base }) => {
          const revealMix = state.phase === 5 ? 0.42 : 0;
          const targetR = base.r + (revealColor.r - base.r) * revealMix;
          const targetG = base.g + (revealColor.g - base.g) * revealMix;
          const targetB = base.b + (revealColor.b - base.b) * revealMix;
          material.color.r += (targetR - material.color.r) * 0.08;
          material.color.g += (targetG - material.color.g) * 0.08;
          material.color.b += (targetB - material.color.b) * 0.08;
          material.roughness += (((state.phase === 5 && carTrial.quality === 'BAD') ? 0.92 : 0.58) - material.roughness) * 0.06;
        });
        toyCar.rotation.z += (((state.phase === 5 && carTrial.quality === 'BAD') ? -0.045 : 0) - toyCar.rotation.z) * 0.08;

        const carRound = getCarRoundState(trial, state.incentive);
        const sellerChoice = carRound.sellerAction;
        const buyerChoice = carRound.buyerAction;
        const selectedSeller = sellerChoice === 'BUY' ? sellerBuy : sellerPass;
        const selectedBuyer = buyerChoice === 'BUY' ? buyerBuy : buyerPass;
        [sellerBuy, sellerPass].forEach((button) => {
          animateScale(button, true, controlScale);
        });
        [buyerBuy, buyerPass].forEach((button) => {
          animateScale(button, true, controlScale);
        });
        const sellerPressedY = state.phase >= 3 ? 0.32 : 0.4;
        sellerBuy.position.y += ((state.phase >= 3 && selectedSeller === sellerBuy ? sellerPressedY : 0.4) - sellerBuy.position.y) * 0.14;
        sellerPass.position.y += ((state.phase >= 3 && selectedSeller === sellerPass ? sellerPressedY : 0.4) - sellerPass.position.y) * 0.14;
        buyerBuy.position.y += ((state.phase >= 4 && selectedBuyer === buyerBuy ? 0.32 : 0.4) - buyerBuy.position.y) * 0.14;
        buyerPass.position.y += ((state.phase >= 4 && selectedBuyer === buyerPass ? 0.32 : 0.4) - buyerPass.position.y) * 0.14;
        [sellerBuy, sellerPass, buyerBuy, buyerPass].forEach((button) => setEdgeGlow(button, false, beat));
        [sellerBuy, sellerPass].forEach((button) => setSelected(button, state.phase >= 3 && button === selectedSeller));
        [buyerBuy, buyerPass].forEach((button) => setSelected(button, state.phase >= 4 && button === selectedBuyer));
        setEdgeGlow(selectedSeller, cardiacPhaseActive, beat);
        if (conditionReveal) animateScale(conditionReveal, state.phase === 5, informationScale);
      }

      if (scenarioId === 'numbers' && exactPanel && rangePanel && strongA && strongB && weakA && weakB && targetReveal) {
        optionCards.forEach((card) => animateScale(card, true, 0.9));
        animateScale(exactPanel, state.phase === 1 || state.phase === 2, exactPanelScale);
        animateScale(rangePanel, state.phase === 1 || state.phase === 2, rangePanelScale);
        animateScale(targetReveal, state.phase === 5, informationScale);
        const initialStrong = numberTrial.correct === 'A' ? strongA : strongB;
        const initialWeak = numberTrial.weakInitial === 'A' ? weakA : weakB;
        const numberRound = getNumberRoundState(trial, state.incentive);
        const recommendedValue = numberRound.signal;
        const selectedStrong = recommendedValue === 'A' ? strongA : strongB;
        const selectedWeak = numberRound.weakFinal === 'A' ? weakA : weakB;

        [strongA, strongB, weakA, weakB].forEach((button) => {
          animateScale(button, state.phase >= 2, controlScale);
          setEdgeGlow(button, false, beat);
          setSelected(button, false);
        });
        const strongPressed = state.phase === 2 ? initialStrong : selectedStrong;
        const weakPressed = state.phase === 2 ? initialWeak : selectedWeak;
        [strongA, strongB].forEach((button) => {
          button.position.y += ((state.phase >= 2 && button === strongPressed ? 0.34 : 0.42) - button.position.y) * 0.14;
        });
        [weakA, weakB].forEach((button) => {
          button.position.y += ((state.phase >= 4 && button === weakPressed ? 0.34 : 0.42) - button.position.y) * 0.14;
        });
        if (state.phase === 2) {
          weakPressed.position.y += (0.34 - weakPressed.position.y) * 0.14;
        }
        [strongA, strongB].forEach((button) => setSelected(button, state.phase >= 2 && button === strongPressed));
        [weakA, weakB].forEach((button) => setSelected(button, (state.phase === 2 || state.phase >= 4) && button === weakPressed));
        setEdgeGlow(selectedStrong, cueVisible && state.phase >= 3 && state.phase <= 4, beat);
      }

      let expressionA = definition.expressionsA[state.phase];
      let expressionB = definition.expressionsB[state.phase];
      if (state.phase === 5) {
        if (scenarioId === 'cars') {
          const result = getCarRoundState(trial, state.incentive);
          if (result.deceptionSucceeded) {
            expressionA = 'happiness';
            expressionB = 'sadness';
          } else if (result.deceptionDetected) {
            expressionA = 'sadness';
            expressionB = 'happiness';
          } else if (result.car.quality === 'GOOD' && result.buyerAction === 'BUY') {
            expressionA = 'happiness';
            expressionB = 'happiness';
          } else {
            expressionA = 'neutral';
            expressionB = 'happiness';
          }
        } else {
          const result = getNumberRoundState(trial, state.incentive);
          if (result.deceptionSucceeded) {
            expressionA = 'happiness';
            expressionB = 'sadness';
          } else if (result.deceptionResisted) {
            expressionA = 'sadness';
            expressionB = 'happiness';
          } else {
            expressionA = state.incentive === 'cooperate' ? 'happiness' : 'neutral';
            expressionB = 'happiness';
          }
        }
      }
      updateAvatarFace(avatarA, expressionA, reducedMotion ? elapsed + 2 : elapsed);
      updateAvatarFace(avatarB, expressionB, reducedMotion ? elapsed + 2 : elapsed);
      avatarA.root.position.y = reducedMotion ? 0 : Math.sin(elapsed * 1.15) * 0.012;
      avatarB.root.position.y = reducedMotion ? 0 : Math.sin(elapsed * 1.15 + 1.2) * 0.012;
      camera.position.x = cameraBaseX + (reducedMotion ? 0 : Math.sin(elapsed * 0.16) * 0.08);
      camera.lookAt(0, 0.72, 0);
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const sceneElement = canvas.parentElement;
      if (sceneElement) {
        const canvasRect = canvas.getBoundingClientRect();
        const sceneRect = sceneElement.getBoundingClientRect();
        const canvasOffsetX = canvasRect.left - sceneRect.left;
        const canvasOffsetY = canvasRect.top - sceneRect.top;
        const writeHeadPosition = (player: 'a' | 'b', avatar: MinimalAvatar) => {
          const point = avatar.head.getWorldPosition(new THREE.Vector3()).project(camera);
          sceneElement.style.setProperty(`--head-${player}-x`, `${canvasOffsetX + ((point.x + 1) / 2) * canvas.clientWidth}px`);
          sceneElement.style.setProperty(`--head-${player}-y`, `${canvasOffsetY + ((-point.y + 1) / 2) * canvas.clientHeight}px`);
        };
        writeHeadPosition('a', avatarA);
        writeHeadPosition('b', avatarB);

        const tableBounds = {
          minX: -TABLE_WIDTH / 2,
          maxX: TABLE_WIDTH / 2,
          minZ: -TABLE_DEPTH / 2,
          maxZ: TABLE_DEPTH / 2,
          requiredMargin: TABLE_QA_MARGIN,
        };
        const buttonObjects: Array<{ id: string; object: THREE.Group; visible: boolean }> = [];
        if (scenarioId === 'cars' && sellerBuy && sellerPass && buyerBuy && buyerPass) {
          buttonObjects.push(
            { id: 'seller-recommend-buy', object: sellerBuy, visible: true },
            { id: 'seller-recommend-pass', object: sellerPass, visible: true },
            { id: 'buyer-buy', object: buyerBuy, visible: true },
            { id: 'buyer-pass', object: buyerPass, visible: true },
          );
        }
        if (scenarioId === 'numbers' && strongA && strongB && weakA && weakB) {
          const controlsVisible = state.phase >= 2;
          buttonObjects.push(
            { id: 'informed-a', object: strongA, visible: controlsVisible },
            { id: 'informed-b', object: strongB, visible: controlsVisible },
            { id: 'less-informed-a', object: weakA, visible: controlsVisible },
            { id: 'less-informed-b', object: weakB, visible: controlsVisible },
          );
        }
        const buttonContainment = buttonObjects.map(({ id, object, visible }) => {
          const halfWidth = ACTION_BUTTON_FOOTPRINT_HALF_WIDTH * controlScale * ACTION_BUTTON_MAX_PULSE_SCALE;
          const halfDepth = ACTION_BUTTON_FOOTPRINT_HALF_DEPTH * controlScale * ACTION_BUTTON_MAX_PULSE_SCALE;
          const bounds = {
            minX: object.position.x - halfWidth,
            maxX: object.position.x + halfWidth,
            minZ: object.position.z - halfDepth,
            maxZ: object.position.z + halfDepth,
          };
          const minimumMargin = Math.min(
            bounds.minX - tableBounds.minX,
            tableBounds.maxX - bounds.maxX,
            bounds.minZ - tableBounds.minZ,
            tableBounds.maxZ - bounds.maxZ,
          );
          return {
            id,
            visible,
            bounds: Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, roundQa(value)])),
            maximumPulseScale: ACTION_BUTTON_MAX_PULSE_SCALE,
            position: { x: roundQa(object.position.x), z: roundQa(object.position.z) },
            effectiveScale: roundQa(controlScale * ACTION_BUTTON_MAX_PULSE_SCALE),
            effectiveFootprint: { width: roundQa(halfWidth * 2), depth: roundQa(halfDepth * 2) },
            minimumMarginWorld: roundQa(minimumMargin),
            contained: minimumMargin >= TABLE_QA_MARGIN,
          };
        });
        const actionButtonPairs = buttonContainment.length === 4
          ? [
              { participant: 'far', first: buttonContainment[0], second: buttonContainment[1] },
              { participant: 'near', first: buttonContainment[2], second: buttonContainment[3] },
            ].map(({ participant, first, second }) => {
              const mirroredXError = Math.abs(first.position.x + second.position.x);
              const matchedZRowError = Math.abs(first.position.z - second.position.z);
              const matchedScaleError = Math.abs(first.effectiveScale - second.effectiveScale);
              const matchedFootprintWidthError = Math.abs(first.effectiveFootprint.width - second.effectiveFootprint.width);
              const matchedFootprintDepthError = Math.abs(first.effectiveFootprint.depth - second.effectiveFootprint.depth);
              return {
                participant,
                buttonIds: [first.id, second.id],
                first: {
                  x: first.position.x,
                  z: first.position.z,
                  effectiveScale: first.effectiveScale,
                  effectiveFootprint: first.effectiveFootprint,
                },
                second: {
                  x: second.position.x,
                  z: second.position.z,
                  effectiveScale: second.effectiveScale,
                  effectiveFootprint: second.effectiveFootprint,
                },
                mirroredXError: roundQa(mirroredXError),
                matchedZRowError: roundQa(matchedZRowError),
                matchedScaleError: roundQa(matchedScaleError),
                matchedFootprintWidthError: roundQa(matchedFootprintWidthError),
                matchedFootprintDepthError: roundQa(matchedFootprintDepthError),
                passes: [
                  mirroredXError,
                  matchedZRowError,
                  matchedScaleError,
                  matchedFootprintWidthError,
                  matchedFootprintDepthError,
                ].every((error) => error <= ACTION_BUTTON_SYMMETRY_TOLERANCE),
              };
            })
          : [];
        const [farPair, nearPair] = actionButtonPairs;
        const betweenParticipantGeometry = farPair && nearPair
          ? (() => {
              const farSpan = Math.abs(farPair.first.x - farPair.second.x);
              const nearSpan = Math.abs(nearPair.first.x - nearPair.second.x);
              const farCenter = (farPair.first.x + farPair.second.x) / 2;
              const nearCenter = (nearPair.first.x + nearPair.second.x) / 2;
              const spanXError = Math.abs(farSpan - nearSpan);
              const matchedCenterXError = Math.abs(farCenter - nearCenter);
              const mirroredZError = Math.abs(farPair.first.z + nearPair.first.z);
              const matchedScaleError = Math.abs(farPair.first.effectiveScale - nearPair.first.effectiveScale);
              const matchedFootprintWidthError = Math.abs(
                farPair.first.effectiveFootprint.width - nearPair.first.effectiveFootprint.width,
              );
              const matchedFootprintDepthError = Math.abs(
                farPair.first.effectiveFootprint.depth - nearPair.first.effectiveFootprint.depth,
              );
              return {
                pairIds: ['far', 'near'],
                spanXError: roundQa(spanXError),
                matchedCenterXError: roundQa(matchedCenterXError),
                mirroredZError: roundQa(mirroredZError),
                matchedScaleError: roundQa(matchedScaleError),
                matchedFootprintWidthError: roundQa(matchedFootprintWidthError),
                matchedFootprintDepthError: roundQa(matchedFootprintDepthError),
                passes: [
                  spanXError,
                  matchedCenterXError,
                  mirroredZError,
                  matchedScaleError,
                  matchedFootprintWidthError,
                  matchedFootprintDepthError,
                ].every((error) => error <= ACTION_BUTTON_SYMMETRY_TOLERANCE),
              };
            })()
          : null;
        const actionButtonSymmetry = {
          coordinateSpace: 'world',
          tolerance: ACTION_BUTTON_SYMMETRY_TOLERANCE,
          pairs: actionButtonPairs,
          betweenParticipants: betweenParticipantGeometry,
          passes: actionButtonPairs.length === 2
            && actionButtonPairs.every(({ passes }) => passes)
            && betweenParticipantGeometry?.passes === true,
        };

        const panelObjects: Array<{ id: string; object: THREE.Group; visible: boolean }> = [];
        if (scenarioId === 'cars') {
          if (pricePanel) panelObjects.push({ id: 'car-price', object: pricePanel, visible: state.phase <= 2 });
          if (sellerCondition) panelObjects.push({ id: 'seller-condition', object: sellerCondition, visible: state.phase === 1 || state.phase === 2 });
          if (physiologyPanel) panelObjects.push({ id: 'cardiac-metrics', object: physiologyPanel, visible: cueVisible && (state.phase === 3 || state.phase === 4) });
          if (conditionReveal) panelObjects.push({ id: 'car-round-result', object: conditionReveal, visible: state.phase === 5 });
        } else {
          if (exactPanel) panelObjects.push({ id: 'informed-target', object: exactPanel, visible: state.phase === 1 || state.phase === 2 });
          if (rangePanel) panelObjects.push({ id: 'less-informed-range', object: rangePanel, visible: state.phase === 1 || state.phase === 2 });
          if (targetReveal) panelObjects.push({ id: 'number-round-result', object: targetReveal, visible: state.phase === 5 });
        }
        const panels = panelObjects
          .filter(({ visible }) => visible)
          .map(({ id, object }) => projectObjectBounds(id, object, camera, canvas, sceneRect))
          .filter(isPresent);
        const avatarHeads = [
          projectObjectBounds('player-a-head', avatarA.head, camera, canvas, sceneRect),
          projectObjectBounds('player-b-head', avatarB.head, camera, canvas, sceneRect),
        ].filter(isPresent);
        const panelAvatarSeparations = panels.flatMap((panel) => avatarHeads.map((head) => {
          const ratio = overlapRatio(panel, head);
          return {
            panel: panel.id,
            avatar: head.id,
            overlapRatio: roundQa(ratio),
            maximumOverlapRatio: MAX_PANEL_AVATAR_OVERLAP_RATIO,
            passes: ratio <= MAX_PANEL_AVATAR_OVERLAP_RATIO,
          };
        }));
        const panelPairSeparations = panels.flatMap((panel, index) => panels.slice(index + 1).map((otherPanel) => {
          const ratio = overlapRatio(panel, otherPanel);
          return {
            firstPanel: panel.id,
            secondPanel: otherPanel.id,
            overlapRatio: roundQa(ratio),
            maximumOverlapRatio: MAX_PANEL_PAIR_OVERLAP_RATIO,
            passes: ratio <= MAX_PANEL_PAIR_OVERLAP_RATIO,
          };
        }));
        const violations = [
          ...buttonContainment.filter(({ contained }) => !contained).map(({ id }) => `button-outside-table:${id}`),
          ...actionButtonPairs.filter(({ passes }) => !passes).map(({ participant }) => `button-pair-asymmetric:${participant}`),
          ...(betweenParticipantGeometry?.passes === false ? ['button-pairs-not-equivalent'] : []),
          ...panels.filter(({ insideCanvas }) => !insideCanvas).map(({ id }) => `panel-clipped-by-canvas:${id}`),
          ...panelAvatarSeparations.filter(({ passes }) => !passes).map(({ panel, avatar }) => `panel-overlaps-avatar:${panel}:${avatar}`),
          ...panelPairSeparations.filter(({ passes }) => !passes).map(({ firstPanel, secondPanel }) => `panels-overlap:${firstPanel}:${secondPanel}`),
        ];
        const sceneQa = {
          schema: 'cardiac-scene-qa',
          schemaVersion: 1,
          ready: buttonContainment.length === 4 && avatarHeads.length === 2 && actionButtonSymmetry.passes,
          scenarioId,
          phase: state.phase,
          coordinateSpace: 'viewport-css',
          viewport: { width: canvas.clientWidth, height: canvas.clientHeight, narrow: canvas.clientWidth <= 520 },
          table: Object.fromEntries(Object.entries(tableBounds).map(([key, value]) => [key, roundQa(value)])),
          buttonContainment,
          actionButtonSymmetry,
          projected: { panels, avatarHeads },
          panelAvatarSeparations,
          panelPairSeparations,
          violations,
        };
        const nextSceneQaJson = JSON.stringify(sceneQa);
        if (nextSceneQaJson !== lastSceneQaJson) {
          sceneElement.dataset.sceneQa = nextSceneQaJson;
          lastSceneQaJson = nextSceneQaJson;
        }
      }
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      const sceneElement = canvas.parentElement;
      if (sceneElement) delete sceneElement.dataset.sceneQa;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial && material.map) material.map.dispose();
            material.dispose();
          });
        }
        if (object instanceof THREE.Sprite) {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [scenarioId, trial, incentive, cueSource]);

  return <canvas ref={canvasRef} className="three-table-canvas" aria-hidden="true" />;
}
