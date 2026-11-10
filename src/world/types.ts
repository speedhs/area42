import type * as THREE from "three";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Pose {
  position: Vec3;
  yaw: number;
}

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export interface PuzzleState {
  loopCount: number;
  loopNoteShown: boolean;
  onBridge: boolean;
  /** Left Wing A hatch into the deeper machine. */
  wingAOpen: boolean;
  /** Walked the false twin corridor at least once. */
  falsePathTaken: boolean;
  /** Entered the true identity corridor. */
  identitySolved: boolean;
  /** Stepped into the scaled drawer interior. */
  scaled: boolean;
  /** Reached the final escape bay. */
  escapeReached: boolean;
}

export type SeamCondition = (state: PuzzleState) => boolean;

export interface SeamDef {
  id: string;
  /** Trigger volume in cell-local space. */
  trigger: AABB;
  destCellId: string;
  destPose: Pose;
  /** If set, seam only fires when this returns true. */
  condition?: SeamCondition;
  /** Called once when the seam successfully fires. */
  onCross?: (state: PuzzleState) => void;
  /** Blind by default; true = render destination through this opening. */
  portal?: boolean;
  /** Portal quad size and local center (cell-local). Required if portal. */
  portalPlane?: {
    center: Vec3;
    width: number;
    height: number;
    /** Outward normal of the portal surface (points toward the viewer side). */
    normal: Vec3;
  };
}

export interface NoteDef {
  id: string;
  text: string;
  position: Vec3;
  /** Yaw in radians for the note plane. */
  yaw: number;
  /** CRT phosphor color. */
  phosphor?: "green" | "orange";
  /** Only visible when this returns true. Defaults to always. */
  visible?: (state: PuzzleState) => boolean;
}

export interface CellDef {
  id: string;
  /** World-space origin of this cell's local frame. */
  worldOffset: Vec3;
  /** Build meshes into the group; return colliders in cell-local space. */
  build: (group: THREE.Group, materials: CellMaterials) => AABB[];
  seams: SeamDef[];
  notes: NoteDef[];
  spawn?: Pose;
}

export interface CellMaterials {
  wall: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  voidMat: THREE.MeshBasicMaterial;
}

export type WingBuilder = () => CellDef[];

export interface CellRuntime {
  id: string;
  def: CellDef;
  group: THREE.Group;
  colliders: AABB[];
  notes: Map<string, THREE.Mesh>;
  portalMeshes: Map<string, THREE.Mesh>;
}

export function aabbContains(box: AABB, p: Vec3): boolean {
  return (
    p.x >= box.min.x &&
    p.x <= box.max.x &&
    p.y >= box.min.y &&
    p.y <= box.max.y &&
    p.z >= box.min.z &&
    p.z <= box.max.z
  );
}

export function pointInXZ(box: AABB, x: number, z: number): boolean {
  return (
    x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z
  );
}
