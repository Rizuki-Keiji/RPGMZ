/*:
 * @plugindesc Directional (Sun) Shadow plugin for RPG Maker MZ
 * @author Sang Hendrix
 * @target MZ
 * @help Create a fake sun that cast shadow to player and any events that you want, using their own sprite as shadow.
 * 
 * Verion 1.1.6
 * ==============================================================================
 * This is a plugin for RPG Maker MZ that allow you to create a fake sun
 * and cast shadows to player and events or a group of events, manually or automatically.
 *==============================================================================
 * 
 * FEATURES
 * - Allow you to set up the sun degree through parameter or a variable Id.
 * - Manually add shadow to an event by adding <shadow> to its notetag
 * - Manually add shadow to an event by using a plugin command (temporary)
 * - Automatically add shadow to any event with a specific notetag
 * - Adjust shadow offset x, y, length for all events, event notetag groups 
 * or individual events.
 * - Adjust shadow opacity and blur amount.
 * - The shadow automatically erased if the event no longer exists
 * - The ability to make the shadow to have fade out effect 
 * when it's being erased. 
 * - The ability to enable the shadow to automatically scale itself so it
 * appears bigger.
 * 
 *==============================================================================
 * HOW TO USE
 * - Automatic Method: 
 * In parameter Event Notetags, create an option with empty
 * notetag. This way, it'll automatically create all shadows to all events on map.
 * 
 * - Manual Methods:
 * Method 1: Add notetag <shadow> to events
 * 
 * Method 2: Add any notetag to your events, then go to parameter Event Notetags
 * and create an option with notetag you've just setup recently.
 * 
 * Method 3: Using plugin command AddShadow and assign an event Id. Write > this <
 * to create shadow on the current event. Is is only for event that isn't meant
 * to last permanently on the current map.
 * 
 * - Additional notetags:
 * If an event has these notetag, it'll overdrive all other corresponding values.
 * 
 * <shadowX: number>, <shadowY: number>: Adjust offset of the shadow for current event.
 * 
 * <shadowLength: number>: Adjust the length of the shadow for current event.
 * 
 * Example: In parameter, if you setup Global Offset, it'll only affect any 
 * event that doesn't setup their own offset.
 * 
 * To make a map not display shadow, add this notetag to that map: <noShadow>
 * ==============================================================================
 * TERMS OF USE
 * Once you've aqquired this plugin legally, you can use it for both free
 * or commercial projects. You can make adjustments but don't distribute it.
 * ==============================================================================
 * For feedback, please send me a message on Discord.
 * https://discord.gg/YKPscqHV8b
 * 
 * @command AddShadow
 * @text Add Shadow
 * @desc Adds a shadow to a specified event, even without a notetag. A good method for temporary events.
 *
 * @arg eventId
 * @type string
 * @default this
 * @text Event ID
 * @desc The ID of the event to add the shadow to. Use 'this' for the current event.
 * 
 * @command RemoveShadow
 * @text Remove Shadow
 * @desc Removes the shadow from a specified event
 * 
 * @arg eventId
 * @type string
 * @default 1
 * @text Event ID
 * @desc The ID of the event to remove the shadow from. Use 'this' for the current event.
 * 
 * @command AdjustGlobalOffset
 * @text Adjust Global Offset
 * @desc Adjusts the global shadow offset.
 *
 * @arg offsetX
 * @type number
 * @min -100
 * @max 100
 * @default 0
 * @text Offset X
 * @desc The new global horizontal offset for shadows.
 *
 * @arg offsetY
 * @type number
 * @min -100
 * @max 100
 * @default 0
 * @text Offset Y
 * @desc The new global vertical offset for shadows.
 *
 * @command AdjustDefaultOpacity
 * @text Adjust Default Opacity
 * @desc Adjusts the default shadow opacity.
 *
 * @arg opacity
 * @type number
 * @min 0
 * @max 255
 * @default 128
 * @text Opacity
 * @desc The new default opacity for shadows (0-255).
 * 
 * @command ToggleShadowDisplay
 * @text Toggle Shadow Display
 * @desc Toggles shadow display for player and events
 *
 * @arg playerShadow
 * @type boolean
 * @text Display Shadow for Player
 * @desc Whether to display shadow for the player
 * @default true
 * 
 * @arg followerShadow
 * @type boolean
 * @text Display Shadow for Followers
 * @desc Whether to display shadow for the followers
 * @default true
 *
 * @arg eventShadow
 * @type boolean
 * @text Display Shadow for Events
 * @desc Whether to display shadow for events
 * @default true
 * 
 * @command ToggleShadowEventNotetag
 * @text Toggle Shadow Event Notetag
 * @desc Enables or disables a specific notetag for shadow casting
 *
 * @arg notetag
 * @type string
 * @text Notetag
 * @desc The notetag to toggle
 *
 * @arg status
 * @type boolean
 * @text Status
 * @desc Whether to enable (true) or disable (false) the notetag
 * @default true
 * 
 * @param eventNotetags
 * @text Event Notetags
 * @type struct<EventNotetag>[]
 * @desc Notetags that will cause events to cast shadows.
 * 
 * @param decor0
 * @text ==========================
 * @type text
 * @default ===============================
 * 
 * @param defaultAngle
 * @text Fixed Shadow Angle
 * @type number
 * @min 0
 * @max 360
 * @default 45
 * @desc The default angle for the shadow (in degrees)
 * 
 * @param angleVariableId
 * @text Angle Variable ID
 * @type variable
 * @default 0
 * @desc Variable ID for dynamic shadow angle. Set to 0 or none to use fixed angle.
 * 
 * @param decor1
 * @text ==========================
 * @type text
 * @default ===============================
 * 
 * @param combatShadowEnemy 
 * @text Combat Shadow: Enemies
 * @type boolean
 * @default true
 * @desc If true, enemy battlers will cast shadows in combat.
 * 
 * @param combatShadowActor
 * @text Combat Shadow: Actors
 * @type boolean
 * @default true
 * @desc If true, actor battlers will cast shadows in combat.
 * 
 * @param playerShadow
 * @text Player Shadow
 * @type boolean
 * @default true
 * @desc If true, the player character will also cast a shadow.
 * 
 * @param followersShadow
 * @text Followers Shadow
 * @type boolean
 * @default true
 * @desc If true, it'll show shadow to Game Followers as well.
 * 
 * @param playerZIndex
 * @text Player Shadow Z-Index
 * @type number
 * @default 2
 * @desc Controls the rendering order of the player's shadow. Higher values render on top.
 * 
 * @param followerZIndex
 * @text Follower Shadow Z-Index
 * @type number
 * @default 2
 * @desc Controls the rendering order of the follower's shadow. Higher values render on top.
 * 
 * @param decor2
 * @text ==========================
 * @type text
 * @default ===============================
 * 
 * @param offsetX
 * @text Global Shadow Offset X
 * @type number
 * @min -100
 * @max 100
 * @default 0
 * @desc Horizontal offset of the shadow from the character (in pixels). Positive moves right, negative moves left.
 *
 * @param offsetY
 * @text Global Shadow Offset Y
 * @type number
 * @min -100
 * @max 100
 * @default 0
 * @desc Vertical offset of the shadow from the character (in pixels). Positive moves down, negative moves up.
 * 
 * @param defaultOpacity
 * @text Default Shadow Opacity
 * @type number
 * @min 0
 * @max 255
 * @default 128
 * @desc The default opacity for the shadow (0-255)
 * 
 * @param softenShadow
 * @text Soften Shadow
 * @type number
 * @min 0
 * @max 20
 * @default 0
 * @desc The amount of softening to apply to the shadow (0-20). Higher values create softer shadows.
 * 
 * @param shadowLength
 * @text Shadow Length
 * @type number
 * @min 0
 * @max 500
 * @default 100
 * @desc The default length of the shadow as a percentage (100 = normal length)
 * 
 * @param autoLength
 * @text Auto Length
 * @type boolean
 * @default false
 * @desc If true, shadow length will be automatically adjusted based on the angle.
 * 
 * @param skewEffect
 * @text Skew Effect
 * @type boolean
 * @default true
 * @desc If false, shadows will not skew based on the sun angle. Recommend to turn on for realistic shadow.
 * 
 * @param decor3
 * @text ==========================
 * @type text
 * @default ===============================
 * 
 * @param smoothFadeOut
 * @text Smooth Removal
 * @type boolean
 * @default true
 * @desc If true, shadows will fade out smoothly when removed.
 */

/*~struct~EventNotetag:
 * @param tag
 * @text Notetag
 * @type text
 * @desc The notetag that will cause an event to cast a shadow.
 *
 * @param offsetX
 * @text Default Offset X
 * @type number
 * @min -100
 * @max 100
 * @default 0
 * @desc Default horizontal offset for shadows cast by events with this notetag.
 *
 * @param offsetY
 * @text Default Offset Y
 * @type number
 * @min -100
 * @max 100
 * @default 0
 * @desc Default vertical offset for shadows cast by events with this notetag.
 *
 * @param length
 * @text Default Length
 * @type number
 * @min 0
 * @max 500
 * @default 100
 * @desc Default length for shadows cast by events with this notetag (as a percentage).
 * 
 * @param zIndex
 * @text Z-Index
 * @type number
 * @default 1
 * @desc Controls the rendering order of the shadow. Higher values render on top.
 */

var Imported = Imported || {};

(function () {
    const pluginName = "Hendrix_Directional_Shadow";
    const parameters = PluginManager.parameters(pluginName);

    const defaultAngle = Number(parameters['defaultAngle'] || 45);
    let shadowOpacity = Number(parameters['defaultOpacity'] || 128);
    const angleVariableId = Number(parameters['angleVariableId'] || 0);
    const smoothFadeOut = parameters['smoothFadeOut'] === 'true';
    let offsetX = Number(parameters['offsetX'] || 0);
    let offsetY = Number(parameters['offsetY'] || 0);
    const softenShadow = Number(parameters['softenShadow'] || 0);
    const playerShadow = parameters['playerShadow'] === 'true';
    const followersShadow = parameters['followersShadow'] === 'true';
    const combatShadowEnemy = parameters['combatShadowEnemy'] === 'true';
    const combatShadowActor = parameters['combatShadowActor'] === 'true';
    const shadowLength = Number(parameters['shadowLength'] || 100);
    const autoLength = parameters['autoLength'] === 'true';
    const skewEffect = parameters['skewEffect'] !== 'false';
    const playerZIndex = Number(parameters['playerZIndex'] || 2);
    const followerZIndex = Number(parameters['followerZIndex'] || 2);

    let displayPlayerShadow = true;
    let displayFollowerShadow = true;
    let displayEventShadow = true;
    let inactiveNotetags = new Set();
    let isShadowCastingEnabled = ConfigManager.castShadow;

    Game_Map.prototype.hasNoShadow = function() {
        return $dataMap && $dataMap.note && $dataMap.note.includes('<noShadow>');
    };

    function updateShadowCastingState() {
        isShadowCastingEnabled = ConfigManager.castShadow;
    }

    const eventNotetags = JSON.parse(parameters['eventNotetags'] || '[]').map(notag => {
        const parsed = JSON.parse(notag);
        return {
            tag: parsed.tag,
            offsetX: Number(parsed.offsetX || 0),
            offsetY: Number(parsed.offsetY || 0),
            length: Number(parsed.length || 100),
            zIndex: Number(parsed.zIndex || 1)
        };
    });

    PluginManager.registerCommand(pluginName, "AdjustGlobalOffset", args => {
        offsetX = Number(args.offsetX);
        offsetY = Number(args.offsetY);
    });

    PluginManager.registerCommand(pluginName, "AdjustDefaultOpacity", args => {
        shadowOpacity = Number(args.opacity);
    });

    PluginManager.registerCommand(pluginName, "ToggleShadowDisplay", args => {
        displayPlayerShadow = args.playerShadow === "true";
        displayFollowerShadow = args.followerShadow === "true";
        displayEventShadow = args.eventShadow === "true";

        // Update all existing shadows
        if (SceneManager._scene instanceof Scene_Map) {
            SceneManager._scene._spriteset.updateAllShadows();
        }
    });

    PluginManager.registerCommand(pluginName, "ToggleShadowEventNotetag", args => {
        const notetag = args.notetag;
        const status = args.status === "true";

        if (status) {
            inactiveNotetags.delete(notetag);
        } else {
            inactiveNotetags.add(notetag);
        }

        if (SceneManager._scene instanceof Scene_Map) {
            $gameMap.events().forEach(event => {
                event.refreshShadowStatus();
            });
            SceneManager._scene._spriteset.updateAllShadows();
        }
    });

    PluginManager.registerCommand(pluginName, "AddShadow", function (args) {
        const eventId = args.eventId.toLowerCase() === 'this' ? this.eventId() : Number(args.eventId);
        const event = $gameMap.event(eventId);
        if (event) {
            event._hasShadow = true;
            event._manuallyAddedShadow = true;

            const note = event.event().note;
            const shadowXMatch = /<shadowX:\s*(-?\d+)>/i.exec(note);
            const shadowYMatch = /<shadowY:\s*(-?\d+)>/i.exec(note);
            const shadowLengthMatch = /<shadowLength:\s*(\d+)>/i.exec(note);

            event._shadowOffsetX = shadowXMatch ? parseInt(shadowXMatch[1]) : offsetX;
            event._shadowOffsetY = shadowYMatch ? parseInt(shadowYMatch[1]) : offsetY;
            event._shadowLength = shadowLengthMatch ? parseInt(shadowLengthMatch[1]) : shadowLength;

            // Force update of the corresponding sprite
            const sprite = SceneManager._scene._spriteset.findTargetSprite(event);
            if (sprite) {
                sprite.updateShadow();
            }
        }
    });

    ConfigManager.castShadow = true;

    const _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function () {
        const config = _ConfigManager_makeData.call(this);
        config.castShadow = this.castShadow;
        return config;
    };

    const _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function (config) {
        _ConfigManager_applyData.call(this, config);
        this.castShadow = this.readFlag(config, 'castShadow', true);
        updateShadowCastingState();
    };

    const _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
    Window_Options.prototype.addGeneralOptions = function () {
        _Window_Options_addGeneralOptions.call(this);
        this.addCommand('Cast Shadow', 'castShadow');
    };

    const _Window_Options_processOk = Window_Options.prototype.processOk;
    Window_Options.prototype.processOk = function () {
        _Window_Options_processOk.call(this);
        if (this.commandSymbol(this.index()) === 'castShadow') {
            updateShadowCastingState();
        }
    };

    PluginManager.registerCommand(pluginName, "RemoveShadow", function (args) {
        const eventId = args.eventId.toLowerCase() === 'this' ? this.eventId() : Number(args.eventId);
        const event = $gameMap.event(eventId);
        if (event) {
            event._hasShadow = false;
            // Force update of the corresponding sprite
            const sprite = SceneManager._scene._spriteset.findTargetSprite(event);
            if (sprite) {
                sprite.updateShadow();
            }
        }
    });

    Spriteset_Map.prototype.updateAllShadows = function () {
        this._characterSprites.forEach(sprite => {
            sprite.updateShadow();
        });
    };

    const _Game_Event_initMembers = Game_Event.prototype.initMembers;
    Game_Event.prototype.initMembers = function () {
        _Game_Event_initMembers.call(this);
        this._hasShadow = false;
        this._manuallyAddedShadow = false;
    };

    Game_Event.prototype.refreshShadowStatus = function () {
        if (this._manuallyAddedShadow) {
            this._hasShadow = true;
            return;
        }

        const note = this.event().note;
        const hasActiveNotetag = eventNotetags.some(nt =>
            note.includes(nt.tag) && !inactiveNotetags.has(nt.tag)
        );
        this._hasShadow = (note.includes('<shadow>') && !inactiveNotetags.has('<shadow>')) || hasActiveNotetag;
    };

    const _Game_Event_setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function () {
        const hadManualShadow = this._manuallyAddedShadow;
        const oldOffsetX = this._shadowOffsetX;
        const oldOffsetY = this._shadowOffsetY;
        const oldLength = this._shadowLength;

        _Game_Event_setupPage.call(this);

        if (hadManualShadow) {
            this._hasShadow = true;
            this._manuallyAddedShadow = true;
            this._shadowOffsetX = oldOffsetX;
            this._shadowOffsetY = oldOffsetY;
            this._shadowLength = oldLength;
        } else {
            this.refreshShadowStatus();
        }

        if (this._hasShadow) {
            const note = this.event().note;
            const matchingNotetag = eventNotetags.find(nt => note.includes(nt.tag) && !inactiveNotetags.has(nt.tag));

            // Individual notetag settings
            this._shadowOffsetX = this.getShadowOffsetX();
            this._shadowOffsetY = this.getShadowOffsetY();
            this._shadowLength = this.getShadowLength();

            // If individual settings are not set, use notetag group settings
            if (matchingNotetag) {
                if (this._shadowOffsetX === null) this._shadowOffsetX = matchingNotetag.offsetX;
                if (this._shadowOffsetY === null) this._shadowOffsetY = matchingNotetag.offsetY;
                if (this._shadowLength === null) this._shadowLength = matchingNotetag.length;
            }

            // If still not set, use global settings
            if (this._shadowOffsetX === null) this._shadowOffsetX = offsetX;
            if (this._shadowOffsetY === null) this._shadowOffsetY = offsetY;
            if (this._shadowLength === null) this._shadowLength = shadowLength;
        }
    };

    Game_Event.prototype.getShadowOffsetX = function () {
        const match = /<shadowX:\s*(-?\d+)>/i.exec(this.event().note);
        return match ? parseInt(match[1]) : null;
    };

    Game_Event.prototype.getShadowOffsetY = function () {
        const match = /<shadowY:\s*(-?\d+)>/i.exec(this.event().note);
        return match ? parseInt(match[1]) : null;
    };

    Game_Event.prototype.getShadowLength = function () {
        const match = /<shadowLength:\s*(\d+)>/i.exec(this.event().note);
        return match ? parseInt(match[1]) : null;
    };

    const _Sprite_Character_initMembers = Sprite_Character.prototype.initMembers;
    Sprite_Character.prototype.initMembers = function () {
        _Sprite_Character_initMembers.call(this);
        this._shadowSprite = null;
        this._shadowBlurFilter = null;
    };

    const _Sprite_Character_update = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function () {
        _Sprite_Character_update.call(this);
        this.updateShadow();
    };

    Sprite_Character.prototype.updateShadow = function () {
        if (!isShadowCastingEnabled || !this.isOnScreen()) {
            this.removeShadowIfExist();
            return;
        }

        if (this.shouldHaveShadow()) {
            this.createShadowIfNeeded();
            this.updateShadowProperties();
        } else {
            this.removeShadowIfExist();
        }
    };

    Sprite_Character.prototype.isOnScreen = function () {
        const margin = 240;
        const x = this._character.screenX();
        const y = this._character.screenY();
        return x > -margin && x < Graphics.width + margin &&
            y > -margin && y < Graphics.height + margin;
    };

    Sprite_Character.prototype.shouldHaveShadow = function () {
        if ($gameMap.hasNoShadow()) return false;
        if (!isShadowCastingEnabled) return false;
        if (this._character.isTransparent()) return false;
        if (this._character instanceof Game_Player) {
            return playerShadow && displayPlayerShadow && ConfigManager.castShadow;
        } else if (this._character instanceof Game_Follower) {
            return followersShadow && displayFollowerShadow && ConfigManager.castShadow;
        } else if (this._character instanceof Game_Event) {
            return displayEventShadow &&
                this._character._hasShadow &&
                this._character.characterName() !== '' &&
                this._character._eventId &&
                !this._character._erased &&
                !!$gameMap.event(this._character._eventId) &&
                ConfigManager.castShadow;
        }
        return false;
    };

    Sprite_Character.prototype.createShadowIfNeeded = function () {
        if (!this._shadowSprite && this.parent) {
            this._shadowSprite = new Sprite();
            this._shadowSprite.anchor.x = 0.5;
            this._shadowSprite.anchor.y = 1;
            this._shadowSprite.z = 0;
            this._shadowSprite.currentAngle = undefined;
            this._shadowSprite.targetScaleX = null;
            this._shadowSprite.targetX = null;
            this._shadowSprite.targetY = null;

            this._shadowSprite.setBlendColor([0, 0, 0, 255]);
            this._shadowSprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;

            if (softenShadow > 0) {
                this._shadowBlurFilter = new PIXI.filters.BlurFilter(softenShadow);
                this._shadowSprite.filters = [this._shadowBlurFilter];
            }
            let initialShadowLength = shadowLength;
            if (this._character instanceof Game_Event && this._character._shadowLength !== null) {
                initialShadowLength = this._character._shadowLength;
            }
            this._shadowSprite.scale.y = initialShadowLength / 100;

            this.parent.addChildAt(this._shadowSprite, this.parent.getChildIndex(this));
        }
    };

    Sprite_Character.prototype.updateShadowProperties = function () {
        if (!this._shadowSprite) {
            return;
        }
    
        const shadowSprite = this._shadowSprite;
        const character = this._character;
    
        // Check if the shadow should be static (ignore this, it's just a secret feature for my project :D)
        const isStaticShadow = character instanceof Game_Event && 
                               character.event().note.match(/<shadow:\s*static>/i);
    
        const isAnimaX = Imported[Imported.PKD_AnimaX] && character.isAnimX && character.isAnimX();
    
        if (isAnimaX) {
            const currentFrame = character.getCurrentAnimX().getAnimationByDirection(character.direction()).getFrame(this._axCntr.cFrame);
            shadowSprite.bitmap = currentFrame;
        } else {
            shadowSprite.bitmap = this.bitmap;
        }
    
        shadowSprite.opacity = this.opacity * (shadowOpacity / 255);
        shadowSprite.z = this.calculateShadowZIndex();
    
        const newShadowAngle = angleVariableId > 0 ? $gameVariables.value(angleVariableId) : defaultAngle;
        const normalizedAngle = ((newShadowAngle % 360) + 360) % 360;
    
        if (shadowSprite.currentAngle === undefined || !isStaticShadow) {
            if (shadowSprite.currentAngle === undefined) {
                shadowSprite.currentAngle = normalizedAngle;
            } else {
                let angleDiff = normalizedAngle - shadowSprite.currentAngle;
                if (angleDiff > 180) angleDiff -= 360;
                if (angleDiff < -180) angleDiff += 360;
                shadowSprite.currentAngle = (shadowSprite.currentAngle + angleDiff * 0.2 + 360) % 360;
            }
            const angleIndex = Math.round(shadowSprite.currentAngle) % 360;
            
            if (skewEffect) {
                shadowSprite.skew.x = Math.tan(angleIndex * Math.PI / 180);
            } else {
                shadowSprite.skew.x = 0;
                shadowSprite.rotation = angleIndex * Math.PI / 180;
            }
        }
    
        shadowSprite.scale.x = this.scale.x;
        shadowSprite.scale.y = this.scale.y;
    
        let lengthScale;
        if (autoLength) {
            const angleIndex = Math.round(shadowSprite.currentAngle) % 360;
            lengthScale = Math.max(0.1, Math.min(Math.abs(Math.tan(angleIndex * Math.PI / 180)), 2));
        } else {
            const currentShadowLength = character instanceof Game_Event ? character._shadowLength : shadowLength;
            lengthScale = currentShadowLength / 100;
        }
        shadowSprite.scale.y *= lengthScale;
    
        const totalOffsetX = character instanceof Game_Event ? character._shadowOffsetX : offsetX;
        const totalOffsetY = character instanceof Game_Event ? character._shadowOffsetY : offsetY;
    
        shadowSprite.x = this.x + totalOffsetX;
        shadowSprite.y = this.y + totalOffsetY;
    
        shadowSprite.anchor.x = 0.5;
        shadowSprite.anchor.y = 1;
    
        if (this._frame) {
            shadowSprite.setFrame(this._frame.x, this._frame.y, this._frame.width, this._frame.height);
        }
    
        if (!isStaticShadow && skewEffect) {
            shadowSprite.rotation = this.rotation;
        }
    
        this.updateShadowBlur();
    };

    Sprite_Character.prototype.calculateShadowZIndex = function () {
        const character = this._character;
        
        if (character instanceof Game_Player) {
            return playerZIndex;
        } else if (character instanceof Game_Follower) {
            return followerZIndex;
        } else if (character instanceof Game_Event) {
            const note = character.event().note;
            const matchingNotetag = eventNotetags.find(nt => note.includes(nt.tag));
            
            if (matchingNotetag) {
                return matchingNotetag.zIndex;
            }
        }
        
        return 0;
    };

    Sprite_Character.prototype.updateShadowBlur = function () {
        if (softenShadow > 0) {
            if (!this._shadowBlurFilter) {
                this._shadowBlurFilter = new PIXI.filters.BlurFilter(softenShadow);
                this._shadowSprite.filters = [this._shadowBlurFilter];
            } else {
                this._shadowBlurFilter.blur = softenShadow;
            }
        } else if (this._shadowBlurFilter) {
            this._shadowSprite.filters = null; // Clear filters array first
            this._shadowBlurFilter.destroy();  // Then destroy the filter
            this._shadowBlurFilter = null;     // Finally null the reference
        }
    };

    Sprite_Character.prototype.removeShadowIfExist = function () {
        if (this._shadowSprite) {
            if (smoothFadeOut && this._shadowSprite.opacity > 0) {
                this._shadowSprite.opacity -= Math.ceil(this._shadowSprite.opacity / 9);
                if (this._shadowSprite.opacity > 0) {
                    return;
                }
            }
            if (this._shadowSprite.parent) {
                this._shadowSprite.parent.removeChild(this._shadowSprite);
            }
            this._shadowSprite.destroy();
            this._shadowSprite = null;
            this._shadowBlurFilter = null;
        }
    };

    const _Sprite_Character_setCharacter = Sprite_Character.prototype.setCharacter;
    Sprite_Character.prototype.setCharacter = function (character) {
        if (this._character !== character) {
            this.removeShadowIfExist();
        }
        _Sprite_Character_setCharacter.call(this, character);
    };

    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function () {
        _Scene_Map_start.call(this);
        this._spriteset.createShadows();
    };

    Spriteset_Map.prototype.createShadows = function () {
        if (isShadowCastingEnabled) {
            for (const sprite of this._characterSprites) {
                sprite.updateShadow();
            }
            if (playerShadow && this._playerSprite) {
                this._playerSprite.updateShadow();
            }
        }
    };

    Spriteset_Map.prototype.findTargetSprite = function (character) {
        return this._characterSprites.find(sprite => sprite._character === character);
    };

    const _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        _Game_Map_update.call(this, sceneActive);
        if (SceneManager._scene instanceof Scene_Map && isShadowCastingEnabled) {
                SceneManager._scene._spriteset.updateShadows();
        }
    };

    Spriteset_Map.prototype.removeAllShadows = function () {
        this._characterSprites.forEach(sprite => {
            sprite.removeShadowIfExist();
        });
    };

    const _Scene_Map_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function () {
        if (this._spriteset) {
            this._spriteset.removeAllShadows();
        }
        _Scene_Map_terminate.call(this);
    };

    Spriteset_Map.prototype.updateShadows = function () {
        if (!isShadowCastingEnabled) return;

        const characterSprites = this._characterSprites;
        const length = characterSprites.length;
        for (let i = 0; i < length; i++) {
            const sprite = characterSprites[i];
            const character = sprite._character;

            if (character instanceof Game_Event && displayEventShadow) {
                if (!$gameMap.event(character._eventId)) {
                    sprite.removeShadowIfExist();
                } else {
                    sprite.updateShadow();
                }
            } else if (playerShadow && displayPlayerShadow && character instanceof Game_Player) {
                sprite.updateShadow();
            }
        }
    };

    // BATTLERS FRONT VIEW/SIDE VIEW ================================================
    // Initial Setup
    // Enemy sprites
    const _Sprite_Battler_initMembers = Sprite_Battler.prototype.initMembers;
    Sprite_Battler.prototype.initMembers = function() {
        _Sprite_Battler_initMembers.call(this);
        this._shadowSprite = null;
        this._shadowBlurFilter = null; 
    };
    // Player sprites side view
    const _Sprite_Actor_initMembers = Sprite_Actor.prototype.initMembers;
    Sprite_Actor.prototype.initMembers = function() {
        _Sprite_Actor_initMembers.call(this);
        this._shadowSprite = null;
        this._shadowBlurFilter = null; 
    };

    Sprite_Battler.prototype.removeShadowIfExist = Sprite_Character.prototype.removeShadowIfExist;
    Sprite_Actor.prototype.removeShadowIfExist = Sprite_Character.prototype.removeShadowIfExist;

    const createBattlerShadow = function() {
        if (!this._shadowSprite && this.parent) {
            this._shadowSprite = new Sprite();
            this._shadowSprite.anchor.x = 0.5;
            this._shadowSprite.anchor.y = 1;
            this._shadowSprite.z = -1;
    
            this._shadowSprite.setBlendColor([0, 0, 0, 255]);
            this._shadowSprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;
    
            if (softenShadow > 0) {
                this._shadowBlurFilter = new PIXI.filters.BlurFilter(softenShadow);
                this._shadowSprite.filters = [this._shadowBlurFilter];
            }
    
            this._shadowSprite.scale.y = shadowLength / 100;
            this.parent.addChildAt(this._shadowSprite, 0);
        }
    };
    
    const updateBattlerShadow = function() {
        if (!this._shadowSprite) return;
    
        const mainSprite = this instanceof Sprite_Enemy ? this : this._mainSprite;
        if (!mainSprite || !mainSprite.bitmap) return;
    
        this._shadowSprite.bitmap = mainSprite.bitmap;
        this._shadowSprite.opacity = mainSprite.opacity * (shadowOpacity / 255);
        this._shadowSprite.visible = mainSprite.visible;
        
        this._shadowSprite.scale.x = mainSprite.scale.x;
        this._shadowSprite.scale.y = mainSprite.scale.y * (shadowLength / 100);
    
        const angle = angleVariableId > 0 ? $gameVariables.value(angleVariableId) : defaultAngle;
        const normalizedAngle = ((angle % 360) + 360) % 360;
        const angleInRadians = normalizedAngle * Math.PI / 180;
        this._shadowSprite.skew.x = Math.tan(angleInRadians);
    
        // Different position calculation for actors and enemies
        if (this instanceof Sprite_Actor) {
            this._shadowSprite.x = this.x + mainSprite.x + offsetX;
            this._shadowSprite.y = this.y + mainSprite.y + offsetY;
        } else {
            this._shadowSprite.x = mainSprite.x + offsetX;
            this._shadowSprite.y = mainSprite.y + offsetY;
        }
        
        this._shadowSprite.rotation = mainSprite.rotation;
    
        if (mainSprite._frame) {
            this._shadowSprite.setFrame(
                mainSprite._frame.x,
                mainSprite._frame.y,
                mainSprite._frame.width,
                mainSprite._frame.height
            );
        }
    
        if (softenShadow > 0 && this._shadowBlurFilter) {
            this._shadowBlurFilter.blur = softenShadow;
        }
    };

    const updateBattlerShadowState = function() {
        if (this instanceof Sprite_Actor) {
            if (this._mainSprite && this._mainSprite.bitmap && !this._mainSprite.bitmap.isReady()) {
                return;
            }
        } 
        // Enemy Battler
        else if (!this.parent) {
            return;
        }
    
        if (this.shouldHaveShadow()) {
            this.createShadowIfNeeded();
            this.updateShadowProperties();
        } else {
            this.removeShadowIfExist();
        }
    };

    const shouldBattlerHaveShadow = function() {
        if (this instanceof Sprite_Actor) {
            if (!combatShadowActor) return false;
        } else {
            if (!combatShadowEnemy) return false;
        }
        
        const baseConditions = this._battler && 
                              this._battler.isAlive() &&
                              this.visible;
        
        if (!baseConditions) return false;
    
        if (this instanceof Sprite_Actor) {
            return this._mainSprite &&
                   this._mainSprite.bitmap &&
                   this._mainSprite.bitmap.isReady();
        } else {
            return this.bitmap;
        }
    };

    const updateBattlerWithShadow = function(originalUpdate) {
        return function() {
            originalUpdate.call(this);
            if (!(this instanceof Sprite_Actor) || (this._mainSprite && this._mainSprite.bitmap)) {
                this.updateShadow();
            }
        };
    };
    
    //______________________________________________________________________________
    
    Sprite_Battler.prototype.shouldHaveShadow = function() {
        return shouldBattlerHaveShadow.call(this);
    };
    
    Sprite_Actor.prototype.shouldHaveShadow = function() {
        return shouldBattlerHaveShadow.call(this);
    };

    Sprite_Battler.prototype.createShadowIfNeeded = function() {
        createBattlerShadow.call(this);
    };

    Sprite_Actor.prototype.createShadowIfNeeded = function() {
        createBattlerShadow.call(this);
    };
    
    Sprite_Battler.prototype.updateShadowProperties = function() {
        updateBattlerShadow.call(this);
    };

    Sprite_Actor.prototype.updateShadowProperties = function() {
        updateBattlerShadow.call(this);
    };

    Sprite_Battler.prototype.updateShadow = function() {
        updateBattlerShadowState.call(this);
    };
    
    Sprite_Actor.prototype.updateShadow = function() {
        updateBattlerShadowState.call(this);
    };

    Sprite_Actor.prototype.update = updateBattlerWithShadow(Sprite_Actor.prototype.update);
    Sprite_Enemy.prototype.update = updateBattlerWithShadow(Sprite_Enemy.prototype.update);

    const _Sprite_Actor_updateBitmap = Sprite_Actor.prototype.updateBitmap;
    Sprite_Actor.prototype.updateBitmap = function() {
        _Sprite_Actor_updateBitmap.call(this);
        this.updateShadow();
    };

    // Clean ip
    const _Scene_Battle_terminate = Scene_Battle.prototype.terminate;
    Scene_Battle.prototype.terminate = function() {
        if (this._spriteset) {
            this._spriteset._actorSprites.forEach(sprite => sprite.removeShadowIfExist());
            this._spriteset._enemySprites.forEach(sprite => sprite.removeShadowIfExist());
        }
        _Scene_Battle_terminate.call(this);
    };

    // Initialize shadows when battle starts
    const _Spriteset_Battle_createLowerLayer = Spriteset_Battle.prototype.createLowerLayer;
    Spriteset_Battle.prototype.createLowerLayer = function() {
        _Spriteset_Battle_createLowerLayer.call(this);
            this._actorSprites.forEach(sprite => {
                if (sprite._mainSprite) sprite.updateShadow();
            });
            this._enemySprites.forEach(sprite => {
                if (sprite.bitmap) sprite.updateShadow();
            });
    };

    // Remove default shadow from Sprite_Actor
    const _battlerShadows = Sprite_Actor.prototype.createShadowSprite;
    Sprite_Actor.prototype.createShadowSprite = function () {
        if (combatShadowActor) {
            return;
        } else {
            _battlerShadows.call(this);
        }
    };

    // ==============================================================

    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        const contents = _DataManager_makeSaveContents.call(this);
        contents.shadowSettings = {
            offsetX: offsetX,
            offsetY: offsetY,
            opacity: shadowOpacity,
            displayPlayerShadow: displayPlayerShadow,
            displayEventShadow: displayEventShadow,
            inactiveNotetags: Array.from(inactiveNotetags)
        };
        return contents;
    };

    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);
        updateShadowCastingState();
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        _DataManager_extractSaveContents.call(this, contents);
        if (contents.shadowSettings) {
            offsetX = contents.shadowSettings.offsetX;
            offsetY = contents.shadowSettings.offsetY;
            shadowOpacity = contents.shadowSettings.opacity;
            displayPlayerShadow = contents.shadowSettings.displayPlayerShadow;
            displayEventShadow = contents.shadowSettings.displayEventShadow;
            inactiveNotetags = new Set(contents.shadowSettings.inactiveNotetags || []);
        }
        updateShadowCastingState();
    };
})();

// Rizuki's Mod (Dynamic Ground-Raycasting Shadow with Edge Protection)
(() => {
    if (!Sprite_Character.prototype.updateShadowProperties) return;

    const _updateShadowProperties = Sprite_Character.prototype.updateShadowProperties;
    Sprite_Character.prototype.updateShadowProperties = function () {
        _updateShadowProperties.call(this);

        if (!this._shadowSprite || !this._character) return;

        const char = this._character;
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const isAirborne = !!char._jumping;

        // Active character elevations
        const currentBaseZ = char._baseZ !== undefined ? char._baseZ : (char.zTier || 0);
        const charZPoint = char.zPoint !== undefined ? char.zPoint : currentBaseZ;

        let groundSurfaceZ = 0;

        // --- 1. IF GROUNDED: Lock shadow directly to character's current standing tier ---
        if (!isAirborne) {
            groundSurfaceZ = currentBaseZ;
        } else {
            // --- 2. IF AIRBORNE: Raycast to find the highest floor under the feet ---
            const charW = (char.width ? char.width() : 1) * tw;
            const charH = (char.height ? char.height() : 1) * th;
            const footX = (char._realX * tw) + (charW / 2);
            // Check slightly inside the foot line to prevent edge drop-off glitches
            const footY = (char._realY * th) + charH - 2;

            if (RK && RK.CollisionMZ && RK.CollisionMZ.SpatialPartition) {
                const nearby = RK.CollisionMZ.SpatialPartition.getNearby(footX, footY, 1, 1);
                let highestSupport = 0;

                for (let i = 0; i < nearby.length; i++) {
                    const col = nearby[i];
                    if (col.terrainId === 'crumble' && col._isCollapsed) continue;
                    if (col.terrainId === 'pitfall' || col.isHole) continue;
                    if (col.isAirSlide || col.terrainId === 'slide') continue;

                    // Apply a 2px padding to avoid edge drop-off flickering
                    if (footX >= col.x - 2 && footX <= col.x + col.w + 2 && 
                        footY >= col.y - 2 && footY <= col.y + col.h + 2) {
                        
                        const surfZ = RK.CollisionMZ.Math.getZElevation(footX, footY, col);
                        if (surfZ <= charZPoint + 0.1 && surfZ > highestSupport) {
                            highestSupport = surfZ;
                        }
                    }
                }
                groundSurfaceZ = highestSupport;
            }
        }

        // --- 3. PROJECT SHADOW TO DETECTED SURFACE ---
        const jumpY = char._jumpY || 0;
        const baselineZ = isAirborne ? (char._launchBaseZ !== undefined ? char._launchBaseZ : currentBaseZ) : currentBaseZ;

        // If falling down a cliff, lock the shadow to the predetermined landing point outside the cliff edge!
        if (isAirborne && char._cliffLandingTargetY !== undefined) {
            groundSurfaceZ = char._targetFallFloorZ !== undefined ? char._targetFallFloorZ : 0;
            const landingOffsetPixelsY = (char._cliffLandingTargetY - char._realY) * th;
            const surfaceDeltaPixels = (baselineZ - groundSurfaceZ) * 48.0;

            this._shadowSprite.y = (this._shadowSprite.y - jumpY) + surfaceDeltaPixels + landingOffsetPixelsY;
        } else {
            // Normal jump / ground shadow projection
            const surfaceDeltaPixels = (baselineZ - groundSurfaceZ) * 48.0;
            this._shadowSprite.y = (this._shadowSprite.y - jumpY) + surfaceDeltaPixels;
        }

        // Compensate custom shake / bounce / graphical offsets
        if (char._bounceOffsetY) this._shadowSprite.y -= char._bounceOffsetY;
        if (char._shakeOffsetY) this._shadowSprite.y -= char._shakeOffsetY;
        if (char._shakeOffsetX) this._shadowSprite.x -= char._shakeOffsetX;

        if (char === $gamePlayer && typeof playerGraphicalOffsetY !== 'undefined') {
            this._shadowSprite.y -= playerGraphicalOffsetY;
            this._shadowSprite.x -= playerGraphicalOffsetX;
        }

        // --- 4. DYNAMIC ALTITUDE & VISUAL SCALING ---
        const altitudeTiers = Math.max(0, charZPoint - groundSurfaceZ);
        const altitudePixels = altitudeTiers * 48.0;

        const maxExpectedHeight = Math.max(char._maxJumpHeight || 48, 96);
        const heightRatio = Math.min(altitudePixels / maxExpectedHeight, 1.0);

        // Scale Factor (shrink when high in the air)
        const scaleFactor = 1.0 - (0.45 * heightRatio);
        this._shadowSprite.scale.x *= scaleFactor;
        this._shadowSprite.scale.y *= scaleFactor;

        // Opacity (fade when higher)
        const baseOpacity = (this.opacity || 255) * 0.5;
        this._shadowSprite.opacity = Math.round(baseOpacity * (1.0 - 0.55 * heightRatio));

        // Softness / Blur
        const blurAmount = heightRatio * 7.0;
        if (!this._shadowBlurFilter) {
            this._shadowBlurFilter = new PIXI.filters.BlurFilter(blurAmount);
            this._shadowSprite.filters = [this._shadowBlurFilter];
        } else {
            this._shadowBlurFilter.blur = blurAmount;
        }
    };
})();