import * as THREE from "three";
import type { AABB } from "../world/types";

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 3.5;
const PLAYER_RADIUS = 0.28;
const PLAYER_HALF_HEIGHT = 0.85;
const MOUSE_SENS = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

export class FirstPerson {
  readonly camera: THREE.PerspectiveCamera;
  readonly position = new THREE.Vector3(0, EYE_HEIGHT, 0);

  yaw = 0;
  pitch = 0;

  private keys = new Set<string>();
  private locked = false;
  private canvas: HTMLCanvasElement;
  private movedThisFrame = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
    this.camera.rotation.order = "YXZ";

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onLockChange);
    canvas.addEventListener("mousemove", this.onMouseMove);
  }

  get eyeHeight(): number {
    return EYE_HEIGHT;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Allow movement without OS pointer lock (automation / focus-less browsers). */
  forceEnableInput(): void {
    this.locked = true;
  }

  requestLock(): void {
    this.canvas.requestPointerLock();
  }

  releaseLock(): void {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  setPose(x: number, y: number, z: number, yaw: number): void {
    this.position.set(x, y, z);
    this.yaw = yaw;
    this.syncCamera();
  }

  /**
   * Push the player out of any overlapping AABBs (fixes doorway / spawn embeds).
   */
  resolvePenetration(colliders: AABB[]): void {
    if (!this.overlapsAny(this.position, colliders)) return;

    const steps = [0.15, 0.3, 0.5, 0.8, 1.2, 1.8];
    const dirs: Array<[number, number]> = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];

    for (const dist of steps) {
      for (const [dx, dz] of dirs) {
        const len = Math.hypot(dx, dz) || 1;
        const next = this.position.clone();
        next.x += (dx / len) * dist;
        next.z += (dz / len) * dist;
        if (!this.overlapsAny(next, colliders)) {
          this.position.copy(next);
          this.syncCamera();
          return;
        }
      }
    }
  }

  /** Feet position derived from eye position. */
  getFeetY(): number {
    return this.position.y - EYE_HEIGHT;
  }

  look(dt: number): void {
    void dt;
    this.syncCamera();
  }

  get isMoving(): boolean {
    return this.movedThisFrame;
  }

  move(dt: number, colliders: AABB[]): void {
    this.movedThisFrame = false;
    if (!this.locked) return;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) wish.add(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) wish.sub(forward);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) wish.add(right);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) wish.sub(right);

    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(WALK_SPEED * dt);
      const before = this.position.clone();
      this.slide(wish, colliders);
      this.movedThisFrame =
        this.position.distanceToSquared(before) > 0.00001;
    }

    // Keep feet on floor (y=0) unless falling is handled externally.
    if (this.position.y < EYE_HEIGHT) {
      this.position.y = EYE_HEIGHT;
    }

    this.syncCamera();
  }

  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  get baseFov(): number {
    return 75;
  }

  /** Force vertical position (for falls / respawns). */
  setEyeY(y: number): void {
    this.position.y = y;
    this.syncCamera();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
  }

  private syncCamera(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private slide(delta: THREE.Vector3, colliders: AABB[]): void {
    // Separate axes for move-and-slide against AABBs.
    this.tryAxis("x", delta.x, colliders);
    this.tryAxis("z", delta.z, colliders);
  }

  private tryAxis(axis: "x" | "z", amount: number, colliders: AABB[]): void {
    if (amount === 0) return;
    const next = this.position.clone();
    next[axis] += amount;

    if (!this.overlapsAny(next, colliders)) {
      this.position[axis] = next[axis];
      return;
    }

    // Binary search to slide flush against the wall.
    let lo = 0;
    let hi = amount;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      next.copy(this.position);
      next[axis] += mid;
      if (this.overlapsAny(next, colliders)) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    this.position[axis] += lo;
  }

  private overlapsAny(eye: THREE.Vector3, colliders: AABB[]): boolean {
    const minX = eye.x - PLAYER_RADIUS;
    const maxX = eye.x + PLAYER_RADIUS;
    const minZ = eye.z - PLAYER_RADIUS;
    const maxZ = eye.z + PLAYER_RADIUS;
    const minY = eye.y - EYE_HEIGHT;
    const maxY = eye.y - EYE_HEIGHT + PLAYER_HALF_HEIGHT * 2;

    for (const box of colliders) {
      if (
        minX < box.max.x &&
        maxX > box.min.x &&
        minY < box.max.y &&
        maxY > box.min.y &&
        minZ < box.max.z &&
        maxZ > box.min.z
      ) {
        return true;
      }
    }
    return false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.yaw -= e.movementX * MOUSE_SENS;
    this.pitch -= e.movementY * MOUSE_SENS;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  };
}
