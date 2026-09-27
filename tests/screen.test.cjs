const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// A deterministic media clock lets us exercise TV failures and long refresh cycles.
function environment({ preview = true, stored = null, storedAppearance = null, mutedRejection = false } = {}) {
  let now = 0, timerId = 0;
  const timers = new Map(), events = new Map(), storage = new Map();
  if (stored) storage.set('mtd-studio-screen-position', stored);
  if (storedAppearance) storage.set('mtd-studio-screen-appearance', JSON.stringify(storedAppearance));
  const schedule = (fn, ms, interval = 0) => { const id = ++timerId; timers.set(id, { fn, at: now + ms, interval }); return id; };
  const tick = ms => {
    const until = now + ms;
    let steps = 0;
    while (true) {
      const entry = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      assert.ok(++steps < 10000, 'No runaway timer loop');
      const [id, timer] = entry;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval; else timers.delete(id);
      timer.fn();
    }
    now = until;
  };
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.events = new Map(); this.hidden = false; this.currentTime = 0; this.playCalls = []; this.className = ''; this.classList = { add: name => { this.className += ` ${name}`; } }; }
    append(node) { this.children.push(node); node.parentNode = this; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); }
    querySelectorAll(tag) { return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]); }
    querySelector(tag) { return this.querySelectorAll(tag)[0]; }
    addEventListener(name, fn, options = {}) { const handlers = this.events.get(name) || []; handlers.push({ fn, once: options.once }); this.events.set(name, handlers); }
    emit(name) { const handlers = [...(this.events.get(name) || [])]; this.events.set(name, handlers.filter(handler => !handler.once)); handlers.forEach(handler => handler.fn()); }
    setAttribute(name, value) { this[name] = value; }
    removeAttribute(name) { delete this[name]; }
    pause() { this.paused = true; }
    load() {}
    async play() { this.playCalls.push(this.muted); if (mutedRejection && !this.muted) { const error = new Error('Blocked'); error.name = 'NotAllowedError'; throw error; } this.paused = false; this.emit('playing'); }
  }
  const stage = new Element('main'), fallback = new Element('div');
  stage.append(fallback);
  const logo = new Element('img'), copy = new Element('p');
  logo.hidden = true; copy.hidden = true; fallback.append(logo); fallback.append(copy);
  const parent = { postMessage() {} };
  const ctx = {
    URL, URLSearchParams, AbortController, console: { warn() {} },
    location: { href: 'https://studio.test/screen', origin: 'https://studio.test', search: preview ? '?preview=1' : '' },
    innerWidth: 1080, innerHeight: 1920,
    document: { getElementById: id => id === 'screen' ? stage : fallback, createElement: tag => new Element(tag) },
    Image: class extends Element { constructor() { super('img'); } },
    Date: { now: () => now },
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, ms), clearInterval: id => timers.delete(id),
    requestAnimationFrame: fn => schedule(fn, 0),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    addEventListener: (name, fn) => events.set(name, fn),
    MTD_SUPABASE: { url: 'https://data.test', anonKey: 'test' }
  };
  let navigation;
  ctx.MTD_SCREEN_CONTROLS = callbacks => { navigation = callbacks; return { close() {} }; };
  ctx.window = ctx;
  ctx.parent = preview ? parent : ctx;
  let published = {};
  ctx.fetch = async () => ({ ok: true, json: async () => [{ content: { studioScreen: published } }] });
  vm.createContext(ctx);
  vm.runInContext(read('screen-core.js'), ctx);
  vm.runInContext(read('screen.js'), ctx);
  return {
    ctx, stage, fallback, tick, storage, navigation,
    update: (settings, overrides = {}) => events.get('message')?.({ origin: ctx.location.origin, source: parent, data: { type: 'mtd-screen-preview', settings }, ...overrides }),
    publish: settings => { published = settings; events.get('online')?.(); },
    resize: (width, height) => { ctx.innerWidth = width; ctx.innerHeight = height; events.get('resize')(); tick(250); },
    current: () => stage.children.at(-1)?.children.find(node => node.className === 'screen-media'),
    layers: () => stage.children.filter(node => node.className.startsWith('screen-slide'))
  };
}
const image = (id, extra = {}) => ({ id, src: `https://studio.test/${id}.png`, duration: 3, ...extra });
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

test('normalization defaults to mute and rejects executable URLs', () => {
  const { ctx } = environment();
  const data = ctx.MTD_SCREEN.normalize({ items: [image('bad', { src: 'javascript:alert(1)', duration: -10 })] });
  assert.equal(data.muted, true);
  assert.equal(data.items[0].src, '');
  assert.equal(data.items[0].duration, 3);
  assert.equal(ctx.MTD_SCREEN.normalize({ muted: false }).muted, false);
});

test('images get their full duration after loading, and disabled slides are skipped', () => {
  const env = environment();
  env.update({ items: [image('a'), image('disabled', { enabled: false }), image('b')] });
  env.tick(10000);
  assert.match(env.current().src, /a.png$/);
  env.current().emit('load');
  env.tick(2999);
  assert.equal(env.fallback.hidden, true);
  assert.match(env.current().src, /a.png$/);
  env.tick(1);
  assert.match(env.current().src, /b.png$/);
});

test('broken media is skipped; an entirely broken playlist falls back without spinning', () => {
  const env = environment();
  env.update({ items: [image('a'), image('b')] });
  env.current().emit('error'); env.tick(100);
  assert.match(env.current().src, /b.png$/);
  env.current().emit('error'); env.tick(100);
  assert.equal(env.fallback.hidden, false);
  assert.equal(env.layers().length, 0);
  env.tick(60000);
  assert.ok(env.current());
});

test('media that never loads times out and advances', () => {
  const env = environment();
  env.update({ items: [image('a'), image('b')] });
  env.tick(20100);
  assert.match(env.current().src, /b.png$/);
});

test('video plays muted by default and advances on ended', async () => {
  const env = environment();
  env.update({ items: [image('video', { type: 'video' }), image('next')] });
  await flush();
  const video = env.current();
  assert.equal(video.muted, true);
  assert.equal(video.paused, false);
  env.tick(10000);
  assert.equal(env.current(), video);
  video.emit('ended');
  assert.match(env.current().src, /next.png$/);
});

test('sound-on playback retries muted when browser autoplay rejects sound', async () => {
  const env = environment({ mutedRejection: true });
  env.update({ muted: false, items: [image('video', { type: 'video' })] });
  await flush();
  assert.deepEqual(env.current().playCalls, [false, true]);
  assert.equal(env.fallback.hidden, true);
});

test('stalled video advances instead of holding the display indefinitely', async () => {
  const env = environment();
  env.update({ items: [image('video', { type: 'video' }), image('next')] });
  await flush();
  env.tick(40100);
  assert.match(env.current().src, /next.png$/);
});

test('rotation changes choose the alternate source and preserve fit', () => {
  const env = environment();
  env.update({ items: [image('portrait', { landscapeSrc: 'https://studio.test/landscape.png', fit: 'contain' })] });
  assert.match(env.current().src, /portrait.png$/);
  env.resize(1920, 1080);
  assert.match(env.current().src, /landscape.png$/);
  assert.equal(env.current().style.objectFit, 'contain');
});

test('preview ignores messages from other origins and other windows', () => {
  const env = environment();
  env.update({ items: [image('bad')] }, { origin: 'https://other.test' });
  assert.equal(env.layers().length, 0);
  env.update({ items: [image('bad')] }, { source: {} });
  assert.equal(env.layers().length, 0);
});

test('published changes wait for a slide boundary and can clear the playlist', async () => {
  const env = environment({ preview: false });
  await flush();
  env.publish({ items: [image('a'), image('b')] }); await flush();
  env.current().emit('load');
  env.publish({ items: [image('new')] }); await flush();
  assert.match(env.current().src, /a.png$/);
  env.tick(3000);
  assert.match(env.current().src, /new.png$/);
  env.current().emit('load');
  env.publish({ items: [] }); await flush();
  env.tick(3000);
  assert.equal(env.fallback.hidden, false);
  env.tick(500);
  assert.equal(env.layers().length, 0);
});

test('reloading resumes at the remembered next slide; preview does not change it', async () => {
  const env = environment({ preview: false, stored: 'b' });
  await flush();
  env.publish({ items: [image('a'), image('b'), image('c')] }); await flush();
  assert.match(env.current().src, /b.png$/);
  env.current().emit('load');
  assert.equal(env.storage.get('mtd-studio-screen-position'), 'c');
  const preview = environment({ stored: 'b' });
  preview.update({ items: [image('a'), image('b')] }); preview.current().emit('load');
  assert.equal(preview.storage.get('mtd-studio-screen-position'), 'b');
});


test('position insertion shifts intervening slides in both directions', () => {
  const { ctx } = environment();
  const items = Array.from({ length: 14 }, (_, index) => index + 1);
  ctx.MTD_SCREEN.moveItem(items, 0, 11);
  assert.deepEqual(items, [2,3,4,5,6,7,8,9,10,11,12,1,13,14]);
  ctx.MTD_SCREEN.moveItem(items, 11, 0);
  assert.deepEqual(items, Array.from({ length: 14 }, (_, index) => index + 1));
  ctx.MTD_SCREEN.moveItem(items, 0, 99);
  assert.equal(items[0], 1);
});

test('custom loading appearance and image background apply to fallback and media', () => {
  const env = environment();
  env.update({ backgroundImage: '/wall.png', loadingImage: '/welcome.png', loadingText: 'Welcome dancers', loadingTextColor: '#123456', loadingLayout: 'full', items: [] });
  assert.equal(env.fallback.querySelector('p').textContent, 'Welcome dancers');
  assert.match(env.fallback.querySelector('img').src, /welcome.png$/);
  assert.equal(env.fallback.style.color, '#123456');
  assert.match(env.fallback.className, /is-full/);
  assert.match(env.stage.style.backgroundImage, /wall.png/);
  env.update({ backgroundImage: '/wall.png', loadingText: '', loadingImage: '', items: [image('a')] });
  assert.equal(env.fallback.querySelector('p').hidden, true);
  assert.equal(env.fallback.querySelector('img').hidden, true);
  assert.match(env.layers()[0].style.backgroundImage, /wall.png/);
});

test('cached published artwork appears before the startup network request resolves', () => {
  const env = environment({ preview: false, storedAppearance: { loadingText: 'Saved welcome', loadingImage: '/saved.png', backgroundImage: '/wall.png' } });
  assert.equal(env.fallback.querySelector('p').textContent, 'Saved welcome');
  assert.match(env.fallback.querySelector('img').src, /saved.png$/);
  assert.match(env.stage.style.backgroundImage, /wall.png/);
  const firstVisit = environment({ preview: false });
  assert.equal(firstVisit.fallback.querySelector('p').hidden, true);
});

test('loading screen defaults on, interludes default off, and disabling preserves artwork', () => {
  const env = environment();
  assert.equal(env.ctx.MTD_SCREEN.normalize().loadingEnabled, true);
  assert.equal(env.ctx.MTD_SCREEN.normalize().loadingBetween, false);
  env.update({ loadingEnabled: false, loadingBetween: true, loadingText: 'Keep this design', items: [] });
  assert.equal(env.fallback.hidden, true);
  assert.equal(env.fallback.querySelector('p').textContent, 'Keep this design');
  env.update({ loadingEnabled: true, loadingText: 'Keep this design', items: [] });
  assert.equal(env.fallback.hidden, false);
  const cached = environment({ preview: false, storedAppearance: { loadingEnabled: false, loadingText: 'Hidden on startup' } });
  assert.equal(cached.fallback.hidden, true);
});

test('interlude shows between images for the configured time, including loop wrap', () => {
  const env = environment();
  env.update({ loadingBetween: true, loadingDuration: 2, items: [image('a'), image('b')] });
  env.current().emit('load'); env.tick(3000);
  assert.equal(env.layers().length, 0);
  assert.equal(env.fallback.hidden, false);
  env.tick(1999); assert.equal(env.layers().length, 0);
  env.tick(1); assert.match(env.current().src, /b.png$/);
  env.current().emit('load'); env.tick(3000);
  assert.equal(env.fallback.hidden, false);
  env.resize(1920, 1080); assert.equal(env.layers().length, 0);
  env.tick(1750); assert.match(env.current().src, /a.png$/);
});

test('video end inserts interlude but disabled loading skips it', async () => {
  for (const enabled of [true, false]) {
    const env = environment();
    env.update({ loadingEnabled: enabled, loadingBetween: true, items: [image('v', { type: 'video' }), image('b')] });
    await flush();
    env.current().emit('ended');
    if (enabled) {
      assert.equal(env.layers().length, 0); assert.equal(env.fallback.hidden, false);
      env.tick(3000);
    }
    assert.match(env.current().src, /b.png$/);
  }
});

test('broken media does not insert an extra interlude', () => {
  const env = environment();
  env.update({ loadingBetween: true, items: [image('broken'), image('good')] });
  env.current().emit('error'); env.tick(100);
  assert.match(env.current().src, /good.png$/);
});

test('browsing pauses timers and rotation; returning advances once', () => {
  const env = environment();
  env.update({ items: [image('a'), image('b')] });
  env.current().emit('load');
  env.navigation.suspend();
  env.tick(30000);
  env.resize(1920, 1080);
  assert.match(env.current().src, /a.png$/);
  env.navigation.resume();
  assert.match(env.current().src, /b.png$/);
});

test('a selected video plays once and resumes the interrupted playlist position', () => {
  const env = environment();
  const video = image('clip', { type: 'video' });
  env.update({ items: [image('a'), image('b'), video], loadingBetween: true });
  env.current().emit('load');
  env.navigation.suspend();
  env.navigation.play(video);
  assert.match(env.current().src, /clip.png$/);
  env.current().emit('ended');
  assert.match(env.current().src, /b.png$/);
});

test('failed selected video returns to playlist, and stale completion cannot skip slides', () => {
  const env = environment();
  env.update({ items: [image('a'), image('b')] });
  env.current().emit('load');
  env.navigation.suspend();
  env.navigation.play(image('broken', { type: 'video' }));
  const oldVideo = env.current();
  oldVideo.emit('error');
  env.tick(100);
  assert.match(env.current().src, /b.png$/);
  oldVideo.emit('ended');
  assert.match(env.current().src, /b.png$/);
});

test('published updates remain pending while browsing even from an empty playlist', async () => {
  const env = environment({ preview: false });
  await flush();
  env.navigation.suspend();
  env.publish({ items: [image('new')] });
  await flush();
  env.tick(10000);
  assert.equal(env.layers().length, 0);
  env.navigation.resume();
  assert.match(env.current().src, /new.png$/);
});

test('navigation metadata is normalized and inactivity timeout is bounded', () => {
  const env = environment();
  const result = env.ctx.MTD_SCREEN.normalize({ browseTimeout: 9999, items: [image('a', { type: 'video', displayName: 'First dance', category: 'general' }), image('b', { category: 'invalid' })] });
  assert.equal(result.browseTimeout, 600);
  assert.equal(result.items[0].displayName, 'First dance');
  assert.equal(result.items[0].category, 'general');
  assert.equal(result.items[1].category, 'general');
});

test('Back to Playlist pauses the selected video immediately while the next image loads', () => {
  const env = environment();
  env.update({ items: [image('a'), image('b')] });
  env.current().emit('load');
  env.navigation.suspend();
  env.navigation.play(image('selected', { type: 'video' }));
  const video = env.current();
  env.navigation.resume();
  assert.equal(video.paused, true);
  assert.match(env.current().src, /b.png$/);
});

function rotationEnvironment({ saved = '0', preview = false, blocked = false } = {}) {
  const properties = {}, classes = new Set(), listeners = new Map();
  const storage = new Map([['mtd-studio-screen-rotation', saved]]);
  const viewport = { style: { setProperty: (key, value) => { properties[key] = value; } }, classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } };
  const ctx = {
    URLSearchParams, Event, innerWidth: 1920, innerHeight: 1080,
    location: { search: preview ? '?preview=1' : '' },
    document: { getElementById: () => viewport },
    localStorage: {
      getItem(key) { if (blocked) throw new Error('Unavailable'); return storage.get(key); },
      setItem(key, value) { if (blocked) throw new Error('Unavailable'); storage.set(key, value); }
    },
    addEventListener: (name, fn) => listeners.set(name, fn),
    dispatchEvent: event => listeners.get(event.type)?.()
  };
  ctx.window = ctx; ctx.parent = preview ? {} : ctx;
  vm.createContext(ctx);
  vm.runInContext(read('screen-rotation.js'), ctx);
  return { ctx, viewport, properties, classes, storage, resize: () => listeners.get('resize')() };
}

test('rotation cycles all four directions, swaps dimensions, and remembers the device setting', () => {
  const env = rotationEnvironment();
  const rotation = env.ctx.MTD_SCREEN_ROTATION;
  for (const degrees of [90, 180, 270, 0]) {
    rotation.rotate();
    assert.equal(rotation.angle(), degrees);
    assert.equal(env.viewport.style.width, degrees % 180 ? '1080px' : '1920px');
    assert.equal(env.viewport.style.height, degrees % 180 ? '1920px' : '1080px');
    assert.equal(rotation.landscape(), degrees % 180 === 0);
    assert.equal(env.storage.get('mtd-studio-screen-rotation'), String(degrees));
  }
  assert.equal(rotationEnvironment({ saved: '270' }).ctx.MTD_SCREEN_ROTATION.angle(), 270);
});

test('rotation resizes correctly and preview does not change the saved orientation', () => {
  const env = rotationEnvironment({ saved: '90', preview: true });
  assert.equal(env.ctx.MTD_SCREEN_ROTATION.angle(), 0);
  env.ctx.MTD_SCREEN_ROTATION.rotate();
  assert.equal(env.storage.get('mtd-studio-screen-rotation'), '90');
  env.ctx.MTD_SCREEN_ROTATION.rotate();
  assert.equal(env.storage.get('mtd-studio-screen-rotation'), '90');
  env.ctx.innerWidth = 390; env.ctx.innerHeight = 844; env.resize();
  assert.equal(env.viewport.style.width, '390px');
  assert.ok(env.classes.has('is-narrow'));
  assert.equal(env.properties['--screen-height'], '844px');
});

test('rotation remains usable with blocked storage and ignores invalid saved values', () => {
  const env = rotationEnvironment({ blocked: true });
  env.ctx.MTD_SCREEN_ROTATION.rotate();
  assert.equal(env.ctx.MTD_SCREEN_ROTATION.angle(), 90);
  assert.equal(rotationEnvironment({ saved: '45' }).ctx.MTD_SCREEN_ROTATION.angle(), 0);
});

test('legacy rate cards and schedules move out of the playlist without losing images', () => {
  const env = environment();
  const result = env.ctx.MTD_SCREEN.normalize({ items: [
    image('photo'), image('rate', { category: 'packages', landscapeSrc: 'https://studio.test/wide.png', enabled: false }),
    image('schedule', { category: 'schedule' })
  ] });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'photo');
  assert.equal(result.navigationImages.packages[0].id, 'rate');
  assert.equal(result.navigationImages.packages[0].enabled, false);
  assert.equal(result.navigationImages.packages[0].landscapeSrc, 'https://studio.test/wide.png');
  assert.equal(result.navigationImages.schedule[0].id, 'schedule');
  assert.equal(JSON.stringify(env.ctx.MTD_SCREEN.normalize(result)), JSON.stringify(result));
  env.update(result);
  assert.match(env.current().src, /photo.png$/);
  env.current().emit('load');
  env.tick(3000);
  assert.match(env.current().src, /photo.png$/);
});

test('explicit empty navigation lists do not resurrect removed legacy cards', () => {
  const env = environment();
  const result = env.ctx.MTD_SCREEN.normalize({
    navigationImages: { packages: [], schedule: [] },
    items: [image('rate', { category: 'packages' })]
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.navigationImages.packages.length, 0);
});
