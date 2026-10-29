/*:
 * @target MZ
 * @plugindesc [v1.1] High-performance Visual Renderer combining PIXI, Hendrix Animation Solution & Directional Shadows.
 * @author Rizuki
 *
 * @help RK_Battle_Visuals.js
 * * Renders logic objects (Core) using Hendrix's _fX frame system.
 * * Automatically casts Hendrix-compatible directional shadows for PIXI entities.
 * * Requires RK_Battle_Core.js, RK_CollisionMZ.js, and Hendrix_Directional_Shadow.js
 */

var Imported = Imported || {};
Imported.RK_Battle_Visuals = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    if (!RK.Battle.Core) {
        console.error("RK_Battle_Visuals requires RK_Battle_Core!");
        return;
    }

    // =========================================================================
    // 1. HENDRIX TARGET PROXY
    // =========================================================================
    class RK_HendrixProxy {
        constructor(logicObject) {
            this.obj = logicObject;
            this._eventId = "RK_Custom_" + Math.random();
        }

        screenX() {
            const tw = $gameMap.tileWidth();
            return Math.round(this.obj.x - ($gameMap.displayX() * tw));
        }

        screenY() {
            const th = $gameMap.tileHeight();
            return Math.round(this.obj.y - ($gameMap.displayY() * th));
        }

        screenZ() { return 5; }
    }

    // =========================================================================
    // 2. ANIMATED SPRITE WRAPPER
    // =========================================================================
    class RK_AnimatedSprite extends PIXI.Sprite {
        constructor(imageName, cols = 1, rows = 1) {
            super();
            this.anchor.set(0.5, 1.0);
            
            const cleanName = imageName.replace(/\\/g, '/');
            this.imageName = cleanName;
            this.cols = cols;
            this.rows = rows;
            this.totalFrames = cols * rows;
            this.currentFrame = 0;
            this.frameTimer = 0;
            this.frameSpeed = 0.05;

            if (typeof PermanentImageCache !== 'undefined' && PermanentImageCache.load) {
                this.bitmap = PermanentImageCache.load('img/characters/', cleanName);
            } else {
                this.bitmap = ImageManager.loadCharacter(cleanName);
            }

            if (this.bitmap) {
                this.bitmap.addLoadListener(this.onLoad.bind(this));
            }
        }

        onLoad() {
            if (!this.bitmap || !this.bitmap.baseTexture) return;

            this.texture = new PIXI.Texture(this.bitmap.baseTexture);
            this.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            this.frameWidth = this.bitmap.width / this.cols;
            this.frameHeight = this.bitmap.height / this.rows;
            this.updateFrameRect();
        }

        updateFrameRect() {
            if (!this.frameWidth || !this.texture) return;
            const currentColumn = this.currentFrame % this.cols;
            const currentRow = Math.floor(this.currentFrame / this.cols);
            const x = currentColumn * this.frameWidth;
            const y = currentRow * this.frameHeight;
            this.texture.frame = new PIXI.Rectangle(x, y, this.frameWidth, this.frameHeight);
        }

        updateAnimation(dt) {
            if (this.totalFrames <= 1 || !this.frameWidth || !this.texture) return;
            this.frameTimer += dt;
            if (this.frameTimer >= this.frameSpeed) {
                this.frameTimer = 0;
                this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
                this.updateFrameRect();
            }
        }
    }

    // =========================================================================
    // 3. THE VISUAL MANAGER
    // =========================================================================
    class RK_VisualManager {
        constructor() {
            this.spriteMap = new Map();
            this.shadowMap = new Map();
            this.tierContainers = []; 

            RK.Battle.Events.on('OBJECT_SPAWNED', this.onSpawn.bind(this));
            RK.Battle.Events.on('ANIMATION_REQUESTED', (data) => {
                this.playVFX(data.target, data.action); 
            });
            RK.Battle.Events.on('OBJECT_DESTROYED', this.onDestroy.bind(this));
            RK.Battle.Events.on('CORE_UPDATE_TICK', this.update.bind(this));
        }

        setupContainer(spriteset) {
            this.tierContainers = [];
            for (let i = 0; i < 10; i++) {
                const cont = new PIXI.Container();
                cont.z = 4 + i; 
                if (spriteset._tilemap) spriteset._tilemap.addChild(cont);
                this.tierContainers.push(cont);
            }

            this.spriteMap.clear();
            this.shadowMap.clear();

            if (RK.Battle.Core && RK.Battle.Core.activeObjects) {
                for (const obj of RK.Battle.Core.activeObjects) {
                    this.onSpawn(obj);
                }
            }
        }

        onSpawn(obj) {
            if (this.tierContainers.length === 0) return;

            let spr;
            const template = obj.template || (RK.Battle.Templates ? RK.Battle.Templates[obj.id] : null);

            if (obj.imageName) {
                const cols = template && template.visuals ? template.visuals.cols : 1;
                const rows = template && template.visuals ? template.visuals.rows : 1;

                if (cols === 1 && rows === 1) {
                    spr = new PIXI.Sprite();
                    spr.anchor.set(0.5, 1.0);
                    const cleanName = obj.imageName.replace(/\\/g, '/');
                    
                    let bitmap;
                    if (typeof PermanentImageCache !== 'undefined' && PermanentImageCache.load) {
                        bitmap = PermanentImageCache.load('img/characters/', cleanName);
                    } else {
                        bitmap = ImageManager.loadCharacter(cleanName);
                    }

                    if (bitmap) {
                        bitmap.addLoadListener(() => {
                            if (bitmap.baseTexture) {
                                spr.texture = new PIXI.Texture(bitmap.baseTexture);
                                spr.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                            }
                        });
                    }
                } else {
                    spr = new RK_AnimatedSprite(obj.imageName, cols, rows);
                }
            } else {
                spr = new PIXI.Sprite(PIXI.Texture.WHITE);
                spr.alpha = 0.0; 
            }

            const initialTier = Math.max(0, Math.min(9, Math.floor(obj.zTier !== undefined ? obj.zTier : 0)));
            spr.currentTier = initialTier; 
            this.tierContainers[initialTier].addChild(spr);
            this.spriteMap.set(obj, spr);

            // --- Spawn Accompanying Directional Shadow ---
            const castsShadow = template && template.visuals && template.visuals.castShadow !== false;
            if (castsShadow && obj.imageName && ConfigManager.castShadow !== false) {
                const shadow = new PIXI.Sprite();
                shadow.anchor.set(0.5, 1.0);
                shadow.tint = 0x000000;
                shadow.alpha = 0.5;

                // Sync base texture with main sprite once loaded
                const checkTexture = () => {
                    if (spr.texture && spr.texture.baseTexture) {
                        shadow.texture = new PIXI.Texture(spr.texture.baseTexture);
                    } else {
                        setTimeout(checkTexture, 50);
                    }
                };
                checkTexture();

                shadow.currentTier = initialTier;
                this.tierContainers[initialTier].addChildAt(shadow, 0); // Placed at base of container
                this.shadowMap.set(obj, shadow);
            }
        }

        onDestroy(obj) {
            const spr = this.spriteMap.get(obj);
            if (spr) {
                if (spr.parent) spr.parent.removeChild(spr);
                spr.destroy();
                this.spriteMap.delete(obj);
            }
            const shadow = this.shadowMap.get(obj);
            if (shadow) {
                if (shadow.parent) shadow.parent.removeChild(shadow);
                shadow.destroy();
                this.shadowMap.delete(obj);
            }
        }

        update(dt) {
            if (this.tierContainers.length === 0 || !$gameMap) return;

            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            const dx = $gameMap.displayX() * tw;
            const dy = $gameMap.displayY() * th;

            // Fetch global parameters from Hendrix Directional Shadow
            const hParams = PluginManager.parameters("Hendrix_Directional_Shadow");
            const angleVarId = Number(hParams['angleVariableId'] || 0);
            const rawAngle = angleVarId > 0 ? $gameVariables.value(angleVarId) : Number(hParams['defaultAngle'] || 45);
            const normAngle = ((rawAngle % 360) + 360) % 360;
            const angleRad = normAngle * Math.PI / 180;
            const skewX = Math.tan(angleRad);
            const shadowLen = (Number(hParams['shadowLength'] || 100) / 100);
            const globalOffX = Number(hParams['offsetX'] || 0);
            const globalOffY = Number(hParams['offsetY'] || 0);

            for (const [obj, spr] of this.spriteMap.entries()) {
                const currentZ = obj.zPoint !== undefined ? obj.zPoint : (obj.zTier || 0);
                const targetTier = Math.max(0, Math.min(9, Math.floor(currentZ)));
                
                spr.zIndex = currentZ;

                // Move container tiers if elevated
                if (spr.currentTier !== targetTier) {
                    if (spr.parent) spr.parent.removeChild(spr);
                    this.tierContainers[targetTier].addChild(spr);
                    spr.currentTier = targetTier;
                }

                // Screen coordinates
                spr.x = obj.x - dx;
                spr.y = obj.y - dy;

                const baseScale = obj.scale !== undefined ? obj.scale : 1.0;

                if (obj.rotation !== undefined && obj.rotation !== 0) {
                    spr.rotation = (obj.rotation - 90) * (Math.PI / 180);
                    spr.scale.set(baseScale, baseScale);
                } else {
                    spr.rotation = 0;
                    if (obj.x < obj.lastX || obj.facing === 'left') {
                        spr.scale.set(-baseScale, baseScale);
                    } else if (obj.x > obj.lastX || obj.facing === 'right') {
                        spr.scale.set(baseScale, baseScale);
                    }
                }
                obj.lastX = obj.x;

                if (spr instanceof RK_AnimatedSprite) {
                    spr.updateAnimation(dt);
                }

                // --- Update Directional Shadow ---
                const shadow = this.shadowMap.get(obj);
                if (shadow) {
                    if (spr.texture && shadow.texture !== spr.texture) {
                        shadow.texture = spr.texture;
                    }

                    // 1. Raycast ground surface under entity
                    let groundZ = Math.floor(currentZ);
                    if (RK.CollisionMZ && RK.CollisionMZ.SpatialPartition) {
                        const nearby = RK.CollisionMZ.SpatialPartition.getNearby(obj.x, obj.y, 1, 1);
                        for (let i = 0; i < nearby.length; i++) {
                            const c = nearby[i];
                            if (c.isAirSlide || c.terrainId === 'slide') continue;
                            if (obj.x >= c.x && obj.x <= c.x + c.w && obj.y >= c.y && obj.y <= c.y + c.h) {
                                const surfZ = RK.CollisionMZ.Math.getZElevation(obj.x, obj.y, c);
                                if (surfZ <= currentZ + 0.1 && surfZ > groundZ) {
                                    groundZ = surfZ;
                                }
                            }
                        }
                    }

                    const groundTier = Math.max(0, Math.min(9, Math.floor(groundZ)));
                    if (shadow.currentTier !== groundTier) {
                        if (shadow.parent) shadow.parent.removeChild(shadow);
                        this.tierContainers[groundTier].addChildAt(shadow, 0);
                        shadow.currentTier = groundTier;
                    }

                    const surfaceDeltaPixels = (currentZ - groundZ) * 48.0;
                    shadow.x = (obj.x - dx) + globalOffX;
                    shadow.y = (obj.y - dy) + surfaceDeltaPixels + globalOffY;

                    shadow.skew.x = skewX;
                    shadow.scale.x = spr.scale.x;
                    shadow.scale.y = Math.abs(spr.scale.y) * shadowLen;
                    shadow.zIndex = groundZ - 0.05;

                    // Height altitude fade
                    const altitude = Math.max(0, currentZ - groundZ);
                    shadow.alpha = Math.max(0.1, 0.55 - (altitude * 0.2));
                }
            }
        }

        playVFX(logicObject, vfxName) {
            const targetProxy = new RK_HendrixProxy(logicObject);
            const bitmap = PermanentImageCache.load('img/pictures/', vfxName);

            bitmap.addLoadListener(() => {
                let framesCount = 1;
                const match = vfxName.match(/_f(\d+)$/);
                if (match) framesCount = parseInt(match[1]);

                const frames = AnimatedPictureManager.createSpritesheetFrames(bitmap, 1, framesCount);
                AnimatedPictureManager.showAnimatedPicture(
                    targetProxy._eventId, 
                    frames, 
                    60, 
                    targetProxy, 
                    1, 
                    0, 0, [], 100, 255, false, false, false, false, 0, 
                    PIXI.BLEND_MODES.NORMAL, 
                    8, 
                    false, 4, "#FFFFFF", 255, 0, false, "", false
                );
            });
        }
    }

    RK.Battle.Visuals = new RK_VisualManager();

    const _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        _Spriteset_Map_createLowerLayer.call(this);
        RK.Battle.Visuals.setupContainer(this);
    };
})();