'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
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
  face: FaceSurface;
  fromEmotion: FaceEmotion;
  toEmotion: FaceEmotion;
  morphStarted: number;
};

function getSceneLabels(scenarioId: ScenarioId, trial: number) {
  if (scenarioId === 'lemons') {
    const car = getCarTrial(trial);
    return {
      private: `INSPECTION\n${car.quality}`,
      evidence: car.evidence.replace(' ', '\n'),
      signal: car.quality === 'LEMON' ? 'NEEDS\nREPAIR' : 'RELIABLE',
      signalCompete: 'RELIABLE',
      response: car.correctAction,
      responseCompete: 'BUY',
      optionA: null,
      optionB: null,
    };
  }
  const numbers = getNumberTrial(trial);
  const falseSignal = numbers.correct === 'A' ? 'B' : 'A';
  return {
    private: `EXACT\n${numbers.target}`,
    evidence: `RANGE\n${numbers.coarse}`,
    signal: `SIGNAL\n${numbers.correct}`,
    signalCompete: trial % 2 === 0 ? 'WAIT' : `SIGNAL\n${falseSignal}`,
    response: `FINAL\n${numbers.correct}`,
    responseCompete: `FINAL\n${falseSignal}`,
    optionA: `A\n${numbers.a}`,
    optionB: `B\n${numbers.b}`,
  };
}

function makeCardTexture(label: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 448;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = '#f1eee7';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#252a31';
  context.lineWidth = 7;
  context.strokeRect(18, 18, 284, 412);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = label.includes('♦') || label.includes('♥') ? '#a92638' : '#1d2228';
  const lines = label.split('\n');
  context.font = `700 ${lines.length > 1 ? 46 : label.length > 6 ? 42 : 60}px Arial`;
  lines.forEach((line, index) => context.fillText(line, 160, 224 + (index - (lines.length - 1) / 2) * 58));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCard(label: string) {
  const group = new THREE.Group();
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: '#ff3049', emissive: '#ff1938', emissiveIntensity: 0,
    transparent: true, opacity: 0,
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
    new THREE.MeshStandardMaterial({ map: makeCardTexture(label), roughness: 0.76 }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.043;
  group.add(face);
  group.userData.glow = glow;
  group.userData.glowMaterial = glowMaterial;
  return group;
}

function makeToyCar() {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#9ba8a4', roughness: 0.42, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: '#26383d', roughness: 0.25, metalness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#111519', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.62), paint);
  body.position.y = 0.27;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.3, 0.52), glass);
  cabin.position.set(0.1, 0.52, 0);
  group.add(cabin);
  [-0.4, 0.4].forEach((x) => {
    [-0.34, 0.34].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 16), rubber);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.15, z);
      group.add(wheel);
    });
  });
  group.scale.setScalar(0.72);
  return group;
}

function makeFaceSurface(): FaceSurface {
  const group = new THREE.Group();
  const layer = (color: number, renderOrder: number) => {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
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
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 28, 20),
    new THREE.MeshStandardMaterial({ color: '#b68468', roughness: 0.88 }),
  );
  head.add(headMesh);
  const face = makeFaceSurface();
  renderFace(face, 'neutral', 'neutral', 1);
  head.add(face.group);
  root.add(head);
  root.position.set(0, 0, z);
  root.rotation.y = yaw;
  return { root, face, fromEmotion: 'neutral' as FaceEmotion, toEmotion: 'neutral' as FaceEmotion, morphStarted: 0 };
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

function setCardGlow(card: THREE.Group, visible: boolean, beat: number) {
  const glow = card.userData.glow as THREE.Mesh;
  const material = card.userData.glowMaterial as THREE.MeshStandardMaterial;
  glow.visible = visible;
  material.opacity = visible ? 0.34 + beat * 0.48 : 0;
  material.emissiveIntensity = visible ? 1.1 + beat * 4.2 : 0;
  glow.scale.setScalar(1 + beat * 0.07);
}

export default function ThreeTableScene({ scenarioId, phase, incentive, trial, cueWindow }: ThreeTableSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RuntimeState>({ phase, incentive, cueWindow });

  useEffect(() => { stateRef.current = { phase, incentive, cueWindow }; }, [phase, incentive, cueWindow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const definition = getScenario(scenarioId);
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

    const avatarA = makeAvatar('#527b7d', -2.55, 0.68);
    const avatarB = makeAvatar('#805467', 2.55, 2.36);
    scene.add(avatarA.root, avatarB.root);

    const labels = getSceneLabels(scenarioId, trial);
    const privateCard = makeCard(labels.private);
    const cardA = makeCard(labels.signal);
    const cardACompetitive = makeCard(labels.signalCompete);
    const cardB = makeCard(labels.response);
    const cardBCompetitive = makeCard(labels.responseCompete);
    scene.add(privateCard, cardA, cardACompetitive, cardB, cardBCompetitive);
    privateCard.position.set(0.78, 0.39, -1.2);
    privateCard.scale.setScalar(0.7);
    cardA.position.set(-0.68, 0.82, -1.72);
    cardACompetitive.position.copy(cardA.position);
    cardB.position.set(0.68, 0.82, 1.72);
    cardBCompetitive.position.copy(cardB.position);

    const evidenceCard = makeCard(labels.evidence);
    evidenceCard.position.set(1.15, 0.39, 1.02);
    evidenceCard.scale.setScalar(0.66);
    scene.add(evidenceCard);

    const toyCar = scenarioId === 'lemons' ? makeToyCar() : null;
    if (toyCar) {
      toyCar.position.set(0.55, 0.43, 0.35);
      toyCar.rotation.y = -0.34;
      scene.add(toyCar);
    }

    const optionCards = scenarioId === 'numbers' && labels.optionA && labels.optionB
      ? [labels.optionA, labels.optionB].map((label, index) => {
          const card = makeCard(label);
          card.position.set(index === 0 ? -0.72 : 0.72, 0.39, 0.02);
          card.scale.setScalar(0.72);
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
    const aStart = new THREE.Vector3(-0.68, 0.88, -1.72);
    const aCenter = new THREE.Vector3(-0.68, 0.39, -0.42);
    const bStart = new THREE.Vector3(0.68, 0.88, 1.72);
    const bCenter = new THREE.Vector3(0.68, 0.39, 0.46);

    renderer.setAnimationLoop(() => {
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;
      const cueVisible = isCueActive(state.phase, state.cueWindow);
      const beat = Math.max(
        Math.pow(Math.max(0, Math.sin(elapsed * 6.8)), 18),
        Math.pow(Math.max(0, Math.sin(elapsed * 6.8 - 0.48)), 20) * 0.66,
      );

      cardA.position.lerp(state.phase < 3 ? aStart : aCenter, 0.09);
      cardACompetitive.position.lerp(state.phase < 3 ? aStart : aCenter, 0.09);
      const bMovesAt = 4;
      cardB.position.lerp(state.phase >= bMovesAt ? bCenter : bStart, 0.09);
      cardBCompetitive.position.lerp(state.phase >= bMovesAt ? bCenter : bStart, 0.09);
      cardA.rotation.x += ((state.phase < 3 ? -0.58 : 0) - cardA.rotation.x) * 0.08;
      cardACompetitive.rotation.x += ((state.phase < 3 ? -0.58 : 0) - cardACompetitive.rotation.x) * 0.08;
      cardB.rotation.x += ((state.phase < bMovesAt ? 0.58 : 0) - cardB.rotation.x) * 0.08;
      cardBCompetitive.rotation.x += ((state.phase < bMovesAt ? 0.58 : 0) - cardBCompetitive.rotation.x) * 0.08;
      privateCard.visible = state.phase >= 1 && state.phase <= 2;
      evidenceCard.visible = state.phase >= 2 && state.phase <= 4;
      if (toyCar) toyCar.rotation.y = -0.34 + Math.sin(elapsed * 0.35) * 0.025;
      const bShouldShow = state.phase >= bMovesAt;
      cardB.visible = bShouldShow && state.incentive === 'cooperate';
      cardBCompetitive.visible = bShouldShow && state.incentive === 'compete';

      optionCards.forEach((card) => { card.visible = true; });
      const aShouldShow = state.phase >= 3;
      cardA.visible = aShouldShow && state.incentive === 'cooperate';
      cardACompetitive.visible = aShouldShow && state.incentive === 'compete';
      setCardGlow(cardA, cueVisible && state.incentive === 'cooperate', beat);
      setCardGlow(cardACompetitive, cueVisible && state.incentive === 'compete', beat);

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
      renderer.render(scene, camera);
    });

    return () => {
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
        } else if (object instanceof THREE.Sprite) {
          const material = object.material as THREE.SpriteMaterial;
          material.map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [scenarioId, trial]);

  return <canvas ref={canvasRef} className="three-table-canvas" aria-hidden="true" />;
}
