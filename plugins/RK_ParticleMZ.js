/*:
 * @target MZ
 * @plugindesc v1.1.9+QLOD (no texture LOD) Lightweight Glitter Field / Photon Array particles (screen/world space, target player/event, rate, lifetime, color + SHAPE emit)
 * @author Rizuki Keiji
 *
 * @help
 * v1.1.9 adds Allocation Chunk Size (pool grows in configurable chunks to reduce first-spawn hitch).
 * v1.1.5 adds World Space (Space Mode = World) so emitters can be map/world-anchored and won't stick to the camera.
 * v1.1.1 fixes menu/load texture invalid crash + regenerates particle texture after scene changes.
 * v1.1 adds Shape Emit:
 * - Spawn from the target's sprite silhouette (Fill or Outline)
 * - Cached per displayed frame for performance
 * v1.1.7 adds Effect Mode: Field (shell emission using Spread as radius + Field Thickness)
 *
 * @param maxParticles
 * @text Max Particles (Pool Size)
 * @type number
 * @min 128
 * @max 20000
 * @default 3000
 *
 *
 * @param allocationChunkSize
 * @text Allocation Chunk Size
 * @type number
 * @min 1
 * @max 4096
 * @default 64
 * @desc How many particle sprites to allocate at once when the pool needs to grow. Higher = fewer allocations, but bigger first-spawn hitch.
 *
 * @param hardCapFairShare
 * @text Hard Cap Fair Share
 * @type boolean
 * @default true
 * @desc When near the particle cap, distribute spawn reductions proportionally across ALL emitters instead of starving newer ones.
 *
 * @param defaultBlendMode
 * @text Default Blend Mode
 * @type select
 * @option NORMAL
 * @option ADD
 * @option MULTIPLY
 * @option SCREEN
 * @default ADD
 *
 * @param defaultColor
 * @text Default Fixed Color (hex)
 * @type string
 * @default #88CCFF
 *
 * @param defaultPalette
 * @text Default Palette (comma hex)
 * @type string
 * @default #88CCFF,#FFD966,#FF88CC,#A8FF88,#FFFFFF
 *
 * @param defaultZLayer
 * @text Default Z Layer
 * @type select
 * @option Custom
 * @option Target
 * @option AboveCharacters
 * @option BelowCharacters
 * @option SameCharacter
 * @default Custom
 *
 * @param defaultCustomZ
 * @text Default Custom Z (number)
 * @type number
 * @decimals 2
 * @default 3.00
 * @desc Used when Z Layer = Custom (DEFAULT also uses this if Default Z Layer is Custom).
 *
 * @param textureRadius
 * @text Particle Texture Radius (px)
 * @type number
 * @min 1
 * @max 12
 * @default 3
 *
 * @param defaultFieldThickness
 * @text Default Field Thickness (px)
 * @type number
 * @min 0
 * @max 999
 * @default 16
 *
 * @param shapeRebuildInterval
 * @text Shape Rebuild Interval (sec)
 * @type number
 * @min 0
 * @decimals 2
 * @default 0.20
 *
 * @param shapeAutoLod
 * @text Shape Auto-LOD
 * @type boolean
 * @default true
 *
 * @param shapeLodRateHigh
 * @text Shape LOD High Rate (particles/sec)
 * @type number
 * @min 0
 * @decimals 0
 * @default 250
 *
 * @param shapeLodRateVeryHigh
 * @text Shape LOD Very High Rate (particles/sec)
 * @type number
 * @min 0
 * @decimals 0
 * @default 500
 *
 *
 * @param particleAutoLod
 * @text Particle Auto-LOD
 * @type boolean
 * @default true
 *
 * @param particleLodStart
 * @text Particle LOD Start (active particles)
 * @type number
 * @min 0
 * @decimals 0
 * @default 500
 *
 * @param particleLodMid
 * @text Particle LOD Mid (active particles)
 * @type number
 * @min 0
 * @decimals 0
 * @default 1000
 *
 * @param particleLodLow
 * @text Particle LOD Low (active particles)
 * @type number
 * @min 0
 * @decimals 0
 * @default 1500
 * 
 * @param particleLodDisableRotationTier
 * @text Disable Rotation At Tier
 * @type number
 * @min 0
 * @max 3
 * @decimals 0
 * @default 2
 *
 * @param particleLodSimplifyAnimTier
 * @text Simplify Scale/Alpha At Tier
 * @type number
 * @min 0
 * @max 3
 * @decimals 0
 * @default 3
 *
 * @param particleLodStrideTier
 * @text Coarse Sprite Update At Tier
 * @type number
 * @min 0
 * @max 3
 * @decimals 0
 * @default 3 
 *
 * @param particleLodStride
 * @text Coarse Sprite Update Stride
 * @desc 2 = update about half the particles each frame, 3 = about one third, etc.
 * @type number
 * @min 2
 * @decimals 0
 * @default 2
 * @param shapeGlobalCache
 * @text Shape Global Cache (share between emitters)
 * @type boolean
 * @default true
 *
 * @param shapeCacheMaxEntries
 * @text Shape Cache Max Entries
 * @type number
 * @min 8
 * @max 512
 * @default 64
 *
 * @command startEmitter
 * @text Start Emitter
 *
 * @arg emitterId
 * @text Emitter ID (unique)
 * @type string
 * @default glitter1
 *
 * @arg targetType
 * @text Target Type
 * @type select
 * @option Player
 * @option Event
 * @default Player
 *
 * @arg targetEventId
 * @text Target Event ID (if Event)
 * @type number
 * @min 0
 * @default 1
 *
 * @arg spaceMode
 * @text Space Mode
 * @type select
 * @option Screen
 * @option World
 * @desc Screen = follows camera (HUD-like). World = stays in map/world space (doesn't stick to camera).
 * @default Screen

 * @arg followTarget
 * @text Follow Target
 * @type boolean
 * @default false
 * @desc If true, each spawned particle stays attached to the target's movement (works in both Screen and World space).
 *
 * @arg rate
 * @text Rate (particles/sec)
 * @type number
 * @min 0
 * @decimals 2
 * @default 60
 *
 * @arg lifetime
 * @text Lifetime (sec)
 * @type number
 * @min 0.05
 * @decimals 2
 * @default 0.8
 *
 * @arg duration
 * @text Emitter Duration (sec, 0=infinite)
 * @type number
 * @min 0
 * @decimals 2
 * @default 0
 *
 * @arg xOffset
 * @text X Offset (px)
 * @type number
 * @decimals 0
 * @default 0
 *
 * @arg yOffset
 * @text Y Offset (px)
 * @type number
 * @decimals 0
 * @default -18
 *
 * @arg spread
 * @text Spawn Spread Radius (px)
 * @type number
 * @min 0
 * @decimals 0
 * @default 8
*
* @arg fieldThickness
* @text Field Thickness (px, Field mode)
 * @type number
* @min 0
* @max 999
* @default 16
 *
 * @arg speedMin
 * @text Speed Min (px/sec)
 * @type number
 * @min -9999
 * @decimals 0
 * @default 10
 *
 * @arg speedMax
 * @text Speed Max (px/sec)
 * @type number
 * @min -9999
 * @decimals 0
 * @default 60
 *
 * @arg angleMin
 * @text Angle Min (deg)
 * @type number
 * @min -360
 * @max 360
 * @decimals 0
 * @default 0
 *
 * @arg angleMax
 * @text Angle Max (deg)
 * @type number
 * @min -360
 * @max 360
 * @decimals 0
 * @default 360
 *
 * @arg gravity
 * @text Gravity Y (px/sec^2)
 * @type number
 * @decimals 0
 * @default 0
 *
 * @arg scaleMin
 * @text Scale Min
 * @type number
 * @min 0.1
 * @decimals 2
 * @default 0.5
 *
 * @arg scaleMax
 * @text Scale Max
 * @type number
 * @min 0.1
 * @decimals 2
 * @default 1.0
 *
 * @arg alphaStart
 * @text Alpha Start
 * @type number
 * @min 0
 * @max 1
 * @decimals 2
 * @default 1.0
 *
 * @arg alphaEnd
 * @text Alpha End
 * @type number
 * @min 0
 * @max 1
 * @decimals 2
 * @default 0.0
 *
 * @arg effectMode
 * @text Effect Mode
 * @type select
 * @option Glitter
 * @option PhotonArray
 * @option Field
 * @default Glitter
 *
 * @arg arraySegments
 * @text PhotonArray Segments
 * @type number
 * @min 3
 * @max 360
 * @default 24
 *
 * @arg blendMode
 * @text Blend Mode
 * @type select
 * @option DEFAULT
 * @option NORMAL
 * @option ADD
 * @option MULTIPLY
 * @option SCREEN
 * @default DEFAULT
 *
 * @arg zLayer
 * @text Z Layer
 * @type select
 * @option DEFAULT
 * @option Custom
 * @option Target
 * @option Dynamic
 * @option AboveCharacters
 * @option BelowCharacters
 * @option SameCharacter
 * @default DEFAULT
 *
 * @arg customZ
 * @text Custom Z (number)
 * @type number
 * @decimals 2
 * @default 3.00
 * @desc Used only when Z Layer = Custom.
 * 
 * @arg dynamicZRef
 * @text Dynamic Z Ref (JS)
 * @type string
 * @desc Evaluate JS for Z-index. e.g. RK.Battle.Core.activeObjects[0].screenZ()
 *
 * @arg texture
 * @text Custom Texture (img/particles/)
 * @type string
 * @default default
 * @desc Set to 'default' for glowing orb, or a filename in img/particles/ (e.g. light_shaft)
 *
 * @arg colorMode
 * @text Color Mode
 * @type select
 * @option Fixed
 * @option Palette
 * @option RandomHue
 * @default Fixed
 *
 * @arg fixedColor
 * @text Fixed Color (hex)
 * @type string
 * @default #88CCFF
 *
 * @arg palette
 * @text Palette (comma hex)
 * @type string
 * @default #88CCFF,#FFD966,#FF88CC,#A8FF88,#FFFFFF
 *
 * @arg randomHueBase
 * @text RandomHue Base (hex)
 * @type string
 * @default #88CCFF
 *
 * @arg randomHueRange
 * @text RandomHue Range (+/- degrees)
 * @type number
 * @min 0
 * @max 180
 * @decimals 0
 * @default 40
 *
 * @arg shapeMode
 * @text Shape Mode
 * @type select
 * @option None
 * @option Fill
 * @option Outline
 * @default None
 *
 * @arg shapeSampleStep
 * @text Shape Sample Step (px)
 * @type number
 * @min 1
 * @max 8
 * @default 3
 *
 * @arg shapeAlphaThreshold
 * @text Shape Alpha Threshold (0-255)
 * @type number
 * @min 0
 * @max 255
 * @default 20
 *
 * @arg shapeScale
 * @text Shape Scale
 * @type number
 * @min 0.1
 * @decimals 2
 * @default 1.0
 *
 * @command stopEmitter
 * @text Stop Emitter
 *
 * @arg emitterId
 * @text Emitter ID
 * @type string
 * @default glitter1
 *
 * @command clearAll
 * @text Clear All Emitters & Particles
 *
 * @command setEmitterColor
 * @text Set Emitter Color (future particles)
 *
 * @arg emitterId
 * @text Emitter ID
 * @type string
 * @default glitter1
 *
 * @arg colorMode
 * @text Color Mode
 * @type select
 * @option Fixed
 * @option Palette
 * @option RandomHue
 * @default Fixed
 *
 * @arg fixedColor
 * @text Fixed Color (hex)
 * @type string
 * @default #FFFFFF
 *
 * @arg palette
 * @text Palette (comma hex)
 * @type string
 * @default #FFFFFF,#88CCFF,#FFD966
 *
 * @arg randomHueBase
 * @text RandomHue Base (hex)
 * @type string
 * @default #88CCFF
 *
 * @arg randomHueRange
 * @text RandomHue Range (+/- degrees)
 * @type number
 * @min 0
 * @max 180
 * @decimals 0
 * @default 40
 */

var Imported = Imported || {};
Imported.RK_ParticleMZ = true;

(() => {
  "use strict";
  // IMPORTANT: must match your plugin file name (without .js) in Plugin Manager.
  const pluginName = (document.currentScript && document.currentScript.src && document.currentScript.src.match(/([^\/]+)\.js$/)) ? RegExp.$1 : "RK_ParticleMZ";

  const params = PluginManager.parameters(pluginName);

  const P_MAX = Math.max(128, Number(params.maxParticles || 3000));
  const P_HARDCAP_FAIR = String(params.hardCapFairShare ?? 'true').toLowerCase() === 'true';
  const P_ALLOC_CHUNK = Math.max(1, Number(params.allocationChunkSize || 64));
  const P_DEF_BLEND = String(params.defaultBlendMode || "ADD");
  const P_DEF_COLOR = String(params.defaultColor || "#88CCFF");
  const P_DEF_PALETTE = String(params.defaultPalette || "#88CCFF,#FFD966,#FF88CC,#A8FF88,#FFFFFF");
  const P_DEF_Z = String(params.defaultZLayer || "AboveCharacters");
  const P_DEF_CUSTOMZ = Number(params.defaultCustomZ || 3.00);
  const P_TEX_R = Math.max(1, Number(params.textureRadius || 3));
  const P_DEF_FIELD_THICK = Math.max(0, Number(params.defaultFieldThickness || 16));

  const P_SHAPE_REBUILD_INTERVAL = Math.max(0, Number(params.shapeRebuildInterval || 0.20));
  const P_SHAPE_AUTOLOD = String(params.shapeAutoLod || "true") === "true";
  const P_SHAPE_LOD_HIGH = Math.max(0, Number(params.shapeLodRateHigh || 250));
  const P_SHAPE_LOD_VERYHIGH = Math.max(P_SHAPE_LOD_HIGH, Number(params.shapeLodRateVeryHigh || 500));
  const P_SHAPE_GLOBAL_CACHE = String(params.shapeGlobalCache || "true") === "true";
// Particle visual/update Auto-LOD (does NOT change texture size; keeps P_TEX_R constant)
const P_QLOD_ENABLED = String(params.particleAutoLod || "true") === "true";
const P_QLOD_START = Math.max(0, Number(params.particleLodStart || 500));
const P_QLOD_MID = Math.max(P_QLOD_START, Number(params.particleLodMid || 1000));
const P_QLOD_LOW = Math.max(P_QLOD_MID, Number(params.particleLodLow || 1500));
// min 999 to disable
const P_QLOD_DISABLE_ROT_TIER = Math.max(0, Math.min(999, Number(params.particleLodDisableRotationTier || 2)));
const P_QLOD_SIMPLIFY_TIER = Math.max(0, Math.min(999, Number(params.particleLodSimplifyAnimTier || 3)));
const P_QLOD_STRIDE_TIER = Math.max(0, Math.min(999, Number(params.particleLodStrideTier || 3)));
const P_QLOD_STRIDE = Math.max(2, Number(params.particleLodStride || 2));

function rkQlodTier(activeCount) {
  if (!P_QLOD_ENABLED) return 0;
  if (activeCount >= P_QLOD_LOW) return 3;
  if (activeCount >= P_QLOD_MID) return 2;
  if (activeCount >= P_QLOD_START) return 1;
  return 0;
}
  const P_SHAPE_CACHE_MAX = Math.max(8, Number(params.shapeCacheMaxEntries || 64));


  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function parseHexColor(str, fallback) {
    const s = String(str || "").trim();
    const hex = s.startsWith("#") ? s.slice(1) : s;
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16);
    return parseHexColor(fallback || "#FFFFFF", "#FFFFFF");
  }

  function parsePalette(str, fallback) {
    const src = (str && String(str).trim().length) ? String(str) : String(fallback || "");
    return src.split(",").map(x => x.trim()).filter(Boolean).map(x => parseHexColor(x, "#FFFFFF"));
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return { r, g, b };
  }

  function tintRandomHue(baseHex, rangeDeg) {
    const base = baseHex >>> 0;
    const r = (base >> 16) & 0xFF;
    const g = (base >> 8) & 0xFF;
    const b = base & 0xFF;
    const hsl = rgbToHsl(r, g, b);
    const dh = (Math.random() * 2 - 1) * rangeDeg;
    const rgb = hslToRgb(hsl.h + dh, hsl.s, hsl.l);
    return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
  }

  function blendModeFromString(s) {
    const v = String(s || "").toUpperCase();
    if (v === "ADD") return PIXI.BLEND_MODES.ADD;
    if (v === "MULTIPLY") return PIXI.BLEND_MODES.MULTIPLY;
    if (v === "SCREEN") return PIXI.BLEND_MODES.SCREEN;
    return PIXI.BLEND_MODES.NORMAL;
  }

  // ------------------------
  // Save state
  // ------------------------
  const _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function() {
    _Game_System_initialize.call(this);
    this._rkParticleSnapshot = null;
    this._rkParticleMenuSnapshot = null;    
    this._rkParticleEmitters = [];
  };

  Game_System.prototype.rkGetEmitters = function() {
    if (!this._rkParticleEmitters) this._rkParticleEmitters = [];
    return this._rkParticleEmitters;
  };

  Game_System.prototype.rkUpsertEmitter = function(cfg) {
    const arr = this.rkGetEmitters();
    const idx = arr.findIndex(e => e && e.emitterId === cfg.emitterId);
    if (idx >= 0) arr[idx] = cfg;
    else arr.push(cfg);
  };

  Game_System.prototype.rkRemoveEmitter = function(emitterId) {
    const arr = this.rkGetEmitters();
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] && arr[i].emitterId === emitterId) arr.splice(i, 1);
    }
  };

  Game_System.prototype.rkClearAll = function() {
    this._rkParticleEmitters = [];
  };

  // ------------------------
  // Particle System
  // ------------------------
  class RKParticle {
    constructor(sprite) {
      this.sprite = sprite;
      this.reset();
    }
    reset() {
      this.life = 0;
      this.maxLife = 1;

      // Sim-space (do NOT rely on PIXI sprite being alive during scene transitions)
      this.x = 0;
      this.y = 0;
      this.rot = 0;

      this.srcX = 0;
      this.srcY = 0;
      this.stopAtSource = false;

      this.vx = 0;
      this.vy = 0;
      this.ay = 0;

      this.rotSpd = 0;
      this.s0 = 1; this.s1 = 1;
      this.a0 = 1; this.a1 = 0;

      this.tint = 0xFFFFFF;
      this.blendMode = PIXI.BLEND_MODES.NORMAL;
      this.layer = "above";
      this.space = "screen";

      // Optional: keep particle movement relative to its target
      this.followTarget = false;
      this.followEmitterId = "";
      this.followLastX = 0;
      this.followLastY = 0;
      this.texName = "default";
      this.zIndex = 9;
    }
  }

class RKEmitter {
  constructor(cfg) {
    this.cfg = cfg;
    this._accum = 0;     // particles/sec accumulator
    this._timeLeft = Number(cfg.duration || 0);
    this._emitIndex = 0;
  }
  isExpired() {
    return (this._timeLeft > 0 && this._timeLeft <= 0.000001);
  }

    _prepare(dt, system) {
    if (this._timeLeft > 0) this._timeLeft -= dt;
    if (this._timeLeft > 0 && this._timeLeft <= 0) this._timeLeft = 0;
    if (this.isExpired()) return null;
  
    const cfg = this.cfg;
    const pos = system.getTargetPos(cfg);
    if (!pos) return null;
  
    // Legacy particles/sec
    const rate = Math.max(0, Number(cfg.rate || 0));
    if (rate <= 0) return null;
  
    this._accum += rate * dt;
    let n = Math.floor(this._accum);
    if (n <= 0) return null;
    this._accum -= n;
  
    // Prevent runaway spikes
    n = Math.min(n, 200);
    return { cfg, pos, n };
  }
  
  _emit(system, cfg, pos, n) {
    for (let i = 0; i < n; i++) {
      system.spawnParticle(cfg, pos.x, pos.y, this._emitIndex++);
    }
  }
  
  update(dt, system) {
    const r = this._prepare(dt, system);
    if (!r) return;
    this._emit(system, r.cfg, r.pos, r.n);
  }
}

class RKParticleSystem {
    constructor() {
      this._ready = false;
      this._texture = null;
      this._containerAbove = null;
      this._containerBelow = null;
      this._containerAboveWorld = null;
      this._containerBelowWorld = null;
      this._containerSame = null;
      this._containerSameWorld = null;
      this._customContainers = new Map();
      this._customContainersWorld = new Map();

      this._qlodFrame = 0;
      this._qlodTier = 0;


      this._pool = [];
      this._active = [];
      this._emitters = new Map();

      this._lastSpriteset = null;

      // Performance: lazy-allocate sprites/pool so the plugin is near-zero overhead when idle
      this._hasWorld = false;        // true if any emitter/particle uses World space
      this._worldDirty = false;      // mark for world-usage recalculation
      this._containersRenderable = false;
      this._allocChunk = P_ALLOC_CHUNK; // allocate sprites in chunks to reduce spikes

      // Shape caches
      this._shapeEmitterState = new Map(); // emitterId -> { lastBuildAt:number, lastKey:string, lastData:any }
      this._shapeGlobalCache = new Map();  // key -> { data:{key,points,w,h}, lastUsed:number }
    }

    ensureTexture(force = false) {
      if (this._texture && !force) {
        try {
          const bt = this._texture.baseTexture;
          const res = bt && bt.resource;
          if (bt && res && res.valid) return;
        } catch (e) {}
      }

      if (this._texture) {
        try { this._texture.destroy(true); } catch (e) {}
        this._texture = null;
      }

      // -------------------------------------------------------------
      // BAKE A PRE-BLURRED GLOWING ORB INTO MEMORY
      // -------------------------------------------------------------
      // We double the radius to give the blur room to fade out naturally
      const r = P_TEX_R * 2; 
      const canvas = document.createElement('canvas');
      canvas.width = r * 2;
      canvas.height = r * 2;
      const ctx = canvas.getContext('2d');

      // Create a smooth radial gradient (Center -> Edge)
      const grd = ctx.createRadialGradient(r, r, 0, r, r, r);
      grd.addColorStop(0, 'rgba(255, 255, 255, 1)');      // Solid white core
      grd.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');  // Soft mid-tone
      grd.addColorStop(1, 'rgba(255, 255, 255, 0)');      // Transparent outer blur

      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, r * 2, r * 2);

      // Convert the blurred canvas directly into a PIXI texture
      this._texture = PIXI.Texture.from(canvas);

      // Re-apply to all existing sprites
      this.applyTextureToAllSprites();
    }

    getParticleTexture(filename) {
      if (!filename || filename.toLowerCase() === "default") {
        this.ensureTexture();
        return this._texture;
      }
      if (!this._customTextures) this._customTextures = new Map();
      
      if (!this._customTextures.has(filename)) {
        let folder = 'img/system/';
        let file = filename;

        if (filename.includes('/')) {
            const parts = filename.split('/');
            file = parts.pop();
            folder = 'img/particles/' + parts.join('/') + '/';
        }
        
        // Use the raw bitmap loader with the dynamic folder
        const bmp = ImageManager.loadBitmap(folder, file);
        const baseTex = new PIXI.BaseTexture(bmp.canvas || bmp.image || document.createElement('canvas'));
        const tex = new PIXI.Texture(baseTex);
        
        bmp.addLoadListener(() => {
          tex.baseTexture.resource.source = bmp.canvas || bmp.image;
          tex.baseTexture.update();
        });
        this._customTextures.set(filename, tex);
      }
      return this._customTextures.get(filename);
    }

    getLayerContainer(zIndex, texName, wantWorld, blendMode) {
      // Convert logical zIndex directly into the 10-Tier Render system
      let renderTier = 1; 

      if (zIndex < 1.0) {
        renderTier = 0;      // Void
      } else if (zIndex >= 100.0) {
        renderTier = 100;    // Sky
      } else {
        // Snap directly to the exact tower level (1 through 10)
        renderTier = Math.max(1, Math.min(Math.floor(zIndex), 10));
      }

      if (!this._dynamicContainers) this._dynamicContainers = new Map();
      
      // Cache based on the Render Tier
      const spaceKey = wantWorld ? "_world" : "_screen";
      const key = `tier${renderTier}_${texName}${spaceKey}_b${blendMode}`;
      
      let c = this._dynamicContainers.get(key);
      if (!c) {
        const props = { scale: true, position: true, rotation: true, uvs: true, alpha: true };
        c = new PIXI.ParticleContainer(P_MAX, props, P_MAX);
        c.z = renderTier; 
        c.blendMode = blendMode;

        // Request the strict Render Tier container from RK_Shader
        let shaderContainer = null;
        if (typeof RK_Shader !== "undefined" && typeof RK_Shader.getContainer === "function") {
          shaderContainer = RK_Shader.getContainer(renderTier);
        }

        if (shaderContainer) {
          shaderContainer.addChild(c);
        } else {
          console.warn(`RK_ParticleMZ: RK_Shader lacks a container for Render Tier ${renderTier}.`);
          
          const ss = this._lastSpriteset;
          if (ss && ss._tilemap) {
            ss._tilemap.addChild(c);
            if (ss._tilemap.sortChildren) ss._tilemap.sortChildren();
            ss._tilemap._needsSort = true;
          } else if (ss) {
            ss.addChild(c);
          }
        }
        this._dynamicContainers.set(key, c);
      }
      return c;
    }

    applyTextureToAllSprites() {
      if (!this._texture) return;
      const apply = (p) => {
        const s = p && p.sprite;
        if (!s || s.destroyed) return;
        try { s.texture = this._texture; } catch (e) {}
      };
      for (const p of this._pool) apply(p);
      for (const p of this._active) apply(p);
    }

    // ---- Performance helpers ----
    needsUpdate() {
      // Called each frame from Spriteset_Map.update; keep it extremely cheap.
      return this._ready && (this._active.length > 0 || this._emitters.size > 0);
    }

    _setContainersRenderable(on) {
      const v = !!on;
      if (this._containersRenderable === v) return;
      this._containersRenderable = v;

      if (this._dynamicContainers) {
        for (const c of this._dynamicContainers.values()) {
          if (c) { c.renderable = v; c.visible = v; }
        }
      }
    }

    _recalcWorldUsage() {
      // World-space requires camera-offset container updates each frame; skip if unused.
      let has = false;
      for (const em of this._emitters.values()) {
        const cfg = em && em.cfg;
        if (cfg && String(cfg.spaceMode || "Screen").toLowerCase() === "world") { has = true; break; }
      }
      if (!has) {
        for (const p of this._active) {
          if (p && p.space === "world") { has = true; break; }
        }
      }
      this._hasWorld = has;
      this._worldDirty = false;
    }

    _ensureFree(count = 1) {
      if (this._pool.length >= count) return;
      const total = this._pool.length + this._active.length;
      if (total >= P_MAX) return;

      // Allocate in chunks to avoid stutter on the first spawn.
      const need = count - this._pool.length;
      const chunk = Math.max(need, this._allocChunk);
      const canCreate = P_MAX - total;
      const n = Math.min(chunk, canCreate);

      for (let i = 0; i < n; i++) {
        const spr = new PIXI.Sprite(this._texture);
        spr.anchor.set(0.5, 0.5);
        spr.visible = false;
        spr.alpha = 0;
        spr.scale.set(1, 1);
        spr.rotation = 0;
        spr.tint = 0xFFFFFF;
        // NOTE: do NOT add pooled sprites to any container.
        // They only get a parent when actually spawned, so idle state stays lightweight.
        this._pool.push(new RKParticle(spr));
      }
    }

    setupForSpriteset(spriteset) {
      if (!spriteset || this._lastSpriteset === spriteset) return;
      this.ensureTexture();

      // Clear dynamic containers for scene transitions
      if (this._dynamicContainers) {
        for (const c of this._dynamicContainers.values()) {
          try { c.destroy && c.destroy({ children: false }); } catch (e) {}
        }
      }
      this._dynamicContainers = new Map();

      this._pool = [];
      this._active = [];
      this._shapeEmitterState.clear();
      this._shapeGlobalCache.clear();
      this._hasWorld = false;
      this._worldDirty = false;
      this._setContainersRenderable(false);
      this.ensureTexture(true);

      this.reloadFromSave();
      if ($gameSystem && $gameSystem._rkParticleSnapshot) {
        this.restoreSnapshot($gameSystem._rkParticleSnapshot);
        $gameSystem._rkParticleSnapshot = null;
      }
      this._lastSpriteset = spriteset;
      this._ready = true;
    }

    reloadFromSave() {
      this._emitters.clear();
      const saved = $gameSystem && $gameSystem.rkGetEmitters ? $gameSystem.rkGetEmitters() : [];
      for (const cfg of saved) {
        if (!cfg || !cfg.emitterId) continue;
        this._emitters.set(cfg.emitterId, new RKEmitter(cfg));
      }
    
      this._worldDirty = true;
    }

    update(dt) {
      if (!this._ready) return;
      // Near-zero overhead when idle (no emitters and no active particles)
      if (this._emitters.size === 0 && this._active.length === 0) return;

      if (this._worldDirty) this._recalcWorldUsage();
// Particle update Auto-LOD based on current active count (texture size is NOT modified)
const _activeCount = this._active.length;
const _qlodTier = rkQlodTier(_activeCount);
this._qlodTier = _qlodTier;
this._qlodFrame = (this._qlodFrame + 1) | 0;

const _qlodDisableRot = (_qlodTier >= P_QLOD_DISABLE_ROT_TIER);
const _qlodSimplify = (_qlodTier >= P_QLOD_SIMPLIFY_TIER);
const _qlodStride = (_qlodTier >= P_QLOD_STRIDE_TIER) ? P_QLOD_STRIDE : 1;

      // World-space containers: offset by camera so particles stay in map/world coordinates.
      if (this._hasWorld && typeof $gameMap !== "undefined" && $gameMap) {
        const tw = $gameMap.tileWidth ? $gameMap.tileWidth() : 48;
        const th = $gameMap.tileHeight ? $gameMap.tileHeight() : 48;
        const dx = ($gameMap.displayX ? $gameMap.displayX() : ($gameMap._displayX || 0)) * tw;
        const dy = ($gameMap.displayY ? $gameMap.displayY() : ($gameMap._displayY || 0)) * th;
        
        if (this._dynamicContainers) {
          for (const [key, c] of this._dynamicContainers.entries()) {
            if (key.includes("_world")) {
              c.x = -dx; 
              c.y = -dy;
            }
          }
        }
      }

      // Emitters: fair-share hard-cap handling (prevents newer emitters starving when at/near cap)
if (P_HARDCAP_FAIR && this._emitters.size > 0) {
  const requests = [];
  let totalWanted = 0;

  // First pass: advance emitter timers/accumulators and collect spawn requests (but do not spawn yet)
  for (const [id, emitter] of this._emitters.entries()) {
    const r = emitter._prepare(dt, this);
    if (emitter.isExpired()) {

    this._emitters.delete(id);
    $gameSystem && $gameSystem.rkRemoveEmitter && $gameSystem.rkRemoveEmitter(id);
    this._shapeEmitterState.delete(id);
      continue;
    }
    if (r && r.n > 0) {
      requests.push({ id, emitter, cfg: r.cfg, pos: r.pos, nWanted: r.n });
      totalWanted += r.n;
    }
  }

  // How many new particles can we add without exceeding the cap?
  const budget = Math.max(0, P_MAX - this._active.length);

  if (totalWanted > 0 && budget > 0) {
    const allowed = Math.min(totalWanted, budget);

    // Proportional allocation with remainder distribution by largest fractional part
    let used = 0;
    for (const req of requests) {
      const raw = (req.nWanted * allowed) / totalWanted;
      const q = Math.floor(raw);
      req.quota = q;
      req.frac = raw - q;
      used += q;
    }
    let rem = allowed - used;
    if (rem > 0) {
      requests.sort((a, b) => (b.frac - a.frac));
      for (let i = 0; i < requests.length && rem > 0; i++) {
        requests[i].quota += 1;
        rem--;
      }
    }

    // Second pass: spawn up to each emitter's quota
    for (const req of requests) {
      const q = Math.min(req.quota || 0, req.nWanted);
      if (q <= 0) continue;
      req.emitter._emit(this, req.cfg, req.pos, q);
    }
  }
} else {
  // Legacy behavior: emitters spawn immediately; at cap newer emitters may starve
  for (const [id, emitter] of this._emitters.entries()) {
    emitter.update(dt, this);
    if (emitter.isExpired()) {

    this._emitters.delete(id);
    $gameSystem && $gameSystem.rkRemoveEmitter && $gameSystem.rkRemoveEmitter(id);
    this._shapeEmitterState.delete(id);
    }
  }
}


      for (let i = this._active.length - 1; i >= 0; i--) {
        const p = this._active[i];

        // If enabled, keep particle attached to target by applying target movement delta.
        // Works for both Screen-space and World-space since cfg.spaceMode is respected.
        if (p.followTarget && p.followEmitterId) {
          const em = this._emitters.get(p.followEmitterId);
          const cfg = em && em.cfg;
          if (cfg) {
            const tpos = this.getTargetPos(cfg);
            if (tpos) {
              const dx = tpos.x - p.followLastX;
              const dy = tpos.y - p.followLastY;
              if (dx || dy) {
                p.x += dx; p.y += dy;
                // Keep source in sync too (for negative-speed "inward" particles)
                p.srcX += dx; p.srcY += dy;
              }
              p.followLastX = tpos.x;
              p.followLastY = tpos.y;
            }
          }
        }

        p.life -= dt;
        if (p.life <= 0) {
          this.recycleParticleAt(i);
          continue;
        }
        const t = 1 - (p.life / p.maxLife);
        const spr = p.sprite;

p.vy += p.ay * dt;

// Integrate in sim-space (with optional inward-stop)
const nx = p.x + p.vx * dt;
const ny = p.y + p.vy * dt;
if (p.stopAtSource) {
  const dx0 = p.x - p.srcX;
  const dy0 = p.y - p.srcY;
  const dx1 = nx - p.srcX;
  const dy1 = ny - p.srcY;
  const d0 = dx0 * dx0 + dy0 * dy0;
  const d1 = dx1 * dx1 + dy1 * dy1;
  const eps2 = 2.25; // ~1.5px
  // Stop when we reach (or overshoot) the source.
  if (d1 <= eps2 || d1 > d0) {
    p.x = p.srcX;
    p.y = p.srcY;
    p.vx = 0;
    p.vy = 0;
    p.ay = 0;
  } else {
    p.x = nx;
    p.y = ny;
  }
      } else {
  p.x = nx;
  p.y = ny;
}
        if (!_qlodDisableRot) p.rot += p.rotSpd * dt;

        // Apply to sprite (if still valid)
        if (_qlodStride > 1 && (((i + this._qlodFrame) % _qlodStride) !== 0)) {
          continue;
        }
        spr.x = p.x;
        spr.y = p.y;
        if (!_qlodDisableRot) {
          spr.rotation = p.rot;
        } else if (spr.rotation !== 0) {
          spr.rotation = 0;
        }
        if (_qlodSimplify) {
          spr.scale.x = p.s0;
          spr.scale.y = p.s0;
          spr.alpha = p.a0;
        } else {
          p.currentScale += p.scaleStep * dt;
          p.currentAlpha += p.alphaStep * dt;
          
          spr.scale.x = p.currentScale;
          spr.scale.y = p.currentScale;
          spr.alpha = p.currentAlpha;
        }
      }
    }

    recycleParticleAt(activeIndex) {
      const p = this._active[activeIndex];
      const spr = p && p.sprite;

      // Stop display tree thrashing: keep in container, just hide it.
      if (spr) {
        spr.visible = false;
        spr.renderable = false;
      }

      p.reset();

      if (spr && spr.transform) {
        spr.visible = false;
        spr.alpha = 0;
      }

      this._active.splice(activeIndex, 1);
      this._pool.push(p);

      if (p.space === "world") this._worldDirty = true;
      if (this._active.length === 0) this._setContainersRenderable(false);
    }

    getTargetCharacter(cfg) {
      const type = String(cfg.targetType || "Player");
      if (type === "Event") {
        const eid = Number(cfg.targetEventId || 0);
        return ($gameMap && $gameMap.event) ? $gameMap.event(eid) : null;
      }
      return $gamePlayer;
    }

    getTargetPos(cfg) {
      const space = String(cfg.spaceMode || "Screen").toLowerCase();
      if (space === "world") return this.getTargetWorldPos(cfg);
      return this.getTargetScreenPos(cfg);
    }

    getTargetScreenPos(cfg) {
      const ch = this.getTargetCharacter(cfg);
      if (!ch) return null;
      const x = ch.screenX ? ch.screenX() : null;
      const y = ch.screenY ? ch.screenY() : null;
      if (x == null || y == null) return null;
            const xOffset = Number(cfg.xOffset || 0);
      const yOffset = Number(cfg.yOffset || 0);
      return { x: x + xOffset, y: y + yOffset };
    }

    // World-space (map pixel coordinates). Rendered through a camera-offset container.
    getTargetWorldPos(cfg) {
      const ch = this.getTargetCharacter(cfg);
      if (!ch || typeof $gameMap === "undefined" || !$gameMap) return null;

      const tw = $gameMap.tileWidth ? $gameMap.tileWidth() : 48;
      const th = $gameMap.tileHeight ? $gameMap.tileHeight() : 48;

      const rx = (ch._realX != null) ? ch._realX : ch.x;
      const ry = (ch._realY != null) ? ch._realY : ch.y;

      let x = rx * tw + tw * 0.5;
      let y = ry * th + th;

      // Match Game_CharacterBase.screenY() behavior as closely as possible.
      if (ch.shiftY) y -= (ch.shiftY() || 0);
      if (ch.jumpHeight) y -= (ch.jumpHeight() || 0);

            const xOffset = Number(cfg.xOffset || 0);
      const yOffset = Number(cfg.yOffset || 0);
      return { x: x + xOffset, y: y + yOffset };
    }

    // -------- SHAPE EMIT --------
    findCharacterSprite(gameCharacter) {
      const ss = this._lastSpriteset;
      if (!ss || !ss._characterSprites) return null;
      for (const spr of ss._characterSprites) {
        if (spr && spr._character === gameCharacter) return spr;
      }
      return null;
    }

        _nowSec() {
      const p = (typeof performance !== "undefined" && performance && performance.now) ? performance.now() : Date.now();
      return p / 1000;
    }

    _spawnRatePps(cfg) {
      // For Auto-LOD heuristics: estimate particles/sec
      return Math.max(0, Number(cfg.rate || 0));
    }

    _effectiveShapeStep(cfg, mode) {
      let step = clamp(Number(cfg.shapeSampleStep || 3), 1, 8);
      if (!P_SHAPE_AUTOLOD) return step;
      const rate = this._spawnRatePps(cfg);
      if (rate >= P_SHAPE_LOD_VERYHIGH) {
        step = Math.max(step, mode === "Fill" ? 7 : 6);
      } else if (rate >= P_SHAPE_LOD_HIGH) {
        step = Math.max(step, mode === "Fill" ? 5 : 4);
      }
      return clamp(step, 1, 8);
    }

    _shapeKeyFrom(tex, fr, w, h, mode, step, thr) {
      const bt = tex && tex.baseTexture;
      const baseId = bt ? (bt.uid || bt._id || bt._url || "") : "";
      const fx = Math.floor(fr.x), fy = Math.floor(fr.y);
      return `${baseId}|${fx},${fy},${w},${h}|${mode}|${step}|${thr}`;
    }

    _shapeCacheTouch(key, now) {
      if (!P_SHAPE_GLOBAL_CACHE) return;
      const e = this._shapeGlobalCache.get(key);
      if (e) e.lastUsed = now;
    }

    _shapeCacheSet(key, data, now) {
      if (!P_SHAPE_GLOBAL_CACHE) return;
      this._shapeGlobalCache.set(key, { data, lastUsed: now });
      this._shapeCacheEnforceCap();
    }

    _shapeCacheEnforceCap() {
      if (!P_SHAPE_GLOBAL_CACHE) return;
      const cap = Math.max(8, (P_SHAPE_CACHE_MAX | 0));
      while (this._shapeGlobalCache.size > cap) {
        let oldestKey = null;
        let oldestT = Infinity;
        for (const [k, v] of this._shapeGlobalCache.entries()) {
          const t = (v && v.lastUsed) || 0;
          if (t < oldestT) { oldestT = t; oldestKey = k; }
        }
        if (oldestKey == null) break;
        this._shapeGlobalCache.delete(oldestKey);
      }
    }

    buildShapePointsFromSprite(spriteChar, cfg, step, thr, mode, key) {
      const renderer = Graphics.app && Graphics.app.renderer;
      if (!renderer || !spriteChar) return null;

      const tex = spriteChar.texture;
      const fr = tex && tex.frame;
      if (!tex || !fr || fr.width <= 0 || fr.height <= 0) return null;

      const w = Math.floor(fr.width);
      const h = Math.floor(fr.height);
      if (w <= 0 || h <= 0) return null;

      // Create a render texture in a version-safe way
      let rt = null;
      try {
        rt = PIXI.RenderTexture.create({ width: w, height: h, scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 1 });
      } catch (e) {
        try { rt = PIXI.RenderTexture.create(w, h, PIXI.SCALE_MODES.LINEAR, 1); } catch (e2) { rt = null; }
      }
      if (!rt) return null;

      const s = new PIXI.Sprite(tex);
      s.anchor.set(0, 0);
      s.position.set(0, 0);

      // Render safely (MZ builds differ: old signature vs options object)
      try {
        try { renderer.render(s, { renderTexture: rt, clear: true }); }
        catch (e1) { renderer.render(s, rt, true); }
      } catch (e) {
        rt.destroy(true);
        s.destroy({ children: true, texture: false, baseTexture: false });
        return null;
      }

      // Extract pixels safely
      let pixels = null;
      try {
        const extractor = renderer.extract || (renderer.plugins && renderer.plugins.extract);
        if (extractor && extractor.pixels) pixels = extractor.pixels(rt);
      } catch (e) {
        pixels = null;
      }

      rt.destroy(true);
      s.destroy({ children: true, texture: false, baseTexture: false });

      if (!pixels || pixels.length <= 0) return null;

      const alphaAt = (px, py) => {
        if (px < 0 || py < 0 || px >= w || py >= h) return 0;
        const idx = (py * w + px) * 4 + 3;
        return pixels[idx] || 0;
      };

      const points = [];
      for (let py = 0; py < h; py += step) {
        for (let px = 0; px < w; px += step) {
          const a = alphaAt(px, py);
          if (a <= thr) continue;

          if (mode === "Outline") {
            const n1 = alphaAt(px + step, py);
            const n2 = alphaAt(px - step, py);
            const n3 = alphaAt(px, py + step);
            const n4 = alphaAt(px, py - step);
            if (n1 > thr && n2 > thr && n3 > thr && n4 > thr) continue;
          }

          points.push({ x: px, y: py });
        }
      }

      return { key, points: points.length ? points : null, w, h };
    }

    getShapeOffset(cfg) {
      const mode = String(cfg.shapeMode || "None");
      if (mode === "None") return null;

      const ch = this.getTargetCharacter(cfg);
      const spr = this.findCharacterSprite(ch);
      if (!spr) return null;

      const tex = spr.texture;
      const fr = tex && tex.frame;
      if (!tex || !fr || fr.width <= 0 || fr.height <= 0) return null;

      const thr = clamp(Number(cfg.shapeAlphaThreshold || 20), 0, 255);
      const step = this._effectiveShapeStep(cfg, mode);

      const w = Math.floor(fr.width);
      const h = Math.floor(fr.height);
      if (w <= 0 || h <= 0) return null;

      const key = this._shapeKeyFrom(tex, fr, w, h, mode, step, thr);
      const now = this._nowSec();

      const emitterId = String(cfg.emitterId || "");
      const state = this._shapeEmitterState.get(emitterId) || { lastBuildAt: -9999, lastKey: "", lastData: null };

      // 1) Prefer global cache
      if (P_SHAPE_GLOBAL_CACHE) {
        const e = this._shapeGlobalCache.get(key);
        if (e && e.data) {
          this._shapeCacheTouch(key, now);
          if (e.data.points && e.data.points.length) {
            state.lastKey = key;
            state.lastData = e.data;
            this._shapeEmitterState.set(emitterId, state);
            return this._pickShapeOffset(e.data, cfg);
          }
          // Negative cache: no points
        }
      }

      // 2) Rebuild throttling
      if ((now - state.lastBuildAt) < P_SHAPE_REBUILD_INTERVAL) {
        if (state.lastData && state.lastData.points && state.lastData.points.length) {
          this._shapeEmitterState.set(emitterId, state);
          return this._pickShapeOffset(state.lastData, cfg);
        }
        return null;
      }

      state.lastBuildAt = now;

      // 3) Build now
      const built = this.buildShapePointsFromSprite(spr, cfg, step, thr, mode, key);
      if (built) {
        this._shapeCacheSet(key, built, now);
        if (built.points && built.points.length) {
          state.lastKey = key;
          state.lastData = built;
          this._shapeEmitterState.set(emitterId, state);
          return this._pickShapeOffset(built, cfg);
        }
      }

      // 4) Fallback to previous shape if any
      if (state.lastData && state.lastData.points && state.lastData.points.length) {
        this._shapeEmitterState.set(emitterId, state);
        return this._pickShapeOffset(state.lastData, cfg);
      }

      this._shapeEmitterState.set(emitterId, state);
      return null;
    }

    _pickShapeOffset(shapeData, cfg) {
      if (!shapeData || !shapeData.points || !shapeData.points.length) return null;
      const p = shapeData.points[(Math.random() * shapeData.points.length) | 0];
      const scale = Math.max(0.1, Number(cfg.shapeScale || 1.0));

      // Convert pixel coordinate into offset relative to character anchor (0.5, 1.0)
      // x: center -> [-w/2, +w/2], y: bottom -> [-h, 0]
      const ox = (p.x - shapeData.w * 0.5) * scale;
      const oy = (p.y - shapeData.h) * scale;
      return { x: ox, y: oy };
    }
    // -------- END SHAPE EMIT --------

    chooseTint(cfg) {
      const mode = String(cfg.colorMode || "Fixed");
      if (mode === "Palette") {
        const pal = parsePalette(cfg.palette, P_DEF_PALETTE);
        return pal.length ? pal[(Math.random() * pal.length) | 0] : parseHexColor(P_DEF_COLOR, "#FFFFFF");
      }
      if (mode === "RandomHue") {
        const base = parseHexColor(cfg.randomHueBase, P_DEF_COLOR);
        const range = clamp(Number(cfg.randomHueRange || 0), 0, 180);
        return tintRandomHue(base, range);
      }
      return parseHexColor(cfg.fixedColor, P_DEF_COLOR);
    }

    resolveBlendMode(cfg) {
      const s = String(cfg.blendMode || "DEFAULT").toUpperCase();
      if (s === "DEFAULT") return blendModeFromString(P_DEF_BLEND);
      return blendModeFromString(s);
    }

    resolveZLayer(cfg) {
      const z = String(cfg.zLayer || "DEFAULT");
      if (z === "DEFAULT") return P_DEF_Z;
      return z;
    }


    getOrCreateCustomContainer(zValue, wantWorld) {
      const z = Number(zValue);
      if (!Number.isFinite(z)) return wantWorld ? (this._containerAboveWorld || this._containerAbove) : (this._containerAbove);
      const map = wantWorld ? this._customContainersWorld : this._customContainers;
      const key = String(z);
      const existing = map && map.get ? map.get(key) : null;
      if (existing) return existing;

      const props = { scale: true, position: true, rotation: true, uvs: false, alpha: true };
      const c = new PIXI.ParticleContainer(P_MAX, props, P_MAX);
      c.z = z;
      c.blendMode = blendModeFromString(P_DEF_BLEND);

      const ss = this._lastSpriteset;
      const tilemap = ss && ss._tilemap;
      if (tilemap) {
        tilemap.addChild(c);
        if (tilemap.sortChildren) tilemap.sortChildren();
        tilemap._needsSort = true;
      } else if (ss) {
        ss.addChild(c);
      }

      map && map.set && map.set(key, c);
      return c;
    }

    spawnParticle(cfg, ox, oy, emitIndex) {
      this._ensureFree(1);
      if (this._pool.length <= 0) return;

      // Ensure containers are renderable once we have at least one active sprite.
      this._setContainersRenderable(true);

      const p = this._pool.pop();
      const spr = p.sprite;
      const space = String(cfg.spaceMode || "Screen").toLowerCase();
      const wantWorld = (space === "world");
      if (wantWorld && !this._hasWorld) this._hasWorld = true;

      const zLayer = this.resolveZLayer(cfg);
      
      // Default to Custom Z to ensure RK_Shader compatibility
      let zIndex = cfg.customZ !== undefined ? Number(cfg.customZ) : P_DEF_CUSTOMZ; 

      if (zLayer === "Target") {
          // Inherits Z from the spatial spawn target (Player/Event)
          const ch = this.getTargetCharacter(cfg);
          
          if (ch && typeof ch.screenZ === 'function') {
              zIndex = ch.screenZ();
          } else {
              zIndex = cfg.customZ !== undefined ? Number(cfg.customZ) : P_DEF_CUSTOMZ;
          }
          
      } else if (zLayer === "Dynamic" && cfg.dynamicZRef) {
          // Evaluates a custom JavaScript reference (e.g., RK.Battle.Core)
          try {
              const refValue = eval(cfg.dynamicZRef);
              zIndex = (refValue !== undefined && refValue !== null) ? Number(refValue) : (cfg.customZ !== undefined ? Number(cfg.customZ) : P_DEF_CUSTOMZ);
          } catch (e) {
              console.warn("RK_ParticleMZ Dynamic Z Error:", e);
              zIndex = cfg.customZ !== undefined ? Number(cfg.customZ) : P_DEF_CUSTOMZ;
          }
          
      } else if (zLayer === "Custom") {
          zIndex = cfg.customZ !== undefined ? Number(cfg.customZ) : P_DEF_CUSTOMZ;
      } else if (zLayer === "BelowCharacters") {
          zIndex = 2;
      } else if (zLayer === "SameCharacter") {
          zIndex = 3;
      } else if (zLayer === "AboveCharacters") {
          zIndex = 9;
      }

      // Load custom texture and apply it
      const texName = cfg.texture || "default";
      spr.texture = this.getParticleTexture(texName);
      
      const blendMode = this.resolveBlendMode(cfg);
      const targetContainer = this.getLayerContainer(zIndex, texName, wantWorld, blendMode, oy);

      p.layer = zLayer;
      p.space = wantWorld ? "world" : "screen";
      p.texName = texName;
      p.zIndex = zIndex;
      
      if (spr.parent !== targetContainer) {
        spr.parent && spr.parent.removeChild(spr);
        targetContainer.addChild(spr);
      }

      // If Shape Mode enabled, use sprite silhouette offset
      const shapeOff = this.getShapeOffset(cfg);
      if (shapeOff) {
        p.x = ox + shapeOff.x;
        p.y = oy + shapeOff.y;
      } else {
        p.x = ox;
        p.y = oy;
      }

      // Spawn distribution (Glitter/PhotonArray: jitter; Field: shell/edge)
      const effectMode = String(cfg.effectMode || "Glitter");
      const spread = Math.max(0, Number(cfg.spread || 0));
      if (effectMode === "Field") {
        const thick = Math.max(0, Number((cfg.fieldThickness != null) ? cfg.fieldThickness : P_DEF_FIELD_THICK));
        if (spread > 0) {
          const inner = Math.max(0, spread - thick);
          const a = Math.random() * Math.PI * 2;
          let r;
          if (inner >= spread) {
            r = spread; // thickness 0 => exact edge
          } else {
            // area-correct distribution over annulus [inner..spread]
            const u = Math.random();
            r = Math.sqrt(u * (spread * spread - inner * inner) + inner * inner);
          }
          p.x += Math.cos(a) * r;
          p.y += Math.sin(a) * r;
        }
      } else {
        if (spread > 0) {
          p.x += (Math.random() * 2 - 1) * spread;
          p.y += (Math.random() * 2 - 1) * spread;
        }
      }

      // Source position (used for inward movement / stopping)
      p.srcX = ox;
      p.srcY = oy;
      p.stopAtSource = false;

      // Follow Target option (keeps particles attached to target movement)
      p.followTarget = (String(cfg.followTarget || "false") === "true");
      p.followEmitterId = p.followTarget ? String(cfg.emitterId || "") : "";
      p.followLastX = ox;
      p.followLastY = oy;

      spr.x = p.x;
      spr.y = p.y;
      p.rot = 0;
      spr.rotation = 0;

      let speedMin = Number(cfg.speedMin || 0);
      let speedMax = (cfg.speedMax != null) ? Number(cfg.speedMax) : speedMin;
      if (speedMin > speedMax) { const t = speedMin; speedMin = speedMax; speedMax = t; }
      const speed = lerp(speedMin, speedMax, Math.random());

      const angleMin = Number(cfg.angleMin || 0) * Math.PI / 180;
      const angleMax = Number(cfg.angleMax || 360) * Math.PI / 180;
      let ang = 0;
      if (effectMode === "PhotonArray") {
        const seg = clamp(Number(cfg.arraySegments || 24), 3, 360);
        ang = (emitIndex % seg) / seg * Math.PI * 2;
      } else {
        ang = lerp(angleMin, angleMax, Math.random());
      }

      if (speed < 0) {
        const sp = Math.abs(speed);
        const dx = p.srcX - p.x;
        const dy = p.srcY - p.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.0001) {
          p.vx = (dx / len) * sp;
          p.vy = (dy / len) * sp;
        } else {
          p.vx = 0;
          p.vy = 0;
        }
        p.stopAtSource = !!cfg.stopAtSourceIfNegative;
            } else {
        p.vx = Math.cos(ang) * speed;
        p.vy = Math.sin(ang) * speed;
        p.stopAtSource = false;
      }

      p.ay = Number(cfg.gravity || 0);

      p.maxLife = Math.max(0.05, Number(cfg.lifetime || 0.8));
      p.life = p.maxLife;

      const s0 = clamp(Number(cfg.scaleMin || 0.5), 0.05, 10);
      const s1 = clamp(Number(cfg.scaleMax || 1.0), 0.05, 10);
      p.s0 = lerp(s0, s1, Math.random());
      p.s1 = p.s0 * lerp(0.6, 1.1, Math.random());
      p.currentScale = p.s0;
      p.scaleStep = (p.s1 - p.s0) / p.maxLife;

      p.a0 = clamp(Number(cfg.alphaStart || 1.0), 0, 1);
      p.a1 = clamp(Number(cfg.alphaEnd || 0.0), 0, 1);
      p.currentAlpha = p.a0;
      p.alphaStep = (p.a1 - p.a0) / p.maxLife;

      p.rotSpd = (Math.random() * 2 - 1) * 2.0;

      spr.tint = this.chooseTint(cfg);
      spr.blendMode = this.resolveBlendMode(cfg);
      p.tint = spr.tint >>> 0;
      p.blendMode = spr.blendMode;spr.visible = true;
      spr.alpha = p.a0;

      this._active.push(p);
    }

    upsertEmitter(cfg) {
      this._emitters.set(cfg.emitterId, new RKEmitter(cfg));
      if (String(cfg.spaceMode || "Screen").toLowerCase() === "world") this._hasWorld = true;
    }
    removeEmitter(emitterId) {
      this._emitters.delete(emitterId);
      this._shapeEmitterState.delete(emitterId);
      this._worldDirty = true;
      if (this._emitters.size === 0 && this._active.length === 0) this._setContainersRenderable(false);
    }

    clearAll() {
      this._emitters.clear();
      this._shapeEmitterState.clear();
      this._shapeGlobalCache.clear();
      for (let i = this._active.length - 1; i >= 0; i--) this.recycleParticleAt(i);
      this._hasWorld = false;
      this._worldDirty = false;
      this._setContainersRenderable(false);
    }

    snapshotActive(maxCount = 1000) {
      const out = [];
      const n = Math.min(this._active.length, maxCount);
      for (let i = 0; i < n; i++) {
        const p = this._active[i];
        // NOTE: don't touch PIXI sprite here (it might be destroyed / detached in some scenes)
        out.push({
          x: p.x, y: p.y,
          vx: p.vx, vy: p.vy, ay: p.ay,
          life: p.life, maxLife: p.maxLife,
          s0: p.s0, s1: p.s1,
          a0: p.a0, a1: p.a1,
          rot: p.rot, rotSpd: p.rotSpd,
        srcX: p.srcX,
        srcY: p.srcY,
        stopAtSource: !!p.stopAtSource,
        followTarget: !!p.followTarget,
        followEmitterId: p.followEmitterId || "",
        followLastX: (p.followLastX != null) ? p.followLastX : 0,
        followLastY: (p.followLastY != null) ? p.followLastY : 0,
          tint: p.tint >>> 0,
          blendMode: p.blendMode,
          layer: p.layer || "above",
          space: p.space || "screen",
          texName: p.texName || "default",
          zIndex: p.zIndex !== undefined ? p.zIndex : 9
        });
      }
      return out;
    }

    restoreSnapshot(list) {
      if (!Array.isArray(list) || list.length <= 0) return;

      // Clear current particles
      for (let i = this._active.length - 1; i >= 0; i--) this.recycleParticleAt(i);

      // Ensure we have enough pooled sprites to restore this snapshot.
      this._ensureFree(Math.min(list.length, P_MAX));

      for (const d of list) {
        if (this._pool.length <= 0) break;

        const p = this._pool.pop();
        const s = p.sprite;
        if (!s || !s.transform) { this._pool.push(p); continue; }

        // Parent container
        const space = String(d.space || "screen").toLowerCase();
        const wantWorld = (space === "world");
        const texName = d.texName || "default";
        const zIndex = d.zIndex !== undefined ? d.zIndex : 9;
        const bMode = (d.blendMode != null) ? d.blendMode : PIXI.BLEND_MODES.NORMAL;

        s.texture = this.getParticleTexture(texName);
        const target = this.getLayerContainer(zIndex, texName, wantWorld, bMode);

        if (!target) { this._pool.push(p); continue; }
        if (s.parent !== target) {
          s.parent && s.parent.removeChild(s);
          target.addChild(s);
        }

        p.layer = d.layer || "AboveCharacters";
        p.space = wantWorld ? "world" : "screen";
        p.texName = texName;
        p.zIndex = zIndex;

        // Restore sim state
        p.vx = d.vx; p.vy = d.vy; p.ay = d.ay;
        p.life = d.life; p.maxLife = d.maxLife;
        p.s0 = d.s0; p.s1 = d.s1;
        p.a0 = d.a0; p.a1 = d.a1;
        p.rotSpd = d.rotSpd;
        p.srcX = (d.srcX != null) ? Number(d.srcX) : p.x;
        p.srcY = (d.srcY != null) ? Number(d.srcY) : p.y;
        p.stopAtSource = !!d.stopAtSource;

        p.followTarget = !!d.followTarget;
        p.followEmitterId = String(d.followEmitterId || "");
        p.followLastX = (d.followLastX != null) ? Number(d.followLastX) : p.x;
        p.followLastY = (d.followLastY != null) ? Number(d.followLastY) : p.y;

        // Restore state
        p.x = d.x; p.y = d.y;
        p.rot = d.rot || 0;
        p.tint = (d.tint >>> 0) || 0xFFFFFF;
        p.blendMode = (d.blendMode != null) ? d.blendMode : PIXI.BLEND_MODES.NORMAL;
        p.layer = d.layer || "above";

        // Restore sprite state (if still valid)
        s.x = p.x; s.y = p.y;
        s.rotation = p.rot;
        s.tint = p.tint >>> 0;
        s.blendMode = p.blendMode;// Set current interpolated visuals
        const t = 1 - (p.life / p.maxLife);
        const sc = lerp(p.s0, p.s1, t);
        s.scale.set(sc, sc);
        s.alpha = lerp(p.a0, p.a1, t);
        s.visible = true;

        this._active.push(p);
      }
      if (this._active.length > 0) this._setContainersRenderable(true);
      this._worldDirty = true;

    }
    }

  const RKPS = new RKParticleSystem();

  const _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
  Spriteset_Map.prototype.createLowerLayer = function() {
    _Spriteset_Map_createLowerLayer.call(this);
    RKPS.setupForSpriteset(this);
  };

  const _Spriteset_Map_update = Spriteset_Map.prototype.update;
  Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update.call(this);
    if (RKPS && RKPS.needsUpdate && RKPS.needsUpdate()) {
      const app = Graphics.app;
      const dt = app && app.ticker ? (app.ticker.deltaMS / 1000) : (1 / 60);
      RKPS.update(dt);
    }
  };

  const RK_SAVE_MAX = 1200;
  const _DataManager_makeSaveContents = DataManager.makeSaveContents;
  DataManager.makeSaveContents = function() {
    const contents = _DataManager_makeSaveContents.call(this);
    contents.RK_ParticleMZ = {
      emitters: $gameSystem.rkGetEmitters ? $gameSystem.rkGetEmitters() : [],
      particles: (RKPS && RKPS.snapshotActive) ? RKPS.snapshotActive(RK_SAVE_MAX) : []
    };
    return contents;
  };

  const _DataManager_extractSaveContents = DataManager.extractSaveContents;
  DataManager.extractSaveContents = function(contents) {
    _DataManager_extractSaveContents.call(this, contents);
    const rk = contents.RK_ParticleMZ;
    if (rk && $gameSystem) {
      if (Array.isArray(rk.emitters)) $gameSystem._rkParticleEmitters = rk.emitters;
      $gameSystem._rkParticleSnapshot = Array.isArray(rk.particles) ? rk.particles : null;
    }
  };

  const RK_MENU_MAX = 1200;
  const _SceneManager_push = SceneManager.push;
  SceneManager.push = function(sceneClass) {
    // If we're on map and entering a menu-type scene, snapshot particles
    if (SceneManager._scene instanceof Scene_Map) {
      const isMenu = (sceneClass && sceneClass.prototype instanceof Scene_MenuBase);
      if (isMenu && RKPS && RKPS.snapshotActive) {
        $gameSystem._rkParticleMenuSnapshot = RKPS.snapshotActive(RK_MENU_MAX);
      }
    }
    _SceneManager_push.call(this, sceneClass);
  };

  const _SceneManager_pop = SceneManager.pop;
  SceneManager.pop = function() {
    _SceneManager_pop.call(this);
    // When returning to map, restore once
    if (SceneManager._scene instanceof Scene_Map) {
      SceneManager._rkRestoreParticlesNextFrame = true;
    }
  };

  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);
    if (SceneManager._rkRestoreParticlesNextFrame) {
      SceneManager._rkRestoreParticlesNextFrame = false;
      // Ensure our generated particle texture is valid after scene transitions.
      if (RKPS && RKPS.ensureTexture) RKPS.ensureTexture(true);
      if ($gameSystem && $gameSystem._rkParticleMenuSnapshot) {
        RKPS.restoreSnapshot($gameSystem._rkParticleMenuSnapshot);
        $gameSystem._rkParticleMenuSnapshot = null;
      }
    }
  };

// Plugin Managers
  function makeEmitterConfig(args, interpreterEventId) {
    const has = (k) => Object.prototype.hasOwnProperty.call(args, k);

    // Allow Event ID 0 to mean "this event" (interpreter._eventId)
    const targetType = String(args.targetType || "Player");
    const rawEventId = has('targetEventId') ? Number(args.targetEventId) : 1;
    let resolvedEventId = rawEventId;
    if (targetType === "Event" && rawEventId === 0) {
      const ieid = Number(interpreterEventId || 0);
      if (ieid > 0) resolvedEventId = ieid;
    }

    return {
      emitterId: String(args.emitterId || "glitter1"),
      texture: String(args.texture || "default"),
      targetType,
      targetEventId: resolvedEventId,
      spaceMode: String(args.spaceMode || "Screen"),
      followTarget: has('followTarget') ? (String(args.followTarget) === 'true') : false,
      rate: Number(args.rate || 60),
      lifetime: Number(args.lifetime || 0.8),
      duration: Number(args.duration || 0),

      xOffset: Number(args.xOffset || 0),

      yOffset: Number(args.yOffset || -18),

      spread: Number(args.spread || 8),

      fieldThickness: (args.fieldThickness === undefined || args.fieldThickness === null || args.fieldThickness === "") ? P_DEF_FIELD_THICK : Number(args.fieldThickness),
      speedMin: Number(args.speedMin || 10),
      speedMax: Number(args.speedMax || 60),
      stopAtSourceIfNegative: has('stopAtSourceIfNegative') ? (String(args.stopAtSourceIfNegative) === 'true') : undefined,
      angleMin: Number(args.angleMin || 0),
      angleMax: Number(args.angleMax || 360),
      gravity: Number(args.gravity || 0),

      scaleMin: Number(args.scaleMin || 0.5),
      scaleMax: Number(args.scaleMax || 1.0),
      alphaStart: Number(args.alphaStart || 1.0),
      alphaEnd: Number(args.alphaEnd || 0.0),

      effectMode: String(args.effectMode || "Glitter"),
      arraySegments: Number(args.arraySegments || 24),

      blendMode: String(args.blendMode || "DEFAULT"),
      zLayer: String(args.zLayer || "DEFAULT"),
      customZ: Number((args.customZ != null && args.customZ !== "") ? args.customZ : P_DEF_CUSTOMZ),
      dynamicZRef: String(args.dynamicZRef || ""),

      colorMode: String(args.colorMode || "Fixed"),
      fixedColor: String(args.fixedColor || P_DEF_COLOR),
      palette: String(args.palette || P_DEF_PALETTE),
      randomHueBase: String(args.randomHueBase || P_DEF_COLOR),
      randomHueRange: Number(args.randomHueRange || 40),

      // NEW
      shapeMode: String(args.shapeMode || "None"),
      shapeSampleStep: Number(args.shapeSampleStep || 3),
      shapeAlphaThreshold: Number(args.shapeAlphaThreshold || 20),
      shapeScale: Number(args.shapeScale || 1.0),
    };
  }

  PluginManager.registerCommand(pluginName, "startEmitter", function(args) {
    const cfg = makeEmitterConfig(args, this && this._eventId);
    $gameSystem.rkUpsertEmitter(cfg);
    RKPS.upsertEmitter(cfg);
  });

  PluginManager.registerCommand(pluginName, "stopEmitter", (args) => {
    const id = String(args.emitterId || "");
    if (!id) return;
    $gameSystem.rkRemoveEmitter(id);
    RKPS.removeEmitter(id);
  });

  PluginManager.registerCommand(pluginName, "clearAll", () => {
    $gameSystem.rkClearAll();
    RKPS.clearAll();
  });

  PluginManager.registerCommand(pluginName, "setEmitterColor", (args) => {
    const id = String(args.emitterId || "");
    if (!id) return;

    const saved = $gameSystem.rkGetEmitters();
    const cfg = saved.find(e => e && e.emitterId === id);
    if (!cfg) return;

    cfg.colorMode = String(args.colorMode || "Fixed");
    cfg.fixedColor = String(args.fixedColor || cfg.fixedColor || P_DEF_COLOR);
    cfg.palette = String(args.palette || cfg.palette || P_DEF_PALETTE);
    cfg.randomHueBase = String(args.randomHueBase || cfg.randomHueBase || P_DEF_COLOR);
    cfg.randomHueRange = Number(args.randomHueRange || cfg.randomHueRange || 40);

    $gameSystem.rkUpsertEmitter(cfg);
    RKPS.upsertEmitter(cfg);
  });

})();