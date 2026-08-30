'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type ThreeScenarioId = 'signal' | 'dilemma' | 'concealed' | 'ultimatum';
export type ThreeIncentiveMode = 'cooperate' | 'compete';
export type ThreeCueMode = 'edge' | 'heart';

type SceneState = {
  phase: number;
  incentive: ThreeIncentiveMode;
  cueMode: ThreeCueMode;
};

type ThreeTableSceneProps = SceneState & {
  scenarioId: ThreeScenarioId;
  compact?: boolean;
};

const labels: Record<ThreeScenarioId, { private: string; far: string; near: string }> = {
  signal: { private: 'TARGET\nSUN', far: 'SUN', near: 'SUN' },
  dilemma: { private: 'PRIVATE\nCHOICE', far: 'SHARE', near: 'SHARE' },
  concealed: { private: 'MEMORIZE\n4♦', far: '4♦', near: '4♦' },
  ultimatum: { private: '10\nTOKENS', far: '7 / 3', near: 'ACCEPT' },
};

function makeCardTexture(label: string, accent = '#78eadf') {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 536;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  const gradient = context.createLinearGradient(0, 0, 384, 536);
  gradient.addColorStop(0, '#f7f2e9');
  gradient.addColorStop(1, '#d9d3ca');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 384, 536);
  context.strokeStyle = accent;
  context.lineWidth = 16;
  context.strokeRect(18, 18, 348, 500);
  context.strokeStyle = '#252b32';
  context.lineWidth = 3;
  context.strokeRect(39, 39, 306, 458);

  const lines = label.split('\n');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = label.includes('♦') || label.includes('♥') ? '#a72331' : '#171b20';
  context.font = `700 ${lines.length > 1 ? 56 : label.length > 7 ? 48 : 72}px Arial`;
  lines.forEach((line, index) => {
    context.fillText(line, 192, 268 + (index - (lines.length - 1) / 2) * 72);
  });
  context.fillStyle = '#4f5963';
  context.font = '600 22px Arial';
  context.fillText('CARDIAC SIGNALS LAB', 192, 474);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeCard(label: string, accent: string) {
  const group = new THREE.Group();
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: '#ff3d4e',
    emissive: '#ff182c',
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
  });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.09, 1.52), glowMaterial);
  glow.position.y = -0.01;
  group.add(glow);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.075, 1.42),
    new THREE.MeshStandardMaterial({ color: '#191d23', roughness: 0.48, metalness: 0.22 }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 1.34),
    new THREE.MeshStandardMaterial({ map: makeCardTexture(label, accent), roughness: 0.7 }),
  );
  face.position.y = 0.041;
  face.rotation.x = -Math.PI / 2;
  group.add(face);
  group.userData.glow = glow;
  group.userData.glowMaterial = glowMaterial;
  return group;
}

function addChair(scene: THREE.Scene, z: number, color: string) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.12 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 1.05), material);
  seat.position.y = 0.55;
  seat.castShadow = true;
  group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 0.16), material);
  back.position.set(0, 1.15, z < 0 ? -0.45 : 0.45);
  back.castShadow = true;
  group.add(back);
  [-0.48, 0.48].forEach((x) => {
    [-0.38, 0.38].forEach((offset) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.62, 10), material);
      leg.position.set(x, 0.23, offset);
      group.add(leg);
    });
  });
  group.position.z = z;
  scene.add(group);
}

function addParticipant(scene: THREE.Scene, z: number, color: string, facing: 1 | -1) {
  const group = new THREE.Group();
  const clothing = new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.05 });
  const skin = new THREE.MeshStandardMaterial({ color: '#b67c5e', roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: '#15191f', roughness: 0.4 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.72, 6, 14), clothing);
  torso.position.y = 1.42;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 18), skin);
  head.scale.y = 1.12;
  head.position.y = 2.35;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), dark);
  hair.position.y = 2.39;
  hair.rotation.z = Math.PI;
  group.add(hair);

  [-0.12, 0.12].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), dark);
    eye.position.set(x, 2.4, facing * 0.34);
    group.add(eye);
  });

  [-0.56, 0.56].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.7, 4, 10), clothing);
    arm.position.set(x, 1.28, facing * 0.23);
    arm.rotation.z = x < 0 ? -0.4 : 0.4;
    arm.rotation.x = facing * 0.55;
    arm.castShadow = true;
    group.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin);
    hand.scale.y = 0.7;
    hand.position.set(x * 1.18, 0.92, facing * 0.62);
    hand.castShadow = true;
    group.add(hand);
  });

  group.position.z = z;
  scene.add(group);
}

function makeHeart() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.25);
  shape.bezierCurveTo(0, 0.25, -0.48, -0.08, -0.48, -0.42);
  shape.bezierCurveTo(-0.48, -0.75, -0.08, -0.92, 0, -1.15);
  shape.bezierCurveTo(0.08, -0.92, 0.48, -0.75, 0.48, -0.42);
  shape.bezierCurveTo(0.48, -0.08, 0, 0.25, 0, 0.25);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 3 });
  geometry.center();
  const heart = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: '#ff344c', emissive: '#8d0719', emissiveIntensity: 1.4, roughness: 0.34, metalness: 0.12 }),
  );
  heart.scale.setScalar(0.6);
  heart.rotation.x = 0.08;
  heart.castShadow = true;
  return heart;
}

function setGlow(card: THREE.Group, visible: boolean, beat: number) {
  const glow = card.userData.glow as THREE.Mesh;
  const material = card.userData.glowMaterial as THREE.MeshStandardMaterial;
  glow.visible = visible;
  material.opacity = visible ? 0.34 + beat * 0.4 : 0;
  material.emissiveIntensity = visible ? 1.4 + beat * 4 : 0;
  glow.scale.setScalar(1 + beat * 0.07);
}

export default function ThreeTableScene({ scenarioId, phase, incentive, cueMode, compact = false }: ThreeTableSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState>({ phase, incentive, cueMode });

  useEffect(() => {
    stateRef.current = { phase, incentive, cueMode };
  }, [phase, incentive, cueMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(compact ? 39 : 35, 1, 0.1, 60);
    camera.position.set(compact ? 6.8 : 7.4, compact ? 5.4 : 5.8, compact ? 7.6 : 8.3);
    camera.lookAt(0, 0.78, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !compact;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.add(new THREE.HemisphereLight('#d8f3ff', '#14100d', 2.3));
    const key = new THREE.DirectionalLight('#fff1d8', 4.2);
    key.position.set(4, 8, 5);
    key.castShadow = !compact;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.PointLight('#ff5264', 14, 12, 2);
    rim.position.set(-3, 3.5, -2);
    scene.add(rim);
    const fill = new THREE.PointLight('#55d9e9', 10, 12, 2);
    fill.position.set(3, 2.8, 3);
    scene.add(fill);

    const tableMaterial = new THREE.MeshStandardMaterial({ color: '#3c2b24', roughness: 0.5, metalness: 0.18 });
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.28, 3.25), tableMaterial);
    tableTop.position.y = 0.25;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    scene.add(tableTop);
    [-2.2, 2.2].forEach((x) => [-1.22, 1.22].forEach((z) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 1.55, 12), tableMaterial);
      leg.position.set(x, -0.58, z);
      leg.castShadow = true;
      scene.add(leg);
    }));

    const anchor = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.58, 48),
      new THREE.MeshBasicMaterial({ color: '#6edfea', transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
    );
    anchor.position.y = 0.405;
    anchor.rotation.x = -Math.PI / 2;
    scene.add(anchor);

    addChair(scene, -3.08, '#343c49');
    addChair(scene, 3.08, '#453740');
    addParticipant(scene, -2.58, '#486c78', 1);
    addParticipant(scene, 2.58, '#704b59', -1);

    const accent = scenarioId === 'dilemma' ? '#a9d785' : scenarioId === 'concealed' ? '#ff8c78' : scenarioId === 'ultimatum' ? '#d6b6ff' : '#78eadf';
    const scenarioLabels = labels[scenarioId];
    const privateCard = makeCard(scenarioLabels.private, accent);
    const farCard = makeCard(scenarioLabels.far, accent);
    const nearCard = makeCard(scenarioLabels.near, accent);
    scene.add(privateCard, farCard, nearCard);

    const probeCards = scenarioId === 'concealed'
      ? ['7♥', 'Q♠', '4♦', '9♣'].map((label) => {
          const card = makeCard(label, label === '4♦' ? '#ff5a6f' : '#8d969f');
          scene.add(card);
          return card;
        })
      : [];

    const heart = makeHeart();
    heart.position.set(-0.72, 1.45, -0.35);
    heart.visible = false;
    scene.add(heart);

    const tokenGroup = new THREE.Group();
    const tokenMaterial = new THREE.MeshStandardMaterial({ color: '#f7c34d', metalness: 0.7, roughness: 0.25 });
    for (let index = 0; index < 6; index += 1) {
      const token = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 24), tokenMaterial);
      token.rotation.x = Math.PI / 2;
      token.position.set((index % 3) * 0.42 - 0.42, Math.floor(index / 3) * 0.08, (index % 2) * 0.34 - 0.17);
      token.castShadow = true;
      tokenGroup.add(token);
    }
    tokenGroup.position.set(0, 0.53, 0);
    tokenGroup.visible = false;
    scene.add(tokenGroup);

    const farStart = new THREE.Vector3(-0.72, 1.05, -1.76);
    const farTable = new THREE.Vector3(-0.72, 0.52, -0.42);
    const nearStart = new THREE.Vector3(0.72, 1.05, 1.76);
    const nearTable = new THREE.Vector3(0.72, 0.52, 0.48);
    privateCard.position.set(0.65, 0.54, -1.2);
    privateCard.rotation.y = 0.14;
    farCard.position.copy(farStart);
    nearCard.position.copy(nearStart);

    if (probeCards.length) {
      probeCards.forEach((card, index) => card.position.set((index - 1.5) * 1.12, 0.53, -0.28));
      farCard.visible = false;
    }

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (compact) return;
      const rect = canvas.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.75;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.3;
    };
    canvas.addEventListener('pointermove', onPointerMove);

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
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;
      const cueVisible = state.phase === 2 || state.phase === 3;
      const beatA = Math.pow(Math.max(0, Math.sin(elapsed * 6.7)), 16);
      const beatB = Math.pow(Math.max(0, Math.sin(elapsed * 6.7 - 0.48)), 18) * 0.65;
      const beat = Math.max(beatA, beatB);

      const farTarget = state.phase === 0 ? farStart : farTable;
      const nearMovesEarly = scenarioId === 'dilemma';
      const nearTarget = state.phase >= (nearMovesEarly ? 1 : 3) ? nearTable : nearStart;
      farCard.position.lerp(farTarget, 0.085);
      nearCard.position.lerp(nearTarget, 0.085);
      farCard.rotation.x += (((state.phase === 0 ? -0.72 : 0)) - farCard.rotation.x) * 0.075;
      nearCard.rotation.x += (((state.phase < (nearMovesEarly ? 1 : 3) ? 0.72 : 0)) - nearCard.rotation.x) * 0.075;
      privateCard.visible = state.phase === 0;
      nearCard.visible = scenarioId !== 'concealed' || state.phase >= 3;

      probeCards.forEach((card, index) => {
        card.visible = state.phase >= 1;
        card.position.y = 0.53 + (state.phase === 2 && index === 2 ? beat * 0.055 : 0);
        setGlow(card, cueVisible && state.cueMode === 'edge' && index === 2, beat);
      });
      if (!probeCards.length) setGlow(farCard, cueVisible && state.cueMode === 'edge', beat);
      setGlow(nearCard, false, beat);

      heart.visible = cueVisible && state.cueMode === 'heart';
      heart.scale.setScalar(0.58 + beat * 0.13);
      heart.rotation.y = Math.sin(elapsed * 0.65) * 0.18;
      heart.position.y = 1.48 + Math.sin(elapsed * 1.2) * 0.05;

      tokenGroup.visible = state.phase === 4;
      tokenGroup.position.y += ((state.phase === 4 ? 0.57 : 0.25) - tokenGroup.position.y) * 0.08;
      tokenGroup.rotation.y = elapsed * 0.22;
      (tokenMaterial as THREE.MeshStandardMaterial).color.set(state.incentive === 'cooperate' ? '#f7c34d' : '#ff6f55');

      anchor.rotation.z = elapsed * 0.24;
      (anchor.material as THREE.MeshBasicMaterial).opacity = 0.22 + beat * 0.2;
      camera.position.x += ((compact ? 6.8 : 7.4) + pointerX - camera.position.x) * 0.035;
      camera.position.y += ((compact ? 5.4 : 5.8) - pointerY - camera.position.y) * 0.035;
      camera.lookAt(0, 0.78, 0);
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
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
  }, [compact, scenarioId]);

  return <canvas ref={canvasRef} className="three-table-canvas" aria-hidden="true" />;
}
