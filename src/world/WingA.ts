import * as THREE from "three";
import type { AABB, CellDef, PuzzleState } from "./types";
import {
  addMachineLight,
  addPanelLines,
  addRivets,
  boxMesh,
  createMaterials,
  createNoteMesh,
  roomShell,
  Theme,
  wallCollider,
} from "./theme";

export { createMaterials, createNoteMesh };

function foyerDef(): CellDef {
  const W = 6;
  const H = 3.2;
  const D = 6;

  return {
    id: "foyer",
    worldOffset: { x: 0, y: 0, z: 0 },
    spawn: { position: { x: 0, y: 1.7, z: 1.5 }, yaw: 0 },
    build(group, mats) {
      const colliders = roomShell(group, mats, W, H, D, {
        wall: "n",
        width: 1.4,
        height: 2.2,
      });

      // Sealed entry hatch on south wall (visual only).
      group.add(boxMesh(1.6, 2.4, 0.08, 0, 1.2, D / 2 - 0.05, mats.dark));
      group.add(boxMesh(0.15, 0.15, 0.12, 0.55, 1.2, D / 2 + 0.02, mats.accent));

      addMachineLight(group, 0, 2.9, 0, Theme.accent, 32, 16);
      addRivets(group, mats, -W / 2 + 0.12, 0, "z", D);

      return colliders;
    },
    notes: [
      {
        id: "foyer-map",
        text: "THE MAP IS WHAT YOU EXPECT.",
        position: { x: -W / 2 + 0.12, y: 1.7, z: 0 },
        yaw: Math.PI / 2,
        phosphor: "orange",
      },
    ],
    seams: [
      {
        id: "foyer-to-arrow",
        trigger: {
          min: { x: -0.7, y: 0, z: -D / 2 - 0.4 },
          max: { x: 0.7, y: 2.2, z: -D / 2 + 0.15 },
        },
        destCellId: "arrowHall",
        destPose: {
          position: { x: 0, y: 1.7, z: 8.5 },
          yaw: 0,
        },
      },
    ],
  };
}

function arrowHallDef(): CellDef {
  const W = 3;
  const H = 3;
  const D = 20;

  return {
    id: "arrowHall",
    worldOffset: { x: 100, y: 0, z: 0 },
    build(group, mats) {
      const colliders: AABB[] = [];
      const t = 0.2;

      group.add(boxMesh(W, 0.1, D, 0, -0.05, 0, mats.floor));
      group.add(boxMesh(W, 0.1, D, 0, H + 0.05, 0, mats.ceiling));
      addPanelLines(group, W, D);

      // Side walls only — ends are open seams.
      group.add(boxMesh(t, H, D, -W / 2 - t / 2, H / 2, 0, mats.wall));
      group.add(boxMesh(t, H, D, W / 2 + t / 2, H / 2, 0, mats.wall));
      colliders.push(wallCollider(-W / 2 - t / 2, H / 2, 0, t, H, D));
      colliders.push(wallCollider(W / 2 + t / 2, H / 2, 0, t, H, D));

      // Floor arrow pointing toward -Z (direction of travel into the loop).
      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, 0.9);
      arrowShape.lineTo(0.45, 0);
      arrowShape.lineTo(0.18, 0);
      arrowShape.lineTo(0.18, -0.9);
      arrowShape.lineTo(-0.18, -0.9);
      arrowShape.lineTo(-0.18, 0);
      arrowShape.lineTo(-0.45, 0);
      arrowShape.closePath();
      const arrowGeo = new THREE.ShapeGeometry(arrowShape);
      const arrow = new THREE.Mesh(arrowGeo, mats.accent);
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.set(0, 0.02, 0);
      group.add(arrow);

      addMachineLight(group, 0, 2.6, 0, Theme.accent, 30, 18);
      addRivets(group, mats, -W / 2 + 0.12, 0, "z", D);

      return colliders;
    },
    notes: [
      {
        id: "arrow-loop",
        text: "YOU HAVE BEEN HERE. TURN AROUND.",
        position: { x: W / 2 - 0.12, y: 1.7, z: 2 },
        yaw: -Math.PI / 2,
        visible: (s: PuzzleState) => s.loopNoteShown,
      },
    ],
    seams: [
      // Far end (−Z): walk with the arrow → loop back to near start.
      {
        id: "arrow-loop-far",
        trigger: {
          min: { x: -1.4, y: 0, z: -D / 2 - 0.5 },
          max: { x: 1.4, y: 2.5, z: -D / 2 + 0.2 },
        },
        destCellId: "arrowHall",
        destPose: {
          position: { x: 0, y: 1.7, z: D / 2 - 1.2 },
          yaw: 0,
        },
        onCross(state) {
          state.loopCount += 1;
          if (state.loopCount >= 1) state.loopNoteShown = true;
        },
      },
      // Near end (+Z): after one loop, exit to Glance; otherwise bounce back.
      {
        id: "arrow-to-glance",
        trigger: {
          min: { x: -1.4, y: 0, z: D / 2 - 0.2 },
          max: { x: 1.4, y: 2.5, z: D / 2 + 0.5 },
        },
        destCellId: "glance",
        destPose: {
          position: { x: 0, y: 1.7, z: 3.5 },
          yaw: 0,
        },
        condition: (s) => s.loopCount >= 1,
      },
      {
        id: "arrow-near-bounce",
        trigger: {
          min: { x: -1.4, y: 0, z: D / 2 - 0.2 },
          max: { x: 1.4, y: 2.5, z: D / 2 + 0.5 },
        },
        destCellId: "arrowHall",
        destPose: {
          position: { x: 0, y: 1.7, z: D / 2 - 1.5 },
          yaw: 0,
        },
        condition: (s) => s.loopCount < 1,
      },
    ],
  };
}

function glanceDef(): CellDef {
  const W = 4;
  const H = 3.5;
  const nearLen = 4;
  const farLen = 4;
  const gap = 5;
  const totalD = nearLen + gap + farLen;

  return {
    id: "glance",
    worldOffset: { x: 200, y: 0, z: 0 },
    build(group, mats) {
      const colliders: AABB[] = [];
      const t = 0.2;

      // Near ledge floor (z from +totalD/2 toward gap).
      const nearZ = totalD / 2 - nearLen / 2;
      const farZ = -totalD / 2 + farLen / 2;

      group.add(boxMesh(W, 0.1, nearLen, 0, -0.05, nearZ, mats.floor));
      group.add(boxMesh(W, 0.1, farLen, 0, -0.05, farZ, mats.floor));

      const nearGrid = new THREE.Group();
      nearGrid.position.z = nearZ;
      addPanelLines(nearGrid, W, nearLen, 0.01);
      group.add(nearGrid);
      const farGrid = new THREE.Group();
      farGrid.position.z = farZ;
      addPanelLines(farGrid, W, farLen, 0.01);
      group.add(farGrid);

      // Void under gap
      group.add(boxMesh(W + 2, 0.05, gap + 2, 0, -4, 0, mats.voidMat));

      // Ceiling continuous
      group.add(boxMesh(W, 0.1, totalD, 0, H + 0.05, 0, mats.ceiling));

      // Side walls
      group.add(boxMesh(t, H, totalD, -W / 2 - t / 2, H / 2, 0, mats.wall));
      group.add(boxMesh(t, H, totalD, W / 2 + t / 2, H / 2, 0, mats.wall));
      colliders.push(wallCollider(-W / 2 - t / 2, H / 2, 0, t, H, totalD));
      colliders.push(wallCollider(W / 2 + t / 2, H / 2, 0, t, H, totalD));

      // Back wall on near side
      group.add(
        boxMesh(W + t * 2, H, t, 0, H / 2, totalD / 2 + t / 2, mats.wall),
      );
      colliders.push(
        wallCollider(0, H / 2, totalD / 2 + t / 2, W + t * 2, H, t),
      );

      // Far end open to long hall via seam — thin door frame
      const doorW = 1.4;
      const doorH = 2.2;
      const side = (W - doorW) / 2;
      const farWallZ = -totalD / 2 - t / 2;
      group.add(
        boxMesh(side, H, t, -W / 2 + side / 2, H / 2, farWallZ, mats.wall),
      );
      group.add(
        boxMesh(side, H, t, W / 2 - side / 2, H / 2, farWallZ, mats.wall),
      );
      colliders.push(
        wallCollider(-W / 2 + side / 2, H / 2, farWallZ, side, H, t),
      );
      colliders.push(
        wallCollider(W / 2 - side / 2, H / 2, farWallZ, side, H, t),
      );
      const aboveH = H - doorH;
      if (aboveH > 0) {
        group.add(
          boxMesh(doorW, aboveH, t, 0, doorH + aboveH / 2, farWallZ, mats.wall),
        );
        colliders.push(
          wallCollider(0, doorH + aboveH / 2, farWallZ, doorW, aboveH, t),
        );
      }

      // Bridge overlaps both ledges so there is no walkable slit at the joins.
      const bridgeOverlap = 0.35;
      const bridgeLen = gap + bridgeOverlap * 2;
      const bridgeHalfW = 0.85;
      const bridge = boxMesh(
        bridgeHalfW * 2,
        0.08,
        bridgeLen,
        0,
        0.02,
        0,
        mats.accent,
      );
      bridge.name = "bridge";
      bridge.visible = false;
      group.add(bridge);

      addMachineLight(group, 0, 3.1, nearZ, Theme.accent, 36, 18);
      addMachineLight(group, 0, 3.1, farZ, Theme.accent, 28, 16);

      const nearMinZ = totalD / 2 - nearLen;
      const nearMaxZ = totalD / 2;
      const farMinZ = -totalD / 2;
      const farMaxZ = -totalD / 2 + farLen;

      // Store ledge extents on group for Game fall logic
      group.userData.nearLedge = {
        min: { x: -W / 2, y: 0, z: nearMinZ },
        max: { x: W / 2, y: 0.2, z: nearMaxZ },
      };
      group.userData.farLedge = {
        min: { x: -W / 2, y: 0, z: farMinZ },
        max: { x: W / 2, y: 0.2, z: farMaxZ },
      };
      // Collider overlaps ledge edges (same span as the mesh).
      group.userData.bridgeBox = {
        min: { x: -bridgeHalfW, y: 0, z: -bridgeLen / 2 },
        max: { x: bridgeHalfW, y: 0.2, z: bridgeLen / 2 },
      };
      group.userData.gapCenter = { x: 0, y: 0, z: 0 };
      group.userData.respawn = { x: 0, y: 1.7, z: nearZ };

      return colliders;
    },
    notes: [
      {
        id: "glance-note",
        text: "THE WAY ACROSS IS ABOVE YOUR CONCERN.",
        position: { x: -W / 2 + 0.12, y: 1.7, z: totalD / 2 - 2 },
        yaw: Math.PI / 2,
      },
    ],
    seams: [
      {
        id: "glance-to-long",
        trigger: {
          min: { x: -0.7, y: 0, z: -totalD / 2 - 0.6 },
          max: { x: 0.7, y: 2.4, z: -totalD / 2 + 0.35 },
        },
        destCellId: "longHall",
        destPose: {
          position: { x: 0, y: 1.7, z: 11 },
          yaw: 0,
        },
      },
    ],
  };
}

function longHallDef(): CellDef {
  // Thin wall at +Z end with door; corridor extends far toward -Z.
  const W = 3.5;
  const H = 3;
  const D = 28;
  const thinWallZ = D / 2;

  return {
    id: "longHall",
    worldOffset: { x: 300, y: 0, z: 0 },
    build(group, mats) {
      const colliders: AABB[] = [];
      const t = 0.15;

      group.add(boxMesh(W, 0.1, D, 0, -0.05, 0, mats.floor));
      group.add(boxMesh(W, 0.1, D, 0, H + 0.05, 0, mats.ceiling));
      addPanelLines(group, W, D);

      // Side walls
      group.add(boxMesh(t, H, D, -W / 2 - t / 2, H / 2, 0, mats.wall));
      group.add(boxMesh(t, H, D, W / 2 + t / 2, H / 2, 0, mats.wall));
      colliders.push(wallCollider(-W / 2 - t / 2, H / 2, 0, t, H, D));
      colliders.push(wallCollider(W / 2 + t / 2, H / 2, 0, t, H, D));

      // Thin entry wall at +Z with door (player enters from +Z looking -Z).
      const doorW = 1.4;
      const doorH = 2.2;
      const side = (W - doorW) / 2;
      const wz = thinWallZ + t / 2;
      group.add(
        boxMesh(side, H, t, -W / 2 + side / 2, H / 2, wz, mats.wall),
      );
      group.add(
        boxMesh(side, H, t, W / 2 - side / 2, H / 2, wz, mats.wall),
      );
      colliders.push(wallCollider(-W / 2 + side / 2, H / 2, wz, side, H, t));
      colliders.push(wallCollider(W / 2 - side / 2, H / 2, wz, side, H, t));
      const aboveH = H - doorH;
      group.add(
        boxMesh(doorW, aboveH, t, 0, doorH + aboveH / 2, wz, mats.wall),
      );
      colliders.push(
        wallCollider(0, doorH + aboveH / 2, wz, doorW, aboveH, t),
      );

      // Far end: OPEN hatch doorway (path forward) + sealed CRT panel (not a fake door).
      const farZ = -D / 2;
      const hatchW = 1.55;
      const hatchH = 2.35;

      const leftW = (W - hatchW) / 2;
      group.add(
        boxMesh(leftW, H, t, -W / 2 + leftW / 2, H / 2, farZ - t / 2, mats.wall),
      );
      colliders.push(
        wallCollider(-W / 2 + leftW / 2, H / 2, farZ - t / 2, leftW, H, t),
      );
      group.add(
        boxMesh(leftW, H, t, W / 2 - leftW / 2, H / 2, farZ - t / 2, mats.wall),
      );
      colliders.push(
        wallCollider(W / 2 - leftW / 2, H / 2, farZ - t / 2, leftW, H, t),
      );
      group.add(
        boxMesh(hatchW, aboveH, t, 0, hatchH + aboveH / 2, farZ - t / 2, mats.wall),
      );
      colliders.push(
        wallCollider(0, hatchH + aboveH / 2, farZ - t / 2, hatchW, aboveH, t),
      );

      // Door leaf parked OPEN against the left jamb — not blocking the exit.
      group.add(
        boxMesh(
          0.08,
          hatchH - 0.15,
          hatchW * 0.85,
          -hatchW / 2 - 0.12,
          hatchH / 2,
          farZ + 0.45,
          mats.dark,
        ),
      );
      group.add(
        boxMesh(
          0.1,
          0.1,
          0.1,
          -hatchW / 2 - 0.12,
          1.15,
          farZ + 0.75,
          mats.accent,
        ),
      );
      // Lit door frame so the opening reads as the way forward.
      group.add(
        boxMesh(hatchW + 0.16, 0.07, 0.08, 0, hatchH + 0.02, farZ, mats.accent),
      );
      group.add(
        boxMesh(0.07, hatchH, 0.08, -hatchW / 2 - 0.02, hatchH / 2, farZ, mats.accent),
      );
      group.add(
        boxMesh(0.07, hatchH, 0.08, hatchW / 2 + 0.02, hatchH / 2, farZ, mats.accent),
      );

      // Sealed CRT on the right wall — containment echo, not a walkable portal.
      const crtX = W / 2 - 0.55;
      const crtY = 1.55;
      group.add(boxMesh(0.95, 0.7, 0.1, crtX, crtY, farZ + 0.08, mats.dark));
      {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 384;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#06140c";
        ctx.fillRect(0, 0, 512, 384);
        ctx.strokeStyle = "#7a9cff";
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 12, 488, 360);
        ctx.fillStyle = "#7a9cff";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.fillText("ECHO // FOYER", 256, 170);
        ctx.font = "22px monospace";
        ctx.fillText("VIEW ONLY — NO TRANSIT", 256, 230);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(0.82, 0.58),
          new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
        );
        screen.position.set(crtX, crtY, farZ + 0.14);
        group.add(screen);
      }

      // Marker for thin wall thickness (visual cue)
      group.add(
        boxMesh(W + 0.4, 0.05, 0.4, 0, 0.02, thinWallZ, mats.accent),
      );

      addMachineLight(group, 0, 2.7, 8, Theme.accent, 40, 22);
      addMachineLight(group, 0, 2.7, -8, Theme.accent, 42, 22);
      addMachineLight(group, 0, 2.4, farZ + 1.2, Theme.accent, 24, 10);
      addRivets(group, mats, -W / 2 + 0.12, 0, "z", D);

      return colliders;
    },
    notes: [
      {
        id: "long-note",
        text: "THICKNESS IS A SUGGESTION.",
        position: { x: W / 2 - 0.12, y: 1.7, z: 6 },
        yaw: -Math.PI / 2,
        phosphor: "orange",
      },
      {
        id: "long-hatch-hint",
        text: "THE HATCH IS OPEN. WALK THE FRAME.",
        position: { x: -W / 2 + 0.12, y: 1.7, z: -10 },
        yaw: Math.PI / 2,
        phosphor: "green",
      },
    ],
    seams: [
      // Open hatch — live portal into the hatch chamber + walk-through.
      {
        id: "long-to-hatch",
        // Fire while still in the room — avoids wedging in the portal slit.
        trigger: {
          min: { x: -0.85, y: 0, z: -D / 2 + 0.05 },
          max: { x: 0.85, y: 2.4, z: -D / 2 + 1.1 },
        },
        destCellId: "hatch",
        destPose: {
          position: { x: 0, y: 1.7, z: 1.5 },
          yaw: 0,
        },
        portal: true,
        portalPlane: {
          center: { x: 0, y: 1.15, z: -D / 2 + 0.06 },
          width: 1.45,
          height: 2.2,
          normal: { x: 0, y: 0, z: 1 },
        },
      },
    ],
  };
}

function hatchDef(): CellDef {
  const W = 5;
  const H = 3.2;
  const D = 6;

  return {
    id: "hatch",
    worldOffset: { x: 400, y: 0, z: 0 },
    build(group, mats) {
      const colliders = roomShell(group, mats, W, H, D, {
        wall: "n",
        width: 1.55,
        height: 2.35,
      });

      // Terminal pedestal offset to the side so the path north stays clear.
      group.add(boxMesh(1.2, 1.0, 0.6, 1.55, 0.5, 0.8, mats.dark));
      group.add(boxMesh(1.0, 0.05, 0.5, 1.55, 1.02, 0.8, mats.accent));
      addMachineLight(group, 0, 2.9, 0, Theme.accent, 38, 14);
      addMachineLight(group, 0, 2.5, -2.2, Theme.accent, 30, 12);
      addRivets(group, mats, -W / 2 + 0.12, 0, "z", D);

      return colliders;
    },
    notes: [
      {
        id: "hatch-crt",
        text: "WING A STABLE. CONTINUE FORWARD INTO THE MACHINE.",
        position: { x: 1.55, y: 1.5, z: 1.12 },
        yaw: 0,
        phosphor: "orange",
      },
    ],
    seams: [
      {
        id: "hatch-to-identity",
        trigger: {
          min: { x: -0.85, y: 0, z: -D / 2 + 0.05 },
          max: { x: 0.85, y: 2.4, z: -D / 2 + 1.1 },
        },
        destCellId: "identityHub",
        destPose: {
          position: { x: 0, y: 1.7, z: 2.2 },
          yaw: 0,
        },
        portal: true,
        portalPlane: {
          center: { x: 0, y: 1.15, z: -D / 2 + 0.06 },
          width: 1.45,
          height: 2.2,
          normal: { x: 0, y: 0, z: 1 },
        },
        onCross(state) {
          state.wingAOpen = true;
        },
      },
    ],
  };
}

export function buildWingA(): CellDef[] {
  return [foyerDef(), arrowHallDef(), glanceDef(), longHallDef(), hatchDef()];
}