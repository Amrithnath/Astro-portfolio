// Imported only after the native dialog is opened and its display image is visible.
export function createViewer(root: HTMLElement, dialog: HTMLDialogElement): () => void {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const image = root.querySelector<HTMLImageElement>('[data-preview]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const output = root.querySelector<HTMLOutputElement>('[data-scale]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const events = new AbortController();
  const { signal } = events;
  let alive = true;
  let scale = 1;
  let x = 0;
  let y = 0;
  let width = 1;
  let height = 1;
  let fitWidth = 1;
  let fitHeight = 1;
  let frame = 0;
  let lastTouch = -Infinity;
  let aspect = image.naturalWidth / image.naturalHeight || 1;
  let renderer: ReturnType<typeof webglRenderer>;

  function draw() {
    frame = 0;
    const limitX = Math.max(0, (fitWidth * scale - width) / 2);
    const limitY = Math.max(0, (fitHeight * scale - height) / 2);
    x = Math.max(-limitX, Math.min(limitX, x));
    y = Math.max(-limitY, Math.min(limitY, y));
    image.style.width = `${fitWidth}px`;
    image.style.height = `${fitHeight}px`;
    image.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
    renderer?.draw(width, height, fitWidth * scale, fitHeight * scale, x, y);
    stage.dataset.scale = scale.toFixed(3);
    stage.dataset.pan = `${x.toFixed(1)},${y.toFixed(1)}`;
    output.value = `${Math.round(scale * 100)}%`;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    if (image.naturalWidth) aspect = image.naturalWidth / image.naturalHeight;
    fitWidth = Math.min(width, height * aspect);
    fitHeight = fitWidth / aspect;
    schedule();
  }
  function zoom(next: number, cx = 0, cy = 0) {
    next = Math.max(1, Math.min(8, next));
    const factor = next / scale;
    x = cx - (cx - x) * factor;
    y = cy - (cy - y) * factor;
    scale = next;
    schedule();
  }
  function point(event: { clientX: number; clientY: number }) {
    const bounds = stage.getBoundingClientRect();
    return { x: event.clientX - bounds.left - width / 2, y: event.clientY - bounds.top - height / 2 };
  }
  function toggle(cx: number, cy: number) { zoom(scale > 1 ? 1 : 2.5, cx, cy); }
  root.querySelector('[data-zoom-in]')!.addEventListener('click', () => zoom(scale * 1.4), { signal });
  root.querySelector('[data-zoom-out]')!.addEventListener('click', () => zoom(scale / 1.4), { signal });
  root.querySelector('[data-reset]')!.addEventListener('click', () => zoom(1), { signal });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
      const first = buttons[0], last = buttons.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case '+': case '=': zoom(scale * 1.25); break;
      case '-': case '_': zoom(scale / 1.25); break;
      case '0': zoom(1); break;
      case 'ArrowLeft': x += 60; schedule(); break;
      case 'ArrowRight': x -= 60; schedule(); break;
      case 'ArrowUp': y += 60; schedule(); break;
      case 'ArrowDown': y -= 60; schedule(); break;
      default: return;
    }
    event.preventDefault();
  }, { signal });
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    const p = point(event);
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    zoom(scale * Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.003), p.x, p.y);
  }, { passive: false, signal });
  stage.addEventListener('dblclick', (event) => {
    if (performance.now() - lastTouch < 600) return;
    const p = point(event);
    toggle(p.x, p.y);
  }, { signal });

  const pointers = new Map<number, { x: number; y: number }>();
  let tap: { time: number; x: number; y: number } | undefined;
  let start: { time: number; x: number; y: number } | undefined;
  let moved = false;
  const gesture = () => {
    const [a, b] = [...pointers.values()];
    return a ? { x: b ? (a.x + b.x) / 2 : a.x, y: b ? (a.y + b.y) / 2 : a.y,
      distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 } : undefined;
  };
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.pointerType === 'touch') {
      lastTouch = performance.now();
      event.preventDefault();
    }
    stage.setPointerCapture(event.pointerId);
    const p = point(event);
    pointers.set(event.pointerId, p);
    start = { ...p, time: performance.now() };
    moved = pointers.size > 1;
    if (moved) tap = undefined;
  }, { signal });
  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const before = gesture()!;
    const p = point(event);
    pointers.set(event.pointerId, p);
    const after = gesture()!;
    if (start && Math.hypot(p.x - start.x, p.y - start.y) > 8) moved = true;
    if (before.distance > 0 && after.distance > 0) {
      zoom(scale * after.distance / before.distance, before.x, before.y);
    }
    x += after.x - before.x;
    y += after.y - before.y;
    schedule();
  }, { signal });
  function release(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    if (event.type === 'pointerup' && event.pointerType === 'touch' && !moved && start &&
      performance.now() - start.time < 300) {
      const p = point(event);
      if (tap && performance.now() - tap.time < 350 && Math.hypot(p.x - tap.x, p.y - tap.y) < 30) {
        toggle(p.x, p.y);
        tap = undefined;
      } else tap = { ...p, time: performance.now() };
    }
    pointers.delete(event.pointerId);
    moved = true;
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    stage.addEventListener(type, release, { signal });
  }

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  image.addEventListener('load', resize, { signal });
  resize();
  try { renderer = webglRenderer(canvas); } catch { /* CSS image is already visible. */ }
  function fallback() {
    renderer?.dispose();
    renderer = undefined;
    canvas.hidden = true;
    root.dataset.renderer = 'css';
    schedule();
  }
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fallback();
  }, { signal });
  function upload(source: HTMLImageElement) {
    if (!renderer) return;
    try {
      renderer.upload(source);
      canvas.hidden = false;
      root.dataset.renderer = 'webgl';
      schedule();
    } catch { fallback(); }
  }
  root.dataset.renderer = renderer ? 'webgl' : 'css';
  // An existing cross-origin no-CORS display image cannot be used as a WebGL texture.
  if (image.complete && image.naturalWidth && new URL(image.src).origin === location.origin) upload(image);
  const detail = new Image();
  detail.decoding = 'async';
  detail.crossOrigin = 'anonymous';
  detail.onload = () => {
    if (!alive) return;
    image.src = detail.src;
    upload(detail);
    resize();
    status.textContent = '';
  };
  detail.onerror = () => {
    if (!alive) return;
    fallback();
    // Missing bucket CORS must not prevent ordinary cross-origin image viewing.
    const plain = new Image();
    plain.onload = () => {
      if (!alive) return;
      image.src = plain.src;
      resize();
      status.textContent = '';
    };
    plain.onerror = () => {
      if (alive) status.textContent = 'Higher-resolution detail is unavailable; showing the display image.';
    };
    plain.src = root.dataset.detail!;
  };
  detail.src = root.dataset.detail!;
  return () => {
    alive = false;
    events.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    renderer?.dispose();
    canvas.hidden = true;
  };
}

function webglRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false });
  if (!gl) return undefined;
  const resources: (() => void)[] = [];
  const dispose = () => { for (const release of resources.reverse()) release(); resources.length = 0; };
  try {
    function shader(type: number, source: string) {
      const value = gl!.createShader(type)!;
      resources.push(() => gl!.deleteShader(value));
      gl!.shaderSource(value, source);
      gl!.compileShader(value);
      if (!gl!.getShaderParameter(value, gl!.COMPILE_STATUS)) throw new Error('Shader unavailable');
      return value;
    }
    const program = gl.createProgram()!;
    resources.push(() => gl.deleteProgram(program));
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec2 position;
      uniform vec2 size;
      uniform vec2 offset;
      varying vec2 uv;
      void main() {
        uv = vec2((position.x + 1.0) * 0.5, (1.0 - position.y) * 0.5);
        gl_Position = vec4(position * size + offset, 0.0, 1.0);
      }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D photo;
      varying vec2 uv;
      void main() { gl_FragColor = texture2D(photo, uv); }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program unavailable');
    gl.useProgram(program);
    const buffer = gl.createBuffer()!;
    resources.push(() => gl.deleteBuffer(buffer));
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture()!;
    resources.push(() => gl.deleteTexture(texture));
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const size = gl.getUniformLocation(program, 'size');
    const offset = gl.getUniformLocation(program, 'offset');
    let ready = false;
    return {
      upload(image: HTMLImageElement) {
        if (Math.max(image.naturalWidth, image.naturalHeight) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) {
          throw new Error('Texture exceeds device limit');
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Texture unavailable');
        ready = true;
      },
      draw(w: number, h: number, iw: number, ih: number, x: number, y: number) {
        if (!ready) return;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        gl.viewport(0, 0, cw, ch);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(size, iw / w, ih / h);
        gl.uniform2f(offset, x * 2 / w, -y * 2 / h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
