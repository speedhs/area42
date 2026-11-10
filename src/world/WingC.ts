import type { AABB, CellDef } from "./types";
import {
  addMachineLight,
  addPanelLines,
  addRivets,
  boxMesh,
  roomShell,
  Theme,
  wallCollider,
} from "./theme";

/**
 * Wing C — Scale.
 * A tool drawer on the wall becomes a corridor when you commit to entering it.
 */
function scaleLabDef(): CellDef {
  const W = 8;
  const H = 3.4;
  const D = 9;

  return {
    id: "scaleLab",
    worldOffset: { x: 600, y: 0, z: 0 },
    spawn: { position: { x: 0, y: 1.7, z: 2.5 }, yaw: 0 },
    build(group, mats) {
      const colliders = roomShell(group, mats, W, H, D);

      // Workbench on the LEFT — has collision, clear of the drawer path.
      group.add(boxMesh(2.2, 0.9, 0.85, -2.4, 0.45, 0.5, mats.dark));
      group.add(boxMesh(2.2, 0.05, 0.85, -2.4, 0.92, 0.5, mats.wall));
      colliders.push(wallCollider(-2.4, 0.45, 0.5, 2.2, 0.9, 0.85));

      // Centered instrument cabinet on north wall — open drawer faces you.
      const cabX = 0;
      const cabZ = -D / 2 + 0.4;
      group.add(boxMesh(2.2, 2.4, 0.5, cabX, 1.2, cabZ, mats.dark));
      // Drawer pulled into the room (walk into this mouth).
      group.add(boxMesh(1.7, 0.7, 0.9, cabX, 0.9, cabZ + 0.7, mats.wall));
      // Mouth interior
      group.add(boxMesh(1.4, 0.5, 0.08, cabX, 0.9, cabZ + 0.28, mats.voidMat));
      // Handle bar across the drawer front
      group.add(boxMesh(0.9, 0.08, 0.08, cabX, 0.9, cabZ + 1.15, mats.accent));
      // Lit frame around the mouth
      group.add(boxMesh(1.8, 0.06, 0.06, cabX, 1.28, cabZ + 1.05, mats.accent));
      group.add(boxMesh(1.8, 0.06, 0.06, cabX, 0.52, cabZ + 1.05, mats.accent));

      // Cabinet body collision — stop short of the drawer mouth.
      colliders.push(wallCollider(cabX, 1.2, cabZ, 2.2, 2.4, 0.35));

      // Floor stripe leads into the drawer.
      group.add(boxMesh(0.22, 0.03, 4.5, 0, 0.02, -1.2, mats.accent));

      addMachineLight(group, 0, 3.0, 1, Theme.accent, 40, 18);
      addMachineLight(group, 0, 2.6, -2.5, Theme.accent, 32, 12);
      addRivets(group, mats, -W / 2 + 0.12, 0, "z", D);

      return colliders;
    },
    notes: [
      {
        id: "scale-axiom",
        text: "ENTER WHAT WAS BUILT TO HOLD TOOLS.",
        position: { x: -W / 2 + 0.14, y: 1.75, z: 1.5 },
        yaw: Math.PI / 2,
        phosphor: "orange",
      },
    ],
    seams: [
      {
        id: "lab-into-drawer",
        trigger: {
          min: { x: -0.75, y: 0.2, z: -D / 2 + 0.7 },
          max: { x: 0.75, y: 2.2, z: -D / 2 + 1.7 },
        },
        destCellId: "scaleInside",
        destPose: {
          position: { x: 0, y: 1.7, z: 5.5 },
          yaw: 0,
        },
        onCross(state) {
          state.scaled = true;
        },
      },
    ],
  };
}

function scaleInsideDef(): CellDef {
  const W = 4.5;
  const H = 3.6;
  const D = 18;

  return {
    id: "scaleInside",
    worldOffset: { x: 620, y: 0, z: 0 },
    build(group, mats) {
      const colliders: AABB[] = [];
      const t = 0.25;

      group.add(boxMesh(W, 0.15, D, 0, -0.08, 0, mats.floor));
      group.add(boxMesh(W, 0.15, D, 0, H + 0.08, 0, mats.ceiling));
      addPanelLines(group, W, D);

      group.add(boxMesh(t, H, D, -W / 2 - t / 2, H / 2, 0, mats.wall));
      group.add(boxMesh(t, H, D, W / 2 + t / 2, H / 2, 0, mats.wall));
      colliders.push(wallCollider(-W / 2 - t / 2, H / 2, 0, t, H, D));
      colliders.push(wallCollider(W / 2 + t / 2, H / 2, 0, t, H, D));

      for (let i = -7; i <= 7; i++) {
        const z = i * 1.15;
        group.add(
          boxMesh(0.08, H * 0.9, 0.2, -W / 2 + 0.08, H / 2, z, mats.dark),
        );
        group.add(
          boxMesh(0.08, H * 0.9, 0.2, W / 2 - 0.08, H / 2, z, mats.dark),
        );
      }

      group.add(boxMesh(W * 0.7, 0.35, 0.35, 0, H - 0.4, -4, mats.accent));

      const doorW = 1.5;
      const doorH = 2.3;
      const farZ = -D / 2 - t / 2;
      const side = (W - doorW) / 2;
      group.add(
        boxMesh(side, H, t, -W / 2 + side / 2, H / 2, farZ, mats.wall),
      );
      group.add(
        boxMesh(side, H, t, W / 2 - side / 2, H / 2, farZ, mats.wall),
      );
      colliders.push(wallCollider(-W / 2 + side / 2, H / 2, farZ, side, H, t));
      colliders.push(wallCollider(W / 2 - side / 2, H / 2, farZ, side, H, t));
      const aboveH = H - doorH;
      group.add(
        boxMesh(doorW, aboveH, t, 0, doorH + aboveH / 2, farZ, mats.wall),
      );
      colliders.push(
        wallCollider(0, doorH + aboveH / 2, farZ, doorW, aboveH, t),
      );
      group.add(
        boxMesh(doorW + 0.1, 0.08, 0.1, 0, doorH + 0.04, farZ, mats.accent),
      );

      group.add(
        boxMesh(W + t * 2, H, t, 0, H / 2, D / 2 + t / 2, mats.dark),
      );
      colliders.push(
        wallCollider(0, H / 2, D / 2 + t / 2, W + t * 2, H, t),
      );

      addMachineLight(group, 0, 3.0, 4, Theme.accent, 38, 20);
      addMachineLight(group, 0, 3.0, -4, Theme.accent, 30, 18);
      addMachineLight(group, 0, 2.8, -7, Theme.crt, 16, 12);

      return colliders;
    },
    notes: [
      {
        id: "scale-inside",
        text: "THE MACHINE KEEPS ITS TOOLS SMALL. YOU ARE NOT A TOOL.",
        position: { x: -W / 2 + 0.14, y: 1.8, z: 2 },
        yaw: Math.PI / 2,
        phosphor: "green",
      },
    ],
    seams: [
      {
        id: "inside-to-escape",
        trigger: {
          min: { x: -0.75, y: 0, z: -D / 2 - 0.35 },
          max: { x: 0.75, y: 2.35, z: -D / 2 + 0.55 },
        },
        destCellId: "escapeBay",
        destPose: {
          position: { x: 0, y: 1.7, z: 2 },
          yaw: 0,
        },
      },
    ],
  };
}

function escapeBayDef(): CellDef {
  const W = 6;
  const H = 4;
  const D = 8;

  return {
    id: "escapeBay",
    worldOffset: { x: 640, y: 0, z: 0 },
    build(group, mats) {
      const colliders = roomShell(group, mats, W, H, D);

      group.add(boxMesh(3.2, 3.2, 0.2, 0, 1.7, -D / 2 + 0.4, mats.dark));
      group.add(boxMesh(2.4, 2.4, 0.12, 0, 1.7, -D / 2 + 0.55, mats.accent));
      group.add(boxMesh(1.6, 1.6, 0.08, 0, 1.7, -D / 2 + 0.7, mats.voidMat));

      group.add(boxMesh(1.3, 1.0, 0.65, 0, 0.5, 1.2, mats.dark));
      group.add(boxMesh(1.05, 0.05, 0.5, 0, 1.05, 1.2, mats.accent));

      addMachineLight(group, 0, 3.4, 0, Theme.accent, 45, 18);
      addMachineLight(group, -2, 3.0, -2, Theme.crt, 20, 12);
      addRivets(group, mats, W / 2 - 0.12, 0, "z", D);

      return colliders;
    },
    notes: [
      {
        id: "escape-final",
        text: "YOU FIT. THE GEOMETRY SINGS. WINGS A–C HOLD. BEYOND THIS RING THE MACHINE HAS NO NAME FOR YOU.",
        position: { x: 0, y: 1.6, z: 1.55 },
        yaw: 0,
        phosphor: "orange",
      },
    ],
    seams: [],
  };
}

export function buildWingC(): CellDef[] {
  return [scaleLabDef(), scaleInsideDef(), escapeBayDef()];
}

export const ENDING_TEXT =
  "You fit. The geometry sings. Wings A through C hold. Beyond this ring the machine has no name for you.";
