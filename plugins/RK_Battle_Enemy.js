/*:
 * @target MZ
 * @plugindesc [v1.0] High-performance Enemy AI and State Machine for RK Action Battle.
 * @author Rizuki
 *
 * @help RK_Battle_Enemy.js
 * * Manages enemy data, AI states, and HP.
 * * Connects to RK_Battle_Action to register hurtboxes.
 * * Requires RK_Battle_Core.js and RK_Battle_Action.js.
 */

var Imported = Imported || {};
Imported.RK_Battle_Enemy = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    // Ensure dependencies exist
    if (!RK.Battle.Core || !RK.Battle.Action) {
        console.error("RK_Battle_Enemy requires Core and Action plugins!");
        return;
    }

    // =========================================================================
    // 1. THE ENEMY CLASS (Data & State Machine)
    // =========================================================================
    class RK_Enemy extends RK.Battle.Entity {
        constructor(id, x, y, zTier, maxHp, speed) {
            super('enemy_' + id, 'enemy', x, y, {
                visuals: { zTier: zTier },
                logic: {
                    speed: speed,
                    physicsBox: { w: 24, h: 16 },
                    hurtBox: { w: 32, h: 32 },
                    hasMapPhysics: true,
                    hasCombatPhysics: true
                }
            });
            
            this.invincibilityTimer = 0;
            this.maxHp = maxHp;
            this.hp = maxHp;
            this.isDead = false;
            this.currentState = 'IDLE'; 
            this.stateTimer = 0; 
        }

        // The AI Brain - Runs every frame
        update(dt) {
            // Map Event Bridge (Map to Logic Sync)
            if (this.mapEventId && $gameMap && $gameMap.event(this.mapEventId)) {
                const mapEvent = $gameMap.event(this.mapEventId);
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();

                if (this.hasMapPhysics) {
                    RK.Battle.Physics.syncToDotMove(this, mapEvent);
                }

                this.x = mapEvent.centerRealX() * tw;
                this.y = mapEvent.centerRealY() * th;

                this._baseZ = mapEvent._baseZ !== undefined ? mapEvent._baseZ : (mapEvent.zTier || 0);
                this._jumpY = mapEvent._jumpY || 0;
            }

            // Physics & Hurtbox Sync
            if (this.hurtbox) {
                const mapEvent = (this.mapEventId && $gameMap) ? $gameMap.event(this.mapEventId) : null;
                const visualOffsetY = (mapEvent && mapEvent._jumpY) ? mapEvent._jumpY : 0;
                this.syncBoxes(visualOffsetY);
            }

            // State Machine & AI Timers
            if (this.stateTimer > 0) {
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) {
                    this.currentState = 'IDLE';
                }
            }
        }

        // --- State Behaviors ---

        updateIdle(dt) {
            // Example: Wait for 2 seconds, then chase
            this.stateTimer += dt;
            if (this.stateTimer > 2.0) {
                this.changeState('CHASE');
            }
        }

        updateChase(dt) {
            // Logic to move towards the player would go here.
            // For now, we simulate moving left.
            this.x -= this.speed * dt; 
            
            // Example transition: If close enough, attack
            // if (distanceToPlayer < 50) this.changeState('ATTACK');
        }

        updateAttack(dt) {
            // Spawn a hitbox using RK_Battle_Action, play an animation, etc.
            this.changeState('IDLE'); // Reset to idle after attacking
        }

        updateStunned(dt) {
            // Enemy is frozen because they got hit
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.changeState('CHASE');
            }
        }

        changeState(newState) {
            this.currentState = newState;
            this.stateTimer = 0; // Reset timer for the new state
        }

        // --- Taking Damage ---
        
        takeDamage(amount, attacker = null, tags = []) {
            if (this.isDead || this.invincibilityTimer > 0) return;

            // 1. Build the Mutable Payload
            let damageEvent = {
                originalAmount: amount,
                finalAmount: amount,
                tags: tags,
                isBlocked: false,
                attacker: attacker
            };

            // 2. Create the execution context for the Interpreter
            // We expose 'self' so scripts can modify the enemy (e.g., self.hp)
            let executionContext = {
                self: this, 
                damageEvent: damageEvent
            };

            // 3. Trigger all passive defensive Gimmicks (States)
            if (this.states) {
                this.states.forEach(stateId => {
                    const gimmick = RK.Battle.Gimmicks[stateId];
                    // Only run gimmicks specifically flagged to trigger on damage
                    if (gimmick && gimmick.trigger === 'onDamageTaken') {
                        RK.Battle.Interpreter.executeSequence(stateId, executionContext);
                    }
                });
            }

            // 4. Evaluate Results from the Gimmick
            if (damageEvent.isBlocked) {
                console.log(`${this.id} completely blocked the attack!`);
                // Optional: Play a block/deflect animation here
                return;
            }

            // 5. Apply the final calculated damage
            this.hp -= damageEvent.finalAmount;
            console.log(`${this.id} took ${damageEvent.finalAmount} damage! HP: ${this.hp}/${this.maxHp}`);

            if (this.hp <= 0) {
                this.die();
            } else {
                this.changeState('STUNNED');
                this.stateTimer = 0.08; 
                this.invincibilityTimer = 0.1;
            }
        }

        die() {
            this.isDead = true;
            console.log(`${this.id} has been defeated!`);
            RK.Battle.Events.emit('ENEMY_DIED', this);
        }
    }


    // =========================================================================
    // 2. THE ENEMY MANAGER
    // =========================================================================
    class RK_EnemyManager {
        constructor() {
            this.activeEnemies = [];

            // Hook into the Core tick to run AI updates
            RK.Battle.Events.on('CORE_UPDATE_TICK', this.update.bind(this));

            // THE OBSERVER PATTERN IN ACTION:
            // Listen for any hits detected by the Physics Engine
            RK.Battle.Events.on('HIT_DETECTED', this.onHitDetected.bind(this));
        }

        spawnEnemy(id, x, y, zTier, maxHp, speed) {
            const enemy = new RK_Enemy(id, x, y, zTier, maxHp, speed);
            this.activeEnemies.push(enemy);
            
            RK.Battle.Action.registerHurtbox(enemy); 
            return enemy;
        }

        update(dt) {
            for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
                const enemy = this.activeEnemies[i];
                if (enemy.isDead) {
                    this.activeEnemies.splice(i, 1);
                } else {
                    enemy.update(dt);
                }
            }
        }

        onHitDetected(data) {
            // We only care if the target was an enemy
            if (data.target.team !== 'enemy') return;

            const enemy = data.target;
            const payload = data.payload || {};
            
            const baseDamage = payload.damage || 1; 
            const tags = payload.tags || []; // e.g., ["Fire", "Physical"]
            const attacker = data.attacker;

            // Pass the full context into the new takeDamage pipeline
            enemy.takeDamage(baseDamage, attacker, tags);
        }
    }

    // Instantiate the global Enemy Manager
    RK.Battle.Enemy = new RK_EnemyManager();

})();