import * as THREE from "three";
import type { CellRuntime, SeamDef, Vec3 } from "../world/types";

interface PortalInstance {
  seam: SeamDef;
  mesh: THREE.Mesh;
  sourceCell: CellRuntime;
  destCell: CellRuntime;
  target: THREE.WebGLRenderTarget;
  material: THREE.MeshBasicMaterial;
}

/**
 * Depth-1 doorway portals. Camera is placed at the destination pose with the
 * same look offset as the player relative to the source door — stable enough
 * for hatch / wing transitions without recursive portals.
 */
export class PortalPass {
  private portals: PortalInstance[] = [];
  private portalCamera: THREE.PerspectiveCamera;

  constructor() {
    this.portalCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 200);
  }

  register(
    seam: SeamDef,
    mesh: THREE.Mesh,
    sourceCell: CellRuntime,
    destCell: CellRuntime,
  ): void {
    const target = new THREE.WebGLRenderTarget(1024, 1024, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    const material = new THREE.MeshBasicMaterial({
      map: target.texture,
      side: THREE.FrontSide,
      depthWrite: true,
      toneMapped: false,
    });
    mesh.material = material;
    this.portals.push({ seam, mesh, sourceCell, destCell, target, material });
  }

  setSize(width: number, height: number): void {
    const w = Math.max(256, Math.floor(width * 0.7));
    const h = Math.max(256, Math.floor(height * 0.7));
    for (const p of this.portals) {
      p.target.setSize(w, h);
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    mainCamera: THREE.PerspectiveCamera,
    cells: Map<string, CellRuntime>,
    currentCellId: string,
  ): void {
    void cells;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;

    for (const portal of this.portals) {
      if (portal.sourceCell.id !== currentCellId) continue;

      this.placePortalCamera(mainCamera, portal);

      const visibility = this.hideOthers(scene, portal.destCell);
      portal.mesh.visible = false;

      renderer.setRenderTarget(portal.target);
      renderer.autoClear = true;
      renderer.setClearColor(0x14121c, 1);
      renderer.clear();
      renderer.render(scene, this.portalCamera);

      portal.mesh.visible = true;
      this.restoreVisibility(visibility);
    }

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(0x14121c, 1);
  }

  dispose(): void {
    for (const p of this.portals) {
      p.target.dispose();
      p.material.dispose();
    }
    this.portals.length = 0;
  }

  private placePortalCamera(
    mainCamera: THREE.PerspectiveCamera,
    portal: PortalInstance,
  ): void {
    const plane = portal.seam.portalPlane!;
    const src = portal.sourceCell.def.worldOffset;
    const dst = portal.destCell.def.worldOffset;
    const destPose = portal.seam.destPose;

    const portalWorld = new THREE.Vector3(
      src.x + plane.center.x,
      src.y + plane.center.y,
      src.z + plane.center.z,
    );
    const normal = new THREE.Vector3(
      plane.normal.x,
      plane.normal.y,
      plane.normal.z,
    ).normalize();

    // Player offset from the doorway, expressed in the portal's facing frame.
    const rel = mainCamera.position.clone().sub(portalWorld);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
    if (right.lengthSq() < 0.01) {
      right.set(1, 0, 0);
    }
    const up = new THREE.Vector3(0, 1, 0);
    const localX = rel.dot(right);
    const localY = rel.dot(up);
    const localZ = rel.dot(normal);

    // Destination doorway faces into the room along destPose yaw (-Z at yaw 0).
    const destForward = new THREE.Vector3(
      -Math.sin(destPose.yaw),
      0,
      -Math.cos(destPose.yaw),
    );
    const destRight = new THREE.Vector3().crossVectors(
      new THREE.Vector3(0, 1, 0),
      destForward,
    ).normalize();

    const destDoor = new THREE.Vector3(
      dst.x + destPose.position.x,
      dst.y + plane.center.y,
      dst.z + destPose.position.z,
    );
    // Stand just inside the destination, mirrored across the door plane.
    this.portalCamera.position
      .copy(destDoor)
      .addScaledVector(destRight, localX)
      .addScaledVector(up, localY)
      .addScaledVector(destForward, Math.max(0.35, -localZ));

    this.portalCamera.fov = mainCamera.fov;
    this.portalCamera.aspect = mainCamera.aspect;
    this.portalCamera.near = 0.1;
    this.portalCamera.far = mainCamera.far;

    // Match pitch; yaw follows destination corridor direction.
    const euler = new THREE.Euler().setFromQuaternion(mainCamera.quaternion, "YXZ");
    this.portalCamera.rotation.order = "YXZ";
    this.portalCamera.rotation.y = destPose.yaw;
    this.portalCamera.rotation.x = euler.x;
    this.portalCamera.rotation.z = 0;
    this.portalCamera.updateProjectionMatrix();
    this.portalCamera.updateMatrixWorld(true);
  }

  private hideOthers(
    scene: THREE.Scene,
    keep: CellRuntime,
  ): Map<THREE.Object3D, boolean> {
    const prev = new Map<THREE.Object3D, boolean>();
    for (const child of scene.children) {
      if (child.userData?.cellId) {
        prev.set(child, child.visible);
        child.visible = child.userData.cellId === keep.id;
      }
    }
    return prev;
  }

  private restoreVisibility(prev: Map<THREE.Object3D, boolean>): void {
    for (const [obj, vis] of prev) {
      obj.visible = vis;
    }
  }
}

export function makePortalQuad(
  center: Vec3,
  width: number,
  height: number,
  normal: Vec3,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({ color: 0x14121c });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center.x, center.y, center.z);

  const n = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    n,
  );
  mesh.quaternion.copy(quat);
  mesh.position.add(n.clone().multiplyScalar(0.04));
  return mesh;
}
