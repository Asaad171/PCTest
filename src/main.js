import * as pc from 'playcanvas';

// === DOM + error reporting ===
const canvas = document.getElementById('app-canvas');
const errorOverlay = document.getElementById('error-overlay');

function showError(message) {
  console.error('[VIOS Sandbox]', message);
  if (errorOverlay) {
    errorOverlay.textContent = message;
    errorOverlay.hidden = false;
  }
}

if (!canvas) {
  showError('Canvas element #app-canvas not found in index.html.');
}

// === Application bootstrap ===
const app = new pc.Application(canvas, {
  mouse: new pc.Mouse(canvas),
  touch: new pc.TouchDevice(canvas),
  keyboard: new pc.Keyboard(window),
});

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());

// === Camera ===
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.08, 0.09, 0.11),
  fov: 55,
  nearClip: 0.05,
  farClip: 500,
});
app.root.addChild(camera);

// === Orbit state (simple inline orbit for Step 1) ===
const orbit = {
  target: new pc.Vec3(0, 0, 0),
  azimuth: Math.PI / 4,
  elevation: Math.PI / 7,
  distance: 5,
  minDistance: 0.25,
  maxDistance: 500,
  dragging: false,
  lastX: 0,
  lastY: 0,
  rotSpeed: 0.005,
  zoomSpeed: 0.12,
};

function applyOrbit() {
  const cosEl = Math.cos(orbit.elevation);
  const x = orbit.target.x + orbit.distance * cosEl * Math.sin(orbit.azimuth);
  const y = orbit.target.y + orbit.distance * Math.sin(orbit.elevation);
  const z = orbit.target.z + orbit.distance * cosEl * Math.cos(orbit.azimuth);
  camera.setPosition(x, y, z);
  camera.lookAt(orbit.target);
}
applyOrbit();

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  orbit.dragging = true;
  orbit.lastX = e.clientX;
  orbit.lastY = e.clientY;
});
window.addEventListener('mouseup', () => { orbit.dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!orbit.dragging) return;
  const dx = e.clientX - orbit.lastX;
  const dy = e.clientY - orbit.lastY;
  orbit.lastX = e.clientX;
  orbit.lastY = e.clientY;
  orbit.azimuth -= dx * orbit.rotSpeed;
  orbit.elevation += dy * orbit.rotSpeed;
  const lim = Math.PI / 2 - 0.02;
  if (orbit.elevation > lim) orbit.elevation = lim;
  if (orbit.elevation < -lim) orbit.elevation = -lim;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = 1 + Math.sign(e.deltaY) * orbit.zoomSpeed;
  orbit.distance *= factor;
  if (orbit.distance < orbit.minDistance) orbit.distance = orbit.minDistance;
  if (orbit.distance > orbit.maxDistance) orbit.distance = orbit.maxDistance;
}, { passive: false });

app.on('update', () => {
  applyOrbit();
});

// === Splat loader (inline for Step 1; extracted into module in later step) ===
function frameSplat(entity) {
  // Try to read the world-space bounds to center the orbit target and pick a
  // sensible starting distance. APIs may evolve; guard everything.
  let aabb = null;
  try {
    if (entity.gsplat && entity.gsplat.instance && entity.gsplat.instance.meshInstance) {
      aabb = entity.gsplat.instance.meshInstance.aabb;
    }
  } catch (err) {
    // ignore, fall through to defaults
  }
  if (aabb && aabb.halfExtents) {
    orbit.target.copy(aabb.center);
    const radius = aabb.halfExtents.length();
    orbit.distance = Math.max(radius * 2.2, 1.5);
    orbit.maxDistance = Math.max(radius * 20, 100);
  }
}

function loadSplat() {
  const asset = new pc.Asset('splat', 'gsplat', { url: '/splat.ply' });
  asset.on('error', (err) => {
    showError(`Failed to load /splat.ply: ${err}`);
  });
  asset.ready((readyAsset) => {
    const entity = new pc.Entity('splat');
    entity.addComponent('gsplat', { asset: readyAsset });
    app.root.addChild(entity);
    // Wait one frame so the gsplat instance has its aabb populated.
    requestAnimationFrame(() => frameSplat(entity));
  });
  app.assets.add(asset);
  app.assets.load(asset);
}

function startSplatLoad() {
  fetch('/splat.ply', { method: 'HEAD' })
    .then((res) => {
      if (!res.ok) {
        showError('splat.ply missing from /public/. Drop the file in and refresh.');
        return;
      }
      loadSplat();
    })
    .catch(() => {
      showError('Could not reach dev server to check /splat.ply. Is `npm run dev` running?');
    });
}

// === Start ===
app.start();
startSplatLoad();
