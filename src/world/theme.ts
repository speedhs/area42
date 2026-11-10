import * as THREE from "three";
import type { AABB, CellMaterials, NoteDef } from "./types";

/**
 * Cel megastructure palette — flat violet panels, pale sun fog, ink edges.
 * Story unchanged; only the skin of the machine.
 */
export const Theme = {
  bg: 0x14121c,
  fog: 0xc8b898,
  wall: 0x3a3350,
  floor: 0x2a2438,
  ceiling: 0x221c30,
  dark: 0x12101a,
  /** Pale emissive “window” / true-path heat */
  accent: 0xf5f0e6,
  /** Cool false-path / echo */
  crt: 0x7a9cff,
  warn: 0xc8a070,
  rivet: 0x5a5470,
  ink: 0x09070e,
} as const;

export function createMaterials(): CellMaterials {
  return {
    wall: new THREE.MeshStandardMaterial({
      color: Theme.wall,
      roughness: 0.55,
      metalness: 0.35,
      flatShading: true,
    }),
    floor: new THREE.MeshStandardMaterial({
      color: Theme.floor,
      roughness: 0.65,
      metalness: 0.3,
      flatShading: true,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: Theme.ceiling,
      roughness: 0.7,
      metalness: 0.25,
      flatShading: true,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: Theme.accent,
      roughness: 0.35,
      metalness: 0.2,
      emissive: Theme.accent,
      emissiveIntensity: 0.85,
      flatShading: true,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: Theme.dark,
      roughness: 0.55,
      metalness: 0.4,
      flatShading: true,
    }),
    voidMat: new THREE.MeshBasicMaterial({ color: 0x05040a }),
  };
}

export function boxMesh(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function wallCollider(
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
): AABB {
  return {
    min: { x: cx - w / 2, y: cy - h / 2, z: cz - d / 2 },
    max: { x: cx + w / 2, y: cy + h / 2, z: cz + d / 2 },
  };
}

/** Terminal note — pale sun phosphor or cool echo. */
export function makeNoteTexture(
  text: string,
  phosphor: "green" | "orange" = "orange",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0c0a14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  const glow = phosphor === "green" ? "#7a9cff" : "#f5f0e6";
  ctx.strokeStyle = glow;
  ctx.lineWidth = 5;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  // Ink outer rule
  ctx.strokeStyle = "#09070e";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  ctx.fillStyle = glow;
  ctx.font = "bold 40px 'Share Tech Mono', 'IBM Plex Mono', Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = glow;
  ctx.shadowBlur = phosphor === "green" ? 10 : 16;

  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (ctx.measureText(trial).width > canvas.width - 120) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);

  const startY = canvas.height / 2 - ((lines.length - 1) * 50) / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, canvas.width / 2, startY + i * 50);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNoteMesh(note: NoteDef): THREE.Mesh {
  const phosphor = note.phosphor ?? "orange";
  const tex = makeNoteTexture(note.text, phosphor);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), mat);
  mesh.position.set(note.position.x, note.position.y, note.position.z);
  mesh.rotation.y = note.yaw;
  mesh.userData.noteId = note.id;
  return mesh;
}

export function addPanelLines(
  group: THREE.Group,
  width: number,
  depth: number,
  y = 0.015,
): void {
  const pts: number[] = [];
  const hw = width / 2;
  const hd = depth / 2;
  const step = 1.4;
  for (let x = -hw; x <= hw + 0.001; x += step) {
    pts.push(x, y, -hd, x, y, hd);
  }
  for (let z = -hd; z <= hd + 0.001; z += step) {
    pts.push(-hw, y, z, hw, y, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  group.add(
    new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: Theme.ink,
        transparent: true,
        opacity: 0.55,
      }),
    ),
  );
}

/** Thin ink edges along room extents — cel outline cue. */
export function addInkEdges(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
): void {
  const ink = new THREE.MeshBasicMaterial({ color: Theme.ink });
  const t = 0.035;
  // Floor perimeter
  group.add(boxMesh(w + 0.05, t, t, 0, 0.02, -d / 2, ink));
  group.add(boxMesh(w + 0.05, t, t, 0, 0.02, d / 2, ink));
  group.add(boxMesh(t, t, d + 0.05, -w / 2, 0.02, 0, ink));
  group.add(boxMesh(t, t, d + 0.05, w / 2, 0.02, 0, ink));
  // Wall–ceiling seams
  group.add(boxMesh(w + 0.05, t, t, 0, h - 0.02, -d / 2, ink));
  group.add(boxMesh(w + 0.05, t, t, 0, h - 0.02, d / 2, ink));
  group.add(boxMesh(t, t, d + 0.05, -w / 2, h - 0.02, 0, ink));
  group.add(boxMesh(t, t, d + 0.05, w / 2, h - 0.02, 0, ink));
  // Vertical corners
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      group.add(
        boxMesh(t, h, t, (sx * w) / 2, h / 2, (sz * d) / 2, ink),
      );
    }
  }
}

/** Greeble blocks along a wall — megastructure detail. */
export function addRivets(
  group: THREE.Group,
  mats: CellMaterials,
  x: number,
  z: number,
  along: "x" | "z",
  length: number,
  y = 1.4,
): void {
  const n = Math.max(3, Math.floor(length / 1.2));
  const block = mats.dark;
  const lite = mats.accent;
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1) - 0.5) * length * 0.85;
    const rx = along === "x" ? x + u : x;
    const rz = along === "z" ? z + u : z;
    const h = 0.35 + (i % 3) * 0.15;
    group.add(boxMesh(0.35, h, 0.18, rx, y + (i % 2) * 0.2, rz, block));
    if (i % 2 === 0) {
      group.add(boxMesh(0.2, 0.35, 0.06, rx, y + 0.55, rz, lite));
    }
  }
}

export function addMachineLight(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  color: number = Theme.accent,
  intensity = 28,
  distance = 16,
): void {
  const light = new THREE.PointLight(color, intensity * 0.85, distance, 2);
  light.position.set(x, y, z);
  group.add(light);
  // Pale window panel instead of industrial fixture
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.9, 0.08),
    new THREE.MeshStandardMaterial({
      color: Theme.dark,
      emissive: color,
      emissiveIntensity: 1.1,
      metalness: 0.3,
      roughness: 0.4,
      flatShading: true,
    }),
  );
  fixture.position.set(x, y, z);
  group.add(fixture);
  // Ink frame
  const ink = new THREE.MeshBasicMaterial({ color: Theme.ink });
  group.add(boxMesh(0.62, 0.04, 0.1, x, y + 0.48, z, ink));
  group.add(boxMesh(0.62, 0.04, 0.1, x, y - 0.48, z, ink));
}

export function roomShell(
  group: THREE.Group,
  mats: CellMaterials,
  w: number,
  h: number,
  d: number,
  door?: { wall: "n" | "s" | "e" | "w"; width: number; height: number },
): AABB[] {
  const colliders: AABB[] = [];
  const t = 0.22;

  group.add(boxMesh(w, 0.12, d, 0, -0.06, 0, mats.floor));
  group.add(boxMesh(w, 0.12, d, 0, h + 0.06, 0, mats.ceiling));
  addPanelLines(group, w, d);
  addInkEdges(group, w, h, d);

  // Pale path spine
  group.add(boxMesh(0.16, 0.02, d * 0.9, 0, 0.01, 0, mats.accent));

  const walls: Array<{
    key: "n" | "s" | "e" | "w";
    cx: number;
    cy: number;
    cz: number;
    bw: number;
    bh: number;
    bd: number;
  }> = [
    { key: "n", cx: 0, cy: h / 2, cz: -d / 2 - t / 2, bw: w + t * 2, bh: h, bd: t },
    { key: "s", cx: 0, cy: h / 2, cz: d / 2 + t / 2, bw: w + t * 2, bh: h, bd: t },
    { key: "w", cx: -w / 2 - t / 2, cy: h / 2, cz: 0, bw: t, bh: h, bd: d },
    { key: "e", cx: w / 2 + t / 2, cy: h / 2, cz: 0, bw: t, bh: h, bd: d },
  ];

  for (const wall of walls) {
    if (door && wall.key === door.wall) {
      const doorW = door.width;
      const doorH = door.height;
      if (wall.key === "n" || wall.key === "s") {
        const side = (w - doorW) / 2;
        const leftX = -w / 2 + side / 2;
        const rightX = w / 2 - side / 2;
        const aboveH = h - doorH;
        const aboveY = doorH + aboveH / 2;
        for (const [cx, bw] of [
          [leftX, side],
          [rightX, side],
        ] as const) {
          group.add(boxMesh(bw, h, t, cx, h / 2, wall.cz, mats.wall));
          colliders.push(wallCollider(cx, h / 2, wall.cz, bw, h, t));
        }
        if (aboveH > 0.01) {
          group.add(boxMesh(doorW, aboveH, t, 0, aboveY, wall.cz, mats.wall));
          colliders.push(wallCollider(0, aboveY, wall.cz, doorW, aboveH, t));
        }
        group.add(
          boxMesh(doorW + 0.12, 0.06, 0.08, 0, doorH + 0.03, wall.cz, mats.accent),
        );
      } else {
        const side = (d - doorW) / 2;
        const nearZ = -d / 2 + side / 2;
        const farZ = d / 2 - side / 2;
        const aboveH = h - doorH;
        const aboveY = doorH + aboveH / 2;
        for (const [cz, bd] of [
          [nearZ, side],
          [farZ, side],
        ] as const) {
          group.add(boxMesh(t, h, bd, wall.cx, h / 2, cz, mats.wall));
          colliders.push(wallCollider(wall.cx, h / 2, cz, t, h, bd));
        }
        if (aboveH > 0.01) {
          group.add(
            boxMesh(t, aboveH, doorW, wall.cx, aboveY, 0, mats.wall),
          );
          colliders.push(wallCollider(wall.cx, aboveY, 0, t, aboveH, doorW));
        }
      }
    } else {
      group.add(
        boxMesh(wall.bw, wall.bh, wall.bd, wall.cx, wall.cy, wall.cz, mats.wall),
      );
      colliders.push(
        wallCollider(wall.cx, wall.cy, wall.cz, wall.bw, wall.bh, wall.bd),
      );
    }
  }

  group.add(new THREE.AmbientLight(0x3a3550, 0.32));
  group.add(new THREE.HemisphereLight(0xf0e0c0, 0x1a1028, 0.28));
  return colliders;
}

/** Identity tell panel — pale = primary, cool = echo. */
export function addCrtPanel(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  yaw: number,
  label: string,
  hot: boolean,
): void {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.4, 0.08),
    new THREE.MeshStandardMaterial({
      color: Theme.dark,
      metalness: 0.45,
      roughness: 0.45,
      flatShading: true,
    }),
  );
  frame.position.set(x, y, z);
  frame.rotation.y = yaw;
  group.add(frame);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0c0a14";
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = hot ? "#f5f0e6" : "#7a9cff";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = hot ? "#f5f0e6" : "#7a9cff";
  ctx.shadowBlur = hot ? 20 : 10;
  ctx.fillText(label, 128, 96);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.3),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.set(x, y, z);
  screen.rotation.y = yaw;
  const face = new THREE.Vector3(0, 0, 1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yaw,
  );
  screen.position.add(face.multiplyScalar(0.045));
  group.add(screen);
}
