import * as THREE from "three";
import type { AABB, CellMaterials, NoteDef } from "./types";

/** Inside-the-machine palette — steel, CRT green, industrial orange. */
export const Theme = {
  bg: 0x0b0c10,
  fog: 0x18140f,
  wall: 0x5c6270,
  floor: 0x404550,
  ceiling: 0x343845,
  dark: 0x1a1d24,
  accent: 0xe07020,
  crt: 0x3dff9a,
  warn: 0xc44a1a,
  rivet: 0x8a909c,
} as const;

export function createMaterials(): CellMaterials {
  return {
    wall: new THREE.MeshStandardMaterial({
      color: Theme.wall,
      roughness: 0.55,
      metalness: 0.65,
    }),
    floor: new THREE.MeshStandardMaterial({
      color: Theme.floor,
      roughness: 0.7,
      metalness: 0.45,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: Theme.ceiling,
      roughness: 0.75,
      metalness: 0.4,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: Theme.accent,
      roughness: 0.35,
      metalness: 0.55,
      emissive: Theme.accent,
      emissiveIntensity: 0.35,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: Theme.dark,
      roughness: 0.6,
      metalness: 0.5,
    }),
    voidMat: new THREE.MeshBasicMaterial({ color: 0x050608 }),
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

/** CRT-style terminal note (dark glass, green/orange phosphor). */
export function makeNoteTexture(
  text: string,
  phosphor: "green" | "orange" = "orange",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a0e0c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Scanlines
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  const glow = phosphor === "green" ? "#3dff9a" : "#e07020";
  ctx.strokeStyle = glow;
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = glow;
  ctx.font = "bold 40px 'Share Tech Mono', 'IBM Plex Mono', Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;

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
  const step = 1.2;
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
        color: Theme.rivet,
        transparent: true,
        opacity: 0.45,
      }),
    ),
  );
}

/** Decorative rivets along a wall strip. */
export function addRivets(
  group: THREE.Group,
  mats: CellMaterials,
  x: number,
  z: number,
  along: "x" | "z",
  length: number,
  y = 1.4,
): void {
  const n = Math.max(3, Math.floor(length / 1.1));
  const rivetMat = mats.accent.clone();
  rivetMat.emissiveIntensity = 0.05;
  rivetMat.color = new THREE.Color(Theme.rivet);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) - 0.5) * length * 0.85;
    const rx = along === "x" ? x + t : x;
    const rz = along === "z" ? z + t : z;
    group.add(boxMesh(0.06, 0.06, 0.06, rx, y, rz, rivetMat));
    group.add(boxMesh(0.06, 0.06, 0.06, rx, y - 0.7, rz, rivetMat));
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
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y, z);
  group.add(light);
  // Fixture
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.08, 0.35),
    new THREE.MeshStandardMaterial({
      color: Theme.dark,
      emissive: color,
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.4,
    }),
  );
  fixture.position.set(x, y + 0.05, z);
  group.add(fixture);
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

  // Warning stripe on floor midline
  group.add(boxMesh(0.18, 0.02, d * 0.9, 0, 0.01, 0, mats.accent));

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
        // Door frame accent
        group.add(
          boxMesh(doorW + 0.1, 0.06, 0.08, 0, doorH + 0.03, wall.cz, mats.accent),
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

  group.add(new THREE.AmbientLight(0x4a5560, 0.25));
  return colliders;
}

/** Hex CRT panel for identity tells. */
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
      metalness: 0.7,
      roughness: 0.4,
    }),
  );
  frame.position.set(x, y, z);
  frame.rotation.y = yaw;
  group.add(frame);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#06140c";
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = hot ? "#e07020" : "#2a8f5a";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = hot ? "#e07020" : "#3dff9a";
  ctx.shadowBlur = hot ? 18 : 8;
  ctx.fillText(label, 128, 96);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.3),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.set(x, y, z);
  screen.rotation.y = yaw;
  // Nudge toward viewer
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  // Plane faces +Z; after yaw, offset along facing
  const face = new THREE.Vector3(0, 0, 1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yaw,
  );
  screen.position.add(face.multiplyScalar(0.045));
  void forward;
  group.add(screen);
}
