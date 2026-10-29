/*:
 * @target MZ
 * @plugindesc [v5.7] RK_ColsNMap - In-Engine Tactical IDE with Auto-Pause & Object Inspector
 * @author Rizuki Keiji
 * 
 * @param AutoOpenEditor
 * @text Auto-Open Editor on Boot
 * @type boolean
 * @default false
 * @desc Automatically opens the Tactical IDE dock as soon as the map loads.
 * 
 * @param AutoPauseOnOpen
 * @text Auto-Pause on Start
 * @type boolean
 * @default true
 * @desc Automatically freezes battle logic, gimmicks, and lifespans when opening the map.
 */

(() => {
    if (!Utils.isOptionValid('test')) return;

    const pluginName = "RK_ColsNMap";
    const parameters = PluginManager.parameters(pluginName);
    const paramAutoOpen = String(parameters["AutoOpenEditor"]).trim().toLowerCase() === "true";
    const paramAutoPause = String(parameters["AutoPauseOnOpen"]).trim().toLowerCase() === "true";

    let dockElement = null;

    // Global Active State definition to prevent scope ReferenceErrors across files
    window.RK_isEditorActive = false;
    Object.defineProperty(window, "isEditorActive", {
        get: function() { return window.RK_isEditorActive; },
        set: function(val) { window.RK_isEditorActive = !!val; },
        configurable: true
    });

    // --- Complete IDE State ---
    const EditorState = {
        tool: 'paint_collision',
        terrain: 'wall',
        tier: 0,
        layer: 0,
        brushSize: 24,
        gridFree: false,
        layerShadow: false,
        continuous: false,
        useMask: false,
        activeMask: null,
        activeTileset: null,
        activeTileSelection: { x: 0, y: 0, w: 48, h: 48 },
        dragStart: null,
        dragCurrent: null,
        dragPreview: null,
        hoverPos: { x: 0, y: 0 },
        selectedCollider: null,
        activeEntityId: null,
        placedEntities: [],
        isMouseDown: false,
        lastPaintPos: null,
        selectedSceneObject: null,
        autoOpenNextMap: false
    };

    const loadedMasks = {};
    const templateImages = {};
    const loadedTilesetImages = {};

    Input.keyMapper[117] = 'toggle_ide'; // F6
    Input.keyMapper[80]  = 'rk_debug';   // P (Toggle hitboxes)

    PluginManager.registerCommand("RK_ColsNMap", "OpenEditorOnMap", args => {
        EditorState.autoOpenNextMap = true;
        if (RK.Battle && RK.Battle.Core) {
            RK.Battle.Core.isPaused = String(args.autoPause) === "true";
        }
    });

    function refreshSceneObjectList() {
        const listContainer = document.getElementById('dock-obj-list');
        const countLabel = document.getElementById('dock-obj-count');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const objects = (RK.Battle && RK.Battle.Core && RK.Battle.Core.activeObjects) ? RK.Battle.Core.activeObjects : [];
        if (countLabel) countLabel.innerText = objects.length;

        if (objects.length === 0) {
            listContainer.innerHTML = '<div style="color: #666; font-size: 9px; padding: 4px;">No active objects</div>';
            return;
        }

        objects.forEach((obj, index) => {
            const item = document.createElement('div');
            item.className = 'scene-obj-item';
            if (EditorState.selectedSceneObject === obj) {
                item.classList.add('selected');
            }

            const name = obj.id || `Object_${index}`;
            const currentTier = obj.zTier !== undefined ? Number(obj.zTier) : 0;

            const nameSpan = document.createElement('span');
            nameSpan.innerText = name;
            nameSpan.style.flex = '1';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            nameSpan.style.whiteSpace = 'nowrap';
            nameSpan.onclick = () => {
                EditorState.selectedSceneObject = obj;
                refreshSceneObjectList();
            };

            const tierSelect = document.createElement('select');
            tierSelect.className = 'scene-obj-tier-select';
            tierSelect.title = 'Change Object Z-Tier';

            for (let t = 0; t <= 9; t++) {
                const opt = document.createElement('option');
                opt.value = t;
                opt.innerText = `T${t}`;
                if (t === currentTier) opt.selected = true;
                tierSelect.appendChild(opt);
            }

            tierSelect.onclick = (e) => e.stopPropagation();
            tierSelect.onchange = (e) => {
                e.stopPropagation();
                const newTier = parseInt(e.target.value);
                setObjectZTier(obj, newTier);
            };

            item.appendChild(nameSpan);
            item.appendChild(tierSelect);
            listContainer.appendChild(item);
        });
    }

    function setObjectZTier(obj, newTier) {
        if (!obj) return;
        const oldTier = obj.zTier !== undefined ? Number(obj.zTier) : 0;
        
        obj.zTier = newTier;

        if (RK.Battle && RK.Battle.Visuals && RK.Battle.Visuals.spriteMap) {
            const spr = RK.Battle.Visuals.spriteMap.get(obj);
            if (spr && RK.Battle.Visuals.tierContainers) {
                if (spr.parent) spr.parent.removeChild(spr);
                const safeTier = Math.max(0, Math.min(9, newTier));
                RK.Battle.Visuals.tierContainers[safeTier].addChild(spr);
                spr.currentTier = safeTier;
            }
        }

        if (EditorState.placedEntities) {
            const target = EditorState.placedEntities.find(ent => {
                const dist = Math.hypot(ent.x - obj.x, ent.y - obj.y);
                return dist < 36 && Number(ent.zTier || 0) === oldTier;
            });
            if (target) {
                target.zTier = newTier;
            }
        }
    }

    // =========================================================================
    // 1. EXACT COORDINATE CALCULATIONS
    // =========================================================================

    function getMapPixelCoords(e) {
        const canvas = Graphics._canvas || document.getElementById('gameCanvas');
        if (!canvas || !$gameMap) return { x: 0, y: 0, screenX: 0, screenY: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = Graphics.width / rect.width;
        const scaleY = Graphics.height / rect.height;

        const screenX = (e.clientX - rect.left) * scaleX;
        const screenY = (e.clientY - rect.top) * scaleY;

        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();

        const worldX = screenX + ($gameMap.displayX() * tw);
        const worldY = screenY + ($gameMap.displayY() * th);

        return { x: worldX, y: worldY, screenX: screenX, screenY: screenY };
    }

    function snapCoords(pos, e) {
        if (e.altKey && e.shiftKey) {
            return {
                x: Math.round(pos.x / 48) * 48,
                y: Math.round(pos.y / 48) * 48
            };
        } 
        else if (e.altKey) {
            let snappedX = pos.x;
            let snappedY = pos.y;
            let threshold = 16;
            let bestDistX = threshold;
            let bestDistY = threshold;

            const colliders = RK.CollisionMZ.EnvironmentData || [];
            for (let i = 0; i < colliders.length; i++) {
                const c = colliders[i];
                if (Number(c.zTier) !== Number(EditorState.tier)) continue;

                const edgesX = [c.x, c.x + c.w];
                for (let j = 0; j < edgesX.length; j++) {
                    const dist = Math.abs(pos.x - edgesX[j]);
                    if (dist < bestDistX) {
                        bestDistX = dist;
                        snappedX = edgesX[j];
                    }
                }

                const edgesY = [c.y, c.y + c.h];
                for (let j = 0; j < edgesY.length; j++) {
                    const dist = Math.abs(pos.y - edgesY[j]);
                    if (dist < bestDistY) {
                        bestDistY = dist;
                        snappedY = edgesY[j];
                    }
                }
            }
            return { x: Math.round(snappedX), y: Math.round(snappedY) };
        }
        return { x: Math.round(pos.x), y: Math.round(pos.y) };
    }

    // =========================================================================
    // 2. ASSET MANAGEMENT & PREVIEWS
    // =========================================================================

    function loadMasksFromDisk() {
        if (typeof require === 'undefined') return;
        try {
            const fs = require('fs');
            const path = require('path');
            const baseDir = path.dirname(process.mainModule.filename);
            const maskDir = path.join(baseDir, 'colsnmap', 'PNGMask');
            if (!fs.existsSync(maskDir)) return;

            const files = fs.readdirSync(maskDir);
            const sel = document.getElementById('brush-mask-selector');
            if (!sel) return;
            sel.innerHTML = '';

            files.forEach(file => {
                if (file.toLowerCase().endsWith('.png')) {
                    const img = new Image();
                    img.onload = () => {
                        loadedMasks[file] = img;
                        const opt = document.createElement('option');
                        opt.value = file;
                        opt.innerText = file;
                        sel.appendChild(opt);
                        if (!EditorState.activeMask) {
                            EditorState.activeMask = file;
                            updateMaskPreview();
                        }
                    };
                    img.src = 'colsnmap/PNGMask/' + file;
                }
            });
        } catch (e) {
            console.warn('[Tactical IDE] Failed to read PNGMask folder:', e);
        }
    }

    function updateMaskPreview() {
        const canvas = document.getElementById('mask-preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 48, 48);
        if (EditorState.activeMask && loadedMasks[EditorState.activeMask]) {
            ctx.drawImage(loadedMasks[EditorState.activeMask], 0, 0, 48, 48);
        }
    }

    function populateEntitySelector() {
        const sel = document.getElementById('entity-selector');
        if (!sel) return;
        sel.innerHTML = '';

        const templates = (RK && RK.Battle) ? (RK.Battle.Templates || {}) : {};
        const keys = Object.keys(templates);

        if (keys.length === 0) {
            sel.innerHTML = '<option value="">No Templates</option>';
            return;
        }

        keys.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            sel.appendChild(opt);

            const t = templates[k];
            if (t.visuals && t.visuals.imageName && !templateImages[k]) {
                const img = new Image();
                img.onload = () => {
                    if (EditorState.activeEntityId === k) updateEntityPreview();
                };
                img.src = 'img/characters/' + t.visuals.imageName.replace(/\\/g, '/') + '.png';
                templateImages[k] = img;
            }
        });

        EditorState.activeEntityId = keys[0];
        sel.value = keys[0];
        updateEntityPreview();
    }

    function updateEntityPreview() {
        const canvas = document.getElementById('entity-preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 48, 48);

        const id = EditorState.activeEntityId;
        const templates = (RK && RK.Battle) ? (RK.Battle.Templates || {}) : {};
        if (id && templates[id] && templateImages[id]) {
            const img = templateImages[id];
            const t = templates[id];
            const cols = (t.visuals && t.visuals.cols) ? t.visuals.cols : 1;
            const rows = (t.visuals && t.visuals.rows) ? t.visuals.rows : 1;
            const fw = img.width / cols;
            const fh = img.height / rows;

            const scale = Math.min(48 / fw, 48 / fh);
            const dw = fw * scale;
            const dh = fh * scale;
            ctx.drawImage(img, 0, 0, fw, fh, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
        }
    }

    function loadExistingEntities() {
        if (typeof require === 'undefined') return;
        try {
            const fs = require('fs');
            const path = require('path');
            const baseDir = path.dirname(process.mainModule.filename);
            const mapIdPadded = String($gameMap.mapId()).padStart(3, '0');
            const filePath = path.join(baseDir, 'data', `Map_${mapIdPadded}_Collision.json`);

            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                EditorState.placedEntities = data.entities || [];
            } else {
                EditorState.placedEntities = [];
            }
        } catch (e) {
            EditorState.placedEntities = [];
        }
    }

    function initTierButtons() {
        const container = document.getElementById('tier-vis-container');
        if (!container) return;
        container.innerHTML = '';

        const rowTop = document.createElement('div');
        rowTop.style.display = 'flex';
        rowTop.style.gap = '2px';
        for (let i = 5; i <= 9; i++) rowTop.appendChild(createTierBtn(i));

        const rowBot = document.createElement('div');
        rowBot.style.display = 'flex';
        rowBot.style.gap = '2px';
        for (let i = 0; i <= 4; i++) rowBot.appendChild(createTierBtn(i));

        container.appendChild(rowTop);
        container.appendChild(rowBot);
    }

    function createTierBtn(tier) {
        const btn = document.createElement('button');
        btn.innerText = `T${tier}`;
        btn.style.flex = '1';
        btn.style.fontSize = '9px';
        btn.style.padding = '2px 0';
        btn.style.background = '#0b0c10';
        btn.style.color = 'var(--neon-teal)';
        btn.style.border = '1px solid var(--neon-teal)';
        btn.style.cursor = 'pointer';
        btn.onclick = () => {
            const slider = document.getElementById('z-tier-slider');
            if (slider) slider.value = tier;
            window.RK_IDE_Bridge.setTier(tier);
        };
        return btn;
    }

    function initTilesetCanvas() {
        const canvas = document.getElementById('tileset-canvas');
        if (!canvas) return;
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const snapX = Math.floor(rawX / 48) * 48;
            const snapY = Math.floor(rawY / 48) * 48;

            EditorState.activeTileSelection = { x: snapX, y: snapY, w: 48, h: 48 };
            const hl = document.getElementById('tile-highlight');
            if (hl) {
                hl.style.display = 'block';
                hl.style.left = snapX + 'px';
                hl.style.top = snapY + 'px';
            }
        });
    }

    // =========================================================================
    // 3. ATTACH DOCK OVERLAY & DRAGGABLE HANDLER
    // =========================================================================

    function initDockDraggable() {
        const header = document.getElementById('dock-drag-header');
        const container = document.getElementById('rk-ide-dock-container');
        if (!header || !container) return;

        let isDraggingDock = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SPAN') return;

            isDraggingDock = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = container.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            container.style.right = 'auto';
            container.style.bottom = 'auto';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingDock) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newLeft = Math.max(0, Math.min(window.innerWidth - container.offsetWidth, initialLeft + deltaX));
            const newTop = Math.max(0, Math.min(window.innerHeight - container.offsetHeight, initialTop + deltaY));

            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
        });

        window.addEventListener('mouseup', () => {
            isDraggingDock = false;
        });
    }

    async function loadDockUI() {
        if (dockElement) return;

        if (!document.getElementById('rk-ide-dock-style')) {
            const link = document.createElement('link');
            link.id = 'rk-ide-dock-style';
            link.rel = 'stylesheet';
            link.href = 'colsnmap/css/dock.css';
            document.head.appendChild(link);
        }

        const res = await fetch('colsnmap/dock.html');
        const html = await res.text();

        dockElement = document.createElement('div');
        dockElement.id = 'rk-ide-dock-container';
        dockElement.style.position = 'fixed';
        dockElement.style.top = '10px';
        dockElement.style.left = '10px';
        dockElement.style.height = '88vh';
        dockElement.style.zIndex = '1000';
        dockElement.style.display = 'none';
        dockElement.innerHTML = html;

        document.body.appendChild(dockElement);

        dockElement.addEventListener('keydown', (e) => {
            // Permit hotkeys P (80) and F6 (117) to pass through to RPG Maker
            if (e.keyCode === 80 || e.keyCode === 117) return;
            e.stopPropagation();
        });
        dockElement.addEventListener('keyup', (e) => {
            if (e.keyCode === 80 || e.keyCode === 117) return;
            e.stopPropagation();
        });
        dockElement.addEventListener('mousedown', (e) => e.stopPropagation());

        initDockDraggable();
        initTierButtons();
        loadMasksFromDisk();
        populateEntitySelector();
        loadExistingEntities();
        initTilesetCanvas();
    }

    // =========================================================================
    // 4. ACTION DISPATCHER & ENTITY ERASING
    // =========================================================================

    function executePaintAction(worldX, worldY, e) {
        const tool = EditorState.tool;

        if (tool === 'paint_entity') {
            if (!EditorState.activeEntityId) return;

            const drawX = EditorState.gridFree ? Math.round(worldX) : Math.floor(worldX / 48) * 48 + 24;
            const drawY = EditorState.gridFree ? Math.round(worldY) : Math.floor(worldY / 48) * 48 + 48;

            if (!EditorState.gridFree) {
                const exists = EditorState.placedEntities.some(ent => ent.x === drawX && ent.y === drawY && ent.zTier === EditorState.tier);
                if (exists) return;
            }

            RK.Battle.Events.emit('SPAWN_REQUESTED', {
                objectId: EditorState.activeEntityId,
                x: drawX,
                y: drawY,
                zTier: EditorState.tier
            });

            EditorState.placedEntities.push({
                id: EditorState.activeEntityId,
                x: drawX,
                y: drawY,
                zTier: EditorState.tier
            });
        }
        else if (tool === 'erase_entity') {
            eraseEntityAt(worldX, worldY);
        }
        else if (tool === 'paint_collision') {
            const snapped = snapCoords({ x: worldX, y: worldY }, e);
            EditorState.dragStart = snapped;
            EditorState.dragCurrent = snapped;
            EditorState.dragPreview = { x: snapped.x, y: snapped.y, w: 0, h: 0 };
        }
        else if (tool === 'erase_collision') {
            eraseColliderAt(worldX, worldY);
        }
    }

    function eraseEntityAt(worldX, worldY) {
        let victimFound = false;

        if (RK.Battle && RK.Battle.Core && RK.Battle.Core.activeObjects) {
            const objects = RK.Battle.Core.activeObjects;

            for (let i = objects.length - 1; i >= 0; i--) {
                const obj = objects[i];
                const objTier = (obj.zTier !== undefined) ? Number(obj.zTier) : 0;
                if (objTier !== Number(EditorState.tier)) continue;

                const boxW = (obj.hurtbox && obj.hurtbox.width) ? obj.hurtbox.width : 48;
                const boxH = (obj.hurtbox && obj.hurtbox.height) ? obj.hurtbox.height : 48;

                const halfW = Math.max(24, boxW / 2);
                const isNearX = Math.abs(worldX - obj.x) <= halfW;
                const isNearY = (worldY >= obj.y - boxH - 10) && (worldY <= obj.y + 10);
                const isNearRadial = Math.hypot(worldX - obj.x, worldY - (obj.y - boxH / 2)) <= 36;

                if (isNearRadial || (isNearX && isNearY)) {
                    if (RK.Battle.Visuals && typeof RK.Battle.Visuals.onDestroy === 'function') {
                        RK.Battle.Visuals.onDestroy(obj);
                    }
                    RK.Battle.Events.emit('OBJECT_DESTROYED', obj);

                    objects.splice(i, 1);
                    victimFound = true;

                    EditorState.placedEntities = EditorState.placedEntities.filter(ent => {
                        const dist = Math.hypot(ent.x - obj.x, ent.y - obj.y);
                        return !(dist < 40 && Number(ent.zTier || 0) === objTier);
                    });
                    break;
                }
            }
        }

        if (!victimFound && EditorState.placedEntities) {
            EditorState.placedEntities = EditorState.placedEntities.filter(ent => {
                const entTier = Number(ent.zTier || 0);
                if (entTier !== Number(EditorState.tier)) return true;
                const dist = Math.hypot(ent.x - worldX, ent.y - worldY);
                return dist >= 40;
            });
        }
    }

    function eraseColliderAt(x, y) {
        const beforeLen = RK.CollisionMZ.EnvironmentData.length;
        RK.CollisionMZ.EnvironmentData = RK.CollisionMZ.EnvironmentData.filter(c => {
            if (c.zTier !== EditorState.tier) return true;
            return !(x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
        });

        if (RK.CollisionMZ.EnvironmentData.length !== beforeLen) {
            RK.CollisionMZ.SpatialPartition.build(RK.CollisionMZ.EnvironmentData);
            refreshColliderList();
        }
    }

    // =========================================================================
    // 5. MOUSE HANDLERS
    // =========================================================================

    function onCanvasMouseDown(e) {
        if (!window.RK_isEditorActive || e.button !== 0) return;
        if (dockElement && dockElement.contains(e.target)) return;

        const raw = getMapPixelCoords(e);
        EditorState.isMouseDown = true;
        EditorState.lastPaintPos = { x: raw.x, y: raw.y };

        if (e.shiftKey) {
            const colliders = RK.CollisionMZ.EnvironmentData || [];
            for (let i = colliders.length - 1; i >= 0; i--) {
                const c = colliders[i];
                if (c.zTier === EditorState.tier && raw.x >= c.x && raw.x <= c.x + c.w && raw.y >= c.y && raw.y <= c.y + c.h) {
                    EditorState.selectedCollider = c;
                    updatePropsUI();
                    refreshColliderList();
                    return;
                }
            }
            EditorState.selectedCollider = null;
            updatePropsUI();
            return;
        }

        executePaintAction(raw.x, raw.y, e);
    }

    function onCanvasMouseMove(e) {
        if (!window.RK_isEditorActive) return;
        if (dockElement && dockElement.contains(e.target)) return;

        const raw = getMapPixelCoords(e);
        const snapped = snapCoords(raw, e);

        EditorState.hoverPos = { x: raw.x, y: raw.y };

        const tileLabel = document.getElementById('dock-mouse-coords');
        if (tileLabel) {
            tileLabel.innerText = `${Math.floor(raw.x / 48)}, ${Math.floor(raw.y / 48)}`;
        }

        const floatLabel = document.getElementById('dock-mouse-float-coords');
        if (floatLabel) {
            floatLabel.innerText = `${(raw.x / 48).toFixed(2)}, ${(raw.y / 48).toFixed(2)}`;
        }

        // Preview box calculation during drag
        if (EditorState.isMouseDown && EditorState.dragStart && EditorState.tool === 'paint_collision') {
            EditorState.dragCurrent = snapped;
            EditorState.dragPreview = {
                x: Math.min(EditorState.dragStart.x, snapped.x),
                y: Math.min(EditorState.dragStart.y, snapped.y),
                w: Math.abs(snapped.x - EditorState.dragStart.x),
                h: Math.abs(snapped.y - EditorState.dragStart.y)
            };
            return;
        }

        if (EditorState.isMouseDown && (EditorState.tool === 'erase_entity' || EditorState.tool === 'erase_collision' || EditorState.continuous)) {
            const spacing = EditorState.gridFree ? (EditorState.brushSize / 2) : 48;
            if (!EditorState.lastPaintPos || Math.hypot(raw.x - EditorState.lastPaintPos.x, raw.y - EditorState.lastPaintPos.y) >= spacing) {
                executePaintAction(raw.x, raw.y, e);
                EditorState.lastPaintPos = { x: raw.x, y: raw.y };
            }
        }
    }

    function onCanvasMouseUp(e) {
        if (!window.RK_isEditorActive) return;

        if (EditorState.isMouseDown && EditorState.dragStart && EditorState.dragCurrent && EditorState.tool === 'paint_collision') {
            const startX = EditorState.dragStart.x;
            const startY = EditorState.dragStart.y;
            const endX = EditorState.dragCurrent.x;
            const endY = EditorState.dragCurrent.y;

            const rectX = Math.min(startX, endX);
            const rectY = Math.min(startY, endY);
            const rectW = Math.abs(endX - startX);
            const rectH = Math.abs(endY - startY);

            if (rectW >= 4 && rectH >= 4) {
                const currentTier = parseInt(EditorState.tier) || 0;
                const isRampTool = EditorState.tool === 'ramp';
                const isCliffType = (EditorState.terrain === 'slide');

                const newCollider = {
                    x: Math.round(rectX),
                    y: Math.round(rectY),
                    w: Math.round(rectW),
                    h: Math.round(rectH),
                    zTier: currentTier,
                    zStatic: currentTier,
                    zMin: currentTier,
                    zMax: currentTier + 1,
                    isRamp: isRampTool,
                    isCeiling: false,
                    isBridge: false,
                    isAirSlide: isCliffType,
                    direction: isRampTool ? (EditorState.rampDir || 'north') : null,
                    terrainId: EditorState.terrain || 'wall',
                    isBlocking: true // Always solid to walking characters!
                };

                RK.CollisionMZ.EnvironmentData.push(newCollider);
                RK.CollisionMZ.SpatialPartition.build(RK.CollisionMZ.EnvironmentData);

                EditorState.selectedCollider = newCollider;
                updatePropsUI();
                refreshColliderList();
            }
        }

        EditorState.isMouseDown = false;
        EditorState.dragStart = null;
        EditorState.dragCurrent = null;
        EditorState.dragPreview = null;
    }

    function updatePropsUI() {
        const panel = document.getElementById('collider-properties-panel');
        if (!panel) return;

        const col = EditorState.selectedCollider;
        if (!col) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined && val !== null ? val : '';
        };

        const setChecked = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };

        setVal('prop-x', Math.round(col.x));
        setVal('prop-y', Math.round(col.y));
        setVal('prop-w', Math.round(col.w));
        setVal('prop-h', Math.round(col.h));

        setVal('prop-tier', col.zTier !== undefined ? col.zTier : 0);
        setVal('prop-terrain', col.terrainId || 'wall');
        setVal('prop-zmin', col.zMin !== undefined ? col.zMin : (col.zTier || 0));
        setVal('prop-zmax', col.zMax !== undefined ? col.zMax : ((col.zTier || 0) + 1));

        setChecked('prop-blocking', col.isBlocking !== false);
        setChecked('prop-is-ceiling', !!col.isCeiling);
        setChecked('prop-is-bridge', !!col.isBridge);
        setChecked('prop-is-ramp', !!col.isRamp);
        setVal('prop-ramp-dir', col.direction || 'north');

        // Sync cliff fall-through checkbox
        const isCliff = col.terrainId === 'slide' || !!col.isAirSlide;
        setChecked('prop-is-airslide', isCliff);

        const rampRow = document.getElementById('row-ramp-dir');
        if (rampRow) {
            rampRow.style.display = col.isRamp ? 'block' : 'none';
        }
    }

    // =========================================================================
    // 6. PUBLIC RK_IDE_Bridge
    // =========================================================================

    window.RK_IDE_Bridge = {
        isActive: () => !!window.RK_isEditorActive,
        setTool: (t) => {
            EditorState.tool = t;
            document.querySelectorAll('#rk-ide-dock .icon-btn').forEach(b => b.classList.remove('active-tool'));
            const activeBtn = document.getElementById('btn-tool-' + t);
            if (activeBtn) activeBtn.classList.add('active-tool');
        },
        setTerrain: (t) => { EditorState.terrain = t; },
        setTier: (t) => {
            EditorState.tier = parseInt(t);
            const disp = document.getElementById('z-tier-display');
            if (disp) disp.innerText = `Tier: ${t}`;
        },
        setLayer: (l) => { EditorState.layer = parseInt(l); },
        setBrushSize: (s) => { EditorState.brushSize = parseInt(s); },
        toggleSetting: (k, v) => { EditorState[k] = v; },
        changeMask: (m) => {
            EditorState.activeMask = m;
            updateMaskPreview();
        },
        reloadMasks: () => loadMasksFromDisk(),
        changeEntity: (id) => {
            EditorState.activeEntityId = id;
            updateEntityPreview();
        },
        changeTileset: (name) => {
            EditorState.activeTileset = name;
            const canvas = document.getElementById('tileset-canvas');
            if (!canvas || !loadedTilesetImages[name]) return;
            const img = loadedTilesetImages[name];
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
        },
        togglePause: () => {
            if (RK.Battle && RK.Battle.Core) {
                RK.Battle.Core.isPaused = !RK.Battle.Core.isPaused;
                const btn = document.getElementById('dock-btn-pause');
                if (btn) {
                    if (RK.Battle.Core.isPaused) {
                        btn.innerText = '⏸️ Paused';
                        btn.style.color = 'var(--neon-yellow)';
                        btn.style.borderColor = 'var(--neon-yellow)';
                    } else {
                        btn.innerText = '▶️ Running';
                        btn.style.color = 'var(--neon-blue)';
                        btn.style.borderColor = 'var(--neon-blue)';
                    }
                }
            }
        },

        toggleDockSide: () => {
            if (!dockElement) return;
            if (dockElement.style.left === '0px' || dockElement.style.left === '0') {
                dockElement.style.left = 'auto';
                dockElement.style.right = '0px';
            } else {
                dockElement.style.right = 'auto';
                dockElement.style.left = '0px';
            }
        },

        toggleDebug: () => {
            if (RK.CollisionMZ && typeof RK.CollisionMZ.toggleDebug === 'function') {
                RK.CollisionMZ.toggleDebug();
            } else {
                $gameTemp._rkDebugCollision = !$gameTemp._rkDebugCollision;
            }
        },

        refreshObjectList: () => refreshSceneObjectList(),
        deleteSelectedObject: () => {
            if (EditorState.selectedSceneObject) {
                const obj = EditorState.selectedSceneObject;
                if (RK.Battle.Visuals && typeof RK.Battle.Visuals.onDestroy === 'function') {
                    RK.Battle.Visuals.onDestroy(obj);
                }
                RK.Battle.Events.emit('OBJECT_DESTROYED', obj);
                
                const list = (RK.Battle && RK.Battle.Core && RK.Battle.Core.activeObjects) ? RK.Battle.Core.activeObjects : [];
                const idx = list.indexOf(obj);
                if (idx !== -1) list.splice(idx, 1);

                EditorState.selectedSceneObject = null;
                refreshSceneObjectList();
            }
        },
        getSelectedSceneObject: () => {
            const sel = EditorState.selectedSceneObject;
            if (!sel) return null;

            const activeList = (RK.Battle && RK.Battle.Core && RK.Battle.Core.activeObjects) ? RK.Battle.Core.activeObjects : [];
            const isAlive = activeList.includes(sel) && !sel.needsDestruction;

            if (!isAlive) {
                EditorState.selectedSceneObject = null;
                refreshSceneObjectList();
                return null;
            }

            return sel;
        },

        refreshColliderList: () => refreshColliderList(),
        deleteSelectedCollider: () => {
            if (EditorState.selectedCollider) {
                const list = RK.CollisionMZ.EnvironmentData || [];
                const idx = list.indexOf(EditorState.selectedCollider);
                if (idx !== -1) {
                    list.splice(idx, 1);
                    RK.CollisionMZ.SpatialPartition.build(list);
                }
                EditorState.selectedCollider = null;
                updatePropsUI();
                refreshColliderList();
            }
        },

        updateSelectedCeiling: (val) => {
            if (EditorState.selectedCollider) {
                EditorState.selectedCollider.isCeiling = !!val;
                RK.CollisionMZ.SpatialPartition.build(RK.CollisionMZ.EnvironmentData);
            }
        },

        updateSelectedColliderProp: (key, val) => {
            const col = EditorState.selectedCollider;
            if (!col) return;

            col[key] = val;

            if (key === 'isRamp') {
                const rampRow = document.getElementById('row-ramp-dir');
                if (rampRow) rampRow.style.display = val ? 'block' : 'none';
                if (val && !col.direction) col.direction = 'north';
            }

            if (key === 'isAirSlide') {
                // Ensure blocking remains enabled unless manually changed
                if (col.isBlocking === undefined) col.isBlocking = true;
            }

            if (key === 'terrainId' && val === 'slide') {
                col.isAirSlide = true;
                const airCheck = document.getElementById('prop-is-airslide');
                if (airCheck) airCheck.checked = true;
            }

            if (key === 'zTier') {
                col.zStatic = val;
                col.zMin = val;
                col.zMax = val + 1;
                const zminEl = document.getElementById('prop-zmin');
                const zmaxEl = document.getElementById('prop-zmax');
                if (zminEl) zminEl.value = col.zMin;
                if (zmaxEl) zmaxEl.value = col.zMax;
            }

            RK.CollisionMZ.SpatialPartition.build(RK.CollisionMZ.EnvironmentData);
            refreshColliderList();
        },
        
        clearSelection: () => {
            EditorState.selectedCollider = null;
            updatePropsUI();
        },
        updateBoxType: () => {
            if (!EditorState.selectedCollider) return;
            const isRamp = document.getElementById('prop-box-type').value === 'ramp';
            EditorState.selectedCollider.isRamp = isRamp;
            updatePropsUI();
            RK.CollisionMZ.SpatialPartition.build(RK.CollisionMZ.EnvironmentData);
        },
        applyProps: () => {
            const c = EditorState.selectedCollider;
            if (!c) return;
            c.isRamp = document.getElementById('prop-box-type').value === 'ramp';
            c.zStatic = parseFloat(document.getElementById('prop-z-static').value) || 0;
            c.zMin = parseFloat(document.getElementById('prop-z-min').value) || 0;
            c.zMax = parseFloat(document.getElementById('prop-z-max').value) || 1;
            c.direction = document.getElementById('prop-direction').value;
            RK.CollisionMZ.SpatialPartition.build(RK.CollisionMZ.EnvironmentData);
        },
        save: () => {
            if (typeof require === 'undefined') return;
            const fs = require('fs');
            const path = require('path');
            const baseDir = path.dirname(process.mainModule.filename);
            const mapIdPadded = String($gameMap.mapId()).padStart(3, '0');
            const filePath = path.join(baseDir, 'data', `Map_${mapIdPadded}_Collision.json`);

            const payload = {
                mapId: `Map_${mapIdPadded}`,
                gridWidth: $gameMap.width(),
                gridHeight: $gameMap.height(),
                pixelWidth: $gameMap.width() * 48,
                pixelHeight: $gameMap.height() * 48,
                colliders: RK.CollisionMZ.EnvironmentData,
                entities: EditorState.placedEntities
            };

            fs.writeFileSync(filePath, JSON.stringify(payload, null, 4));
            const status = document.getElementById('save-status-text');
            if (status) {
                status.innerText = '✅ Saved!';
                setTimeout(() => { status.innerText = '💾 Save'; }, 1500);
            }
            console.log(`[Tactical IDE] Saved ${payload.colliders.length} colliders and ${payload.entities.length} entities to ${filePath}`);
        },
        getDragPreview: () => EditorState.dragPreview,
        getSelectedCollider: () => EditorState.selectedCollider,
        getHoverPos: () => EditorState.hoverPos,
        getActiveTool: () => EditorState.tool,
        getGridFree: () => EditorState.gridFree
    };

    function refreshColliderList() {
        const listContainer = document.getElementById('dock-col-list');
        const countLabel = document.getElementById('dock-col-count');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const colliders = RK.CollisionMZ.EnvironmentData || [];
        if (countLabel) countLabel.innerText = colliders.length;

        if (colliders.length === 0) {
            listContainer.innerHTML = '<div style="color: #666; font-size: 9px; padding: 4px;">No colliders placed</div>';
            return;
        }

        colliders.forEach((c, index) => {
            const item = document.createElement('div');
            item.className = 'scene-col-item';
            if (EditorState.selectedCollider === c) {
                item.classList.add('selected');
            }

            // --- DYNAMIC TYPE LABEL ---
            let typeLabel = c.terrainId ? c.terrainId.toUpperCase() : 'WALL';
            if (c.isAirSlide || c.terrainId === 'slide') {
                typeLabel = 'CLIFF';
            } else if (c.isRamp) {
                const dir = c.direction ? c.direction[0].toUpperCase() : 'N';
                typeLabel = `RAMP(${dir})`;
            } else if (c.isBridge) {
                typeLabel = 'BRIDGE';
            }

            const nameSpan = document.createElement('span');
            nameSpan.innerText = `#${index} [${typeLabel}] (${Math.round(c.w)}x${Math.round(c.h)})`;
            nameSpan.style.flex = '1';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            nameSpan.style.whiteSpace = 'nowrap';
            nameSpan.onclick = () => {
                EditorState.selectedCollider = c;
                refreshColliderList();
                updatePropsUI();
            };

            const tierSelect = document.createElement('select');
            tierSelect.className = 'scene-obj-tier-select';
            tierSelect.title = 'Change Collider Z-Tier';

            const currentTier = c.zTier !== undefined ? Number(c.zTier) : 0;
            for (let t = 0; t <= 9; t++) {
                const opt = document.createElement('option');
                opt.value = t;
                opt.innerText = `T${t}`;
                if (t === currentTier) opt.selected = true;
                tierSelect.appendChild(opt);
            }

            tierSelect.onclick = (e) => e.stopPropagation();
            tierSelect.onchange = (e) => {
                e.stopPropagation();
                const newTier = parseInt(e.target.value);
                setColliderZTier(c, newTier);
            };

            item.appendChild(nameSpan);
            item.appendChild(tierSelect);
            listContainer.appendChild(item);
        });
    }

    function setColliderZTier(col, newTier) {
        if (!col) return;
        col.zTier = newTier;
        col.zStatic = newTier;
        col.zMin = newTier;
        col.zMax = newTier + 1;

        RK.CollisionMZ.SpatialPartition.build(RK.CollisionMZ.EnvironmentData);
        updatePropsUI();
    }

    // =========================================================================
    // 7. SCENE HOOKS & KEYBOARD TRAPS
    // =========================================================================

    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);

        window.addEventListener('mousedown', onCanvasMouseDown);
        window.addEventListener('mousemove', onCanvasMouseMove);
        window.addEventListener('mouseup', onCanvasMouseUp);

        const mapHasTag = !!($dataMap && $dataMap.meta && $dataMap.meta.DevMap);
        const shouldOpen = paramAutoOpen || mapHasTag;

        if (shouldOpen) {
            window.RK_isEditorActive = true;

            if (RK.Battle && RK.Battle.Core) {
                RK.Battle.Core.isPaused = paramAutoPause;
            }

            $gameTemp._rkDebugCollision = true;
        }

        loadDockUI().then(() => {
            if (window.RK_isEditorActive) {
                if (dockElement) {
                    dockElement.style.display = 'block';
                    const mapLabel = document.getElementById('dock-map-id');
                    if (mapLabel && $gameMap) {
                        mapLabel.innerText = `Map_${String($gameMap.mapId()).padStart(3, '0')}`;
                    }

                    const btn = document.getElementById('dock-btn-pause');
                    if (btn && RK.Battle && RK.Battle.Core) {
                        const isPaused = RK.Battle.Core.isPaused;
                        btn.innerText = isPaused ? '⏸️ Paused' : '▶️ Running';
                        btn.style.color = isPaused ? 'var(--neon-yellow)' : 'var(--neon-blue)';
                        btn.style.borderColor = isPaused ? 'var(--neon-yellow)' : 'var(--neon-blue)';
                    }
                }
                refreshSceneObjectList();
            }
        });

        if (RK.Battle && RK.Battle.Events) {
            RK.Battle.Events.on('OBJECT_DESTROYED', (destroyedObj) => {
                if (EditorState.selectedSceneObject === destroyedObj) {
                    EditorState.selectedSceneObject = null;
                }
                if (window.RK_isEditorActive) {
                    refreshSceneObjectList();
                }
            });
        }
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

        // Hotkey F6 toggles IDE visibility
        if (Input.isTriggered('toggle_ide')) {
            window.RK_isEditorActive = !window.RK_isEditorActive;
            if (dockElement) {
                dockElement.style.display = window.RK_isEditorActive ? 'block' : 'none';
                const mapLabel = document.getElementById('dock-map-id');
                if (mapLabel) mapLabel.innerText = `Map_${String($gameMap.mapId()).padStart(3, '0')}`;
            }

            if (RK.Battle && RK.Battle.Core) {
                RK.Battle.Core.isPaused = window.RK_isEditorActive;
                const btn = document.getElementById('dock-btn-pause');
                if (btn) {
                    btn.innerText = window.RK_isEditorActive ? '⏸️ Paused' : '▶️ Running';
                    btn.style.color = window.RK_isEditorActive ? 'var(--neon-yellow)' : 'var(--neon-blue)';
                    btn.style.borderColor = window.RK_isEditorActive ? 'var(--neon-yellow)' : 'var(--neon-blue)';
                }
            }

            if (window.RK_isEditorActive) {
                $gameTemp._rkDebugCollision = true;
            }
        }
    };

    const _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        if (window.RK_isEditorActive) return false;
        return _Game_Player_canMove.call(this);
    };
})();