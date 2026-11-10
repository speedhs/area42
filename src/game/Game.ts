import * as THREE from "three";
import { MachineAudio, type WingBed } from "../audio/MachineAudio";
import { FirstPerson } from "../player/FirstPerson";
import { makePortalQuad, PortalPass } from "../render/PortalPass";
import {
  aabbContains,
  type AABB,
  type CellRuntime,
  type PuzzleState,
  type SeamDef,
} from "../world/types";
import { buildWingA, createMaterials, createNoteMesh } from "../world/WingA";
import { buildWingB } from "../world/WingB";
import { buildWingC, ENDING_TEXT } from "../world/WingC";
import { Theme } from "../world/theme";

const LOOK_UP = -0.25;
const LOOK_DOWN_HARD = 0.55;
const BASE_FOV = 75;

type UiMode = "boot" | "play" | "pause" | "ending";

const AXIOM_LABELS = [
  "Direction",
  "Attention",
  "Containment",
  "Identity",
  "Scale",
] as const;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private player: FirstPerson;
  private portalPass = new PortalPass();
  private audio = new MachineAudio();
  private cells = new Map<string, CellRuntime>();
  private currentCellId = "foyer";
  private state: PuzzleState = this.freshState();
  private axioms = new Set<number>();
  private bridgeCollider: AABB | null = null;
  private clock = new THREE.Clock();
  private seamCooldown = 0;
  private fovPunch = 0;
  private bridgeWasSolid = false;
  private prevNoteVisible = new Map<string, boolean>();
  private uiMode: UiMode = "boot";
  private running = true;
  private falling = false;
  private fallVy = 0;

  private bootEl: HTMLElement;
  private pauseEl: HTMLElement;
  private endingEl: HTMLElement;
  private endingText: HTMLElement;
  private hudEl: HTMLElement;
  private axiomLog: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    this.bootEl = document.getElementById("boot")!;
    this.pauseEl = document.getElementById("pause")!;
    this.endingEl = document.getElementById("ending")!;
    this.endingText = document.getElementById("ending-text")!;
    this.hudEl = document.getElementById("hud")!;
    this.axiomLog = document.getElementById("axiom-log")!;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(Theme.bg);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Theme.bg);
    this.scene.fog = new THREE.FogExp2(Theme.fog, 0.018);

    this.player = new FirstPerson(canvas);
    this.player.setFov(BASE_FOV);

    this.buildWorld();
    this.enterCell("foyer", true);
    this.bindUi();
    this.setUi("boot");

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.onResize();
  }

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(this.frame);
  }

  beginPlay(): void {
    void this.enterHull();
  }

  getDebugState(): Record<string, unknown> {
    return {
      cell: this.currentCellId,
      ui: this.uiMode,
      pos: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      },
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      ...this.state,
    };
  }

  debugTeleport(
    cellId: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
  ): void {
    this.currentCellId = cellId;
    this.player.setPose(x, y, z, yaw);
    this.falling = false;
    this.fallVy = 0;
    this.seamCooldown = 0.2;
  }

  debugSetPitch(pitch: number): void {
    this.player.pitch = pitch;
  }

  debugSetLoopCount(n: number): void {
    this.state.loopCount = n;
    this.state.loopNoteShown = n >= 1;
  }

  debugNudge(dx: number, dz: number): void {
    this.player.position.x += dx;
    this.player.position.z += dz;
  }

  dispose(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.player.dispose();
    this.portalPass.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }

  private freshState(): PuzzleState {
    return {
      loopCount: 0,
      loopNoteShown: false,
      onBridge: false,
      wingAOpen: false,
      falsePathTaken: false,
      identitySolved: false,
      scaled: false,
      escapeReached: false,
    };
  }

  private bindUi(): void {
    document.getElementById("btn-enter")!.addEventListener("click", () => {
      void this.enterHull();
    });
    document.getElementById("btn-resume")!.addEventListener("click", () => {
      this.resume();
    });
    document.getElementById("btn-restart")!.addEventListener("click", () => {
      this.restartWingA();
    });
    document.getElementById("btn-reboot")!.addEventListener("click", () => {
      this.restartWingA();
    });
    document.getElementById("btn-to-boot")!.addEventListener("click", () => {
      this.returnToBoot();
    });

    const syncMuteButtons = (): void => {
      const label = this.audio.isMuted ? "AUDIO OFF" : "AUDIO ON";
      const a = document.getElementById("btn-boot-mute");
      const b = document.getElementById("btn-pause-mute");
      if (a) a.textContent = label;
      if (b) b.textContent = label;
    };
    document.getElementById("btn-boot-mute")!.addEventListener("click", () => {
      void this.audio.ensure().then(() => {
        this.audio.toggleMute();
        this.audio.uiClick();
        syncMuteButtons();
      });
    });
    document.getElementById("btn-pause-mute")!.addEventListener("click", () => {
      this.audio.toggleMute();
      this.audio.uiClick();
      syncMuteButtons();
    });
  }

  private async enterHull(): Promise<void> {
    await this.audio.ensure();
    this.audio.uiClick();
    this.audio.setBed("a");
    this.setUi("play");
    this.player.requestLock();
    this.player.forceEnableInput();
  }

  private resume(): void {
    if (this.uiMode !== "pause") return;
    this.audio.uiClick();
    this.setUi("play");
    this.player.requestLock();
    this.player.forceEnableInput();
  }

  private pause(): void {
    if (this.uiMode !== "play") return;
    this.refreshAxiomLog();
    this.setUi("pause"); // before unlock so pointerlockchange does not re-enter
    this.player.releaseLock();
    this.audio.uiClick();
  }

  private restartWingA(): void {
    this.audio.uiClick();
    this.state = this.freshState();
    this.axioms.clear();
    this.falling = false;
    this.fallVy = 0;
    this.seamCooldown = 0;
    this.fovPunch = 0;
    this.bridgeWasSolid = false;
    this.player.setFov(BASE_FOV);
    this.player.pitch = 0;
    this.enterCell("foyer", true);
    this.updateNotes();
    this.refreshAxiomLog();
    this.endingEl.classList.remove("show");
    void this.audio.ensure().then(() => {
      this.audio.setBed("a");
      this.setUi("play");
      this.player.requestLock();
      this.player.forceEnableInput();
    });
  }

  private returnToBoot(): void {
    this.audio.uiClick();
    this.state = this.freshState();
    this.axioms.clear();
    this.falling = false;
    this.enterCell("foyer", true);
    this.updateNotes();
    this.player.releaseLock();
    this.audio.setBed("boot");
    this.setUi("boot");
  }

  private setUi(mode: UiMode): void {
    this.uiMode = mode;
    this.bootEl.classList.toggle("show", mode === "boot");
    this.pauseEl.classList.toggle("show", mode === "pause");
    this.endingEl.classList.toggle("show", mode === "ending");
    this.hudEl.classList.toggle("show", mode === "play");
  }

  private refreshAxiomLog(): void {
    this.axiomLog.innerHTML = AXIOM_LABELS.map((label, i) => {
      const on = this.axioms.has(i);
      return `<span class="${on ? "lit" : ""}">${label}</span>`;
    }).join(" · ");
  }

  private unlockAxiom(index: number): void {
    if (this.axioms.has(index)) return;
    this.axioms.add(index);
    this.audio.axiomSting(index);
    this.refreshAxiomLog();
  }

  private buildWorld(): void {
    const mats = createMaterials();
    const defs = [...buildWingA(), ...buildWingB(), ...buildWingC()];

    for (const def of defs) {
      const group = new THREE.Group();
      group.position.set(
        def.worldOffset.x,
        def.worldOffset.y,
        def.worldOffset.z,
      );
      group.userData.cellId = def.id;

      const colliders = def.build(group, mats);
      const notes = new Map<string, THREE.Mesh>();
      for (const note of def.notes) {
        const mesh = createNoteMesh(note);
        const show = note.visible ? note.visible(this.state) : true;
        mesh.visible = show;
        this.prevNoteVisible.set(`${def.id}:${note.id}`, show);
        group.add(mesh);
        notes.set(note.id, mesh);
      }

      this.scene.add(group);
      this.cells.set(def.id, {
        id: def.id,
        def,
        group,
        colliders,
        notes,
        portalMeshes: new Map(),
      });
    }

    for (const cell of this.cells.values()) {
      for (const seam of cell.def.seams) {
        if (!seam.portal || !seam.portalPlane) continue;
        const dest = this.cells.get(seam.destCellId);
        if (!dest) continue;
        const quad = makePortalQuad(
          seam.portalPlane.center,
          seam.portalPlane.width,
          seam.portalPlane.height,
          seam.portalPlane.normal,
        );
        quad.name = `portal-${seam.id}`;
        cell.group.add(quad);
        cell.portalMeshes.set(seam.id, quad);
        this.portalPass.register(seam, quad, cell, dest);
      }
    }
  }

  private enterCell(cellId: string, useSpawn: boolean): void {
    this.currentCellId = cellId;
    const cell = this.cells.get(cellId)!;
    if (useSpawn && cell.def.spawn) {
      const s = cell.def.spawn;
      this.player.setPose(s.position.x, s.position.y, s.position.z, s.yaw);
    }
  }

  private showEnding(): void {
    this.unlockAxiom(4);
    this.endingText.textContent = ENDING_TEXT;
    this.player.releaseLock();
    this.audio.setBed("escape");
    this.audio.axiomSting(4);
    this.setUi("ending");
  }

  private activeColliders(): AABB[] {
    return [...this.cells.get(this.currentCellId)!.colliders];
  }

  private isBridgeSolid(): boolean {
    if (this.state.onBridge) return this.player.pitch < LOOK_DOWN_HARD;
    return this.player.pitch < LOOK_UP;
  }

  private updateGlanceBridgeWithDt(dt: number): void {
    if (this.currentCellId !== "glance") return;
    const cell = this.cells.get("glance")!;
    const bridge = cell.group.getObjectByName("bridge") as THREE.Mesh | undefined;
    const solid = this.isBridgeSolid();
    if (bridge) {
      bridge.visible = solid;
      // Soft opacity via scale flicker when appearing
      if (solid && !this.bridgeWasSolid) {
        this.audio.crtBoot();
        this.unlockAxiom(1);
        this.fovPunch = Math.max(this.fovPunch, 6);
      }
      this.bridgeWasSolid = solid;
    }

    const bridgeBox = cell.group.userData.bridgeBox as AABB;
    const nearLedge = cell.group.userData.nearLedge as AABB;
    const farLedge = cell.group.userData.farLedge as AABB;
    const respawn = cell.group.userData.respawn as {
      x: number;
      y: number;
      z: number;
    };

    this.bridgeCollider = bridgeBox;
    void this.bridgeCollider;
    void dt;

    const x = this.player.position.x;
    const z = this.player.position.z;
    const pad = 0.08;

    const onNear = this.inPadXZ(nearLedge, x, z, pad);
    const onFar = this.inPadXZ(farLedge, x, z, pad);
    const overBridge = this.inPadXZ(bridgeBox, x, z, pad);

    if (this.falling) {
      this.fallVy -= 28 * dt;
      this.player.position.y += this.fallVy * dt;
      if (this.player.position.y < -3) {
        this.falling = false;
        this.fallVy = 0;
        this.state.onBridge = false;
        this.player.setPose(respawn.x, respawn.y, respawn.z, this.player.yaw);
      }
      return;
    }

    if (overBridge && solid) {
      this.state.onBridge = true;
      this.player.setEyeY(this.player.eyeHeight);
    } else if (onNear || onFar) {
      this.state.onBridge = false;
      this.player.setEyeY(this.player.eyeHeight);
    } else if (overBridge && !solid) {
      this.state.onBridge = false;
      this.falling = true;
      this.fallVy = 0;
    } else {
      this.state.onBridge = false;
      this.falling = true;
      this.fallVy = 0;
    }
  }

  private inPadXZ(box: AABB, x: number, z: number, pad: number): boolean {
    return (
      x >= box.min.x - pad &&
      x <= box.max.x + pad &&
      z >= box.min.z - pad &&
      z <= box.max.z + pad
    );
  }

  private updateNotes(): void {
    for (const cell of this.cells.values()) {
      for (const note of cell.def.notes) {
        const mesh = cell.notes.get(note.id);
        if (!mesh) continue;
        const show = note.visible ? note.visible(this.state) : true;
        const key = `${cell.id}:${note.id}`;
        const prev = this.prevNoteVisible.get(key) ?? false;
        if (show && !prev) this.audio.crtBoot();
        this.prevNoteVisible.set(key, show);
        mesh.visible = show;
      }
    }
  }

  private bedForCell(cellId: string): WingBed {
    if (
      cellId === "identityHub" ||
      cellId === "identityFalse" ||
      cellId === "identityTrue"
    ) {
      return "b";
    }
    if (
      cellId === "scaleLab" ||
      cellId === "scaleInside" ||
      cellId === "escapeBay"
    ) {
      return "c";
    }
    return "a";
  }

  private checkSeams(): void {
    if (this.seamCooldown > 0 || this.falling || this.state.escapeReached) return;
    if (this.uiMode !== "play") return;

    const cell = this.cells.get(this.currentCellId)!;
    const p = {
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
    };

    const candidates: SeamDef[] = cell.def.seams.filter((s) => {
      if (!aabbContains(s.trigger, p)) return false;
      if (s.condition && !s.condition(this.state)) return false;
      return true;
    });

    const seam = candidates[0];
    if (!seam) return;

    const prevLoop = this.state.loopCount;
    const prevFalse = this.state.falsePathTaken;
    const prevId = this.state.identitySolved;
    const prevScaled = this.state.scaled;
    const prevWingA = this.state.wingAOpen;

    seam.onCross?.(this.state);
    this.updateNotes();

    if (this.state.loopCount > prevLoop && this.state.loopCount === 1) {
      this.unlockAxiom(0);
    }
    if (this.state.wingAOpen && !prevWingA) {
      this.unlockAxiom(2);
      this.audio.hatchClack();
    }
    if (this.state.falsePathTaken && !prevFalse) {
      this.audio.crtBoot();
    }
    if (this.state.identitySolved && !prevId) {
      this.unlockAxiom(3);
    }
    if (this.state.scaled && !prevScaled) {
      this.unlockAxiom(4);
      this.fovPunch = 18;
    }

    const dest = this.cells.get(seam.destCellId);
    if (!dest) {
      console.warn("Missing dest cell", seam.destCellId);
      return;
    }

    this.player.setPose(
      seam.destPose.position.x,
      seam.destPose.position.y,
      seam.destPose.position.z,
      seam.destPose.yaw,
    );
    this.currentCellId = dest.id;
    this.player.resolvePenetration(dest.colliders);
    this.seamCooldown = 0.45;
    this.falling = false;
    this.fallVy = 0;
    this.state.onBridge = false;
    this.fovPunch = Math.max(this.fovPunch, 8);
    this.audio.seamWhoosh();
    this.audio.setBed(this.bedForCell(dest.id));

    if (dest.id === "escapeBay" && !this.state.escapeReached) {
      this.state.escapeReached = true;
      this.showEnding();
    }
  }

  private updateFov(dt: number): void {
    if (this.fovPunch > 0) {
      this.fovPunch = Math.max(0, this.fovPunch - dt * 28);
    }
    const punch = this.fovPunch;
    // Scale interior feels slightly wider
    const scaleBias = this.state.scaled && this.currentCellId === "scaleInside" ? 4 : 0;
    this.player.setFov(BASE_FOV + punch + scaleBias);
  }

  private syncCameraWorld(): void {
    const cell = this.cells.get(this.currentCellId)!;
    const off = cell.def.worldOffset;
    this.player.camera.position.set(
      off.x + this.player.position.x,
      off.y + this.player.position.y,
      off.z + this.player.position.z,
    );
    this.player.camera.rotation.y = this.player.yaw;
    this.player.camera.rotation.x = this.player.pitch;
  }

  private frame = (): void => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.uiMode === "play") {
      if (this.seamCooldown > 0) this.seamCooldown -= dt;

      this.player.look(dt);

      if (!this.falling && !this.state.escapeReached) {
        const cols = this.activeColliders();
        this.player.resolvePenetration(cols);
        this.player.move(dt, cols);
      }

      this.updateGlanceBridgeWithDt(dt);
      this.checkSeams();
      this.updateNotes();
      this.updateFov(dt);
      this.audio.updateFootsteps(
        dt,
        this.player.isMoving && !this.falling,
        this.state.scaled && this.currentCellId === "scaleInside",
      );
    }

    this.syncCameraWorld();

    for (const c of this.cells.values()) {
      c.group.visible = true;
    }

    if (this.uiMode === "play" || this.uiMode === "pause") {
      this.portalPass.render(
        this.renderer,
        this.scene,
        this.player.camera,
        this.cells,
        this.currentCellId,
      );
    }

    for (const c of this.cells.values()) {
      c.group.visible = c.id === this.currentCellId;
    }

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.player.camera);
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.player.camera.aspect = w / h;
    this.player.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.portalPass.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Escape") {
      if (this.uiMode === "play") {
        e.preventDefault();
        this.pause();
      } else if (this.uiMode === "pause") {
        e.preventDefault();
        this.resume();
      }
    }
  };

  private onPointerLockChange = (): void => {
    // Esc / alt-tab drops lock — fold into pause instead of a soft soft-lock.
    if (this.uiMode === "play" && !document.pointerLockElement) {
      this.pause();
    }
  };
}
