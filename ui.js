        function onBgmVolumeChange(val) {
            bgmVolumeMult = val / 100;
            document.getElementById('bgm-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_bgm_volume', bgmVolumeMult);
            applyBgmVolume();
        }

        function onSfxVolumeChange(val) {
            sfxVolumeMult = val / 100;
            document.getElementById('sfx-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_sfx_volume', sfxVolumeMult);
        }

        function resetVolumeSettings() {
            onBgmVolumeChange(30);
            onSfxVolumeChange(100);
            document.getElementById('bgm-vol-slider').value = 30;
            document.getElementById('sfx-vol-slider').value = 100;
        }

        // 明らかにスパム/おかしな名前を弾く簡易チェック（記号だけ・同じ文字の連続など）
        function initVolumeSliders() {
            const bgmSlider = document.getElementById('bgm-vol-slider');
            const sfxSlider = document.getElementById('sfx-vol-slider');
            if (bgmSlider) { bgmSlider.value = Math.round(bgmVolumeMult * 100); document.getElementById('bgm-vol-label').innerText = bgmSlider.value + '%'; }
            if (sfxSlider) { sfxSlider.value = Math.round(sfxVolumeMult * 100); document.getElementById('sfx-vol-label').innerText = sfxSlider.value + '%'; }
            const nameInput = document.getElementById('player-name-input');
            if (nameInput) nameInput.value = playerName;
        }

        // ✏️ 意見・要望の送信（サーバーが無いので、メールアプリに下書きを渡す形にしています。
        // 実際に使う時は下のFEEDBACK_EMAILを自分の受け取りたいメールアドレスに書き換えてください）
        let uiDeclutterState = 0;
        function toggleUiDeclutter() {
            uiDeclutterState = (uiDeclutterState + 1) % 4;
            document.body.classList.remove('ui-mode-1', 'ui-mode-2', 'ui-mode-3');
            if (uiDeclutterState > 0) {
                document.body.classList.add('ui-mode-' + uiDeclutterState);
            }
            fixBottomGap(); // 表示するバーが変わって#game-screenの自然な高さが変わるので測り直す
        }

        // PWA: Service Workerを登録（対応ブラウザのみ、失敗しても通常プレイに影響なし）
        // 🐛修正：GitHub Pagesは自分でHTTPヘッダーを設定できないため、ブラウザがsw.js自体を
        // 予想より長くキャッシュしてしまい、通常モードだと更新が反映されないことがあった。
        // register()直後にupdate()を明示的に呼んで、sw.js自体の再チェックを強制する。
        // さらに、新しいSWが実際に有効になった瞬間を検知して、1回だけ自動でページを再読み込みする。
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').then((reg) => {
                    reg.update().catch(() => {});
                    setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000); // 開いたままの人のためのフォローアップ
                }).catch(() => {});

                let hasReloadedForUpdate = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (hasReloadedForUpdate) return; // 無限リロードを避ける
                    hasReloadedForUpdate = true;
                    location.reload();
                });
            });
        }

        // スマホ環境の2本指ズーム・ダブルタップズームを制限
        document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
        let hasSeenTutorial = false; // 初回チュートリアルを見せたかどうか

        // 🍴 もちすけにお土産をあげる機能（回数制限なし）
        let balloonAutoHideTimer = null;
        function showMochiComment(text) {
            const balloon = document.getElementById('mochi-balloon');
            if (!balloon) return;
            balloon.innerText = text;
            balloon.classList.add('balloon-show');
            lastTappedTime = Date.now(); // 表示直後にすぐ別のセリフへ切り替わらないようにリセット
            clearTimeout(balloonAutoHideTimer);
            if (!isTutorialActive) {
                balloonAutoHideTimer = setTimeout(() => { balloon.classList.remove('balloon-show'); }, 4000);
            }
        }

        // プレゼントや黄金もちが消えた時など、表示中のセリフを引っ込めるためのヘルパー
        function hideMochiComment() {
            const balloon = document.getElementById('mochi-balloon');
            if (balloon) balloon.classList.remove('balloon-show');
        }

        // 🎙️ セリフの表示/非表示を一元的に検知して、口パーツの切り替えと効果音をまとめて処理する
        // （showMochiComment/updateCheerBalloon/チュートリアルなど、色々な場所からセリフが更新されても、ここ1箇所で拾える）
        // 👄 口パーツは「通常の姿・話していない・叫んでいない・必殺技で巨大化していない」時だけ表示する。
        // 叫び顔・必殺技巨大化は、それぞれ専用のイラスト/拡大を使うため、口パーツを重ねると浮いて見えてしまう。
        function updateMouthPatchVisibility() {
            const mouthPatchEl = document.getElementById('mochisuke-mouth-patch');
            if (!mouthPatchEl) return;
            if (mouthAdjustMode) { mouthPatchEl.style.display = 'block'; return; } // 🐛修正：調整中は、セリフ等で見えなくなるとイライラするので常に表示する
            const balloonEl = document.getElementById('mochi-balloon');
            const isTalking = balloonEl && balloonEl.classList.contains('balloon-show');
            const isHissatsuActive = skills.hissatsu && skills.hissatsu.activeTimer > 0;
            // 伸ばしたり潰したりしている間・その後の揺れ戻りアニメーション中は、口パーツが元の位置に浮いて見えてしまうため非表示にする
            const shouldHide = isTalking || isScreamActive || isHissatsuActive || isDraggingSqueeze || isSqueezeSettling;
            mouthPatchEl.style.display = shouldHide ? 'none' : 'block';
        }

        (function setupBalloonObserver() {
            const balloonEl = document.getElementById('mochi-balloon');
            if (!balloonEl) return;
            let wasShowing = false;
            const observer = new MutationObserver(() => {
                const isShowing = balloonEl.classList.contains('balloon-show');
                if (isShowing === wasShowing) return;
                wasShowing = isShowing;
                updateMouthPatchVisibility();
                // 🤖 ロボもちすけ装備中は、通常の「パッ」ではなく専用の口（窓）アニメ＋「ウィーン」音にする
                if (equippedKisekae.fullbody === 'fullbody_robo') {
                    playRoboMouthAnimation(isShowing);
                } else if (isShowing) {
                    playAudioFile('audio/talk_pop.mp3');
                }
            });
            observer.observe(balloonEl, { attributes: true, attributeFilter: ['class'] });
        })();

        // 🤖 ロボもちすけの口（窓）アニメーション。open=trueで開くコマ送り、falseで閉じるコマ送り（開く時の逆再生）
        let roboMouthAnimTimer = null;
        function playRoboMouthAnimation(open) {
            const item = KISEKAE_ITEMS.fullbody.find(i => i.id === 'fullbody_robo');
            const mainImg = document.getElementById('mochisuke-fullbody');
            if (!item || !mainImg) return;
            const frames = item.mouthFrames;
            clearInterval(roboMouthAnimTimer);
            if (isMochisukeVisible()) playAudioFile('audio/kisekae/robo_whir.mp3'); // ウィーン音（開閉どちらも同じ音、見えている画面の時だけ）
            let i = open ? 0 : frames.length - 1;
            const step = open ? 1 : -1;
            roboMouthAnimTimer = setInterval(() => {
                mainImg.src = frames[i];
                i += step;
                if ((open && i >= frames.length) || (!open && i < 0)) {
                    clearInterval(roboMouthAnimTimer);
                    mainImg.src = open ? frames[frames.length - 1] : item.img; // 開き切ったら最終フレーム維持、閉じ切ったら口閉じ画像に戻る
                }
            }, 60); // 5コマを300msで再生
        }

        // 🫁 口パーツの呼吸は、もちすけ画像と共通の親要素(#mochisuke-breathe-wrap)にアニメーションをかけることで、
        // 追いかけて同期させるのではなく、そもそもズレようがない形で実現している（詳細はHTML側を参照）
        let mouthAdjustMode = false; // 調整モード中かどうか

        // 時間帯の並び順（インデックスは他の場所でも共通して使う）
        const TIME_BUCKETS = ['morning', 'noon', 'evening', 'lateNight'];
        function getTimeGreeting() {
            const bucket = TIME_BUCKETS[getTimeBucketIndex(new Date().getHours())];
            return pickRandom(dialogueData.timeGreetings[bucket]);
        }

        function getLocalDateString(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        // 画面を開いた直後の挨拶。その日その時間帯にまだ挨拶していなければ「おはよう」等、
        // 既に挨拶済みなら「おかえり」を出す。両方ともlocalStorageに記録して次回に引き継ぐ。
        const GREETING_STATE_KEY = 'punicker_last_greeting_bucket';
        let tutorialStepIndex = 0;
        let tutorialTimer = null;
        let isTutorialActive = false;

        function checkShowTutorial() {
            if (hasSeenTutorial) return;
            // 何かしら既にプレイした形跡があれば、初見扱いにしない
            if (score > 0 || totalTapsCount > 0) { hasSeenTutorial = true; saveGame(); return; }
            openTutorial();
        }

        function openTutorial() {
            tutorialStepIndex = 0;
            isTutorialActive = true;
            document.body.classList.add('tutorial-active');
            document.querySelectorAll('.recommended-glow').forEach(el => el.classList.remove('recommended-glow'));
            runTutorialStep();
        }

        function runTutorialStep() {
            document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));

            if (tutorialStepIndex >= TUTORIAL_STEPS.length) {
                endTutorial();
                return;
            }
            const step = TUTORIAL_STEPS[tutorialStepIndex];

            if (step.highlight) {
                const el = document.getElementById(step.highlight);
                if (el) el.classList.add('tutorial-glow');
            }

            const balloon = document.getElementById('mochi-balloon');
            clearTimeout(balloonAutoHideTimer);
            balloon.innerText = step.text;
            balloon.classList.add('balloon-show');

            clearTimeout(tutorialTimer);
            tutorialTimer = setTimeout(() => {
                tutorialStepIndex++;
                runTutorialStep();
            }, step.duration);
        }

        function endTutorial() {
            isTutorialActive = false;
            document.body.classList.remove('tutorial-active');
            document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));
            hasSeenTutorial = true;
            saveGame();
            promptPlayerNameIfNeeded();
        }

        function confirmSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'flex';
        }
        function doSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'none';
            clearTimeout(tutorialTimer);
            hideMochiComment();
            endTutorial(); // そのまま名前を決めるところまで進む
        }

        // 🍴 チュートリアルの最後に、まだ名前を決めていなければ聞いておく
        function promptPlayerNameIfNeeded() {
            if (localStorage.getItem('punicker_player_name')) return;
            const input = document.getElementById('tutorial-name-input');
            if (input) input.value = playerName;
            openModal('tutorial-name-modal');
        }
        function saveTutorialPlayerName() {
            const input = document.getElementById('tutorial-name-input');
            const result = sanitizePlayerName(input.value);
            if (!result.ok) { alert(result.reason); return; }
            playerName = result.name;
            localStorage.setItem('punicker_player_name', playerName);
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            closeModal('tutorial-name-modal');
        }

        // 💬 4つの丸ボタン、初めて押した時だけ軽くヒントを出す（チュートリアル終了後の、2周目以降のフォロー用）
        let seenButtonHints = { map: false, menu: false, ui: false, feed: false };
        function onMapButtonTap() {
            if (!seenButtonHints.map) { seenButtonHints.map = true; saveGame(); showMochiComment('地図で好きな県に飛べるで！'); }
            openMap();
        }
        // 🔓 隠しコマンド：PWA（ホーム画面）ではURLを直接打てないため、⚙️ボタンを素早く7回タップすると
        // 合言葉入力で管理者モードを有効化できるようにする
        let menuBtnTapCount = 0;
        let menuBtnTapTimer = null;
        // 🗺️⚙️🖼️🍴 4隅ボタンの位置・大きさを反映する
        function applyCornerBtnPositions() {
            document.documentElement.style.setProperty('--corner-btn-size', CORNER_BTN_SIZE + 'px');
            const isPwa = isRunningStandalone();
            const getOffsets = (id) => (isPwa && CORNER_BTN_OFFSETS_PWA_OVERRIDE[id]) ? CORNER_BTN_OFFSETS_PWA_OVERRIDE[id] : CORNER_BTN_OFFSETS[id];
            const map = document.getElementById('map-toggle-btn');
            map.style.top = `calc(8px + env(safe-area-inset-top, 0px) + ${getOffsets('map-toggle-btn').vert}px)`;
            map.style.left = getOffsets('map-toggle-btn').horiz + 'px';
            const menu = document.getElementById('menu-toggle-btn');
            menu.style.top = `calc(8px + env(safe-area-inset-top, 0px) + ${getOffsets('menu-toggle-btn').vert}px)`;
            menu.style.right = getOffsets('menu-toggle-btn').horiz + 'px';
            const ui = document.getElementById('ui-toggle-btn');
            ui.style.bottom = `calc(14px + env(safe-area-inset-bottom, 0px) + ${getOffsets('ui-toggle-btn').vert}px)`;
            ui.style.left = getOffsets('ui-toggle-btn').horiz + 'px';
            const feed = document.getElementById('feed-toggle-btn');
            feed.style.bottom = `calc(14px + env(safe-area-inset-bottom, 0px) + ${getOffsets('feed-toggle-btn').vert}px)`;
            feed.style.right = getOffsets('feed-toggle-btn').horiz + 'px';
        }
        // 🛠️ 開発者用：4隅ボタンの調整ツール（大きさは共通、位置は個別にドラッグ調整）
        let cornerBtnAdjustMode = false;
        let cornerBtnDragState = null;
        function adjustCornerBtnSize(delta) {
            CORNER_BTN_SIZE = Math.max(20, CORNER_BTN_SIZE + delta);
            document.getElementById('corner-btn-size-readout').textContent = CORNER_BTN_SIZE + 'px';
            applyCornerBtnPositions();
        }
        function toggleCornerBtnAdjustMode() {
            cornerBtnAdjustMode = !cornerBtnAdjustMode;
            const btn = document.getElementById('corner-btn-adjust-toggle-btn');
            btn.style.background = cornerBtnAdjustMode ? '#4caf50' : '#e91e63';
            if (cornerBtnAdjustMode) setupCornerBtnDrag();
            updateCornerBtnReadout();
        }
        function onCornerBtnAdjustTargetChange() {
            updateCornerBtnReadout();
        }
        // PWA(ホーム画面)かどうかで、参照・更新すべきオフセットのデータを切り替える
        function getCornerBtnOffsetsRef(id) {
            return (isRunningStandalone() && CORNER_BTN_OFFSETS_PWA_OVERRIDE[id]) ? CORNER_BTN_OFFSETS_PWA_OVERRIDE[id] : CORNER_BTN_OFFSETS[id];
        }
        function setupCornerBtnDrag() {
            if (document.body.dataset.cornerDragSetup) return;
            document.body.dataset.cornerDragSetup = '1';
            ['map-toggle-btn', 'menu-toggle-btn', 'ui-toggle-btn', 'feed-toggle-btn'].forEach(id => {
                const el = document.getElementById(id);
                el.addEventListener('pointerdown', (e) => {
                    if (!cornerBtnAdjustMode) return;
                    if (document.getElementById('corner-btn-adjust-target').value !== id) return;
                    e.preventDefault();
                    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
                    cornerBtnDragState = { id, startX: e.clientX, startY: e.clientY };
                });
            });
            document.body.addEventListener('pointermove', (e) => {
                if (!cornerBtnDragState || !cornerBtnAdjustMode) return;
                const dx = e.clientX - cornerBtnDragState.startX;
                const dy = e.clientY - cornerBtnDragState.startY;
                const id = cornerBtnDragState.id;
                const offsets = getCornerBtnOffsetsRef(id);
                const isTop = (id === 'map-toggle-btn' || id === 'menu-toggle-btn');
                const isLeft = (id === 'map-toggle-btn' || id === 'ui-toggle-btn');
                offsets.vert = Math.max(0, offsets.vert + (isTop ? dy : -dy));
                offsets.horiz = Math.max(0, offsets.horiz + (isLeft ? dx : -dx));
                cornerBtnDragState.startX = e.clientX; cornerBtnDragState.startY = e.clientY;
                applyCornerBtnPositions();
                updateCornerBtnReadout();
            });
            document.body.addEventListener('pointerup', () => { cornerBtnDragState = null; });
            document.body.addEventListener('pointercancel', () => { cornerBtnDragState = null; });
        }
        function updateCornerBtnReadout() {
            const id = document.getElementById('corner-btn-adjust-target').value;
            const offsets = getCornerBtnOffsetsRef(id);
            const envLabel = isRunningStandalone() ? '（PWA）' : '（通常URL）';
            document.getElementById('corner-btn-adjust-readout').textContent = `${envLabel} vert:${offsets.vert}px; horiz:${offsets.horiz}px;`;
        }
        function copyCornerBtnCoords() {
            const labels = { 'map-toggle-btn': '地図', 'menu-toggle-btn': '設定', 'ui-toggle-btn': '背景', 'feed-toggle-btn': 'お土産一覧' };
            const envLabel = isRunningStandalone() ? '【PWA(ホーム画面)】' : '【通常URL】';
            const lines = [envLabel, `大きさ(共通): ${CORNER_BTN_SIZE}px`];
            ['map-toggle-btn', 'menu-toggle-btn', 'ui-toggle-btn', 'feed-toggle-btn'].forEach(id => {
                const offsets = getCornerBtnOffsetsRef(id);
                lines.push(`${labels[id]}(${id}): vert:${offsets.vert}px; horiz:${offsets.horiz}px;`);
            });
            const text = lines.join('\n');
            const textarea = document.getElementById('corner-btn-copy-textarea');
            textarea.value = text;
            textarea.style.display = 'block';
            textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }
        function onMenuButtonTap() {
            menuBtnTapCount++;
            clearTimeout(menuBtnTapTimer);
            menuBtnTapTimer = setTimeout(() => { menuBtnTapCount = 0; }, 1500);
            if (menuBtnTapCount >= 7) {
                menuBtnTapCount = 0;
                const key = prompt('合言葉を入力してください');
                if (key === 'zk9m2xq7wv4p8trh21bs') {
                    try { localStorage.setItem('punicker_dev_mode', '1'); } catch (e) {}
                    IS_DEV_MODE = true;
                    window.IS_DEV_MODE = true;
                    const section = document.getElementById('dev-tools-section');
                    if (section) section.style.display = 'block';
                    alert('🔓 管理者モードが有効になりました！');
                } else if (key !== null) {
                    alert('違います');
                }
                return;
            }
            if (!seenButtonHints.menu) { seenButtonHints.menu = true; saveGame(); showMochiComment('設定はここから触れるで！'); }
            openModal('menu-modal'); refreshCloudBackupStatus();
        }
        function onUiButtonTap() {
            if (!seenButtonHints.ui) { seenButtonHints.ui = true; saveGame(); showMochiComment('写真撮る時とかに使こてな！'); }
            toggleUiDeclutter();
        }
        function onFeedButtonTap() {
            if (!seenButtonHints.feed) { seenButtonHints.feed = true; saveGame(); showMochiComment('ここからお土産あげられるんやで！'); }
            openOmiyageCollection();
        }

        function showOpeningGreeting() {
            const now = new Date();
            const bucketIdx = getTimeBucketIndex(now.getHours());
            const bucketName = TIME_BUCKETS[bucketIdx];
            const todayKey = getLocalDateString(now) + '_' + bucketName;
            const lastKey = localStorage.getItem(GREETING_STATE_KEY);
            let text;
            if (lastKey === todayKey) {
                text = pickRandom(dialogueData.welcomeBack[bucketName]);
            } else {
                text = pickRandom(dialogueData.timeGreetings[bucketName]);
                localStorage.setItem(GREETING_STATE_KEY, todayKey);
            }
            lastGreetingHourBucket = bucketIdx; // アイドルループがすぐ二重に挨拶し直さないように
            showMochiComment(text);
        }

        let mouthDragState = null;
        function toggleMouthAdjustMode() {
            mouthAdjustMode = !mouthAdjustMode;
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const wrap = document.getElementById('mochisuke-breathe-wrap');
            const btn = document.getElementById('mouth-adjust-toggle-btn');
            if (!anchor || !wrap) return;
            if (mouthAdjustMode) {
                // 呼吸などの動きが付いたままだと位置合わせしづらいので、いったん基本の姿勢で止める
                wrap.classList.remove('breathe-idle');
                wrap.style.transform = 'scale(1, 1)';
                hideMochiComment(); // セリフも消して、口を閉じた状態の見た目で正確に合わせられるようにする
                anchor.style.display = 'block';
                anchor.style.pointerEvents = 'auto';
                anchor.style.outline = '2px dashed #e91e63';
                if (btn) btn.style.background = '#4caf50';
                setupMouthDrag(anchor);
                updateMouthReadout();
            } else {
                wrap.style.transform = '';
                wrap.classList.add('breathe-idle');
                anchor.style.pointerEvents = 'none';
                anchor.style.outline = '';
                if (btn) btn.style.background = '#e91e63';
            }
        }
        function setupMouthDrag(anchor) {
            if (anchor.dataset.dragSetup) return; // 二重登録防止
            anchor.dataset.dragSetup = '1';
            anchor.addEventListener('pointerdown', (e) => {
                if (!mouthAdjustMode) return;
                e.stopPropagation(); e.preventDefault();
                try { anchor.setPointerCapture(e.pointerId); } catch (err) {}
                mouthDragState = { startX: e.clientX, startY: e.clientY };
            });
            anchor.addEventListener('pointermove', (e) => {
                if (!mouthDragState || !mouthAdjustMode) return;
                e.stopPropagation();
                const frame = document.getElementById('mochisuke-img-frame');
                const rect = frame.getBoundingClientRect();
                const dxPct = ((e.clientX - mouthDragState.startX) / rect.width) * 100;
                const dyPct = ((e.clientY - mouthDragState.startY) / rect.height) * 100;
                const curLeft = parseFloat(anchor.style.left) || 0;
                const curTop = parseFloat(anchor.style.top) || 0;
                anchor.style.left = (curLeft + dxPct) + '%';
                anchor.style.top = (curTop + dyPct) + '%';
                mouthDragState.startX = e.clientX;
                mouthDragState.startY = e.clientY;
                updateMouthReadout();
            });
            anchor.addEventListener('pointerup', () => { mouthDragState = null; });
            anchor.addEventListener('pointercancel', () => { mouthDragState = null; });
        }
        function adjustMouthSize(delta) {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            if (!anchor) return;
            const cur = parseFloat(anchor.style.width) || 18;
            anchor.style.width = Math.max(3, cur + delta) + '%';
            updateMouthReadout();
        }
        function updateMouthReadout() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const el = document.getElementById('mouth-adjust-readout');
            if (!anchor || !el) return;
            el.textContent = `top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
        }
        function copyMouthCoords() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const text = `口パーツ: top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
            const textarea = document.getElementById('mouth-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        // 🛠️ もちすけ本体の大きさ調整。着せ替え部屋も全く同じ大きさに揃える約束なので、
        // ここで変えた値は、着せ替え部屋のもちすけ本体にもその場で同期する
        function adjustMochisukeBodySize(deltaWidth, deltaMaxHeight) {
            const btn = document.getElementById('mochisuke-btn');
            const curWidth = parseFloat(btn.style.width) || 170;
            const curMaxH = parseFloat(btn.style.maxHeight) || 206;
            const newWidth = Math.max(60, curWidth + deltaWidth);
            const newMaxH = Math.max(60, curMaxH + deltaMaxHeight);
            btn.style.width = newWidth + 'px';
            btn.style.maxHeight = newMaxH + 'px';
            const roomWrap = document.getElementById('kisekae-mochisuke-wrap');
            if (roomWrap) { roomWrap.style.width = newWidth + 'px'; roomWrap.style.maxHeight = newMaxH + 'px'; }
            updateMochisukeBodyReadout();
        }
        function updateMochisukeBodyReadout() {
            const btn = document.getElementById('mochisuke-btn');
            const el = document.getElementById('mochisuke-body-readout');
            if (!btn || !el) return;
            el.textContent = `width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};（着せ替え部屋にも自動で同期済み）`;
        }
        function copyMochisukeBodyCoords() {
            const btn = document.getElementById('mochisuke-btn');
            const text = `もちすけ本体: width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};`;
            const textarea = document.getElementById('mochisuke-body-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        function openModal(id, skipSound) {
            cancelFeedDragIfActive(); // 給餌中に他画面へ移動したら、置きっぱなしのおみやげを片付ける
            if (!skipSound) playAudioFile('audio/skill_tap.mp3');
            document.body.classList.add('modal-open');
            document.getElementById(id).style.display = "flex";
        }
        function closeModal(id) {
            document.body.classList.remove('modal-open'); document.getElementById(id).style.display = "none";
            // 🔴 スタンプを押さずに絵日記を閉じた場合、進捗エリアのボタンを再表示して操作不能にならないようにする
            if (id === 'diary-modal' && isPendingStampMoment) {
                const btn = document.getElementById('stamp-press-btn');
                if (btn) btn.style.display = 'flex';
            }
        }

        function openTrophyRoom() {
            const grid = document.getElementById('trophy-grid');
            grid.innerHTML = "";
            stages.forEach((stage, i) => {
                const cell = document.createElement('div');
                cell.style.cssText = "text-align:center; padding:6px 2px; border-radius:8px; background:#fff8ec; cursor:pointer;";
                if (i > currentStageIndex) {
                    cell.style.opacity = "0.4";
                    cell.innerHTML = `<div style="font-size:1.3rem;">❓</div><div style="font-size:0.55rem; color:#999;">???</div>`;
                    cell.onclick = () => alert("まだ訪れていない県じゃ！旅を進めよう。");
                } else {
                    const trophy = getPrefTrophy(i);
                    cell.innerHTML = `<div style="font-size:1.3rem;">${getPrefTrophyIcon(trophy)}</div><div style="font-size:0.55rem; color:#5d4037;">${stage.name}</div>`;
                    cell.onclick = () => showPrefTrophyDetail(i);
                }
                grid.appendChild(cell);
            });
            openModal('trophy-room-modal');
        }

        // 💼 おしごとミッション
        function closeOshigoto() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('mission-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function openOshigotoPlaceholder() {
            checkAndRotateMissions(); // 開くたびに、日付/週またぎを最新化する
            openModal('mission-modal');
            switchMissionTab(currentMissionTab);
        }
        let currentMissionTab = 'tutorial';
        function switchMissionTab(tab) {
            currentMissionTab = tab;
            ['tutorial', 'daily', 'weekly'].forEach(t => {
                document.getElementById(`mission-tab-${t}`).classList.toggle('active', t === tab);
            });
            renderMissionList();
        }
        function renderMissionRow(mission) {
            const progress = getMissionProgress(mission);
            const complete = isMissionComplete(mission);
            const claimed = missionClaimed[mission.id];
            let btnHtml;
            if (claimed) {
                btnHtml = `<button class="item-action-btn" disabled style="background:#bbb; color:#fff;">受取済</button>`;
            } else if (complete) {
                btnHtml = `<button class="item-action-btn btn-green" onclick="onClaimMissionTap('${mission.id}')">受け取る</button>`;
            } else {
                btnHtml = `<button class="item-action-btn" disabled style="background:#ddd; color:#999;">未達成</button>`;
            }
            const progressText = `${Math.min(progress, mission.target)}/${mission.target}`;
            const pct = Math.min(100, (progress / mission.target) * 100);
            const isDone = claimed || complete; // 進捗バーの色分け用（水色にするかどうか）
            let cardClass = '';
            if (claimed) cardClass = 'mission-card-claimed'; // 受取済みだけ、ポケポケ風に薄い灰色にする
            else if (complete) cardClass = 'mission-card-done';
            return `
                <div class="mission-card ${cardClass}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.85rem; font-weight:700; color:#5d4037;">${mission.text}</span>
                        <span style="font-size:0.7rem; color:#e91e63; font-weight:900; flex-shrink:0; margin-left:8px;">🪙${mission.reward}</span>
                    </div>
                    <div style="background:#e8e0d5; border-radius:6px; height:8px; overflow:hidden; margin-top:8px;">
                        <div style="background:${isDone ? '#4fc3f7' : '#4caf50'}; height:100%; width:${pct}%; transition:width 0.3s;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <span style="font-size:0.7rem; color:#999;">${progressText}</span>
                        ${btnHtml}
                    </div>
                </div>
            `;
        }
        function renderMissionList() {
            const container = document.getElementById('mission-list-container');
            let html = '';

            if (currentMissionTab === 'tutorial') {
                if (tutorialMissionStep < TUTORIAL_MISSIONS.length) {
                    html += renderMissionRow(TUTORIAL_MISSIONS[tutorialMissionStep]);
                } else {
                    html += `<div style="text-align:center; color:#aaa; font-size:0.8rem; padding:24px;">はじめてのおしごとは、もう全部クリアしたで！</div>`;
                }
            } else if (currentMissionTab === 'daily') {
                missionDailySelected.forEach(id => {
                    const m = getMissionDef(id);
                    if (m) html += renderMissionRow(m);
                });
            } else if (currentMissionTab === 'weekly') {
                missionWeeklySelected.forEach(id => {
                    const m = getMissionDef(id);
                    if (m) html += renderMissionRow(m);
                });
            }

            container.innerHTML = html;
        }
        function onClaimMissionTap(id) {
            const success = claimMission(id);
            if (success) {
                playAudioFile('audio/levelup.mp3');
                updateDisplay();
                renderMissionList();
            }
        }

        // 🤝 フレンド機能
        async function openFriendPlaceholder() {
            openModal('friend-modal');
            document.getElementById('friend-add-result').innerText = '';
            document.getElementById('friend-code-input').value = '';

            const codeEl = document.getElementById('my-friend-code');
            codeEl.innerText = '読み込み中...';
            if (window.isRankingReady && window.isRankingReady()) {
                const code = await window.ensureMyFriendCode();
                codeEl.innerText = code || '（取得できませんでした）';
            } else {
                codeEl.innerText = '（オフラインです）';
            }
            switchFriendTab('list');
        }
        // 🏠 誰でも、フレンドコード・ランキングを問わず、他の人の部屋を見に行ける（読み取り専用）
        let visitingUid = null;
        async function visitMyroomOf(uid, showBoth) {
            if (!window.fetchMyroomData) return;
            const data = await window.fetchMyroomData(uid);
            if (!data || !data.myroom) {
                alert('🏠 まだお部屋が公開されていません');
                return;
            }
            visitingUid = uid;
            document.getElementById('visit-myroom-name-label').textContent = showBoth ? `🏠 ${data.name}さんの部屋にお邪魔中` : `🏠 ${data.name}さんの部屋`;
            renderVisitMyroomLayout(data.myroom);
            applyVisitOutfit(data.outfit, 'visit-myroom-mochisuke');
            const myselfWrap = document.getElementById('visit-myroom-myself-breathe-wrap');
            if (showBoth) {
                // 🚶 フレンド訪問時は、自分（今の着せ替え）も一緒に部屋に立って歩き回る
                myselfWrap.style.display = 'block';
                applyVisitOutfit(equippedKisekae, 'visit-myroom-myself');
            } else {
                myselfWrap.style.display = 'none';
            }
            openModal('visit-myroom-modal');
            startVisitMochisukeWalk('visit-myroom-mochisuke-breathe-wrap', 'visitHost');
            if (showBoth) startVisitMochisukeWalk('visit-myroom-myself-breathe-wrap', 'visitSelf');
            // ❤️ 既にいいね済みかどうか確認して、ボタンの状態を反映する
            const likeBtn = document.getElementById('visit-like-btn');
            likeBtn.disabled = false;
            likeBtn.textContent = '❤️ いいね';
            likeBtn.style.background = '#e91e63';
            if (window.checkRoomLiked) {
                const alreadyLiked = await window.checkRoomLiked(uid);
                if (alreadyLiked) {
                    likeBtn.disabled = true;
                    likeBtn.textContent = '❤️ いいね済み';
                    likeBtn.style.background = '#ccc';
                }
            }
        }
        async function onLikeRoomTap() {
            if (!visitingUid || !window.likeRoom) return;
            const likeBtn = document.getElementById('visit-like-btn');
            likeBtn.disabled = true;
            const res = await window.likeRoom(visitingUid);
            if (res.success) {
                likeBtn.textContent = '❤️ いいね済み';
                likeBtn.style.background = '#ccc';
                playAudioFile('audio/levelup.mp3');
                gachaCoins += 1; // 🪙 いいねを送った自分も、ガチャコインを1枚もらう
                saveGame();
                updateGachaCoinDisplay();
                showLikeCoinPopup(likeBtn);
            } else if (res.reason === 'already') {
                likeBtn.textContent = '❤️ いいね済み';
                likeBtn.style.background = '#ccc';
            } else {
                likeBtn.disabled = false;
                if (res.reason !== 'self') alert('いいねできませんでした。時間を置いて試してください');
            }
        }
        // 🪙 いいねを送った瞬間、ボタンの近くに「+1」がふわっと浮かんで消える演出
        function showLikeCoinPopup(anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            const popup = document.createElement('div');
            popup.textContent = '🪙 +1';
            popup.style.cssText = `position:fixed; left:${rect.left + rect.width / 2}px; top:${rect.top}px; transform:translateX(-50%); font-size:1.15rem; font-weight:900; color:#ff9800; z-index:9999; pointer-events:none; animation: likeCoinPopupFloat 1.2s ease-out forwards;`;
            document.body.appendChild(popup);
            setTimeout(() => popup.remove(), 1300);
        }
        function closeVisitMyroom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('visit-myroom-modal');
                visitingUid = null;
                stopVisitMochisukeWalk('visitHost');
                stopVisitMochisukeWalk('visitSelf');
                // 🐛修正：下に隠れているランキング・フレンド画面がまだ開いたままなら、modal-openクラスを維持する
                const rankingModal = document.getElementById('ranking-modal');
                const friendModal = document.getElementById('friend-modal');
                if ((rankingModal && rankingModal.style.display === 'flex') || (friendModal && friendModal.style.display === 'flex')) {
                    document.body.classList.add('modal-open');
                }
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        // 🚶 部屋訪問中も、ホスト・自分それぞれ独立してランダムに歩き回らせる
        const visitWalkTimers = { visitHost: null, visitSelf: null };
        function startVisitMochisukeWalk(wrapId, key) {
            stopVisitMochisukeWalk(key);
            scheduleNextVisitWalk(wrapId, key);
        }
        function stopVisitMochisukeWalk(key) {
            clearTimeout(visitWalkTimers[key]);
            visitWalkTimers[key] = null;
        }
        function scheduleNextVisitWalk(wrapId, key) {
            const pauseDuration = 3000 + Math.random() * 4000; // 3〜7秒くらい、その場に立ち止まる
            visitWalkTimers[key] = setTimeout(() => walkVisitMochisukeToRandomSpot(wrapId, key), pauseDuration);
        }
        function walkVisitMochisukeToRandomSpot(wrapId, key) {
            const wrap = document.getElementById(wrapId);
            if (!wrap || wrap.style.display === 'none') return;
            const currentLeft = parseFloat(wrap.style.left) || 50;
            const newLeftPct = 12 + Math.random() * 76;
            const newBottomPct = 1 + Math.random() * 8;
            const distance = Math.abs(newLeftPct - currentLeft);
            const moveDuration = Math.max(0.5, distance / MYROOM_WALK_SPEED_PCT_PER_SEC).toFixed(2); // 一定速度になるよう距離から逆算
            wrap.style.transition = `left ${moveDuration}s linear, bottom ${moveDuration}s linear`;
            wrap.style.left = newLeftPct + '%';
            wrap.style.bottom = newBottomPct + '%';
            const inner = document.getElementById(wrapId.replace('-breathe-wrap', '-inner'));
            if (inner) inner.classList.add('myroom-walking');
            playAudioFile('audio/move_small.mp3', 0.12);
            setTimeout(() => { if (inner) inner.classList.remove('myroom-walking'); }, moveDuration * 1000);
            scheduleNextVisitWalk(wrapId, key);
        }
        function renderVisitMyroomLayout(myroomData) {
            const wallpaperItem = MYROOM_ITEMS.wallpaper.find(i => i.id === myroomData.wallpaper) || MYROOM_ITEMS.wallpaper[0];
            const flooringItem = MYROOM_ITEMS.flooring.find(i => i.id === myroomData.flooring) || MYROOM_ITEMS.flooring[0];
            document.getElementById('visit-myroom-wallpaper').src = wallpaperItem.img;
            document.getElementById('visit-myroom-flooring').src = flooringItem.img;
            const layer = document.getElementById('visit-myroom-furniture-layer');
            layer.innerHTML = '';
            ['wall_deco', 'big_furniture', 'table', 'small_deco'].forEach(cat => {
                (myroomData[cat] || []).forEach(inst => {
                    const item = MYROOM_ITEMS[cat] && MYROOM_ITEMS[cat].find(i => i.id === inst.itemId);
                    if (!item) return;
                    const el = document.createElement('img');
                    el.src = item.img;
                    el.style.cssText = `position:absolute; top:${inst.top}%; left:${inst.left}%; width:${item.width}%; height:${item.height}%; transform:${inst.flip ? 'scaleX(-1)' : 'none'}; z-index:${inst.zIndex || 10};`;
                    layer.appendChild(el);
                });
            });
        }
        function applyVisitOutfit(outfit, prefix) {
            const fullbodyId = outfit && outfit.fullbody;
            const clothesEl = document.getElementById(`${prefix}-clothes`);
            const fullbodyEl = document.getElementById(`${prefix}-fullbody`);
            if (fullbodyId) {
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                if (fbItem) { fullbodyEl.src = fbItem.img; fullbodyEl.style.display = 'block'; }
                clothesEl.style.opacity = '0';
                ['hat', 'face'].forEach(cat => { document.getElementById(`${prefix}-${cat}`).style.display = 'none'; });
            } else {
                fullbodyEl.style.display = 'none';
                clothesEl.style.opacity = '1';
                const clothesItem = (outfit && KISEKAE_ITEMS.clothes.find(i => i.id === outfit.clothes)) || KISEKAE_ITEMS.clothes[0];
                clothesEl.src = clothesItem.img;
                ['hat', 'face'].forEach(cat => {
                    const el = document.getElementById(`${prefix}-${cat}`);
                    const itemId = outfit && outfit[cat];
                    const item = itemId ? KISEKAE_ITEMS[cat].find(i => i.id === itemId) : null;
                    if (item) {
                        el.src = item.img;
                        el.style.display = 'block';
                        el.style.top = item.top + '%'; el.style.left = item.left + '%';
                        el.style.width = item.width + '%'; el.style.height = item.height + '%';
                        el.style.transform = `rotate(${item.rotation || 0}deg)`;
                    } else {
                        el.style.display = 'none';
                    }
                });
            }
            const backId = (outfit && !fullbodyId) ? outfit.back : null;
            const leftEl = document.getElementById(`${prefix}-wing-left`);
            const rightEl = document.getElementById(`${prefix}-wing-right`);
            const backItem = backId ? KISEKAE_ITEMS.back.find(i => i.id === backId) : null;
            if (backItem) {
                leftEl.style.display = 'block'; rightEl.style.display = 'block';
                leftEl.src = backItem.leftFrames[0]; rightEl.src = backItem.rightFrames[0];
                const lp = backItem.leftFramePos[0], rp = backItem.rightFramePos[0];
                leftEl.style.top = lp.top + '%'; leftEl.style.left = lp.left + '%';
                leftEl.style.width = backItem.width + '%'; leftEl.style.height = backItem.height + '%';
                rightEl.style.top = rp.top + '%'; rightEl.style.left = rp.left + '%';
                rightEl.style.width = backItem.width + '%'; rightEl.style.height = backItem.height + '%';
            } else {
                leftEl.style.display = 'none'; rightEl.style.display = 'none';
            }
        }
        function sendVisitStamp(text) {
            alert(`「${text}」を送りました！`);
        }
        function closeFriendScreen() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('friend-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        let currentFriendTab = 'list';
        function switchFriendTab(tab) {
            currentFriendTab = tab;
            ['list', 'favorite', 'add'].forEach(t => {
                document.getElementById(`friend-tab-${t}`).classList.toggle('active', t === tab);
            });
            document.getElementById('friend-list-view').style.display = (tab === 'add') ? 'none' : 'block';
            document.getElementById('friend-add-view').style.display = (tab === 'add') ? 'block' : 'none';
            if (tab === 'list' || tab === 'favorite') renderFriendList();
        }
        async function copyMyFriendCode() {
            const code = document.getElementById('my-friend-code').innerText;
            if (!code || code.includes('（') || code.includes('読み込み')) return;
            const result = document.getElementById('friend-add-result');
            try {
                if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unsupported');
                await navigator.clipboard.writeText(code);
                result.style.color = '#4caf50';
                result.innerText = 'コピーしました！';
            } catch (e) {
                // 🐛修正：自動コピーが失敗しても気づけず「コピーしました」と表示していたため、
                // 古い内容のままペーストして「コードが見つからない」バグに繋がっていた。
                // 失敗時は、コードを選択状態にして、長押しで手動コピーできるようにする
                result.style.color = '#e57373';
                result.innerText = '自動コピーに失敗しました。コードを長押しして選択・コピーしてください';
                const codeEl = document.getElementById('my-friend-code');
                try {
                    const range = document.createRange();
                    range.selectNodeContents(codeEl);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch (err) {}
            }
        }
        async function onAddFriendTap() {
            const input = document.getElementById('friend-code-input');
            const result = document.getElementById('friend-add-result');
            // 🐛保険：コピペ時に紛れ込む改行・空白などの見えない文字を除去してから照合する
            const code = input.value.trim().replace(/[^A-Za-z0-9]/g, '');
            if (!code) return;
            if (!window.isRankingReady || !window.isRankingReady()) {
                result.style.color = '#e57373'; result.innerText = '通信エラー：時間を置いて試してください'; return;
            }
            result.style.color = '#999'; result.innerText = '追加中...';
            const res = await window.addFriendByCode(code);
            if (res.success) {
                result.style.color = '#4caf50';
                result.innerText = `${res.name}さんとフレンドになりました！`;
                input.value = '';
            } else if (res.reason === 'not_found') {
                result.style.color = '#e57373'; result.innerText = 'そのコードは見つかりませんでした';
            } else if (res.reason === 'self') {
                result.style.color = '#e57373'; result.innerText = '自分のコードは追加できません';
            } else {
                const errMsg = `通信エラーが発生しました${res.errorMessage ? '\n(' + res.errorMessage + ')' : ''}`;
                result.style.color = '#e57373'; result.innerText = errMsg;
                if (res.errorMessage) alert(`⚠️ フレンド追加エラーの詳細：\n${res.errorMessage}`); // 見逃さないよう、確実に表示する
            }
        }
        function toggleFavoriteFriend(uid) {
            const idx = favoriteFriendIds.indexOf(uid);
            if (idx >= 0) favoriteFriendIds.splice(idx, 1);
            else favoriteFriendIds.push(uid);
            saveGame();
            renderFriendList();
        }
        let lastGiftSentDateStr = null; // 🐛修正：1日1回までの送信制限。セーブデータにも保存し、リロードでリセットされないようにする
        async function sendGachaCoinGift(uid, btnEl) {
            const todayStr = new Date().toISOString().slice(0, 10);
            if (lastGiftSentDateStr === todayStr) {
                alert('🪙 今日はもう送りました。また明日！');
                return;
            }
            if (!window.isRankingReady || !window.isRankingReady()) {
                alert('通信エラー：時間を置いて試してください');
                return;
            }
            btnEl.disabled = true;
            const res = await window.sendGiftCoin(uid);
            if (res.success) {
                lastGiftSentDateStr = todayStr;
                btnEl.innerHTML = '✅';
                playAudioFile('audio/levelup.mp3');
                saveGame();
            } else {
                btnEl.disabled = false;
                alert('送信できませんでした。時間を置いて試してください');
            }
        }
        async function renderFriendList() {
            const listEl = document.getElementById('friend-list-view');
            listEl.innerHTML = `<div style="text-align:center; color:#aaa; padding:14px;">読み込み中...</div>`;
            if (!window.isRankingReady || !window.isRankingReady()) {
                listEl.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">通信エラーのため、フレンド一覧を表示できません</div>`;
                return;
            }
            let friends = await window.fetchFriendList();
            if (!friends) friends = [];
            if (currentFriendTab === 'favorite') friends = friends.filter(f => favoriteFriendIds.includes(f.uid));

            if (friends.length === 0) {
                listEl.innerHTML = currentFriendTab === 'favorite'
                    ? `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">まだお気に入りがいません。<br>フレンド一覧の⭐を押して登録してみましょう！</div>`
                    : `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">まだフレンドがいません。<br>「追加」タブから、コードを教え合って追加してみましょう！</div>`;
                return;
            }
            listEl.innerHTML = '';
            const todayStr = new Date().toISOString().slice(0, 10);
            const alreadySentToday = lastGiftSentDateStr === todayStr;
            friends.sort((a, b) => b.score - a.score);
            friends.forEach(f => {
                const isFav = favoriteFriendIds.includes(f.uid);
                const row = document.createElement('div');
                row.style.cssText = `display:flex; align-items:center; gap:8px; padding:9px 8px; margin-bottom:6px; border-radius:12px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.08);`;
                row.innerHTML = `
                    <div style="flex-shrink:0; position:relative; width:44px; height:44px;">${renderRankOutfitPreviewHtml(f.outfit)}</div>
                    <div style="flex-shrink:0; align-self:stretch; width:1px; background:#e0d5c5;"></div>
                    <div style="flex:1; min-width:0; padding-left:4px;">
                        <div style="font-size:0.88rem; color:#5d4037; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.name)}</div>
                        <div style="font-size:0.62rem; color:#aaa; margin-top:2px;">ID: ${f.friendCode}</div>
                    </div>
                    <button onclick="toggleFavoriteFriend('${f.uid}')" style="flex-shrink:0; background:none; border:none; font-size:1.2rem; padding:4px;">${isFav ? '⭐' : '☆'}</button>
                    <button onclick="visitMyroomOf('${f.uid}', true)" style="flex-shrink:0; background:#8d6e63; color:#fff; border:none; border-radius:50%; width:34px; height:34px; font-size:1rem;">🏠</button>
                    <button onclick="sendGachaCoinGift('${f.uid}', this)" ${alreadySentToday ? 'disabled' : ''} style="flex-shrink:0; background:${alreadySentToday ? '#ccc' : '#ff9800'}; color:#fff; border:none; border-radius:50%; width:38px; height:38px; font-size:1.2rem; font-weight:900;">🪙</button>
                `;
                listEl.appendChild(row);
            });
        }
        // 🎁 起動時に、自分宛の未受領ギフトが無いか確認する
        async function checkIncomingGiftsOnLaunch() {
            if (!window.isRankingReady || !window.isRankingReady()) return;
            const gifts = await window.checkIncomingGifts();
            if (!gifts || gifts.length === 0) return;
            const totalAmount = gifts.reduce((sum, g) => sum + (g.amount || 0), 0);
            gachaCoins += totalAmount;
            saveGame(); updateDisplay();

            // 🏠❤️ 部屋のいいね由来と、フレンドからの直接送付を分けて、分かりやすく通知する
            const likeGifts = gifts.filter(g => g.reason === 'roomLike');
            const friendGifts = gifts.filter(g => g.reason !== 'roomLike');
            const messages = [];
            if (likeGifts.length > 0) {
                const likeAmount = likeGifts.reduce((sum, g) => sum + (g.amount || 0), 0);
                messages.push(`🏠 マイルームにいいね${likeGifts.length}個もらえた！ガチャコイン${likeAmount}枚ゲット！`);
            }
            if (friendGifts.length > 0) {
                const friendAmount = friendGifts.reduce((sum, g) => sum + (g.amount || 0), 0);
                const names = [...new Set(friendGifts.map(g => g.fromName))].join('、');
                messages.push(`🎁 ${names}さんから、ガチャコインを${friendAmount}枚もらいました！`);
            }
            setTimeout(() => {
                alert(messages.join('\n\n'));
            }, 800);
        }

        // 🚧「移動する」の最終的なUIはまだ未定。ひとまず一覧を出す形で仮実装しておく
        function openMoveMenu() {
            openModal('move-menu-modal'); // 移動先を選ぶだけなので、ここではフェードしない（選んだ時にフェードする）
            renderMoveMenuParts();
            startMoveMochisukeLoop();
        }
        // 🐹 もちすけが、ものおき→ショップ→ゲーセン→マイルーム→戻る看板、の順に看板の右をワープして回る演出
        const MOVE_MOCHISUKE_SIGN_ORDER = ['move-sign-warehouse', 'move-sign-shop', 'move-sign-arcade', 'move-sign-myroom', 'move-sign-return'];
        let moveMochisukeLoopTimer = null;
        let moveMochisukeLoopIndex = 0;
        function startMoveMochisukeLoop() {
            stopMoveMochisukeLoop();
            moveMochisukeLoopIndex = 0;
            updateMoveMochisukePosition();
            moveMochisukeLoopTimer = setInterval(() => {
                moveMochisukeLoopIndex = (moveMochisukeLoopIndex + 1) % MOVE_MOCHISUKE_SIGN_ORDER.length;
                updateMoveMochisukePosition();
            }, 1500);
        }
        function stopMoveMochisukeLoop() {
            if (moveMochisukeLoopTimer) clearInterval(moveMochisukeLoopTimer);
            moveMochisukeLoopTimer = null;
        }
        function updateMoveMochisukePosition() {
            const signId = MOVE_MOCHISUKE_SIGN_ORDER[moveMochisukeLoopIndex];
            const signPart = MOVE_MENU_PARTS.find(p => p.id === signId);
            const returnSignPart = MOVE_MENU_PARTS.find(p => p.id === 'move-sign-return');
            const mochi = document.getElementById('move-mochisuke-guide');
            if (!signPart || !mochi) return;
            // ちょこんと縮んでから、次の看板の位置へワープする（「とことこ」感を出す一瞬の縮み演出）
            mochi.animate([
                { transform: 'scale(1, 1)' },
                { transform: 'scale(0.6, 1.3)', offset: 0.4 },
                { transform: 'scale(1, 1)' },
            ], { duration: 260, easing: 'ease-in-out' });
            // 🐛修正：以前は看板ごとの幅を基準にしていたため、看板の大きさが違うともちすけの大きさも違って見えていた。
            // 「戻る看板」の幅を基準にした固定値にして、どの看板の横にいても同じ大きさに統一する
            const mochiWidth = returnSignPart.width * 0.55;
            mochi.style.width = mochiWidth + '%';
            mochi.style.top = (signPart.top + signPart.height * 0.15) + '%';
            mochi.style.left = (signPart.left + signPart.width + 1.5) + '%';
        }
        // MOVE_MENU_PARTSの座標を、実際の画像に反映する
        function renderMoveMenuParts() {
            MOVE_MENU_PARTS.forEach(p => {
                const el = document.getElementById(p.id);
                if (!el) return;
                el.style.top = p.top + '%';
                el.style.left = p.left + '%';
                el.style.width = p.width + '%';
                el.style.height = p.height + '%';
            });
        }
        // 移動先が決まった時だけ、ここでフェード＋移動音を鳴らしてから実際に画面を切り替える
        function moveMenuGoTo(fn) {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            stopMoveMochisukeLoop();
            setTimeout(() => {
                closeModal('move-menu-modal');
                fn();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function moveMenuGoHome() {
            moveMenuGoTo(() => {});
        }

        function closeWarehouse() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('warehouse-modal');
                playBgmLoop('audio/bgm/bgm.mp3'); // 通常のBGMに戻す
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function warehouseItemAction(action) {
            if (action === 'trophy') openTrophyRoom();
            else if (action === 'omiyage') openOmiyageCollection();
            else if (action === 'ticket') openTicketInventory();
            else if (action === 'diary') openDiary();
        }
        function renderWarehouseItems() {
            const stage = document.getElementById('warehouse-item-stage');
            stage.querySelectorAll('.warehouse-item-wrap').forEach(el => el.remove());
            WAREHOUSE_ITEM_PARTS.forEach(part => {
                const img = document.createElement('img');
                img.className = 'warehouse-item-wrap';
                img.id = part.id;
                img.src = part.img;
                img.alt = part.label;
                img.style.cssText = `top:${part.top}%; left:${part.left}%; width:${part.width}%; height:${part.height}%; object-fit:contain;`;
                img.onclick = () => warehouseItemAction(part.action);
                stage.appendChild(img);
            });
            // おみやげの進捗バッジを、おみやげイラストの右上に合わせる
            const omiyagePart = WAREHOUSE_ITEM_PARTS.find(p => p.action === 'omiyage');
            const badge = document.getElementById('warehouse-omiyage-badge');
            if (omiyagePart && badge) {
                badge.style.top = omiyagePart.top + '%';
                badge.style.left = (omiyagePart.left + omiyagePart.width - 12) + '%';
            }
        }
        // ===================================================================
        // 🛋️ マイルーム
        // ===================================================================
        // 🚧 マイルームは仕様検討中のため、いったん開発者モード限定にしておく
        function openMyRoomEntry() {
            moveMenuGoTo(openMyRoom);
        }
        let previewMyroom = {};
        // 🎨 もようがえモード：通常時はUIを消してすっきり見せ、ボタンを押した時だけ編集UIを出す
        let myroomIsEditMode = false;
        // 🖐️ 大きさ調整パネル自体を、ドラッグで自由に動かせるようにする（「もようがえ」ボタン等と重ならないように避難できる）
        function setupMyroomSizePanelDrag() {
            const handle = document.getElementById('myroom-size-adjust-drag-handle');
            const panel = document.getElementById('myroom-size-adjust-panel');
            if (!handle || handle.dataset.dragSetup) return;
            handle.dataset.dragSetup = '1';
            let dragState = null;
            handle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                try { handle.setPointerCapture(e.pointerId); } catch (err) {}
                const rect = panel.getBoundingClientRect();
                dragState = { startX: e.clientX, startY: e.clientY, startTop: rect.top, startLeft: rect.left };
                handle.style.cursor = 'grabbing';
            });
            handle.addEventListener('pointermove', (e) => {
                if (!dragState) return;
                const stage = document.getElementById('myroom-stage');
                const stageRect = stage.getBoundingClientRect();
                let newTop = dragState.startTop + (e.clientY - dragState.startY) - stageRect.top;
                let newLeft = dragState.startLeft + (e.clientX - dragState.startX) - stageRect.left;
                newTop = Math.max(0, Math.min(stageRect.height - 40, newTop));
                newLeft = Math.max(0, Math.min(stageRect.width - 40, newLeft));
                panel.style.top = newTop + 'px';
                panel.style.left = newLeft + 'px';
                panel.style.right = 'auto';
            });
            const endDrag = () => { dragState = null; handle.style.cursor = 'grab'; };
            handle.addEventListener('pointerup', endDrag);
            handle.addEventListener('pointercancel', endDrag);
        }
        function toggleMyroomEditMode() {
            myroomIsEditMode = !myroomIsEditMode;
            selectedMyroomInstance = null;
            const editEls = document.querySelectorAll('.myroom-edit-ui');
            editEls.forEach(el => { el.style.display = myroomIsEditMode ? (el.tagName === 'DIV' ? 'flex' : 'block') : 'none'; });
            closeMyroomItemList(); // モード切替時は、必ずアイテム一覧を閉じた状態にする
            closeMyroomSwitcher(); // 部屋切り替えパネルも必ず閉じておく
            if (IS_DEV_MODE) {
                const sizePanel = document.getElementById('myroom-size-adjust-panel');
                if (sizePanel) sizePanel.style.display = myroomIsEditMode ? 'block' : 'none';
            }
            document.getElementById('myroom-decorate-btn').textContent = myroomIsEditMode ? '👁️ プレビュー' : '🎨 もようがえ';
            renderMyroomLayout(); // 削除ボタンの表示/非表示を確実に同期させる
        }
        // 🚶 マイルームでは、もちすけがランダムに歩き回る・立ち止まるを繰り返す
        let myroomWalkTimer = null;
        function startMyroomMochisukeWalk() {
            stopMyroomMochisukeWalk();
            scheduleNextMyroomWalk();
        }
        function stopMyroomMochisukeWalk() {
            clearTimeout(myroomWalkTimer);
            myroomWalkTimer = null;
        }
        const MYROOM_WALK_SPEED_PCT_PER_SEC = 22; // もちすけの歩く速さ（%/秒、一定）
        function scheduleNextMyroomWalk() {
            const pauseDuration = 3000 + Math.random() * 4000; // 3〜7秒くらい、その場に立ち止まる（前より少し頻度を減らした）
            myroomWalkTimer = setTimeout(walkMyroomMochisukeToRandomSpot, pauseDuration);
        }
        function walkMyroomMochisukeToRandomSpot() {
            const wrap = document.getElementById('myroom-mochisuke-breathe-wrap');
            if (!wrap) return;
            const currentLeft = parseFloat(wrap.style.left) || 50;
            const newLeftPct = 12 + Math.random() * 76; // 端に寄りすぎないよう12〜88%の範囲で歩く
            const newBottomPct = 1 + Math.random() * 8; // 床の中で少し前後にも動く
            // 🐛修正：距離に関わらず速度が一定になるよう、移動時間を距離から逆算する（前は時間固定で、距離次第で速さがバラついていた）
            const distance = Math.abs(newLeftPct - currentLeft);
            const moveDuration = Math.max(0.5, distance / MYROOM_WALK_SPEED_PCT_PER_SEC).toFixed(2);
            wrap.style.transition = `left ${moveDuration}s linear, bottom ${moveDuration}s linear`;
            wrap.style.left = newLeftPct + '%';
            wrap.style.bottom = newBottomPct + '%';
            const inner = document.getElementById('myroom-mochisuke-inner');
            if (inner) inner.classList.add('myroom-walking'); // 🚶 スーッと滑るのではなく、とことこ歩いて見えるようにする（内側要素だけをアニメーションさせ、外側の中央寄せtransformとぶつからないようにする）
            playAudioFile('audio/move_small.mp3', 0.12); // 歩く音を小さめにつける
            setTimeout(() => { if (inner) inner.classList.remove('myroom-walking'); }, moveDuration * 1000);
            scheduleNextMyroomWalk();
        }
        // 👆 マイルームでは、もちは出ないが、もちすけをタップすると反応してくれる
        function onMyroomMochisukeTap() {
            if (myroomIsEditMode) return; // もようがえモード中は、ドラッグ操作を優先する
            const inner = document.getElementById('myroom-mochisuke-inner');
            if (!inner) return;
            playAudioFile('audio/tap.mp3');
            inner.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(0.88)' }, { transform: 'scale(1)' }],
                { duration: 220, easing: 'ease-out' }
            );
        }
        // 🐛修正：PWA環境ではonclick属性が不安定になることがあるため、pointerupで明示的に判定する
        function setupMyroomMochisukeTapHandler() {
            const wrap = document.getElementById('myroom-mochisuke-breathe-wrap');
            if (!wrap || wrap.dataset.tapSetup) return;
            wrap.dataset.tapSetup = '1';
            wrap.addEventListener('pointerup', (e) => {
                e.stopPropagation();
                onMyroomMochisukeTap();
            });
        }
        function openMyRoom() {
            myroomIsEditMode = false;
            selectedMyroomInstance = null;
            myroomCurrentCategory = 'wallpaper';
            myroomItemListVisible = false;
            document.getElementById('myroom-switcher-overlay').style.display = 'none';
            // 🔀 部屋1がまだ無ければ、今のequippedMyroomをそのまま部屋1として引き継ぐ（既存プレイヤー対応）
            if (!myroomSlots[currentMyroomSlotIndex]) myroomSlots[currentMyroomSlotIndex] = JSON.parse(JSON.stringify(equippedMyroom));
            document.querySelectorAll('.myroom-edit-ui').forEach(el => el.style.display = 'none');
            document.getElementById('myroom-item-list-left').style.display = 'none';
            document.getElementById('myroom-item-list-right').style.display = 'none';
            document.getElementById('myroom-decorate-btn').textContent = '🎨 もようがえ';
            previewMyroom = JSON.parse(JSON.stringify(equippedMyroom)); // 配列(家具配置)も含めて完全に独立させる
            renderMyroomLayout();
            applyKisekaeToMyroom();
            openModal('myroom-modal');
            playBgmLoop('audio/bgm/bgm_myroom.mp3'); // マイルーム専用BGMに切り替え
            const mochisukeWrap = document.getElementById('myroom-mochisuke-breathe-wrap');
            if (mochisukeWrap) { mochisukeWrap.style.transition = 'none'; mochisukeWrap.style.left = '50%'; mochisukeWrap.style.bottom = '2%'; }
            startMyroomMochisukeWalk();
            setupMyroomMochisukeTapHandler();
            if (IS_DEV_MODE) {
                renderMyroomSizeAdjustOptions();
                document.getElementById('myroom-size-adjust-panel').style.display = 'none'; // もようがえモードに入った時だけ表示する
                onMyroomSizeAdjustTargetChange();
                setupMyroomSizePanelDrag();
            }
        }
        function closeMyRoom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('myroom-modal');
                stopWingFlapLoop('myroom');
                stopMyroomMochisukeWalk();
                playBgmLoop('audio/bgm/bgm.mp3'); // 通常のBGMに戻す
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        let selectedMyroomInstance = null; // 今タップして選択中の家具 { cat, idx } または null
        function renderMyroomLayout() {
            const wallpaperItem = MYROOM_ITEMS.wallpaper.find(i => i.id === previewMyroom.wallpaper) || MYROOM_ITEMS.wallpaper[0];
            const flooringItem = MYROOM_ITEMS.flooring.find(i => i.id === previewMyroom.flooring) || MYROOM_ITEMS.flooring[0];
            document.getElementById('myroom-wallpaper-layer').src = wallpaperItem.img;
            document.getElementById('myroom-flooring-layer').src = flooringItem.img;

            const layer = document.getElementById('myroom-furniture-layer');
            layer.innerHTML = ''; // 一旦全部消してから配置し直す

            ['wall_deco', 'big_furniture', 'table', 'small_deco'].forEach(cat => {
                (previewMyroom[cat] || []).forEach((inst, idx) => {
                    const item = MYROOM_ITEMS[cat].find(i => i.id === inst.itemId);
                    if (!item) return;
                    const isSelected = !!(selectedMyroomInstance && selectedMyroomInstance.cat === cat && selectedMyroomInstance.idx === idx);
                    const el = document.createElement('img');
                    el.className = 'myroom-slot-img';
                    el.dataset.cat = cat;
                    el.dataset.idx = idx;
                    el.src = item.img;
                    const outline = (myroomIsEditMode && isSelected) ? 'outline:2px dashed #e91e63; outline-offset:2px;' : '';
                    el.style.cssText = `position:absolute; top:${inst.top}%; left:${inst.left}%; width:${item.width}%; height:${item.height}%; cursor:${myroomIsEditMode ? 'grab' : 'default'}; pointer-events:auto; transform:${inst.flip ? 'scaleX(-1)' : 'none'}; z-index:${inst.zIndex || 10}; ${outline}`;
                    layer.appendChild(el);

                    // ボタン類は、もようがえモード中に「選択中」の家具にだけ表示する（沢山置いた時にどれのボタンか分からなくなるため）
                    if (!myroomIsEditMode || !isSelected) return;

                    if (item.flippable) {
                        const flipBtn = document.createElement('button');
                        flipBtn.textContent = '🔄';
                        flipBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top)}%; left:${Math.min(94, inst.left + item.width)}%; width:24px; height:24px; border-radius:50%; border:none; background:rgba(255,255,255,0.92); font-size:0.75rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                        flipBtn.onclick = (e) => { e.stopPropagation(); toggleMyroomInstanceFlip(cat, idx); };
                        layer.appendChild(flipBtn);
                    }
                    const delBtn = document.createElement('button');
                    delBtn.textContent = '✕';
                    delBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top - 3)}%; left:${Math.max(0, inst.left - 2)}%; width:22px; height:22px; border-radius:50%; border:none; background:rgba(244,67,54,0.9); color:#fff; font-size:0.7rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                    delBtn.onclick = (e) => { e.stopPropagation(); removeMyroomInstance(cat, idx); };
                    layer.appendChild(delBtn);

                    const frontBtn = document.createElement('button');
                    frontBtn.textContent = '⬆️';
                    frontBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top + item.height - 12)}%; left:${Math.min(90, inst.left + item.width)}%; width:22px; height:22px; border-radius:50%; border:none; background:rgba(255,255,255,0.92); font-size:0.65rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                    frontBtn.title = '前面へ';
                    frontBtn.onclick = (e) => { e.stopPropagation(); moveMyroomInstanceLayer(cat, idx, 1); };
                    layer.appendChild(frontBtn);

                    const backBtn = document.createElement('button');
                    backBtn.textContent = '⬇️';
                    backBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top + item.height)}%; left:${Math.min(90, inst.left + item.width)}%; width:22px; height:22px; border-radius:50%; border:none; background:rgba(255,255,255,0.92); font-size:0.65rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                    backBtn.title = '背面へ';
                    backBtn.onclick = (e) => { e.stopPropagation(); moveMyroomInstanceLayer(cat, idx, -1); };
                    layer.appendChild(backBtn);
                });
            });
            setupMyroomFurnitureDrag();
        }
        // ⬆️⬇️ 家具の重なり順（前面・背面）を調整する
        function moveMyroomInstanceLayer(cat, idx, delta) {
            const inst = previewMyroom[cat][idx];
            inst.zIndex = (inst.zIndex || 10) + delta;
            renderMyroomLayout();
        }
        // 🆕 家具を配置に追加する（上限あり）
        function addMyroomInstance(cat, itemId) {
            if (!previewMyroom[cat]) previewMyroom[cat] = [];
            if (previewMyroom[cat].length >= MYROOM_FURNITURE_LIMIT_PER_CATEGORY) {
                alert(`⚠️ ${MYROOM_CATEGORY_LABELS[cat]}は最大${MYROOM_FURNITURE_LIMIT_PER_CATEGORY}個までしか置けません`);
                return;
            }
            const ownedCount = (ownedMyroomItems[cat] || []).filter(id => id === itemId).length;
            const placedCount = previewMyroom[cat].filter(inst => inst.itemId === itemId).length;
            if (!IS_DEV_MODE && placedCount >= ownedCount) {
                alert(`⚠️ 所持している数（${ownedCount}個）より多くは配置できません。\nショップで追加購入できます。`);
                return;
            }
            const item = MYROOM_ITEMS[cat].find(i => i.id === itemId);
            // 最初はなるべく画面の中央（壁掛けは壁の中央）に配置する
            let top, left;
            if (cat === 'wall_deco') {
                top = (MYROOM_WALL_ZONE_BOTTOM - item.height) / 2;
                left = (100 - item.width) / 2;
            } else {
                top = 50 - item.height / 2;
                left = 50 - item.width / 2;
                if (top + item.height <= MYROOM_WALL_ZONE_BOTTOM) {
                    top = MYROOM_WALL_ZONE_BOTTOM - item.height + 0.1; // 床置き家具は、少しでも床に重なるよう強制する
                }
            }
            previewMyroom[cat].push({ itemId, top, left, flip: false });
            renderMyroomLayout();
            closeMyroomItemList();
            const label = document.getElementById('myroom-item-name-label');
            clearTimeout(myroomNameLabelTimeout);
            label.textContent = `${item.name}を置いたよ`;
            label.style.display = 'block';
            myroomNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, 2200);
        }
        function removeMyroomInstance(cat, idx) {
            previewMyroom[cat].splice(idx, 1);
            selectedMyroomInstance = null; // インデックスがずれるため、選択状態はリセットする
            renderMyroomLayout();
            if (myroomCurrentCategory === cat) openMyroomCategory(cat);
        }
        function toggleMyroomInstanceFlip(cat, idx) {
            previewMyroom[cat][idx].flip = !previewMyroom[cat][idx].flip;
            renderMyroomLayout();
        }
        // 📍 配置済みの家具を、プレイヤーが直接ドラッグで動かせるようにする（恒久機能）
        function setupMyroomFurnitureDrag() {
            const stage = document.getElementById('myroom-stage');
            if (stage.dataset.furnitureDragSetup) return;
            stage.dataset.furnitureDragSetup = '1';
            let dragState = null;
            stage.addEventListener('pointerdown', (e) => {
                if (!myroomIsEditMode) return; // 🎨 もようがえモード中だけ動かせる
                if (!e.target.classList.contains('myroom-slot-img')) {
                    // 家具以外の場所をタップしたら、選択を解除する
                    if (selectedMyroomInstance) { selectedMyroomInstance = null; renderMyroomLayout(); }
                    return;
                }
                const cat = e.target.dataset.cat, idx = parseInt(e.target.dataset.idx, 10);
                const wasAlreadySelected = !!(selectedMyroomInstance && selectedMyroomInstance.cat === cat && selectedMyroomInstance.idx === idx);
                selectedMyroomInstance = { cat, idx };
                // 選択が新しく変わった時だけ再描画する（ボタンを表示するため）。
                // renderMyroomLayoutで要素が作り直されるので、ドラッグ対象は改めて取得し直す
                let target = e.target;
                if (!wasAlreadySelected) {
                    renderMyroomLayout();
                    target = document.querySelector(`.myroom-slot-img[data-cat="${cat}"][data-idx="${idx}"]`);
                }
                if (!target) return;
                e.preventDefault();
                try { target.setPointerCapture(e.pointerId); } catch (err) {}
                dragState = { cat, idx, el: target, startX: e.clientX, startY: e.clientY };
                target.style.cursor = 'grabbing';
            });
            stage.addEventListener('pointermove', (e) => {
                if (!dragState) return;
                const stageRect = stage.getBoundingClientRect();
                const dxPct = ((e.clientX - dragState.startX) / stageRect.width) * 100;
                const dyPct = ((e.clientY - dragState.startY) / stageRect.height) * 100;
                const el = dragState.el;
                const width = parseFloat(el.style.width), height = parseFloat(el.style.height);
                let newTop = parseFloat(el.style.top) + dyPct;
                let newLeft = parseFloat(el.style.left) + dxPct;

                if (dragState.cat === 'wall_deco') {
                    // 🧱 壁掛けは、壁の範囲からはみ出せない
                    newTop = Math.max(0, Math.min(MYROOM_WALL_ZONE_BOTTOM - height, newTop));
                    newLeft = Math.max(0, Math.min(100 - width, newLeft));
                } else {
                    // 他の家具は、画面の外に完全に消えない程度なら、壁側にはみ出してもよいが、
                    // 床置きの家具なので、少しでも床(壁紙と床の境界より下)に重なっている必要がある
                    // 🐛修正：はみ出し量が大きすぎると、画面端に近づいた時にスマホのOSジェスチャー(戻る操作等)に
                    // 割り込まれてドラッグが強制中断され、身動きが取れなくなるバグがあったため、はみ出し量を小さくした
                    newTop = Math.max(-height * 0.1, Math.min(100 - height * 0.85, newTop));
                    newLeft = Math.max(-width * 0.15, Math.min(100 - width * 0.85, newLeft));
                    if (newTop + height <= MYROOM_WALL_ZONE_BOTTOM) {
                        newTop = MYROOM_WALL_ZONE_BOTTOM - height + 0.1; // ほんの少しだけ床に触れる位置まで押し下げる
                    }
                }
                el.style.top = newTop + '%';
                el.style.left = newLeft + '%';
                dragState.startX = e.clientX; dragState.startY = e.clientY;
                const inst = previewMyroom[dragState.cat][dragState.idx];
                inst.top = newTop; inst.left = newLeft;
            });
            const endDrag = () => {
                if (dragState) {
                    dragState.el.style.cursor = 'grab';
                    dragState = null;
                    renderMyroomLayout(); // ボタン(反転・削除)の位置を正しく再計算するため、ドラッグ終了時に作り直す
                }
            };
            stage.addEventListener('pointerup', endDrag);
            stage.addEventListener('pointercancel', endDrag);
        }

        // 🛠️ 開発者用：家具の大きさ調整ツール（位置はプレイヤー機能で調整するので、ここでは大きさのみ）
        let myroomSizeAdjustMode = false;
        let myroomSizeAdjustDragState = null;
        // アイテムごとに調整できるよう、ドロップダウンの選択肢を動的に生成する
        function renderMyroomSizeAdjustOptions() {
            const select = document.getElementById('myroom-size-adjust-target');
            let html = `<optgroup label="もちすけ本体"><option value="mochisuke__mochisuke">もちすけの大きさ</option></optgroup>`;
            ['wall_deco', 'big_furniture', 'table', 'small_deco'].forEach(cat => {
                if (!MYROOM_ITEMS[cat] || MYROOM_ITEMS[cat].length === 0) return;
                html += `<optgroup label="${MYROOM_CATEGORY_LABELS[cat]}">`;
                MYROOM_ITEMS[cat].forEach(item => {
                    html += `<option value="${cat}__${item.id}">${item.name}</option>`;
                });
                html += `</optgroup>`;
            });
            select.innerHTML = html;
        }
        function getMyroomSizeAdjustSelection() {
            const val = document.getElementById('myroom-size-adjust-target').value;
            const [cat, itemId] = val.split('__');
            if (cat === 'mochisuke') return { cat: 'mochisuke', item: MYROOM_MOCHISUKE_SIZE };
            return { cat, item: MYROOM_ITEMS[cat] ? MYROOM_ITEMS[cat].find(i => i.id === itemId) : null };
        }
        function getMyroomSizeAdjustTargetEl() {
            const { cat } = getMyroomSizeAdjustSelection();
            if (cat === 'mochisuke') return document.getElementById('myroom-mochisuke-breathe-wrap');
            return document.getElementById('myroom-size-preview-img');
        }
        function toggleMyroomSizeAdjustMode() {
            myroomSizeAdjustMode = !myroomSizeAdjustMode;
            const btn = document.getElementById('myroom-size-adjust-toggle-btn');
            const target = getMyroomSizeAdjustTargetEl();
            if (myroomSizeAdjustMode) {
                target.style.outline = '2px dashed #e91e63';
                btn.style.background = '#4caf50';
                setupMyroomSizeAdjustDrag();
                positionMyroomSizeHandles();
            } else {
                target.style.outline = '';
                ['myroom-size-resize-handle-r', 'myroom-size-resize-handle-b', 'myroom-size-resize-handle-br'].forEach(id => document.getElementById(id).style.display = 'none');
                btn.style.background = '#e91e63';
            }
        }
        function onMyroomSizeAdjustTargetChange() {
            document.querySelectorAll('.myroom-slot-img').forEach(el => el.style.outline = '');
            const mochisukeEl = document.getElementById('myroom-mochisuke-breathe-wrap');
            if (mochisukeEl) mochisukeEl.style.outline = '';
            const { cat, item } = getMyroomSizeAdjustSelection();
            if (!item) return;
            const previewImg = document.getElementById('myroom-size-preview-img');
            if (cat !== 'mochisuke') {
                // 実際の配置データ(previewMyroom)には触れず、専用のプレビュー要素にだけ試着表示する
                const defaultPos = MYROOM_SLOT_POSITIONS[cat];
                previewImg.src = item.img;
                previewImg.style.display = 'block';
                previewImg.style.top = defaultPos.top + '%';
                previewImg.style.left = defaultPos.left + '%';
                previewImg.style.width = item.width + '%';
                previewImg.style.height = item.height + '%';
            } else {
                previewImg.style.display = 'none';
            }
            if (!myroomSizeAdjustMode) { updateMyroomSizeReadout(); return; }
            const target = getMyroomSizeAdjustTargetEl();
            target.style.outline = '2px dashed #e91e63';
            positionMyroomSizeHandles();
            updateMyroomSizeReadout();
        }
        function positionMyroomSizeHandles() {
            if (!myroomSizeAdjustMode) return;
            const stage = document.getElementById('myroom-stage');
            const target = getMyroomSizeAdjustTargetEl();
            const stageRect = stage.getBoundingClientRect();
            const tRect = target.getBoundingClientRect();
            const rightPct = ((tRect.right - stageRect.left) / stageRect.width) * 100;
            const bottomPct = ((tRect.bottom - stageRect.top) / stageRect.height) * 100;
            const midYPct = ((tRect.top + tRect.height / 2 - stageRect.top) / stageRect.height) * 100;
            const midXPct = ((tRect.left + tRect.width / 2 - stageRect.left) / stageRect.width) * 100;
            const hR = document.getElementById('myroom-size-resize-handle-r'), hB = document.getElementById('myroom-size-resize-handle-b'), hBr = document.getElementById('myroom-size-resize-handle-br');
            [hR, hB, hBr].forEach(h => h.style.display = 'block');
            hR.style.left = rightPct + '%'; hR.style.top = midYPct + '%';
            hB.style.left = midXPct + '%'; hB.style.top = bottomPct + '%';
            hBr.style.left = rightPct + '%'; hBr.style.top = bottomPct + '%';
        }
        function setupMyroomSizeAdjustDrag() {
            const stage = document.getElementById('myroom-stage');
            if (stage.dataset.sizeDragSetup) return;
            stage.dataset.sizeDragSetup = '1';
            const startDrag = (e, mode) => {
                if (!myroomSizeAdjustMode) return;
                e.stopPropagation(); e.preventDefault();
                try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
                myroomSizeAdjustDragState = { startX: e.clientX, startY: e.clientY, mode };
            };
            stage.addEventListener('pointerdown', (e) => {
                if (!myroomSizeAdjustMode) return;
                if (e.target.id === 'myroom-size-resize-handle-r') return startDrag(e, 'width');
                if (e.target.id === 'myroom-size-resize-handle-b') return startDrag(e, 'height');
                if (e.target.id === 'myroom-size-resize-handle-br') return startDrag(e, 'both');
            });
            stage.addEventListener('pointermove', (e) => {
                if (!myroomSizeAdjustDragState || !myroomSizeAdjustMode) return;
                e.stopPropagation();
                const { cat, item } = getMyroomSizeAdjustSelection();
                if (!item) return;
                const target = getMyroomSizeAdjustTargetEl();
                const stageRect = stage.getBoundingClientRect();
                const dxPct = ((e.clientX - myroomSizeAdjustDragState.startX) / stageRect.width) * 100;
                const dyPct = ((e.clientY - myroomSizeAdjustDragState.startY) / stageRect.height) * 100;
                const mode = myroomSizeAdjustDragState.mode;
                if (cat === 'mochisuke') {
                    // もちすけはwidthのみ調整（heightは画像の縦横比で自動決定される）
                    if (mode === 'width' || mode === 'both') {
                        target.style.width = Math.max(2, parseFloat(target.style.width) + dxPct) + '%';
                        item.width = parseFloat(target.style.width);
                    }
                } else {
                    if (mode === 'width' || mode === 'both') target.style.width = Math.max(2, parseFloat(target.style.width) + dxPct) + '%';
                    if (mode === 'height' || mode === 'both') target.style.height = Math.max(2, parseFloat(target.style.height) + dyPct) + '%';
                    item.width = parseFloat(target.style.width);
                    item.height = parseFloat(target.style.height);
                }
                myroomSizeAdjustDragState.startX = e.clientX; myroomSizeAdjustDragState.startY = e.clientY;
                positionMyroomSizeHandles();
                updateMyroomSizeReadout();
            });
            stage.addEventListener('pointerup', () => { myroomSizeAdjustDragState = null; });
            stage.addEventListener('pointercancel', () => { myroomSizeAdjustDragState = null; });
        }
        function updateMyroomSizeReadout() {
            const { cat, item } = getMyroomSizeAdjustSelection();
            const el = document.getElementById('myroom-size-adjust-readout');
            if (!item || !el) return;
            el.textContent = (cat === 'mochisuke') ? `width:${item.width}%;` : `width:${item.width}%; height:${item.height}%;`;
        }
        function copyMyroomSizeCoords() {
            const lines = [`もちすけ本体: width:${MYROOM_MOCHISUKE_SIZE.width}%;`];
            ['wall_deco', 'big_furniture', 'table', 'small_deco'].forEach(cat => {
                (MYROOM_ITEMS[cat] || []).forEach(item => {
                    lines.push(`${item.name}(${item.id}): width:${item.width}%; height:${item.height}%;`);
                });
            });
            const text = lines.join('\n');
            const textarea = document.getElementById('myroom-size-copy-textarea');
            textarea.value = text;
            textarea.style.display = 'block';
            textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }
        const MYROOM_CATEGORY_ORDER = ['wallpaper', 'flooring', 'wall_deco', 'big_furniture', 'table', 'small_deco'];
        let myroomCurrentCategory = 'wallpaper';
        let myroomItemListVisible = false; // アイテム一覧が今表示されているか
        function closeMyroomItemList() {
            myroomItemListVisible = false;
            document.getElementById('myroom-item-list-left').style.display = 'none';
            document.getElementById('myroom-item-list-right').style.display = 'none';
            const countLabel = document.getElementById('myroom-placed-count-label');
            if (countLabel) countLabel.style.display = 'none';
        }
        function openMyroomCategory(cat) {
            playAudioFile('audio/skill_tap.mp3');
            // 同じカテゴリボタンをもう一度押したら、トグルで一覧を閉じる
            if (myroomCurrentCategory === cat && myroomItemListVisible) {
                closeMyroomItemList();
                return;
            }
            myroomItemListVisible = true;
            myroomCurrentCategory = cat;
            const sortedItems = [...MYROOM_ITEMS[cat]].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            const isFurnitureCat = (cat !== 'wallpaper' && cat !== 'flooring');
            // 壁紙・床は常に何か装着しているので「外す」ボタンあり。家具は個別の✕ボタンで削除するので一覧には無し
            const items = isFurnitureCat ? sortedItems : [{ id: null, name: '外す', isRemoveButton: true }, ...sortedItems];
            const owned = ownedMyroomItems[cat] || [];

            const leftList = document.getElementById('myroom-item-list-left');
            const rightList = document.getElementById('myroom-item-list-right');
            leftList.style.display = 'flex';
            rightList.style.display = 'flex';
            leftList.innerHTML = ''; rightList.innerHTML = '';

            if (isFurnitureCat) {
                let countEl = document.getElementById('myroom-placed-count-label');
                if (!countEl) {
                    countEl = document.createElement('div');
                    countEl.id = 'myroom-placed-count-label';
                    countEl.className = 'myroom-edit-ui';
                    countEl.style.cssText = 'position:absolute; top:19%; left:50%; transform:translateX(-50%); font-size:0.62rem; color:#8d6e63; font-weight:700; z-index:9; background:rgba(255,255,255,0.9); padding:2px 10px; border-radius:10px;';
                    document.getElementById('myroom-stage').appendChild(countEl);
                }
                const placedCount = (previewMyroom[cat] || []).length;
                countEl.textContent = `配置中：${placedCount}/${MYROOM_FURNITURE_LIMIT_PER_CATEGORY}個`;
                if (myroomIsEditMode) countEl.style.display = 'block';
            } else {
                const countEl = document.getElementById('myroom-placed-count-label');
                if (countEl) countEl.style.display = 'none';
            }

            items.forEach((item, i) => {
                const cell = document.createElement('div');
                if (item.isRemoveButton) {
                    const isEquipped = previewMyroom[cat] == null;
                    cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); cursor:pointer;`;
                    cell.innerHTML = `<div style="font-size:1.8rem; color:#e57373; font-weight:900;">✕</div>`;
                    cell.onclick = () => equipMyroomItem(cat, null);
                    (i % 2 === 0 ? leftList : rightList).appendChild(cell);
                    return;
                }
                const isOwned = owned.includes(item.id);
                const placedCount = isFurnitureCat ? (previewMyroom[cat] || []).filter(inst => inst.itemId === item.id).length : 0;
                const isEquipped = isFurnitureCat ? placedCount > 0 : previewMyroom[cat] === item.id;
                cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); ${isOwned ? 'cursor:pointer;' : ''}`;
                const badgeHtml = placedCount > 0 ? `<div style="position:absolute; bottom:2px; right:4px; background:#e91e63; color:#fff; font-size:0.6rem; font-weight:900; padding:1px 5px; border-radius:8px;">×${placedCount}</div>` : '';
                cell.innerHTML = `<img src="${item.img}" alt="${item.name}" style="width:80%; height:80%; object-fit:contain; ${isOwned ? '' : 'filter:grayscale(1); opacity:0.5;'}">${badgeHtml}`;
                if (!isOwned) {
                    cell.insertAdjacentHTML('beforeend', `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🔒</div>`);
                } else {
                    cell.onclick = () => isFurnitureCat ? addMyroomInstance(cat, item.id) : equipMyroomItem(cat, item.id);
                }
                (i % 2 === 0 ? leftList : rightList).appendChild(cell);
            });

            if (sortedItems.length === 0) {
                const emptyMsg = `<div style="text-align:center; color:#fff; font-size:0.68rem; padding:14px; text-shadow:0 1px 3px rgba(0,0,0,0.5); grid-column:1/-1;">まだアイテムがありません</div>`;
                leftList.insertAdjacentHTML('beforeend', emptyMsg);
            }

            document.querySelectorAll('.myroom-cat-btn').forEach((btn, idx) => {
                btn.style.boxShadow = (MYROOM_CATEGORY_ORDER[idx] === cat) ? '0 0 0 3px #ffd700, 0 3px 8px rgba(0,0,0,0.25)' : '0 3px 8px rgba(0,0,0,0.25)';
            });
        }
        let myroomNameLabelTimeout = null;
        function equipMyroomItem(cat, id) {
            previewMyroom[cat] = id;
            renderMyroomLayout();
            openMyroomCategory(cat);
            const item = id ? MYROOM_ITEMS[cat].find(i => i.id === id) : null;
            const label = document.getElementById('myroom-item-name-label');
            clearTimeout(myroomNameLabelTimeout);
            label.textContent = item ? item.name : '外す';
            label.style.display = 'block';
            myroomNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, 2200);
        }
        // 🔀 最大3部屋まで持てる。切り替えパネル
        let myroomSwitcherPreviewIndex = 0; // パネル内で＜＞で選んでいる番号（まだ確定していない）
        function openMyroomSwitcher() {
            myroomSwitcherPreviewIndex = currentMyroomSlotIndex;
            updateMyroomSwitcherView();
            document.getElementById('myroom-switcher-overlay').style.display = 'flex';
        }
        function closeMyroomSwitcher() {
            document.getElementById('myroom-switcher-overlay').style.display = 'none';
        }
        function switchMyroomSlotPreview(delta) {
            myroomSwitcherPreviewIndex = (myroomSwitcherPreviewIndex + delta + 3) % 3;
            updateMyroomSwitcherView();
        }
        function updateMyroomSwitcherView() {
            const isCurrent = myroomSwitcherPreviewIndex === currentMyroomSlotIndex;
            document.getElementById('myroom-switcher-label').textContent = `部屋${myroomSwitcherPreviewIndex + 1}${isCurrent ? '（今の部屋）' : ''}`;
            renderMyroomSwitcherThumbnail(myroomSwitcherPreviewIndex);
        }
        function renderMyroomSwitcherThumbnail(slotIndex) {
            const thumb = document.getElementById('myroom-switcher-thumbnail');
            // 今編集中の部屋を見ている場合は、保存前の最新状態(previewMyroom)を反映する
            const slot = (slotIndex === currentMyroomSlotIndex) ? previewMyroom : myroomSlots[slotIndex];
            if (!slot) {
                thumb.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#999; font-size:0.75rem; text-align:center; padding:8px; box-sizing:border-box;">まだ作られて<br>いません<br>（移動すると新規作成）</div>`;
                return;
            }
            const wallpaperItem = MYROOM_ITEMS.wallpaper.find(i => i.id === slot.wallpaper) || MYROOM_ITEMS.wallpaper[0];
            const flooringItem = MYROOM_ITEMS.flooring.find(i => i.id === slot.flooring) || MYROOM_ITEMS.flooring[0];
            let html = `<img src="${wallpaperItem.img}" style="position:absolute; top:0; left:0; width:100%; height:62%; object-fit:cover;">`;
            html += `<img src="${flooringItem.img}" style="position:absolute; top:62%; left:0; width:100%; height:38%; object-fit:cover;">`;
            ['wall_deco', 'big_furniture', 'table', 'small_deco'].forEach(cat => {
                (slot[cat] || []).forEach(inst => {
                    const item = MYROOM_ITEMS[cat] && MYROOM_ITEMS[cat].find(i => i.id === inst.itemId);
                    if (!item) return;
                    html += `<img src="${item.img}" style="position:absolute; top:${inst.top}%; left:${inst.left}%; width:${item.width}%; height:${item.height}%; transform:${inst.flip ? 'scaleX(-1)' : 'none'};">`;
                });
            });
            thumb.innerHTML = html;
        }
        function confirmMyroomSlotSwitch() {
            if (myroomSwitcherPreviewIndex === currentMyroomSlotIndex) { closeMyroomSwitcher(); return; }
            // 今編集中の部屋を、抜ける前にスロットへ保存しておく
            myroomSlots[currentMyroomSlotIndex] = JSON.parse(JSON.stringify(previewMyroom));
            currentMyroomSlotIndex = myroomSwitcherPreviewIndex;
            if (!myroomSlots[currentMyroomSlotIndex]) {
                // 新規部屋は、デフォルトの壁紙・床だけの状態で作る
                myroomSlots[currentMyroomSlotIndex] = {
                    wallpaper: 'wallpaper_default', flooring: 'flooring_default',
                    wall_deco: [], big_furniture: [], table: [], small_deco: [],
                };
            }
            previewMyroom = JSON.parse(JSON.stringify(myroomSlots[currentMyroomSlotIndex]));
            equippedMyroom = JSON.parse(JSON.stringify(myroomSlots[currentMyroomSlotIndex]));
            selectedMyroomInstance = null;
            renderMyroomLayout();
            saveGame();
            closeMyroomSwitcher();
        }
        function confirmMyroomLayout() {
            equippedMyroom = JSON.parse(JSON.stringify(previewMyroom)); // 配列(家具配置)も含めて完全に独立させる
            saveGame();
            const btn = document.getElementById('myroom-confirm-btn');
            const original = btn.innerText;
            btn.innerText = '✅ 決定しました！';
            setTimeout(() => { btn.innerText = original; }, 1200);
        }
        // 🌐 「決定」とは別に、実際にランキング・フレンドから見られるようにするには「公開する」を押す必要がある
        function onPublishMyroomTap() {
            if (!confirm('この部屋を公開しますか？\nランキング・フレンドから見られるようになります。')) return;
            equippedMyroom = JSON.parse(JSON.stringify(previewMyroom)); // 公開時点の内容を、決定扱いにもしておく
            saveGame();
            if (window.submitMyroomData) {
                window.submitMyroomData(equippedMyroom);
                alert('🌐 部屋を公開しました！');
            }
        }

        function openWarehouse() {
            let boughtCount = 0;
            stages.forEach((s, idx) => { if((purchasedItems[idx] || 0) > 0) boughtCount++; });
            const badge = document.getElementById('warehouse-omiyage-badge');
            if (badge) badge.textContent = `${boughtCount}/${stages.length}`;
            renderWarehouseItems();
            openModal('warehouse-modal');
            playBgmLoop('audio/bgm/bgm_warehouse.mp3'); // ものおき専用BGMに切り替え
        }

        // 🎫 ガチャで手に入れたチケットの一覧。個数を確認しながら、好きなタイミングで使える
        function openTicketInventory() {
            const list = document.getElementById('ticket-inventory-list');
            list.innerHTML = '';
            NORMAL_CONSUMABLE_ITEMS.forEach(item => {
                const count = ticketInventory[item.id] || 0;
                const row = document.createElement('div');
                row.className = 'list-item';
                row.innerHTML = `<div class="item-info-row"><img class="item-thumb" src="${item.img}" alt="${item.name}"><div class="item-info"><span class="item-title">🎫 ${item.name}　<span style="color:#ff9800; font-weight:900;">×${count}</span></span><span class="item-desc">${item.desc}</span></div></div><button class="item-action-btn btn-shop" ${count > 0 ? '' : 'disabled'} onclick="useTicket('${item.id}')" style="background:#4caf50; color:white;">使う</button>`;
                list.appendChild(row);
            });
            SPRAY_ITEMS.forEach(item => {
                const count = sprayInventory[item.id] || 0;
                const isActive = activeSprayId === item.id && Date.now() < sprayBuffActiveUntil;
                const emoji = item.effectId === 'sparkle' ? '✨' : '🌟';
                const row = document.createElement('div');
                row.className = "list-item";
                let btnHtml;
                if (isActive) {
                    const hoursLeft = Math.ceil((sprayBuffActiveUntil - Date.now()) / 3600000);
                    btnHtml = `<button class="item-action-btn" disabled style="background:#bbb; color:#fff;">効果中(残り${hoursLeft}h)</button>`;
                } else {
                    btnHtml = `<button class="item-action-btn btn-shop" ${count > 0 ? '' : 'disabled'} onclick="useSpray('${item.id}')" style="background:#e91e63; color:white;">使う</button>`;
                }
                row.innerHTML = `<div class="item-info-row"><div class="item-thumb" style="display:flex; align-items:center; justify-content:center; font-size:1.6rem;">${emoji}</div><div class="item-info"><span class="item-title">✨ ${item.name}　<span style="color:#ff9800; font-weight:900;">×${count}</span></span><span class="item-desc">${item.desc}</span></div></div>${btnHtml}`;
                list.appendChild(row);
            });
            openModal('ticket-inventory-modal');
        }
        // ✨ スプレーを使う：1日だけ自動増加バフ＋見た目エフェクトが有効になる
        function useSpray(itemId) {
            if ((sprayInventory[itemId] || 0) <= 0) return;
            sprayInventory[itemId]--;
            activeSprayId = itemId;
            sprayBuffActiveUntil = Date.now() + 24 * 60 * 60 * 1000;
            saveGame(); updateDisplay(); updateSprayEffectDisplay();
            openTicketInventory(); // 一覧を開いている場合、表示を更新する
        }

        // ===================================================================
        // 👗 着せ替え部屋
        // ===================================================================
        function openKisekaeRoom() {
            openModal('kisekae-room-modal'); // タップ音のみでOK、フェード・移動音は不要
            previewKisekae = { ...equippedKisekae }; // 確定済みの状態から、試着用のコピーを作る
            renderKisekaeMochisuke();
            openKisekaeCategory('clothes');
        }
        function closeKisekaeRoom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('kisekae-room-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }

        // 着せ替え部屋のもちすけと、通常のタップ画面のもちすけ、両方に今の装着状態を反映する
        function renderKisekaeMochisuke() {
            const roomClothes = document.getElementById('kisekae-mochisuke-clothes');
            const roomFullbody = document.getElementById('kisekae-mochisuke-fullbody');
            const fullbodyId = previewKisekae.fullbody;

            if (fullbodyId) {
                // 全身装備中は、帽子・顔パーツを隠し、服は visibility:hidden で完全に見えなくする
                // （display:noneだと箱の高さの土台が無くなり全身画像も消えてしまうため、レイアウトのスペースだけ残す）
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                roomFullbody.src = fbItem.img;
                roomFullbody.style.display = 'block';
                roomClothes.style.opacity = '0';
                ['hat', 'face'].forEach(cat => { document.getElementById(`kisekae-mochisuke-${cat}`).style.display = 'none'; });
            } else {
                roomFullbody.style.display = 'none';
                roomClothes.style.opacity = '1';
                const clothesItem = KISEKAE_ITEMS.clothes.find(i => i.id === previewKisekae.clothes) || KISEKAE_ITEMS.clothes[0];
                roomClothes.src = clothesItem.img;

                ['hat', 'face'].forEach(cat => {
                    const roomImg = document.getElementById(`kisekae-mochisuke-${cat}`);
                    if (!roomImg) return;
                    const itemId = previewKisekae[cat];
                    if (itemId) {
                        const item = KISEKAE_ITEMS[cat].find(i => i.id === itemId);
                        roomImg.src = item.img;
                        roomImg.style.display = 'block';
                        roomImg.style.top = item.top + '%';
                        roomImg.style.left = item.left + '%';
                        roomImg.style.width = item.width + '%';
                        roomImg.style.height = item.height + '%';
                        roomImg.style.transform = `rotate(${item.rotation || 0}deg)`;
                        roomImg.style.zIndex = '6'; // 帽子・顔パーツは、常にもちすけの手前
                    } else {
                        roomImg.style.display = 'none';
                    }
                });
            }
            updateKisekaeWingDisplay('room', fullbodyId ? null : previewKisekae.back);
            // 🎯「決定」を押すまでは試着中なので、ここではタップ画面には反映しない（applyKisekaeToMainScreenはconfirmKisekaeOutfitからだけ呼ぶ）
        }

        // 🕊️ 背中(翼)の表示・羽ばたきアニメーションループ。target: 'room'（着せ替え部屋）か 'main'（タップ画面）
        let wingFlapTimers = { room: null, main: null };
        let wingFlapFrameIndex = { room: 0, main: 0 };
        let WING_FLAP_INTERVAL_MS = 130; // 8コマ ×130ms ≒ 1040msで1周（実機調整パネルから変更できる）
        // 🚧 速度が確定したので、いったんパネルを非表示にしている。また使う時は true に戻すだけでOK
        const WING_SPEED_TOOL_ENABLED = false;
        let WING_FLAP_VOLUME = 0.1; // 羽ばたき音の音量（0〜1）。実機調整パネルから変更できる
        // 🚧 音量が確定したので、いったんパネルを非表示にしている。また使う時は true に戻すだけでOK
        const WING_VOLUME_TOOL_ENABLED = false;
        function adjustWingFlapVolume(delta) {
            WING_FLAP_VOLUME = Math.max(0, Math.min(1, Math.round((WING_FLAP_VOLUME + delta) * 10) / 10));
            document.getElementById('wing-flap-volume-readout').textContent = WING_FLAP_VOLUME.toFixed(1);
            playAudioFile('audio/kisekae/wing_flap.mp3', WING_FLAP_VOLUME); // 押した音量でその場で試し鳴らしする
        }
        function copyWingFlapVolume() {
            const text = `羽ばたき音量: ${WING_FLAP_VOLUME}`;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
            alert(`コピーしました\n${text}`);
        }
        // タップ画面('main')・着せ替え部屋('room')・マイルーム('myroom')、それぞれの要素IDプレフィックスを解決する
        function kisekaeElPrefix(target) {
            if (target === 'room') return 'kisekae-mochisuke';
            if (target === 'myroom') return 'myroom-mochisuke';
            return 'mochisuke';
        }
        function updateKisekaeWingDisplay(target, backId) {
            const leftEl = document.getElementById(kisekaeElPrefix(target) + '-wing-left');
            const rightEl = document.getElementById(kisekaeElPrefix(target) + '-wing-right');
            if (!leftEl || !rightEl) return;
            if (backId) {
                const item = KISEKAE_ITEMS.back.find(i => i.id === backId);
                if (!item) { leftEl.style.display = 'none'; rightEl.style.display = 'none'; stopWingFlapLoop(target); return; }
                leftEl.style.display = 'block'; rightEl.style.display = 'block';
                leftEl.style.zIndex = '1'; rightEl.style.zIndex = '1'; // 調整モードで一時的に上げたz-indexを、通常表示時は必ず背面に戻す
                leftEl.style.width = item.width + '%'; leftEl.style.height = item.height + '%';
                rightEl.style.width = item.width + '%'; rightEl.style.height = item.height + '%';
                startWingFlapLoop(target, item);
            } else {
                leftEl.style.display = 'none'; rightEl.style.display = 'none';
                stopWingFlapLoop(target);
            }
        }
        function applyWingFrame(leftEl, rightEl, item, frameIdx) {
            leftEl.src = item.leftFrames[frameIdx];
            rightEl.src = item.rightFrames[frameIdx];
            const lp = item.leftFramePos[frameIdx], rp = item.rightFramePos[frameIdx];
            leftEl.style.top = lp.top + '%'; leftEl.style.left = lp.left + '%';
            rightEl.style.top = rp.top + '%'; rightEl.style.left = rp.left + '%';
        }
        // 🐹 もちすけが実際に見えている画面（タップ画面 or 着せ替え部屋）かどうかを判定する
        function isMochisukeVisible() {
            const kisekaeModal = document.getElementById('kisekae-room-modal');
            const isKisekaeOpen = kisekaeModal && kisekaeModal.style.display === 'flex';
            const isAnyModalOpen = document.body.classList.contains('modal-open');
            return isKisekaeOpen || !isAnyModalOpen;
        }
        function startWingFlapLoop(target, item) {
            stopWingFlapLoop(target);
            wingFlapFrameIndex[target] = 0;
            const leftEl = document.getElementById(kisekaeElPrefix(target) + '-wing-left');
            const rightEl = document.getElementById(kisekaeElPrefix(target) + '-wing-right');
            applyWingFrame(leftEl, rightEl, item, 0); // 最初のフレームを即座に反映
            wingFlapTimers[target] = setInterval(() => {
                wingFlapFrameIndex[target] = (wingFlapFrameIndex[target] + 1) % item.leftFrames.length;
                applyWingFrame(leftEl, rightEl, item, wingFlapFrameIndex[target]);
                if (wingFlapFrameIndex[target] === 0 && isMochisukeVisible()) playAudioFile('audio/kisekae/wing_flap.mp3', WING_FLAP_VOLUME); // 1周ごとに、動きに合わせて羽ばたき音を鳴らす（見えている画面の時だけ）
            }, WING_FLAP_INTERVAL_MS);
        }
        function stopWingFlapLoop(target) {
            if (wingFlapTimers[target]) clearInterval(wingFlapTimers[target]);
            wingFlapTimers[target] = null;
        }

        // 🚧 通常のタップ画面にも反映する。服については、既存の「衣装（きせかえタブ）」システムと
        // 見た目の適用先が重なるため、しばらくは「後から呼ばれた方が勝つ」形で共存させている
        // 🎩💨 叫んだ勢いで、帽子・顔パーツが吹っ飛んでいく（服だけは1枚絵の都合で諦めて、初期衣装に戻る）
        function flyOffKisekaeOverlays() {
            const dirs = { hat: { x: -70, y: -160, r: -150 }, face: { x: 80, y: -130, r: 170 } };
            ['hat', 'face'].forEach(cat => {
                const el = document.getElementById(`mochisuke-kisekae-${cat}`);
                if (!el || el.style.display === 'none') return;
                const d = dirs[cat];
                el.animate([
                    { transform: el.style.transform || 'none', opacity: 1, offset: 0 },
                    { transform: `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg)`, opacity: 0, offset: 1 },
                ], { duration: 950, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)', fill: 'forwards' });
            });
        }
        // 通常に戻ったら、飛んでいった帽子・顔パーツを、ふわっと元の位置に着け直す
        function flyBackKisekaeOverlays() {
            const dirs = { hat: { x: -70, y: -160, r: -150 }, face: { x: 80, y: -130, r: 170 } };
            ['hat', 'face'].forEach(cat => {
                const el = document.getElementById(`mochisuke-kisekae-${cat}`);
                if (!el || el.style.display === 'none') return;
                const d = dirs[cat];
                const itemId = equippedKisekae[cat];
                const item = itemId ? KISEKAE_ITEMS[cat].find(i => i.id === itemId) : null;
                const restTransform = item ? `rotate(${item.rotation || 0}deg)` : 'none';
                el.animate([
                    { transform: `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg)`, opacity: 0, offset: 0 },
                    { transform: restTransform, opacity: 1, offset: 1 },
                ], { duration: 750, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)', fill: 'forwards' });
            });
        }

        function applyKisekaeToMainScreen() {
            const mainBtn = document.getElementById('mochisuke-btn');
            const mainFullbody = document.getElementById('mochisuke-fullbody');
            const mouthAnchor = document.getElementById('mochisuke-mouth-anchor');
            const fullbodyId = equippedKisekae.fullbody;

            if (fullbodyId) {
                // 全身装備中は、帽子・顔パーツ・通常の口パーツを隠し、もちすけ本体は visibility:hidden で完全に見えなくする
                // （display:noneだと箱のサイズの土台が無くなり全身画像も消えてしまうため、レイアウトのスペースだけ残す）
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                mainFullbody.src = fbItem.img;
                mainFullbody.style.display = 'block';
                mainBtn.style.opacity = '0';
                if (mouthAnchor) mouthAnchor.style.display = 'none';
                ['hat', 'face'].forEach(cat => { document.getElementById(`mochisuke-kisekae-${cat}`).style.display = 'none'; });
            } else {
                mainFullbody.style.display = 'none';
                mainBtn.style.opacity = '1';
                if (mouthAnchor) mouthAnchor.style.display = 'block';
                const clothesItem = KISEKAE_ITEMS.clothes.find(i => i.id === equippedKisekae.clothes) || KISEKAE_ITEMS.clothes[0];
                mainBtn.src = clothesItem.img;

                // 🐛服のイラストによって、口の位置が微妙にずれるものがあるため、服ごとの指定（無ければ既定値）を反映する
                if (mouthAnchor) {
                    const mouthPos = clothesItem.mouthOverride || DEFAULT_MOUTH_POSITION;
                    mouthAnchor.style.top = mouthPos.top + '%';
                    mouthAnchor.style.left = mouthPos.left + '%';
                    mouthAnchor.style.width = mouthPos.width + '%';
                }

                ['hat', 'face'].forEach(cat => {
                    const mainImg = document.getElementById(`mochisuke-kisekae-${cat}`);
                    if (!mainImg) return;
                    const itemId = equippedKisekae[cat];
                    if (itemId) {
                        const item = KISEKAE_ITEMS[cat].find(i => i.id === itemId);
                        mainImg.src = item.img;
                        mainImg.style.display = 'block';
                        mainImg.style.top = item.top + '%';
                        mainImg.style.left = item.left + '%';
                        mainImg.style.width = item.width + '%';
                        mainImg.style.height = item.height + '%';
                        mainImg.style.transform = `rotate(${item.rotation || 0}deg)`;
                        if (cat === 'hat') mainImg.style.zIndex = '7'; // 帽子は、常にもちすけの手前
                    } else {
                        mainImg.style.display = 'none';
                    }
                });
            }
            updateKisekaeWingDisplay('main', fullbodyId ? null : equippedKisekae.back);
        }
        // 🛋️ マイルームのもちすけにも、装備中の着せ替えを反映する
        function applyKisekaeToMyroom() {
            const breatheWrap = document.getElementById('myroom-mochisuke-breathe-wrap');
            if (breatheWrap) breatheWrap.style.width = MYROOM_MOCHISUKE_SIZE.width + '%';
            const clothesEl = document.getElementById('myroom-mochisuke-clothes');
            const fullbodyEl = document.getElementById('myroom-mochisuke-fullbody');
            const mouthAnchor = document.getElementById('myroom-mochisuke-mouth-anchor');
            const fullbodyId = equippedKisekae.fullbody;

            if (fullbodyId) {
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                fullbodyEl.src = fbItem.img;
                fullbodyEl.style.display = 'block';
                clothesEl.style.opacity = '0'; // display:noneだと土台が潰れるため、opacityで見た目だけ消す
                if (mouthAnchor) mouthAnchor.style.display = 'none';
                ['hat', 'face'].forEach(cat => { document.getElementById(`myroom-mochisuke-${cat}`).style.display = 'none'; });
            } else {
                fullbodyEl.style.display = 'none';
                clothesEl.style.opacity = '1';
                if (mouthAnchor) mouthAnchor.style.display = 'block';
                const clothesItem = KISEKAE_ITEMS.clothes.find(i => i.id === equippedKisekae.clothes) || KISEKAE_ITEMS.clothes[0];
                clothesEl.src = clothesItem.img;

                if (mouthAnchor) {
                    const mouthPos = clothesItem.mouthOverride || DEFAULT_MOUTH_POSITION;
                    mouthAnchor.style.top = mouthPos.top + '%';
                    mouthAnchor.style.left = mouthPos.left + '%';
                    mouthAnchor.style.width = mouthPos.width + '%';
                }

                ['hat', 'face'].forEach(cat => {
                    const imgEl = document.getElementById(`myroom-mochisuke-${cat}`);
                    if (!imgEl) return;
                    const itemId = equippedKisekae[cat];
                    if (itemId) {
                        const item = KISEKAE_ITEMS[cat].find(i => i.id === itemId);
                        imgEl.src = item.img;
                        imgEl.style.display = 'block';
                        imgEl.style.top = item.top + '%';
                        imgEl.style.left = item.left + '%';
                        imgEl.style.width = item.width + '%';
                        imgEl.style.height = item.height + '%';
                        imgEl.style.transform = `rotate(${item.rotation || 0}deg)`;
                        if (cat === 'hat') imgEl.style.zIndex = '7';
                    } else {
                        imgEl.style.display = 'none';
                    }
                });
            }
            updateKisekaeWingDisplay('myroom', fullbodyId ? null : equippedKisekae.back);
        }

        let kisekaeCurrentCategory = 'clothes';
        // カテゴリを開いて、名前順・Zの字並びで左右にアイテムを並べる
        // 🛠️ 開発者用：翼の羽ばたき速度を実機で調整する（位置調整パネルとは独立して、常に使える）
        function adjustWingFlapSpeed(delta) {
            WING_FLAP_INTERVAL_MS = Math.max(20, WING_FLAP_INTERVAL_MS + delta);
            document.getElementById('wing-flap-speed-readout').textContent = WING_FLAP_INTERVAL_MS + 'ms';
            // 今表示中の翼があれば、新しい速度ですぐ再スタートして確認できるようにする
            const backId = previewKisekae.back;
            if (backId) {
                const item = KISEKAE_ITEMS.back.find(i => i.id === backId);
                if (item) startWingFlapLoop('room', item);
            }
        }
        function copyWingFlapSpeed() {
            const text = `羽ばたき速度: ${WING_FLAP_INTERVAL_MS}ms`;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
            alert(`コピーしました\n${text}`);
        }
        function openKisekaeCategory(cat) {
            playAudioFile('audio/skill_tap.mp3');
            if (cat !== 'back') clearWingGhostFrames(); // 背中カテゴリから離れる時は、翼のゴースト表示を片付ける
            const showWingSpeedPanel = WING_SPEED_TOOL_ENABLED && IS_DEV_MODE && cat === 'back';
            document.getElementById('kisekae-wing-speed-panel').style.display = showWingSpeedPanel ? 'block' : 'none';
            if (showWingSpeedPanel) document.getElementById('wing-flap-speed-readout').textContent = WING_FLAP_INTERVAL_MS + 'ms';
            const showWingVolumePanel = WING_VOLUME_TOOL_ENABLED && IS_DEV_MODE && cat === 'back';
            document.getElementById('kisekae-wing-volume-panel').style.display = showWingVolumePanel ? 'block' : 'none';
            if (showWingVolumePanel) document.getElementById('wing-flap-volume-readout').textContent = WING_FLAP_VOLUME.toFixed(1);
            kisekaeCurrentCategory = cat;
            const sortedItems = [...KISEKAE_ITEMS[cat]].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            // 帽子・顔パーツは、一番左上に「外す」ボタンを置く（服は必ず何か着ている状態にするので対象外）
            const items = (cat === 'clothes') ? sortedItems : [{ id: null, name: '外す', isRemoveButton: true }, ...sortedItems];
            const owned = ownedKisekaeItems[cat] || [];

            const leftList = document.getElementById('kisekae-item-list-left');
            const rightList = document.getElementById('kisekae-item-list-right');
            leftList.innerHTML = ''; rightList.innerHTML = '';

            items.forEach((item, i) => {
                const cell = document.createElement('div');
                if (item.isRemoveButton) {
                    const isEquipped = previewKisekae[cat] == null;
                    cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); cursor:pointer;`;
                    cell.innerHTML = `<div style="font-size:1.8rem; color:#e57373; font-weight:900;">✕</div>`;
                    cell.onclick = () => equipKisekaeItem(cat, null);
                    (i % 2 === 0 ? leftList : rightList).appendChild(cell);
                    return;
                }
                const isOwned = owned.includes(item.id);
                const isEquipped = previewKisekae[cat] === item.id;
                cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); ${isOwned ? 'cursor:pointer;' : ''}`;
                const starStyle = item.star === 4
                    ? 'background:linear-gradient(90deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9d4edd); -webkit-background-clip:text; background-clip:text; color:transparent;'
                    : 'color:#ffb300;';
                const starHtml = item.star ? `<div style="position:absolute; bottom:2px; left:0; right:0; text-align:center; font-size:0.62rem; letter-spacing:1px; text-shadow:0 1px 2px rgba(0,0,0,0.15); ${starStyle}">${'⭐'.repeat(item.star)}</div>` : '';
                const thumbImg = item.img || (item.leftFrames ? item.leftFrames[0] : '');
                cell.innerHTML = `<img src="${thumbImg}" alt="${item.name}" style="width:78%; height:78%; object-fit:contain; ${isOwned ? '' : 'filter:grayscale(1); opacity:0.5;'}">${starHtml}`;
                if (!isOwned) {
                    cell.insertAdjacentHTML('beforeend', `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🔒</div>`);
                    cell.style.cursor = 'pointer';
                    cell.onclick = () => alert(`🔒 ${item.name}\n\nショップの「ガチャ」で手に入るよ！`);
                } else {
                    cell.onclick = () => equipKisekaeItem(cat, item.id);
                }
                (i % 2 === 0 ? leftList : rightList).appendChild(cell);
            });

            ['hat', 'face', 'clothes', 'back', 'fullbody'].forEach(c => {
                document.getElementById(`kisekae-cat-btn-${c}`).style.boxShadow = (c === cat) ? '0 0 0 3px #ffd700, 0 3px 8px rgba(0,0,0,0.25)' : '0 3px 8px rgba(0,0,0,0.25)';
            });

            if (IS_DEV_MODE) renderKisekaeAdjustPanel(cat);
        }

        let kisekaeNameLabelTimeout = null;
        function showKisekaeItemNameLabel(name) {
            const label = document.getElementById('kisekae-item-name-label');
            if (!label) return;
            clearTimeout(kisekaeNameLabelTimeout);
            label.textContent = name;
            label.style.display = 'block';
            kisekaeNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, 2200);
        }
        function equipKisekaeItem(cat, id) {
            if (cat === 'fullbody' && id) {
                // 全身を装着すると、帽子・顔パーツ・背中（翼）は自動的に外れる（服は保持したまま、全身解除時に元へ戻る）
                previewKisekae.hat = null;
                previewKisekae.face = null;
                previewKisekae.back = null;
            } else if ((cat === 'hat' || cat === 'face' || cat === 'back') && id && previewKisekae.fullbody) {
                // 全身装着中に帽子・顔パーツ・背中を選んだら、全身を自動的に外す
                previewKisekae.fullbody = null;
            }
            previewKisekae[cat] = id; // 「決定」を押すまでは、試着中の状態を更新するだけ
            renderKisekaeMochisuke();
            openKisekaeCategory(cat);
            const item = id ? KISEKAE_ITEMS[cat].find(i => i.id === id) : null;
            showKisekaeItemNameLabel(item ? item.name : '外す');
        }

        // 🎯「決定」ボタン：試着中の服装を、実際に確定して保存・タップ画面にも反映する
        function confirmKisekaeOutfit() {
            equippedKisekae = { ...previewKisekae };
            saveGame();
            applyKisekaeToMainScreen();
            const btn = document.getElementById('kisekae-confirm-btn');
            if (btn) {
                const original = btn.innerText;
                btn.innerText = '✅ 決定しました！';
                setTimeout(() => { btn.innerText = original; }, 1200);
            }
        }

        // 🛠️ 開発者用：帽子・顔パーツ・背中(翼)の位置・大きさ調整ツール（服・全身はフルボディ画像なので調整不要）
        let kisekaeAdjustMode = false;
        let kisekaeAdjustDragState = null;
        // 選択中の対象を解決する：通常のhat/faceか、backカテゴリの左右どちらの翼か
        function resolveKisekaeAdjustTarget() {
            const val = document.getElementById('kisekae-adjust-target').value;
            if (kisekaeCurrentCategory === 'back') {
                const [itemId, frameIdxStr] = val.split('__');
                const frameIdx = parseInt(frameIdxStr, 10);
                const item = KISEKAE_ITEMS.back.find(i => i.id === itemId);
                return {
                    item, side: 'left', frameIdx, // 左翼を操作対象にする。右翼は自動でミラー追従する
                    imgSrc: item ? item.leftFrames[frameIdx] : '',
                    el: document.getElementById('kisekae-mochisuke-wing-left'),
                };
            }
            const item = KISEKAE_ITEMS[kisekaeCurrentCategory].find(i => i.id === val);
            return {
                item, side: null, frameIdx: null,
                imgSrc: item ? item.img : '',
                el: document.getElementById(`kisekae-mochisuke-${kisekaeCurrentCategory}`),
            };
        }
        // 🔄 左翼の位置・大きさに合わせて、右翼を左右対称にミラーして自動追従させる
        function syncMirroredRightWing(resolved, posObj, sizeObj) {
            if (kisekaeCurrentCategory !== 'back' || resolved.side !== 'left') return;
            const rightPos = resolved.item.rightFramePos[resolved.frameIdx];
            rightPos.top = posObj.top;
            rightPos.left = 100 - posObj.left - sizeObj.width;
            const rightEl = document.getElementById('kisekae-mochisuke-wing-right');
            rightEl.src = resolved.item.rightFrames[resolved.frameIdx];
            rightEl.style.display = 'block';
            rightEl.style.top = rightPos.top + '%'; rightEl.style.left = rightPos.left + '%';
            rightEl.style.width = sizeObj.width + '%'; rightEl.style.height = sizeObj.height + '%';
            rightEl.style.zIndex = '50';
        }
        // 位置(top/left)の読み書き先と、大きさ(width/height)の読み書き先を返す。
        // backカテゴリだけ「位置はフレーム別・大きさは共通」なので、書き込み先オブジェクトが分かれる
        function getKisekaeAdjustRefs(resolved) {
            if (resolved.side) {
                const posArr = resolved.item[resolved.side + 'FramePos'];
                return { posObj: posArr[resolved.frameIdx], sizeObj: resolved.item };
            }
            return { posObj: resolved.item, sizeObj: resolved.item };
        }
        function getKisekaeAdjustTargetEl() {
            return resolveKisekaeAdjustTarget().el;
        }
        // 🚧 座標が一通り確定したので、いったんパネルを非表示にしている。また使う時は true に戻すだけでOK
        const KISEKAE_ADJUST_TOOL_ENABLED = false;
        function renderKisekaeAdjustPanel(cat) {
            const panel = document.getElementById('kisekae-adjust-panel');
            if (!KISEKAE_ADJUST_TOOL_ENABLED) { panel.style.display = 'none'; return; }
            if (cat === 'clothes' || cat === 'fullbody') { panel.style.display = 'none'; return; } // 服・全身は調整不要
            const select = document.getElementById('kisekae-adjust-target');
            if (cat === 'back') {
                const adjustableItems = KISEKAE_ITEMS.back.filter(i => i.locked);
                if (adjustableItems.length === 0) { panel.style.display = 'none'; return; }
                panel.style.display = 'block';
                const opts = [];
                adjustableItems.forEach(i => {
                    for (let f = 0; f < i.leftFrames.length; f++) opts.push(`<option value="${i.id}__${f}">${i.name}（${f + 1}枚目・左右同時）</option>`);
                });
                select.innerHTML = opts.join('');
                document.getElementById('kisekae-rotation-controls').style.display = 'none';
                updateKisekaeAdjustReadout();
                return;
            }
            const adjustableItems = KISEKAE_ITEMS[cat].filter(i => i.locked);
            if (adjustableItems.length === 0) { panel.style.display = 'none'; return; }
            panel.style.display = 'block';
            select.innerHTML = adjustableItems.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
            document.getElementById('kisekae-rotation-controls').style.display = (cat === 'face') ? 'block' : 'none';
            updateKisekaeAdjustReadout();
        }
        // 👻 翼調整中、今選んでいる1枚以外の7枚を半透明で表示し、全体の流れが見えるようにする
        function renderWingGhostFrames(item, activeFrameIdx) {
            clearWingGhostFrames();
            const stage = document.getElementById('kisekae-mochisuke-wrap');
            for (let f = 0; f < item.leftFrames.length; f++) {
                if (f === activeFrameIdx) continue; // 選択中の1枚は、既存のwing-left/wing-right要素で表示するのでゴースト不要
                [['left', item.leftFrames, item.leftFramePos], ['right', item.rightFrames, item.rightFramePos]].forEach(([side, frames, posArr]) => {
                    const pos = posArr[f];
                    const ghost = document.createElement('img');
                    ghost.className = 'wing-ghost-frame';
                    ghost.src = frames[f];
                    ghost.style.cssText = `position:absolute; top:${pos.top}%; left:${pos.left}%; width:${item.width}%; height:${item.height}%; opacity:0.3; pointer-events:none; z-index:49;`;
                    stage.appendChild(ghost);
                });
            }
        }
        function clearWingGhostFrames() {
            document.querySelectorAll('.wing-ghost-frame').forEach(el => el.remove());
        }
        function toggleKisekaeAdjustMode() {
            kisekaeAdjustMode = !kisekaeAdjustMode;
            const btn = document.getElementById('kisekae-adjust-toggle-btn');
            const resolved = resolveKisekaeAdjustTarget();
            const target = resolved.el;
            if (kisekaeAdjustMode) {
                stopWingFlapLoop('room'); // 🐛修正：翼が動いたままだと調整できないので、調整中は静止させる
                target.style.display = 'block'; // プレビューが無い状態でも調整できるよう、選択中のIDの画像を仮表示する
                if (resolved.item) {
                    const { posObj, sizeObj } = getKisekaeAdjustRefs(resolved);
                    target.src = resolved.imgSrc;
                    target.style.top = posObj.top + '%'; target.style.left = posObj.left + '%';
                    target.style.width = sizeObj.width + '%'; target.style.height = sizeObj.height + '%';
                    target.style.transform = `rotate(${posObj.rotation || 0}deg)`;
                    syncMirroredRightWing(resolved, posObj, sizeObj);
                }
                target.style.outline = '2px dashed #e91e63';
                target.style.zIndex = '50'; // 🐛修正：翼は普段もちすけより背面のため、調整モード中は一時的に最前面へ（操作できるように）
                if (resolved.item && kisekaeCurrentCategory === 'back') renderWingGhostFrames(resolved.item, resolved.frameIdx);
                btn.style.background = '#4caf50';
                setupKisekaeAdjustDrag();
                positionKisekaeHandles();
            } else {
                target.style.outline = '';
                ['kisekae-resize-handle-r', 'kisekae-resize-handle-b', 'kisekae-resize-handle-br'].forEach(id => document.getElementById(id).style.display = 'none');
                btn.style.background = '#e91e63';
                clearWingGhostFrames();
                renderKisekaeMochisuke(); // 実際に装着中のものへ表示を戻す
            }
        }
        function onKisekaeAdjustTargetChange() {
            ['hat', 'face', 'clothes', 'fullbody'].forEach(c => { const el = document.getElementById(`kisekae-mochisuke-${c}`); if (el) el.style.outline = ''; });
            document.getElementById('kisekae-mochisuke-wing-left').style.outline = '';
            document.getElementById('kisekae-mochisuke-wing-right').style.outline = '';
            if (!kisekaeAdjustMode) { updateKisekaeAdjustReadout(); return; }
            stopWingFlapLoop('room');
            const resolved = resolveKisekaeAdjustTarget();
            const target = resolved.el;
            if (resolved.item) {
                const { posObj, sizeObj } = getKisekaeAdjustRefs(resolved);
                target.src = resolved.imgSrc;
                target.style.top = posObj.top + '%'; target.style.left = posObj.left + '%';
                target.style.width = sizeObj.width + '%'; target.style.height = sizeObj.height + '%';
                target.style.transform = `rotate(${posObj.rotation || 0}deg)`;
                syncMirroredRightWing(resolved, posObj, sizeObj);
                if (kisekaeCurrentCategory === 'back') renderWingGhostFrames(resolved.item, resolved.frameIdx);
            }
            target.style.outline = '2px dashed #e91e63';
            target.style.zIndex = '50';
            positionKisekaeHandles();
            updateKisekaeAdjustReadout();
        }
        function positionKisekaeHandles() {
            if (!kisekaeAdjustMode) return;
            const stage = document.getElementById('kisekae-stage');
            const target = getKisekaeAdjustTargetEl();
            const stageRect = stage.getBoundingClientRect();
            const tRect = target.getBoundingClientRect();
            const rightPct = ((tRect.right - stageRect.left) / stageRect.width) * 100;
            const bottomPct = ((tRect.bottom - stageRect.top) / stageRect.height) * 100;
            const midYPct = ((tRect.top + tRect.height / 2 - stageRect.top) / stageRect.height) * 100;
            const midXPct = ((tRect.left + tRect.width / 2 - stageRect.left) / stageRect.width) * 100;
            const hR = document.getElementById('kisekae-resize-handle-r'), hB = document.getElementById('kisekae-resize-handle-b'), hBr = document.getElementById('kisekae-resize-handle-br');
            [hR, hB, hBr].forEach(h => h.style.display = 'block');
            hR.style.left = rightPct + '%'; hR.style.top = midYPct + '%';
            hB.style.left = midXPct + '%'; hB.style.top = bottomPct + '%';
            hBr.style.left = rightPct + '%'; hBr.style.top = bottomPct + '%';
        }
        function setupKisekaeAdjustDrag() {
            const stage = document.getElementById('kisekae-stage');
            if (stage.dataset.dragSetup) return;
            stage.dataset.dragSetup = '1';
            const startDrag = (e, mode) => {
                if (!kisekaeAdjustMode) return;
                e.stopPropagation(); e.preventDefault();
                const target = getKisekaeAdjustTargetEl();
                try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
                kisekaeAdjustDragState = { startX: e.clientX, startY: e.clientY, target, mode };
            };
            stage.addEventListener('pointerdown', (e) => {
                if (!kisekaeAdjustMode) return;
                if (e.target.id === 'kisekae-resize-handle-r') return startDrag(e, 'width');
                if (e.target.id === 'kisekae-resize-handle-b') return startDrag(e, 'height');
                if (e.target.id === 'kisekae-resize-handle-br') return startDrag(e, 'both');
                const target = getKisekaeAdjustTargetEl();
                if (e.target !== target) return;
                startDrag(e, 'move');
            });
            stage.addEventListener('pointermove', (e) => {
                if (!kisekaeAdjustDragState || !kisekaeAdjustMode) return;
                e.stopPropagation();
                const refRect = document.getElementById('kisekae-mochisuke-wrap').getBoundingClientRect();
                const dxPct = ((e.clientX - kisekaeAdjustDragState.startX) / refRect.width) * 100;
                const dyPct = ((e.clientY - kisekaeAdjustDragState.startY) / refRect.height) * 100;
                const t = kisekaeAdjustDragState.target, mode = kisekaeAdjustDragState.mode;
                if (mode === 'move') {
                    t.style.top = (parseFloat(t.style.top) + dyPct) + '%';
                    t.style.left = (parseFloat(t.style.left) + dxPct) + '%';
                } else {
                    if (mode === 'width' || mode === 'both') t.style.width = Math.max(2, parseFloat(t.style.width) + dxPct) + '%';
                    if (mode === 'height' || mode === 'both') t.style.height = Math.max(2, parseFloat(t.style.height) + dyPct) + '%';
                }
                kisekaeAdjustDragState.startX = e.clientX; kisekaeAdjustDragState.startY = e.clientY;
                // ドラッグした内容を、元データにもその場で反映しておく（アイテムを切り替えても・コピーしても消えないように）
                const resolved = resolveKisekaeAdjustTarget();
                if (resolved.item) {
                    const { posObj, sizeObj } = getKisekaeAdjustRefs(resolved);
                    posObj.top = parseFloat(t.style.top);
                    posObj.left = parseFloat(t.style.left);
                    sizeObj.width = parseFloat(t.style.width);
                    sizeObj.height = parseFloat(t.style.height);
                    syncMirroredRightWing(resolved, posObj, sizeObj);
                }
                positionKisekaeHandles();
                updateKisekaeAdjustReadout();
            });
            stage.addEventListener('pointerup', () => {
                kisekaeAdjustDragState = null;
                if (kisekaeCurrentCategory === 'back') {
                    const resolved = resolveKisekaeAdjustTarget();
                    if (resolved.item) renderWingGhostFrames(resolved.item, resolved.frameIdx);
                }
            });
            stage.addEventListener('pointercancel', () => { kisekaeAdjustDragState = null; });
        }
        // 🔄 顔パーツだけ、回転（傾き）も調整できる
        function adjustKisekaeFaceRotation(delta) {
            const val = document.getElementById('kisekae-adjust-target').value;
            const item = KISEKAE_ITEMS.face.find(i => i.id === val);
            if (!item) return;
            item.rotation = (item.rotation || 0) + delta;
            const target = getKisekaeAdjustTargetEl();
            target.style.transform = `rotate(${item.rotation}deg)`;
            updateKisekaeAdjustReadout();
        }
        function updateKisekaeAdjustReadout() {
            const resolved = resolveKisekaeAdjustTarget();
            const target = resolved.el;
            const el = document.getElementById('kisekae-adjust-readout');
            if (!target || !el) return;
            let text = `top:${target.style.top}; left:${target.style.left}; width:${target.style.width}; height:${target.style.height};`;
            if (kisekaeCurrentCategory === 'face') {
                const item = resolved.item;
                text += `\n回転:${item ? (item.rotation || 0) : 0}deg;`;
            }
            el.textContent = text;
        }
        function copyAllKisekaeCoords() {
            const lines = [];
            ['hat', 'face'].forEach(cat => {
                const adjustable = KISEKAE_ITEMS[cat].filter(i => i.locked);
                if (adjustable.length === 0) return;
                lines.push(`【${KISEKAE_CATEGORY_LABELS[cat]}】`);
                adjustable.forEach(item => {
                    let line = `${item.name}(${item.id}): top:${item.top}%; left:${item.left}%; width:${item.width}%; height:${item.height}%;`;
                    if (cat === 'face') line += ` rotation:${item.rotation || 0}deg;`;
                    lines.push(line);
                });
            });
            const backAdjustable = KISEKAE_ITEMS.back.filter(i => i.locked);
            if (backAdjustable.length > 0) {
                lines.push(`【背中】`);
                backAdjustable.forEach(item => {
                    lines.push(`${item.name} 共通の大きさ: width:${item.width}%; height:${item.height}%;`);
                    item.leftFramePos.forEach((pos, i) => lines.push(`${item.name}（左・${i + 1}枚目）: top:${pos.top}%; left:${pos.left}%;`));
                    item.rightFramePos.forEach((pos, i) => lines.push(`${item.name}（右・${i + 1}枚目）: top:${pos.top}%; left:${pos.left}%;`));
                });
            }
            const text = lines.join('\n');
            const textarea = document.getElementById('kisekae-copy-all-textarea');
            textarea.value = text;
            textarea.style.display = 'block';
            textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        function openOmiyageCollection() {
            const grid = document.getElementById('omiyage-collection-grid');
            grid.innerHTML = '';
            const owned = stages.map((s, i) => ({ s, i, lv: purchasedItems[i] || 0 })).filter(o => o.lv > 0 && o.s.itemImg);
            if (owned.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#999; font-size:0.8rem; padding:20px;">まだ持っているおみやげがありません</div>`;
            } else {
                owned.forEach(({ s, i, lv }) => {
                    const cell = document.createElement('div');
                    cell.style.cssText = 'text-align:center; cursor:pointer; padding:6px; border-radius:10px; background:#fff8ec; border:1px solid #f0d5b5; box-sizing:border-box; min-width:0;';
                    cell.innerHTML = `<img src="${s.itemImg}" alt="${s.item}" style="width:100%; aspect-ratio:1; object-fit:contain;">
                        <div style="font-size:0.62rem; font-weight:bold; color:#5d4037; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.item}</div>
                        <div style="font-size:0.58rem; color:#ff9800;">×${lv}</div>`;
                    cell.onclick = () => showOmiyageFeedConfirm(i);
                    grid.appendChild(cell);
                });
            }
            openModal('omiyage-collection-modal');
        }

        function showOmiyageFeedConfirm(idx) {
            resetFeedCountIfNewDay();
            const stage = stages[idx];
            const lv = purchasedItems[idx] || 0;
            const remaining = FEED_DAILY_LIMIT - feedPlaysUsedToday;
            document.getElementById('feed-confirm-img').src = stage.itemImg;
            document.getElementById('feed-confirm-name').innerText = `${stage.item}（${lv}個持っている）`;
            const btn = document.getElementById('feed-confirm-btn');
            if (remaining <= 0) {
                document.getElementById('feed-confirm-desc').innerText = `${stage.name}のお土産。もちすけはお腹いっぱいみたい…本日はもうあげられません（明日また！）`;
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.onclick = null;
            } else {
                document.getElementById('feed-confirm-desc').innerText = `${stage.name}のお土産。もちすけにあげると喜んで食べてくれる。（本日あと${remaining}回）`;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.onclick = () => placeFeedIconNearMochisuke(idx);
            }
            closeModal('omiyage-collection-modal');
            openModal('omiyage-feed-confirm-modal');
        }

        // 🍴 もちすけにあげる：おみやげを自由にドラッグして、もちすけの上で離すと食べてくれる
        function feedMochisuke(idx) {
            const stage = stages[idx];
            if (!stage) return;

            clearTimeout(feedTeaseTimer);
            if (isScreamActive) revertScreamFace(); // 叫び中に給餌で中断された場合も、確実に元の姿へ戻す
            feedTeaseLevel = 0;

            feedBuffActiveUntil = Date.now() + FEED_BUFF_DURATION_MS;
            feedPlaysUsedToday++;
            trackMissionEvent('feedToday', 1);
            saveGame();
            startFeedBuffIndicator();

            const mochiRect = mochiBtnElement.getBoundingClientRect();
            playAudioFile('audio/mochisuke/mochi_eat.mp3');
            vibrate([20, 40, 20]);
            screenFlash('#ff9800', 0.3);
            screenShake('small');
            mochiBtnElement.animate([
                { transform: 'scale(1, 1) rotate(0deg)' },
                { transform: 'scale(1.25, 0.8) rotate(-4deg)', offset: 0.25 },
                { transform: 'scale(0.85, 1.2) rotate(4deg)', offset: 0.5 },
                { transform: 'scale(1.1, 0.92) rotate(-2deg)', offset: 0.75 },
                { transform: 'scale(1, 1) rotate(0deg)' }
            ], { duration: 500, easing: 'ease-in-out' });
            createFloatingText(mochiRect.left + mochiRect.width / 2, mochiRect.top + mochiRect.height / 3, `${stage.item}おいしい〜！`, "#ff9800", "1.1rem");
            setTimeout(() => {
                createFloatingText(mochiRect.left + mochiRect.width / 2, mochiRect.top + mochiRect.height / 2.2, `⚡タップ力2倍！`, "#e91e63", "1.3rem");
            }, 300);
            showMochiComment(pickRandom(dialogueData.feedComments).replace('○○', stage.item));
            for (let i = 0; i < 16; i++) {
                createParticle(mochiRect.left + mochiRect.width / 2 + (Math.random() - 0.5) * 90, mochiRect.top + mochiRect.height / 2 + (Math.random() - 0.5) * 90, true);
            }
        }

        // ⚡ タップ力2倍中のバフ表示を、残り秒数のカウントダウン付きで出す
        let mapZoom = 1;
        let mapPanX = 0, mapPanY = 0;
        let mapDragging = false, mapDragStartX = 0, mapDragStartY = 0, mapPanStartX = 0, mapPanStartY = 0;
        let mapPinchStartDist = 0, mapPinchStartZoom = 1;
        const MAP_ZOOM_MIN = 1, MAP_ZOOM_MAX = 4;

        function openMap() {
            lazyLoadImage('map-illustration-img');
            const pinsLayer = document.getElementById('map-pins-layer');
            pinsLayer.innerHTML = "";
            stages.forEach((stage, i) => {
                if (stage.pinX == null || stage.pinY == null) return; // 座標未設定の県は非表示（エラーにしない）
                const isCurrent = selectedStageIndex === i;
                const isLocked = i > currentStageIndex;
                const pin = document.createElement('div');
                pin.className = 'map-pin' + (isCurrent ? ' map-pin-current' : '') + (isLocked ? ' map-pin-locked' : '');
                pin.style.left = stage.pinX + '%';
                pin.style.top = stage.pinY + '%';
                // イラストに元々県名が書かれているので、ピンはアイコンのみ（文字ラベルは出さない）
                const icon = isLocked ? '❔' : (isCurrent ? '📍' : '🔸');
                pin.innerHTML = `<div class="map-pin-icon">${icon}</div>`;
                if (!isLocked) {
                    pin.addEventListener('click', (e) => { e.stopPropagation(); onMapPinTap(i); });
                }
                pinsLayer.appendChild(pin);
            });
            mapZoomReset();
            playAudioFile('audio/page_turn.mp3'); // 絵日記をめくる音を流用（ショップなどとは違う専用の音にする）
            openModal('map-modal', true);
        }

        function closeMapModal() {
            closeModal('map-modal');
        }

        function onMapPinTap(idx) {
            const stage = stages[idx];
            if (selectedStageIndex === idx) return; // すでに滞在中
            document.getElementById('map-confirm-text').innerText = `${stage.name}に移動しますか？`;
            const overlay = document.getElementById('map-confirm-overlay');
            overlay.style.display = 'flex';
            const yesBtn = document.getElementById('map-confirm-yes');
            const noBtn = document.getElementById('map-confirm-no');
            const cleanup = () => {
                overlay.style.display = 'none';
                yesBtn.onclick = null; noBtn.onclick = null;
            };
            yesBtn.onclick = () => { cleanup(); mapMoveTo(idx); };
            noBtn.onclick = () => { cleanup(); };
        }

        function mapMoveTo(idx) {
            closeModal('map-modal');
            triggerAreaTransition(stages[idx].bg, () => {
                selectedStageIndex = idx; updateDisplay(); saveGame();
                const name = stages[idx].name;
                const prefPool = dialogueData.prefectureComments[name];
                showMochiComment(prefPool ? `${name}到着！${pickRandom(prefPool)}` : `${name}到着！ここはどんな場所やろな？`);
            });
        }

        // --- 拡大縮小・ドラッグ操作 ---
        function applyMapTransform() {
            const canvas = document.getElementById('map-canvas');
            if (canvas) canvas.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
        }

        function clampMapPan() {
            const viewport = document.getElementById('map-viewport');
            const img = document.getElementById('map-illustration-img');
            if (!viewport || !img) return;
            const vw = viewport.clientWidth, vh = viewport.clientHeight;
            const cw = img.clientWidth * mapZoom, ch = img.clientHeight * mapZoom;
            const minX = Math.min(0, vw - cw), minY = Math.min(0, vh - ch);
            mapPanX = Math.max(minX, Math.min(0, mapPanX));
            mapPanY = Math.max(minY, Math.min(0, mapPanY));
        }

        // viewport要素基準のローカル座標（クライアント座標→viewport左上を原点とした座標）に変換
        function getMapFocalPoint(clientX, clientY) {
            const viewport = document.getElementById('map-viewport');
            const rect = viewport.getBoundingClientRect();
            return { x: clientX - rect.left, y: clientY - rect.top };
        }

        // (fx, fy)＝viewport基準の座標を中心に拡大縮小する（その地点の絵柄が画面上で動かないようにpanを調整）
        function zoomMapToward(newZoomRaw, fx, fy) {
            const newZoom = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, newZoomRaw));
            const localX = (fx - mapPanX) / mapZoom;
            const localY = (fy - mapPanY) / mapZoom;
            mapPanX = fx - localX * newZoom;
            mapPanY = fy - localY * newZoom;
            mapZoom = newZoom;
            clampMapPan();
            applyMapTransform();
        }

        // ＋／－ボタンは画面中央を基準に拡大縮小する
        function mapZoomBy(factor) {
            const viewport = document.getElementById('map-viewport');
            zoomMapToward(mapZoom * factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
        }

        function mapZoomReset() {
            mapZoom = 1; mapPanX = 0; mapPanY = 0;
            applyMapTransform();
        }

        function initMapInteractions() {
            const viewport = document.getElementById('map-viewport');
            if (!viewport || viewport.dataset.bound) return;
            viewport.dataset.bound = '1';

            viewport.addEventListener('pointerdown', (e) => {
                mapDragging = true;
                mapDragStartX = e.clientX; mapDragStartY = e.clientY;
                mapPanStartX = mapPanX; mapPanStartY = mapPanY;
            });
            viewport.addEventListener('pointermove', (e) => {
                if (!mapDragging) return;
                mapPanX = mapPanStartX + (e.clientX - mapDragStartX);
                mapPanY = mapPanStartY + (e.clientY - mapDragStartY);
                clampMapPan();
                applyMapTransform();
            });
            const endDrag = () => { mapDragging = false; };
            viewport.addEventListener('pointerup', endDrag);
            viewport.addEventListener('pointerleave', endDrag);
            viewport.addEventListener('pointercancel', endDrag);

            // ピンチズーム：指を置いた位置(2本指の中点)を中心に拡大縮小する
            let mapPinchFocalX = 0, mapPinchFocalY = 0;
            viewport.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    mapDragging = false;
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    mapPinchStartDist = Math.hypot(dx, dy);
                    mapPinchStartZoom = mapZoom;
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    const fp = getMapFocalPoint(midX, midY);
                    mapPinchFocalX = fp.x; mapPinchFocalY = fp.y;
                }
            }, { passive: true });
            viewport.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const dist = Math.hypot(dx, dy);
                    zoomMapToward(mapPinchStartZoom * (dist / mapPinchStartDist), mapPinchFocalX, mapPinchFocalY);
                }
            }, { passive: false });
        }

        function toggleStampDebug() {
            stampDebugMode = !stampDebugMode;
            if (stampDebugMode) {
                stampDebugInterval = setInterval(updateStampDebugReadout, 300);
                updateStampDebugReadout();
            } else {
                clearInterval(stampDebugInterval);
                document.getElementById('stamp-debug-readout').textContent = '';
            }
        }
        function updateStampDebugReadout() {
            const el = document.getElementById('stamp-debug-readout');
            if (!el) return;
            const stage = stages[currentStageIndex];
            const btn = document.getElementById('stamp-press-btn');
            el.textContent =
`currentStageIndex: ${currentStageIndex} (${stage ? stage.name : '?'})
selectedStageIndex: ${selectedStageIndex}
currentStageProgress: ${currentStageProgress}
distance(必要量): ${stage ? stage.distance : '?'}
判定(進捗>=必要量): ${stage ? (currentStageProgress >= stage.distance) : '?'}
stageArrivalTime経過: ${((Date.now() - stageArrivalTime) / 1000).toFixed(1)}秒
isPendingStampMoment: ${isPendingStampMoment}
diaryPageIndex: ${diaryPageIndex}
collectedStamps[現在]: ${!!collectedStamps[currentStageIndex]}
ボタンdisplay: ${btn ? btn.style.display : '?'}`;
        }

        let lastScoreFormatted = '';
        // もちの数表示を1文字ずつ<span>に分けて描画し、前回と値が違う文字だけポンっと弾ませる
        // （右詰めで比較するので、桁が増えて全体がズレても「実際に変わった桁」だけを正しく判定できる）
        function renderScoreDigits(container, newText, oldText) {
            // Array.from()でUnicodeのコードポイント単位に分割する。
            // 単純な文字列インデックス(newText[j])だと絵文字(🔥など)がサロゲートペアで
            // 2つに分断され、それぞれが壊れた文字(□□)として表示されてしまうため。
            const newChars = Array.from(newText);
            const oldChars = Array.from(oldText);
            const maxLen = Math.max(oldChars.length, newChars.length);
            const oldPadded = new Array(maxLen - oldChars.length).fill('\u0000').concat(oldChars);
            const newPadded = new Array(maxLen - newChars.length).fill('\u0000').concat(newChars);
            const offset = maxLen - newChars.length;
            let html = '';
            for (let j = 0; j < newChars.length; j++) {
                const ch = newChars[j] === ' ' ? '&nbsp;' : newChars[j];
                const changed = oldPadded[offset + j] !== newPadded[offset + j];
                html += changed ? `<span class="digit-pop">${ch}</span>` : `<span>${ch}</span>`;
            }
            container.innerHTML = html;
        }

        // 💡「次のおすすめアクション」判定：初心者が迷わないよう、状況に応じて1箇所だけハイライトする
        let lastRecommendCheckTime = 0;
        function getRecommendedActionTargetId() {
            // ① 今いる県のおみやげをまだ買っていない、かつ購入できる資金がある → ショップへ
            const stage = stages[selectedStageIndex];
            const curLv = purchasedItems[selectedStageIndex] || 0;
            if (curLv === 0 && stage && score >= getOmiyagePrice(stage, 0)) {
                return 'nav-btn-move';
            }
            // ② スキルを1つも取得していない、かつ一番安いスキルが買える資金がある → ショップへ
            const anySkillUnlocked = Object.values(skills).some(s => s.lv > 0);
            if (!anySkillUnlocked) {
                const cheapestUnlockPrice = Math.min(...Object.values(skills).map(s => s.unlockPrice || Infinity));
                if (score >= cheapestUnlockPrice) return 'nav-btn-move';
            }
            // ③ 使用可能（クールタイム明け）なスキルがある → そのスキルボタンへ
            const readyEntry = Object.entries(skills).find(([k, s]) => k !== 'hissatsu' && s.lv > 0 && s.currentCd <= 0 && s.activeTimer <= 0);
            if (readyEntry) return 'btn-' + readyEntry[0];
            // ④ 必殺技が使用可能 → 必殺技ボタンへ
            if (skills.hissatsu.lv > 0 && skills.hissatsu.currentCd <= 0 && skills.hissatsu.activeTimer <= 0) return 'btn-hissatsu';
            // ⑤ 新しく解放されて、まだ見ていない（遊んでいない）ミニゲームがある → ミニゲームへ
            if (hasNewlyUnlockedMinigame()) return 'nav-btn-move';
            // 特に無ければハイライトしない
            return null;
        }
        function updateRecommendedActionHighlight() {
            if (isTutorialActive) return; // チュートリアル中は、こちらの自動ハイライトは出さない（チュートリアル自身のハイライトとぶつかるため）
            const now = Date.now();
            if (now - lastRecommendCheckTime < 1000) return; // 連打のたびに毎回判定しなくていいよう、1秒に1回だけ再計算
            lastRecommendCheckTime = now;
            document.querySelectorAll('.recommended-glow').forEach(el => el.classList.remove('recommended-glow'));
            const targetId = getRecommendedActionTargetId();
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) el.classList.add('recommended-glow');
            }
        }

        // 新しく解放されて、まだ一度も遊んでいないミニゲームがあるか判定
        function hasNewlyPurchasableSkill() {
            return Object.values(skills).some(s => s.lv === 0 && currentStageIndex >= s.unlockStage && score >= s.unlockPrice);
        }
        // 未購入(lv===0)で、解放済み(訪問済み)かつ購入できるおみやげがあるか判定（レベルアップは対象外）
        function hasNewlyPurchasableOmiyage() {
            for (let i = 0; i <= currentStageIndex; i++) {
                const lv = purchasedItems[i] || 0;
                if (lv === 0 && score >= getOmiyagePrice(stages[i], 0)) return true;
            }
            return false;
        }
        // ✨ スプレーの見た目エフェクト（キラキラ・オーラ）を、バフの有無に応じて切り替える
        let sprayParticleTimer = null;
        function updateSprayEffectDisplay() {
            const isActive = Date.now() < sprayBuffActiveUntil && activeSprayId;
            const auraEl = document.getElementById('spray-aura-effect');
            if (!isActive) {
                if (auraEl) auraEl.style.display = 'none';
                clearInterval(sprayParticleTimer);
                sprayParticleTimer = null;
                return;
            }
            const item = SPRAY_ITEMS.find(i => i.id === activeSprayId);
            if (!item) return;
            if (auraEl) auraEl.style.display = (item.effectId === 'aura') ? 'block' : 'none';
            if (item.effectId === 'sparkle' && !sprayParticleTimer) {
                sprayParticleTimer = setInterval(spawnSparkleParticle, 700);
            } else if (item.effectId !== 'sparkle' && sprayParticleTimer) {
                clearInterval(sprayParticleTimer);
                sprayParticleTimer = null;
            }
        }
        function spawnSparkleParticle() {
            if (Date.now() >= sprayBuffActiveUntil) { updateSprayEffectDisplay(); return; }
            if (!isMochisukeVisible()) return; // 見えている画面の時だけ生成する
            const wrap = document.getElementById('mochisuke-deform-wrap');
            if (!wrap) return;
            const rect = wrap.getBoundingClientRect();
            const particle = document.createElement('div');
            particle.textContent = '✨';
            particle.style.cssText = `position:fixed; left:${rect.left + rect.width * Math.random()}px; top:${rect.top + rect.height * Math.random()}px; font-size:1.3rem; pointer-events:none; z-index:9999; animation: sprayParticleFloat 1.2s ease-out forwards;`;
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1300);
        }
        function updateDisplay() {
            updateRecommendedActionHighlight();
            const prestigeBtn = document.getElementById('main-prestige-btn');
            if (prestigeBtn) prestigeBtn.style.display = canPrestige() ? 'block' : 'none';
            updateSprayEffectDisplay(); // バフが切れていたら、ここで自動的にエフェクトも止まる
            const scoreFormatted = formatMochi(score) + " もち";
            const scoreEl = document.getElementById('score-text');
            const fullText = isFever ? `🔥 5倍中 (${feverTimeLeft}s) ${scoreFormatted}` : scoreFormatted;
            // もちの数が実際に増えた瞬間だけ、変化した桁だけがポンっと弾む演出を出す（伸びていく実感を強化）
            if (fullText !== lastScoreFormatted) {
                renderScoreDigits(scoreEl, fullText, lastScoreFormatted);
                lastScoreFormatted = fullText;
            }
            document.getElementById('current-location-text').innerText = stages[selectedStageIndex].name;
            document.getElementById('mps-display').innerText = `↗ 自動増加: ${formatMochi(getMps())} もち/秒`;
            
            // 【修正】関数を正しく実行し、カンマ区切りで表示
            document.getElementById('tap-power-display').innerText = `👆 タップ力: +${formatMochi(getTapPower())}`;

            const distText = document.getElementById('distance-text');
            const progressBar = document.getElementById('progress-bar');
            const journeyText = document.getElementById('journey-progress-text');
            const isFullyCleared = currentStageIndex === stages.length - 1 && currentStageProgress >= stages[currentStageIndex].distance;
            if (journeyText) journeyText.innerHTML = `${isFullyCleared ? stages.length : currentStageIndex}/${stages.length}県<br>制覇`;
            if (selectedStageIndex < currentStageIndex) { distText.innerText = "このエリアは踏破済みです"; progressBar.style.width = "100%"; }
            else if (isFullyCleared) { distText.innerText = "🎉 祝・日本縦断すべてのエリアを制覇完了！！"; progressBar.style.width = "100%"; }
            else {
                const remaining = Math.ceil(stages[currentStageIndex].distance - currentStageProgress);
                distText.innerText = `次のエリアまで : ${formatMochi(remaining)} もちkcal`;
                let pct = Math.max(0, Math.min(100, (currentStageProgress / stages[currentStageIndex].distance) * 100));
                progressBar.style.width = pct + "%";
            }
        }

        // ===================================================================
        // 🎮 ミニゲームセンター：共通ロジック
        // ===================================================================
        let currentRankingTab = 'score';

        function closeRanking() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('ranking-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function toggleRankingHelpOverlay() {
            const overlay = document.getElementById('ranking-help-overlay');
            if (overlay) overlay.style.display = (overlay.style.display === 'block') ? 'none' : 'block';
        }

        function switchRankingTab(tab) {
            currentRankingTab = tab;
            document.getElementById('rank-tab-score').classList.toggle('active', tab === 'score');
            document.getElementById('rank-tab-taps').classList.toggle('active', tab === 'taps');
            document.getElementById('rank-tab-prestige').classList.toggle('active', tab === 'prestige');
            document.getElementById('rank-tab-room').classList.toggle('active', tab === 'room');
            renderRankingList();
        }

        async function openRanking() {
            openModal('ranking-modal');
            await renderRankingList();
        }

        // 順位の見た目（1〜3位は特別扱い）
        function rankNumberStyle(rank) {
            if (rank === 1) return { bg: 'linear-gradient(135deg,#ffd700,#ffb300)', color: '#5d4037' };
            if (rank === 2) return { bg: 'linear-gradient(135deg,#e0e0e0,#b0bec5)', color: '#5d4037' };
            if (rank === 3) return { bg: 'linear-gradient(135deg,#d7a06e,#b5651d)', color: '#fff' };
            return { bg: '#fff', color: '#8d6e63' };
        }
        // そのプレイヤーの装着中の服・帽子・顔パーツを、小さいもちすけとして重ねて表示するHTMLを作る
        function renderRankOutfitPreviewHtml(outfit) {
            const fullbodyId = outfit && outfit.fullbody;
            if (fullbodyId) {
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                if (fbItem) return `<img src="${fbItem.img}" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain;">`;
            }
            const clothesItem = (outfit && KISEKAE_ITEMS.clothes.find(i => i.id === outfit.clothes)) || KISEKAE_ITEMS.clothes[0];
            let html = '';
            // 🕊️ 翼は服より背面に表示する（1枚目のフレームで代表させる）
            const backId = outfit && outfit.back;
            if (backId) {
                const backItem = KISEKAE_ITEMS.back.find(i => i.id === backId);
                if (backItem) {
                    const lp = backItem.leftFramePos[0], rp = backItem.rightFramePos[0];
                    html += `<img src="${backItem.leftFrames[0]}" alt="" style="position:absolute; top:${lp.top}%; left:${lp.left}%; width:${backItem.width}%; height:${backItem.height}%; z-index:1;">`;
                    html += `<img src="${backItem.rightFrames[0]}" alt="" style="position:absolute; top:${rp.top}%; left:${rp.left}%; width:${backItem.width}%; height:${backItem.height}%; z-index:1;">`;
                }
            }
            html += `<img src="${clothesItem.img}" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain; z-index:2;">`;
            ['hat', 'face'].forEach(cat => {
                const itemId = outfit && outfit[cat];
                const item = itemId ? KISEKAE_ITEMS[cat].find(i => i.id === itemId) : null;
                if (!item) return;
                html += `<img src="${item.img}" alt="" style="position:absolute; top:${item.top}%; left:${item.left}%; width:${item.width}%; height:${item.height}%; transform:rotate(${item.rotation || 0}deg); z-index:3;">`;
            });
            return html;
        }
        async function renderRankingList() {
            const listContainer = document.getElementById('ranking-list');
            listContainer.innerHTML = `<div style="text-align:center; color:#aaa; padding:20px;">読み込み中...</div>`;

            if (currentRankingTab === 'room') {
                const ready = window.isRankingReady && window.isRankingReady();
                const list = ready ? await window.fetchRoomLikeRanking() : null;
                if (!list) {
                    listContainer.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.8rem; padding:10px;">部屋ランキングサーバーに接続できませんでした。</div>`;
                    return;
                }
                listContainer.innerHTML = '';
                list.forEach((player, index) => {
                    const rank = index + 1;
                    const rs = rankNumberStyle(rank);
                    const row = document.createElement('div');
                    row.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px 8px; margin-bottom:6px; border-radius:12px; background:${player.isMe ? '#fff9c4' : '#fff'}; box-shadow:0 1px 4px rgba(0,0,0,0.08);`;
                    row.innerHTML = `
                        <div style="flex-shrink:0; width:34px; height:34px; border-radius:50%; background:${rs.bg}; color:${rs.color}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.85rem;">${rank}</div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:0.78rem; color:#5d4037; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(player.name)}${player.isMe ? '（自分）' : ''}</div>
                            <div style="font-size:1.0rem; color:#e91e63; font-weight:900;">❤️ ${player.roomLikeCount || 0}</div>
                        </div>
                        ${(!player.isMe && player.myroom) ? `<button onclick="visitMyroomOf('${player.uid}')" style="flex-shrink:0; background:#8d6e63; color:#fff; border:none; border-radius:50%; width:38px; height:38px; font-size:1.1rem;">🏠</button>` : ''}
                    `;
                    listContainer.appendChild(row);
                });
                return;
            }

            const tab = currentRankingTab; // 'score' | 'taps' | 'prestige'
            const ready = window.isRankingReady && window.isRankingReady();
            const fetchFn = tab === 'taps' ? window.fetchTapRankingList : tab === 'prestige' ? window.fetchPrestigeRankingList : window.fetchRankingList;
            let realList = ready ? await fetchFn() : null;

            const unit = tab === 'taps' ? 'タップ' : tab === 'prestige' ? '回' : 'もち';
            const myValue = tab === 'taps' ? totalTapsCount : tab === 'prestige' ? prestigeCount : score;
            const formatValue = (v) => tab === 'score' ? formatMochi(v) : Math.floor(v).toLocaleString();
            const getValue = (p) => tab === 'taps' ? (p.totalTaps || 0) : tab === 'prestige' ? (p.prestigeCount || 0) : (p.score || 0);

            if (!realList) {
                listContainer.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.8rem; padding:10px;">ランキングサーバーに接続できませんでした。<br>あなたの現在の${unit}数だけ表示しています。</div>`;
                const item = document.createElement('div'); item.className = "list-item"; item.style.background = "#fff9c4";
                item.innerHTML = `<span>${escapeHtml(playerName)}（自分）</span><strong>${formatValue(myValue)} ${unit}</strong>`;
                listContainer.appendChild(item);
                return;
            }

            // 自分の記録がTOP20に無ければ末尾に追加表示する（uid一致で判定するので、
            // オートセーブ前後でスコアが少しズレていても二重表示にはならない）
            const alreadyIn = realList.some(p => p.isMe);
            const combined = realList.map(p => ({ ...p }));
            if (!alreadyIn) combined.push({ name: playerName, score: Math.floor(score), totalTaps: totalTapsCount, prestigeCount: prestigeCount, outfit: equippedKisekae, isMe: true });
            else {
                // 自分の分だけ表示値を最新のものに更新（サーバー側は最大10秒遅れているため）
                const mine = combined.find(p => p.isMe);
                if (mine) { mine.score = Math.floor(score); mine.totalTaps = totalTapsCount; mine.prestigeCount = prestigeCount; mine.outfit = equippedKisekae; }
            }
            combined.sort((a, b) => getValue(b) - getValue(a));

            listContainer.innerHTML = "";
            combined.forEach((player, index) => {
                const rank = index + 1;
                const rs = rankNumberStyle(rank);
                const row = document.createElement('div');
                row.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px 8px; margin-bottom:6px; border-radius:12px; background:${player.isMe ? '#fff9c4' : '#fff'}; box-shadow:0 1px 4px rgba(0,0,0,0.08);`;
                row.innerHTML = `
                    <div style="flex-shrink:0; width:34px; height:34px; border-radius:50%; background:${rs.bg}; color:${rs.color}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.85rem;">${rank}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.78rem; color:#5d4037; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(player.name)}${player.isMe ? '（自分）' : ''}</div>
                        <hr style="border:none; border-top:1px solid #e0d5c5; margin:3px 0;">
                        <div style="font-size:1.05rem; color:#e91e63; font-weight:900;">${formatValue(getValue(player))} ${unit}</div>
                    </div>
                    <div style="flex-shrink:0; position:relative; width:46px; height:46px;">${renderRankOutfitPreviewHtml(player.outfit)}</div>
                    ${(!player.isMe && player.uid) ? `<button onclick="visitMyroomOf('${player.uid}')" style="flex-shrink:0; background:#8d6e63; color:#fff; border:none; border-radius:50%; width:32px; height:32px; font-size:0.9rem;">🏠</button>` : ''}
                `;
                listContainer.appendChild(row);
            });
        }

        // 定期メインループ（100ms周期で自動加算＆スキル秒数減算を一元管理）
        let diaryPageIndex = 0;
        function openDiary() {
            diaryPageIndex = selectedStageIndex;
            diaryShowingBack = false;
            document.getElementById('diary-front-content').style.display = 'block';
            document.getElementById('diary-back-content').style.display = 'none';
            renderDiaryPage();
            openModal('diary-modal');
        }
        let diaryShowingBack = false;
        function renderDiaryPage() {
            const stage = stages[diaryPageIndex]; const paper = document.getElementById('diary-paper-element');
            paper.classList.remove('page-animate'); void paper.offsetWidth; paper.classList.add('page-animate');
            const isPurchased = (purchasedItems[diaryPageIndex] || 0) > 0;

            // 表面：メインの絵日記イラストと、旅の本文
            document.getElementById('diary-img-element').src = stage.diaryImg;
            document.getElementById('diary-title-element').innerText = `${stage.name}編`;
            document.getElementById('diary-text-element').innerText = stage.diary;

            // 裏面：スタンプと、おみやげイラスト＋名前
            const stampMark = document.getElementById('diary-stamp-mark');
            if (collectedStamps[diaryPageIndex]) {
                stampMark.innerText = `${stage.name}\n到達記念`;
                stampMark.style.opacity = '0.88';
                stampMark.style.borderStyle = 'solid';
            } else {
                stampMark.innerText = '未到達';
                stampMark.style.opacity = '0.35';
                stampMark.style.borderStyle = 'dashed';
            }
            const thumbBackEl = document.getElementById('diary-item-thumb-back');
            thumbBackEl.src = isPurchased && stage.itemImg ? stage.itemImg : 'ui_images/present.webp';
            thumbBackEl.style.opacity = isPurchased ? '1' : '0.35';
            document.getElementById('diary-item-name-back').innerText = isPurchased
                ? `🛍️ ${stage.item} (Lv.${purchasedItems[diaryPageIndex]})`
                : '🛍️ アイテム: 未購入';

            document.getElementById('diary-footer-element').innerText = `枚数: ${diaryPageIndex + 1} / ${currentStageIndex + 1}`;
            document.getElementById('prev-page-btn').disabled = (diaryPageIndex === 0);
            document.getElementById('next-page-btn').disabled = (diaryPageIndex === currentStageIndex || diaryPageIndex === stages.length - 1);
        }
        function flipDiaryPage(showBack) {
            diaryShowingBack = showBack;
            document.getElementById('diary-front-content').style.display = showBack ? 'none' : 'block';
            document.getElementById('diary-back-content').style.display = showBack ? 'block' : 'none';
            playAudioFile('audio/page_turn.mp3', 1.0);
        }
        function nextPage() { if (diaryPageIndex < currentStageIndex && diaryPageIndex < stages.length - 1) { diaryPageIndex++; flipDiaryPage(false); renderDiaryPage(); } }
        function prevPage() { if (diaryPageIndex > 0) { diaryPageIndex--; flipDiaryPage(false); renderDiaryPage(); } }
