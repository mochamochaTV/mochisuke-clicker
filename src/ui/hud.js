        // ui.js を機能ごとに分割したファイルの1つ（常時表示UI（マップ・スコア表示・おすすめアクション・おみやげ・スプレー演出・updateDisplay））。ui.js 自身は7ファイルをre-exportする窓口。

        import { SPRAY_ITEMS, dialogueData, stages } from '../../data.js?v=2026-09-10-003';
        import { createFloatingText, createParticle, formatMochi, lazyLoadImage, pickRandom, playAudioFile, screenFlash, screenShake, vibrate } from '../../main.js?v=2026-09-10-003';
        import { hasNewlyUnlockedMinigame } from '../../minigames.js?v=2026-09-10-003';
        import { canPrestige, collectedStamps, currentStageIndex, currentStageProgress, isPendingStampMoment, selectedStageIndex, setSelectedStageIndex, setStampDebugInterval, setStampDebugMode, stageArrivalTime, stampDebugInterval, stampDebugMode, trackMissionEvent, triggerAreaTransition } from '../../progress.js?v=2026-09-10-003';
        import { activeSprayId, getOmiyagePrice, purchasedItems, sprayBuffActiveUntil } from '../../shop.js?v=2026-09-10-003';
        import { saveGame, score } from '../../state.js?v=2026-09-10-003';
        import { FEED_BUFF_DURATION_MS, FEED_DAILY_LIMIT, feedPlaysUsedToday, feedTeaseTimer, feverTimeLeft, getMps, getTapPower, isFever, isScreamActive, mochiBtnElement, placeFeedIconNearMochisuke, resetFeedCountIfNewDay, revertScreamFace, setFeedBuffActiveUntil, setFeedPlaysUsedToday, setFeedTeaseLevel, skills, startFeedBuffIndicator } from '../../tap.js?v=2026-09-10-003';
        import { closeModal, isTutorialActive, openModal, showMochiComment } from './core.js?v=2026-09-10-003';
        import { isMochisukeVisible } from './kisekae.js?v=2026-09-10-003';
        import { diaryPageIndex } from './ranking.js?v=2026-09-10-003';

        // チューニング用の数値をまとめた設定オブジェクト（演出の強さやタイミングを調整する時はここを触る）
        const CONFIG = {
            FEED_VIBRATE_PATTERN_MS: [20, 40, 20], // もちすけに給餌した時の振動パターン
            FEED_SCREEN_FLASH_INTENSITY: 0.3, // 給餌時の画面フラッシュの強さ
            MOCHI_EAT_ANIM_DURATION_MS: 500, // もちすけが食べる動作アニメーションの長さ
            FEED_BUFF_TEXT_DELAY_MS: 300, // 「タップ力2倍！」の追加テキストを出すまでの遅延
            FEED_PARTICLE_COUNT: 16, // 給餌時に散らすパーティクルの数
            FEED_PARTICLE_SPREAD_PX: 90, // 給餌パーティクルの散らばる範囲
            STAMP_DEBUG_INTERVAL_MS: 300, // スタンプデバッグ表示の更新間隔
            RECOMMEND_CHECK_THROTTLE_MS: 1000, // おすすめアクション判定の再計算間隔（連打対策）
            SPARKLE_PARTICLE_INTERVAL_MS: 700, // スプレーのキラキラ演出の生成間隔
            SPARKLE_PARTICLE_REMOVE_DELAY_MS: 1300, // キラキラパーティクルを消すまでの時間
        };

        /**
         * おみやげコレクション画面のグリッドを構築して表示する。
         * @returns {void}
         */
        export function openOmiyageCollection() {
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

        /**
         * おみやげを選んで給餌するかどうかの確認モーダルを表示する。
         * @param {number} idx - stages配列内のステージ（県）インデックス
         * @returns {void}
         */
        export function showOmiyageFeedConfirm(idx) {
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
        /**
         * おみやげをもちすけに食べさせ、給餌演出・バフ付与・進行状況の記録を行う。
         * @param {number} idx - stages配列内のステージ（県）インデックス
         * @returns {void}
         */
        export function feedMochisuke(idx) {
            const stage = stages[idx];
            if (!stage) return;

            clearTimeout(feedTeaseTimer);
            if (isScreamActive) revertScreamFace(); // 叫び中に給餌で中断された場合も、確実に元の姿へ戻す
            setFeedTeaseLevel(0);

            setFeedBuffActiveUntil(Date.now() + FEED_BUFF_DURATION_MS);
            setFeedPlaysUsedToday(feedPlaysUsedToday + 1);
            trackMissionEvent('feedToday', 1);
            saveGame();
            startFeedBuffIndicator();

            const mochiRect = mochiBtnElement.getBoundingClientRect();
            playAudioFile('audio/mochisuke/mochi_eat.mp3');
            vibrate(CONFIG.FEED_VIBRATE_PATTERN_MS);
            screenFlash('#ff9800', CONFIG.FEED_SCREEN_FLASH_INTENSITY);
            screenShake('small');
            mochiBtnElement.animate([
                { transform: 'scale(1, 1) rotate(0deg)' },
                { transform: 'scale(1.25, 0.8) rotate(-4deg)', offset: 0.25 },
                { transform: 'scale(0.85, 1.2) rotate(4deg)', offset: 0.5 },
                { transform: 'scale(1.1, 0.92) rotate(-2deg)', offset: 0.75 },
                { transform: 'scale(1, 1) rotate(0deg)' }
            ], { duration: CONFIG.MOCHI_EAT_ANIM_DURATION_MS, easing: 'ease-in-out' });
            createFloatingText(mochiRect.left + mochiRect.width / 2, mochiRect.top + mochiRect.height / 3, `${stage.item}おいしい〜！`, "#ff9800", "1.1rem");
            setTimeout(() => {
                createFloatingText(mochiRect.left + mochiRect.width / 2, mochiRect.top + mochiRect.height / 2.2, `⚡タップ力2倍！`, "#e91e63", "1.3rem");
            }, CONFIG.FEED_BUFF_TEXT_DELAY_MS);
            showMochiComment(pickRandom(dialogueData.feedComments).replace('○○', stage.item));
            for (let i = 0; i < CONFIG.FEED_PARTICLE_COUNT; i++) {
                createParticle(mochiRect.left + mochiRect.width / 2 + (Math.random() - 0.5) * CONFIG.FEED_PARTICLE_SPREAD_PX, mochiRect.top + mochiRect.height / 2 + (Math.random() - 0.5) * CONFIG.FEED_PARTICLE_SPREAD_PX, true);
            }
        }

        // ⚡ タップ力2倍中のバフ表示を、残り秒数のカウントダウン付きで出す
        export let mapZoom = 1;
        export let mapPanX = 0, mapPanY = 0;
        export let mapDragging = false, mapDragStartX = 0, mapDragStartY = 0, mapPanStartX = 0, mapPanStartY = 0;
        export let mapPinchStartDist = 0, mapPinchStartZoom = 1;
        export const MAP_ZOOM_MIN = 1, MAP_ZOOM_MAX = 4;

        /**
         * マップモーダルを開き、各県のピンを配置して表示状態を初期化する。
         * @returns {void}
         */
        export function openMap() {
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

        /**
         * マップモーダルを閉じる。
         * @returns {void}
         */
        export function closeMapModal() {
            closeModal('map-modal');
        }

        /**
         * マップ上のピンがタップされた時に、そのステージへ移動するかどうかの確認オーバーレイを出す。
         * @param {number} idx - stages配列内のステージ（県）インデックス
         * @returns {void}
         */
        export function onMapPinTap(idx) {
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

        /**
         * 指定したステージへエリア移動を実行し、演出・状態更新・セリフ表示を行う。
         * @param {number} idx - stages配列内のステージ（県）インデックス
         * @returns {void}
         */
        export function mapMoveTo(idx) {
            closeModal('map-modal');
            triggerAreaTransition(stages[idx].bg, () => {
                setSelectedStageIndex(idx); updateDisplay(); saveGame();
                const name = stages[idx].name;
                const prefPool = dialogueData.prefectureComments[name];
                showMochiComment(prefPool ? `${name}到着！${pickRandom(prefPool)}` : `${name}到着！ここはどんな場所やろな？`);
            });
        }

        // --- 拡大縮小・ドラッグ操作 ---
        /**
         * 現在のズーム倍率・パン位置をmap-canvas要素のCSS transformに反映する。
         * @returns {void}
         */
        export function applyMapTransform() {
            const canvas = document.getElementById('map-canvas');
            if (canvas) canvas.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
        }

        /**
         * マップのパン位置が表示領域からはみ出さないように補正する。
         * @returns {void}
         */
        export function clampMapPan() {
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
        /**
         * クライアント座標をmap-viewport要素基準のローカル座標に変換する。
         * @param {number} clientX - クライアントX座標
         * @param {number} clientY - クライアントY座標
         * @returns {Object} viewport左上を原点とした{x, y}座標
         */
        export function getMapFocalPoint(clientX, clientY) {
            const viewport = document.getElementById('map-viewport');
            const rect = viewport.getBoundingClientRect();
            return { x: clientX - rect.left, y: clientY - rect.top };
        }

        // (fx, fy)＝viewport基準の座標を中心に拡大縮小する（その地点の絵柄が画面上で動かないようにpanを調整）
        /**
         * 指定した座標を中心にマップを拡大縮小し、パン位置を調整して反映する。
         * @param {number} newZoomRaw - 適用したいズーム倍率（範囲外はクランプされる）
         * @param {number} fx - ズームの中心とするviewport基準のX座標
         * @param {number} fy - ズームの中心とするviewport基準のY座標
         * @returns {void}
         */
        export function zoomMapToward(newZoomRaw, fx, fy) {
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
        /**
         * 画面中央を基準に、現在のズーム倍率をfactor倍にする。
         * @param {number} factor - 現在のズームに掛け合わせる倍率
         * @returns {void}
         */
        export function mapZoomBy(factor) {
            const viewport = document.getElementById('map-viewport');
            zoomMapToward(mapZoom * factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
        }

        /**
         * マップのズーム倍率とパン位置を初期状態にリセットする。
         * @returns {void}
         */
        export function mapZoomReset() {
            mapZoom = 1; mapPanX = 0; mapPanY = 0;
            applyMapTransform();
        }

        /**
         * マップviewportにドラッグ・ピンチズーム操作のイベントリスナーを登録する（初回のみ）。
         * @returns {void}
         */
        export function initMapInteractions() {
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

        /**
         * スタンプデバッグ表示のON/OFFを切り替え、ONの場合は定期更新タイマーを開始する。
         * @returns {void}
         */
        export function toggleStampDebug() {
            setStampDebugMode(!stampDebugMode);
            if (stampDebugMode) {
                setStampDebugInterval(setInterval(updateStampDebugReadout, CONFIG.STAMP_DEBUG_INTERVAL_MS));
                updateStampDebugReadout();
            } else {
                clearInterval(stampDebugInterval);
                document.getElementById('stamp-debug-readout').textContent = '';
            }
        }
        /**
         * スタンプ判定に関する内部状態をデバッグ用テキストとして画面に出力する。
         * @returns {void}
         */
        export function updateStampDebugReadout() {
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

        export let lastScoreFormatted = '';
        // もちの数表示を1文字ずつ<span>に分けて描画し、前回と値が違う文字だけポンっと弾ませる
        // （右詰めで比較するので、桁が増えて全体がズレても「実際に変わった桁」だけを正しく判定できる）
        /**
         * もちの数を1文字ずつspanに分けて描画し、前回と値が異なる桁だけにポップアニメーション用クラスを付ける。
         * @param {HTMLElement} container - 描画先の要素
         * @param {string} newText - 今回表示する文字列
         * @param {string} oldText - 前回表示していた文字列
         * @returns {void}
         */
        export function renderScoreDigits(container, newText, oldText) {
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
        export let lastRecommendCheckTime = 0;
        /**
         * 状況に応じて、次に押すべきUI要素のIDを1つだけ判定する（おみやげ購入・スキル購入・スキル使用・ミニゲームの優先順）。
         * @returns {string|null} ハイライト対象要素のID。ハイライト不要な場合はnull
         */
        export function getRecommendedActionTargetId() {
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
        /**
         * おすすめアクションの判定結果に応じて、対象UI要素に光る演出クラスを付け替える（1秒に1回まで再計算）。
         * @returns {void}
         */
        export function updateRecommendedActionHighlight() {
            if (isTutorialActive) return; // チュートリアル中は、こちらの自動ハイライトは出さない（チュートリアル自身のハイライトとぶつかるため）
            const now = Date.now();
            if (now - lastRecommendCheckTime < CONFIG.RECOMMEND_CHECK_THROTTLE_MS) return; // 連打のたびに毎回判定しなくていいよう、1秒に1回だけ再計算
            lastRecommendCheckTime = now;
            document.querySelectorAll('.recommended-glow').forEach(el => el.classList.remove('recommended-glow'));
            const targetId = getRecommendedActionTargetId();
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) el.classList.add('recommended-glow');
            }
        }

        // 未獲得(lv===0)で、解放済み(ステージ条件クリア)かつ購入できるスキルがあるか判定（レベルアップは対象外）
        /**
         * 未獲得かつ解放済みで、購入可能な資金があるスキルが存在するか判定する。
         * @returns {boolean} 新規購入可能なスキルがあればtrue
         */
        export function hasNewlyPurchasableSkill() {
            return Object.values(skills).some(s => s.lv === 0 && currentStageIndex >= s.unlockStage && score >= s.unlockPrice);
        }
        // 未購入(lv===0)で、解放済み(訪問済み)かつ購入できるおみやげがあるか判定（レベルアップは対象外）
        /**
         * 未購入かつ訪問済みで、購入可能な資金があるおみやげが存在するか判定する。
         * @returns {boolean} 新規購入可能なおみやげがあればtrue
         */
        export function hasNewlyPurchasableOmiyage() {
            for (let i = 0; i <= currentStageIndex; i++) {
                const lv = purchasedItems[i] || 0;
                if (lv === 0 && score >= getOmiyagePrice(stages[i], 0)) return true;
            }
            return false;
        }
        // ✨ スプレーの見た目エフェクト（キラキラ・オーラ）を、バフの有無に応じて切り替える
        export let sprayParticleTimer = null;
        /**
         * スプレーバフの有無・種類に応じて、オーラ表示やキラキラパーティクル生成タイマーを切り替える。
         * @returns {void}
         */
        export function updateSprayEffectDisplay() {
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
                sprayParticleTimer = setInterval(spawnSparkleParticle, CONFIG.SPARKLE_PARTICLE_INTERVAL_MS);
            } else if (item.effectId !== 'sparkle' && sprayParticleTimer) {
                clearInterval(sprayParticleTimer);
                sprayParticleTimer = null;
            }
        }
        /**
         * もちすけの周りにキラキラパーティクルを1つ生成し、一定時間後に消す。
         * @returns {void}
         */
        export function spawnSparkleParticle() {
            if (Date.now() >= sprayBuffActiveUntil) { updateSprayEffectDisplay(); return; }
            if (!isMochisukeVisible()) return; // 見えている画面の時だけ生成する
            const wrap = document.getElementById('mochisuke-deform-wrap');
            if (!wrap) return;
            const rect = wrap.getBoundingClientRect();
            const particle = document.createElement('div');
            particle.textContent = '✨';
            particle.style.cssText = `position:fixed; left:${rect.left + rect.width * Math.random()}px; top:${rect.top + rect.height * Math.random()}px; font-size:1.3rem; pointer-events:none; z-index:9999; animation: sprayParticleFloat 1.2s ease-out forwards;`;
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), CONFIG.SPARKLE_PARTICLE_REMOVE_DELAY_MS);
        }
        /**
         * スコア・現在地・進行度・おすすめハイライトなど、HUD全体の表示を最新の状態に更新する。
         * @returns {void}
         */
        export function updateDisplay() {
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
        window.closeMapModal = closeMapModal;
        window.mapZoomBy = mapZoomBy;
        window.mapZoomReset = mapZoomReset;
        window.toggleStampDebug = toggleStampDebug;
