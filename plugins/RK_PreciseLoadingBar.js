/*:
 * @target MZ
 * @plugindesc Loading bar with fill animation and synchronized outer frame fadeout.
 * @author Custom
 *
 * @param HoldDuration
 * @text Hold Duration (Frames)
 * @type number
 * @default 180
 * @desc 180 frames = 3 seconds at 60 FPS.
 */

(() => {
    const HOLD_FRAMES = 180; // 3 seconds at 60 FPS

    let _totalAssets = 0;
    let _loadedAssets = 0;
    let _visualProgress = 0;
    let _holdTimer = 0;
    let _isHolding = false;
    let _loadingActive = false;
    let _canStartScene = false;

    const _ImageManager_loadBitmap = ImageManager.loadBitmap;
    ImageManager.loadBitmap = function(folder, filename) {
        const bitmap = _ImageManager_loadBitmap.call(this, folder, filename);
        if (_loadingActive && bitmap && !bitmap.isReady() && !bitmap.isError()) {
            _totalAssets++;
            bitmap.addLoadListener(() => {
                _loadedAssets++;
            });
        }
        return bitmap;
    };

    function getBarElement() {
        return document.getElementById("loadingSpinnerImage");
    }

    function getContainerElement() {
        return document.getElementById("loadingSpinner");
    }

    function showLoadingBar() {
        const container = getContainerElement();
        const bar = getBarElement();
        if (container) {
            container.classList.remove("loading-fadeout");
            container.style.display = "block";
        }
        if (bar) {
            bar.classList.remove("loading-success");
            bar.style.width = "0%";
        }
        _visualProgress = 0;
        _totalAssets = 0;
        _loadedAssets = 0;
        _holdTimer = 0;
        _isHolding = false;
        _canStartScene = false;
        _loadingActive = true;
    }

    function hideLoadingBar() {
        const container = getContainerElement();
        const bar = getBarElement();
        if (container) {
            container.classList.remove("loading-fadeout");
            container.style.display = "none";
        }
        if (bar) {
            bar.classList.remove("loading-success");
            bar.style.width = "0%";
        }
        _loadingActive = false;
        _isHolding = false;
        _canStartScene = false;
    }

    // 1. Hook New Game
    const _Scene_Title_commandNewGame = Scene_Title.prototype.commandNewGame;
    Scene_Title.prototype.commandNewGame = function() {
        showLoadingBar();
        _Scene_Title_commandNewGame.call(this);
    };

    // 2. Hook Load Game
    const _Scene_Load_onLoadSuccess = Scene_Load.prototype.onLoadSuccess;
    Scene_Load.prototype.onLoadSuccess = function() {
        showLoadingBar();
        _Scene_Load_onLoadSuccess.call(this);
    };

    // 3. Hook Map Transfers
    const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function() {
        if (this.isTransferring()) {
            showLoadingBar();
        }
        _Game_Player_performTransfer.call(this);
    };

    // Frame-by-frame loop
    const _SceneManager_updateMain = SceneManager.updateMain;
    SceneManager.updateMain = function() {
        _SceneManager_updateMain.call(this);

        if (!_loadingActive) return;

        const container = getContainerElement();
        const bar = getBarElement();

        const targetPercent = _totalAssets > 0 ? (_loadedAssets / _totalAssets) * 100 : 100;

        if (_visualProgress < targetPercent) {
            const step = Math.max(1.0, (targetPercent - _visualProgress) * 0.1);
            _visualProgress = Math.min(targetPercent, _visualProgress + step);
            if (bar && !_isHolding) {
                bar.style.width = _visualProgress.toFixed(1) + "%";
            }
        }

        // Trigger the 3-second hold and apply animations to BOTH container and bar
        if (_visualProgress >= 100 && !_isHolding) {
            _isHolding = true;
            _holdTimer = HOLD_FRAMES;
            if (bar) {
                bar.style.width = "100%";
                bar.classList.add("loading-success");
            }
            if (container) {
                container.classList.add("loading-fadeout");
            }
        }

        if (_isHolding) {
            if (_holdTimer > 0) {
                _holdTimer--;
            } else {
                _canStartScene = true;
                hideLoadingBar();
            }
        }
    };

    const _Scene_Map_isReady = Scene_Map.prototype.isReady;
    Scene_Map.prototype.isReady = function() {
        const ready = _Scene_Map_isReady.call(this);

        if (_loadingActive) {
            return ready && _canStartScene;
        }

        return ready;
    };
})();