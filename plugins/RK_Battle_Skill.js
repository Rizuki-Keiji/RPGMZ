/*:
 * @target MZ
 * @plugindesc [v1.0] Player Controller, Input Buffering, and Combo System for RK Action Battle.
 * @author Rizuki
 *
 * @help RK_Battle_Skill.js
 * * Manages player inputs, action states, and combo chains.
 * * Connects to RK_Battle_Action to spawn player hitboxes.
 * * Requires RK_Battle_Core.js and RK_Battle_Action.js.
 */

var Imported = Imported || {};
Imported.RK_Battle_Skill = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    if (!RK.Battle.Core || !RK.Battle.Action) {
        console.error("RK_Battle_Skill requires Core and Action plugins!");
        return;
    }

    // =========================================================================
    // 1. SKILL & COMBO DATABASE
    // =========================================================================
    // Deleted, and depends on RK_ComboSystemMZ



    // =========================================================================
    // 2. THE PLAYER CONTROLLER (FSM & Logic)
    // =========================================================================
    class RK_PlayerController extends RK.Battle.Entity {
        constructor() {
            // Pass standard properties to the base class
            super('player_1', 'player', 0, 0, {
                logic: {
                    physicsBox: { w: 24, h: 16 },
                    hurtBox: { w: 32, h: 48 }, // Taller for the player sprite
                    hasMapPhysics: true,
                    hasCombatPhysics: true
                }
            });

            this.invincibilityTimer = 0;
            this.currentState = 'IDLE';
            this.stateTimer = 0;
            this.currentAttackId = null;
            this.inputBuffer = null;
            this.bufferTimer = 0;
        }

        // Called when the map loads to set initial position
        init(startX, startY, startTier = 0) {
            this.x = startX;
            this.y = startY;
            this.zTier = startTier;
            this.changeState('IDLE');
            RK.Battle.Action.registerHurtbox(this);
        }

        update(dt) {
            // Defensive Timers
            if (this.invincibilityTimer > 0) {
                this.invincibilityTimer -= dt;
            }
            if (this.perfectDodgeTimer > 0) {
                this.perfectDodgeTimer -= dt;
            }

            // The DotMoveSystem Bridge
            if ($gamePlayer && $gameMap) {
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();

                if (this.hasMapPhysics) {
                    RK.Battle.Physics.syncToDotMove(this, $gamePlayer);
                }

                this.x = $gamePlayer.centerRealX() * tw;
                this.y = $gamePlayer.centerRealY() * th;
                
                // Sync true continuous ground elevation + jump physics
                this._baseZ = $gamePlayer._baseZ !== undefined ? $gamePlayer._baseZ : ($gamePlayer.zTier || 0);
                this._jumpY = $gamePlayer._jumpY || 0;
            }

            if (this.hurtbox) {
                const visualOffsetY = ($gamePlayer && $gamePlayer._jumpY) ? $gamePlayer._jumpY : 0;
                this.syncBoxes(visualOffsetY);
            }

            // State Machine Timers
            if (this.stateTimer > 0) {
                this.stateTimer -= dt;
                
                if (this.stateTimer <= 0) {
                    // When the dodge/attack finishes, reset defensive states too
                    this.perfectDodgeTimer = 0; 
                    this.changeState('IDLE');
                }
            }

            // Input Buffering Logic
            if (this.bufferTimer > 0) {
                this.bufferTimer -= dt;
                if (this.bufferTimer <= 0) {
                    this.inputBuffer = null;
                }
            }
            if (Input.isTriggered('dodge')) { 
                if (this.currentState !== 'STUNNED' && !this.isDead) {
                    
                    const leader = $gameParty.leader();
                    if (leader && $gameSystem._rkComboRuntime) {
                        const rt = $gameSystem._rkComboRuntime[leader.actorId()];
                        if (rt) {
                            rt.presetId = 0;
                            rt.currentNodeId = 0;
                            rt.timer = 0;
                        }
                    }

                    RK.Battle.Events.emit('SPAWN_REQUESTED', {
                        objectId: 'OBJ_PlayerDodge', 
                        source: $gamePlayer,
                        spawnInFront: 0
                    });
                }
            }
        }

        handleInputs(dt) {
            // Decrease the buffer timer if an input is queued
            if (this.bufferTimer > 0) {
                this.bufferTimer -= dt;
                if (this.bufferTimer <= 0) this.inputBuffer = null;
            }
        }

        // --- State Behaviors ---

        updateIdle(dt) {
            // In Idle, we instantly consume an attack input if it exists
            if (this.inputBuffer === 'attack') {
                this.inputBuffer = null;
                this.executeAttack('attack_1'); // Start the combo chain
            } else {
                // Here you would normally update this.x and this.y based on Directional Input
                // (e.g., if Input.isPressed('right') this.x += speed * dt)
            }
        }

        updateAttacking(dt) {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.changeState('IDLE');
                this.currentAttackId = null;
            }
        }

        updateStunned(dt) {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.changeState('IDLE');
            }
        }

        // --- Core Actions ---

        executeAttack(attackId) {
            const template = RK.Battle.Templates[attackId];
            if (!template) return;

            this.changeState('ATTACKING');
            this.currentAttackId = attackId;
            this.stateTimer = (template.logic && template.logic.lifespan) ? template.logic.lifespan : 0.5;
        }

        changeState(newState) {
            this.currentState = newState;
            
            // Wipe the buffer so if you get stunned while mashing, 
            // you don't accidentally attack when you recover.
            this.inputBuffer = null; 
            
            if (newState === 'IDLE') {
                this.stateTimer = 0;
                // Optional: Restore DotMove speed here if you slowed them down while attacking
            }
        }

        // 2. The Dodge Interrupt
        tryDodge() {
            // Can't dodge if dead or stunned
            if (this.currentState === 'STUNNED' || this.isDead) return;

            // This OVERWRITES the 'ATTACKING' state, instantly breaking the lock!
            this.changeState('DODGING');
            this.stateTimer = 0.4; // 0.4 seconds of dodge roll
            this.invincibilityTimer = 0.4; // i-frames
            
            // Add a burst of speed in the current direction using your speed variables
            console.log("Player Dodged!");
        }

        // 3. The Damage Interrupt
        takeDamage(amount, attacker) { 
            if (this.currentState === 'DODGING' && this.perfectDodgeTimer > 0) {
                console.log("PERFECT DODGE TRIGGERED!");
                RK.Battle.Events.emit('PERFECT_DODGE', { target: this, attacker: attacker }); 
                return;
            }

            // 2. Check for standard i-frames
            if (this.invincibilityTimer > 0) {
                console.log("Dodged the attack.");
                return; 
            }

            // This OVERWRITES the 'ATTACKING' state, instantly breaking the lock!
            this.changeState('STUNNED');
            this.stateTimer = 0.3; // 0.3 seconds of hit-stun flinch
            this.invincibilityTimer = 0.4;
            
            console.log(`Player took ${amount} damage! Flinching!`);
            // You can trigger your DotMove knockback scripts here
        }

        // Called via Gimmick Script: self.activateDodgeState(totalDuration, perfectWindow)
        activateDodgeState(duration, perfectWindow) {
            if (this.currentState === 'STUNNED' || this.isDead) return;

            this.changeState('DODGING');
            this.stateTimer = duration; 
            
            // Standard i-frames last the whole dodge
            this.invincibilityTimer = duration; 
            
            // Perfect dodge window is usually a fraction of the animation (e.g., first 0.15s)
            this.perfectDodgeTimer = perfectWindow; 
        }
    }


    // =========================================================================
    // 3. THE MANAGER BRIDGE
    // =========================================================================
    class RK_SkillManager {
        constructor() {
            this.player = new RK_PlayerController();

            // Hook into the Core tick to update player logic
            RK.Battle.Events.on('CORE_UPDATE_TICK', this.player.update.bind(this.player));

            // Wait for map load to initialize player position
            RK.Battle.Events.on('MAP_INITIALIZED', () => {
                // Start player at some coordinates (Normally, you'd pull this from $gamePlayer)
                this.player.init(200, 200);
            });

            // Listen for damage
            RK.Battle.Events.on('HIT_DETECTED', this.onHitDetected.bind(this));
        }

        onHitDetected(data) {
            // Only care if the player was hit
            if (data.target.team !== 'player') return;
            const damage = data.payload.damage || 1;
            this.player.takeDamage(damage, data.attacker);
        }
    }

    RK.Battle.Skill = new RK_SkillManager();

    // ============================================================================
    // ENGINE OVERRIDES: Movement Lock
    // ============================================================================
    const _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        // 1. Check if our custom RK Battle Engine is running and the player exists
        if (RK && RK.Battle && RK.Battle.Skill && RK.Battle.Skill.player) {
            
            // 2. If the player is NOT in IDLE (e.g., ATTACKING, DODGING, STUNNED)
            if (RK.Battle.Skill.player.currentState !== 'IDLE') {
                return false; // Instantly lock all directional input!
            }
        }
        
        // 3. Otherwise, run the normal RPG Maker / DotMove checks
        return _Game_Player_canMove.call(this);
    };

})();