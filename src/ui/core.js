        // ===================================================================
        // ui.js から分割されたファイルです（共通UI基盤（モーダル開閉・音量設定・チュートリアル・セリフ表示・4隅ボタン調整・実績ミッション））。
        // 元々は1つの巨大な ui.js（4000行超）にすべて入っていましたが、見通しを良くするため
        // 機能ごとに src/ui/ 以下のファイルへ分割しました。ui.js 自身は今、この下の7ファイルを
        // まとめて re-export するだけの「窓口」になっています（他のファイルからの
        // import { X } from './ui.js' は今まで通りそのまま動きます）。
        // ===================================================================

        import { CORNER_BTN_OFFSETS, CORNER_BTN_OFFSETS_PWA_OVERRIDE, CORNER_BTN_SIZE, KISEKAE_ITEMS, TUTORIAL_MISSIONS, TUTORIAL_STEPS, dialogueData, setCORNER_BTN_SIZE, stages } from '../../data.js?v=2026-09-08-005';
        import { applyBgmVolume, bgmVolumeMult, fixBottomGap, getTimeBucketIndex, isRunningStandalone, pickRandom, playAudioFile, setBgmVolumeMult, setLastGreetingHourBucket, setSfxVolumeMult, sfxVolumeMult } from '../../main.js?v=2026-09-08-005';
        import { checkAndRotateMissions, claimMission, currentStageIndex, equippedKisekae, getMissionDef, getMissionProgress, getPrefTrophy, getPrefTrophyIcon, isMissionComplete, isPendingStampMoment, missionClaimed, missionDailySelected, missionWeeklySelected, prestigeCount, showPrefTrophyDetail, tutorialMissionStep } from '../../progress.js?v=2026-09-08-005';
        import { playerName, refreshCloudBackupStatus, sanitizePlayerName, saveGame, score, setPlayerName, totalTapsCount } from '../../state.js?v=2026-09-08-005';
        import { cancelFeedDragIfActive, isDraggingSqueeze, isScreamActive, isSqueezeSettling, setLastTappedTime, skills } from '../../tap.js?v=2026-09-08-005';
        import { isMochisukeVisible } from './kisekae.js?v=2026-09-08-005';
        import { openMap, openOmiyageCollection, updateDisplay } from './hud.js?v=2026-09-08-005';


        export function onBgmVolumeChange(val) {
            setBgmVolumeMult(val / 100);
            document.getElementById('bgm-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_bgm_volume', bgmVolumeMult);
            applyBgmVolume();
        }

        export function onSfxVolumeChange(val) {
            setSfxVolumeMult(val / 100);
            document.getElementById('sfx-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_sfx_volume', sfxVolumeMult);
        }

        export function resetVolumeSettings() {
            onBgmVolumeChange(30);
            onSfxVolumeChange(100);
            document.getElementById('bgm-vol-slider').value = 30;
            document.getElementById('sfx-vol-slider').value = 100;
        }

        // 明らかにスパム/おかしな名前を弾く簡易チェック（記号だけ・同じ文字の連続など）
        export function initVolumeSliders() {
            const bgmSlider = document.getElementById('bgm-vol-slider');
            const sfxSlider = document.getElementById('sfx-vol-slider');
            if (bgmSlider) { bgmSlider.value = Math.round(bgmVolumeMult * 100); document.getElementById('bgm-vol-label').innerText = bgmSlider.value + '%'; }
            if (sfxSlider) { sfxSlider.value = Math.round(sfxVolumeMult * 100); document.getElementById('sfx-vol-label').innerText = sfxSlider.value + '%'; }
            const nameInput = document.getElementById('player-name-input');
            if (nameInput) nameInput.value = playerName;
        }

        // ✏️ 意見・要望の送信（サーバーが無いので、メールアプリに下書きを渡す形にしています。
        // 実際に使う時は下のFEEDBACK_EMAILを自分の受け取りたいメールアドレスに書き換えてください）
        export let uiDeclutterState = 0;
        export function toggleUiDeclutter() {
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
        export let hasSeenTutorial = false; // 初回チュートリアルを見せたかどうか

        // 🍴 もちすけにお土産をあげる機能（回数制限なし）
        export let balloonAutoHideTimer = null;
        export function showMochiComment(text) {
            const balloon = document.getElementById('mochi-balloon');
            if (!balloon) return;
            balloon.innerText = text;
            balloon.classList.add('balloon-show');
            setLastTappedTime(Date.now()); // 表示直後にすぐ別のセリフへ切り替わらないようにリセット
            clearTimeout(balloonAutoHideTimer);
            if (!isTutorialActive) {
                balloonAutoHideTimer = setTimeout(() => { balloon.classList.remove('balloon-show'); }, 4000);
            }
        }

        // プレゼントや黄金もちが消えた時など、表示中のセリフを引っ込めるためのヘルパー
        export function hideMochiComment() {
            const balloon = document.getElementById('mochi-balloon');
            if (balloon) balloon.classList.remove('balloon-show');
        }

        // 🎙️ セリフの表示/非表示を一元的に検知して、口パーツの切り替えと効果音をまとめて処理する
        // （showMochiComment/updateCheerBalloon/チュートリアルなど、色々な場所からセリフが更新されても、ここ1箇所で拾える）
        // 👄 口パーツは「通常の姿・話していない・叫んでいない・必殺技で巨大化していない」時だけ表示する。
        // 叫び顔・必殺技巨大化は、それぞれ専用のイラスト/拡大を使うため、口パーツを重ねると浮いて見えてしまう。
        export function updateMouthPatchVisibility() {
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
        export let roboMouthAnimTimer = null;
        export function playRoboMouthAnimation(open) {
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
        export let mouthAdjustMode = false; // 調整モード中かどうか

        // 時間帯の並び順（インデックスは他の場所でも共通して使う）
        export const TIME_BUCKETS = ['morning', 'noon', 'evening', 'lateNight'];
        export function getTimeGreeting() {
            const bucket = TIME_BUCKETS[getTimeBucketIndex(new Date().getHours())];
            return pickRandom(dialogueData.timeGreetings[bucket]);
        }

        export function getLocalDateString(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        // 画面を開いた直後の挨拶。その日その時間帯にまだ挨拶していなければ「おはよう」等、
        // 既に挨拶済みなら「おかえり」を出す。両方ともlocalStorageに記録して次回に引き継ぐ。
        export const GREETING_STATE_KEY = 'punicker_last_greeting_bucket';
        export let tutorialStepIndex = 0;
        export let tutorialTimer = null;
        export let isTutorialActive = false;

        export function checkShowTutorial() {
            if (hasSeenTutorial) return;
            // 何かしら既にプレイした形跡があれば、初見扱いにしない
            if (score > 0 || totalTapsCount > 0) { hasSeenTutorial = true; saveGame(); return; }
            openTutorial();
        }

        export function openTutorial() {
            tutorialStepIndex = 0;
            isTutorialActive = true;
            document.body.classList.add('tutorial-active');
            document.querySelectorAll('.recommended-glow').forEach(el => el.classList.remove('recommended-glow'));
            runTutorialStep();
        }

        export function runTutorialStep() {
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

        export function endTutorial() {
            isTutorialActive = false;
            document.body.classList.remove('tutorial-active');
            document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));
            hasSeenTutorial = true;
            saveGame();
            promptPlayerNameIfNeeded();
        }

        export function confirmSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'flex';
        }
        export function doSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'none';
            clearTimeout(tutorialTimer);
            hideMochiComment();
            endTutorial(); // そのまま名前を決めるところまで進む
        }

        // 🍴 チュートリアルの最後に、まだ名前を決めていなければ聞いておく
        export function promptPlayerNameIfNeeded() {
            if (localStorage.getItem('punicker_player_name')) return;
            const input = document.getElementById('tutorial-name-input');
            if (input) input.value = playerName;
            openModal('tutorial-name-modal');
        }
        export function saveTutorialPlayerName() {
            const input = document.getElementById('tutorial-name-input');
            const result = sanitizePlayerName(input.value);
            if (!result.ok) { alert(result.reason); return; }
            setPlayerName(result.name);
            localStorage.setItem('punicker_player_name', playerName);
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            closeModal('tutorial-name-modal');
        }

        // 💬 4つの丸ボタン、初めて押した時だけ軽くヒントを出す（チュートリアル終了後の、2周目以降のフォロー用）
        export let seenButtonHints = { map: false, menu: false, ui: false, feed: false };
        export function onMapButtonTap() {
            if (!seenButtonHints.map) { seenButtonHints.map = true; saveGame(); showMochiComment('地図で好きな県に飛べるで！'); }
            openMap();
        }
        // 🗺️⚙️🖼️🍴 4隅ボタンの位置・大きさを反映する
        export function applyCornerBtnPositions() {
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
        export let cornerBtnAdjustMode = false;
        export let cornerBtnDragState = null;
        export function adjustCornerBtnSize(delta) {
            setCORNER_BTN_SIZE(Math.max(20, CORNER_BTN_SIZE + delta));
            document.getElementById('corner-btn-size-readout').textContent = CORNER_BTN_SIZE + 'px';
            applyCornerBtnPositions();
        }
        export function toggleCornerBtnAdjustMode() {
            cornerBtnAdjustMode = !cornerBtnAdjustMode;
            const btn = document.getElementById('corner-btn-adjust-toggle-btn');
            btn.style.background = cornerBtnAdjustMode ? '#4caf50' : '#e91e63';
            if (cornerBtnAdjustMode) setupCornerBtnDrag();
            updateCornerBtnReadout();
        }
        export function onCornerBtnAdjustTargetChange() {
            updateCornerBtnReadout();
        }
        // PWA(ホーム画面)かどうかで、参照・更新すべきオフセットのデータを切り替える
        export function getCornerBtnOffsetsRef(id) {
            return (isRunningStandalone() && CORNER_BTN_OFFSETS_PWA_OVERRIDE[id]) ? CORNER_BTN_OFFSETS_PWA_OVERRIDE[id] : CORNER_BTN_OFFSETS[id];
        }
        export function setupCornerBtnDrag() {
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
        export function updateCornerBtnReadout() {
            const id = document.getElementById('corner-btn-adjust-target').value;
            const offsets = getCornerBtnOffsetsRef(id);
            const envLabel = isRunningStandalone() ? '（PWA）' : '（通常URL）';
            document.getElementById('corner-btn-adjust-readout').textContent = `${envLabel} vert:${offsets.vert}px; horiz:${offsets.horiz}px;`;
        }
        export function copyCornerBtnCoords() {
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
        export function onMenuButtonTap() {
            if (!seenButtonHints.menu) { seenButtonHints.menu = true; saveGame(); showMochiComment('設定はここから触れるで！'); }
            openModal('menu-modal'); refreshCloudBackupStatus();
        }
        export function onUiButtonTap() {
            if (!seenButtonHints.ui) { seenButtonHints.ui = true; saveGame(); showMochiComment('写真撮る時とかに使こてな！'); }
            toggleUiDeclutter();
        }
        export function onFeedButtonTap() {
            if (!seenButtonHints.feed) { seenButtonHints.feed = true; saveGame(); showMochiComment('ここからお土産あげられるんやで！'); }
            openOmiyageCollection();
        }

        export function showOpeningGreeting() {
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
            setLastGreetingHourBucket(bucketIdx); // アイドルループがすぐ二重に挨拶し直さないように
            showMochiComment(text);
        }

        export let mouthDragState = null;
        export function toggleMouthAdjustMode() {
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
        export function setupMouthDrag(anchor) {
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
        export function adjustMouthSize(delta) {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            if (!anchor) return;
            const cur = parseFloat(anchor.style.width) || 18;
            anchor.style.width = Math.max(3, cur + delta) + '%';
            updateMouthReadout();
        }
        export function updateMouthReadout() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const el = document.getElementById('mouth-adjust-readout');
            if (!anchor || !el) return;
            el.textContent = `top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
        }
        export function copyMouthCoords() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const text = `口パーツ: top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
            const textarea = document.getElementById('mouth-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        // 🛠️ もちすけ本体の大きさ調整。着せ替え部屋も全く同じ大きさに揃える約束なので、
        // ここで変えた値は、着せ替え部屋のもちすけ本体にもその場で同期する
        export function adjustMochisukeBodySize(deltaWidth, deltaMaxHeight) {
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
        export function updateMochisukeBodyReadout() {
            const btn = document.getElementById('mochisuke-btn');
            const el = document.getElementById('mochisuke-body-readout');
            if (!btn || !el) return;
            el.textContent = `width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};（着せ替え部屋にも自動で同期済み）`;
        }
        export function copyMochisukeBodyCoords() {
            const btn = document.getElementById('mochisuke-btn');
            const text = `もちすけ本体: width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};`;
            const textarea = document.getElementById('mochisuke-body-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        export function openModal(id, skipSound) {
            cancelFeedDragIfActive(); // 給餌中に他画面へ移動したら、置きっぱなしのおみやげを片付ける
            if (!skipSound) playAudioFile('audio/skill_tap.mp3');
            document.body.classList.add('modal-open');
            document.getElementById(id).style.display = "flex";
        }
        export function closeModal(id) {
            document.body.classList.remove('modal-open'); document.getElementById(id).style.display = "none";
            // 🔴 スタンプを押さずに絵日記を閉じた場合、進捗エリアのボタンを再表示して操作不能にならないようにする
            if (id === 'diary-modal' && isPendingStampMoment) {
                const btn = document.getElementById('stamp-press-btn');
                if (btn) btn.style.display = 'flex';
            }
        }

        export function openTrophyRoom() {
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
        export function closeOshigoto() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('mission-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        export function openOshigotoPlaceholder() {
            checkAndRotateMissions(); // 開くたびに、日付/週またぎを最新化する
            openModal('mission-modal');
            switchMissionTab(currentMissionTab);
        }
        export let currentMissionTab = 'tutorial';
        export function switchMissionTab(tab) {
            currentMissionTab = tab;
            ['tutorial', 'daily', 'weekly'].forEach(t => {
                document.getElementById(`mission-tab-${t}`).classList.toggle('active', t === tab);
            });
            renderMissionList();
        }
        export function renderMissionRow(mission) {
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
        export function renderMissionList() {
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
        export function onClaimMissionTap(id) {
            const success = claimMission(id);
            if (success) {
                playAudioFile('audio/levelup.mp3');
                updateDisplay();
                renderMissionList();
            }
        }
        window.onClaimMissionTap = onClaimMissionTap; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要



        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        export function setBalloonAutoHideTimer(v) { balloonAutoHideTimer = v; }
        export function setHasSeenTutorial(v) { hasSeenTutorial = v; }
        export function setSeenButtonHints(v) { seenButtonHints = v; }
        window.onBgmVolumeChange = onBgmVolumeChange;
        window.onSfxVolumeChange = onSfxVolumeChange;
        window.resetVolumeSettings = resetVolumeSettings;
        window.confirmSkipTutorial = confirmSkipTutorial;
        window.doSkipTutorial = doSkipTutorial;
        window.saveTutorialPlayerName = saveTutorialPlayerName;
        window.onMapButtonTap = onMapButtonTap;
        window.adjustCornerBtnSize = adjustCornerBtnSize;
        window.toggleCornerBtnAdjustMode = toggleCornerBtnAdjustMode;
        window.onCornerBtnAdjustTargetChange = onCornerBtnAdjustTargetChange;
        window.copyCornerBtnCoords = copyCornerBtnCoords;
        window.onMenuButtonTap = onMenuButtonTap;
        window.onUiButtonTap = onUiButtonTap;
        window.onFeedButtonTap = onFeedButtonTap;
        window.toggleMouthAdjustMode = toggleMouthAdjustMode;
        window.adjustMouthSize = adjustMouthSize;
        window.copyMouthCoords = copyMouthCoords;
        window.adjustMochisukeBodySize = adjustMochisukeBodySize;
        window.copyMochisukeBodyCoords = copyMochisukeBodyCoords;
        window.openModal = openModal;
        window.closeModal = closeModal;
        window.closeOshigoto = closeOshigoto;
        window.openOshigotoPlaceholder = openOshigotoPlaceholder;
        window.switchMissionTab = switchMissionTab;
