import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface JarvisCoreProps {
  isRunning: boolean;
  isListening: boolean;
  intensity: number;
}

export default function JarvisCore({ isRunning, isListening, intensity }: JarvisCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ isRunning, isListening, intensity });

  useEffect(() => {
    stateRef.current = { isRunning, isListening, intensity };
  }, [intensity, isListening, isRunning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 0.3, 7.2);

    const root = new THREE.Group();
    scene.add(root);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.08, 3),
      new THREE.MeshBasicMaterial({
        color: 0x50c878,
        wireframe: true,
        transparent: true,
        opacity: 0.72,
      }),
    );
    root.add(core);

    const inner = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 1),
      new THREE.MeshBasicMaterial({
        color: 0xf2b84b,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      }),
    );
    root.add(inner);

    const ringMaterials = [
      new THREE.MeshBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.46 }),
      new THREE.MeshBasicMaterial({ color: 0x50c878, transparent: true, opacity: 0.34 }),
      new THREE.MeshBasicMaterial({ color: 0xf0784f, transparent: true, opacity: 0.3 }),
    ];
    const rings = ringMaterials.map((material, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72 + index * 0.38, 0.012, 8, 160), material);
      ring.rotation.x = Math.PI / 2 + index * 0.42;
      ring.rotation.y = index * 0.72;
      root.add(ring);
      return ring;
    });

    const particleCount = 540;
    const positions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const radius = 2.2 + Math.random() * 2.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.72;
      positions[index * 3 + 2] = radius * Math.cos(phi);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0x9edcff,
        size: 0.018,
        transparent: true,
        opacity: 0.58,
      }),
    );
    root.add(particles);

    const waveGroup = new THREE.Group();
    root.add(waveGroup);
    const waveMaterial = new THREE.LineBasicMaterial({ color: 0x50c878, transparent: true, opacity: 0.52 });
    const waveLines = Array.from({ length: 7 }, (_, lane) => {
      const points = Array.from({ length: 96 }, (_, index) => {
        const x = -3.7 + (index / 95) * 7.4;
        const y = -2.15 + lane * 0.18;
        return new THREE.Vector3(x, y, -0.9 - lane * 0.02);
      });
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, waveMaterial);
      waveGroup.add(line);
      return line;
    });

    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let frame = 0;
    const startedAt = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startedAt) / 1000;
      const live = stateRef.current;
      const power = 0.7 + live.intensity * 0.85 + (live.isRunning ? 0.35 : 0) + (live.isListening ? 0.22 : 0);

      root.rotation.y = elapsed * 0.12;
      root.rotation.x = Math.sin(elapsed * 0.22) * 0.05;
      core.rotation.x = elapsed * (0.18 + power * 0.08);
      core.rotation.y = elapsed * (0.28 + power * 0.12);
      inner.rotation.y = -elapsed * 0.66;
      inner.scale.setScalar(0.92 + Math.sin(elapsed * 2.4) * 0.035 + live.intensity * 0.08);

      rings.forEach((ring, index) => {
        ring.rotation.z = elapsed * (0.12 + index * 0.08) * (index % 2 === 0 ? 1 : -1);
        ring.scale.setScalar(1 + Math.sin(elapsed * 1.4 + index) * 0.014 + live.intensity * 0.035);
      });

      particles.rotation.y = -elapsed * 0.035;
      particles.rotation.x = Math.sin(elapsed * 0.16) * 0.05;

      waveLines.forEach((line, lane) => {
        const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let index = 0; index < attribute.count; index += 1) {
          const x = attribute.getX(index);
          const pulse = Math.sin(index * 0.28 + elapsed * (2.4 + power) + lane * 0.8) * (0.035 + power * 0.018);
          attribute.setY(index, -2.15 + lane * 0.18 + pulse);
          attribute.setZ(index, -0.9 - lane * 0.02 + Math.sin(x + elapsed) * 0.02);
        }
        attribute.needsUpdate = true;
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.dispose();
      core.geometry.dispose();
      inner.geometry.dispose();
      rings.forEach((ring) => ring.geometry.dispose());
      particleGeometry.dispose();
      waveLines.forEach((line) => line.geometry.dispose());
      [...ringMaterials, waveMaterial, core.material, inner.material, particles.material].forEach((material) => material.dispose());
    };
  }, []);

  return <canvas ref={canvasRef} className="jarvis-canvas" aria-label="JARVIS predictive core visualization" />;
}
