/*:
 * @target MZ
 * @plugindesc An all-in-one plugin that helps you create high quality action games with ease.
 * @author Sang Hendrix
 * @url https://sanghendrix.itch.io/
 * 
 * @help
 * Version 1.5.0
 * ----------------------------------------------------------------------------
 * This powerful RPG Maker MZ plugin lets you create real-time action games like
 * ARPGs, top-down shooters, beat 'em ups, and more. Designed for ease of use,
 * it builds on RPG Maker’s built-in eventing system.
 * ----------------------------------------------------------------------------
 * HOW TO USE
 * Please visit this link for the manual, which contains all extended features
 * for Movement Route, Conditional Branches, and plugin commands:
 * https://rpgmakeractioncombatmanual.blogspot.com
 * 
 * ■ All expansions and add-ons: 
 * https://itch.io/c/5532775/rpg-maker-action-combat-mz-active-battle-system
 * 
 * ■ Video Trailer: https://www.youtube.com/watch?v=zcXZNgt3V50
 * ----------------------------------------------------------------------------
 * HOW TO INSTALL
 * 1. Copy all plugins from RPG Maker Action Combat folder
 * 2. Paste them to your project's plugins folder
 * 3. Enable them in your plugin list (Hendrix Action Engine & Dot Move System).
 * ----------------------------------------------------------------------------
 * TERMS OF USE
 * ■ Acquiring this plugin legally grants permission for use in free and commercial games.
 * ■ Modify as needed, but do not redistribute modifications.
 * ----------------------------------------------------------------------------
 * For support or feature requests:
 * X: https://x.com/sanghendrix96
 * Discord: https://discord.gg/YKPscqHV8b
 * Patreon: https://www.patreon.com/SangHendrix
 * ----------------------------------------------------------------------------
 * 
 * @param Player Graphical Offset
 * @text Player Graphical Offset
 * @desc Graphical offset X, Y for the player sprite (e.g., 0, 0)
 * @default 0, 0
 * 
 * @param Move via Cursor
 * @text Move via Cursor Click
 * @type boolean
 * @desc Move player when clicking/touching on map
 * @default false
 * 
 * @command PlayerJump
 * @text Jumping
 * @desc Makes a target jump
 * 
 * @arg target
 * @text Target
 * @type string
 * @desc Which character should jump: player, this, event ID, or <notetag>
 * @default player
 * 
 * @arg height
 * @text Jump Height
 * @type number
 * @default 100
 * @desc Height of the jump in pixels
 * 
 * @arg power
 * @text Jump Power
 * @type number
 * @default 12
 * @desc Power/speed of the jump (higher = faster rise and fall)
 *
 * @arg keepZLayer
 * @text Keep Z-Layer
 * @type boolean
 * @default false
 * @desc If true, the jump will NOT change the target's z-layer/priority during the jump.
 * 
 * @command StopQueue
 * @text Stop Movement Queue
 * @desc Immediately stops whatever movement or route command the event is processing.
 * 
 * @command ControlPlayerMovement
 * @text Player Movement Control
 * @desc Controls whether player movement input is allowed or disallowed.
 *
 * @arg allowMovement
 * @type boolean
 * @text Allow Movement
 * @desc Allow or disallow player movement
 * @on Allow
 * @off Disallow
 * @default true
 */

var Imported = Imported || {};
Imported.Hendrix_Action_Engine = true;

const HpluginName = "Hendrix_Action_Engine";
const Hparameters = PluginManager.parameters(HpluginName);
const [playerGraphicalOffsetX, playerGraphicalOffsetY] = (Hparameters["Player Graphical Offset"] || "0, 0")
	.split(',')
	.map(val => Number(val.trim()));
const moveViaCursor = Hparameters['Move via Cursor'] === 'true';

//============================================================
// INITIALIZATION & FRAMEWORK MODIFICATION
//============================================================
const H_DotMoveSystem = PluginManager._scripts.includes('DotMoveSystem');

const _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
Scene_Map.prototype.processMapTouch = function () {
	if (!moveViaCursor) return;
	_Scene_Map_processMapTouch.call(this);
};

Game_Party.prototype.maxItems = function () {
	return 9999;
};

//==========================================================
// CLEANED EVENT UPDATES
//==========================================================

const _Game_Event_setupPage = Game_Event.prototype.setupPage;
Game_Event.prototype.setupPage = function () {
	const hadPassBefore = this._pageIndex >= 0 &&
		$gameMap._passEvents &&
		$gameMap._passEvents.has(this._eventId);
	_Game_Event_setupPage.call(this);
	
	this.setupFrameSpeed();
	
	if ($gameMap._passEvents) {
		const hasPassNow = this._pageIndex >= 0 && this.event().note.includes('<pass>');

		if (hasPassNow && !hadPassBefore) {
			$gameMap._passEvents.add(this._eventId);
		} else if (!hasPassNow && hadPassBefore) {
			$gameMap._passEvents.delete(this._eventId);
		}
	}
};

const H_Game_Event_update = Game_Event.prototype.update;
Game_Event.prototype.update = function () {
	const shouldUpdate = !$gameMap._eventsPaused || ($gameMap._pausingEventId && this._eventId === $gameMap._pausingEventId);
	if (shouldUpdate) {
		H_Game_Event_update.call(this);
	}
};

const H_Game_Map_setup = Game_Map.prototype.setup;
Game_Map.prototype.setup = function (mapId) {
	this._eventsPaused = false;
	this._pausingEventId = null;
	H_Game_Map_setup.call(this, mapId);
};

//============================================================
// DETECTION AND CUSTOM MOVEMENT
//============================================================

Game_Character.prototype.moveTowardPlayer = function () {
	const d = this.findDirectionTo($gamePlayer.x, $gamePlayer.y);
	if (d === 0) return;  // No path found

	let horz = 0;
	let vert = 0;

	switch (d) {
		case 1: horz = 4; vert = 2; break;
		case 2: vert = 2; break;
		case 3: horz = 6; vert = 2; break;
		case 4: horz = 4; break;
		case 6: horz = 6; break;
		case 7: horz = 4; vert = 8; break;
		case 8: vert = 8; break;
		case 9: horz = 6; vert = 8; break;
	}

	if (horz !== 0) {
		this.setDirection(horz);
	} else {
		this.setDirection(vert);
	}

	if (horz !== 0 && vert !== 0) {
		this.moveDiagonally(horz, vert);
	} else {
		this.moveStraight(d);
	}
};

Game_Event.prototype.searchLimit = function () {
	return 10;
};

//============================================================
// DOT MOVE ADD-ON FEATURES
//============================================================
Game_Character.prototype.dash = function (steps, targetSpec = null, untilReach = false, dynamic = false, stopAtTarget = false) {
	if (H_DotMoveSystem) {
		if (targetSpec !== null && targetSpec !== undefined && targetSpec !== "") {
		  	let target = null;

		  	if (targetSpec === "player") {
		    	target = $gamePlayer;
		  	} else if (typeof targetSpec === "number" || (!isNaN(targetSpec) && targetSpec !== true && targetSpec !== false)) {
		    	target = $gameMap.event(Number(targetSpec));
		  	} else if (typeof targetSpec === "string" && targetSpec.startsWith("<") && targetSpec.endsWith(">")) {
			    let best = null;
			    let bestDist = Infinity;
			    $gameMap.events().forEach(ev => {
			      	if (!ev || ev === this) return;
			      	if (ev.event()?.note?.includes(targetSpec)) {
				        const dx = ev.x - this.x;
				        const dy = ev.y - this.y;
				        const d2 = dx * dx + dy * dy;
				        if (d2 < bestDist) {
		          			bestDist = d2;
		          			best = ev;
		        		}
		      		}
		    	});
		    	target = best;
		  	}

		  	if (!target) return;

			const fromPoint = this.positionPoint();
			const toPoint = target.positionPoint();

			const distToTarget = fromPoint.calcFar(toPoint);
			if (distToTarget <= 0) return;

			const degree = fromPoint.calcDeg(toPoint).value;
		  	const faceDir = this.convertAngleToDirection(degree);
		  	this.setDirection(faceDir);

		  	const baseDistance = steps * this.distancePerFrame() * 3;
		  	let distance;
			if (untilReach && stopAtTarget) {
			  	distance = distToTarget;
			} else if (stopAtTarget) {
			  	distance = Math.min(baseDistance, distToTarget);
			} else if (untilReach) {
			  	distance = 999999;
			} else {
			  	distance = baseDistance;
			}

			const forceHoming = untilReach && stopAtTarget;
			if (dynamic || forceHoming) {
			  	this._haeDashCtl = {
				    enabled: true,
				    target: target,
				    untilReach: !!untilReach,
				    stopAtTarget: !!stopAtTarget,
				    remaining: untilReach ? Infinity : baseDistance,
				    dpf: this.distancePerFrame() * 3,
				    stopR: 0.35,  
				    stall: 0,
				    stallMax: 8
			  	};
			  	return;
			}

		  	const degObj = new DotMoveSystemClassAlias.Degree(degree);
		  	this.mover().startContinuousMove(distance, degObj);
		  	return;
		}

		if (typeof Input !== 'undefined' && Input.leftStick && navigator.getGamepads && navigator.getGamepads()[0]) {
			const [rad, power] = Input.leftStick;

			if (power > 0.1) {
				const degree = AnalogStickUtils.rad2deg(rad);
				const direction = this.convertAngleToDirection(degree);
				this.setDirection(direction);
				const distance = steps * this.distancePerFrame() * 3;
				const deg = new DotMoveSystemClassAlias.Degree(degree);
				this.mover().startContinuousMove(distance, deg);
				return;
			}
		}

		if (typeof $virtualStickController !== 'undefined' && $virtualStickController &&
			typeof $virtualStickController.deg === 'function' && $virtualStickController.deg() != null) {
			let degree = $virtualStickController.deg();
			const direction = this.convertAngleToDirection(degree);
			this.setDirection(direction);
			let rad = (degree - 90) * Math.PI / 180;
			let x = Math.cos(rad);
			let y = -Math.sin(rad);

			if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
				const distance = steps * this.distancePerFrame() * 3;
				const deg = new DotMoveSystemClassAlias.Degree(degree);
				this.mover().startContinuousMove(distance, deg);
			} else {
				const distance = steps * this.distancePerFrame() * 3;
				const deg = DotMoveSystemClassAlias.Degree.fromDirection(direction);
				this.mover().startContinuousMove(distance, deg);
			}
		} else {
			const isUp = Input.isPressed('up');
			const isDown = Input.isPressed('down');
			const isLeft = Input.isPressed('left');
			const isRight = Input.isPressed('right');
			let direction = null;

			if (isUp && isRight) {
				direction = 9;
				if (Imported.Hendrix_Animation_Solution &&
					this.is8DirSprite && this.is8DirSprite()) {
					this.setDirection(9);
				} else {
					this.setDirection(6);
				}
			} else if (isUp && isLeft) {
				direction = 7;
				if (Imported.Hendrix_Animation_Solution &&
					this.is8DirSprite && this.is8DirSprite()) {
					this.setDirection(7);
				} else {
					this.setDirection(4);
				}
			} else if (isDown && isRight) {
				direction = 3;
				if (Imported.Hendrix_Animation_Solution &&
					this.is8DirSprite && this.is8DirSprite()) {
					this.setDirection(3);
				} else {
					this.setDirection(6);
				}
			} else if (isDown && isLeft) {
				direction = 1;
				if (Imported.Hendrix_Animation_Solution &&
					this.is8DirSprite && this.is8DirSprite()) {
					this.setDirection(1);
				} else {
					this.setDirection(4);
				}
			} else if (isUp) {
				direction = 8;
				this.setDirection(8);
			} else if (isDown) {
				direction = 2;
				this.setDirection(2);
			} else if (isLeft) {
				direction = 4;
				this.setDirection(4);
			} else if (isRight) {
				direction = 6;
				this.setDirection(6);
			} else {
				direction = this.direction();
			}

			if (direction !== null) {
				const distance = steps * this.distancePerFrame() * 3;
				const deg = DotMoveSystemClassAlias.Degree.fromDirection(direction);
				this.mover().startContinuousMove(distance, deg);
			}
		}
	}
};

Game_Character.prototype.reverseDash = function (steps) {
	if (!H_DotMoveSystem) return;

	const oppDir = (d) => {
		switch (d) {
			case 1: return 9;
			case 2: return 8;
			case 3: return 7;
			case 4: return 6;
			case 6: return 4;
			case 7: return 3;
			case 8: return 2;
			case 9: return 1;
			default: return d;
		}
	};

	if (typeof Input !== 'undefined' && Input.leftStick && navigator.getGamepads && navigator.getGamepads()[0]) {
		const [rad, power] = Input.leftStick;

		if (power > 0.1) {
			const degree = AnalogStickUtils.rad2deg(rad);
			const faceDir = this.convertAngleToDirection(degree);
			this.setDirection(faceDir);

			const distance = steps * this.distancePerFrame() * 3;
			const deg = new DotMoveSystemClassAlias.Degree((degree + 180) % 360);
			this.mover().startContinuousMove(distance, deg);
			return;
		}
	}

	if (typeof $virtualStickController !== 'undefined' && $virtualStickController &&
		typeof $virtualStickController.deg === 'function' && $virtualStickController.deg() != null) {

		let degree = $virtualStickController.deg();
		const faceDir = this.convertAngleToDirection(degree);
		this.setDirection(faceDir);

		let rad = (degree - 90) * Math.PI / 180;
		let x = Math.cos(rad);
		let y = -Math.sin(rad);

		const distance = steps * this.distancePerFrame() * 3;

		if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
			const deg = new DotMoveSystemClassAlias.Degree((degree + 180) % 360);
			this.mover().startContinuousMove(distance, deg);
		} else {
			const deg = DotMoveSystemClassAlias.Degree.fromDirection(oppDir(faceDir));
			this.mover().startContinuousMove(distance, deg);
		}
		return;
	}

	const isUp = Input.isPressed('up');
	const isDown = Input.isPressed('down');
	const isLeft = Input.isPressed('left');
	const isRight = Input.isPressed('right');
	let direction = null;

	if (isUp && isRight) {
		direction = 9;
		if (Imported.Hendrix_Animation_Solution && this.is8DirSprite && this.is8DirSprite()) this.setDirection(9);
		else this.setDirection(6);
	} else if (isUp && isLeft) {
		direction = 7;
		if (Imported.Hendrix_Animation_Solution && this.is8DirSprite && this.is8DirSprite()) this.setDirection(7);
		else this.setDirection(4);
	} else if (isDown && isRight) {
		direction = 3;
		if (Imported.Hendrix_Animation_Solution && this.is8DirSprite && this.is8DirSprite()) this.setDirection(3);
		else this.setDirection(6);
	} else if (isDown && isLeft) {
		direction = 1;
		if (Imported.Hendrix_Animation_Solution && this.is8DirSprite && this.is8DirSprite()) this.setDirection(1);
		else this.setDirection(4);
	} else if (isUp) {
		direction = 8; this.setDirection(8);
	} else if (isDown) {
		direction = 2; this.setDirection(2);
	} else if (isLeft) {
		direction = 4; this.setDirection(4);
	} else if (isRight) {
		direction = 6; this.setDirection(6);
	} else {
		direction = this.direction();
	}

	if (direction !== null) {
		const distance = steps * this.distancePerFrame() * 3;
		const deg = DotMoveSystemClassAlias.Degree.fromDirection(oppDir(direction));
		this.mover().startContinuousMove(distance, deg);
	}
};

Game_Character.prototype.convertAngleToDirection = function (angle) {
	angle = ((angle % 360) + 360) % 360;
	if (Imported.Hendrix_Animation_Solution && this.is8DirSprite && this.is8DirSprite()) {
		if (angle >= 337.5 || angle < 22.5) return 8;
		if (angle >= 22.5 && angle < 67.5) return 9;
		if (angle >= 67.5 && angle < 112.5) return 6;
		if (angle >= 112.5 && angle < 157.5) return 3;
		if (angle >= 157.5 && angle < 202.5) return 2;
		if (angle >= 202.5 && angle < 247.5) return 1;
		if (angle >= 247.5 && angle < 292.5) return 4;
		if (angle >= 292.5 && angle < 337.5) return 7;
	} else {
		if (angle >= 340 || angle < 30) return 8;
		if (angle >= 30 && angle < 150) return 6;
		if (angle >= 150 && angle < 210) return 2;
		if (angle >= 210 && angle < 340) return 4;
	}

	return 2;
};

//============================================================
// MOVEMENT CONTROLS & COMMANDS
//============================================================

PluginManager.registerCommand(HpluginName, "StopQueue", function () {
	const event = this.character(0);
	if (event && event instanceof Game_Event) {
		event.stopQueue();
		if (this._eventId > 0) {
			this._waitMode = '';
		}
		event._waitCount = 0;
	}
});

Game_Event.prototype.stopQueue = function () {
	this._moveRouteForcing = false;
	this._moveRoute = null;
	this._moveRouteIndex = 0;
	this.clearMovementWait();
};

Game_Event.prototype.clearMovementWait = function () {
	this._waitCount = 0;
	this._moving = false;
	this.resetStopCount();
	this.straighten();
};

//============================================================
// DOT MOVE ADD ON
//============================================================

const _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
Game_CharacterBase.prototype.initMembers = function () {
	_Game_CharacterBase_initMembers.call(this);
	this._rotation = 0;
	this._originPoint = "center";
	this._useCustomRotation = false;
};

Game_CharacterBase.prototype.rotation = function () {
	return this._rotation;
};

Game_CharacterBase.prototype.setRotation = function (deg) {
	this._rotation = deg;
};

Game_CharacterBase.prototype.originPoint = function () {
	return this._originPoint;
};

Game_CharacterBase.prototype.setOriginPoint = function (origin) {
	this._originPoint = origin;
};

Game_CharacterBase.prototype.setCustomRotation = function (enabled) {
	this._useCustomRotation = enabled;
};

const H_Sprite_Character_updatePosition = Sprite_Character.prototype.updatePosition;
Sprite_Character.prototype.updatePosition = function () {
	H_Sprite_Character_updatePosition.call(this);

	if (this._character === $gamePlayer && (playerGraphicalOffsetX !== 0 || playerGraphicalOffsetY !== 0)) {
		this.x += playerGraphicalOffsetX;
		this.y += playerGraphicalOffsetY;
	}

	if (this._character instanceof Game_Event) {
		const event = this._character.event();
		if (event.meta && event.meta['sprite offset']) {
			if (event._cachedSpriteOffsetX === undefined) {
				const offsetString = event.meta['sprite offset'];
				const offsetMatch = offsetString.match(/(-?\d+)\s*,\s*(-?\d+)/);

				if (offsetMatch) {
					const offsetX = parseInt(offsetMatch[1]);
					const offsetY = parseInt(offsetMatch[2]);

					event._cachedSpriteOffsetX = !isNaN(offsetX) ? offsetX : 0;
					event._cachedSpriteOffsetY = !isNaN(offsetY) ? offsetY : 0;
				} else {
					event._cachedSpriteOffsetX = 0;
					event._cachedSpriteOffsetY = 0;
				}
			}

			this.x += event._cachedSpriteOffsetX;
			this.y += event._cachedSpriteOffsetY;
		}
	}

	if (this._character && this._character._useCustomRotationForMoveTowardPoint) {
		this.rotation = (this._character.rotation() * Math.PI) / 180;

		const origin = this._character.originPoint();
		const offsetDistance = 24;

		if (this._character._cachedShouldCheckFlip === undefined) {
			this._character._cachedShouldCheckFlip = origin === 'player' ||
				(!isNaN(origin)) ||
				origin.startsWith('<') ||
				$gameMap.events().some(event => event.event().name === origin);
		}

		if (this._character._cachedShouldCheckFlip) {
			let currentAngle = this._character.rotation() % 360;
			if (currentAngle < 0) currentAngle += 360;

			this.scale.x = (currentAngle >= 179 && currentAngle <= 359) ? -1 : 1;
		}

		if (origin === 'player') {
			this.x = $gamePlayer.screenX();
			this.y = $gamePlayer.screenY() - offsetDistance;
		} else if (!isNaN(origin)) {
			const event = $gameMap.event(Number(origin));
			if (event) {
				this.x = event.screenX();
				this.y = event.screenY() - offsetDistance;
			}
		} else if (origin.startsWith('<')) {
			let nearest = null;
			let minDistSquared = Infinity;
			const charX = this._character.x;
			const charY = this._character.y;
			$gameMap.events().forEach(event => {
				if (event.event().note.includes(origin)) {
					const dx = event.x - charX;
					const dy = event.y - charY;
					const distSquared = dx * dx + dy * dy;

					if (distSquared < minDistSquared) {
						minDistSquared = distSquared;
						nearest = event;
					}
				}
			});
			if (nearest) {
				this.x = nearest.screenX();
				this.y = nearest.screenY() - offsetDistance;
			}
		} else {
			if (this._character._cachedNamedEvent === undefined) {
				this._character._cachedNamedEvent = $gameMap.events().find(event => event.event().name === origin) || null;
			}
			const namedEvent = this._character._cachedNamedEvent;
			if (namedEvent) {
				this.x = namedEvent.screenX();
				this.y = namedEvent.screenY() - offsetDistance;
			} else {
				switch (origin) {
					case "top-left":
						this.anchor.x = 0;
						this.anchor.y = 0;
						break;
					case "top":
						this.anchor.x = 0.5;
						this.anchor.y = 0;
						break;
					case "top-right":
						this.anchor.x = 1;
						this.anchor.y = 0;
						break;
					case "right":
						this.anchor.x = 1;
						this.anchor.y = 0.5;
						break;
					case "bottom-right":
						this.anchor.x = 1;
						this.anchor.y = 1;
						break;
					case "bottom":
						this.anchor.x = 0.5;
						this.anchor.y = 1;
						break;
					case "bottom-left":
						this.anchor.x = 0;
						this.anchor.y = 1;
						break;
					case "left":
						this.anchor.x = 0;
						this.anchor.y = 0.5;
						break;
					case "center":
					default:
						this.anchor.x = 0.5;
						this.anchor.y = 0.5;
						break;
				}
			}
		}
	} else {
		this.rotation = 0;
	}

	if (this._character._shakeOffsetX !== undefined) {
		this.x += this._character._shakeOffsetX;
	}
	if (this._character._shakeOffsetY !== undefined) {
		this.y += this._character._shakeOffsetY;
	}
	if (this._character._bounceOffsetY !== undefined) {
		this.y += this._character._bounceOffsetY;
	}
};

if (H_DotMoveSystem) {
	DotMoveSystem.DotMoveUtils.direction2Axis = function (direction) {
		if (direction === 4 || direction === 6) {
			return "x";
		}
		else if (direction === 8 || direction === 2) {
			return "y";
		}
		else if (direction === 9 || direction === 3 || direction === 7 || direction === 1) {
			return "y";
		}
		else {
			throw new Error(`${direction} is not found`);
		}
	};

	DotMoveSystem.CharacterMover.prototype.moveToTarget = function (targetPoint) {
		const fromPoint = this._character.positionPoint();
		const deg = fromPoint.calcDeg(targetPoint);
		const dir = deg.toDirection4(this._character.direction());
		this.setDirection(dir);

		const moved = this.createDotMoveProcess().dotMoveByDeg(deg, this._character.distancePerFrame());
		this._character.moveCallback(moved, this._character.distancePerFrame());
	};

	DotMoveSystem.CharacterMover.prototype.moveToTargetContinous = function (targetPoint) {
		const fromPoint = this._character.positionPoint();
		const deg = fromPoint.calcDeg(targetPoint);
		const dir = deg.toDirection4(this._character.direction());
		this.setDirection(dir);
		const targetFar = fromPoint.calcFar(targetPoint);
		this.startContinuousMove(targetFar, deg);
	};

	Game_Character.prototype.moveToTargetContinous = function (x, y) {
		this.mover().moveToTargetContinous(new DotMoveSystem.DotMovePoint(x, y));
	};

	DotMoveSystem.EventDotMoveTempData.prototype.initialize = function (character) {
		DotMoveSystem.CharacterDotMoveTempData.prototype.initialize.call(this, character);
		const values = character.getAnnotationValues(0);

		if (values.collisionRect != null) {
			const parts = values.collisionRect.split(',').map(part => parseFloat(part.trim()));
			if (parts.length >= 2) {
				this._width = parts[0];
				this._height = parts[1];
				this._offsetX = parts.length >= 3 ? parts[2] : 0;
				this._offsetY = parts.length >= 4 ? parts[3] : 0;
			}
		} else {
			this._width = values.width != null ? parseFloat(values.width) : 1;
			this._height = values.height != null ? parseFloat(values.height) : 1;
			this._offsetX = values.offsetX != null ? parseFloat(values.offsetX) : 0;
			this._offsetY = values.offsetY != null ? parseFloat(values.offsetY) : 0;
		}

		this._widthArea = values.widthArea != null ? parseFloat(values.widthArea) : 0.5;
		this._heightArea = values.heightArea != null ? parseFloat(values.heightArea) : 0.5;
		this._slideLengthX = values.slideLengthX != null ? parseFloat(values.slideLengthX) : 0.5;
		this._slideLengthY = values.slideLengthY != null ? parseFloat(values.slideLengthY) : 0.5;
		this._eventTouchToPlayer = false;
	};

	Game_Map.prototype.allCharacters = function () {
		return new Set([$gamePlayer, ...this.events(), ...$gamePlayer.followers().data()]);
	};

	Game_Player.prototype.checkCollisionTargetCharacter = function (x, y, d, character) {
		if (character instanceof Game_Event) {
			return this.checkCollisionTargetEvent(x, y, d, character);
		}
		return false;
	};

	Game_CharacterBase.prototype.updateMapCharactersCache = function () {
		if (this instanceof Game_Vehicle) {
			return;
		}
		this.dotMoveTempData().mapCharacterCacheUpdater.updateMapCharactersCache();
	};
};

//============================================================
// PLAYER MOVEMENT (BLOCK OR UNBLOCK)
//============================================================

let playerMovementDisabled = false;
const movementKeys = ["left", "up", "right", "down", "downLeft", "downRight", "upLeft", "upRight"];

const originalInput_isPressed = Input.isPressed;
Input.isPressed = function (keyName) {
	if (playerMovementDisabled && movementKeys.includes(keyName)) return false;
	return originalInput_isPressed.call(this, keyName);
};

const originalInput_isRepeated = Input.isRepeated;
Input.isRepeated = function (keyName) {
	if (playerMovementDisabled && movementKeys.includes(keyName)) return false;
	return originalInput_isRepeated.call(this, keyName);
};

const originalInput_isLongPressed = Input.isLongPressed;
Input.isLongPressed = function (keyName) {
	if (playerMovementDisabled && movementKeys.includes(keyName)) return false;
	return originalInput_isLongPressed.call(this, keyName);
};

const originalInput__pollGamepads = Input._pollGamepads;
Input._pollGamepads = function () {
	if (playerMovementDisabled) return;
	originalInput__pollGamepads.call(this);
};

PluginManager.registerCommand(HpluginName, "ControlPlayerMovement", args => {
	playerMovementDisabled = !(args.allowMovement === 'true');
});

//============================================================
// EVENT FRAME ANIMATION SPEED
//============================================================

const _Game_Event_initMembers = Game_Event.prototype.initMembers;
Game_Event.prototype.initMembers = function () {
	_Game_Event_initMembers.call(this);
	this._frameASpeed = null;
};

Game_Event.prototype.setupFrameSpeed = function () {
	if (this.page()) {
		const frameSpeed = this.extractFrameSpeedFromComment();
		this._frameASpeed = frameSpeed !== null ? frameSpeed : null;
	}
};

Game_Event.prototype.extractFrameSpeedFromComment = function () {
	const list = this.list();
	for (const command of list) {
		if (command.code === 108 || command.code === 408) {
			const regex = /<stepping speed:\s*(\d+)>/i;
			const match = regex.exec(command.parameters[0]);
			if (match) {
				return parseInt(match[1]);
			}
		}
	}
	return null;
};

Game_Event.prototype.customAnimationWait = function () {
	return this._frameASpeed !== null ? this._frameASpeed : null;
};

const _Sprite_Character_updatePattern = Sprite_Character.prototype.updatePattern;
Sprite_Character.prototype.updatePattern = function () {
	if (this._character instanceof Game_Event && this._character.customAnimationWait() !== null) {
		const frameSpeed = this._character.customAnimationWait();
		this._patternCounter = (this._patternCounter + 1) % frameSpeed;
		if (this._patternCounter === 0) {
			this._character.setPattern((this._character.pattern() + 1) % this._character.maxPattern());
		}
	} else {
		_Sprite_Character_updatePattern.call(this);
	}
};

const _Game_CharacterBase_animationWait = Game_CharacterBase.prototype.animationWait;
Game_CharacterBase.prototype.animationWait = function () {
	if (this instanceof Game_Event && this.customAnimationWait() !== null) {
		return this.customAnimationWait();
	} else {
		return _Game_CharacterBase_animationWait.call(this);
	}
};

// ================================================================
// 8 DIR - ANIMATION SOLUTION
// ================================================================

if (!Imported.Hendrix_Animation_Solution) {
	const spriteTypeCache = new Map();

	Game_CharacterBase.prototype.is8DirSprite = function () {
		if (!this._characterName) return false;
		if (spriteTypeCache.has(this._characterName)) {
			return spriteTypeCache.get(this._characterName);
		}
		const result = this._characterName.includes('8dir');
		spriteTypeCache.set(this._characterName, result);
		return result;
	};

	const _Game_CharacterBase_setDirection = Game_CharacterBase.prototype.setDirection;
	Game_CharacterBase.prototype.setDirection = function (d) {
		if (this.is8DirSprite()) {
			if ([1, 3, 7, 9].includes(d)) {
				this._direction = d;
				return;
			}
		}
		_Game_CharacterBase_setDirection.call(this, d);
	};

	if (H_DotMoveSystem) {
		const _Game_Character_dotMoveByDeg = Game_Character.prototype.dotMoveByDeg;
		Game_Character.prototype.dotMoveByDeg = function (deg) {
			_Game_Character_dotMoveByDeg.call(this, deg);
			if (this.is8DirSprite()) {
				const dir8 = (new DotMoveSystem.Degree(deg)).toDirection8();
				this.setDirection(dir8);
			}
		};

		const _CharacterMover_dotMoveByDirection = DotMoveSystem.CharacterMover.prototype.dotMoveByDirection;
		DotMoveSystem.CharacterMover.prototype.dotMoveByDirection = function (direction, dpf) {
			_CharacterMover_dotMoveByDirection.call(this, direction, dpf);

			const character = this._character;
			if (character && character.is8DirSprite()) {
				character.setDirection(direction);
			}
		};
	} else {
		const _Game_Player_getInputDirection = Game_Player.prototype.getInputDirection;
		Game_Player.prototype.getInputDirection = function () {
			if (this.is8DirSprite()) {
				return Input.dir8;
			} else {
				return _Game_Player_getInputDirection.call(this);
			}
		};

		const _Game_Player_executeMove = Game_Player.prototype.executeMove;
		Game_Player.prototype.executeMove = function (direction) {
			if (!this.is8DirSprite() || direction % 2 === 0) {
				_Game_Player_executeMove.call(this, direction);
			} else {
				let horz, vert;
				switch (direction) {
					case 7: horz = 4; vert = 8; break;
					case 9: horz = 6; vert = 8; break; 
					case 1: horz = 4; vert = 2; break;
					case 3: horz = 6; vert = 2; break;
				}
				this.moveDiagonally(horz, vert);
			}
		};

		const _Game_CharacterBase_moveDiagonally = Game_CharacterBase.prototype.moveDiagonally;
		Game_CharacterBase.prototype.moveDiagonally = function (horz, vert) {
			_Game_CharacterBase_moveDiagonally.call(this, horz, vert);

			if (this.is8DirSprite()) {
				if (horz === 4 && vert === 8) this.setDirection(7);
				if (horz === 6 && vert === 8) this.setDirection(9);
				if (horz === 4 && vert === 2) this.setDirection(1);
				if (horz === 6 && vert === 2) this.setDirection(3);
			}
		};
	}

	const _Sprite_Character_characterPatternY = Sprite_Character.prototype.characterPatternY;
	Sprite_Character.prototype.characterPatternY = function () {
		if (this._character && this._character.is8DirSprite()) {
			switch (this._character.direction()) {
				case 2: return 0;
				case 1: return 1;
				case 3: return 2;
				case 4: return 3;
				case 6: return 4;
				case 8: return 5;
				case 7: return 6;
				case 9: return 7;
				default: return 0;
			}
		} else {
			return _Sprite_Character_characterPatternY.call(this);
		}
	};

	const _Sprite_Character_patternHeight = Sprite_Character.prototype.patternHeight;
	Sprite_Character.prototype.patternHeight = function () {
		if (this._tileId > 0) {
			return $gameMap.tileHeight();
		} else if (this._character && this._character.is8DirSprite()) {
			return this.bitmap.height / 8;
		} else {
			return _Sprite_Character_patternHeight.call(this);
		}
	};

	window.checkDirection = function (target, direction) {
		let character = null;
		if (target.toLowerCase() === 'player') {
			character = $gamePlayer;
		}
		if (!character) return false;
		return character.direction() === direction;
	};

	window.getDirection = function (target) {
		let character = null;
		if (target.toLowerCase() === 'player') {
			character = $gamePlayer;
		}
		if (!character) {
			return -1;
		}
		return character.direction();
	};
}

//============================================================
// JUMP MECHANICS (DEBUG VERSION)
//============================================================

const jumpStateCache = new Map();

const _Game_CharacterBase_screenY = Game_CharacterBase.prototype.screenY;
Game_CharacterBase.prototype.screenY = function () {
    // 48 pixels visual lift per integer Z-Tier / float Z-Point
    const baseZPixels = (this._baseZ !== undefined ? this._baseZ : 0) * 48.0;
    return _Game_CharacterBase_screenY.call(this) + (this._jumpY || 0) - baseZPixels;
};

const H_Game_Player_initMembers = Game_Player.prototype.initMembers;
Game_Player.prototype.initMembers = function () {
	H_Game_Player_initMembers.call(this);
	this._jumping = false;
	this._jumpVelocity = 0;
	this._jumpGravity = 0.4;
	this._jumpY = 0;
	this._maxJumpHeight = 0;
};

Game_CharacterBase.prototype.setupJumpProperties = function () {
	if (this._jumpY === undefined) {
		this._jumping = false;
		this._jumpVelocity = 0;
		this._jumpGravity = 0.4;
		this._jumpY = 0;
		this._maxJumpHeight = 0;
	}
};

// Assuming 1 Z-Tier is 48 pixels tall.
Game_CharacterBase.prototype.zFloat = function() {
    const baseZ = this._zTier !== undefined ? this._zTier : 0;
    const jumpPixels = this._jumpY !== undefined ? Math.abs(this._jumpY) : 0;
    
    // Convert jump pixels to Tier decimals (e.g., 24px = 0.5 Tiers)
    const floatBonus = jumpPixels / 48.0; 
    
    return baseZ + floatBonus;
};

// Sync follower base elevation with the player when following steps
const _Game_Follower_update = Game_Follower.prototype.update;
Game_Follower.prototype.update = function() {
    _Game_Follower_update.call(this);
    if (!this._jumping && $gamePlayer) {
        this._baseZ = $gamePlayer._baseZ !== undefined ? $gamePlayer._baseZ : 0;
        this.zTier = $gamePlayer.zTier;
    }
};

Game_CharacterBase.prototype.updateJumpPhysics = function () {
    if (!this._jumping || this._jumpY === undefined) return;

    const tw = $gameMap.tileWidth();
    const th = $gameMap.tileHeight();
    const pW = (this.width ? this.width() : 1) * tw;
    const pH = (this.height ? this.height() : 1) * th;
    const footX = (this._realX * tw) + (pW / 2);
    const footY = (this._realY * th) + pH;

    // 1. Apply Gravity
    this._jumpVelocity += this._jumpGravity;
    if (this._jumpVelocity > 0 && this._fallGravity) {
        this._jumpGravity = this._fallGravity;
    }
    this._jumpY += this._jumpVelocity;

    if (typeof this.processCliffFallColliders === 'function') {
        this.processCliffFallColliders();
    }

    const launchZ = this._launchBaseZ !== undefined ? this._launchBaseZ : (this._baseZ || 0);
    const currentZ = launchZ + (Math.abs(this._jumpY) / 48.0);

    // -------------------------------------------------------------
    // 2. ASCENT: HEAD-BONK (ONLY ON TRUE OVERHEAD CEILINGS)
    // -------------------------------------------------------------
    if (this._jumpVelocity < 0) {
        const nearby = RK.CollisionMZ.SpatialPartition.getNearby(footX, footY, 1, 1);
        for (let i = 0; i < nearby.length; i++) {
            const col = nearby[i];
            
            // Only impassable ceiling/bridge obstacles block the head
            // (If an obstacle is tagged as a walkable platform or ramp, it won't bonk the head)
            const isCeilingObstacle = col.isCeiling || (col.isBlocking && col.terrainId === 'wall' && (col.zMax !== undefined && col.zMax > col.zTier));
            if (!isCeilingObstacle) continue;

            const colBottomZ = col.zMin !== undefined ? col.zMin : col.zTier;
            
            // Must strictly be an overhead barrier above our launch elevation
            if (colBottomZ > launchZ) {
                if (footX >= col.x && footX <= col.x + col.w && footY >= col.y && footY <= col.y + col.h) {
                    if (currentZ >= colBottomZ) {
                        const clampedZ = colBottomZ - 0.02;
                        this._jumpY = -Math.max(0, (clampedZ - launchZ) * 48.0);
                        
                        // Deflect downward immediately
                        this._jumpVelocity = Math.max(1.5, Math.abs(this._jumpVelocity) * 0.4);
                        this._lastBonkedCeiling = col;
                        break;
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------
    // 3. DESCENT: LANDING ON ELEVATED PLATFORMS OR STEPPING DOWN
    // -------------------------------------------------------------
    if (this._jumpVelocity > 0) {
    	// Do not land if currently sliding along an air slope
    	if (this._isAirSliding) {
            return;
        }

        // 3a. Ledge drop & Cliff Fall completion
        if (this._targetFallFloorZ !== undefined) {
            const dropDist = (launchZ - this._targetFallFloorZ) * 48.0;

            // IF FALLING OVER A CLIFF COLLIDER:
            if (this._cliffLandingTargetY !== undefined) {
                // Keep falling in the air until the character physically reaches the outside landing point!
                if (this._realY < this._cliffLandingTargetY - 0.02) {
                    // Hold visual _jumpY just above the ground plane while still moving toward the outside edge
                    if (this._jumpY > dropDist) {
                        this._jumpY = dropDist;
                    }
                    return;
                }

                // Reached the outside landing point AND completed the vertical drop!
                if (this._jumpY >= dropDist) {
                    const targetZ = this._targetFallFloorZ;
                    this._targetFallFloorZ = undefined;
                    this._cliffLandingTargetY = undefined;
                    this._isFallingCliff = false;
                    this._lastBonkedCeiling = null;
                    this.landOnSurface(targetZ);
                    return;
                }
                return;
            }

            // Standard ledge drop (non-cliff)
            if (this._jumpY >= dropDist) {
                const targetZ = this._targetFallFloorZ;
                this._targetFallFloorZ = undefined;
                this._lastBonkedCeiling = null;
                this.landOnSurface(targetZ);
                return;
            }
            return;
        }

        // 3b. Landing on elevated surfaces (Cliffs, Platforms, Tiers above launchZ)
        const nearby = RK.CollisionMZ.SpatialPartition.getNearby(footX, footY, 1, 1);
        let bestSurfaceZ = -1;
        let landingTarget = null;

        for (let i = 0; i < nearby.length; i++) {
            const col = nearby[i];
            if (this._lastBonkedCeiling === col) continue;

            // NEVER LAND ON A CLIFF COLLIDER:
            if (col.isAirSlide || col.terrainId === 'slide' || this._isFallingCliff) {
                continue;
            }

            if (footX >= col.x && footX <= col.x + col.w && footY >= col.y && footY <= col.y + col.h) {
                const surfaceZ = RK.CollisionMZ.Math.getZElevation(footX, footY, col);

                if (surfaceZ >= launchZ) {
                    const prevFrameZ = currentZ - (this._jumpVelocity / 48.0);
                    if (prevFrameZ >= surfaceZ && currentZ <= surfaceZ + 0.35) {
                        if (surfaceZ > bestSurfaceZ) {
                            bestSurfaceZ = surfaceZ;
                            landingTarget = col;
                        }
                    }
                }
            }
        }

        if (landingTarget) {
            this._lastBonkedCeiling = null;
            this.landOnSurface(bestSurfaceZ);
            return;
        }
    }

    // -------------------------------------------------------------
    // 4. BASE GROUND LANDING OR CONTINUOUS DROP
    // -------------------------------------------------------------
    if (this._jumpY >= 0 && this._targetFallFloorZ === undefined) {
    	// IF IN CLIFF FALL, DO NOT LAND
    	if (this._isFallingCliff || this._cliffLandingTargetY !== undefined) {
            return;
        }

        // Check if there is actual ground supporting the character at launchZ
        const nearby = RK.CollisionMZ.SpatialPartition.getNearby(footX, footY, 1, 1);
        let hasSupportAtLaunchZ = false;

        // If launched from map base ground (Tier 0), base ground is always solid
        if (launchZ <= 0) {
            hasSupportAtLaunchZ = true;
        } else {
            for (let i = 0; i < nearby.length; i++) {
                const col = nearby[i];
                if (footX >= col.x && footX <= col.x + col.w && footY >= col.y && footY <= col.y + col.h) {
                    const surfaceZ = RK.CollisionMZ.Math.getZElevation(footX, footY, col);
                    // If standing over a platform at or above our launch height
                    if (Math.abs(surfaceZ - launchZ) <= 0.3) {
                        hasSupportAtLaunchZ = true;
                        break;
                    }
                }
            }
        }

        if (hasSupportAtLaunchZ) {
            // Land normally on the platform you jumped from
            this._lastBonkedCeiling = null;
            this.landOnSurface(launchZ);
            return;
        } else {
            // NO PLATFORM UNDER FEET!
            // Do not stop! Convert smoothly into a fall toward the floor below (Tier 0 or lower platform)
            let lowerFloorZ = 0;
            for (let i = 0; i < nearby.length; i++) {
                const col = nearby[i];
                if (footX >= col.x && footX <= col.x + col.w && footY >= col.y && footY <= col.y + col.h) {
                    const surfaceZ = RK.CollisionMZ.Math.getZElevation(footX, footY, col);
                    if (surfaceZ < launchZ && surfaceZ > lowerFloorZ) {
                        lowerFloorZ = surfaceZ;
                    }
                }
            }
            // Set the target floor to Tier 0 (or lower ledge) and let downward gravity keep pulling!
            this._targetFallFloorZ = lowerFloorZ;
        }
    }

    // -------------------------------------------------------------
    // 5. SYNC VISUAL TIER LAYER
    // -------------------------------------------------------------
    const currentTier = Math.floor(this.zPoint);
    if (!this._jumpKeepZLayer && this._lastRenderTier !== currentTier) {
        this._lastRenderTier = currentTier;
        this.syncVisualTier(currentTier);
    }
};

Game_CharacterBase.prototype.landOnSurface = function(targetZ) {
    this._jumping = false;
    this._jumpY = 0;
    this._jumpVelocity = 0;
    this._baseZ = targetZ;
    this._launchBaseZ = targetZ;

    const finalTier = Math.floor(targetZ);
    this._lastRenderTier = finalTier;
    this.syncVisualTier(finalTier);

    if (typeof DotMoveSystem !== 'undefined' && this.dotMoveTempData) {
        const tempData = this.dotMoveTempData();
        if (tempData && tempData.mapCharacterCacheUpdater) {
            tempData.mapCharacterCacheUpdater.updateMapCharactersCache();
        }
    }
};

Game_CharacterBase.prototype.syncVisualTier = function(tier) {
    const safeTier = Math.max(0, Math.min(9, tier));
    if (RK.Battle && RK.Battle.Visuals && RK.Battle.Visuals.spriteMap) {
        const spr = RK.Battle.Visuals.spriteMap.get(this);
        if (spr && RK.Battle.Visuals.tierContainers) {
            if (spr.parent) spr.parent.removeChild(spr);
            RK.Battle.Visuals.tierContainers[safeTier].addChild(spr);
            spr.currentTier = safeTier;
        }
    }
};

Game_CharacterBase.prototype.startJump = function (height, power, keepZLayer = false) {
    this.setupJumpProperties();
    if (this._jumping || this._jumpY !== 0) return;

    this._jumping = true;
    this._maxJumpHeight = height;
    this._launchBaseZ = this._baseZ !== undefined ? this._baseZ : 0;
    this._jumpGravity = 0.4 * (power / 12);
    this._jumpVelocity = -Math.sqrt(2 * this._jumpGravity * height);
    this._jumpY = 0;

    this._originalPriorityType = this._priorityType || 1;
    this._jumpKeepZLayer = !!keepZLayer;
    this._lastRenderTier = Math.floor(this.zPoint);
};

Game_CharacterBase.prototype.startLedgeDrop = function(targetFloorZ) {
    if (this._jumping) return;
    if (typeof this.setupJumpProperties === 'function') this.setupJumpProperties();
    this._jumping = true;
    this._launchBaseZ = this._baseZ !== undefined ? this._baseZ : 0;
    this._jumpGravity = 0.45;
    this._jumpVelocity = 1.0; 
    this._jumpY = 0;
    this._targetFallFloorZ = targetFloorZ;
    this._lastRenderTier = Math.floor(this.zPoint);
};

const _Game_CharacterBase_update_physics = Game_CharacterBase.prototype.update;
Game_CharacterBase.prototype.update = function () {
    _Game_CharacterBase_update_physics.call(this);
    this.updateJumpPhysics();
};

PluginManager.registerCommand(HpluginName, "PlayerJump", function (args) {
    console.log(`[JUMP DEBUG] PlayerJump Plugin Command Received. Args:`, args);
	const height = parseInt(args.height) || 30;
	const power = parseInt(args.power) || 12;
	const target = args.target || 'player';
	const keepZLayer = args.keepZLayer === 'true';

	let targetCharacters = [];

	if (target === 'player') {
		targetCharacters.push($gamePlayer);
	} else if (target === 'this') {
		targetCharacters.push($gameMap.event(this._eventId));
	} else if (target.startsWith('<') && target.endsWith('>')) {
		$gameMap.events().forEach(event => {
			if (event && event.event().note.includes(target)) {
				targetCharacters.push(event);
			}
		});
	} else if (!isNaN(target)) {
		const event = $gameMap.event(parseInt(target));
		if (event) targetCharacters.push(event);
	}

    if (targetCharacters.length === 0) {
        console.warn(`[JUMP DEBUG WARN] No valid targets found for Jump command! Target specifier: ${target}`);
    }

	targetCharacters.forEach(character => {
		if (character) {
            console.log(`[JUMP DEBUG] Triggering startJump on target:`, character);
			character.startJump(height, power, keepZLayer);
		}
	});
});

let previousJumpState = false;

window.checkJump = function (target, status) {
	let targetCharacters = [];

	if (target === 'player') {
		targetCharacters.push($gamePlayer);
	} else if (target.startsWith('<') && target.endsWith('>')) {
		$gameMap.events().forEach(event => {
			if (event && event.event().note.includes(target)) {
				targetCharacters.push(event);
			}
		});
	} else if (!isNaN(target)) {
		const event = $gameMap.event(parseInt(target));
		if (event) targetCharacters.push(event);
	}

	return targetCharacters.some(character => {
		const characterId = character === $gamePlayer ? 'player' : character.eventId();
		const isJumping = character._jumping === true;
		const velocity = character._jumpVelocity || 0;

		let previousState = false;
		if (jumpStateCache.has(characterId)) {
			previousState = jumpStateCache.get(characterId);
		}
		jumpStateCache.set(characterId, isJumping);
		switch (status.toLowerCase()) {
			case 'jumping':
				return isJumping;
			case 'startedjump':
				return isJumping && !previousState;
			case 'landed':
				return !isJumping && previousState;
			case 'falling':
				return isJumping && velocity > 0;
			case 'midjump':
				return isJumping && velocity < 0;
			default:
				return false;
		}
	});
};

window.playerJumping = function () {
	return $gamePlayer._jumping;
};

window.playerStartedJump = function () {
	const currentlyJumping = window.playerJumping();
	const justStarted = currentlyJumping && !previousJumpState;
	previousJumpState = currentlyJumping;
	return justStarted;
};

window.playerLanded = function () {
	const currentlyJumping = window.playerJumping();
	const justLanded = !currentlyJumping && previousJumpState;
	previousJumpState = currentlyJumping;
	return justLanded;
};

//============================================================
// MAP JUMP MECHANICS
//============================================================

Game_Character.prototype.jumpToNearby = function (maxDistance, jumpOnOtherEvent = false) {
	let passableTiles = [];
	for (let dx = -maxDistance; dx <= maxDistance; dx++) {
		for (let dy = -maxDistance; dy <= maxDistance; dy++) {
			const newX = this.x + dx;
			const newY = this.y + dy;

			if ($gameMap.isValid(newX, newY) && $gameMap.isPassable(newX, newY, 5)) {
				const isTileOccupied = $gameMap.eventsXy(newX, newY).length > 0;
				if (jumpOnOtherEvent || !isTileOccupied) {
					passableTiles.push({ x: newX, y: newY });
				}
			}
		}
	}

	if (passableTiles.length > 0) {
		const randomTile = passableTiles[Math.floor(Math.random() * passableTiles.length)];
		const jumpX = randomTile.x - this.x;
		const jumpY = randomTile.y - this.y;
		this.jump(jumpX, jumpY);
	}
};

Game_Character.prototype.jumpTo = function (x, y) {
	const isBlockedTile = (tileX, tileY) => {
		if (!$gameMap.isValid(tileX, tileY)) return true;

		const tiles = $gameMap.allTiles(tileX, tileY);
		const isA3A4Tile = tiles.some(tileId =>
			(tileId >= 4352 && tileId <= 5887) || (tileId >= 5888 && tileId <= 8191)
		);

		const currentTiles = $gameMap.allTiles(this.x, this.y);
		const isCurrentlyOnA3A4 = currentTiles.some(tileId =>
			(tileId >= 4352 && tileId <= 5887) || (tileId >= 5888 && tileId <= 8191)
		);

		if (isA3A4Tile && !isCurrentlyOnA3A4) {
			return true;
		}

		if (this.isThrough()) {
			return !$gameMap.checkPassage(tileX, tileY, 0x0f);
		}

		if (!$gameMap.isPassable(tileX, tileY, 2) ||
			!$gameMap.isPassable(tileX, tileY, 4) ||
			!$gameMap.isPassable(tileX, tileY, 6) ||
			!$gameMap.isPassable(tileX, tileY, 8)) {
			return true;
		}

		const eventsAtTile = $gameMap.eventsXy(tileX, tileY);
		return eventsAtTile.some(event =>
			event._priorityType === 1 && 
			!event.isThrough() &&
			!event.event().note.includes('<pass>')
		);
	};

	const findNearestJumpablePosition = (targetX, targetY) => {
		if (!isBlockedTile(targetX, targetY)) {
			return { x: targetX, y: targetY };
		}

		for (let radius = 1; radius <= 5; radius++) { 
			const positions = [];
			for (let dx = -radius; dx <= radius; dx++) {
				positions.push({ x: targetX + dx, y: targetY - radius });
				positions.push({ x: targetX + dx, y: targetY + radius }); 
			}
			for (let dy = -radius + 1; dy <= radius - 1; dy++) {
				positions.push({ x: targetX - radius, y: targetY + dy }); 
				positions.push({ x: targetX + radius, y: targetY + dy }); 
			}
			positions.sort((a, b) => {
				const distA = Math.abs(a.x - targetX) + Math.abs(a.y - targetY);
				const distB = Math.abs(b.x - targetX) + Math.abs(b.y - targetY);
				return distA - distB;
			});
			for (const pos of positions) {
				if ($gameMap.isValid(pos.x, pos.y) && !isBlockedTile(pos.x, pos.y)) {
					return pos;
				}
			}
		}
		return { x: targetX, y: targetY };
	};

	if (x === 'playerLockedTarget') {
		const playerTarget = $gamePlayer.getLockedTarget();
		if (!playerTarget) return;
		x = playerTarget.x;
		y = playerTarget.y;
	}
	if (x === 'eventLockedTarget') {
		const eventTarget = this.getLockedTarget();
		if (!eventTarget) return;
		x = eventTarget.x;
		y = eventTarget.y;
	}

	if (typeof x === 'number' && y === undefined) {
		const targetEvent = $gameMap.event(x);
		if (targetEvent) {
			const targetX = targetEvent.x;
			const targetY = targetEvent.y;
			const jumpPos = findNearestJumpablePosition(targetX, targetY);

			const xDist = jumpPos.x - this.x;
			const yDist = jumpPos.y - this.y;
			this.jump(xDist, yDist);
		}
		return;
	}

	if (typeof x === 'number' && typeof y === 'number') {
		if (x >= 0 && x < $gameMap.width() && y >= 0 && y < $gameMap.height()) {
			const jumpPos = findNearestJumpablePosition(x, y);
			const xDist = jumpPos.x - this.x;
			const yDist = jumpPos.y - this.y;
			this.jump(xDist, yDist);
		}
		return;
	}

	if (x === 'player') {
		const targetX = $gamePlayer.x;
		const targetY = $gamePlayer.y;
		const jumpPos = findNearestJumpablePosition(targetX, targetY);

		let xDist = jumpPos.x - this.x;
		let yDist = jumpPos.y - this.y;
		if (typeof y === 'number') {
			const distance = Math.sqrt(xDist * xDist + yDist * yDist);
			if (distance > y) {
				const scale = y / distance;
				const limitedXDist = Math.round(xDist * scale);
				const limitedYDist = Math.round(yDist * scale);
				this.jump(limitedXDist, limitedYDist);
				return;
			}
		}

		this.jump(xDist, yDist);
		return;
	}

	if ((x === 'forward' || x === 'backward' || x === 'away') && typeof y === 'number') {
		const direction = this.direction();
		let jumpX = 0;
		let jumpY = 0;

		if (x === 'away') {
			const playerX = $gamePlayer.x;
			const playerY = $gamePlayer.y;
			const deltaX = this.x - playerX;
			const deltaY = this.y - playerY;

			if (Math.abs(deltaX) > Math.abs(deltaY)) {
				jumpX = deltaX > 0 ? y : -y;
			} else {
				jumpY = deltaY > 0 ? y : -y;
			}

			const newDirection = Math.abs(deltaX) > Math.abs(deltaY)
				? (deltaX > 0 ? 4 : 6)
				: (deltaY > 0 ? 8 : 2);
			this.setDirection(newDirection);
		} else {
			switch (direction) {
				case 2: jumpY = x === 'forward' ? y : -y; break;
				case 4: jumpX = x === 'forward' ? -y : y; break;
				case 6: jumpX = x === 'forward' ? y : -y; break;
				case 8: jumpY = x === 'forward' ? -y : y; break;
			}
		}

		const targetX = this.x + jumpX;
		const targetY = this.y + jumpY;
		const jumpPos = findNearestJumpablePosition(targetX, targetY);
		const adjustedJumpX = jumpPos.x - this.x;
		const adjustedJumpY = jumpPos.y - this.y;

		this.jump(adjustedJumpX, adjustedJumpY);
		this.setDirection(direction);
		return;
	}

	if (typeof x === 'string' && x.match(/^region\s+(\d+)$/i)) {
		const regionMatch = x.match(/^region\s+(\d+)$/i);
		const regionId = parseInt(regionMatch[1]);

		let nearestRegionTile = null;
		let minDistance = Infinity;

		for (let mapX = 0; mapX < $gameMap.width(); mapX++) {
			for (let mapY = 0; mapY < $gameMap.height(); mapY++) {
				if ($gameMap.regionId(mapX, mapY) === regionId) {
					const distance = Math.sqrt(Math.pow(mapX - this.x, 2) + Math.pow(mapY - this.y, 2));
					if (distance < minDistance) {
						minDistance = distance;
						nearestRegionTile = { x: mapX, y: mapY };
					}
				}
			}
		}

		if (nearestRegionTile) {
			const jumpPos = findNearestJumpablePosition(nearestRegionTile.x, nearestRegionTile.y);
			this.jump(jumpPos.x - this.x, jumpPos.y - this.y);
		}
		return;
	}

	if (typeof x === 'string' && (y === undefined || typeof y === 'number')) {
		let closestEvent = null;
		let minDistance = Infinity;
		const searchTag = x.startsWith('<') ? x : `<${x}>`;

		$gameMap.events().forEach(event => {
			if (event.event().note.includes(searchTag)) {
				const distance = Math.sqrt(Math.pow(event.x - this.x, 2) + Math.pow(event.y - this.y, 2));
				if ((y === undefined || distance <= y) && distance < minDistance) {
					closestEvent = event;
					minDistance = distance;
				}
			}
		});

		if (closestEvent) {
			const jumpPos = findNearestJumpablePosition(closestEvent.x, closestEvent.y);
			this.jump(jumpPos.x - this.x, jumpPos.y - this.y);
		}
		return;
	}
};

//============================================================
// BACKEND MOVEMENT ROUTE COMMAND
//============================================================

const _Game_Character_processMoveCommand = Game_Character.prototype.processMoveCommand;
Game_Character.prototype.processMoveCommand = function (command) {
	if (command.code === Game_Character.ROUTE_SCRIPT) {
		const script = command.parameters[0];
		if (script.match(/^(dash|reverseDash|dashForced|reverseDashForced|dotMoveByDeg|jumpTo|jumpToNearby)/)) {
			eval(`this.${script}`);
			return;
		}
	}
	_Game_Character_processMoveCommand.call(this, command);
};

//============================================================
// ADDITIONAL DASH & TWEEN UTILITIES
//============================================================

// Dash Forced
(() => {
  if (!window.DotMoveSystem || !DotMoveSystem.Degree) return;
  Game_Character.prototype.dashForced = function(steps, dirOrDegree) {
    const distance = (Number(steps) || 0) * this.distancePerFrame() * 3;
    if (distance <= 0) return;

    let deg;
    const v = dirOrDegree;
    if (v == null) {
      deg = DotMoveSystem.Degree.fromDirection(this.direction());
    }
    else if (v === 2 || v === 4 || v === 6 || v === 8) {
      deg = DotMoveSystem.Degree.fromDirection(v);
    }
    else {
      const d = Number(v);
      if (Number.isNaN(d)) {
        deg = DotMoveSystem.Degree.fromDirection(this.direction());
      } else {
        deg = ((d % 360) + 360) % 360;
      }
    }

    this.mover().startContinuousMove(distance, deg);
  };
})();

// Reverse Dash Forced
(() => {
	if (!window.DotMoveSystem || !DotMoveSystem.Degree) return;

	const oppDir = (d) => ({1:9,2:8,3:7,4:6,6:4,7:3,8:2,9:1}[d] || d);

	Game_Character.prototype.reverseDashForced = function (steps, dirOrDegree) {
		const distance = (Number(steps) || 0) * this.distancePerFrame() * 3;
		if (distance <= 0) return;

		let deg;
		const v = dirOrDegree;

		if (v == null) {
			deg = DotMoveSystem.Degree.fromDirection(oppDir(this.direction()));
		} else if ([1,2,3,4,6,7,8,9].includes(v)) {
			deg = DotMoveSystem.Degree.fromDirection(oppDir(v));
		} else {
			const d = Number(v);
			deg = Number.isNaN(d) ? DotMoveSystem.Degree.fromDirection(oppDir(this.direction()))
				: (((d + 180) % 360) + 360) % 360;
		}

		this.mover().startContinuousMove(distance, deg);
	};
})();

// setRotation Animation
(() => {
  const normDeg = (d) => {
    d = Number(d) || 0;
    d %= 360;
    if (d < 0) d += 360;
    return d;
  };

  const shortestDelta = (from, to) => {
    from = ((from % 360) + 360) % 360;
    to   = ((to % 360) + 360) % 360;
    let d = to - from;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };

  const _setRotation = Game_CharacterBase.prototype.setRotation;
  Game_CharacterBase.prototype.setRotation = function(deg, dur = 0) {
    this._useCustomRotationForMoveTowardPoint = true;
    if (this.setOriginPoint) this.setOriginPoint("center");
    if (this.setCustomRotation) this.setCustomRotation(false);

    deg = Number(deg) || 0;
    dur = Number(dur) || 0;

    if (dur <= 0) {
      _setRotation.call(this, deg);
      this._rotTween = null;
      return;
    }

    const start = (this._rotation != null) ? this._rotation : 0;

    this._rotTween = {
      start: start,
      target: deg,
      delta: shortestDelta(start, deg),
      dur: Math.max(1, Math.floor(dur)),
      t: 0
    };
  };

  const _update = Game_CharacterBase.prototype.update;
  Game_CharacterBase.prototype.update = function() {
    _update.call(this);

    const tw = this._rotTween;
    if (!tw) return;

    tw.t++;
    const p = Math.min(1, tw.t / tw.dur);

    this._rotation = tw.start + tw.delta * p;

    if (p >= 1) {
      this._rotation = tw.target;
      this._rotTween = null;
    }
  };

//============================================================
// SELF VARIABLES & PERCENTAGE
//============================================================
var LocalVarManager = LocalVarManager || {};
LocalVarManager.localVars = {};
window.LocalVarManager = LocalVarManager;

window.localPercentage = function (eventId, percentage) {
	if (eventId === 'player') {
		return Math.random() * 100 < percentage;
	}

	const uniqueId = `${$gameMap.mapId()}_${eventId}`;
	const randomValue = Math.random() * 100;

	LocalVarManager.localVars[uniqueId] = LocalVarManager.localVars[uniqueId] || {};
	LocalVarManager.localVars[uniqueId]['percentageValue'] = randomValue;

	return randomValue < percentage;
};
})();

// Safe Pattern Dimensions (prevents crash on destroyed event sprites)
(() => {
  const _patternHeight = Sprite_Character.prototype.patternHeight;
  Sprite_Character.prototype.patternHeight = function() {
    if (!this.bitmap) return $gameMap.tileHeight();
    return _patternHeight.call(this);
  };

  const _patternWidth = Sprite_Character.prototype.patternWidth;
  Sprite_Character.prototype.patternWidth = function() {
    if (!this.bitmap) return $gameMap.tileWidth();
    return _patternWidth.call(this);
  };
})();