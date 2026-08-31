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
    new THREE.MeshStandardMaterial({ color: '#172025', roughness: 0.5, metalness: 0.16 }),
  );
  body.position.y = 0.005;
  group.add(body);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.53, 0.51),
    new THREE.MeshStandardMaterial({
      map: makeLabelTexture(label, 540, 190, {
        background: '#eef1ec', border: accent, foreground: '#17201f', fontSize: label.includes('\n') ? 43 : 54,
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

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.24, 3.25),
      new THREE.MeshStandardMaterial({ color: '#37423f', roughness: 0.64, metalness: 0.12 }),
    );
    table.position.y = 0.22;
    scene.add(table);

    // Player A is the far-side role (Seller or Strong evidence); Player B is the near-side role.
    const avatarA = makeAvatar('#527b7d', -2.55, 0.68);
    const avatarB = makeAvatar('#805467', 2.55, 2.36);
    scene.add(avatarA.root, avatarB.root);

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
    const conditionReveal = scenarioId === 'lemons'
      ? makeStatusPlate(carTrial.quality === 'LEMON' ? 'BAD CAR' : 'GOOD CAR', carTrial.quality === 'LEMON' ? '#ff5369' : '#66dbc0')
      : null;
    const lemonButtons = [sellerBuy, sellerPass, buyerBuy, buyerPass].filter((item): item is THREE.Group => Boolean(item));
    lemonButtons.forEach((button) => {
      button.scale.setScalar(0.001);
      scene.add(button);
    });
    // The oblique camera requires a slight diagonal offset so both paired controls remain visible.
    sellerBuy?.position.set(0.5, 0.42, -1.08);
    sellerPass?.position.set(2, 0.42, -1.08);
    buyerBuy?.position.set(-2, 0.42, 1.08);
    buyerPass?.position.set(-0.5, 0.42, 1.08);
    if (conditionReveal) {
      conditionReveal.position.set(-0.7, 0.76, -1.25);
      conditionReveal.scale.setScalar(0.001);
      scene.add(conditionReveal);
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

      if (scenarioId === 'lemons' && toyCar && sellerBuy && sellerPass && buyerBuy && buyerPass) {
        animateScale(toyCar, true, 0.83, 0.1);
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
        const buyerChoice = state.incentive === 'cooperate' ? carTrial.correctAction : 'BUY';
        const selectedSeller = sellerChoice === 'BUY' ? sellerBuy : sellerPass;
        const selectedBuyer = buyerChoice === 'BUY' ? buyerBuy : buyerPass;
        [sellerBuy, sellerPass].forEach((button) => {
          animateScale(button, state.phase >= 2 && (state.phase < 5 || button === selectedSeller), 0.78);
        });
        [buyerBuy, buyerPass].forEach((button) => {
          animateScale(button, state.phase >= 4 && (state.phase < 5 || button === selectedBuyer), 0.78);
        });
        const sellerPressedY = state.phase >= 3 ? 0.365 : 0.42;
        sellerBuy.position.y += ((selectedSeller === sellerBuy ? sellerPressedY : 0.42) - sellerBuy.position.y) * 0.14;
        sellerPass.position.y += ((selectedSeller === sellerPass ? sellerPressedY : 0.42) - sellerPass.position.y) * 0.14;
        buyerBuy.position.y += ((state.phase >= 4 && selectedBuyer === buyerBuy ? 0.365 : 0.42) - buyerBuy.position.y) * 0.14;
        buyerPass.position.y += ((state.phase >= 4 && selectedBuyer === buyerPass ? 0.365 : 0.42) - buyerPass.position.y) * 0.14;
        [sellerBuy, sellerPass, buyerBuy, buyerPass].forEach((button) => setEdgeGlow(button, false, beat));
        setEdgeGlow(selectedSeller, cueVisible && state.phase >= 3, beat);
        if (conditionReveal) animateScale(conditionReveal, state.phase === 5, 0.68);
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
      });
      renderer.dispose();
    };
  }, [scenarioId, trial]);

  return <canvas ref={canvasRef} className="three-table-canvas" aria-hidden="true" />;
}
