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
  type CueWindow,
  type FaceEmotion,
  type IncentiveMode,
  type ScenarioId,
  getCarTrial,
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
};

type RuntimeState = { phase: number; incentive: IncentiveMode; cueWindow: CueWindow };
type FaceSurface = { group: THREE.Group; strokes: THREE.Mesh; eyeFills: THREE.Mesh; darkFills: THREE.Mesh; signature: string };
type MinimalAvatar = {
  root: THREE.Group;
  head: THREE.Group;
  face: FaceSurface;
  fromEmotion: FaceEmotion;
  toEmotion: FaceEmotion;
  morphStarted: number;
};

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
  context.font = `800 ${options.fontSize}px Arial`;
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
    new THREE.MeshStandardMaterial({
      map: makeLabelTexture(label, 320, 448, {
        background: '#f1eee7', border: '#252a31', foreground: '#1d2228', fontSize: 46,
      }),
      roughness: 0.76,
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
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.115, 0.72), glowMaterial);
  group.add(glow);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.64, 0.12, 0.62),
    new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.16, roughness: 0.46, metalness: 0.12 }),
  );
  body.position.y = 0.005;
  group.add(body);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.53, 0.51),
    new THREE.MeshStandardMaterial({
      map: makeLabelTexture(label, 540, 190, {
        background: accent, border: '#f6f2e9', foreground: '#ffffff', fontSize: label.includes('\n') ? 52 : 62,
      }),
      roughness: 0.72,
    }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.069;
  group.add(face);
  group.userData.glow = glow;
  group.userData.glowMaterial = glowMaterial;
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
  canvas.height = rows.length === 1 ? 220 : 390;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawRoundedRect(context, 12, 12, canvas.width - 24, canvas.height - 24, 34);
    context.fillStyle = 'rgba(10, 16, 20, 0.94)';
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 8;
    context.stroke();
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = accent;
    context.font = '800 30px Arial';
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
      context.font = '700 25px Arial';
      context.fillText(row.label, 48, rowY + rowHeight / 2);
      context.textAlign = 'right';
      context.fillStyle = '#f6f4ed';
      context.font = '800 34px Arial';
      context.fillText(row.value, canvas.width - 48, rowY + rowHeight / 2);
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

function makeStatusPlate(label: string, accent: string) {
  const group = new THREE.Group();
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.095, 0.58),
    new THREE.MeshStandardMaterial({
      color: accent, emissive: accent, emissiveIntensity: 1.35, roughness: 0.5, metalness: 0.08,
    }),
  );
  group.add(border);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.1, 0.48),
    new THREE.MeshStandardMaterial({ color: '#12191d', roughness: 0.64 }),
  );
  body.position.y = 0.008;
  group.add(body);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.32, 0.4),
    new THREE.MeshStandardMaterial({
      map: makeLabelTexture(label, 500, 170, {
        background: '#eef1ec', border: accent, foreground: '#17201f', fontSize: 52,
      }),
      roughness: 0.7,
    }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.063;
  group.add(face);
  return group;
}

function makePricePlate(label: string) {
  return makeInfoPanel('CAR PRICE', [{ label: 'FIXED', value: label }], '#e3b66b', 1.25);
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
  const glow = object.userData.glow as THREE.Mesh | undefined;
  const material = object.userData.glowMaterial as THREE.MeshStandardMaterial | undefined;
  if (!glow || !material) return;
  glow.visible = visible;
  material.opacity = visible ? 0.34 + beat * 0.48 : 0;
  material.emissiveIntensity = visible ? 1.1 + beat * 4.2 : 0;
  glow.scale.setScalar(1 + beat * 0.07);
}

function animateScale(object: THREE.Object3D, visible: boolean, targetScale: number, speed = 0.12) {
  object.visible = visible || object.scale.x > 0.015;
  const target = visible ? targetScale : 0.001;
  object.scale.lerp(new THREE.Vector3(target, target, target), speed);
  if (!visible && object.scale.x < 0.015) object.visible = false;
}

export default function ThreeTableScene({ scenarioId, phase, incentive, trial, cueWindow }: ThreeTableSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RuntimeState>({ phase, incentive, cueWindow });

  useEffect(() => { stateRef.current = { phase, incentive, cueWindow }; }, [phase, incentive, cueWindow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const definition = getScenario(scenarioId);
    let disposed = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
    camera.position.set(7.4, 5.8, 8.3);
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
    const red = new THREE.PointLight('#ff3853', 8, 8, 2);
    red.position.set(-1.3, 2.4, 1.2);
    scene.add(red);

    const tableMaterial = new THREE.MeshStandardMaterial({
      color: '#37423f',
      emissive: '#ff2545',
      emissiveIntensity: 0,
      roughness: 0.64,
      metalness: 0.12,
    });
    const table = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.24, 3.25), tableMaterial);
    table.position.y = 0.22;
    scene.add(table);

    // Player A is the far-side role (Seller or Strong evidence); Player B is the near-side role.
    const avatarA = makeAvatar('#527b7d', -2.55, 0.68);
    const avatarB = makeAvatar('#805467', 2.55, 2.36);
    scene.add(avatarA.root, avatarB.root);

    const sellerHeart = scenarioId === 'lemons' ? makeHeartSprite() : null;
    if (sellerHeart) {
      sellerHeart.position.set(0, 1.04, 0.32);
      sellerHeart.scale.setScalar(0.001);
      sellerHeart.visible = false;
      avatarA.root.add(sellerHeart);
    }

    const carTrial = getCarTrial(trial);
    const toyCar = scenarioId === 'lemons' ? makeToyCar() : null;
    if (toyCar) {
      toyCar.position.set(0.1, 0.43, 0.02);
      toyCar.rotation.y = -0.34;
      toyCar.scale.setScalar(0.001);
      scene.add(toyCar);
      loadCarModel(toyCar, carTrial.model, () => {
        if (disposed) return;
        toyCar.rotation.y = -0.34;
      });
    }

    const sellerBuy = scenarioId === 'lemons' ? makeActionButton('RECOMMEND\nBUY', '#4b918c') : null;
    const sellerPass = scenarioId === 'lemons' ? makeActionButton('RECOMMEND\nPASS', '#b55b68') : null;
    const buyerBuy = scenarioId === 'lemons' ? makeActionButton('BUY', '#4b918c') : null;
    const buyerPass = scenarioId === 'lemons' ? makeActionButton('PASS', '#b55b68') : null;
    const buyerOutcome = carTrial.correctAction === 'BUY' ? 30 - carTrial.pricePoints : 0;
    // The illustrated buyer makes the efficient choice, so the realized seller payoff is
    // +10 for a reliable-car sale and 0 for a rejected lemon in either incentive mode.
    const sellerOutcome = buyerOutcome;
    const sellerCondition = scenarioId === 'lemons'
      ? makeInfoPanel('SELLER ONLY', [
          { label: 'INSPECTION', value: carTrial.quality === 'LEMON' ? 'LEMON' : 'RELIABLE' },
        ], carTrial.quality === 'LEMON' ? '#ff5369' : '#66dbc0', 1.75)
      : null;
    const conditionReveal = scenarioId === 'lemons'
      ? makeStatusPlate(`${carTrial.quality === 'LEMON' ? 'LEMON' : 'RELIABLE'}\nB ${buyerOutcome >= 0 ? '+' : ''}${buyerOutcome} · S ${sellerOutcome >= 0 ? '+' : ''}${sellerOutcome}`, carTrial.quality === 'LEMON' ? '#ff5369' : '#66dbc0')
      : null;
    const pricePanel = scenarioId === 'lemons'
      ? makePricePlate(carTrial.price)
      : null;
    const physiologyPanel = scenarioId === 'lemons'
      ? makeInfoPanel('SELLER PHYSIOLOGY · DEMO', [
          { label: 'HEART RATE', value: `${carTrial.hrBpm} BPM` },
          { label: 'EXCITEMENT', value: `${carTrial.excitement} / 100` },
          { label: 'CHANGE FROM BASELINE', value: `+${carTrial.deltaHr} BPM` },
        ], '#ff5369', 2.12)
      : null;
    const lemonButtons = [sellerBuy, sellerPass, buyerBuy, buyerPass].filter((item): item is THREE.Group => Boolean(item));
    lemonButtons.forEach((button) => {
      button.scale.setScalar(0.001);
      scene.add(button);
    });
    // The oblique camera requires a slight diagonal offset so both paired controls remain visible.
    sellerBuy?.position.set(0.5, 0.38, -1.08);
    sellerPass?.position.set(2, 0.38, -1.08);
    buyerBuy?.position.set(-2, 0.38, 1.08);
    buyerPass?.position.set(-0.5, 0.38, 1.08);
    if (sellerCondition) {
      sellerCondition.position.set(-1.45, 1.4, -1.05);
      sellerCondition.scale.setScalar(0.001);
      scene.add(sellerCondition);
    }
    if (conditionReveal) {
      conditionReveal.position.set(-0.7, 0.76, -1.25);
      conditionReveal.scale.setScalar(0.001);
      scene.add(conditionReveal);
    }
    if (pricePanel) {
      pricePanel.position.set(1.15, 0.84, 0.55);
      pricePanel.scale.setScalar(0.001);
      scene.add(pricePanel);
    }
    if (physiologyPanel) {
      physiologyPanel.position.set(-1.55, 1.45, -1.1);
      physiologyPanel.scale.setScalar(0.001);
      scene.add(physiologyPanel);
    }

    const numberTrial = getNumberTrial(trial);
    const falseSignal = numberTrial.correct === 'A' ? 'B' : 'A';
    const exactPanel = scenarioId === 'numbers' ? makeCard(`EXACT\n${numberTrial.target}`) : null;
    const rangePanel = scenarioId === 'numbers' ? makeCard(`RANGE\n${numberTrial.coarse}`) : null;
    const weakInitial = trial % 2 === 0 ? 'B' : 'A';
    const strongA = scenarioId === 'numbers' ? makeActionButton('A', '#4b918c') : null;
    const strongB = scenarioId === 'numbers' ? makeActionButton('B', '#b55b68') : null;
    const weakA = scenarioId === 'numbers' ? makeActionButton('A', '#4b918c') : null;
    const weakB = scenarioId === 'numbers' ? makeActionButton('B', '#b55b68') : null;
    const targetReveal = scenarioId === 'numbers' ? makeStatusPlate(`TARGET ${numberTrial.target}`, '#66dcd0') : null;
    const numberProps = [
      exactPanel, rangePanel, strongA, strongB, weakA, weakB, targetReveal,
    ].filter((item): item is THREE.Group => Boolean(item));
    numberProps.forEach((card) => {
      card.scale.setScalar(0.001);
      scene.add(card);
    });

    exactPanel?.position.set(1.05, 0.42, -1.1);
    rangePanel?.position.set(-1.05, 0.42, 1.1);
    strongA?.position.set(0.5, 0.42, -1.08);
    strongB?.position.set(2, 0.42, -1.08);
    weakA?.position.set(-2, 0.42, 1.08);
    weakB?.position.set(-0.5, 0.42, 1.08);
    targetReveal?.position.set(-0.7, 0.76, -1.25);

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
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const clock = new THREE.Clock();
    const neutralPaint = new THREE.Color('#9ba8a4');
    const goodPaint = new THREE.Color('#3a8e78');
    const badPaint = new THREE.Color('#a83e4d');

    renderer.setAnimationLoop(() => {
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;
      const cueVisible = isCueActive(state.phase, state.cueWindow);
      const beatRate = scenarioId === 'lemons' && carTrial.quality === 'LEMON' && state.incentive === 'compete' ? 11.8 : 6.8;
      const beat = Math.max(
        Math.pow(Math.max(0, Math.sin(elapsed * beatRate)), 18),
        Math.pow(Math.max(0, Math.sin(elapsed * beatRate - 0.48)), 20) * 0.66,
      );
      const cardiacPhaseActive = scenarioId === 'lemons' && cueVisible && (state.phase === 3 || state.phase === 4);
      const tablePulse = cardiacPhaseActive ? 0.08 + beat * 1.16 : 0;
      tableMaterial.emissiveIntensity += (tablePulse - tableMaterial.emissiveIntensity) * 0.28;
      red.intensity += (((cardiacPhaseActive ? 1.2 + beat * 12 : 0.8)) - red.intensity) * 0.2;

      if (sellerHeart) {
        sellerHeart.visible = cardiacPhaseActive || sellerHeart.scale.x > 0.01;
        const heartTarget = cardiacPhaseActive ? 0.27 + beat * 0.13 : 0.001;
        sellerHeart.scale.lerp(new THREE.Vector3(heartTarget, heartTarget, 1), 0.24);
        if (!cardiacPhaseActive && sellerHeart.scale.x < 0.01) sellerHeart.visible = false;
        const heartMaterial = sellerHeart.material as THREE.SpriteMaterial;
        heartMaterial.opacity = cardiacPhaseActive ? 0.68 + beat * 0.32 : 0;
      }

      if (scenarioId === 'lemons' && toyCar && sellerBuy && sellerPass && buyerBuy && buyerPass) {
        animateScale(toyCar, true, 0.83, 0.1);
        if (pricePanel) animateScale(pricePanel, true, 1, 0.14);
        if (sellerCondition) animateScale(sellerCondition, state.phase === 1, 1, 0.14);
        if (physiologyPanel) {
          const physiologyVisible = state.phase === 4 || state.phase === 5;
          animateScale(physiologyPanel, physiologyVisible, 1, 0.14);
        }
        toyCar.rotation.y = -0.34 + Math.sin(elapsed * 0.35) * 0.025;
        const paint = toyCar.userData.paint as THREE.MeshStandardMaterial;
        const revealColor = carTrial.quality === 'LEMON' ? badPaint : goodPaint;
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
          material.roughness += (((state.phase === 5 && carTrial.quality === 'LEMON') ? 0.92 : 0.58) - material.roughness) * 0.06;
        });
        toyCar.rotation.z += (((state.phase === 5 && carTrial.quality === 'LEMON') ? -0.045 : 0) - toyCar.rotation.z) * 0.08;

        const sellerChoice = state.incentive === 'cooperate' ? carTrial.correctAction : 'BUY';
        const buyerChoice = carTrial.correctAction;
        const selectedSeller = sellerChoice === 'BUY' ? sellerBuy : sellerPass;
        const selectedBuyer = buyerChoice === 'BUY' ? buyerBuy : buyerPass;
        [sellerBuy, sellerPass].forEach((button) => {
          animateScale(button, true, 0.7);
        });
        [buyerBuy, buyerPass].forEach((button) => {
          animateScale(button, true, 0.7);
        });
        const sellerPressedY = state.phase >= 3 ? 0.35 : 0.38;
        sellerBuy.position.y += ((selectedSeller === sellerBuy ? sellerPressedY : 0.38) - sellerBuy.position.y) * 0.14;
        sellerPass.position.y += ((selectedSeller === sellerPass ? sellerPressedY : 0.38) - sellerPass.position.y) * 0.14;
        buyerBuy.position.y += ((state.phase >= 4 && selectedBuyer === buyerBuy ? 0.35 : 0.38) - buyerBuy.position.y) * 0.14;
        buyerPass.position.y += ((state.phase >= 4 && selectedBuyer === buyerPass ? 0.35 : 0.38) - buyerPass.position.y) * 0.14;
        [sellerBuy, sellerPass, buyerBuy, buyerPass].forEach((button) => setEdgeGlow(button, false, beat));
        setEdgeGlow(selectedSeller, cardiacPhaseActive, beat);
        if (conditionReveal) animateScale(conditionReveal, state.phase === 5, 0.95);
      }

      if (scenarioId === 'numbers' && exactPanel && rangePanel && strongA && strongB && weakA && weakB && targetReveal) {
        optionCards.forEach((card) => animateScale(card, true, 0.72));
        animateScale(exactPanel, state.phase === 1, 0.62);
        animateScale(rangePanel, state.phase === 1, 0.62);
        animateScale(targetReveal, state.phase === 5, 0.68);
        const initialStrong = numberTrial.correct === 'A' ? strongA : strongB;
        const initialWeak = weakInitial === 'A' ? weakA : weakB;
        const recommendedValue = state.incentive === 'cooperate' ? numberTrial.correct : falseSignal;
        const selectedStrong = recommendedValue === 'A' ? strongA : strongB;
        const selectedWeak = state.incentive === 'cooperate'
          ? (numberTrial.correct === 'A' ? weakA : weakB)
          : (falseSignal === 'A' ? weakA : weakB);

        [strongA, strongB, weakA, weakB].forEach((button) => {
          animateScale(button, state.phase >= 2, 0.68);
          setEdgeGlow(button, false, beat);
        });
        const strongPressed = state.phase === 2 ? initialStrong : selectedStrong;
        const weakPressed = state.phase === 2 ? initialWeak : selectedWeak;
        [strongA, strongB].forEach((button) => {
          button.position.y += ((state.phase >= 2 && button === strongPressed ? 0.365 : 0.42) - button.position.y) * 0.14;
        });
        [weakA, weakB].forEach((button) => {
          button.position.y += ((state.phase >= 2 && state.phase >= 4 && button === weakPressed ? 0.365 : 0.42) - button.position.y) * 0.14;
        });
        if (state.phase === 2) {
          weakPressed.position.y += (0.365 - weakPressed.position.y) * 0.14;
        }
        setEdgeGlow(selectedStrong, cueVisible && state.phase >= 3 && state.phase <= 4, beat);
      }

      let expressionA = definition.expressionsA[state.phase];
      let expressionB = definition.expressionsB[state.phase];
      if (state.phase === 5 && state.incentive === 'compete') {
        expressionA = 'happiness';
        expressionB = 'sadness';
      }
      updateAvatarFace(avatarA, expressionA, elapsed);
      updateAvatarFace(avatarB, expressionB, elapsed);
      avatarA.root.position.y = Math.sin(elapsed * 1.15) * 0.012;
      avatarB.root.position.y = Math.sin(elapsed * 1.15 + 1.2) * 0.012;
      camera.position.x = 7.4 + Math.sin(elapsed * 0.16) * 0.08;
      camera.lookAt(0, 0.72, 0);
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const sceneElement = canvas.parentElement;
      if (sceneElement) {
        const writeHeadPosition = (player: 'a' | 'b', avatar: MinimalAvatar) => {
          const point = avatar.head.getWorldPosition(new THREE.Vector3()).project(camera);
          sceneElement.style.setProperty(`--head-${player}-x`, `${((point.x + 1) / 2) * canvas.clientWidth}px`);
          sceneElement.style.setProperty(`--head-${player}-y`, `${((-point.y + 1) / 2) * canvas.clientHeight}px`);
        };
        writeHeadPosition('a', avatarA);
        writeHeadPosition('b', avatarB);
      }
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
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
  }, [scenarioId, trial]);

  return <canvas ref={canvasRef} className="three-table-canvas" aria-hidden="true" />;
}
