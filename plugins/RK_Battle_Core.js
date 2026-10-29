/*:
 * @target MZ
 * @plugindesc [v3.0] High-performance core manager, input buffer, and logic interpreter for RK Action Battle.
 * @author Rizuki
 *
 * @help RK_Battle_Core.js
 * * The foundational core plugin. 
 * * Provides the Event Emitter, Custom Update Loop, Input Buffering, 
 * and WebApp Logic Interpreter required by all other RK_Battle plugins.
 * * Place this ABOVE all other RK_Battle plugins in your Plugin Manager.
 */

var Imported = Imported || {};
Imported.RK_Battle_Core = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    // =========================================================================
    // MZ ENGINE ALIASES: Z-TIER INTEGRATION
    // =========================================================================
    const _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function() {
        _Game_CharacterBase_initMembers.call(this);
        this._zTier = 0; // Every map entity defaults to Tier 0
    };

    // Helper function for Map Events (e.g., Ladders, Stairs)
    Game_CharacterBase.prototype.setZTier = function(tier) {
        this._zTier = Math.max(0, Math.min(9, tier));
    };

    // =========================================================================
    // 1. THE EVENT EMITTER (Observer Pattern)
    // =========================================================================
    class RK_EventEmitter {
        constructor() {
            this._events = {};
        }
        on(eventName, listener) {
            if (!this._events[eventName]) this._events[eventName] = [];
            this._events[eventName].push(listener);
        }
        off(eventName, listener) {
            if (!this._events[eventName]) return;
            this._events[eventName] = this._events[eventName].filter(l => l !== listener);
        }
        emit(eventName, ...args) {
            if (this._events[eventName]) {
                for (let i = this._events[eventName].length - 1; i >= 0; i--) {
                    this._events[eventName][i](...args);
                }
            }
        }
    }
    RK.Battle.Events = new RK_EventEmitter();


    // =========================================================================
    // 2. THE INPUT BUFFER
    // =========================================================================
    class RK_InputBuffer {
        constructor() {
            this.buffers = {};
            this.pressedTimes = {};
            this.bufferDuration = 0.2; 
            this.trackedKeys = ['ok', 'cancel', 'shift', 'attack', 'up', 'down', 'left', 'right', 'pageup', 'pagedown'];
        }

        update(dt) {
            for (const key of this.trackedKeys) {
                if (Input.isTriggered(key)) {
                    this.buffers[key] = this.bufferDuration;
                }
                if (Input.isPressed(key)) {
                    this.pressedTimes[key] = (this.pressedTimes[key] || 0) + dt;
                } else {
                    this.pressedTimes[key] = 0;
                }
            }
            for (const key in this.buffers) {
                if (this.buffers[key] > 0) this.buffers[key] -= dt;
            }
        }

        isTriggered(key) { return this.buffers[key] > 0; }
        isPressed(key) { return Input.isPressed(key); }
        isLongPressed(key, threshold = 0.5) { return (this.pressedTimes[key] || 0) >= threshold; }

        consume(key) {
            if (this.buffers[key] > 0) {
                this.buffers[key] = 0;
                return true;
            }
            return false;
        }

        has(key) {
            return this.buffers[key] > 0;
        }
    }


    // =========================================================================
    // 3. THE LOGIC INTERPRETER & VIRTUAL MACHINE
    // =========================================================================
    
    // The central database for all tactical logic
    RK.Battle.Gimmicks = {};
    RK.Battle.Templates = {};

    RK.Battle.Interpreter = {
        // Automatically loads the single Gimmicks.json file on boot
        loadAllGimmicks: function() {
            if (Utils.isNwjs()) {
                const fs = require('fs');
                const path = require('path');
                
                const gimPath = path.join(process.mainModule.filename, '..', 'data', 'Gimmicks.json');
                if (fs.existsSync(gimPath)) {
                    RK.Battle.Gimmicks = JSON.parse(fs.readFileSync(gimPath, 'utf8'));
                }
                
                const tempPath = path.join(process.mainModule.filename, '..', 'data', 'Templates.json');
                if (fs.existsSync(tempPath)) {
                    RK.Battle.Templates = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
                }
                
                console.log(`RK Engine: ${Object.keys(RK.Battle.Gimmicks).length} Gimmicks, ${Object.keys(RK.Battle.Templates).length} Templates loaded.`);
            } else {
                // HTML5 Web Fallback
                fetch('data/Gimmicks.json').then(res => res.json()).then(data => RK.Battle.Gimmicks = data);
                fetch('data/Templates.json').then(res => res.json()).then(data => RK.Battle.Templates = data);
            }
        },

        evalCondition: function(conditionString, context) {
            try {
                const func = new Function('context', `with(context) { return ${conditionString}; }`);
                return func(context);
            } catch (e) {
                console.error("RK_Battle Logic Error in Condition: " + conditionString, e);
                return false;
            }
        },

        executeScript: function(scriptString, context) {
            try {
                const func = new Function('context', `with(context) { ${scriptString} }`);
                func(context);
            } catch (e) {
                console.error("RK_Battle Script Error: " + scriptString, e);
            }
        },

        // The Virtual Machine: Runs the exported command array
        executeSequence: function(sequenceId, context) {
            const sequenceData = RK.Battle.Gimmicks[sequenceId];
            if (!sequenceData || !sequenceData.commands) return;

            let skipDepth = -1; // Tracks if we are skipping a failed condition block

            for (let i = 0; i < sequenceData.commands.length; i++) {
                const cmd = sequenceData.commands[i];

                // Check if we are currently inside a failed condition block
                if (skipDepth !== -1) {
                    if (cmd.depth > skipDepth) continue; // Still nested inside failed block, skip
                    else skipDepth = -1; // Exited the block, resume execution
                }

                switch (cmd.action) {
                    case 'Condition':
                        const passed = this.evalCondition(cmd.value, context);
                        if (!passed) skipDepth = cmd.depth; // Fail: ignore all nested children
                        break;
                    case 'End':
                        // Structural marker, no runtime execution needed
                        break;
                    case 'Plugin':
                        this.executeScript(cmd.value, context);
                        break;
                    case 'Variable':
                        this.executeScript(`this.${cmd.value.replace('Set: ', '')}`, context);
                        break;
                    case 'Switch':
                        const switchMatch = cmd.value.match(/Set:\s*(\w+)\s*=\s*(ON|OFF)/i);
                        if (switchMatch) {
                            console.log(`Switch [${switchMatch[1]}] state changed to [${switchMatch[2]}]`);
                        }
                        break;
                    case 'Spawn':
                        let spawnId = cmd.value;
                        let overrideZIndex = undefined;
                        let overrideZTier = undefined;
                        let overrideFront = undefined;
                        
                        // Check if the user appended comma-separated arguments
                        if (cmd.value.includes(',')) {
                            const parts = cmd.value.split(',');
                            spawnId = parts[0].trim(); // First part is always the object ID
                            
                            // Parse any overrides attached to the string
                            parts.slice(1).forEach(part => {
                                const [key, val] = part.split(':').map(s => s.trim());
                                if (key === 'zIndex') overrideZIndex = parseFloat(val);
                                if (key === 'zTier') overrideZTier = parseInt(val);
                                if (key === 'spawnInFront') overrideFront = parseFloat(val);
                            });
                        }
                        
                        RK.Battle.Events.emit('SPAWN_REQUESTED', { 
                            objectId: spawnId, 
                            source: context,
                            zIndex: overrideZIndex,
                            zTier: overrideZTier,
                            spawnInFront: overrideFront
                        });
                        break;
                    case 'State':
                        RK.Battle.Events.emit('STATE_REQUESTED', { action: cmd.value, target: context });
                        break;
                    case 'Animation':
                        RK.Battle.Events.emit('ANIMATION_REQUESTED', { action: cmd.value, target: context });
                        break;
                }
            }
        }
    };


    // =========================================================================
    // 4. THE CORE MANAGER
    // =========================================================================
    class RK_BattleCore {
        constructor() {
            this.activeObjects = [];
            this.isInitialized = false;
            this.isPaused = false;
            this.Input = new RK_InputBuffer();
            
            // NOTE: VisualBridge has been removed. 
            // It is now handled externally by RK_Battle_Visuals.js
        }

        initMap() {
            this.isInitialized = true;
            this.activeObjects = []; // Clear leftover objects from previous map
            RK.Battle.Events.emit('MAP_INITIALIZED');
            
            this.loadMapEntities();
        }

        loadMapEntities() {
            // Formats the map ID to match your IDE exports (e.g., "Map_001")
            const formattedMapId = "Map_" + String($gameMap.mapId()).padStart(3, '0');
            
            // Point to the combined Collision/Data JSON
            const filePath = `data/${formattedMapId}_Collision.json`; 

            fetch(filePath)
                .then(response => {
                    if (!response.ok) throw new Error("No custom RK map data found.");
                    return response.json();
                })
                .then(mapData => {
                    if (!mapData.entities) return;
                    
                    mapData.entities.forEach(entity => {
                        // Spawn each entity saved from the Tactical IDE
                        RK.Battle.Events.emit('SPAWN_REQUESTED', {
                            objectId: entity.id,
                            x: entity.x,         
                            y: entity.y,         
                            zTier: entity.zTier  
                        });
                    });
                })
                .catch(error => {
                    console.log(`RK Engine: Standard RPG Maker map loaded. (${error.message})`);
                });
        }

        update(deltaTime) {
            if (!this.isInitialized) return;

            if (this.isPaused) return; 

            this.Input.update(deltaTime);
            RK.Battle.Events.emit('CORE_UPDATE_TICK', deltaTime);

            for (let i = this.activeObjects.length - 1; i >= 0; i--) {
                const obj = this.activeObjects[i];
                if (obj.needsDestruction) {
                    this.activeObjects.splice(i, 1);
                    RK.Battle.Events.emit('OBJECT_DESTROYED', obj);
                } else {
                    if (obj.update) obj.update(deltaTime);
                }
            }
        }
        spawnObject(obj) {
            this.activeObjects.push(obj);
            RK.Battle.Events.emit('OBJECT_SPAWNED', obj);
            return obj;
        }

        destroyObject(obj) {
            obj.needsDestruction = true;
            if (obj.activeHitbox) {
                obj.activeHitbox.active = false;
            }
        }
    }

    RK.Battle.Core = new RK_BattleCore();


    // =========================================================================
    // 5. RPG MAKER MZ ENGINE HOOKS
    // =========================================================================
    
    // Boot Hook: Auto-load Gimmicks.json when the MZ database initializes
    const _DataManager_loadDatabase = DataManager.loadDatabase;
    DataManager.loadDatabase = function() {
        _DataManager_loadDatabase.call(this);
        RK.Battle.Interpreter.loadAllGimmicks();
    };

    const _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        RK.Battle.Core.activeObjects = []; 
    };

    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        RK.Battle.Core.initMap();
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        const dt = Graphics.app.ticker.deltaMS / 1000;
        RK.Battle.Core.update(dt);
    };

    // =========================================================================
    // RK to DotMove Terrain Bridge (Ultimate Optimization)
    // =========================================================================
    class RK_TerrainProxy {
        constructor(logicObj) { this.obj = logicObj; }

        get zPoint() { return this.obj.zPoint; }
        get zTier() { return this.obj.zTier; }
        get _zTier() { return this.obj.zTier; }
        get x() { return this.obj.physicsBox.x / 48.0; }
        get y() { return this.obj.physicsBox.y / 48.0; }

        width() { return this.obj.physicsBox.width / 48.0; }
        height() { return this.obj.physicsBox.height / 48.0; }
        isThrough() { 
            return !this.obj.hasMapPhysics || !!this.obj.isThrough; 
        } 
        isDebugThrough() { return false; }
        isMapPassable(x, y, d) { return $gameMap.isPassable(x, y, d); }
        positionPoint() { return new DotMoveSystem.DotMovePoint(this.x, this.y); }

        setPositionPoint(point) {
            this.obj.x = (point.x * 48.0) + (this.obj.physicsBox.width / 2);
            this.obj.y = (point.y * 48.0) + (this.obj.physicsBox.height / 2);
        }
        
        isEnabledWallSlide() { return true; }
        slideLengthX() { return this.width() >= 1 ? 0.5 : this.width() / 2; }
        slideLengthY() { return this.height() >= 1 ? 0.5 : this.height() / 2; }
        needDiagonalSlideX() { return false; }
        needDiagonalSlideY() { return false; }
        reverseDir(d) { return 10 - d; }
        distancePerFrame() { return 0; } 
        checkCollisionTargetCharacter(x, y, d, character) { return false; }
    }

    // =========================================================================
    // UNIVERSAL BASE ENTITY
    // =========================================================================
    class RK_Entity {
        constructor(id, team, startX, startY, templateData) {
            this.id = id;
            this.team = team;
            
            // Logical Coordinates
            this.x = startX;
            this.y = startY;
            
            // Safely parse template payload
            const logic = (templateData && templateData.logic) ? templateData.logic : {};
            const visuals = (templateData && templateData.visuals) ? templateData.visuals : {};
            this._baseZ = visuals.zTier !== undefined ? Number(visuals.zTier) : 0;
            this._jumpY = 0;
            this.baseZIndex = visuals.zIndex !== undefined ? Number(visuals.zIndex) : 1;

            // Parse comma-separated states into a highly optimized Set
            const stateString = logic.defaultStates || "";
            this.states = new Set(stateString.split(',').map(s => s.trim()).filter(s => s !== ""));

            this.zTier = visuals.zTier !== undefined ? visuals.zTier : 0;
            this.speed = logic.speed !== undefined ? logic.speed : 5;
            
            // Standardized Physics Flags
            this.hasMapPhysics = logic.hasMapPhysics !== undefined ? logic.hasMapPhysics : true;
            this.hasCombatPhysics = logic.hasCombatPhysics !== undefined ? logic.hasCombatPhysics : true;
            
            // 1. Map Physics Box (Where the object sits on the ground grid)
            const pW = logic.physicsBox ? logic.physicsBox.w : 24;
            const pH = logic.physicsBox ? logic.physicsBox.h : 16;
            this.physicsBox = new RK.Battle.Action.RK_AABB(this.x - (pW / 2), this.y - (pH / 2), pW, pH);
            
            // 2. Combat Hurtbox (Where the sprite visually is drawn)
            const hW = logic.hurtBox ? logic.hurtBox.w : 32;
            const hH = logic.hurtBox ? logic.hurtBox.h : 32;
            this.hurtbox = new RK.Battle.Action.RK_AABB(this.x - (hW / 2), this.y - (hH / 2), hW, hH);
            
            this.needsDestruction = false;
        }

        // CPU Calculation: Continuous vertical position
        get zPoint() {
            const jumpBonus = (this._jumpY !== undefined && this._jumpY !== 0) ? (Math.abs(this._jumpY) / 48.0) : 0;
            const subLayerBonus = (this.baseZIndex || 0) / 100.0;
            return this._baseZ + jumpBonus + subLayerBonus;
        }

        set zPoint(val) {
            this._baseZ = Number(val) || 0;
        }

        // GPU / Visuals: Discrete rendering bucket (0-9)
        get zTier() {
            return Math.max(0, Math.min(9, Math.floor(this._baseZ)));
        }

        set zTier(val) {
            this._baseZ = Math.floor(Number(val) || 0);
        }

        // Backward-compatibility alias for Hendrix plugins
        zFloat() {
            return this.zPoint;
        }

        // Call this inside every update(dt) loop
        syncBoxes(visualOffsetY = 0) {
            const tierShift = (this._baseZ !== undefined ? Number(this._baseZ) : 0) * 48.0;

            if (this.hasMapPhysics && this.physicsBox) {
                this.physicsBox.x = this.x - (this.physicsBox.width / 2);
                // Ground footprint stays on the ground plane:
                this.physicsBox.y = (this.y - tierShift) - (this.physicsBox.height / 2);
            }
            if (this.hasCombatPhysics && this.hurtbox) {
                this.hurtbox.x = this.x - (this.hurtbox.width / 2);
                // Combat hurtbox lifts into the air with the jump:
                this.hurtbox.y = (this.y - tierShift + visualOffsetY) - (this.hurtbox.height / 2);
            }
        }
    }
    
    // Expose it globally so other plugins can extend it
    RK.Battle.Entity = RK_Entity;

    // =========================================================================
    // SPAWNED OBJECT ENTITY
    // =========================================================================

    class RK_SpawnedObject extends RK.Battle.Entity {
        constructor(id, team, startX, startY, template) {
            super(id, team, startX, startY, template);
            
            this.template = template;
            this.imageName = template.visuals.imageName;
            this.lifespan = template.logic.lifespan !== undefined ? template.logic.lifespan : 3.0;
            this.baseZIndex = template.visuals.zIndex !== undefined ? template.visuals.zIndex : 1;
            this.scale = template.visuals.scale !== undefined ? template.visuals.scale : 1.0;
            this.destroyOnWall = template.logic.destroyOnWall !== undefined ? template.logic.destroyOnWall : true;
            this.facing = 'right';
            
            this.timer = 0;
            this.vx = 0;
            this.vy = 0;
            this.rotation = 0;
            this._jumpY = 0;

            // 1. Auto-Spawn Combat Hitbox if damage or hitbox dimensions exist
            if (template.logic && (template.logic.damage > 0 || template.logic.hitbox)) {
                const hitW = (template.logic.hitbox && template.logic.hitbox.w) || 32;
                const hitH = (template.logic.hitbox && template.logic.hitbox.h) || 32;
                const shape = new RK.Battle.Action.RK_AABB(this.x - hitW / 2, this.y - hitH / 2, hitW, hitH);
                
                this.activeHitbox = RK.Battle.Action.spawnHitbox(shape, this, team, {
                    damage: template.logic.damage || 0,
                    targetTags: template.logic.targetTags || [],
                    tags: template.logic.tags || [],
                    lifeTime: this.lifespan,
                    centerZ: this.zPoint,
                    zThickness: 0.75,
                    tierRange: 0
                });
            }

            // 2. Trigger On-Spawn Behavior Gimmick
            if (template.logic && template.logic.gimmickId) {
                RK.Battle.Interpreter.executeSequence(template.logic.gimmickId, this);
            }
        }

        setDirection(angle, speed) {
            this.rotation = angle;
            const radians = angle * (Math.PI / 180);
            this.vx = Math.cos(radians) * speed;
            this.vy = Math.sin(radians) * speed;
            this.facing = (angle > 90 && angle < 270) ? 'left' : 'right';
        }

        update(dt) {
            this.timer += dt;

            if (this.lifespan > 0) {
                this.lifespan -= dt;
                if (this.lifespan <= 0) {
                    this.needsDestruction = true;
                    return;
                }
            }

            // Execute parallel gimmick script if assigned
            if (this.template.logic.triggerType === 'parallel' && this.template.logic.gimmickId) {
                RK.Battle.Interpreter.executeSequence(this.template.logic.gimmickId, this);
            }

            const dpfPixels = this.speed * (dt * 60);
            const moveX = this.vx * dpfPixels;
            const moveY = this.vy * dpfPixels;

            // 3. Wall Collision & Penetration checks via RK_CollisionMZ SpatialPartition
            if (this.hasMapPhysics && !this.isThrough) {
                const nextX = this.x + moveX;
                const nextY = this.y + moveY;
                const pW = this.physicsBox.width;
                const pH = this.physicsBox.height;

                const nextBox = new RK.Battle.Action.RK_AABB(nextX - pW / 2, nextY - pH / 2, pW, pH);
                const currentZ = this.zTier || 0;
                const nearby = RK.CollisionMZ.SpatialPartition.getNearby(nextBox.x, nextBox.y, pW, pH);

                let blocked = false;
                for (let i = 0; i < nearby.length; i++) {
                    const col = nearby[i];
                    if (!col.isBlocking) continue;
                    if (col.isAirSlide || col.terrainId === 'slide') continue; // Airborne objects slide through

                    const colBaseZ = col.zMin !== undefined ? Number(col.zMin) : Number(col.zTier || 0);
                    const colTopZ  = col.zMax !== undefined ? Number(col.zMax) : (colBaseZ + 1.0);

                    if (currentZ >= colBaseZ && currentZ < colTopZ) {
                        if (nextBox.intersectsAABB(col)) {
                            blocked = true;
                            break;
                        }
                    }
                }

                if (blocked) {
                    if (this.destroyOnWall) {
                        this.needsDestruction = true;
                        if (this.activeHitbox) this.activeHitbox.active = false;
                        RK.Battle.Events.emit('PROJECTILE_HIT_WALL', this);
                        return;
                    }
                } else {
                    this.x = nextX;
                    this.y = nextY;
                }
            } else {
                this.x += moveX;
                this.y += moveY;
            }

            // Update Hitbox coordinate tracking
            if (this.activeHitbox && this.activeHitbox.shape) {
                this.activeHitbox.shape.x = this.x - (this.activeHitbox.shape.width / 2);
                this.activeHitbox.shape.y = this.y - (this.activeHitbox.shape.height / 2);
                
                // Update the vertical 2.5D slice dynamically as the projectile moves/falls
                const center = this.zPoint;
                const thickness = (this.activeHitbox.payload && this.activeHitbox.payload.zThickness) || 0.75;
                this.activeHitbox.zMin = center - (thickness / 2);
                this.activeHitbox.zMax = center + (thickness / 2);
            }

            this.syncBoxes(this._jumpY);

            // Off-screen cleanup
            if (this.x > ($gameMap.width() * 48) + 200 || this.x < -200 ||
                this.y > ($gameMap.height() * 48) + 200 || this.y < -200) {
                this.needsDestruction = true;
            }
        }
    }

    // =========================================================================
    // 6. THE OBJECT FACTORY (Listens for SPAWN_REQUESTED)
    // =========================================================================
    RK.Battle.Events.on('SPAWN_REQUESTED', (data) => {
        const template = RK.Battle.Templates[data.objectId];
        if (!template) {
            console.warn(`RK Battle: Cannot spawn [${data.objectId}]. Template missing.`);
            return;
        }

        const tw = $gameMap ? $gameMap.tileWidth() : 48;
        const th = $gameMap ? $gameMap.tileHeight() : 48;
        const offX = template.visuals.xOffset || 0;
        const offY = template.visuals.yOffset || 0;
        
        let centerX = offX;
        let centerY = offY;
        let dirX = 0;
        let dirY = 0;

        // 1. Calculate Base Center and Direction Vectors
        if (data.source) {
            
            // A. If source is an MZ Character (Player or Event)
            if (typeof data.source.direction === 'function') {
                
                // H_DotMoveSystem Support (Gets exact center)
                if (typeof H_DotMoveSystem !== 'undefined' && typeof data.source.centerPositionPoint === 'function') {
                    const sourcePoint = data.source.centerPositionPoint();
                    // centerPositionPoint returns grid center (e.g., 5.5). Multiply by tw for pixel center.
                    centerX = sourcePoint.x * tw; 
                    centerY = sourcePoint.y * th;
                } else {
                    // Standard MZ Grid Center
                    centerX = ((data.source._realX || data.source.x || 0) + 0.5) * tw;
                    centerY = ((data.source._realY || data.source.y || 0) + 0.5) * th;
                }

                // Get 8-Dir Numpad Offset vectors (Equivalent to getDirectionOffset)
                const dir = data.source.direction();
                if (dir === 1) { dirX = -1; dirY = 1; }
                else if (dir === 2) { dirX = 0; dirY = 1; }
                else if (dir === 3) { dirX = 1; dirY = 1; }
                else if (dir === 4) { dirX = -1; dirY = 0; }
                else if (dir === 6) { dirX = 1; dirY = 0; }
                else if (dir === 7) { dirX = -1; dirY = -1; }
                else if (dir === 8) { dirX = 0; dirY = -1; }
                else if (dir === 9) { dirX = 1; dirY = -1; }
                
                // Normalize diagonals so objects don't spawn further away on an angle
                if (dirX !== 0 && dirY !== 0) {
                    const length = Math.sqrt(dirX * dirX + dirY * dirY);
                    dirX /= length;
                    dirY /= length;
                }
            } 
            // B. If source is an RK Battle Object (Uses raw pixel coords and free rotation)
            else if (data.source.rotation !== undefined) {
                centerX = data.source.x || 0;
                centerY = data.source.y || 0;
                
                // Convert rotation degrees to a 2D vector
                const radians = data.source.rotation * (Math.PI / 180);
                dirX = Math.cos(radians);
                dirY = Math.sin(radians);
            }
        }

        // 2. Apply Spawn-In-Front Offset
        let frontOffX = 0;
        let frontOffY = 0;
        if (data.spawnInFront) {
            // Defaults to 1 tile width distance if just flagged, or uses the specific pixel number
            const distance = typeof data.spawnInFront === 'number' ? data.spawnInFront : tw; 
            frontOffX = dirX * distance;
            frontOffY = dirY * distance;
        }

        // 3. Final Coordinates (Explicit X/Y overrides Center + Front calc + Base Offsets)
        const startX = data.x !== undefined ? data.x + offX : centerX + frontOffX + offX;
        const startY = data.y !== undefined ? data.y + offY : centerY + frontOffY + offY;
        
        // --- READ Z-OVERRIDES OR FALLBACK TO DEFAULTS ---
        const startingTier = data.zTier !== undefined ? data.zTier : (template.visuals.zTier !== undefined ? template.visuals.zTier : (data.source ? (data.source.zTier || 1) : 1));
        const baseZIndex = data.zIndex !== undefined ? data.zIndex : (template.visuals.zIndex !== undefined ? template.visuals.zIndex : 1);
        // ------------------------------------------------

        const newEntity = new RK_SpawnedObject(data.objectId, 'neutral', startX, startY, template);
        newEntity.zTier = startingTier;
        if (data.zIndex !== undefined) newEntity.baseZIndex = baseZIndex;

        // Immediately sync hitbox bounds to startingTier on frame 1:
        if (newEntity.activeHitbox) {
            const center = newEntity.zPoint;
            const thickness = (newEntity.activeHitbox.payload && newEntity.activeHitbox.payload.zThickness) || 0.75;
            newEntity.activeHitbox.zMin = center - (thickness / 2);
            newEntity.activeHitbox.zMax = center + (thickness / 2);
        }

        // Inject into the engine
        const spawnedObject = RK.Battle.Core.spawnObject(newEntity);
        if (data.source) {
            data.source.lastSpawned = spawnedObject;
        }
        
        console.log(`RK Battle: Spawned ${data.objectId} at Pixel X:${startX} Y:${startY} with sprite ${newEntity.imageName}`);
    });
    
    // =========================================================================
    // 7. GLOBAL API SHORTHANDS (For MZ Event Script Calls)
    // =========================================================================
    window.RK = window.RK || {};
    
    /**
     * Spawns an asset template dynamically.
     * Example: RK.Spawn("OBJ_Fireball", 150, 200, "zTier: 2, speed: 10");
     */
    window.RK.Spawn = function(objectId, x = undefined, y = undefined, overrideArgs = "") {
        let zIndex, zTier, spawnInFront;
        
        if (overrideArgs.trim() !== "") {
            const parts = overrideArgs.split(',');
            parts.forEach(part => {
                const [key, val] = part.split(':').map(s => s.trim());
                if (key === 'zIndex') zIndex = parseFloat(val);
                if (key === 'zTier') zTier = parseInt(val);
                if (key === 'spawnInFront') spawnInFront = parseFloat(val);
            });
        }

        // Fallback source to player if triggering from MZ Event
        const fallbackSource = RK.Battle.Skill && RK.Battle.Skill.player ? RK.Battle.Skill.player : null;

        RK.Battle.Events.emit('SPAWN_REQUESTED', { 
            objectId: objectId, 
            x: x, 
            y: y, 
            zIndex: zIndex, 
            zTier: zTier,
            spawnInFront: spawnInFront,
            source: fallbackSource
        });
    };

    /**
     * Executes a Logic Sequencer Gimmick.
     * Example: RK.Gimmick("GIM_Boss_Phase_2", $gamePlayer);
     */
    window.RK.Gimmick = function(gimmickId, contextEntity = null) {
        RK.Battle.Interpreter.executeSequence(gimmickId, contextEntity);
    };

    // =========================================================================
    // 8. THE DOTMOVE PHYSICS BRIDGE
    // =========================================================================
    RK.Battle.Physics = {
        /**
         * Universally syncs an RK logic object's physicsBox to an MZ Map Event
         * for flawless DotMoveSystem wall collision and sprite centering.
         */
        syncToDotMove: function(logicObj, mapEvent) {
            if (!mapEvent || typeof DotMoveSystem === 'undefined') return;

            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            
            const targetW = logicObj.physicsBox.width / tw;
            const targetH = logicObj.physicsBox.height / th;

            // Only push updates to the engine if the size actually changed
            // This prevents massive CPU overhead from rewriting values every frame
            if (mapEvent.width() !== targetW || mapEvent.height() !== targetH) {
                mapEvent.setWidth(targetW);
                mapEvent.setHeight(targetH);
                
                // Re-center visual sprite based on new collision footprint
                mapEvent.setOffsetX(-(1.0 - targetW) / 2);
                mapEvent.setOffsetY(-(1.0 - targetH));
                
                // Adjust slide length to prevent getting stuck on corners
                mapEvent.setSlideLengthX(mapEvent.minTouchWidth());
                mapEvent.setSlideLengthY(mapEvent.minTouchHeight());
            }
        }
    };
})();