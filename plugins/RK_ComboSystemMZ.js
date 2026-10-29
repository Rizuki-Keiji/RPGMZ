/*:
 * @target MZ
 * @plugindesc v0.2.0 Combo Preset + Branching Tree builder (per actor) for Hendrix_Action_Engine + RingCommandMenu
 * @author RK
 *
 * @help
 * RK_ComboSystemMZ.js
 * ---------------------------------------------------------------------------
 * This plugin adds a Combo Menu and a runtime combo executor.
 *
 * 1) Combo Menu
 *    - Build combo presets per actor.
 *    - Presets are branching trees (left -> right): multiple roots allowed.
 *    - Each node has:
 *        - Attack (maps to a Hendrix template event name)
 *        - Trigger chord (single key or combo like jump+attack)
 *        - Children (next possible steps)
 *
 * 2) Runtime execution (optional)
 *    - While on the map, the plugin watches your configured input chords.
 *    - When a chord is detected (by RELEASE), it will spawn the mapped attack event.
 *    - If a combo is in progress, only the current node's children are checked.
 *    - If nothing happens for ComboTimeoutFrames, the combo resets.
 *
 * IMPORTANT about Hendrix_Keyboard_Gamepad
 * - That plugin remaps Input.keyMapper / Input.gamepadMapper to custom "From Key" action names.
 *   It then uses Input.isPressed/isTriggered on those action names (not physical keys).
 *   See its remapKeys() and isPressed()/isTriggered() hooks.  
 * - RK_ComboSystemMZ builds on that: your chord keys should be those action names.
 *
 * GIF preview note
 * - RPG Maker MZ does not reliably play GIFs in UI by default.
 * - This plugin shows a Picture (img/pictures) as a preview; APNG may animate depending on your setup.
 *
 * RingCommandMenu integration
 * - RingCommandMenu supports command type "selectActor" and then eval() of the script.  
 * - Add a command that runs:  SceneManager.push(Scene_RK_ComboMenu);
 *   and set it to CommandType: selectActor.
 *
 * Load order recommendation
 * - DotMoveSystem
 * - Hendrix_Action_Engine
 * - Hendrix_Keyboard_Gamepad
 * - RingCommandMenu
 * - RK_ComboSystemMZ  (this)
 * ---------------------------------------------------------------------------
 *
 * @param EnableRuntime
 * @type boolean
 * @default true
 * @desc If true, combos can be executed in-map by listening for chord releases.
 *
 * @param ComboTimeoutFrames
 * @type number
 * @min 1
 * @default 45
 * @desc Frames before combo resets if no next input.
 *
 * @param SpawnDistance
 * @type number
 * @min 0
 * @default 1
 * @desc How far in front of player to spawn the attack event.
 *
 * @param UseDotMoveSpawn
 * @type boolean
 * @default true
 * @desc If DotMoveSystem is present, spawn using centerPositionPoint.
 *
 * @param BaseNodeLimit
 * @type number
 * @min 1
 * @default 12
 * @desc Base max total nodes per preset (per actor). "Limit breaker" adds bonus.
 *
 * @param HardNodeLimit
 * @type number
 * @min 1
 * @default 60
 * @desc Absolute cap for nodes per preset (even with limit breaker bonus).
 *
 * @param MaxChildrenPerNode
 * @type number
 * @min 0
 * @default 4
 * @desc Max children per node.
 *
 * @param DefaultPresetName
 * @type string
 * @default Preset
 *
 * @param Attacks
 * @type struct<RKComboAttack>[]
 * @default []
 * @desc List of attacks selectable in the combo menu.
 *
 * @param InputChords
 * @type struct<RKComboChord>[]
 * @default []
 * @desc Input chords (single key or combo) used by nodes.
 *
 * @command OpenComboMenu
 * @text Open Combo Menu
 * @desc Opens the Combo Menu (uses current $gameParty.menuActor or leader).
 *
 * @command AddNodeLimitBonus
 * @text Add Combo Limit Bonus
 * @arg actorId
 * @type number
 * @default 0
 * @desc ActorId (0 = menuActor/leader)
 * @arg amount
 * @type number
 * @default 1
 * @desc Add bonus nodes (limit breaker).
 *
 * @command SetActivePreset
 * @text Set Active Preset
 * @arg actorId
 * @type number
 * @default 0
 * @desc ActorId (0 = menuActor/leader)
 * @arg presetId
 * @type number
 * @default 1
 * @desc Preset id to activate.
 */

/*~struct~RKComboAttack:
 * @param Key
 * @type string
 * @desc Internal key shown in the tree (e.g. Atk_1).
 *
 * @param DisplayName
 * @type string
 * @desc Name shown in lists.
 *
 * @param IconIndex
 * @type number
 * @default 0
 *
 * @param TemplateEvent
 * @type string
 * @desc Hendrix template event name (from $dataTemplateMap) to spawn for this attack.
 *
 * @param PreviewPicture
 * @type file
 * @dir img/pictures
 * @desc Optional preview picture file.
 *
 * @param AirState
 * @text Usable When
 * @type select
 * @option Both
 * @value both
 * @option Ground only
 * @value ground
 * @option Air only
 * @value air
 * @default both
 * @desc Restrict this attack to ground/air. (Uses Hendrix jump state)
 */

/*~struct~RKComboChord:
 * @param Id
 * @type number
 * @default 1
 *
 * @param Name
 * @type string
 * @desc Shown in UI.
 *
 * @param IconIndex
 * @type number
 * @default 0
 *
 * @param Keys
 * @type string
 * @desc Comma-separated action names (Hendrix "From Key"), e.g. jump,attack
 *
 * @param ReleaseKey
 * @type string
 * @desc Which key's release triggers (default = last key in Keys).
 */

(() => {
  'use strict';

  const PLUGIN_NAME = 'RK_ComboSystemMZ';
  const P = PluginManager.parameters(PLUGIN_NAME);

  const toBool = (v) => String(v) === 'true';
  const toNum = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const PARAMS = {
    enableRuntime: toBool(P.EnableRuntime ?? 'true'),
    timeoutFrames: Math.max(1, toNum(P.ComboTimeoutFrames, 45)),
    spawnDistance: Math.max(0, toNum(P.SpawnDistance, 1)),
    useDotMoveSpawn: toBool(P.UseDotMoveSpawn ?? 'true'),
    baseNodeLimit: Math.max(1, toNum(P.BaseNodeLimit, 12)),
    hardNodeLimit: Math.max(1, toNum(P.HardNodeLimit, 60)),
    maxChildren: Math.max(0, toNum(P.MaxChildrenPerNode, 4)),
    defaultPresetName: String(P.DefaultPresetName ?? 'Preset'),
  };

  function parseStructArray(paramVal) {
    try {
      const arr = JSON.parse(paramVal || '[]');
      return arr.map(s => {
        try { return JSON.parse(s); } catch { return null; }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  const ATTACKS = parseStructArray(P.Attacks).map(a => ({
    key: String(a.Key || '').trim(),
    name: String(a.DisplayName || a.Key || '').trim(),
    icon: toNum(a.IconIndex, 0),
    templateEvent: String(a.TemplateEvent || '').trim(),
    previewPicture: String(a.PreviewPicture || '').trim(),
    airState: String(a.AirState || a.AirType || 'both').trim().toLowerCase() || 'both',
  })).filter(a => a.key && a.templateEvent);

  const CHORDS = parseStructArray(P.InputChords).map(c => {
    const keys = String(c.Keys || '').split(',').map(s => s.trim()).filter(Boolean);
    const releaseKey = String(c.ReleaseKey || '').trim() || (keys[keys.length - 1] || '');
    return {
      id: toNum(c.Id, 0),
      name: String(c.Name || `Chord ${c.Id}`),
      icon: toNum(c.IconIndex, 0),
      keys,
      releaseKey,
    };
  }).filter(c => c.id > 0 && c.keys.length > 0);

  const chordById = new Map(CHORDS.map(c => [c.id, c]));
  const attackByKey = new Map(ATTACKS.map(a => [a.key, a]));

  // ---------------------------------------------------------------------------
  // Input release tracker (for combos like jump+attack by release)
  
  function rkPictureUrl(pictureName) {
    if (!pictureName) return '';
    const raw0 = String(pictureName).trim();
    if (!raw0) return '';

    // Normalize common inputs like:
    //  - "MyPic" / "MyPic.png" / "MyAnim.webm"
    //  - "img/pictures/MyPic.png" / "/img/pictures/MyPic.png"
    //  - "movies/MyAnim.webm" / "/movies/MyAnim.webm"
    let raw = raw0.replace(/^[.\\/]+/, '');

    const hasExt = /\.[a-z0-9]+$/i.test(raw);
    const ext = hasExt ? (raw.match(/\.([a-z0-9]+)$/i) || [,''])[1].toLowerCase() : '';

    const isVideo = (ext === 'webm' || ext === 'mp4' || ext === 'ogv');

    if (isVideo) {
      // Strip optional leading folders so "movies/Skill/rikka.webm" or "Skill/rikka.webm" both work.
      raw = raw.replace(/^movies[\\/]+/i, '');
      const file = raw; // video should include extension
      const path = 'movies/' + file;
      return (typeof Utils !== 'undefined' && Utils.encodeURI) ? Utils.encodeURI(path) : encodeURI(path);
    } else {
      // Pictures
      raw = raw.replace(/^img[\\/]+pictures[\\/]+/i, '');
      raw = raw.replace(/^pictures[\\/]+/i, '');
      const file = hasExt ? raw : (raw + '.png');
      const path = 'img/pictures/' + file;
      return (typeof Utils !== 'undefined' && Utils.encodeURI) ? Utils.encodeURI(path) : encodeURI(path);
    }
  }

  function rkVideoUrlCandidates(pictureName) {
    if (!pictureName) return [];
    const raw0 = String(pictureName).trim();
    if (!raw0) return [];

    // Accept:
    //  - "Skill/rikka.webm"
    //  - "movies/Skill/rikka.webm"
    //  - "img/pictures/Skill/rikka.webm"
    //  - "/movies/Skill/rikka.webm" etc.
    let raw = raw0.replace(/^[.\/]+/, '').replace(/^\//, '');
    const m = raw.match(/\.([a-z0-9]+)$/i);
    const ext = (m ? m[1] : '').toLowerCase();
    const isVideo = (ext === 'webm' || ext === 'mp4' || ext === 'ogv');
    if (!isVideo) return [rkPictureUrl(raw0)];

    const enc = (p) => (typeof Utils !== 'undefined' && Utils.encodeURI) ? Utils.encodeURI(p) : encodeURI(p);

    // Candidate 1: movies/...
    let mv = raw.replace(/^movies[\/]+/i, '');
    // If user wrote img/pictures/... remove that too to reuse the tail
    mv = mv.replace(/^img[\/]+pictures[\/]+/i, '').replace(/^pictures[\/]+/i, '');
    const urlMovies = enc('movies/' + mv);

    // Candidate 2: allow storing videos under img/pictures (some users prefer this)
    let pic = raw.replace(/^img[\/]+pictures[\/]+/i, '').replace(/^pictures[\/]+/i, '');
    pic = pic.replace(/^movies[\/]+/i, '');
    const urlPictures = enc('img/pictures/' + pic);

    // If user already wrote an explicit path, include it as a candidate too
    const explicit = enc(raw);

    // De-dup while preserving order
    const out = [];
    const push = (u) => { if (u && !out.includes(u)) out.push(u); };
    push(urlMovies);
    push(urlPictures);
    push(explicit);
    return out;
  }


// ---------------------------------------------------------------------------
  // Hendrix_Keyboard_Gamepad remaps action names and overrides isPressed/isTriggered.
  // We detect RELEASE by keeping our own previous-state map.
  const RK_Input = {
    _prev: Object.create(null),
    _released: Object.create(null),
    _watched: new Set(),

    watch(actionName) {
      if (actionName) this._watched.add(actionName);
    },

    isReleased(actionName) {
      return !!this._released[actionName];
    },

    update() {
      // clear flags
      for (const k in this._released) this._released[k] = false;

      // update watched keys
      for (const actionName of this._watched) {
        const now = Input.isPressed(actionName);
        const prev = !!this._prev[actionName];
        if (prev && !now) this._released[actionName] = true;
        this._prev[actionName] = now;
      }
    }
  };

  // watch all chord keys + release keys
  for (const chord of CHORDS) {
    chord.keys.forEach(k => RK_Input.watch(k));
    RK_Input.watch(chord.releaseKey);
  }

  // Wrap Input.update so our release states are updated every frame.
  const _Input_update = Input.update;
  Input.update = function() {
    _Input_update.call(this);
    RK_Input.update();
  };

  // Detect chord: triggers when releaseKey is released while other keys still held.
  function isChordTriggeredByRelease(chord) {
    if (!chord) return false;
    if (!RK_Input.isReleased(chord.releaseKey)) return false;
    // Other keys must still be pressed (except releaseKey itself)
    for (const k of chord.keys) {
      if (k === chord.releaseKey) continue;
      if (!Input.isPressed(k)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Data model (stored in Game_System)
  // ---------------------------------------------------------------------------
  function rkEnsureSystem() {
    if (!$gameSystem._rkComboData) $gameSystem._rkComboData = {};
  }

  function rkActorIdFromArgs(actorIdArg) {
    const arg = Number(actorIdArg || 0);
    if (arg > 0) return arg;
    const a = $gameParty.menuActor() || $gameParty.leader();
    return a ? a.actorId() : 0;
  }

  function rkActorData(actorId) {
    rkEnsureSystem();
    if (!$gameSystem._rkComboData[actorId]) {
      $gameSystem._rkComboData[actorId] = {
        nodeLimitBonus: 0,
        activePresetId: 0,
        presets: [],
        nextPresetId: 1,
      };
    }
    const data = $gameSystem._rkComboData[actorId];
    if (!data.activePresetId && data.presets.length) data.activePresetId = data.presets[0].id;
    return data;
  }

  function rkMaxNodesForActor(actorId) {
    const data = rkActorData(actorId);
    const max = PARAMS.baseNodeLimit + (data.nodeLimitBonus || 0);
    return Math.min(PARAMS.hardNodeLimit, Math.max(1, max));
  }

  function rkCreatePreset(actorId) {
    const data = rkActorData(actorId);
    const presetId = data.nextPresetId++;
    const preset = {
      id: presetId,
      name: `${PARAMS.defaultPresetName} ${presetId}`,
      roots: [],
      nodes: {},
      nextNodeId: 1,
    };
    // auto create one root if we have attacks/chords
    if (ATTACKS.length && CHORDS.length) {
      const rootId = preset.nextNodeId++;
      preset.roots.push(rootId);
      preset.nodes[rootId] = {
        id: rootId,
        attackKey: ATTACKS[0].key,
        chordId: CHORDS[0].id,
        children: [],
      };
    }
    data.presets.push(preset);
    data.activePresetId = preset.id;
    return preset;
  }

  function rkGetPreset(actorId, presetId) {
    const data = rkActorData(actorId);
    return data.presets.find(p => p.id === presetId) || null;
  }

  function rkGetActivePreset(actorId) {
    const data = rkActorData(actorId);
    const preset = rkGetPreset(actorId, data.activePresetId);
    if (preset) return preset;
    if (!data.presets.length) return rkCreatePreset(actorId);
    data.activePresetId = data.presets[0].id;
    return data.presets[0];
  }

  function rkCountNodes(preset) {
    return Object.keys(preset.nodes).length;
  }

  function rkAddRoot(preset, attackKey, chordId) {
    const nodeId = preset.nextNodeId++;
    preset.roots.push(nodeId);
    preset.nodes[nodeId] = { id: nodeId, attackKey, chordId, children: [] };
    return nodeId;
  }

  function rkAddChild(preset, parentId, attackKey, chordId) {
    const parent = preset.nodes[parentId];
    if (!parent) return 0;
    if (PARAMS.maxChildren >= 0 && parent.children.length >= PARAMS.maxChildren) return 0;
    const nodeId = preset.nextNodeId++;
    preset.nodes[nodeId] = { id: nodeId, attackKey, chordId, children: [] };
    parent.children.push(nodeId);
    return nodeId;
  }

  function rkRemoveNode(preset, nodeId) {
    if (!preset.nodes[nodeId]) return;

    // remove from roots
    preset.roots = preset.roots.filter(id => id !== nodeId);

    // remove from any parent children lists
    for (const idStr of Object.keys(preset.nodes)) {
      const n = preset.nodes[idStr];
      n.children = n.children.filter(cid => cid !== nodeId);
    }

    // remove subtree (children)
    const stack = [nodeId];
    const toDelete = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (toDelete.has(cur)) continue;
      toDelete.add(cur);
      const n = preset.nodes[cur];
      if (n) n.children.forEach(c => stack.push(c));
    }
    toDelete.forEach(id => delete preset.nodes[id]);
  }

  // ---------------------------------------------------------------------------
  // Runtime combo executor
  // ---------------------------------------------------------------------------
  // A small per-actor runtime state stored in Game_System (not in save? we do save it)
  function rkEnsureRuntime() {
    if (!$gameSystem._rkComboRuntime) $gameSystem._rkComboRuntime = {};
  }

  function rkRuntimeState(actorId) {
    rkEnsureRuntime();
    if (!$gameSystem._rkComboRuntime[actorId]) {
      $gameSystem._rkComboRuntime[actorId] = {
        presetId: 0,
        currentNodeId: 0,
        timer: 0,
      };
    }
    return $gameSystem._rkComboRuntime[actorId];
  }

  function rkResetRuntime(actorId) {
    const rt = rkRuntimeState(actorId);
    rt.presetId = 0;
    rt.currentNodeId = 0;
    rt.timer = 0;
  }


  // ---------------------------------------------------------------------------
  // Air/Ground restriction helpers (Hendrix_Action_Engine Jump System)
  // - Hendrix sets $gamePlayer._jumping and also exposes window.playerJumping(). 
  function rkPlayerIsAirborne() {
    try {
      if (typeof window !== 'undefined' && typeof window.playerJumping === 'function') {
        return !!window.playerJumping();
      }
    } catch (_) {}
    try { return !!$gamePlayer._jumping; } catch (_) {}
    return false;
  }

  function rkIsAttackAllowedNow(attack) {
    const mode = String(attack?.airState || 'both').toLowerCase();
    if (mode === 'both' || mode === '') return true;
    const air = rkPlayerIsAirborne();
    if (mode === 'air') return air;
    if (mode === 'ground') return !air;
    return true;
  }

  function rkIsAttackKeyAllowedNow(attackKey) {
    const atk = attackByKey.get(attackKey);
    if (!atk) return false;
    return rkIsAttackAllowedNow(atk);
  }

  function rkSpawnAttack(attackKey) {
    const attack = attackByKey.get(attackKey);
    if (!attack) return false;

    const rkAssetId = String(attack.templateEvent || '').trim();
    if (!rkAssetId) return false;

    const playerSource = RK.Battle.Skill && RK.Battle.Skill.player ? RK.Battle.Skill.player : null;
    if (!playerSource) return false;

    RK.Battle.Events.emit('SPAWN_REQUESTED', { 
        objectId: rkAssetId, 
        source: $gamePlayer, // Correct: Spawns at the physical map character's X/Y
        spawnInFront: attack.spawnDistance || 0 // FIX: Changed 'action' to 'attack'
    });

    const motionSpeedMult = $gameVariables.value(44) || 1;
    
    // Base duration. (You can add a "Duration" parameter to your 
    // RKComboAttack Plugin settings later to make this per-attack!)
    const baseDuration = 0.5; 
    
    // The higher the motion speed, the shorter the movement lock
    const finalLockTime = baseDuration / motionSpeedMult;

    playerSource.changeState('ATTACKING');
    playerSource.stateTimer = finalLockTime; 

    return true;
  }
  
  function rkUpdateRuntimeForActor(actorId) {
    const actor = $gameActors.actor(actorId);
    if (!actor) return;
    if (!$gameParty.members().some(a => a.actorId() === actorId)) return;

    const data = rkActorData(actorId);
    if (!data.presets.length) rkCreatePreset(actorId);

    const rt = rkRuntimeState(actorId);

    // tick timer
    if (rt.currentNodeId) {
      rt.timer++;
      if (rt.timer >= PARAMS.timeoutFrames) {
        rkResetRuntime(actorId);
      }
    }

    // Decide which candidates to check
    const candidates = []; // { preset, node }

    if (rt.currentNodeId && rt.presetId) {
      const preset = rkGetPreset(actorId, rt.presetId);
      if (!preset || !preset.nodes || !preset.nodes[rt.currentNodeId]) {
        rkResetRuntime(actorId);
      } else {
        const cur = preset.nodes[rt.currentNodeId];
        for (const childId of cur.children) {
          const n = preset.nodes[childId];
          if (n) candidates.push({ preset, node: n });
        }
      }
    }

    if (!rt.currentNodeId) {
      // Start of combo: all presets are considered active.
      // Priority: preferred (activePresetId) first, then the rest by id order.
      const preferred = rkGetPreset(actorId, data.activePresetId);
      const ordered = [];
      if (preferred) ordered.push(preferred);
      for (const p of data.presets) {
        if (!preferred || p.id !== preferred.id) ordered.push(p);
      }
      ordered.sort((a, b) => {
        // keep preferred first (already placed), but also keep stable id ordering for the rest
        if (preferred && a.id === preferred.id) return -1;
        if (preferred && b.id === preferred.id) return 1;
        return (a.id || 0) - (b.id || 0);
      });

      for (const preset of ordered) {
        for (const nodeId of preset.roots) {
          const n = preset.nodes?.[nodeId];
          if (n) candidates.push({ preset, node: n });
        }
      }
    }

    // check candidate chords
    for (const c of candidates) {
      const n = c.node;
      const chord = chordById.get(n.chordId);
      if (!chord) continue;

      // If the node's attack is restricted by air/ground, skip it (so another preset can still match).
      if (!rkIsAttackKeyAllowedNow(n.attackKey)) continue;

      if (isChordTriggeredByRelease(chord)) {
        const ok = rkSpawnAttack(n.attackKey);
        if (!ok) continue;

        rt.presetId = c.preset.id;
        rt.currentNodeId = n.id;
        rt.timer = 0;
        return;
      }
    }
  }

  function rkUpdateRuntime() {
    if (!PARAMS.enableRuntime) return;
    if (!(SceneManager._scene instanceof Scene_Map)) return;
    if (!$gameParty || !$gameParty.leader()) return;

    // Only run for current leader for now (as requested: leader's actorId combo)
    const leader = $gameParty.leader();
    if (!leader) return;
    rkUpdateRuntimeForActor(leader.actorId());
  }

  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);
    if (this.isActive()) rkUpdateRuntime();
  };

  // ---------------------------------------------------------------------------
  // Plugin commands
  // ---------------------------------------------------------------------------
  PluginManager.registerCommand(PLUGIN_NAME, 'OpenComboMenu', function() {
    SceneManager.push(Scene_RK_ComboMenu);
  });

  PluginManager.registerCommand(PLUGIN_NAME, 'AddNodeLimitBonus', function(args) {
    const actorId = rkActorIdFromArgs(args.actorId);
    if (!actorId) return;
    const amount = Math.max(0, Number(args.amount || 0));
    const data = rkActorData(actorId);
    data.nodeLimitBonus = (data.nodeLimitBonus || 0) + amount;
  });

  PluginManager.registerCommand(PLUGIN_NAME, 'SetActivePreset', function(args) {
    const actorId = rkActorIdFromArgs(args.actorId);
    if (!actorId) return;
    const presetId = Number(args.presetId || 0);
    const data = rkActorData(actorId);
    if (rkGetPreset(actorId, presetId)) {
      data.activePresetId = presetId;
      rkResetRuntime(actorId);
    }
  });

  // ---------------------------------------------------------------------------
  // Combo Menu Scene
  // ---------------------------------------------------------------------------

  class Window_RK_PresetList extends Window_Command {
    initialize(rect, actorId) {
      this._actorId = actorId;
      const data = rkActorData(actorId);
      this._lastPresetId = data.activePresetId || (data.presets[0]?.id || 0);
      this._rkLastTopIndex = -1;
      super.initialize(rect);
      this._rkInitScrollBar();
      this.select(0);
      this.refresh();
    }

    setActorId(actorId) {
      this._actorId = actorId;
      const data = rkActorData(actorId);
      this._lastPresetId = data.activePresetId || (data.presets[0]?.id || 0);
      this.refresh();
      this.select(0);
    }

    makeCommandList() {
      const data = rkActorData(this._actorId);
      if (!data.presets.length) rkCreatePreset(this._actorId);
      for (const p of data.presets) {
        this.addCommand(p.name, `preset_${p.id}`, true, p.id);
      }
      this.addCommand('✎ Rename Preset', 'renamePreset', true);
      this.addCommand('＋ New Preset', 'newPreset');
      this.addCommand('🗑 Delete Preset', 'deletePreset', data.presets.length > 1);
    }

    currentPresetId() {
      const ext = this.currentExt();
      return typeof ext === 'number' ? ext : 0;
    }

    // When cursor is on "+ New Preset" / "Delete Preset", we still want actions to apply
    // to the last selected preset (or the active preset as fallback).
    actionPresetId() {
      const id = this.currentPresetId();
      if (id) return id;
      const data = rkActorData(this._actorId);
      return this._lastPresetId || data.activePresetId || (data.presets[0]?.id || 0);
    }

    select(index) {
      super.select(index);
      const ext = this.currentExt();
      if (typeof ext === 'number') this._lastPresetId = ext;
    }

    drawItem(index) {
      const rect = this.itemLineRect(index);
      const align = 'left';
      this.resetTextColor();
      this.changePaintOpacity(this.isCommandEnabled(index));
      const cmd = this.commandName(index);
      this.drawText(cmd, rect.x, rect.y, rect.width, align);
    }


    refresh() {
      super.refresh();
      this._rkDrawScrollBar(true);
    }

    update() {
      super.update();
      const top = this._rkTopIndex();
      if (this._rkLastTopIndex !== top) {
        this._rkDrawScrollBar(false);
      }
    }

    _rkTopIndex() {
      // Some menu plugins may override Window_Selectable and remove topIndex().
      if (typeof this.topIndex === "function") return this.topIndex();
      if (typeof this._topRow === "number") return this._topRow;
      if (typeof this._scrollY === "number" && this.itemHeight) {
        const ih = this.itemHeight();
        return ih > 0 ? Math.floor(this._scrollY / ih) : 0;
      }
      return 0;
    }

    _rkInitScrollBar() {
      const barW = 6;
      // Sprite overlay so it doesn't get wiped by contents refresh.
      this._rkScrollBarSprite = new Sprite(new Bitmap(barW, this.innerHeight));
      this._rkScrollBarSprite.x = this.padding + this.innerWidth - barW;
      this._rkScrollBarSprite.y = this.padding;
      this.addChild(this._rkScrollBarSprite);
      this._rkScrollBarSprite.visible = false;
    }

    _rkDrawScrollBar(force) {
      if (!this._rkScrollBarSprite) this._rkInitScrollBar();
      if (force) this._rkLastTopIndex = -1;

      const top = this._rkTopIndex();
      if (top === this._rkLastTopIndex && !force) return;
      this._rkLastTopIndex = top;

      const spr = this._rkScrollBarSprite;
      const bmp = spr.bitmap;
      if (!bmp) return;

      // keep height in sync if window resized
      const h = this.innerHeight;
      if (bmp.height !== h) spr.bitmap = new Bitmap(bmp.width, h);

      const total = this.maxItems ? this.maxItems() : 0;
      const page = this.maxPageItems ? this.maxPageItems() : 0;
      if (total <= page || page <= 0) {
        spr.visible = false;
        return;
      }
      spr.visible = true;

      const barW = spr.bitmap.width;
      spr.x = this.padding + this.innerWidth - barW;
      spr.y = this.padding;

      spr.bitmap.clear();

      const maxTop = Math.max(1, total - page);
      const trackH = h;
      const barH = Math.max(16, Math.floor(trackH * (page / total)));
      const barY = Math.floor((top / maxTop) * (trackH - barH));

      // track
      spr.bitmap.fillRect(2, 0, 2, trackH, "rgba(255,255,255,0.18)");
      // thumb
      spr.bitmap.fillRect(0, barY, barW, barH, "rgba(255,255,255,0.55)");
    }


  }

  
  class Window_RK_DeletePresetList extends Window_Command {
    initialize(rect, actorId) {
      this._actorId = actorId;
      super.initialize(rect);
      this.refresh();
      this.select(0);
    }

    setActorId(actorId) {
      this._actorId = actorId;
      this.refresh();
      this.select(0);
    }

    makeCommandList() {
      const data = rkActorData(this._actorId);
      for (const p of data.presets) {
        this.addCommand(p.name, `del_${p.id}`, true, p.id);
      }
    }

    currentPresetId() {
      const ext = this.currentExt();
      return typeof ext === 'number' ? ext : 0;
    }

    selectPresetId(presetId) {
      const idx = this._list.findIndex(c => c && c.ext === presetId);
      this.select(idx >= 0 ? idx : 0);
    }
  }

class Window_RK_Tree extends Window_Selectable {
    initialize(rect) {
      super.initialize(rect);
      this._rkDragging = false;
      this._rkDragNodeId = 0;
      this._rkDragOffsetX = 0;
      this._rkDragOffsetY = 0;
      this._rkDragMoved = false;

      // Camera (panning) for large trees
      this._rkCamX = 0;
      this._rkCamY = 0;
      this._rkPanning = false;
      this._rkPanStartLX = 0;
      this._rkPanStartLY = 0;
      this._rkPanStartCamX = 0;
      this._rkPanStartCamY = 0;

      this._actorId = 0;
      this._presetId = 0;
      this._layout = []; // {nodeId, depth, x, y, w, h}  (world coords)
      this._depthColumns = new Map();
      this._selectedNodeId = 0;
    }

    setData(actorId, presetId) {
      this._actorId = actorId;
      this._presetId = presetId;

      // Restore per-preset camera (panning) so large trees stay navigable.
      this._rkCamX = 0;
      this._rkCamY = 0;
      const preset = (this._actorId && this._presetId) ? rkGetPreset(this._actorId, this._presetId) : null;
      if (preset) {
        this._rkCamX = Number(preset.uiCamX || 0) || 0;
        this._rkCamY = Number(preset.uiCamY || 0) || 0;
      }

      this.refresh();
      // activation is controlled by the scene
    }

    maxItems() {
      return this._layout.length;
    }

    itemAt(index) {
      return this._layout[index] || null;
    }

    // Use our custom layout rectangles for the selection cursor.
    // Window_Selectable's default itemRect is list/grid based and will not match.
    itemRect(index) {
      const item = this._layout[index];
      if (item) {
        // Render position is world position minus camera.
        return new Rectangle(item.x - this._rkCamX, item.y - this._rkCamY, item.w, item.h);
      }
      return new Rectangle(0, 0, 0, 0);
    }

    itemRectWithPadding(index) {
      return this.itemRect(index);
    }

    selectedNodeId() {
      const item = this.itemAt(this.index());
      return item ? item.nodeId : 0;
    }

    ensureSelectionValid() {
      if (this._layout.length === 0) {
        this.select(-1);
        return;
      }
      // keep current if possible
      const idx = this._layout.findIndex(i => i.nodeId === this._selectedNodeId);
      if (idx >= 0) this.select(idx);
      else this.select(0);
    }

    refresh() {
      this.contents.clear();
      this._layout = [];
      this._depthColumns = new Map();
      if (!this._actorId || !this._presetId) {
        super.refresh();
        this.drawText('Select a preset', 0, 0, this.contentsWidth());
        return;
      }
      const preset = rkGetPreset(this._actorId, this._presetId);
      if (!preset) {
        super.refresh();
        return;
      }

      // layout constants
      const colW = 150;
      const boxH = this.lineHeight() + 10;
      const boxW = colW - 12;
      const colGap = 12;
      const rowGap = 10;
      const startX = 8;
      const startY = 8;

      // BFS by roots to assign depth and group by depth
      const visited = new Set();
      const queue = [];
      for (const r of preset.roots) queue.push({ id: r, depth: 0 });

      const byDepth = new Map();
      while (queue.length) {
        const { id, depth } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        if (!byDepth.has(depth)) byDepth.set(depth, []);
        byDepth.get(depth).push(id);
        const n = preset.nodes[id];
        if (n) {
          for (const c of n.children) queue.push({ id: c, depth: depth + 1 });
        }
      }

      // Create layout boxes
      const depths = [...byDepth.keys()].sort((a, b) => a - b);
      for (const depth of depths) {
        const ids = byDepth.get(depth) || [];
        this._depthColumns.set(depth, ids);
        for (let i = 0; i < ids.length; i++) {
          const nodeId = ids[i];
          const node = preset.nodes[nodeId];
          // default grid layout (used if player hasn't moved nodes yet)
          let x = startX + depth * (colW + colGap);
          let y = startY + i * (boxH + rowGap);

          // player-defined position (grid-free)
          if (node && Number.isFinite(node.uiX) && Number.isFinite(node.uiY)) {
            x = node.uiX;
            y = node.uiY;
          } else if (node) {
            // persist defaults once so the layout is stable and draggable immediately
            node.uiX = x;
            node.uiY = y;
          }

          this._layout.push({ nodeId, depth, x, y, w: boxW, h: boxH });
        }
      }

      const camX = this._rkCamX || 0;
      const camY = this._rkCamY || 0;

      // draw connections (orthogonal 3-segment, so lines always reach child boxes)
      const lineColor = ColorManager.normalColor ? ColorManager.normalColor() : '#ffffff';
      const t = 3; // thickness
      this.contents.paintOpacity = 200;

      const findLayout = (nodeId) => this._layout.find(o => o.nodeId === nodeId);

      for (const item of this._layout) {
        const n = preset.nodes[item.nodeId];
        if (!n) continue;

        const fromX = (item.x - camX) + item.w;
        const fromY = Math.floor((item.y - camY) + item.h / 2);

        for (const childId of n.children) {
          const to = findLayout(childId);
          if (!to) continue;

          const toX = (to.x - camX);
          const toY = Math.floor((to.y - camY) + to.h / 2);

          // Midpoint X between parent and child
          const midX = Math.floor((fromX + toX) / 2);

          // segment 1: parent -> midX (at fromY)
          const h1x = Math.min(fromX, midX);
          const h1w = Math.max(t, Math.abs(midX - fromX));
          this.contents.fillRect(h1x, fromY - Math.floor(t / 2), h1w, t, lineColor);

          // segment 2: vertical at midX (fromY -> toY)
          const vy = Math.min(fromY, toY);
          const vh = Math.max(t, Math.abs(toY - fromY));
          this.contents.fillRect(midX - Math.floor(t / 2), vy, t, vh, lineColor);

          // segment 3: midX -> child (at toY)
          const h2x = Math.min(midX, toX);
          const h2w = Math.max(t, Math.abs(toX - midX));
          this.contents.fillRect(h2x, toY - Math.floor(t / 2), h2w, t, lineColor);

          // endpoint dots (optional, helps visibility)
          this.contents.fillRect(fromX - 2, fromY - 2, 4, 4, lineColor);
          this.contents.fillRect(toX - 2, toY - 2, 4, 4, lineColor);
        }
      }
      this.contents.paintOpacity = 255;

      // draw node boxes
      for (let i = 0; i < this._layout.length; i++) {
        this.drawItem(i);
      }

      this.ensureSelectionValid();
    }

    drawItem(index) {
      const item = this._layout[index];
      if (!item) return;
      const preset = rkGetPreset(this._actorId, this._presetId);
      if (!preset) return;
      const node = preset.nodes[item.nodeId];
      if (!node) return;

      const camX = this._rkCamX || 0;
      const camY = this._rkCamY || 0;
      const r = new Rectangle(item.x - camX, item.y - camY, item.w, item.h);
      const isSel = index === this.index();

      // background
      this.contents.paintOpacity = isSel ? 220 : 160;
      this.contents.fillRect(r.x, r.y, r.width, r.height, ColorManager.itemBackColor1());
      this.contents.paintOpacity = 255;

      // border (Bitmap has no drawRect; use fillRect)
      const borderColor = ColorManager.normalColor ? ColorManager.normalColor() : '#ffffff';
      this.contents.fillRect(r.x, r.y, r.width, 2, borderColor);
      this.contents.fillRect(r.x, r.y + r.height - 2, r.width, 2, borderColor);
      this.contents.fillRect(r.x, r.y, 2, r.height, borderColor);
      this.contents.fillRect(r.x + r.width - 2, r.y, 2, r.height, borderColor);

      const attack = attackByKey.get(node.attackKey);
      const chord = chordById.get(node.chordId);

      const pad = 6;
      const textX = r.x + pad;
      const textY = r.y + 4;
      const textW = r.width - pad * 2;

      this.resetTextColor();
      this.drawText(attack ? attack.name : node.attackKey, textX, textY, textW);
      this.changeTextColor(ColorManager.systemColor());
      this.drawText(chord ? `⟲ ${chord.name}` : `⟲ (none)`, textX, textY + this.lineHeight() - 6, textW);
      this.resetTextColor();
    }

    // ---------------------------------------------------------------------
    // Drag & drop (grid-free) with mouse/touch
    // ---------------------------------------------------------------------
    _rkLocalTouchX() { return TouchInput.x - this.x - this.padding; }
    _rkLocalTouchY() { return TouchInput.y - this.y - this.padding; }

    _rkHitTestIndex(lx, ly) {
      const camX = this._rkCamX || 0;
      const camY = this._rkCamY || 0;
      const wx = lx + camX;
      const wy = ly + camY;

      // iterate from end so later-drawn boxes get priority
      for (let i = this._layout.length - 1; i >= 0; i--) {
        const it = this._layout[i];
        if (!it) continue;
        if (wx >= it.x && wx <= it.x + it.w && wy >= it.y && wy <= it.y + it.h) return i;
      }
      return -1;
    }

    _rkStartDrag(nodeId, lx, ly) {
      const it = this._layout.find(o => o.nodeId === nodeId);
      if (!it) return;

      const camX = this._rkCamX || 0;
      const camY = this._rkCamY || 0;
      const wx = lx + camX;
      const wy = ly + camY;

      this._rkDragging = true;
      this._rkDragNodeId = nodeId;
      this._rkDragOffsetX = wx - it.x;
      this._rkDragOffsetY = wy - it.y;
      this._rkDragMoved = false;
      this._rkDragStartLX = lx;
      this._rkDragStartLY = ly;
    }

    _rkApplyDraggedPosition(lx, ly) {
      const preset = rkGetPreset(this._actorId, this._presetId);
      if (!preset) return;
      const node = preset.nodes[this._rkDragNodeId];
      const it = this._layout.find(o => o.nodeId === this._rkDragNodeId);
      if (!node || !it) return;

      const camX = this._rkCamX || 0;
      const camY = this._rkCamY || 0;
      const wx = lx + camX;
      const wy = ly + camY;

      const newX = Math.round(wx - this._rkDragOffsetX);
      const newY = Math.round(wy - this._rkDragOffsetY);

      // World-space clamp (keep values reasonable, but allow going outside the visible window)
      const LIM = 8000;
      node.uiX = Math.max(-LIM, Math.min(LIM, newX));
      node.uiY = Math.max(-LIM, Math.min(LIM, newY));

      // Redraw (simple, safe)
      this.refresh();
    }

    _rkStopDrag() {
      this._rkDragging = false;
      this._rkDragNodeId = 0;
    }

    update() {
      super.update();

      // Drag with mouse/touch when active.
      if (this.active) {
        if (TouchInput.isTriggered()) {
          const lx = this._rkLocalTouchX();
          const ly = this._rkLocalTouchY();
          const hitIndex = this._rkHitTestIndex(lx, ly);

          if (hitIndex >= 0) {
            // Drag node
            this._rkPanning = false;
            this.select(hitIndex);
            const nodeId = this.selectedNodeId();
            if (nodeId) this._rkStartDrag(nodeId, lx, ly);
          } else {
            // Pan camera (drag empty space)
            this._rkDragging = false;
            this._rkDragNodeId = 0;
            this._rkPanning = true;
            this._rkPanStartLX = lx;
            this._rkPanStartLY = ly;
            this._rkPanStartCamX = this._rkCamX || 0;
            this._rkPanStartCamY = this._rkCamY || 0;
          }
        }

        if (this._rkDragging) {
          if (TouchInput.isPressed()) {
            const lx = this._rkLocalTouchX();
            const ly = this._rkLocalTouchY();
            if (!this._rkDragMoved) {
              const dx = Math.abs(lx - (this._rkDragStartLX || lx));
              const dy = Math.abs(ly - (this._rkDragStartLY || ly));
              if (dx + dy >= 3) this._rkDragMoved = true;
            }
            if (this._rkDragMoved) this._rkApplyDraggedPosition(lx, ly);
          } else {
            this._rkStopDrag();
          }
        }
      }

      
        // Pan camera by dragging empty space (useful for large/long trees)
        if (this._rkPanning && !this._rkDragging) {
          if (TouchInput.isPressed()) {
            const lx = this._rkLocalTouchX();
            const ly = this._rkLocalTouchY();
            const dx = lx - (this._rkPanStartLX || 0);
            const dy = ly - (this._rkPanStartLY || 0);

            const LIMCAM = 8000;
            const newCamX = Math.max(-LIMCAM, Math.min(LIMCAM, (this._rkPanStartCamX || 0) - dx));
            const newCamY = Math.max(-LIMCAM, Math.min(LIMCAM, (this._rkPanStartCamY || 0) - dy));

            if (newCamX !== this._rkCamX || newCamY !== this._rkCamY) {
              this._rkCamX = newCamX;
              this._rkCamY = newCamY;

              // Persist on the preset so camera position survives reopen
              const preset = rkGetPreset(this._actorId, this._presetId);
              if (preset) {
                preset.uiCamX = this._rkCamX;
                preset.uiCamY = this._rkCamY;
              }

              this.refresh();
            }
          } else {
            // Stop panning
            this._rkPanning = false;
          }
        }
// Selection change handler (keyboard/gamepad OR tap)
      if (this.active) {
        const sel = this.selectedNodeId();
        if (this._selectedNodeId !== sel) {
          this._selectedNodeId = sel;
          this.callHandler('nodeChange');
        }
      }
    }

    // keyboard navigation tuned for a grid
    cursorRight(wrap) {
      const cur = this.itemAt(this.index());
      if (!cur) return;
      const targetDepth = cur.depth + 1;
      const col = this._depthColumns.get(targetDepth);
      if (!col || !col.length) return;
      const idxInCol = Math.min(col.length - 1, this._depthColumns.get(cur.depth).indexOf(cur.nodeId));
      const targetNodeId = col[idxInCol] ?? col[0];
      const targetIndex = this._layout.findIndex(i => i.nodeId === targetNodeId);
      if (targetIndex >= 0) this.select(targetIndex);
    }

    cursorLeft(wrap) {
      const cur = this.itemAt(this.index());
      if (!cur) return;
      const targetDepth = Math.max(0, cur.depth - 1);
      const col = this._depthColumns.get(targetDepth);
      if (!col || !col.length) return;
      const idxInCol = Math.min(col.length - 1, this._depthColumns.get(cur.depth).indexOf(cur.nodeId));
      const targetNodeId = col[idxInCol] ?? col[0];
      const targetIndex = this._layout.findIndex(i => i.nodeId === targetNodeId);
      if (targetIndex >= 0) this.select(targetIndex);
    }
  }

  class Window_RK_Detail extends Window_Base {
    initialize(rect) {
      super.initialize(rect);
      this._actorId = 0;
      this._presetId = 0;
      this._nodeId = 0;
      this._previewSprite = null;
    }

    setData(actorId, presetId, nodeId) {
      this._actorId = actorId;
      this._presetId = presetId;
      this._nodeId = nodeId;
      this.refresh();
    }

    refresh() {
      this.contents.clear();
      this._destroyPreview();

      if (!this._actorId || !this._presetId) {
        this.drawText('Select a preset', 0, 0, this.contentsWidth());
        return;
      }
      if (!this._nodeId) {
        this.drawText('Select a node', 0, 0, this.contentsWidth());
        return;
      }
      const preset = rkGetPreset(this._actorId, this._presetId);
      if (!preset) return;
      const node = preset.nodes[this._nodeId];
      if (!node) return;

      const actor = $gameActors.actor(this._actorId);
      const attack = attackByKey.get(node.attackKey);
      const chord = chordById.get(node.chordId);

      let y = 0;
      this.changeTextColor(ColorManager.systemColor());
      this.drawText(actor ? actor.name() : `Actor ${this._actorId}`, 0, y, this.contentsWidth());
      y += this.lineHeight();

      this.resetTextColor();
      this.drawText(`Node #${node.id}`, 0, y, this.contentsWidth());
      y += this.lineHeight();

      this.changeTextColor(ColorManager.systemColor());
      this.drawText('Attack', 0, y, this.contentsWidth());
      y += this.lineHeight();
      this.resetTextColor();
      this.drawText(attack ? `${attack.name} (${attack.key})` : node.attackKey, 0, y, this.contentsWidth());
      y += this.lineHeight();

      this.changeTextColor(ColorManager.systemColor());
      this.drawText('Trigger', 0, y, this.contentsWidth());
      y += this.lineHeight();
      this.resetTextColor();
      this.drawText(chord ? `${chord.name} [${chord.keys.join('+')} release:${chord.releaseKey}]` : '(none)', 0, y, this.contentsWidth());
      y += this.lineHeight();

      this.changeTextColor(ColorManager.systemColor());
      this.drawText('Children', 0, y, this.contentsWidth());
      y += this.lineHeight();
      this.resetTextColor();
      if (!node.children.length) {
        this.drawText('(none)', 0, y, this.contentsWidth());
        y += this.lineHeight();
      } else {
        for (let i = 0; i < node.children.length; i++) {
          const prefix = (i === node.children.length - 1) ? '└─ ' : '├─ ';
          this.drawText(prefix + String(node.children[i]), 0, y, this.contentsWidth());
          y += this.lineHeight();
        }
      }
      y += this.lineHeight();

      
      // Preview is shown in the separate Preview window.

    }

    _destroyPreview() {
      if (this._previewSprite && this._previewSprite.parent) {
        this._previewSprite.parent.removeChild(this._previewSprite);
      }
      this._previewSprite = null;
    }

    destroy(options) {
      this._destroyPreview();
      super.destroy(options);
    }
  }

  
  class Window_RK_Preview extends Window_Base {
    static _gifHost() {
      if (typeof document === 'undefined') return null;
      let host = document.getElementById('rk_combo_gif_host');
      if (host) return host;
      host = document.createElement('div');
      host.id = 'rk_combo_gif_host';
      host.style.position = 'fixed';
      host.style.left = '0';
      host.style.top = '0';
      host.style.width = '2px';
      host.style.height = '2px';
      host.style.overflow = 'hidden';
      host.style.opacity = '0.01';
      host.style.pointerEvents = 'none';
      host.style.zIndex = '2147483647';
      // Some engines create body late; guard.
      (document.body || document.documentElement).appendChild(host);
      return host;
    }

    initialize(rect) {
      super.initialize(rect);
      this._sprite = null;

      // Media playback support
      this._isGif = false;
      this._isVideo = false;

      // GIF (canvas-driven)
      this._gifImg = null;
      this._gifCanvas = null;
      this._gifCtx = null;
      this._gifTexture = null;

      // Video (HTMLVideoElement-driven)
      this._videoEl = null;
      this._videoTexture = null;

      // For auto-fit
      this._baseTexture = null;
      this._pictureName = '';
      this._fitDirty = false;
      this._lastValid = false;
    }

    setPicture(pictureName) {
      const name = String(pictureName || '').trim();
      if (this._pictureName === name) return;
      this._pictureName = name;
      this._destroySprite();
      this.refresh();
    }

    refresh() {
      this.contents.clear();

      if (!this._pictureName) {
        this.changeTextColor(ColorManager.systemColor());
        this.drawText('Preview', 0, 0, this.contentsWidth());
        this.resetTextColor();
        this.drawText('(none)', 0, this.lineHeight(), this.contentsWidth());
        return;
      }

      this.changeTextColor(ColorManager.systemColor());
      this.drawText('Preview', 0, 0, this.contentsWidth());
      this.resetTextColor();

      const lower = this._pictureName.toLowerCase();
      const m = lower.match(/\.([a-z0-9]+)$/i);
      const ext = m ? m[1] : '';
      this._isGif = (ext === 'gif');
      this._isVideo = (ext === 'webm' || ext === 'mp4' || ext === 'ogv');

      const url = rkPictureUrl(this._pictureName);

      if (this._isVideo) {
        const urls = rkVideoUrlCandidates(this._pictureName);
        this._createVideoSprite(urls);
      } else if (this._isGif) {
        this._createGifSprite(url);
      } else {
        const texture = PIXI.Texture.from(url);
        const spr = new PIXI.Sprite(texture);
        this._sprite = spr;
        this._baseTexture = texture.baseTexture || null;
        this.addChild(spr);
        this._fitDirty = true;
        this._lastValid = false;
        this._applyFitIfReady();
      }
    }

    _createGifSprite(url) {
      // We use an <img> element (which animates GIFs in the browser),
      // draw it into an offscreen canvas each frame, and let Pixi use
      // that canvas as a texture. This is the most reliable way to get
      // animated GIF playback in RPG Maker MZ without external decoders.
      const img = new Image();
      img.decoding = 'sync';
      img.style.display = 'block';
      img.style.width = '2px';
      img.style.height = '2px';
      img.style.opacity = '0.01';

      // On NW.js/Electron, some Chromium builds may pause GIF animation if the
      // <img> is never part of the DOM. We keep a hidden host element and
      // attach the image there to ensure frames advance.
      const host = Window_RK_Preview._gifHost();
      if (host) host.appendChild(img);

      // Track load failures so we can show a message instead of a silent blank.
      let loadFailed = false;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      this._gifImg = img;
      this._gifCanvas = canvas;
      this._gifCtx = ctx;

      // Create texture from canvas immediately; we’ll size the canvas on load.
      const texture = PIXI.Texture.from(canvas);
      const spr = new PIXI.Sprite(texture);

      this._gifTexture = texture;
      this._sprite = spr;
      this._baseTexture = texture.baseTexture || null;

      this.addChild(spr);

      img.onload = () => {
        // Some browsers report 0x0 briefly; guard and retry once via setTimeout.
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          // Draw first frame immediately
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          if (this._baseTexture) this._baseTexture.update();
          this._fitDirty = true;
          this._lastValid = false;
          this._applyFitIfReady();
        } else {
          setTimeout(() => {
            const w2 = img.naturalWidth || img.width || 0;
            const h2 = img.naturalHeight || img.height || 0;
            if (w2 > 0 && h2 > 0) {
              canvas.width = w2;
              canvas.height = h2;
              ctx.clearRect(0, 0, w2, h2);
              ctx.drawImage(img, 0, 0, w2, h2);
              if (this._baseTexture) this._baseTexture.update();
              this._fitDirty = true;
              this._lastValid = false;
              this._applyFitIfReady();
            }
          }, 0);
        }
      };

      img.onerror = () => {
        // Fallback: try a non-encoded relative path. Some NW.js/Electron builds can
        // be picky depending on packaging and how the URL is resolved.
        if (loadFailed) return;
        loadFailed = true;
        // Try again with a simplified path (no encoding helpers), but still
        // normalize common inputs like "img/pictures/...".
        const raw0 = String(this._pictureName || '').trim();
        let raw = raw0.replace(/^[.\\/]+/, '');
        raw = raw.replace(/^img[\\/]+pictures[\\/]+/i, '');
        raw = raw.replace(/^pictures[\\/]+/i, '');
        const hasExt = /\.[a-z0-9]+$/i.test(raw);
        const file = hasExt ? raw : (raw + '.gif');
        const path = 'img/pictures/' + file;
        img.src = (typeof Utils !== 'undefined' && Utils.encodeURI) ? Utils.encodeURI(path) : encodeURI(path);
      };

      // Set src AFTER handlers are in place.
      img.src = url;

      // In case the image is cached and already complete
      if (img.complete) {
        img.onload();
      }

      this._fitDirty = true;
      this._lastValid = false;
    }

    
    _createVideoSprite(urls) {
      // Video previews are more reliable than GIFs in NW.js/Electron.
      // We render an HTMLVideoElement into a Pixi texture and auto-fit it to this window.
      const host = Window_RK_Preview._gifHost(); // reuse hidden host element
      const video = document.createElement('video');
      video.muted = true;
      video.volume = 0;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.style.display = 'block';
      video.style.width = '2px';
      video.style.height = '2px';
      video.style.opacity = '0.01';
      video.style.pointerEvents = 'none';

      // Accept multiple candidate URLs (movies/..., img/pictures/..., explicit path).
      const list = Array.isArray(urls) ? urls.filter(Boolean) : [urls];
      this._videoUrls = list;
      this._videoUrlIndex = 0;
      video.src = list[0] || '';
      try { video.load(); } catch (_) {}

      // Keep it in DOM so Chromium keeps decoding frames.
      if (host) {
        try { host.appendChild(video); } catch (_) {}
      }

      // Create Pixi texture from the video element
      const texture = PIXI.Texture.from(video);
      const spr = new PIXI.Sprite(texture);
      this._sprite = spr;
      this._videoEl = video;
      this._videoTexture = texture;
      this._baseTexture = texture.baseTexture || null;
      this.addChild(spr);

      // When metadata is ready, force a baseTexture update so width/height become valid for auto-fit.
      video.addEventListener('loadedmetadata', () => {
        if (this._baseTexture) {
          try { this._baseTexture.update(); } catch (_) {}
        }
        this._fitDirty = true;
        this._lastValid = false;
        this._applyFitIfReady();
      });

      // If the first URL is not found or the codec isn't supported, try the next candidate.
      video.addEventListener('error', () => {
        const err = video.error;
        try {
          console.warn('[RK_ComboSystemMZ] Preview video error', err ? err.code : 'unknown', 'src=', video.currentSrc || video.src);
        } catch (_) {}
        const list2 = this._videoUrls || [];
        if (list2.length > 1 && (this._videoUrlIndex || 0) < list2.length - 1) {
          this._videoUrlIndex = (this._videoUrlIndex || 0) + 1;
          video.src = list2[this._videoUrlIndex];
          try { video.load(); } catch (_) {}
          // Attempt play again (muted, should be allowed)
          try {
            const p = video.play();
            if (p && p.catch) p.catch(() => {});
          } catch (_) {}
        }
      });

      // Try to start playback immediately (works because muted).
      const tryPlay = () => {
        try {
          const p = video.play();
          if (p && p.catch) p.catch(() => {});
        } catch (_) {}
      };
      video.addEventListener('canplay', tryPlay, { once: true });
      tryPlay();

      this._fitDirty = true;
      this._lastValid = false;
      this._applyFitIfReady();
    }

_applyFitIfReady() {
      if (!this._sprite || !this._baseTexture) return;

      const bt = this._baseTexture;
      const valid = !!bt.valid && bt.width > 0 && bt.height > 0;
      if (!valid) return;

      if (!this._fitDirty && this._lastValid) return;
      this._fitDirty = false;
      this._lastValid = true;

      const padX = this.padding;
      const padY = this.padding;
      const headerH = this.lineHeight(); // space for 'Preview'
      const availW = this.width - padX * 2;
      const availH = this.height - padY * 2 - headerH;

      const iw = bt.width;
      const ih = bt.height;
      const scale = Math.min(availW / iw, availH / ih);

      this._sprite.scale.set(scale, scale);

      const sw = iw * scale;
      const sh = ih * scale;

      const x = padX + (availW - sw) / 2;
      const y = padY + headerH + (availH - sh) / 2;

      this._sprite.x = x;
      this._sprite.y = y;
    }

    update() {
      super.update();
      this._applyFitIfReady();

      if (this._isGif && this._gifImg && this._gifCanvas && this._gifCtx && this._baseTexture) {
        const w = this._gifCanvas.width;
        const h = this._gifCanvas.height;
        if (w > 0 && h > 0) {
          // Redraw each frame so we capture the GIF’s current frame.
          this._gifCtx.clearRect(0, 0, w, h);
          this._gifCtx.drawImage(this._gifImg, 0, 0, w, h);
          this._baseTexture.update();
        }
      }

      if (this._isVideo && this._videoEl && this._baseTexture) {
        // Ensure the video texture updates while the menu is open.
        // (Some Pixi builds update automatically; we do it explicitly for reliability.)
        try { this._baseTexture.update(); } catch (_) {}
      }
    }

    _destroySprite() {
      if (this._sprite && this._sprite.parent) {
        this._sprite.parent.removeChild(this._sprite);
      }

      if (this._gifTexture) {
        // Pixi will handle shared texture refs; just null our refs.
        this._gifTexture = null;
      }

      this._sprite = null;
      this._baseTexture = null;

      this._isGif = false;
      if (this._gifImg && this._gifImg.parentNode) {
        try { this._gifImg.parentNode.removeChild(this._gifImg); } catch (_) {}
      }
      this._gifImg = null;
      this._gifCanvas = null;
      this._gifCtx = null;

      this._isVideo = false;
      if (this._videoEl) {
        try { this._videoEl.pause(); } catch (_) {}
        if (this._videoEl.parentNode) {
          try { this._videoEl.parentNode.removeChild(this._videoEl); } catch (_) {}
        }
      }
      this._videoEl = null;
      this._videoTexture = null;

      this._fitDirty = false;
      this._lastValid = false;
    }

    destroy(options) {
      this._destroySprite();
      super.destroy(options);
    }
  }

class Window_RK_AttackList extends Window_Command {
    initialize(rect) {
      super.initialize(rect);
      this.openness = 0;
    }

    makeCommandList() {
      for (const a of ATTACKS) {
        this.addCommand(a.name, `atk_${a.key}`, true, a.key);
      }
    }

    currentAttackKey() {
      const ext = this.currentExt();
      return String(ext || '');
    }
  }

  class Window_RK_ChordList extends Window_Command {
    initialize(rect) {
      super.initialize(rect);
      this.openness = 0;
    }

    makeCommandList() {
      for (const c of CHORDS) {
        this.addCommand(c.name, `chord_${c.id}`, true, c.id);
      }
    }

    currentChordId() {
      // Robust: ext can be lost on some Window_Command interactions (mouse/touch),
      // so fall back to parsing the command symbol.
      const ext = (typeof this.currentExt === 'function') ? this.currentExt() : null;
      const n = Number(ext);
      if (Number.isFinite(n) && n > 0) return n;

      const sym = (typeof this.currentSymbol === 'function') ? this.currentSymbol() : '';
      const m = String(sym || '').match(/^chord_(\d+)$/);
      if (m) return Number(m[1]);

      const data = (typeof this.currentData === 'function') ? this.currentData() : null;
      const n2 = data && data.ext != null ? Number(data.ext) : 0;
      return Number.isFinite(n2) ? n2 : 0;
    }

selectChordId(chordId) {
      const id = Number(chordId || 0);
      const idx = this._list ? this._list.findIndex(it => Number(it.ext) === id) : -1;
      if (idx >= 0) this.select(idx);
      else this.select(0);
    }

  }

  class Window_RK_NodeCommand extends Window_Command {
    initialize(rect) {
      this._hasRoot = false;
      super.initialize(rect);
      this.openness = 0;
    }

    setup(isRoot) {
      this._hasRoot = !!isRoot;
      this.refresh();
      this.select(0);
    }

    makeCommandList() {
      this.addCommand('Set Attack', 'setAttack');
      this.addCommand('Set Trigger', 'setTrigger');
      this.addCommand('Add Child', 'addChild');
      this.addCommand('Delete Node', 'deleteNode');
      if (!this._hasRoot) this.addCommand('Set as Root', 'setRoot');
      if (this._hasRoot) this.addCommand('Remove Root', 'removeRoot');
      this.addCommand('Cancel', 'cancel');
    }
  }

  class Scene_RK_ComboMenu extends Scene_MenuBase {
    create() {
      super.create();
      this._actorIndex = 0;
      this._actorId = this._initialActorId();
      this._ensureActorInParty();

      if (!rkActorData(this._actorId).presets.length) rkCreatePreset(this._actorId);

      this.createPresetWindow();
      this.createTreeWindow();
      this.createDetailWindow();
      this.createNodeCommandWindow();
      this.createAttackWindow();
      this.createChordWindow();
      this.createDeletePresetWindow();
      this.createRenamePresetPickWindow();

      this.createPresetRenameWindows();
      this._presetWindow.activate();
      this._presetWindow.select(0);
      // Do not auto-enter edit mode; wait until the user confirms a preset with OK.
      this._treeWindow.setData(this._actorId, 0);
      this.onNodeChange();
      this._treeWindow.deactivate();
    }

    _initialActorId() {
      const actor = $gameParty.menuActor() || $gameParty.leader();
      return actor ? actor.actorId() : 0;
    }

    _ensureActorInParty() {
      const ids = $gameParty.members().map(a => a.actorId());
      const idx = ids.indexOf(this._actorId);
      this._actorIndex = idx >= 0 ? idx : 0;
      const actor = $gameParty.members()[this._actorIndex];
      this._actorId = actor ? actor.actorId() : this._actorId;
      $gameParty.setMenuActor(actor);
    }

    createPresetWindow() {
      const rect = new Rectangle(0, this.mainAreaTop(), 260, this.mainAreaHeight());
      this._presetWindow = new Window_RK_PresetList(rect, this._actorId);
      this._presetWindow.setHandler('ok', this.onPresetOk.bind(this));
      this._presetWindow.setHandler('cancel', this.popScene.bind(this));
      this._presetWindow.setHandler('newPreset', this.onNewPreset.bind(this));
      this._presetWindow.setHandler('deletePreset', this.onDeletePreset.bind(this));
      this._presetWindow.setHandler('renamePreset', this.onRenamePreset.bind(this));
      this.addWindow(this._presetWindow);
    }

    createTreeWindow() {
      const x = 260;
      const w = Math.floor((Graphics.boxWidth - 260) * 0.60);
      const rect = new Rectangle(x, this.mainAreaTop(), w, this.mainAreaHeight());
      this._treeWindow = new Window_RK_Tree(rect);
      this._treeWindow.setHandler('ok', this.onTreeOk.bind(this));
      this._treeWindow.setHandler('cancel', this.onTreeCancel.bind(this));
      this._treeWindow.setHandler('nodeChange', this.onNodeChange.bind(this));
      this.addWindow(this._treeWindow);
    }

    createDetailWindow() {
      const x = 260 + this._treeWindow.width;
      const w = Graphics.boxWidth - x;

      const top = this.mainAreaTop();
      const totalH = this.mainAreaHeight();

      const minDetailH = this.calcWindowHeight(8, true);
      const minPreviewH = this.calcWindowHeight(4, true);

      let detailH = Math.floor(totalH * 0.60);
      detailH = Math.max(minDetailH, Math.min(totalH - minPreviewH, detailH));
      const previewH = Math.max(minPreviewH, totalH - detailH);

      const rectDetail = new Rectangle(x, top, w, detailH);
      this._detailWindow = new Window_RK_Detail(rectDetail);
      this.addWindow(this._detailWindow);

      const rectPrev = new Rectangle(x, top + detailH, w, previewH);
      this._previewWindow = new Window_RK_Preview(rectPrev);
      this.addWindow(this._previewWindow);
    }



    createNodeCommandWindow() {
      const w = 220;
      const h = this.calcWindowHeight(7, true);
      const rect = new Rectangle((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2, w, h);
      this._nodeCmdWindow = new Window_RK_NodeCommand(rect);
      this._nodeCmdWindow.setHandler('setAttack', this.onSetAttack.bind(this));
      this._nodeCmdWindow.setHandler('setTrigger', this.onSetTrigger.bind(this));
      this._nodeCmdWindow.setHandler('addChild', this.onAddChild.bind(this));
      this._nodeCmdWindow.setHandler('deleteNode', this.onDeleteNode.bind(this));
      this._nodeCmdWindow.setHandler('setRoot', this.onSetRoot.bind(this));
      this._nodeCmdWindow.setHandler('removeRoot', this.onRemoveRoot.bind(this));
      this._nodeCmdWindow.setHandler('cancel', this.onNodeCmdCancel.bind(this));
// (Yes, one handler is enough; duplicates are harmless but we avoid editing past history.)
      this._nodeCmdWindow.setHandler('cancel', this.onNodeCmdCancel.bind(this));
      this.addWindow(this._nodeCmdWindow);
    }

    createAttackWindow() {
      const w = 360;
      const h = Math.min(Graphics.boxHeight - 80, this.calcWindowHeight(Math.max(4, ATTACKS.length + 1), true));
      const rect = new Rectangle((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2, w, h);
      this._attackWindow = new Window_RK_AttackList(rect);
      this._attackWindow.setHandler('ok', this.onAttackChosen.bind(this));
      this._attackWindow.setHandler('cancel', this.onAttackCancel.bind(this));
      this.addWindow(this._attackWindow);
    }

    createChordWindow() {
      const w = 360;
      const h = Math.min(Graphics.boxHeight - 80, this.calcWindowHeight(Math.max(4, CHORDS.length + 1), true));
      const rect = new Rectangle((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2, w, h);
      this._chordWindow = new Window_RK_ChordList(rect);
      this._chordWindow.setHandler('ok', this.onChordChosen.bind(this));
      this._chordWindow.setHandler('cancel', this.onChordCancel.bind(this));
      this.addWindow(this._chordWindow);
    }


    createDeletePresetWindow() {
      const w = 360;
      const data = rkActorData(this._actorId);
      const lines = Math.min(10, Math.max(4, (data.presets ? data.presets.length : 0) + 1));
      const h = Math.min(Graphics.boxHeight - 80, this.calcWindowHeight(lines, true));
      const rect = new Rectangle((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2, w, h);
      this._deletePresetWindow = new Window_RK_DeletePresetList(rect, this._actorId);
      this._deletePresetWindow.setHandler('ok', this.onDeletePresetChosen.bind(this));
      this._deletePresetWindow.setHandler('cancel', this.onDeletePresetCancel.bind(this));
      this._deletePresetWindow.close();
      this._deletePresetWindow.hide();
      this.addWindow(this._deletePresetWindow);
    }



    createRenamePresetPickWindow() {
      const w = 360;
      const data = rkActorData(this._actorId);
      const lines = Math.min(10, Math.max(4, (data.presets ? data.presets.length : 0) + 1));
      const h = Math.min(Graphics.boxHeight - 80, this.calcWindowHeight(lines, true));
      const rect = new Rectangle((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2, w, h);
      this._renamePickPresetWindow = new Window_RK_DeletePresetList(rect, this._actorId);
      this._renamePickPresetWindow.setHandler('ok', this.onRenamePresetChosen.bind(this));
      this._renamePickPresetWindow.setHandler('cancel', this.onRenamePresetPickCancel.bind(this));
      this._renamePickPresetWindow.close();
      this._renamePickPresetWindow.hide();
      this.addWindow(this._renamePickPresetWindow);
    }


createPresetRenameWindows() {
  // Modal (in-scene) rename UI to avoid native browser prompt (which can break fullscreen).
  this._renamePresetId = 0;

  this._renameDimmer = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
  this._renameDimmer.bitmap.fillRect(0, 0, Graphics.boxWidth, Graphics.boxHeight, "#000000");
  this._renameDimmer.opacity = 0; // no darken
  this._renameDimmer.visible = false;
  this.addChild(this._renameDimmer);

  const w = 520;
  const editH = this.calcWindowHeight(4, true);
  const inputH = this.calcWindowHeight(9, true);
  const totalH = editH + inputH;
  const x = Math.floor((Graphics.boxWidth - w) / 2);
  const y = Math.floor((Graphics.boxHeight - totalH) / 2);

  const editRect = new Rectangle(x, y, w, editH);
  this._renameEditWindow = new Window_NameEdit(editRect);
  this._renameEditWindow.hide();
  this.addWindow(this._renameEditWindow);

  const inputRect = new Rectangle(x, y + editH, w, inputH);
  this._renameInputWindow = new Window_NameInput(inputRect);
  this._renameInputWindow.hide();
  this._renameInputWindow.setHandler("ok", this.onPresetRenameOk.bind(this));
  this._renameInputWindow.setHandler("cancel", this.onPresetRenameCancel.bind(this));
  this._renameInputWindow.setEditWindow(this._renameEditWindow);
  this.addWindow(this._renameInputWindow);
}

startPresetRename(presetId, currentName) {
  this._renamePresetId = presetId;

  // Deactivate other UI while renaming
  if (this._presetWindow) this._presetWindow.deactivate();
  if (this._treeWindow) this._treeWindow.deactivate();
  if (this._detailWindow) this._detailWindow.deactivate();
  if (this._nodeCommandWindow) this._nodeCommandWindow.deactivate();
  if (this._attackWindow) this._attackWindow.deactivate();
  if (this._chordWindow) this._chordWindow.deactivate();
  if (this._deletePresetWindow) this._deletePresetWindow.deactivate();

  this._renameDimmer.visible = false; // no darken

  const actor = $gameActors.actor(this._actorId);
  this._renameEditWindow.setup(actor, 32);

  // Prefill with preset name (Window_NameEdit defaults to actor name)
  const initial = String(currentName || "").trim().slice(0, 32);
  this._renameEditWindow._name = initial;
  this._renameEditWindow._index = initial.length;
  this._renameEditWindow.refresh();

  this._renameEditWindow.show();
  this._renameInputWindow.show();
  this._renameInputWindow.setEditWindow(this._renameEditWindow);
  this._renameInputWindow.select(0);
  this._renameInputWindow.activate();
}

_endPresetRename() {
  this._renameDimmer.visible = false;
  this._renameInputWindow.deactivate();
  this._renameEditWindow.hide();
  this._renameInputWindow.hide();
}

onPresetRenameOk() {
  const raw = this._renameEditWindow.name ? this._renameEditWindow.name() : this._renameEditWindow._name;
  const newName = String(raw || "").trim().slice(0, 32);

  if (!newName.length) {
    SoundManager.playBuzzer();
    this._renameInputWindow.activate();
    return;
  }

  const presetId = this._renamePresetId;
  const preset = rkGetPreset(this._actorId, presetId);
  if (!preset) {
    SoundManager.playBuzzer();
    this._endPresetRename();
    this._presetWindow.activate();
    return;
  }

  preset.name = newName;

  this._endPresetRename();

  // Refresh and reselect the renamed preset.
  const data = rkActorData(this._actorId);
  const idx = Math.max(0, data.presets.findIndex(p => p.id === presetId));
  this._presetWindow.refresh();
  this._presetWindow.select(idx);
  this.onPresetChange();
  this._presetWindow.activate();
}

onPresetRenameCancel() {
  this._endPresetRename();
  this._presetWindow.activate();
}


    update() {
      super.update();
      this.updateActorSwitch();
    }

    updateActorSwitch() {
      if (this._nodeCmdWindow.isOpen() || this._attackWindow.isOpen() || this._chordWindow.isOpen()) return;
      if (Input.isTriggered('pageup')) {
        this.changeActor(-1);
      } else if (Input.isTriggered('pagedown')) {
        this.changeActor(1);
      }
    }

    changeActor(delta) {
      const members = $gameParty.members();
      if (!members.length) return;
      this._actorIndex = (this._actorIndex + delta + members.length) % members.length;
      const actor = members[this._actorIndex];
      $gameParty.setMenuActor(actor);
      this._actorId = actor.actorId();
      if (!rkActorData(this._actorId).presets.length) rkCreatePreset(this._actorId);
      this._presetWindow.setActorId(this._actorId);
      this.onPresetChange();
    }

    currentPreset() {
      const presetId = this._presetWindow.currentPresetId() || rkActorData(this._actorId).activePresetId;
      return rkGetPreset(this._actorId, presetId) || rkGetActivePreset(this._actorId);
    }

    currentNodeId() {
      return this._treeWindow.selectedNodeId();
    }

    onPresetChange() {
      const preset = this.currentPreset();
      if (!preset) return;
      rkActorData(this._actorId).activePresetId = preset.id;
      this._treeWindow.setData(this._actorId, preset.id);
      this.onNodeChange();
    }

    onPresetOk() {
      const symbol = this._presetWindow.currentSymbol();
      if (symbol && symbol.startsWith('preset_')) {
        this.onPresetChange();
        this._presetWindow.deactivate();
        this._treeWindow.activate();
      } else {
        // Avoid recursive ok-handling loops and "dead" selections.
        if (symbol && this._presetWindow.isHandled(symbol)) {
          this._presetWindow.callHandler(symbol);
        } else {
          SoundManager.playBuzzer();
          this._presetWindow.activate();
        }
      }
    }

    onNewPreset() {
      rkCreatePreset(this._actorId);
      const data = rkActorData(this._actorId);
      const newIndex = Math.max(0, data.presets.length - 1);
      this._presetWindow.refresh();
      this._presetWindow.select(newIndex);
      this.onPresetChange();
      this._presetWindow.activate();
    }


    
onRenamePreset() {
  // Pick which preset to rename (same flow as delete preset)
  const data = rkActorData(this._actorId);
  if (!data.presets || data.presets.length <= 0) {
    SoundManager.playBuzzer();
    this._presetWindow.activate();
    return;
  }

  this._renamePickPresetWindow.setActorId(this._actorId);
  this._renamePickPresetWindow.selectPresetId(this._presetWindow.actionPresetId());
  this._renamePickPresetWindow.show();
  this._renamePickPresetWindow.open();
  this._renamePickPresetWindow.activate();
  this._presetWindow.deactivate();
}

onRenamePresetChosen() {
  const presetId = this._renamePickPresetWindow.currentPresetId();
  this._renamePickPresetWindow.close();
  this._renamePickPresetWindow.hide();

  const preset = rkGetPreset(this._actorId, presetId);
  if (!preset) {
    SoundManager.playBuzzer();
    this._presetWindow.activate();
    return;
  }

  this.startPresetRename(presetId, String(preset.name || ""));
}

onRenamePresetPickCancel() {
  this._renamePickPresetWindow.close();
  this._renamePickPresetWindow.hide();
  this._presetWindow.activate();
}



onDeletePreset() {
      const data = rkActorData(this._actorId);
      if (data.presets.length <= 1) {
        SoundManager.playBuzzer();
        this._presetWindow.activate();
        return;
      }

      this._deletePresetWindow.setActorId(this._actorId);
      this._deletePresetWindow.selectPresetId(this._presetWindow.actionPresetId());
      this._deletePresetWindow.show();
      this._deletePresetWindow.open();
      this._deletePresetWindow.activate();
      this._presetWindow.deactivate();
    }

    onDeletePresetChosen() {
      const data = rkActorData(this._actorId);
      if (data.presets.length <= 1) {
        SoundManager.playBuzzer();
        return this.onDeletePresetCancel();
      }

      const presetId = this._deletePresetWindow.currentPresetId();
      const idx = data.presets.findIndex(p => p.id === presetId);
      if (idx < 0) {
        SoundManager.playBuzzer();
        return this.onDeletePresetCancel();
      }

      data.presets.splice(idx, 1);

      const newIdx = Math.max(0, Math.min(idx, data.presets.length - 1));
      data.activePresetId = data.presets[newIdx].id;
      rkResetRuntime(this._actorId);

      this._presetWindow.refresh();
      this._presetWindow.select(newIdx);

      // If we were viewing presets already, keep the view consistent
      if (this._treeWindow._presetId) {
        this._treeWindow.setData(this._actorId, data.activePresetId);
        this.onNodeChange();
      }

      this.onDeletePresetCancel();
    }

    onDeletePresetCancel() {
      this._deletePresetWindow.close();
      this._deletePresetWindow.hide();
      this._presetWindow.activate();
    }



    onTreeOk() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();
      if (!preset || !nodeId) return;
      const isRoot = preset.roots.includes(nodeId);
      this._nodeCmdWindow.setup(isRoot);
      this._nodeCmdWindow.open();
      this._nodeCmdWindow.activate();
      this._treeWindow.deactivate();
    }

    onTreeCancel() {
      this._treeWindow.deactivate();
      this._presetWindow.activate();
    }

    onNodeChange() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();

      if (preset && preset.id) {
        this._detailWindow.setData(this._actorId, preset.id, nodeId);

        let pic = '';
        if (nodeId && preset.nodes && preset.nodes[nodeId]) {
          const node = preset.nodes[nodeId];
          const attack = attackByKey.get(node.attackKey);
          pic = attack ? (attack.previewPicture || '') : '';
        }
        this._previewWindow.setPicture(pic);
      } else {
        this._detailWindow.setData(this._actorId, 0, 0);
        this._previewWindow.setPicture('');
      }
    }


    onNodeCmdCancel() {
      this._nodeCmdWindow.close();
      this._nodeCmdWindow.deactivate();
      this._treeWindow.activate();
      this.onNodeChange();
    }

    onSetAttack() {
      if (!ATTACKS.length) {
        SoundManager.playBuzzer();
        return;
      }
      this._attackWindow.refresh();
      this._attackWindow.open();
      this._attackWindow.activate();
      this._nodeCmdWindow.deactivate();
    }

    onSetTrigger() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();
      if (!preset || !nodeId) {
        SoundManager.playBuzzer();
        return;
      }
      if (!CHORDS.length) {
        SoundManager.playBuzzer();
        return;
      }

      this._pendingTriggerNodeId = nodeId;

      const node = preset.nodes[nodeId];
      this._chordWindow.refresh();
      this._chordWindow.selectChordId(node ? node.chordId : 0);
      this._chordWindow.open();
      this._chordWindow.activate();
      this._nodeCmdWindow.deactivate();
    }

    onAddChild() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();
      if (!preset || !nodeId) return;

      const maxNodes = rkMaxNodesForActor(this._actorId);
      if (rkCountNodes(preset) >= maxNodes) {
        SoundManager.playBuzzer();
        return;
      }

      const defaultAttack = ATTACKS[0]?.key || '';
      const defaultChord = CHORDS[0]?.id || 0;
      const newId = rkAddChild(preset, nodeId, defaultAttack, defaultChord);
      if (!newId) {
        SoundManager.playBuzzer();
        return;

        // Spawn the new child near its parent (even if parent was dragged far away)
        const parent = preset.nodes[nodeId];
        const child = preset.nodes[newId];
        if (parent && child) {
          const dx = 150 + 12; // colW + colGap from the tree layout
          const boxH = this._treeWindow.lineHeight() + 10;
          const rowGap = 10;
          const childIndex = Math.max(0, (parent.children || []).length - 1);

          const px = Number.isFinite(parent.uiX) ? parent.uiX : 0;
          const py = Number.isFinite(parent.uiY) ? parent.uiY : 0;

          child.uiX = px + dx;
          child.uiY = py + childIndex * (boxH + rowGap);
        }
      }
      rkResetRuntime(this._actorId);
      this._treeWindow.refresh();
      this._treeWindow._selectedNodeId = newId;
      this._treeWindow.ensureSelectionValid();
      this.onNodeChange();
      this.onNodeCmdCancel();
    }

    onDeleteNode() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();
      if (!preset || !nodeId) return;

      // avoid deleting the last node
      if (rkCountNodes(preset) <= 1) {
        SoundManager.playBuzzer();
        return;
      }

      rkRemoveNode(preset, nodeId);
      if (!preset.roots.length) {
        // ensure at least one root exists
        const anyId = Number(Object.keys(preset.nodes)[0] || 0);
        if (anyId) preset.roots.push(anyId);
      }
      rkResetRuntime(this._actorId);
      this._treeWindow.refresh();
      this.onNodeChange();
      this.onNodeCmdCancel();
    }

    onSetRoot() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();
      if (!preset || !nodeId) return;
      if (!preset.roots.includes(nodeId)) preset.roots.push(nodeId);
      rkResetRuntime(this._actorId);
      this._treeWindow.refresh();
      this.onNodeChange();
      this.onNodeCmdCancel();
    }

    onRemoveRoot() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();
      if (!preset || !nodeId) return;

      // Prevent orphaning a node that has no parent reference.
      const hasParent = Object.keys(preset.nodes).some(idStr => {
        const n = preset.nodes[idStr];
        return n && Array.isArray(n.children) && n.children.includes(nodeId);
      });

      if (preset.roots.length <= 1 || !hasParent) {
        SoundManager.playBuzzer();
        // Always return control cleanly (avoid "stuck" state reports).
        this.onNodeCmdCancel();
        return;
      }

      preset.roots = preset.roots.filter(id => id !== nodeId);
      rkResetRuntime(this._actorId);
      this._treeWindow.refresh();
      this.onNodeChange();
      this.onNodeCmdCancel();
    }

    onAttackChosen() {
      const preset = this.currentPreset();
      const nodeId = this.currentNodeId();
      if (!preset || !nodeId) return;
      const node = preset.nodes[nodeId];
      node.attackKey = this._attackWindow.currentAttackKey();
      rkResetRuntime(this._actorId);
      this._attackWindow.close();
      this._attackWindow.deactivate();
      this._nodeCmdWindow.activate();
      this._treeWindow.refresh();
      this.onNodeChange();
    }

    onAttackCancel() {
      this._attackWindow.close();
      this._attackWindow.deactivate();
      this._nodeCmdWindow.activate();
    }

    onChordChosen() {
      const preset = this.currentPreset();
      const nodeId = this._pendingTriggerNodeId || this.currentNodeId();
      this._pendingTriggerNodeId = 0;

      if (!preset || !nodeId || !preset.nodes || !preset.nodes[nodeId]) {
        SoundManager.playBuzzer();
        this._chordWindow.close();
        this._chordWindow.deactivate();
        this._nodeCmdWindow.activate();
        return;
      }

      const node = preset.nodes[nodeId];
      const chosenId = this._chordWindow.currentChordId();
      if (!chosenId) {
        SoundManager.playBuzzer();
      } else {
        node.chordId = Number(chosenId) || node.chordId;
        rkResetRuntime(this._actorId);
      }

      this._chordWindow.close();
      this._chordWindow.deactivate();
      this._nodeCmdWindow.activate();
      this._treeWindow.refresh();
      this.onNodeChange();
    }

    onChordCancel() {
      this._chordWindow.close();
      this._chordWindow.deactivate();
      this._nodeCmdWindow.activate();
    }
  }

  window.Scene_RK_ComboMenu = Scene_RK_ComboMenu;

})();
