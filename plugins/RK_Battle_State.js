/*:
 * @target MZ
 * @plugindesc [v1.0] High-performance Buff, Debuff, and DoT manager for RK Action Battle.
 * @author Rizuki
 *
 * @help RK_Battle_State.js
 * * Manages active status effects on players and enemies.
 * * Handles Damage-over-Time (Poison/Burn) and Stat Multipliers (Atk Up/Slow).
 * * Requires RK_Battle_Core.js.
 */

var Imported = Imported || {};
Imported.RK_Battle_State = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    if (!RK.Battle.Core) {
        console.error("RK_Battle_State requires RK_Battle_Core!");
        return;
    }

    // =========================================================================
    // 1. STATE DATABASE
    // =========================================================================
    RK.Battle.StateData = {
        'poison': {
            id: 'poison',
            type: 'dot',        // Damage over Time
            tickRate: 1.0,      // Deals damage every 1.0 seconds
            damagePerTick: 5,
            duration: 5.0       // Lasts 5 seconds (5 total ticks)
        },
        'burn': {
            id: 'burn',
            type: 'dot',
            tickRate: 0.5,      // Ticks twice a second
            damagePerTick: 8,
            duration: 3.0
        },
        'atk_up': {
            id: 'atk_up',
            type: 'stat',       // Stat Modifier
            stat: 'damage',
            multiplier: 1.5,    // +50% Damage
            duration: 10.0
        },
        'slow': {
            id: 'slow',
            type: 'stat',
            stat: 'speed',
            multiplier: 0.5,    // -50% Speed
            duration: 4.0
        }
    };


    // =========================================================================
    // 2. THE STATE INSTANCE
    // =========================================================================
    // Represents a specific buff/debuff currently on a target.
    class RK_ActiveState {
        constructor(stateId) {
            this.data = RK.Battle.StateData[stateId];
            this.timeLeft = this.data.duration;
            this.tickTimer = this.data.tickRate || 0;
            this.active = true;
        }

        update(dt, target) {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.active = false;
                return;
            }

            // Handle Damage-over-Time effects
            if (this.data.type === 'dot') {
                this.tickTimer -= dt;
                if (this.tickTimer <= 0) {
                    this.tickTimer = this.data.tickRate; // Reset tick timer
                    
                    // We don't reduce HP directly! We tell the Core that damage happened.
                    RK.Battle.Events.emit('DOT_DAMAGE_TICK', {
                        target: target,
                        damage: this.data.damagePerTick,
                        stateId: this.data.id
                    });
                }
            }
        }
    }


    // =========================================================================
    // 3. THE STATE MANAGER
    // =========================================================================
    class RK_StateManager {
        constructor() {
            // Keep a registry of who has what states
            // Map structure: target.id -> Array of RK_ActiveState
            this.entityStates = new Map();

            // Hook into the Core Update loop to process timers
            RK.Battle.Events.on('CORE_UPDATE_TICK', this.update.bind(this));

            // Hook into Hits to apply states (e.g., a poisoned sword)
            RK.Battle.Events.on('HIT_DETECTED', this.onHitDetected.bind(this));
        }

        // --- Core Logic ---

        addState(target, stateId) {
            if (!target || !target.id) return;
            if (!RK.Battle.StateData[stateId]) return;

            if (!this.entityStates.has(target.id)) {
                this.entityStates.set(target.id, []);
            }

            const activeList = this.entityStates.get(target.id);
            
            // Optional: Prevent stacking duplicate states. 
            // If they already have poison, just reset the duration.
            const existing = activeList.find(s => s.data.id === stateId);
            if (existing) {
                existing.timeLeft = existing.data.duration; // Refresh
                return;
            }

            activeList.push(new RK_ActiveState(stateId));
            console.log(`${target.id} was afflicted with ${stateId}`);
            RK.Battle.Events.emit('STATE_APPLIED', { target, stateId });
        }

        update(dt) {
            // Iterate through all entities that have active states
            for (const [targetId, states] of this.entityStates.entries()) {
                
                // You would typically pass the actual target object here, but since 
                // targetId is what we store, we just pass an object with the ID. 
                // (In a full engine, you'd fetch the actual enemy/player object from a registry)
                const targetRef = { id: targetId, team: targetId.includes('player') ? 'player' : 'enemy' };

                for (let i = states.length - 1; i >= 0; i--) {
                    const state = states[i];
                    state.update(dt, targetRef);

                    if (!state.active) {
                        states.splice(i, 1);
                        console.log(`${targetId} recovered from ${state.data.id}`);
                        RK.Battle.Events.emit('STATE_REMOVED', { targetRef, stateId: state.data.id });
                    }
                }

                // Cleanup empty arrays to save memory
                if (states.length === 0) {
                    this.entityStates.delete(targetId);
                }
            }
        }

        // --- Event Listeners ---

        onHitDetected(data) {
            // If the attack payload includes a state (e.g., payload: { damage: 10, applyState: 'poison' })
            if (data.payload && data.payload.applyState) {
                this.addState(data.target, data.payload.applyState);
            }
        }

        // --- Utility for other plugins ---

        // Other plugins call this to get dynamic stat calculation
        // e.g., const actualSpeed = RK.Battle.State.applyStatMultipliers(enemy, 'speed', baseSpeed);
        applyStatMultipliers(target, statName, baseValue) {
            if (!target || !target.id) return baseValue;
            if (!this.entityStates.has(target.id)) return baseValue;

            const states = this.entityStates.get(target.id);
            let finalValue = baseValue;

            for (const state of states) {
                if (state.data.type === 'stat' && state.data.stat === statName) {
                    finalValue *= state.data.multiplier;
                }
            }

            return finalValue;
        }
    }

    RK.Battle.State = new RK_StateManager();

})();