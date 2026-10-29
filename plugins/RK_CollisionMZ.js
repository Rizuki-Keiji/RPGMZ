/*:
 * @target MZ
 * @plugindesc [v1.1] RK_CollisionMZ - Custom Circle/Rectangle Physics, Z-Tier Engine & Vertical Drop System
 * @author Rizuki Keiji
 * 
 * @help
 * Bypasses native RPG Maker MZ tilemap grid collisions and replaces them with 
 * sub-pixel Circle-vs-Rectangle AABB physics, multi-tier elevation, and gravity drops.
 */

var RK = RK || {};
RK.CollisionMZ = RK.CollisionMZ || {};
RK.CollisionMZ.TerrainTypes = {
    'wall':    0xFF003C, // Neon Red
    'water':   0x0055FF, // Blue
    'grass':   0x00FF55, // Green
    'pitfall': 0xB100FF, // Purple
    'crumble': 0xFFA500  // Orange
};

RK.CollisionMZ.Math = RK.CollisionMZ.Math || {};

/**
 * Calculates the exact Z-Elevation (Float) of a point inside an environment object.
 */
RK.CollisionMZ.Math.getZElevation = function(pixelX, pixelY, envObj) {
    if (!envObj.isRamp) {
        return envObj.zStatic !== undefined ? envObj.zStatic : envObj.zTier;
    }

    const clampedX = Math.max(envObj.x, Math.min(pixelX, envObj.x + envObj.w));
    const clampedY = Math.max(envObj.y, Math.min(pixelY, envObj.y + envObj.h));

    let ratio = 0;

    switch (envObj.direction) {
        case 'north': 
            ratio = 1.0 - ((clampedY - envObj.y) / envObj.h);
            break;
        case 'south': 
            ratio = (clampedY - envObj.y) / envObj.h;
            break;
        case 'east': 
            ratio = (clampedX - envObj.x) / envObj.w;
            break;
        case 'west': 
            ratio = 1.0 - ((clampedX - envObj.x) / envObj.w);
            break;
    }

    return envObj.zMin + (ratio * (envObj.zMax - envObj.zMin));
};

/**
 * Recursively or iteratively scans downward to find the lowest bottom boundary (Y + H)
 * across any contiguous/overlapping Cliff colliders.
 */
RK.CollisionMZ.Math.findLowestConnectedCliffEdge = function(footX, startCol) {
    let lowestBottomY = startCol.y + startCol.h;
    let lowestFloorZ = startCol.zMin !== undefined ? Number(startCol.zMin) : 0;
    let currentY = lowestBottomY;

    // Look downward along the same X coordinate to catch overlapping or contiguous cliff boxes
    const scanLimit = 20; // safety ceiling to prevent infinite loops
    let iterations = 0;

    while (iterations++ < scanLimit) {
        // Query nearby colliders at the bottom seam (scanning +4px downward)
        const nearby = RK.CollisionMZ.SpatialPartition.getNearby(footX, currentY + 2, 1, 16);
        let foundNext = false;

        for (let i = 0; i < nearby.length; i++) {
            const nextCol = nearby[i];
            const isCliff = (nextCol.isAirSlide || nextCol.terrainId === 'slide');
            if (!isCliff) continue;

            // Check if horizontal range overlaps
            if (footX >= nextCol.x && footX <= nextCol.x + nextCol.w) {
                // Check if vertically contiguous or overlapping (within 4px seam tolerance)
                if (nextCol.y <= currentY + 4 && (nextCol.y + nextCol.h) > lowestBottomY) {
                    lowestBottomY = nextCol.y + nextCol.h;
                    currentY = lowestBottomY;
                    if (nextCol.zMin !== undefined) {
                        lowestFloorZ = Math.min(lowestFloorZ, Number(nextCol.zMin));
                    }
                    foundNext = true;
                    break;
                }
            }
        }

        if (!foundNext) break;
    }

    return { bottomY: lowestBottomY, floorZ: lowestFloorZ };
};

// ==============================================================================
// 1. DISABLE NATIVE TILEMAP COLLISIONS
// ==============================================================================

Game_Map.prototype.isPassable = function(x, y, d) {
    return true; 
};

Game_CharacterBase.prototype.isMapPassable = function(x, y, d) {
    return true; 
};

// Character Flying Check
Game_CharacterBase.prototype.isFlying = function() {
    return !!this._isFlying || (this.template && !!this.template.isFlying);
};

// Volumetric Custom Collision Checker
if (typeof DotMoveSystem !== 'undefined') {
    DotMoveSystem.CharacterCollisionChecker.prototype.checkCollisionMasses = function(x, y, d) {
        const character = this._character.character ? this._character.character() : this._character;

        if (character.isThrough && character.isThrough()) return [];

        const collisionResults = [];
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        
        const charW = character.width ? character.width() : 1;
        const charH = character.height ? character.height() : 1;

        const zElevation = character.zPoint !== undefined ? character.zPoint : (character.zTier || 0);
        const zOffsetTiles = zElevation;
        const zOffsetPixels = zElevation * th;

        const pixelX = x * tw;
        const pixelY = (y - zOffsetTiles) * th;
        const pixelW = charW * tw;
        const pixelH = charH * th;

        const nearbyColliders = RK.CollisionMZ.SpatialPartition.getNearby(pixelX, pixelY, pixelW, pixelH);
        const subjectRect = new DotMoveSystem.DotMoveRectangle(x, y - zOffsetTiles, charW, charH);
        const subjectZPoint = character.zPoint !== undefined ? character.zPoint : (character.zTier || 0);
        const isAirborne = !!character._jumping;

        const EPSILON = 0.001;

        for (let i = 0; i < nearbyColliders.length; i++) {
            let envObj = nearbyColliders[i];

            const colBaseZ = envObj.zMin !== undefined ? Number(envObj.zMin) : Number(envObj.zTier || 0);
            const colTopZ  = envObj.zMax !== undefined ? Number(envObj.zMax) : (colBaseZ + (envObj.isRamp ? 1.0 : 1.0));

            // SENSORS
            if (envObj.isBlocking === false) continue;

            // CLIFF FALL PASS-THROUGH:
            // Airborne entities moving or falling over a cliff must pass through freely.
            const isCliff = envObj.isAirSlide || envObj.terrainId === 'slide';
            if (isAirborne && isCliff) {
                continue;
            }

            // Regular wall jump clearance (if completely above the top boundary)
            if (isAirborne && !envObj.isCeiling && subjectZPoint >= colTopZ - EPSILON) {
                continue;
            }

            // Bridge under-clearance
            if (envObj.isBridge && subjectZPoint < colBaseZ - EPSILON) {
                continue;
            }

            // Vertical span check: if character is outside the vertical slice, ignore
            if (subjectZPoint < colBaseZ - EPSILON || subjectZPoint >= colTopZ - EPSILON) {
                continue;
            }

            const targetX = envObj.x / tw;
            const targetY = envObj.y / th;
            const targetW = envObj.w / tw;
            const targetH = envObj.h / th;

            const targetRect = new DotMoveSystem.DotMoveRectangle(targetX, targetY, targetW, targetH);
            const result = this.checkCollidedRect(d, subjectRect.clone(), targetRect, envObj);
            
            if (result) {
                collisionResults.push(result);
            }
        }
        
        return collisionResults; 
    };

    // --- ANTI-CLIP EJECTION SOLVER FOR ABSOLUTE COLLIDERS ---
    Game_CharacterBase.prototype.resolveAbsoluteColliderClipping = function() {
        if (this.isThrough && this.isThrough()) return;

        if (this._jumping || this._isFallingCliff || this._cliffLandingTargetY !== undefined) return;
        
        // 1. ABSOLUTE BYPASS WHILE AIRBORNE OR FALLING
        if (this._jumping || this._isFallingCliff) return;

        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const charW = this.width ? this.width() : 1;
        const charH = this.height ? this.height() : 1;

        const currentZ = this.zPoint !== undefined ? this.zPoint : (this.zTier || 0);
        const zOffsetPixels = currentZ * th;

        const pX = this._realX * tw;
        const pY = (this._realY * th) - zOffsetPixels;
        const pW = charW * tw;
        const pH = charH * th;

        const nearby = RK.CollisionMZ.SpatialPartition.getNearby(pX, pY, pW, pH);
        const EPSILON = 0.001;

        for (let i = 0; i < nearby.length; i++) {
            const col = nearby[i];
            if (col.isBlocking === false) continue;
            // Never eject against cliff colliders
            if (col.isAirSlide || col.terrainId === 'slide') continue;

            const colBaseZ = col.zMin !== undefined ? Number(col.zMin) : Number(col.zTier || 0);
            const colTopZ  = col.zMax !== undefined ? Number(col.zMax) : (colBaseZ + 1.0);

            if (currentZ < colBaseZ - EPSILON || currentZ >= colTopZ - EPSILON) continue;

            const overlapX1 = (pX + pW) - col.x;
            const overlapX2 = (col.x + col.w) - pX;
            const overlapY1 = (pY + pH) - col.y;
            const overlapY2 = (col.y + col.h) - pY;

            if (overlapX1 > 0 && overlapX2 > 0 && overlapY1 > 0 && overlapY2 > 0) {
                const minOverlap = Math.min(overlapX1, overlapX2, overlapY1, overlapY2);

                if (minOverlap === overlapX1) {
                    this._realX = (col.x - pW) / tw;
                } else if (minOverlap === overlapX2) {
                    this._realX = (col.x + col.w) / tw;
                } else if (minOverlap === overlapY1) {
                    this._realY = ((col.y - pH) + zOffsetPixels) / th;
                } else if (minOverlap === overlapY2) {
                    this._realY = ((col.y + col.h) + zOffsetPixels) / th;
                }

                this._x = Math.round(this._realX);
                this._y = Math.round(this._realY);
            }
        }
    };

    const _Game_CharacterBase_updateMove = Game_CharacterBase.prototype.updateMove;
    Game_CharacterBase.prototype.updateMove = function() {
        _Game_CharacterBase_updateMove.call(this);
        if (!this._jumping && !this._isFallingCliff) {
            this.resolveAbsoluteColliderClipping();
        }
    };

    // ==============================================================================
    // CLIFF FALL: DETECTS CLIFF AND REDIRECTS LANDING TO THE OUTSIDE EDGE
    // ==============================================================================
    Game_CharacterBase.prototype.processCliffFallColliders = function() {
        if (!this._jumping) {
            this._isFallingCliff = false;
            this._cliffLandingTargetY = undefined;
            return;
        }

        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const charW = this.width ? this.width() : 1;
        const charH = this.height ? this.height() : 1;

        const currentZ = this.zPoint !== undefined ? this.zPoint : (this.zTier || 0);
        const launchZ = this._launchBaseZ !== undefined ? this._launchBaseZ : (this._baseZ || 0);

        const footX = (this._realX * tw) + ((charW * tw) / 2);
        const rawFootY = (this._realY * th) + (charH * th);
        const projFootY = ((this._realY * th) - (launchZ * th)) + (charH * th);

        const nearby = RK.CollisionMZ.SpatialPartition.getNearby(footX, Math.min(rawFootY, projFootY), 1, Math.abs(rawFootY - projFootY) + th);
        const EPSILON = 0.05;
        let activeCliff = null;

        for (let i = 0; i < nearby.length; i++) {
            const col = nearby[i];
            const isCliff = (col.isAirSlide || col.terrainId === 'slide');
            if (!isCliff) continue;

            const colBaseZ = col.zMin !== undefined ? Number(col.zMin) : Number(col.zTier || 0);
            const colTopZ  = col.zMax !== undefined ? Number(col.zMax) : (colBaseZ + 1.0);

            if (currentZ >= colBaseZ - EPSILON && currentZ <= colTopZ + 1.5) {
                if (footX >= col.x && footX <= col.x + col.w) {
                    const insideRaw = (rawFootY >= col.y && rawFootY <= col.y + col.h);
                    const insideProj = (projFootY >= col.y && projFootY <= col.y + col.h);
                    if (insideRaw || insideProj) {
                        activeCliff = col;
                        break;
                    }
                }
            }
        }

        // Trigger downward cliff slide
        if ((activeCliff && this._jumpVelocity > 0) || this._isFallingCliff) {
            if (activeCliff && !this._isFallingCliff) {
                this._isFallingCliff = true;

                // Trace downward through ALL contiguous/stacked cliff colliders early
                const chain = RK.CollisionMZ.Math.findLowestConnectedCliffEdge(footX, activeCliff);
                const targetFloor = chain.floorZ;
                this._targetFallFloorZ = targetFloor;

                // Calculate final landing location past the lowest cliff segment
                const outsideFootY = chain.bottomY + 12 + (targetFloor * th);
                this._cliffLandingTargetY = (outsideFootY / th) - charH;
            }

            // Smoothly pull character until fully past all connected colliders
            if (this._cliffLandingTargetY !== undefined && this._realY < this._cliffLandingTargetY) {
                const distY = this._cliffLandingTargetY - this._realY;
                const moveStep = Math.max(0.08, distY * 0.16);
                this._realY = Math.min(this._cliffLandingTargetY, this._realY + moveStep);
                this._y = Math.round(this._realY);

                if (this._mover && this._mover._targetPositionPoint) {
                    this._mover._targetPositionPoint.y = this._realY;
                }
            }
            return;
        }
    };

    const _Game_CharacterBase_update = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function() {
        _Game_CharacterBase_update.call(this);

        if (this._jumping) {
            this.processCliffFallColliders();
        } else if (this._realX !== this._prevClipX || this._realY !== this._prevClipY) {
            this._prevClipX = this._realX;
            this._prevClipY = this._realY;
            this.resolveAbsoluteColliderClipping();
        }
    };
}

// ==============================================================================
// 2. SPATIAL PARTITIONING (BROAD-PHASE COLLISION)
// ==============================================================================

RK.CollisionMZ.SpatialPartition = {
    chunkSize: 256,
    grid: new Map(),

    build: function(colliders) {
        this.grid.clear();
        if (!colliders) return;

        for (let i = 0; i < colliders.length; i++) {
            const col = colliders[i];
            
            const minCX = Math.floor(col.x / this.chunkSize);
            const maxCX = Math.floor((col.x + col.w) / this.chunkSize);
            const minCY = Math.floor(col.y / this.chunkSize);
            const maxCY = Math.floor((col.y + col.h) / this.chunkSize);

            for (let cx = minCX; cx <= maxCX; cx++) {
                for (let cy = minCY; cy <= maxCY; cy++) {
                    const key = `${cx},${cy}`;
                    if (!this.grid.has(key)) {
                        this.grid.set(key, []);
                    }
                    this.grid.get(key).push(col);
                }
            }
        }
    },

    getNearby: function(pixelX, pixelY, pixelW, pixelH) {
        const nearby = new Set();
        
        const minCX = Math.floor(pixelX / this.chunkSize);
        const maxCX = Math.floor((pixelX + pixelW) / this.chunkSize);
        const minCY = Math.floor(pixelY / this.chunkSize);
        const maxCY = Math.floor((pixelY + pixelH) / this.chunkSize);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                const key = `${cx},${cy}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        nearby.add(cell[i]);
                    }
                }
            }
        }
        return Array.from(nearby);
    }
};

// ==============================================================================
// 3. COLLISION DATA MANAGEMENT (JSON PARSER)
// ==============================================================================

RK.CollisionMZ.EnvironmentData = []; 

RK.CollisionMZ.loadMapCollisions = function(mapId) {
    RK.CollisionMZ.EnvironmentData = []; 
    const paddedId = mapId.toString().padStart(3, '0');
    const filePath = `data/Map_${paddedId}_Collision.json`;

    fetch(filePath)
        .then(response => {
            if (!response.ok) throw new Error("No custom collision file found.");
            return response.json();
        })
        .then(data => {
            if (data && data.colliders) {
                RK.CollisionMZ.EnvironmentData = data.colliders;
                RK.CollisionMZ.SpatialPartition.build(data.colliders);
                console.log(`[RK_CollisionMZ] Loaded ${data.colliders.length} hitboxes for Map ${paddedId}`);
            }
        })
        .catch(error => {
            console.warn(`[RK_CollisionMZ] ${error.message} (Map ${paddedId} is empty)`);
        });
};

const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
Scene_Map.prototype.onMapLoaded = function() {
    _Scene_Map_onMapLoaded.call(this);
    RK.CollisionMZ.loadMapCollisions($gameMap.mapId());
};

// ==============================================================================
// 4. DOWNWARD DROP & JUMP INTEGRATION
// ==============================================================================

Game_CharacterBase.prototype.startLedgeDrop = function(targetFloorZ) {
    if (this._jumping) return;
    this._jumping = true;
    this._launchBaseZ = this._baseZ !== undefined ? this._baseZ : 0;
    this._targetFallFloorZ = targetFloorZ !== undefined ? targetFloorZ : 0;
    this._jumpVelocity = 0;
    this._jumpGravity = 0.35;
    this._jumpY = 0;
};

const _Game_CharacterBase_updateJump = Game_CharacterBase.prototype.updateJump;
Game_CharacterBase.prototype.updateJump = function() {
    _Game_CharacterBase_updateJump.call(this);
};

// ==============================================================================
// 5. VISUAL DEBUGGER & CRUMBLE PLATFORM UPDATE
// ==============================================================================

Input.keyMapper[80] = 'rk_debug'; 

RK.CollisionMZ.toggleDebug = function() {
    $gameTemp._rkDebugCollision = !$gameTemp._rkDebugCollision;
    if (typeof SoundManager !== 'undefined' && SoundManager.playCursor) {
        SoundManager.playCursor();
    }
    const btn = document.getElementById('dock-btn-debug');
    if (btn) {
        btn.style.color = $gameTemp._rkDebugCollision ? 'var(--neon-teal)' : '#666';
        btn.style.borderColor = $gameTemp._rkDebugCollision ? 'var(--neon-teal)' : '#666';
    }
};

const _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);

    // Toggle debug display via hotkey P
    if (Input.isTriggered('rk_debug')) {
        RK.CollisionMZ.toggleDebug();
    }

    // Update Crumbling Platforms
    if ($gameMap && RK.CollisionMZ.EnvironmentData) {
        const colliders = RK.CollisionMZ.EnvironmentData;
        for (let i = 0; i < colliders.length; i++) {
            const col = colliders[i];
            if (col.terrainId !== 'crumble') continue;

            if (col._isStepped && !col._isCollapsed) {
                col._crumbleTimer = (col._crumbleTimer !== undefined ? col._crumbleTimer : 45) - 1;
                if (col._crumbleTimer <= 0) {
                    col._isCollapsed = true;
                    col._respawnTimer = 180;

                    const pZ = $gamePlayer.zPoint;
                    const surfaceZ = col.zStatic !== undefined ? col.zStatic : col.zTier;
                    if (Math.abs(pZ - surfaceZ) <= 0.25) {
                        $gamePlayer.startLedgeDrop(0);
                    }
                }
            }

            if (col._isCollapsed) {
                col._respawnTimer--;
                if (col._respawnTimer <= 0) {
                    col._isCollapsed = false;
                    col._isStepped = false;
                    col._crumbleTimer = 45;
                }
            }
        }
    }
};

// ------------------------------------------------------------------------------
// PIXI Debug Renderer
// ------------------------------------------------------------------------------
function Sprite_RKDebug() {
    this.initialize(...arguments);
}
Sprite_RKDebug.prototype = Object.create(Sprite.prototype);
Sprite_RKDebug.prototype.constructor = Sprite_RKDebug;

Sprite_RKDebug.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
    this._graphics = new PIXI.Graphics();
    this.addChild(this._graphics);

    this._labelContainer = new PIXI.Container();
    this.addChild(this._labelContainer);
    this._textPool = [];

    this._playerZText = new PIXI.Text('', {
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#66FCF1',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
    });
    this._playerZText.anchor.set(0.5, 1.0);
    this.addChild(this._playerZText);

    this.z = 10;
};

Sprite_RKDebug.prototype.getTextSprite = function(index) {
    if (!this._textPool[index]) {
        const text = new PIXI.Text('', {
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        });
        text.anchor.set(0, 0);
        this._textPool[index] = text;
        this._labelContainer.addChild(text);
    }
    this._textPool[index].visible = true;
    return this._textPool[index];
};

Sprite_RKDebug.prototype.update = function() {
    Sprite.prototype.update.call(this);
    this._graphics.clear();
    
    if ($gameTemp._rkDebugCollision) {
        if (this._labelContainer) this._labelContainer.visible = true;
        this.drawHitboxes();
    } else {
        if (this._playerZText) this._playerZText.visible = false;
        if (this._labelContainer) this._labelContainer.visible = false;
    }
};

Sprite_RKDebug.prototype.drawHitboxes = function() {
    const tw = $gameMap.tileWidth();
    const th = $gameMap.tileHeight();
    const scrollX_pixels = $gameMap.displayX() * tw;
    const scrollY_pixels = $gameMap.displayY() * th;

    for (let t of this._textPool) {
        t.visible = false;
    }

    if (RK.CollisionMZ.EnvironmentData && RK.CollisionMZ.EnvironmentData.length > 0) {
        let labelIndex = 0;

        for (let envObj of RK.CollisionMZ.EnvironmentData) {
            const drawX = envObj.x - scrollX_pixels;
            const drawY = envObj.y - scrollY_pixels;
            const drawW = envObj.w;
            const drawH = envObj.h;
            
            const playerZ = $gamePlayer && $gamePlayer.zTier !== undefined ? $gamePlayer.zTier : 0;
            const hexColor = RK.CollisionMZ.TerrainTypes[envObj.terrainId] || 0xFF003C;
            
            this._graphics.lineStyle(2, hexColor, envObj._isCollapsed ? 0.3 : 1);
            const fillAlpha = (envObj.zTier === playerZ) ? 0.4 : 0.1;
            this._graphics.beginFill(hexColor, envObj._isCollapsed ? 0.05 : fillAlpha);
            this._graphics.drawRect(drawX, drawY, drawW, drawH);
            this._graphics.endFill();

            if (drawX + drawW > 0 && drawX < Graphics.width && drawY + drawH > 0 && drawY < Graphics.height) {
                const label = this.getTextSprite(labelIndex++);
                const tierVal = envObj.zTier !== undefined ? envObj.zTier : 0;
                
                if (envObj.isBridge) {
                    label.text = `T${tierVal} Bridge [${envObj.zMin || tierVal}-${envObj.zMax || tierVal + 1}]`;
                    label.style.fill = '#00FFFF';
                } else if (envObj.isRamp) {
                    label.text = `T${tierVal} Ramp(${envObj.direction ? envObj.direction[0].toUpperCase() : ''})`;
                    label.style.fill = '#F2E300';
                } else {
                    label.text = `T${tierVal}`;
                    label.style.fill = (envObj.zTier === playerZ) ? '#66FCF1' : '#AAAAAA';
                }

                label.x = drawX + 3;
                label.y = drawY + 2;
            }
        }
    }

    if ($gamePlayer) {
        const currentZ = $gamePlayer.zPoint !== undefined ? $gamePlayer.zPoint : ($gamePlayer.zTier || 0);
        const zOffsetPixels = currentZ * th;

        const pX = ($gamePlayer._realX * tw) - scrollX_pixels;
        // Shift pY upward by zOffsetPixels and include jump offset
        const pY = (($gamePlayer._realY * th) - zOffsetPixels) + ($gamePlayer._jumpY || 0) - scrollY_pixels;
        const pW = $gamePlayer.width() * tw;
        const pH = $gamePlayer.height() * th;

        this._graphics.lineStyle(2, 0x00FF00, 1);
        this._graphics.beginFill(0x00FF00, 0.4);
        this._graphics.drawRect(pX, pY, pW, pH);
        this._graphics.endFill();

        if (this._playerZText) {
            const zPointVal = ($gamePlayer.zPoint !== undefined) ? $gamePlayer.zPoint.toFixed(2) : '0.00';
            const zTierVal = ($gamePlayer.zTier !== undefined) ? $gamePlayer.zTier : 0;
            const isAirborne = $gamePlayer._jumping ? ' [AIR]' : '';

            this._playerZText.text = `T${zTierVal} | Z: ${zPointVal}${isAirborne}`;
            this._playerZText.x = pX + (pW / 2);
            this._playerZText.y = pY - 8;
            this._playerZText.visible = true;
            this._playerZText.style.fill = $gamePlayer._jumping ? '#F2E300' : '#66FCF1';
        }
    } else {
        if (this._playerZText) this._playerZText.visible = false;
    }

    let rkEntities = [];
    if (typeof RK !== 'undefined' && RK.Battle) {
        if (RK.Battle.Skill && RK.Battle.Skill.player) {
            rkEntities.push(RK.Battle.Skill.player);
        }
        if (RK.Battle.Enemy && RK.Battle.Enemy.activeEnemies) {
            rkEntities = rkEntities.concat(RK.Battle.Enemy.activeEnemies);
        }
        if (RK.Battle.Core && RK.Battle.Core.activeObjects) {
            rkEntities = rkEntities.concat(RK.Battle.Core.activeObjects);
        }
    }

    for (let entity of rkEntities) {
        if (entity.physicsBox) {
            this.drawEntityBox(entity.physicsBox, 0x00AAFF, 0.2, scrollX_pixels, scrollY_pixels); 
        }
        const hBox = entity.hurtbox || entity.hurtBox;
        if (hBox) {
            this.drawEntityBox(hBox, 0xFF00FF, 0.2, scrollX_pixels, scrollY_pixels); 
        }
    }

    if (window.RK_IDE_Bridge) {
        const preview = window.RK_IDE_Bridge.getDragPreview();
        if (preview && preview.w > 0 && preview.h > 0) {
            this._graphics.lineStyle(2, 0xFF003C, 1);
            this._graphics.beginFill(0xFF003C, 0.45);
            this._graphics.drawRect(preview.x - scrollX_pixels, preview.y - scrollY_pixels, preview.w, preview.h);
            this._graphics.endFill();
        }

        const selected = window.RK_IDE_Bridge.getSelectedCollider();
        if (selected) {
            this._graphics.lineStyle(3, 0xF2E300, 1);
            this._graphics.beginFill(0xF2E300, 0.2);
            this._graphics.drawRect(selected.x - scrollX_pixels, selected.y - scrollY_pixels, selected.w, selected.h);
            this._graphics.endFill();
        }

        if (typeof window.RK_IDE_Bridge.getHoverPos === 'function') {
            const hover = window.RK_IDE_Bridge.getHoverPos();
            const tool = window.RK_IDE_Bridge.getActiveTool();
            const gridFree = window.RK_IDE_Bridge.getGridFree();

            let cursorX = hover.x;
            let cursorY = hover.y;

            if (!gridFree) {
                cursorX = Math.floor(hover.x / 48) * 48;
                cursorY = Math.floor(hover.y / 48) * 48;
            } else {
                cursorX = hover.x - 24;
                cursorY = hover.y - 24;
            }

            const drawX = cursorX - scrollX_pixels;
            const drawY = cursorY - scrollY_pixels;

            if (tool === 'erase_entity' || tool === 'erase_collision') {
                this._graphics.lineStyle(2, 0xFF003C, 0.9);
                this._graphics.beginFill(0xFF003C, 0.25);
                this._graphics.drawRect(drawX, drawY, 48, 48);
                this._graphics.endFill();
            } else if (tool === 'paint_entity') {
                this._graphics.lineStyle(2, 0xF2E300, 0.9);
                this._graphics.beginFill(0xF2E300, 0.25);
                this._graphics.drawRect(drawX, drawY, 48, 48);
                this._graphics.endFill();
            }
        }

        if (typeof window.RK_IDE_Bridge.getSelectedSceneObject === 'function') {
            const selObj = window.RK_IDE_Bridge.getSelectedSceneObject();
            if (selObj) {
                const boxW = (selObj.hurtbox && selObj.hurtbox.width) ? selObj.hurtbox.width : 48;
                const boxH = (selObj.hurtbox && selObj.hurtbox.height) ? selObj.hurtbox.height : 48;
                const drawX = (selObj.x - boxW / 2) - scrollX_pixels;
                const drawY = (selObj.y - boxH) - scrollY_pixels;

                this._graphics.lineStyle(3, 0xF2E300, 1.0);
                this._graphics.beginFill(0xF2E300, 0.35);
                this._graphics.drawRect(drawX, drawY, boxW, boxH);
                this._graphics.endFill();

                const originX = selObj.x - scrollX_pixels;
                const originY = selObj.y - scrollY_pixels;
                this._graphics.lineStyle(2, 0xFF003C, 1.0);
                this._graphics.moveTo(originX - 8, originY);
                this._graphics.lineTo(originX + 8, originY);
                this._graphics.moveTo(originX, originY - 8);
                this._graphics.lineTo(originX, originY + 8);
            }
        }

        if (RK.Battle && RK.Battle.Action && RK.Battle.Action.activeHitboxes) {
            for (const hb of RK.Battle.Action.activeHitboxes) {
                if (!hb.active) continue;
                if (hb.shape instanceof RK.Battle.Action.RK_AABB) {
                    this.drawEntityBox(hb.shape, 0xFF003C, 0.45, scrollX_pixels, scrollY_pixels); // Red box
                } else if (hb.shape instanceof RK.Battle.Action.RK_Circle) {
                    const drawX = hb.shape.x - scrollX_pixels;
                    const drawY = hb.shape.y - scrollY_pixels;
                    this._graphics.lineStyle(2, 0xFF003C, 0.9);
                    this._graphics.beginFill(0xFF003C, 0.35);
                    this._graphics.drawCircle(drawX, drawY, hb.shape.radius);
                    this._graphics.endFill();
                }
            }
        }
    }
};

Sprite_RKDebug.prototype.drawEntityBox = function(box, color, alpha, scrollX, scrollY) {
    const drawX = box.x - scrollX;
    const drawY = box.y - scrollY;
    this._graphics.lineStyle(2, color, 0.9);
    this._graphics.beginFill(color, alpha);
    this._graphics.drawRect(drawX, drawY, box.width, box.height);
    this._graphics.endFill();
};

// ==============================================================================
// 6. UNIFIED Z-POINT & Z-TIER MODEL
// ==============================================================================

Object.defineProperty(Game_CharacterBase.prototype, "zPoint", {
    get: function() {
        const baseZ = this._baseZ !== undefined ? this._baseZ : 0;
        const jumpBonus = (this._jumpY !== undefined && this._jumpY < 0) ? (Math.abs(this._jumpY) / 48.0) : 0;
        return baseZ + jumpBonus;
    },
    set: function(val) {
        this._baseZ = Number(val) || 0;
    },
    configurable: true
});

Object.defineProperty(Game_CharacterBase.prototype, "zTier", {
    get: function() {
        return Math.floor(this.zPoint);
    },
    set: function(val) {
        this._baseZ = Math.floor(Number(val) || 0);
    },
    configurable: true
});

const _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
Spriteset_Map.prototype.createCharacters = function() {
    _Spriteset_Map_createCharacters.call(this);
    this._rkDebugSprite = new Sprite_RKDebug();
    this._tilemap.addChild(this._rkDebugSprite);
};

// ==============================================================================
// 7. TERRAIN & GROUND STATE MACHINE
// ==============================================================================

const _Game_Player_initMembers_Terrain = Game_Player.prototype.initMembers;
Game_Player.prototype.initMembers = function() {
    _Game_Player_initMembers_Terrain.call(this);
    this._activeTerrain = 'wall';
    this._lastSafeSpot = { x: 0, y: 0 };
    this._lastTerrainX = -1;
    this._lastTerrainY = -1;
};

const _Game_Player_update = Game_Player.prototype.update;
Game_Player.prototype.update = function(sceneActive) {
    _Game_Player_update.call(this, sceneActive);
    
    if (this._realX !== this._lastTerrainX || this._realY !== this._lastTerrainY) {
        this._lastTerrainX = this._realX;
        this._lastTerrainY = this._realY;
        this.updateTerrainState();
    }
};

Game_Player.prototype.updateTerrainState = function() {
    if (this._jumping || this._isAirSliding) return;

    const tw = $gameMap.tileWidth();
    const th = $gameMap.tileHeight();
    const pW = this.width ? this.width() : 1;
    const pH = this.height ? this.height() : 1;
    
    // 1. Declare currentBase once at the top
    const currentBase = this._baseZ !== undefined ? this._baseZ : 0;
    const zOffsetPixels = currentBase * th;

    const centerX = (this._realX * tw) + ((pW * tw) / 2);
    const centerY = ((this._realY * th) - zOffsetPixels) + (pH * th);

    const nearby = RK.CollisionMZ.SpatialPartition.getNearby(centerX, centerY, 1, 1);
    
    let groundCollider = null;
    let highestSupportZ = -1;

    for (let i = 0; i < nearby.length; i++) {
        let envObj = nearby[i];

        if (centerX >= envObj.x && centerX <= envObj.x + envObj.w &&
            centerY >= envObj.y && centerY <= envObj.y + envObj.h) {
            
            if (envObj.terrainId === 'crumble' && envObj._isCollapsed) continue;
            if (envObj.terrainId === 'pitfall' || envObj.isHole) continue;
            
            // CLIFFS ARE NEVER WALKABLE FLOORS - DO NOT LAND ON THEM!
            if (envObj.terrainId === 'slide' || envObj.isAirSlide) continue;

            const surfaceZ = RK.CollisionMZ.Math.getZElevation(centerX, centerY, envObj);
            
            if (surfaceZ <= currentBase + 0.1) {
                if (surfaceZ > highestSupportZ) {
                    highestSupportZ = surfaceZ;
                    groundCollider = envObj;
                }
            }
        }
    }

    // --- MOVING PLATFORM CARRIER ---
    const activeObjects = (RK.Battle && RK.Battle.Core && RK.Battle.Core.activeObjects) 
        ? RK.Battle.Core.activeObjects 
        : ((RK.Battle && RK.Battle.ActiveObjects) ? RK.Battle.ActiveObjects : []);
    let platform = null;

    for (let i = 0; i < activeObjects.length; i++) {
        const obj = activeObjects[i];
        if (!obj.isPlatform) continue;

        const objX = obj._realX * tw;
        const objY = obj._realY * th;
        const objW = (obj.width ? obj.width() : 1) * tw;
        const objH = (obj.height ? obj.height() : 1) * th;

        if (centerX >= objX && centerX <= objX + objW &&
            centerY >= objY && centerY <= objY + objH) {
            
            const objZ = obj.zPoint !== undefined ? obj.zPoint : (obj.zTier || 0);
            if (Math.abs(this.zPoint - objZ) <= 0.25) {
                platform = obj;
                break;
            }
        }
    }

    if (platform && !this._jumping) {
        if (platform._prevX !== undefined && platform._prevY !== undefined) {
            const dx = platform._realX - platform._prevX;
            const dy = platform._realY - platform._prevY;
            this._realX += dx;
            this._realY += dy;
            this._x = Math.round(this._realX);
            this._y = Math.round(this._realY);
        }

        const platZ = platform.zPoint !== undefined ? platform.zPoint : (platform.zTier || 0);
        this._baseZ = platZ;
        this.zTier = Math.floor(platZ);
    }

    // --- STEPPING ON CRUMBLE SURFACE ---
    if (groundCollider && groundCollider.terrainId === 'crumble' && !groundCollider._isCollapsed) {
        groundCollider._isStepped = true;
    }

    // --- STEP-DOWN / LEDGE & HOLE DROP (NON-FLYING) ---
    // (Notice: do NOT re-declare 'const currentBase' here!)
    if (!this._jumping && !this.isFlying()) {
        if (groundCollider) {
            if (groundCollider.isRamp) {
                this._baseZ = highestSupportZ;
            } else {
                this._baseZ = groundCollider.zStatic !== undefined ? groundCollider.zStatic : groundCollider.zTier;
            }
            this.zTier = Math.floor(this._baseZ);
        } else if (currentBase > 0) {
            const targetDropZ = highestSupportZ >= 0 ? highestSupportZ : 0;
            this.startLedgeDrop(targetDropZ);
        } else {
            this._baseZ = 0;
            this.zTier = 0;
        }
    }

    const currentTerrain = groundCollider ? groundCollider.terrainId : 'default';
    if (this._activeTerrain !== currentTerrain) {
        this._activeTerrain = currentTerrain;
        this.onTerrainChange(currentTerrain);
    }

    if (currentTerrain !== 'pitfall') {
        this._lastSafeSpot = { x: this._realX, y: this._realY };
    }
};

// ==============================================================================
// 8. GIMMICK HANDLER
// ==============================================================================

Game_Player.prototype.onTerrainChange = function(newTerrain) {
    const baseMoveSpeed = $gameVariables.value(43) || 0.010;
    const baseMotionSpeed = $gameVariables.value(44) || 4;
    let moveMulti = 1.0;
    let motionMulti = 1.0;

    switch (newTerrain) {
        case 'water':
            moveMulti = 0.5;
            motionMulti = 0.75;
            break;
            
        case 'grass':
            moveMulti = 1.0;
            motionMulti = 1.0;
            break;
            
        case 'pitfall':
            this.locate(this._lastSafeSpot.x, this._lastSafeSpot.y);
            moveMulti = 1.0;
            motionMulti = 1.0;
            break;
            
        default:
            moveMulti = 1.0;
            motionMulti = 1.0;
            break;
    }
    $gameVariables.setValue(46, moveMulti);
    $gameVariables.setValue(47, motionMulti);
    this.setDpf(baseMoveSpeed * moveMulti);
    this.setMoveSpeed(baseMotionSpeed * motionMulti);
};

const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
Game_Player.prototype.performTransfer = function() {
    _Game_Player_performTransfer.call(this);
    this._baseZ = 0;
    this._launchBaseZ = 0;
    this._jumpY = 0;
    this._jumpVelocity = 0;
    this._jumping = false;
    this._targetFallFloorZ = undefined;
    this._lastBonkedCeiling = null;
    this.zTier = 0;
    this._cliffLandingTargetY = undefined;
    this._isFallingCliff = false;

    // Flush lingering combat hitboxes from the previous map:
    if (RK.Battle && RK.Battle.Action) {
        RK.Battle.Action.activeHitboxes = [];
    }
};