import * as THREE from "three";
import type { AABB, CellDef, PuzzleState } from "./types";
import {
  addCrtPanel,
  addMachineLight,
  addPanelLines,
  addRivets,
  boxMesh,
  Theme,
  wallCollider,
} from "./theme";

/**
 * Wing B — Identity.
 * Two throats share one shape. The echo returns you; the original continues.
 * Tell: the true corridor CRT burns industrial orange ("I"); the false burns cool green ("I").
 */
function identityHubDef(): CellDef {
  const W = 8;
  const H = 3.4;
  const D = 7;

  return {
    id: "identityHub",
    worldOffset: { x: 500, y: 0, z: 0 },
    spawn: { position: { x: 0, y: 1.7, z: 2.5 }, yaw: 0 },
    build(group, mats) {
      // Custom shell: S/E/W solid, N has twin door cuts (no solid north slab).
      const colliders: AABB[] = [];
      const t = 0.22;
      const doorW = 1.35;
      const doorH = 2.25;
      const leftDoorX = -2.0;
      const rightDoorX = 2.0;

      group.add(boxMesh(W, 0.12, D, 0, -0.06, 0, mats.floor));
      group.add(boxMesh(W, 0.12, D, 0, H + 0.06, 0, mats.ceiling));
      addPanelLines(group, W, D);
      group.add(boxMesh(0.18, 0.02, D * 0.7, 0, 0.01, 0, mats.accent));

      // South, east, west walls
      group.add(boxMesh(W + t * 2, H, t, 0, H / 2, D / 2 + t / 2, mats.wall));
      colliders.push(wallCollider(0, H / 2, D / 2 + t / 2, W + t * 2, H, t));
      group.add(boxMesh(t, H, D, -W / 2 - t / 2, H / 2, 0, mats.wall));
      group.add(boxMesh(t, H, D, W / 2 + t / 2, H / 2, 0, mats.wall));
      colliders.push(wallCollider(-W / 2 - t / 2, H / 2, 0, t, H, D));
      colliders.push(wallCollider(W / 2 + t / 2, H / 2, 0, t, H, D));

      const wallZ = -D / 2 - t / 2;
      // North wall segments: outer left, pier, outer right, lintels
      const outerLeftW = W / 2 + leftDoorX - doorW / 2;
      const outerRightW = W / 2 - rightDoorX - doorW / 2;
      const pierW = rightDoorX - leftDoorX - doorW;

      group.add(
        boxMesh(
          outerLeftW,
          H,
          t,
          -W / 2 + outerLeftW / 2,
          H / 2,
          wallZ,
          mats.wall,
        ),
      );
      colliders.push(
        wallCollider(-W / 2 + outerLeftW / 2, H / 2, wallZ, outerLeftW, H, t),
      );
      group.add(boxMesh(pierW, H, t, 0, H / 2, wallZ, mats.dark));
      colliders.push(wallCollider(0, H / 2, wallZ, pierW, H, t));
      group.add(
        boxMesh(
          outerRightW,
          H,
          t,
          W / 2 - outerRightW / 2,
          H / 2,
          wallZ,
          mats.wall,
        ),
      );
      colliders.push(
        wallCollider(W / 2 - outerRightW / 2, H / 2, wallZ, outerRightW, H, t),
      );

      const aboveH = H - doorH;
      for (const dx of [leftDoorX, rightDoorX]) {
        group.add(
          boxMesh(doorW, aboveH, t, dx, doorH + aboveH / 2, wallZ, mats.wall),
        );
        colliders.push(
          wallCollider(dx, doorH + aboveH / 2, wallZ, doorW, aboveH, t),
        );
        group.add(
          boxMesh(doorW + 0.12, 0.08, 0.1, dx, doorH + 0.04, wallZ, mats.accent),
        );
      }

      group.add(boxMesh(W * 0.8, 0.12, 0.12, 0, H - 0.25, 1.2, mats.dark));
      group.add(boxMesh(W * 0.8, 0.12, 0.12, 0, H - 0.25, -1.0, mats.dark));
      group.add(
        boxMesh(0.15, 0.15, D * 0.7, -W / 2 + 0.4, H - 0.35, 0, mats.accent),
      );

      addMachineLight(group, -2, 3.0, 0, Theme.accent, 40, 16);
      addMachineLight(group, 2, 3.0, 0, Theme.crt, 28, 14);
      addMachineLight(group, 0, 3.0, 2.5, Theme.accent, 36, 14);
      group.add(new THREE.AmbientLight(0x4a5560, 0.35));
      addRivets(group, mats, W / 2 - 0.12, 0, "z", D);

      return colliders;
    },
    notes: [
      {
        id: "identity-axiom",
        text: "TWO THROATS. ONE BREATHES HEAT.",
        position: { x: 0, y: 2.0, z: D / 2 - 0.2 },
        yaw: Math.PI,
        phosphor: "orange",
      },
      {
        id: "identity-echo",
        text: "THE ECHO RETURNS YOU. THE ORIGINAL CONTINUES.",
        position: { x: -W / 2 + 0.14, y: 1.7, z: 0 },
        yaw: Math.PI / 2,
        phosphor: "green",
        visible: (s: PuzzleState) => s.falsePathTaken,
      },
    ],
    seams: [
      {
        id: "hub-to-false",
        trigger: {
          min: { x: -2.0 - 0.7, y: 0, z: -D / 2 + 0.05 },
          max: { x: -2.0 + 0.7, y: 2.3, z: -D / 2 + 1.0 },
        },
        destCellId: "identityFalse",
        destPose: { position: { x: 0, y: 1.7, z: 4.5 }, yaw: 0 },
      },
      {
        id: "hub-to-true",
        trigger: {
          min: { x: 2.0 - 0.7, y: 0, z: -D / 2 + 0.05 },
          max: { x: 2.0 + 0.7, y: 2.3, z: -D / 2 + 1.0 },
        },
        destCellId: "identityTrue",
        destPose: { position: { x: 0, y: 1.7, z: 4.5 }, yaw: 0 },
      },
    ],
  };
}

function twinCorridor(
  id: string,
  worldX: number,
  hot: boolean,
  exit: {
    destCellId: string;
    destPose: { x: number; y: number; z: number; yaw: number };
    onCross?: (s: PuzzleState) => void;
  },
): CellDef {
  const W = 3.2;
  const H = 3.1;
  const D = 14;

  return {
    id,
    worldOffset: { x: worldX, y: 0, z: 0 },
    build(group, mats) {
      const colliders: AABB[] = [];
      const t = 0.22;

      group.add(boxMesh(W, 0.12, D, 0, -0.06, 0, mats.floor));
      group.add(boxMesh(W, 0.12, D, 0, H + 0.06, 0, mats.ceiling));
      addPanelLines(group, W, D);
      group.add(boxMesh(0.14, 0.02, D * 0.85, 0, 0.01, 0, mats.accent));

      group.add(boxMesh(t, H, D, -W / 2 - t / 2, H / 2, 0, mats.wall));
      group.add(boxMesh(t, H, D, W / 2 + t / 2, H / 2, 0, mats.wall));
      colliders.push(wallCollider(-W / 2 - t / 2, H / 2, 0, t, H, D));
      colliders.push(wallCollider(W / 2 + t / 2, H / 2, 0, t, H, D));

      // Cable tray
      group.add(boxMesh(0.5, 0.08, D * 0.9, 0, H - 0.2, 0, mats.dark));

      // Identity tell — CRT on the RIGHT wall for both; color differs.
      addCrtPanel(
        group,
        W / 2 - 0.14,
        1.55,
        1.5,
        -Math.PI / 2,
        "I",
        hot,
      );

      addMachineLight(
        group,
        0,
        2.7,
        2,
        hot ? Theme.accent : Theme.crt,
        hot ? 32 : 20,
        16,
      );
      addMachineLight(
        group,
        0,
        2.7,
        -3,
        hot ? Theme.accent : Theme.crt,
        hot ? 26 : 16,
        14,
      );
      addRivets(group, mats, -W / 2 + 0.12, 0, "z", D);

      return colliders;
    },
    notes: [],
    seams: [
      {
        id: `${id}-exit`,
        trigger: {
          min: { x: -1.4, y: 0, z: -D / 2 - 0.5 },
          max: { x: 1.4, y: 2.4, z: -D / 2 + 0.25 },
        },
        destCellId: exit.destCellId,
        destPose: {
          position: {
            x: exit.destPose.x,
            y: exit.destPose.y,
            z: exit.destPose.z,
          },
          yaw: exit.destPose.yaw,
        },
        onCross: exit.onCross,
      },
      // Walk back out near end → return to hub
      {
        id: `${id}-back`,
        trigger: {
          min: { x: -1.4, y: 0, z: D / 2 - 0.25 },
          max: { x: 1.4, y: 2.4, z: D / 2 + 0.5 },
        },
        destCellId: "identityHub",
        destPose: {
          position: {
            x: hot ? 2.0 : -2.0,
            y: 1.7,
            z: -2.0,
          },
          yaw: Math.PI,
        },
      },
    ],
  };
}

export function buildWingB(): CellDef[] {
  return [
    identityHubDef(),
    twinCorridor("identityFalse", 520, false, {
      destCellId: "identityHub",
      destPose: { x: 0, y: 1.7, z: 2.5, yaw: 0 },
      onCross(s) {
        s.falsePathTaken = true;
      },
    }),
    twinCorridor("identityTrue", 540, true, {
      destCellId: "scaleLab",
      destPose: { x: 0, y: 1.7, z: 2.2, yaw: 0 },
      onCross(s) {
        s.identitySolved = true;
      },
    }),
  ];
}
