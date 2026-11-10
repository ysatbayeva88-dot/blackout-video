import React, { useMemo } from "react";
import * as THREE from "three";
import { glowTexture } from "./textures";

/** Constant-pixel-size glowing light points (runway lights, city lights...). */
export const LightPoints: React.FC<{
  positions: number[];
  color?: string;
  colors?: number[];
  size: number;
  opacity?: number;
}> = ({ positions, color = "#ffffff", colors, size, opacity = 1 }) => {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    if (colors) g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial
        map={glowTexture()}
        color={colors ? "#ffffff" : color}
        vertexColors={Boolean(colors)}
        size={size}
        sizeAttenuation={false}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
        toneMapped={false}
      />
    </points>
  );
};
