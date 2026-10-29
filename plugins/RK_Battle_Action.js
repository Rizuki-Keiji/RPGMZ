/*:
 * @target MZ
 * @plugindesc [v1.0] High-performance Hitbox and Collision engine for RK Action Battle.
 * @author Rizuki
 *
 * @help RK_Battle_Action.js
 * * Handles pure-math collision detection (AABB and Circles).
 * * Bypasses RPG Maker's grid system entirely for pixel-perfect accuracy.
 * * Requires RK_Battle_Core.js to be installed ABOVE this plugin.
 */

var Imported = Imported || {};
Imported.RK_Battle_Action = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    // Ensure Core exists
    if (!RK.Battle.Core) {
        console.error("RK_Battle_Action requires RK_Battle_Core to be loaded first!");
        return;
    }

    // =========================================================================
    // 1. GEOMETRY CLASSES (Pure Math)
    // =========================================================================
    
    // Axis-Aligned Bounding Box (Rectangles)
    class RK_AABB {
        constructor(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }

        // Extremely fast math to check if two rectangles overlap
        intersectsAABB(other) {
            return (
                this.x < other.x + other.width &&
                this.x + this.width > other.x &&
                this.y < other.y + other.height &&
                this.y + this.height > other.y
            );
        }
    }

    // Circles (Explosions, projectiles)
    class RK_Circle {
        constructor(x, y, radius) {
            this.x = x;
            this.y = y;
            this.radius = radius;
        }

        // Pythagorean theorem (squared to avoid expensive Math.sqrt calls)
        intersectsCircle(other) {
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const distanceSquared = (dx * dx) + (dy * dy);
            const radiusSum = this.radius + other.radius;
            return distanceSquared < (radiusSum * radiusSum);
        }
    }


    // =========================================================================
    // 2. THE HITBOX CLASS
    // =========================================================================
    // This is the actual object spawned when an attack happens.
    class RK_Hitbox {
        constructor(shape, owner, team, payload) {
            this.shape = shape;       
            this.owner = owner;       
            this.team = team;         
            this.payload = payload;   
            
            // 2.5D Float Range: default hitbox vertical thickness is 0.75 tiers (~36px)
            const center = payload.centerZ !== undefined ? payload.centerZ : (payload.centerTier !== undefined ? payload.centerTier : (owner.zPoint || 0));
            const thickness = payload.zThickness !== undefined ? payload.zThickness : 0.75;
            
            this.zMin = center - (thickness / 2);
            this.zMax = center + (thickness / 2);

            this.active = true;
            this.lifeTime = payload.lifeTime || 0.1; 
            this.alreadyHit = new Set(); 
        }

        update(dt) {
            this.lifeTime -= dt;
            if (this.lifeTime <= 0) {
                this.active = false; 
            }
        }
    }


    // =========================================================================
    // 3. THE ACTION MANAGER
    // =========================================================================
    // Manages all active hitboxes and checks them against targets (hurtboxes).
    class RK_ActionManager {
        constructor() {
            this.activeHitboxes = [];
            this.activeHurtboxes = []; // The bodies of the player and enemies
            
            // Listen to the Core's tick to run our physics frame
            RK.Battle.Events.on('CORE_UPDATE_TICK', this.update.bind(this));
        }

        // Called to create an attack on the map
        spawnHitbox(shape, owner, team, payload) {
            const hitbox = new RK_Hitbox(shape, owner, team, payload);
            this.activeHitboxes.push(hitbox);
            return hitbox;
        }

        // Register characters/enemies that can take damage
        registerHurtbox(targetObj) {
            this.activeHurtboxes.push(targetObj);
        }

        update(dt) {
            // 1. Update lifespans and remove dead hitboxes
            for (let i = this.activeHitboxes.length - 1; i >= 0; i--) {
                const hb = this.activeHitboxes[i];
                hb.update(dt);
                if (!hb.active) {
                    this.activeHitboxes.splice(i, 1);
                    continue;
                }

                // 2. Check for collisions against all registered hurtboxes
                this.checkCollisions(hb);
            }
        }

        checkCollisions(hitbox) {
            for (const target of this.activeHurtboxes) {
                // 1. Basic sanity checks
                if (hitbox.team === target.team) continue; // Default friendly-fire prevention
                if (hitbox.alreadyHit.has(target.id)) continue;

                // --- Target Tag Filtering ---
                // If the hitbox specifies valid target tags, enforce them!
                if (hitbox.payload.targetTags && hitbox.payload.targetTags.length > 0) {
                    const validTags = hitbox.payload.targetTags;
                    
                    // Does the target's Team match a tag? (e.g., 'enemy', 'player')
                    const matchesTeam = validTags.includes(target.team);
                    
                    // Do the target's States match a tag? (e.g., 'Breakable', 'Flying')
                    const matchesState = target.states && validTags.some(tag => target.states.has(tag));
                    
                    // If it doesn't match any allowed tags, skip the math entirely!
                    if (!matchesTeam && !matchesState) {
                        continue; 
                    }
                }
                // ---------------------------------

                const targetZ = target.zPoint !== undefined ? target.zPoint : (target.zTier || 0);

                // Vertical 2.5D slice test
                if (targetZ < hitbox.zMin || targetZ > hitbox.zMax) {
                    continue; 
                }

                // 2. Perform the actual Geometric check
                let isHit = false;
                
                if (hitbox.shape instanceof RK_AABB && target.hurtbox instanceof RK_AABB) {
                    isHit = hitbox.shape.intersectsAABB(target.hurtbox);
                } 
                else if (hitbox.shape instanceof RK_Circle && target.hurtbox instanceof RK_Circle) {
                    isHit = hitbox.shape.intersectsCircle(target.hurtbox);
                }

                if (isHit) {
                    hitbox.alreadyHit.add(target.id); 
                    
                    RK.Battle.Events.emit('HIT_DETECTED', {
                        attacker: hitbox.owner,
                        target: target,
                        payload: hitbox.payload
                    });
                }
            }
        }
    }

    // Instantiate the global Action Manager
    RK.Battle.Action = new RK_ActionManager();
    RK.Battle.Action.RK_AABB = RK_AABB;
    RK.Battle.Action.RK_Circle = RK_Circle;

})();