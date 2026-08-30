'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FaceEmotion, getScenario, IncentiveMode, ScenarioId } from './scenarioCatalog';

type ThreeTableSceneProps = {
  scenarioId: ScenarioId;
  phase: number;
  incentive: IncentiveMode;
};

type RuntimeState = { phase: number; incentive: IncentiveMode };
type MinimalAvatar = { root: THREE.Group; face: THREE.MeshStandardMaterial; emotion: FaceEmotion };

const cardLabels: Record<ScenarioId, { private: string; a: string; b: string }> = {
  signal: { private: 'TARGET\nSUN', a: 'SUN', b: 'SUN' },
  dilemma: { private: 'PRIVATE', a: 'SHARE', b: 'SHARE' },
  concealed: { private: 'SECRET\n4♦', a: '4♦', b: '4♦' },
  ultimatum: { private: '10\nTOKENS', a: '7 / 3', b: 'ACCEPT' },
};

function publicAsset(path: string) {
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
  const base = firstSegment === 'cardiac-signals-lab-demo' ? `/${firstSegment}` : '';
  return `${window.location.origin}${base}/${path}`;
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

function makeAvatar(color: string, x: number, yaw: number) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.5, 5, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  body.position.y = 0.8;
  root.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 28, 20),
    new THREE.MeshStandardMaterial({ color: '#b68468', roughness: 0.88 }),
  );
  head.position.y = 1.55;
  root.add(head);

  const face = new THREE.MeshStandardMaterial({
    transparent: true,
    depthWrite: false,
    roughness: 0.8,
    toneMapped: false,
    alphaTest: 0.02,
  });
  const faceShell = new THREE.Mesh(new THREE.SphereGeometry(0.368, 32, 22), face);
  faceShell.position.copy(head.position);
  faceShell.renderOrder = 2;
  root.add(faceShell);
  root.position.set(x, 0, 0.52);
  root.rotation.y = yaw;
  return { root, face, emotion: 'neutral' as FaceEmotion };
}

function updateAvatarFace(avatar: MinimalAvatar, emotion: FaceEmotion, textures: Map<FaceEmotion, THREE.Texture>) {
  if (avatar.emotion === emotion && avatar.face.map) return;
  avatar.emotion = emotion;
  const texture = textures.get(emotion);
  if (texture) {
    avatar.face.map = texture;
    avatar.face.needsUpdate = true;
  }
}

function setCardGlow(card: THREE.Group, visible: boolean, beat: number) {
  const glow = card.userData.glow as THREE.Mesh;
  const material = card.userData.glowMaterial as THREE.MeshStandardMaterial;
  glow.visible = visible;
  material.opacity = visible ? 0.34 + beat * 0.48 : 0;
  material.emissiveIntensity = visible ? 1.1 + beat * 4.2 : 0;
  glow.scale.setScalar(1 + beat * 0.07);
}

export default function ThreeTableScene({ scenarioId, phase, incentive }: ThreeTableSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RuntimeState>({ phase, incentive });

  useEffect(() => { stateRef.current = { phase, incentive }; }, [phase, incentive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const definition = getScenario(scenarioId);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
    camera.position.set(0, 4.55, 7.4);
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
      new THREE.CylinderGeometry(2.45, 2.45, 0.16, 48),
      new THREE.MeshStandardMaterial({ color: '#37423f', roughness: 0.64, metalness: 0.12 }),
    );
    table.scale.z = 0.48;
    table.position.y = 0.18;
    scene.add(table);

    const avatarA = makeAvatar('#527b7d', -2.0, 0.46);
    const avatarB = makeAvatar('#805467', 2.0, -0.46);
    scene.add(avatarA.root, avatarB.root);

    const textures = new Map<FaceEmotion, THREE.Texture>();
    const loader = new THREE.TextureLoader();
    const emotions: FaceEmotion[] = ['neutral', 'happiness', 'sadness', 'fear', 'anger', 'surprise'];
    emotions.forEach((emotion) => {
      loader.load(publicAsset(`assets/faces/spherical/${emotion}.svg`), (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        textures.set(emotion, texture);
        if (emotion === 'neutral') {
          avatarA.face.map = texture;
          avatarB.face.map = texture;
          avatarA.face.needsUpdate = true;
          avatarB.face.needsUpdate = true;
        }
      });
    });

    const labels = cardLabels[scenarioId];
    const privateCard = makeCard(labels.private);
    const cardA = makeCard(labels.a);
    const cardB = makeCard(labels.b);
    scene.add(privateCard, cardA, cardB);
    privateCard.position.set(-1.12, 0.37, 0.2);
    cardA.position.set(-1.32, 0.62, 0.6);
    cardB.position.set(1.32, 0.62, 0.6);

    const probeCards = scenarioId === 'concealed'
      ? ['7♥', 'Q♠', '4♦', '9♣'].map((label, index) => {
          const card = makeCard(label);
          card.position.set((index - 1.5) * 0.92, 0.38, 0.02);
          card.scale.setScalar(0.76);
          scene.add(card);
          return card;
        })
      : [];
    if (probeCards.length) cardA.visible = false;

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
    const aStart = new THREE.Vector3(-1.32, 0.88, 0.8);
    const aCenter = new THREE.Vector3(-0.52, 0.38, 0.05);
    const bStart = new THREE.Vector3(1.32, 0.88, 0.8);
    const bCenter = new THREE.Vector3(0.52, 0.38, 0.05);

    renderer.setAnimationLoop(() => {
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;
      const cueVisible = state.phase === 2 || state.phase === 3;
      const beat = Math.max(
        Math.pow(Math.max(0, Math.sin(elapsed * 6.8)), 18),
        Math.pow(Math.max(0, Math.sin(elapsed * 6.8 - 0.48)), 20) * 0.66,
      );

      cardA.position.lerp(state.phase === 0 ? aStart : aCenter, 0.09);
      const bMovesAt = scenarioId === 'dilemma' ? 1 : 3;
      cardB.position.lerp(state.phase >= bMovesAt ? bCenter : bStart, 0.09);
      cardA.rotation.x += ((state.phase === 0 ? -0.58 : 0) - cardA.rotation.x) * 0.08;
      cardB.rotation.x += ((state.phase < bMovesAt ? 0.58 : 0) - cardB.rotation.x) * 0.08;
      privateCard.visible = state.phase === 0;
      cardB.visible = scenarioId !== 'concealed' || state.phase >= 3;

      probeCards.forEach((card, index) => {
        card.visible = state.phase >= 1;
        card.position.y = 0.38 + (state.phase === 2 && index === 2 ? beat * 0.06 : 0);
        setCardGlow(card, cueVisible && index === 2, beat);
      });
      if (!probeCards.length) setCardGlow(cardA, cueVisible, beat);

      let expressionA = definition.expressionsA[state.phase];
      let expressionB = definition.expressionsB[state.phase];
      if (state.phase === 4 && state.incentive === 'compete') {
        expressionA = 'happiness';
        expressionB = 'sadness';
      }
      updateAvatarFace(avatarA, expressionA, textures);
      updateAvatarFace(avatarB, expressionB, textures);
      avatarA.root.position.y = Math.sin(elapsed * 1.15) * 0.012;
      avatarB.root.position.y = Math.sin(elapsed * 1.15 + 1.2) * 0.012;
      camera.position.x = Math.sin(elapsed * 0.16) * 0.08;
      camera.lookAt(0, 0.72, 0);
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      const faceTextures = new Set(textures.values());
      textures.forEach((texture) => texture.dispose());
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial && material.map && !faceTextures.has(material.map)) material.map.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
    };
  }, [scenarioId]);

  return <canvas ref={canvasRef} className="three-table-canvas" aria-hidden="true" />;
}
