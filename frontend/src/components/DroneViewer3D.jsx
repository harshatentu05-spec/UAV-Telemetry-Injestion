import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function DroneViewer3D({
  status = 'ACTIVE',
  battery = 100,
  heading = 0,
}) {
  const mountRef = useRef(null);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer, scene, camera, droneGroup, animationFrameId;
    const rotors = [];

    try {
      const width = container.clientWidth || 280;
      const height = container.clientHeight || 150;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 3.2, 5.2);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Lighting
      const ambient = new THREE.AmbientLight(0x38bdf8, 0.6);
      scene.add(ambient);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(5, 10, 7);
      scene.add(dirLight);

      const statusColor = status === 'CRITICAL' ? 0xef4444 : status === 'WARNING' ? 0xf59e0b : 0x00f0ff;
      const pointLight = new THREE.PointLight(statusColor, 1.5, 8);
      pointLight.position.set(0, -0.5, 0);
      scene.add(pointLight);

      // Drone Group
      droneGroup = new THREE.Group();
      scene.add(droneGroup);

      // Materials
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x18202f,
        roughness: 0.35,
        metalness: 0.85,
      });

      const accentMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.5,
        metalness: 0.5,
      });

      const glowMat = new THREE.MeshBasicMaterial({
        color: statusColor,
      });

      const rotorMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.7,
      });

      // 1. Central Fuselage
      const fuselageGeo = new THREE.BoxGeometry(0.9, 0.28, 1.3);
      const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
      droneGroup.add(fuselage);

      // Top Avionics Canopy
      const canopyGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.2, 16);
      const canopy = new THREE.Mesh(canopyGeo, accentMat);
      canopy.position.y = 0.2;
      droneGroup.add(canopy);

      // Status Beacon Ring
      const ringGeo = new THREE.TorusGeometry(0.38, 0.03, 8, 24);
      const beaconRing = new THREE.Mesh(ringGeo, glowMat);
      beaconRing.rotation.x = Math.PI / 2;
      beaconRing.position.y = 0.22;
      droneGroup.add(beaconRing);

      // Front Camera Gimbal Pod
      const gimbalArmGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8);
      const gimbalArm = new THREE.Mesh(gimbalArmArm => gimbalArmGeo, bodyMat);
      gimbalArm.position.set(0, -0.15, 0.65);
      droneGroup.add(gimbalArm);

      const cameraGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const cameraPod = new THREE.Mesh(cameraGeo, accentMat);
      cameraPod.position.set(0, -0.25, 0.72);
      droneGroup.add(cameraPod);

      const lensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, -0.25, 0.88);
      droneGroup.add(lens);

      // 4 Carbon Arms & Rotors (X-Configuration)
      const armAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
      const armLength = 1.6;

      armAngles.forEach((angle, idx) => {
        const armGroup = new THREE.Group();
        armGroup.rotation.y = angle;

        // Arm Tube
        const tubeGeo = new THREE.CylinderGeometry(0.045, 0.045, armLength, 8);
        const tube = new THREE.Mesh(tubeGeo, bodyMat);
        tube.rotation.z = Math.PI / 2;
        tube.position.x = armLength / 2;
        armGroup.add(tube);

        // Motor Hub
        const motorGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12);
        const motor = new THREE.Mesh(motorGeo, accentMat);
        motor.position.x = armLength;
        motor.position.y = 0.08;
        armGroup.add(motor);

        // Navigation LED under motor
        const ledColor = idx === 0 ? 0x10b981 : idx === 1 ? 0xef4444 : 0x00f0ff;
        const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: ledColor }));
        led.position.set(armLength, -0.05, 0);
        armGroup.add(led);

        // Propeller Rotor Blade
        const propGroup = new THREE.Group();
        propGroup.position.set(armLength, 0.2, 0);

        const bladeGeo = new THREE.BoxGeometry(0.9, 0.015, 0.09);
        const blade = new THREE.Mesh(bladeGeo, rotorMat);
        propGroup.add(blade);

        armGroup.add(propGroup);
        rotors.push(propGroup);
        droneGroup.add(armGroup);
      });

      // Mouse drag rotation
      let isDragging = false;
      let prevMouseX = 0;
      let prevMouseY = 0;

      const onMouseDown = (e) => {
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        droneGroup.rotation.y += deltaX * 0.015;
        droneGroup.rotation.x = Math.max(-0.5, Math.min(0.5, droneGroup.rotation.x + deltaY * 0.015));
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      };

      const onMouseUp = () => {
        isDragging = false;
      };

      container.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      // Animation Loop
      let clock = new THREE.Clock();
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // Spin propellers
        rotors.forEach((rotor, i) => {
          rotor.rotation.y += (i % 2 === 0 ? 35 : -35) * delta;
        });

        // Gentle idle hover & slow orbit
        if (!isDragging) {
          droneGroup.position.y = Math.sin(time * 2.2) * 0.08;
          droneGroup.rotation.y += 0.3 * delta;
          droneGroup.rotation.z = Math.sin(time * 1.5) * 0.04;
        }

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        container.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    } catch (err) {
      console.warn('3D WebGL initialization failed, using 2D fallback:', err);
      setWebglError(true);
    }
  }, [status, battery, heading]);

  if (webglError) {
    return (
      <div style={{
        width: '100%',
        height: '140px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle, rgba(0,240,255,0.08) 0%, rgba(13,21,36,0) 70%)',
      }}>
        <svg width="90" height="90" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="42" stroke="#1e2c44" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="14" fill="#121c2e" stroke="#00f0ff" strokeWidth="2" />
          <line x1="20" y1="20" x2="80" y2="80" stroke="#38bdf8" strokeWidth="3" />
          <line x1="80" y1="20" x2="20" y2="80" stroke="#38bdf8" strokeWidth="3" />
          <circle cx="20" cy="20" r="8" fill="#162238" stroke="#00f0ff" strokeWidth="1.5" />
          <circle cx="80" cy="20" r="8" fill="#162238" stroke="#00f0ff" strokeWidth="1.5" />
          <circle cx="20" cy="80" r="8" fill="#162238" stroke="#00f0ff" strokeWidth="1.5" />
          <circle cx="80" cy="80" r="8" fill="#162238" stroke="#00f0ff" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '140px',
        cursor: 'grab',
        position: 'relative',
        overflow: 'hidden',
      }}
      title="Click and drag to rotate 3D UAV model"
    />
  );
}
