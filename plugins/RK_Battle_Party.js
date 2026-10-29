/*:
 * @target MZ
 * @plugindesc [v1.0] High-performance Tag-Team Party Manager for RK Action Battle.
 * @author Rizuki
 *
 * @help RK_Battle_Party.js
 * * Manages the active roster, character swapping, and team HP.
 * * Connects to RK_Battle_Skill to swap the active player controller data.
 * * Requires RK_Battle_Core.js.
 */

var Imported = Imported || {};
Imported.RK_Battle_Party = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    if (!RK.Battle.Core) {
        console.error("RK_Battle_Party requires RK_Battle_Core!");
        return;
    }

    // =========================================================================
    // 1. PARTY MEMBER DATA CLASS
    // =========================================================================
    // Stores the raw stats and skill loadouts for a single character.
    class RK_PartyMember {
        constructor(actorId, name, maxHp, speed, basicAttackId) {
            this.actorId = actorId;
            this.name = name;
            this.maxHp = maxHp;
            this.hp = maxHp;
            this.speed = speed;
            this.basicAttackId = basicAttackId; // e.g., 'attack_1' for sword, 'shoot_1' for gun
            this.isDead = false;
        }

        takeDamage(amount) {
            if (this.isDead) return;
            this.hp -= amount;
            if (this.hp <= 0) {
                this.hp = 0;
                this.isDead = true;
            }
        }
    }


    // =========================================================================
    // 2. THE PARTY MANAGER
    // =========================================================================
    class RK_PartyManager {
        constructor() {
            this.roster = [];
            this.activeIndex = 0;
            this.swapCooldown = 0; // Prevents spam-swapping every frame

            // Hook into the Core Update to listen for Swap Inputs
            RK.Battle.Events.on('CORE_UPDATE_TICK', this.update.bind(this));

            // Wait for map load to initialize the party from RPG Maker data
            RK.Battle.Events.on('MAP_INITIALIZED', this.initParty.bind(this));

            // Listen to Player Damage to update the background roster HP
            RK.Battle.Events.on('PLAYER_TOOK_DAMAGE', this.onPlayerDamaged.bind(this));
        }

        initParty() {
            this.roster = [];
            
            // In a full game, you would loop through $gameParty.members() here.
            // For this engine core, we will manually create a 3-character Chuunibyou-style squad:
            this.roster.push(new RK_PartyMember(1, "Dark Phantom", 500, 150, 'attack_1'));
            this.roster.push(new RK_PartyMember(2, "Crimson Mage", 300, 120, 'magic_1'));
            this.roster.push(new RK_PartyMember(3, "Steel Guardian", 800, 90, 'heavy_1'));

            this.activeIndex = 0;
            this.swapCooldown = 0;

            // Broadcast the initial active character so UI and Skill managers can load them
            this.broadcastActiveCharacter();
        }

        getActiveMember() {
            return this.roster[this.activeIndex];
        }

        update(dt) {
            if (this.swapCooldown > 0) {
                this.swapCooldown -= dt;
            } else {
                this.handleSwapInputs();
            }
        }

        handleSwapInputs() {
            // RPG Maker defaults: 'pagedown' (W/PageUp) and 'pageup' (Q/PageDown)
            if (Input.isTriggered('pagedown')) {
                this.swapCharacter(1); // Next character
            } else if (Input.isTriggered('pageup')) {
                this.swapCharacter(-1); // Previous character
            }
        }

        swapCharacter(direction) {
            let nextIndex = this.activeIndex + direction;

            // Wrap around logic (0 -> 2, 2 -> 0)
            if (nextIndex >= this.roster.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = this.roster.length - 1;

            const targetMember = this.roster[nextIndex];

            // Prevent swapping to a defeated character
            if (targetMember.isDead) {
                console.log(`${targetMember.name} is incapacitated!`);
                return;
            }

            this.activeIndex = nextIndex;
            this.swapCooldown = 0.5; // 0.5 second cooldown before you can swap again

            console.log(`Swapped to: ${targetMember.name}`);
            
            // Trigger visual effects for swapping (like a flash or particle burst)
            this.broadcastActiveCharacter();
        }

        broadcastActiveCharacter() {
            const active = this.getActiveMember();
            
            // Tell the Engine that a swap happened. 
            // The Skill plugin will catch this and update the player's attack buttons!
            RK.Battle.Events.emit('PARTY_CHARACTER_SWAPPED', active);
        }

        onPlayerDamaged(damage) {
            const active = this.getActiveMember();
            active.takeDamage(damage);
            
            console.log(`${active.name} HP: ${active.hp}/${active.maxHp}`);

            if (active.isDead) {
                console.log(`${active.name} has fallen!`);
                RK.Battle.Events.emit('PLAYER_DIED', active);
                // Optional: Auto-swap to the next living character here
                this.autoSwapOnDeath();
            }
        }

        autoSwapOnDeath() {
            const aliveIndex = this.roster.findIndex(m => !m.isDead);
            if (aliveIndex !== -1) {
                this.activeIndex = aliveIndex;
                this.broadcastActiveCharacter();
            } else {
                console.log("GAME OVER. Entire party is defeated.");
                RK.Battle.Events.emit('GAME_OVER');
            }
        }
    }

    RK.Battle.Party = new RK_PartyManager();

})();