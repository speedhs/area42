import { Game } from "./game/Game";

const canvas = document.createElement("canvas");
const app = document.getElementById("app");
if (!app) {
  throw new Error("#app missing");
}
app.insertBefore(canvas, app.firstChild);

const game = new Game(canvas);
game.start();

// Debug handle for browser verification.
(window as unknown as { __area42: Game }).__area42 = game;

// Keep reference for HMR dispose.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
  });
}
