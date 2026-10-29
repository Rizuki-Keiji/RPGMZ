/*:
 * @target MZ
 * @plugindesc Non-blocking / Blocking Bubble Chat pinned to events, the player, or coordinates.
 * @author Rizuki Keiji
 * @help
 * ============================================================================
 * Bubble Chat for RPG Maker MZ
 * ============================================================================
 * 
 * @command showBubble
 * @text Show Bubble
 * @desc Displays a floating speech bubble above a character or position.
 * 
 * @arg targetType
 * @text Target Type
 * @type select
 * @option Player
 * @value player
 * @option Event
 * @value event
 * @option Coordinates
 * @value coordinates
 * @default player
 * 
 * @arg eventId
 * @text Event ID
 * @desc Used when Target Type is "Event" (0 = this event).
 * @type number
 * @default 0
 * 
 * @arg x
 * @text Map X
 * @desc Tile X (only for Coordinates target).
 * @type number
 * @default 0
 * 
 * @arg y
 * @text Map Y
 * @desc Tile Y (only for Coordinates target).
 * @type number
 * @default 0
 * 
 * @arg text
 * @text Message
 * @type multiline_string
 * @default Hello!
 * 
 * @arg duration
 * @text Duration (Frames)
 * @desc 60 frames = 1 second. 0 = stays until clicked or confirmed.
 * @type number
 * @default 180
 * 
 * @arg confirmButton
 * @text Confirm Button (Pause Game)
 * @type boolean
 * @desc If true, freezes movement and requires OK / Cancel / Touch to dismiss.
 * @default false
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "RK_BubbleChat";

    //-------------------------------------------------------------------------
    // Plugin Command Registration
    //-------------------------------------------------------------------------
    PluginManager.registerCommand(PLUGIN_NAME, "showBubble", function (args) {
        let target = null;
        const targetType = String(args.targetType).toLowerCase();

        if (targetType === "player") {
            target = $gamePlayer;
        } else if (targetType === "event") {
            const evId = Number(args.eventId);
            const actualId = evId === 0 ? this.eventId() : evId;
            target = $gameMap.event(actualId);
        } else if (targetType === "coordinates") {
            target = { _realX: Number(args.x), _realY: Number(args.y) };
        }

        if (target) {
            $gameScreen.showBubble(target, String(args.text), {
                duration: Number(args.duration !== undefined ? args.duration : 180),
                confirmButton: String(args.confirmButton) === "true"
            });
        }
    });

    //-------------------------------------------------------------------------
    // Game_Screen Extension
    //-------------------------------------------------------------------------
    const _Game_Screen_initialize = Game_Screen.prototype.initialize;
    Game_Screen.prototype.initialize = function () {
        _Game_Screen_initialize.call(this);
        this._activeBubbles = [];
    };

    Game_Screen.prototype.showBubble = function (target, text, options = {}) {
        if (!this._activeBubbles) this._activeBubbles = [];
        const bubbleData = {
            id: Date.now() + Math.random(),
            target: target,
            text: text,
            duration: options.duration !== undefined ? options.duration : 180,
            confirmButton: !!options.confirmButton,
            fontSize: options.fontSize || 20,
            textColor: options.textColor || "#ffffff",
            bgColor: options.bgColor || "rgba(20, 20, 25, 0.85)",
            borderColor: options.borderColor || "rgba(255, 255, 255, 0.9)",
            padding: options.padding || 10,
            dead: false
        };
        this._activeBubbles.push(bubbleData);
        return bubbleData;
    };

    Game_Screen.prototype.activeBubbles = function () {
        return this._activeBubbles || [];
    };

    Game_Screen.prototype.hasBlockingBubble = function () {
        return (this._activeBubbles || []).some(b => b.confirmButton && !b.dead);
    };

    //-------------------------------------------------------------------------
    // Input Pausing
    //-------------------------------------------------------------------------
    const _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function () {
        if ($gameScreen.hasBlockingBubble()) return false;
        return _Game_Player_canMove.call(this);
    };

    const _Scene_Map_isMenuEnabled = Scene_Map.prototype.isMenuEnabled;
    Scene_Map.prototype.isMenuEnabled = function () {
        if ($gameScreen.hasBlockingBubble()) return false;
        return _Scene_Map_isMenuEnabled.call(this);
    };

    //-------------------------------------------------------------------------
    // Sprite_Bubble
    //-------------------------------------------------------------------------
    class Sprite_Bubble extends Sprite {
        constructor(data) {
            super();
            this._data = data;
            this._target = data.target;
            this._duration = data.duration;
            this._confirmButton = data.confirmButton;
            this._age = 0;

            this.anchor.x = 0.5;
            this.anchor.y = 1.0;

            this._tailHeight = 10;
            this._tailWidth = 12;
            this._cornerRadius = 6;

            this.buildBitmap();
            this.updatePosition();
        }

        buildBitmap() {
            const lines = String(this._data.text).split("\\n");
            const fontSize = this._data.fontSize;
            const padding = this._data.padding;
            const lineHeight = fontSize + 8;

            // Offscreen ruler
            const ruler = new Bitmap(1, 1);
            ruler.fontSize = fontSize;

            let maxLineWidth = 0;
            for (const line of lines) {
                const clean = line.replace(/\\C\[\d+\]|\\I\[\d+\]|\\\{|\\\}|\\[GgVvNnPp]\[\d+\]/gi, "");
                const w = ruler.measureTextWidth(clean);
                if (w > maxLineWidth) maxLineWidth = w;
            }

            const boxWidth = Math.max(64, Math.ceil(maxLineWidth + padding * 2));
            const boxHeight = Math.ceil(lines.length * lineHeight + padding * 2);
            const totalWidth = boxWidth + 4;
            const totalHeight = boxHeight + this._tailHeight + 4;

            this.bitmap = new Bitmap(totalWidth, totalHeight);
            this.bitmap.fontSize = fontSize;
            this._boxWidth = boxWidth;
            this._boxHeight = boxHeight;

            // Draw bubble body & tail
            const ctx = this.bitmap.context;
            const r = this._cornerRadius;
            const w = boxWidth;
            const h = boxHeight;
            const th = this._tailHeight;
            const tw = this._tailWidth;
            const cx = w / 2;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(w - r, 0);
            ctx.quadraticCurveTo(w, 0, w, r);
            ctx.lineTo(w, h - r);
            ctx.quadraticCurveTo(w, h, w - r, h);
            ctx.lineTo(cx + tw / 2, h);
            ctx.lineTo(cx, h + th);
            ctx.lineTo(cx - tw / 2, h);
            ctx.lineTo(r, h);
            ctx.quadraticCurveTo(0, h, 0, h - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();

            ctx.fillStyle = this._data.bgColor;
            ctx.fill();

            ctx.lineWidth = 2;
            ctx.strokeStyle = this._data.borderColor;
            ctx.stroke();
            ctx.restore();

            // Draw Text
            let textY = padding;
            for (const line of lines) {
                this.bitmap.textColor = this._data.textColor;
                this.bitmap.drawText(line, padding, textY, boxWidth - padding * 2, lineHeight, "center");
                textY += lineHeight;
            }
        }

        update() {
            super.update();
            this._age++;

            this.updatePosition();
            this.checkDismissal();
        }

        updatePosition() {
            let screenX = 0;
            let screenY = 0;

            if (this._target) {
                if (typeof this._target.screenX === "function") {
                    screenX = this._target.screenX();
                    screenY = this._target.screenY() - 48;
                } else if (this._target._realX !== undefined) {
                    screenX = Math.round($gameMap.adjustX(this._target._realX) * $gameMap.tileWidth() + $gameMap.tileWidth() / 2);
                    screenY = Math.round($gameMap.adjustY(this._target._realY) * $gameMap.tileHeight());
                } else if (this._target.x !== undefined && this._target.y !== undefined) {
                    screenX = this._target.x;
                    screenY = this._target.y;
                }
            }

            const halfW = (this._boxWidth || 0) / 2;
            const fullH = (this._boxHeight || 0) + this._tailHeight;
            this.x = Math.max(halfW + 4, Math.min(Graphics.width - halfW - 4, screenX));
            this.y = Math.max(fullH + 4, screenY);
        }

        checkDismissal() {
            if (this._confirmButton) {
                if (TouchInput.isTriggered() || Input.isTriggered("ok") || Input.isTriggered("cancel")) {
                    this.dismiss();
                    return;
                }
            }

            if (!this._confirmButton && TouchInput.isTriggered()) {
                const tx = TouchInput.x;
                const ty = TouchInput.y;
                const left = this.x - this._boxWidth / 2;
                const right = this.x + this._boxWidth / 2;
                const top = this.y - (this._boxHeight + this._tailHeight);
                const bottom = this.y;

                if (tx >= left && tx <= right && ty >= top && ty <= bottom) {
                    this.dismiss();
                    return;
                }
            }

            if (this._duration > 0 && this._age >= this._duration) {
                this.dismiss();
            }
        }

        dismiss() {
            this._data.dead = true;
        }
    }

    //-------------------------------------------------------------------------
    // Spriteset_Map Layering
    //-------------------------------------------------------------------------
    const _Spriteset_Map_createUpperLayer = Spriteset_Map.prototype.createUpperLayer;
    Spriteset_Map.prototype.createUpperLayer = function () {
        _Spriteset_Map_createUpperLayer.call(this);
        this.createBubbleContainer();
    };

    Spriteset_Map.prototype.createBubbleContainer = function () {
        if (!this._bubbleContainer) {
            this._bubbleContainer = new Sprite();
            this._bubbleContainer.z = 99;
            this.addChild(this._bubbleContainer);
        }
        this._bubbleSprites = [];
    };

    const _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function () {
        _Spriteset_Map_update.call(this);
        this.updateBubbles();
    };

    Spriteset_Map.prototype.updateBubbles = function () {
        if (!this._bubbleContainer) return;

        const activeData = $gameScreen.activeBubbles();

        for (const data of activeData) {
            if (!this._bubbleSprites.some(s => s._data.id === data.id)) {
                const sprite = new Sprite_Bubble(data);
                this._bubbleContainer.addChild(sprite);
                this._bubbleSprites.push(sprite);
            }
        }

        for (let i = this._bubbleSprites.length - 1; i >= 0; i--) {
            const sprite = this._bubbleSprites[i];
            if (sprite._data.dead) {
                this._bubbleContainer.removeChild(sprite);
                this._bubbleSprites.splice(i, 1);
            }
        }

        $gameScreen._activeBubbles = activeData.filter(d => !d.dead);
    };

})();