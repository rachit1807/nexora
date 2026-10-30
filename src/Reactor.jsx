import React, { useEffect, useRef } from "react";
import * as THREE from "three";
export default function Reactor({ boost = false, paused = false }) {
  const mount = useRef(null),
    control = useRef({ boost, paused });
  control.current = { boost, paused };
  useEffect(() => {
    const node = mount.current;
    if (!node) return;
    let renderer, frame, observer;
    const geometries = [],
      materials = [];
    let disposed = false;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      node.classList.add("no-webgl");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.3, 13);
    const core = new THREE.Group();
    scene.add(core);
    core.rotation.x = 0.12;
    core.rotation.y = -0.18;
    const mat = (color, metalness = 0.7, roughness = 0.3, emissive = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        emissive,
        emissiveIntensity: 1.6,
      });
      materials.push(m);
      return m;
    };
    const metal = mat(0x344351),
      dark = mat(0x0b1520),
      gold = mat(0xb69664),
      glow = mat(0x83faff, 0.2, 0.15, 0x2cdce8),
      white = mat(0xf4ffff, 0.1, 0.1, 0x79faff);
    function torus(radius, tube, z, material) {
      const g = new THREE.TorusGeometry(radius, tube, 16, 144);
      geometries.push(g);
      const m = new THREE.Mesh(g, material);
      m.position.z = z;
      core.add(m);
      return m;
    }
    torus(2.45, 0.19, -0.32, metal);
    torus(2.22, 0.06, -0.08, gold);
    torus(2.05, 0.21, 0.02, dark);
    torus(1.81, 0.06, 0.2, glow);
    torus(1.65, 0.17, 0.15, metal);
    torus(1.4, 0.045, 0.32, glow);
    torus(0.84, 0.12, 0.49, metal);
    torus(0.69, 0.04, 0.62, glow);
    const spinning = new THREE.Group();
    core.add(spinning);
    for (let i = 0; i < 12; i++) {
      let a = (i * Math.PI) / 6;
      const g = new THREE.BoxGeometry(0.22, 0.51, 0.32);
      geometries.push(g);
      const m = new THREE.Mesh(g, i % 3 === 0 ? gold : metal);
      m.position.set(Math.sin(a) * 2.45, Math.cos(a) * 2.45, -0.13);
      m.rotation.z = -a;
      spinning.add(m);
      const gg = new THREE.BoxGeometry(0.1, 0.38, 0.1);
      geometries.push(gg);
      const light = new THREE.Mesh(gg, glow);
      light.position.set(Math.sin(a) * 2.08, Math.cos(a) * 2.08, 0.24);
      light.rotation.z = -a;
      core.add(light);
    }
    const tri = new THREE.Shape();
    tri.moveTo(0, 0.92);
    tri.lineTo(-0.81, -0.48);
    tri.lineTo(0.81, -0.48);
    tri.closePath();
    const tg = new THREE.ExtrudeGeometry(tri, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 2,
      steps: 1,
    });
    geometries.push(tg);
    const triangle = new THREE.Mesh(tg, white);
    triangle.position.z = 0.56;
    core.add(triangle);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const g = new THREE.BoxGeometry(0.18, 1.08, 0.22);
      geometries.push(g);
      const p = new THREE.Mesh(g, gold);
      p.position.set(Math.sin(a) * 1.12, Math.cos(a) * 1.12, 0.54);
      p.rotation.z = -a;
      core.add(p);
    }
    scene.add(new THREE.AmbientLight(0xafdfff, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 5);
    key.position.set(-3, 5, 8);
    scene.add(key);
    const rim = new THREE.PointLight(0x25eaff, 35, 20);
    rim.position.set(2, -2, 3);
    scene.add(rim);
    let pointer = { x: 0, y: 0 },
      visible = true;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const move = (e) => {
      const r = node.getBoundingClientRect();
      pointer = {
        x: (e.clientX - r.left) / r.width - 0.5,
        y: (e.clientY - r.top) / r.height - 0.5,
      };
    };
    const leave = () => (pointer = { x: 0, y: 0 });
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    const size = () => {
      if (disposed) return;
      const w = node.clientWidth,
        h = node.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    observer = new ResizeObserver(size);
    observer.observe(node);
    size();
    const io = new IntersectionObserver(
      ([entry]) => (visible = entry.isIntersecting),
    );
    io.observe(node);
    let t = 0;
    function animate() {
      frame = requestAnimationFrame(animate);
      if (!visible || document.hidden) return;
      if (!reduce.matches && !control.current.paused) {
        t += 0.012;
        spinning.rotation.z += control.current.boost ? 0.009 : 0.0015;
        core.rotation.y += (pointer.x * 0.4 - 0.15 - core.rotation.y) * 0.035;
        core.rotation.x += (pointer.y * 0.3 + 0.12 - core.rotation.x) * 0.035;
        core.position.y = Math.sin(t) * 0.08;
        glow.emissiveIntensity = control.current.boost
          ? 3
          : 1.5 + Math.sin(t * 2) * 0.3;
      }
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      io.disconnect();
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      className={`reactor-space ${boost ? "boost" : ""}`}
      ref={mount}
      role="img"
      aria-label="Interactive three dimensional arc reactor with illuminated cyan rings and a triangular energy core"
    >
      <div className="reactor-aura" />
      <div className="reactor-fallback">
        <span>△</span>
      </div>
    </div>
  );
}
