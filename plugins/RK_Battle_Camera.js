/*:
 * @target MZ
 * @plugindesc [v1.0] Smooth Follow, Look-Ahead, and Screen Shake Camera for RK Action Battle.
 * @author Rizuki
 *
 * @help RK_Battle_Camera.js
 * * Bypasses MZ's default grid-locked camera.
 * * Centers on the active party member and "leads" their movement.
 * * Adds screen shake on heavy impacts.
 * * Requires RK_Battle_Core.js and RK_Battle_Party.js.
 */

var Imported = Imported || {};
Imported.RK_Battle_Camera = true;

var RK = RK || {};
RK.Battle = RK.Battle || {};

(() => {
    "use strict";

    if (!RK.Battle.Core) {
        console.error("RK_Battle_Camera requires RK_Battle_Core!");
        return;
    }

    // =========================================================================
    // 1. DISABLE MZ'S DEFAULT CAMERA
    // =========================================================================
    // We must stop the default Game_Player from fighting our custom camera math.
    const _Game_Player_updateScroll = Game_Player.prototype.updateScroll;
    Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
        // If our custom combat engine is active, do nothing!
        if (RK.Battle.Core.isInitialized) {
            return; 
        }
        // Otherwise, use the normal MZ camera (for towns, cutscenes, etc.)
        _Game_Player_updateScroll.call(this, lastScrolledX, lastScrolledY);
    };


    // =========================================================================
    // 2. THE CAMERA MANAGER
    // =========================================================================
    class RK_CameraManager {
        constructor() {
            // Camera's actual pixel coordinates
            this.x = 0; 
            this.y = 0;

            // Tuning Parameters
            this.lookAheadDistance = 120; // How many pixels the camera pushes forward
            this.smoothing = 4.0;         // How fast the camera glides to the target (lower = smoother/floatier)

            // Screen Shake variables
            this.shakeTimer = 0;
            this.shakePower = 0;

            // Hooks
            RK.Battle.Events.on('MAP_INITIALIZED', this.initMap.bind(this));
            RK.Battle.Events.on('CORE_UPDATE_TICK', this.update.bind(this));
            RK.Battle.Events.on('HIT_DETECTED', this.onHitDetected.bind(this));
        }

        initMap() {
            // Instantly snap the camera to the player when the map loads so it doesn't pan across the screen
            const activePlayer = RK.Battle.Party ? RK.Battle.Party.getActiveMember() : null;
            
            // Assuming RK.Battle.Skill.player holds the physical X/Y 
            // (If you modularized it differently, pull the X/Y from your player logic object)
            if (RK.Battle.Skill && RK.Battle.Skill.player) {
                this.x = RK.Battle.Skill.player.x;
                this.y = RK.Battle.Skill.player.y;
            }
        }

        update(dt) {
            if (!$gameMap || !RK.Battle.Skill || !RK.Battle.Skill.player) return;

            const player = RK.Battle.Skill.player;

            // 1. Calculate the Base Target (Player's current position)
            let targetX = player.x;
            let targetY = player.y;

            // 2. Calculate the Look-Ahead Vector
            // We use the input buffer to see where the player wants to go
            let dirX = 0;
            let dirY = 0;

            if (RK.Battle.Core.Input.isPressed('right')) dirX = 1;
            if (RK.Battle.Core.Input.isPressed('left')) dirX = -1;
            if (RK.Battle.Core.Input.isPressed('down')) dirY = 1;
            if (RK.Battle.Core.Input.isPressed('up')) dirY = -1;

            // Push the target forward in that direction
            targetX += dirX * this.lookAheadDistance;
            targetY += dirY * this.lookAheadDistance;

            // 3. Smoothly Glide (Lerp) the camera toward the target
            // Linear Interpolation: current = current + (target - current) * speed * time
            this.x += (targetX - this.x) * this.smoothing * dt;
            this.y += (targetY - this.y) * this.smoothing * dt;

            // 4. Apply Screen Shake
            let renderX = this.x;
            let renderY = this.y;

            if (this.shakeTimer > 0) {
                this.shakeTimer -= dt;
                // Add random pixel offsets based on the shake power
                renderX += (Math.random() - 0.5) * 2 * this.shakePower;
                renderY += (Math.random() - 0.5) * 2 * this.shakePower;
            }

            // 5. Tell RPG Maker to draw the screen here
            this.applyToEngine(renderX, renderY);
        }

        applyToEngine(renderX, renderY) {
            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            
            // MZ expects the display position to be the TOP-LEFT corner of the screen in TILES.
            // So we take our pixel coordinates, convert to tiles, and subtract half the screen size.
            const screenTilesX = Graphics.width / tw;
            const screenTilesY = Graphics.height / th;

            const mapTargetX = (renderX / tw) - (screenTilesX / 2);
            const mapTargetY = (renderY / th) - (screenTilesY / 2);

            // $gameMap.setDisplayPos automatically handles clamping to map edges!
            $gameMap.setDisplayPos(mapTargetX, mapTargetY);
        }

        triggerShake(power, duration) {
            this.shakePower = power;
            this.shakeTimer = duration;
        }

        onHitDetected(data) {
            // Only shake the screen on heavy attacks (e.g., damage > 20)
            const damage = data.payload.damage || 0;
            if (damage >= 20) {
                this.triggerShake(10, 0.15); // Shake 10 pixels wide for 0.15 seconds
            } else if (damage > 0) {
                this.triggerShake(3, 0.05);  // Tiny micro-shake for light attacks
            }
        }
    }

    RK.Battle.Camera = new RK_CameraManager();

})();