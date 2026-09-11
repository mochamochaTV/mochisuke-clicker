        // ui.js を機能ごとに分割したファイルの1つ（自分のマイルーム（家具配置・部屋の編集・スロット切り替え））。ui.js 自身は7ファイルをre-exportする窓口。

        import { MYROOM_CATEGORY_LABELS, MYROOM_FURNITURE_LIMIT_PER_CATEGORY, MYROOM_ITEMS, MYROOM_MOCHISUKE_SIZE, MYROOM_SLOT_POSITIONS, MYROOM_WALL_ZONE_BOTTOM, NORMAL_CONSUMABLE_ITEMS, SPRAY_ITEMS, stages } from '../../data.js?v=2026-09-11-003';
        import { IS_DEV_MODE, playAudioFile, playBgmLoop } from '../../main.js?v=2026-09-11-003';
        import { currentMyroomSlotIndex, equippedMyroom, myroomSlots, ownedMyroomItems, setCurrentMyroomSlotIndex, setEquippedMyroom } from '../../progress.js?v=2026-09-11-003';
        import { activeSprayId, purchasedItems, sprayBuffActiveUntil, sprayInventory, ticketInventory } from '../../shop.js?v=2026-09-11-003';
        import { saveGame } from '../../state.js?v=2026-09-11-003';
        import { closeModal, openModal } from './core.js?v=2026-09-11-003';
        import { closeMyroomActionMenu, moveMenuGoTo, openMoveMenu, renderWarehouseItems, setMyroomMouthHidden } from './social.js?v=2026-09-11-003';
        import { applyKisekaeToMyroom, stopWingFlapLoop } from './kisekae.js?v=2026-09-11-003';

        // 🔧 このファイル内のロジックで使う「調整可能な」数値をまとめる（data.jsの配置テーブル等はそちらに残す）
        const CONFIG = {
            // 🖐️ 大きさ調整パネルのドラッグ可動範囲
            SIZE_PANEL_DRAG_EDGE_MARGIN_PX: 40, // パネルがステージ端からはみ出さないようにする余白(px)

            // 🚶 もちすけのランダム徘徊
            MOCHISUKE_WALK_PAUSE_MIN_MS: 3000, // 次の歩行までの最短待機時間
            MOCHISUKE_WALK_PAUSE_RANDOM_RANGE_MS: 4000, // 待機時間に加算するランダム幅
            MOCHISUKE_WALK_LEFT_MIN_PCT: 12, // 歩き回る横位置の最小%（端に寄りすぎない）
            MOCHISUKE_WALK_LEFT_RANGE_PCT: 76, // 歩き回る横位置のランダム幅%
            MOCHISUKE_WALK_BOTTOM_MIN_PCT: 1, // 歩き回る縦位置(床からの高さ)の最小%
            MOCHISUKE_WALK_BOTTOM_RANGE_PCT: 8, // 歩き回る縦位置のランダム幅%
            MOCHISUKE_WALK_MIN_DURATION_SEC: 0.5, // 近距離でも不自然に速くならないための最短移動時間(秒)
            MOCHISUKE_WALK_SOUND_VOLUME: 0.12, // 歩行音の音量

            // 👆 もちすけタップ演出
            MOCHISUKE_TAP_ANIM_DURATION_MS: 220, // タップ時の縮小→復帰アニメーションの長さ

            // 🚪 マイルームを閉じる時のフェード演出
            CLOSE_MYROOM_FADE_DELAY_MS: 300, // フェードアウトしてからモーダルを閉じるまでの待機時間
            CLOSE_MYROOM_OVERLAY_CLEAR_DELAY_MS: 150, // モーダルを閉じた後、フェード用オーバーレイを消すまでの待機時間

            // 🛋️ 家具の操作ボタン（反転・削除・前面へ・背面へ）の配置オフセット
            FLIP_BTN_LEFT_MAX_PCT: 94, // 反転ボタンの左端位置の上限%
            DEL_BTN_TOP_OFFSET_PCT: 3, // 削除ボタンを家具の左上から上にずらす量%
            DEL_BTN_LEFT_OFFSET_PCT: 2, // 削除ボタンを家具の左上から左にずらす量%
            LAYER_BTN_HEIGHT_OFFSET_PCT: 12, // 前面/背面ボタンの上位置を家具下端から少し上げる量%
            LAYER_BTN_LEFT_MAX_PCT: 90, // 前面/背面ボタンの左端位置の上限%

            // 📍 家具の配置・ドラッグ可動範囲
            FLOOR_OVERLAP_EPSILON_PCT: 0.1, // 床置き家具が必ずわずかに床へ重なるようにする微小量%
            FURNITURE_DRAG_VERTICAL_OVERFLOW_RATIO: 0.1, // 床置き家具が上にはみ出せる割合（高さに対する比率）
            FURNITURE_DRAG_HORIZONTAL_OVERFLOW_RATIO: 0.15, // 床置き家具が左右にはみ出せる割合（幅に対する比率）
            FURNITURE_DRAG_VISIBLE_RATIO: 0.85, // 床置き家具が画面内に最低限残っていなければならない割合

            // 🏷️ アイテム名ラベルの表示時間
            ITEM_NAME_LABEL_DURATION_MS: 2200,

            // 🛠️ 開発者用サイズ調整ツール
            SIZE_ADJUST_MIN_PCT: 2, // 家具・もちすけの幅/高さがこれ未満に縮まないようにする下限%

            // 🔀 部屋切り替え
            MYROOM_SLOT_COUNT: 3, // 持てる部屋の最大数

            // ✅ 「決定」ボタンの一時メッセージ表示時間
            CONFIRM_BTN_MESSAGE_DURATION_MS: 1200,

            // 🎫 時間換算
            MS_PER_HOUR: 3600000, // スプレー効果の残り時間を「時間」表示に変換する際に使う
        };

        // ===================================================================
        // 🛋️ マイルーム
        // ===================================================================
        /**
         * マイルームへの入口。フェード演出付きの共通遷移関数にopenMyRoomを渡して開く。
         * @returns {void}
         */
        export function openMyRoomEntry() {
            moveMenuGoTo(openMyRoom);
        }
        export let previewMyroom = {};
        // 🎨 もようがえモード：通常時はUIを消してすっきり見せ、ボタンを押した時だけ編集UIを出す
        export let myroomIsEditMode = false;
        // 🖐️ 大きさ調整パネル自体を、ドラッグで自由に動かせるようにする（「もようがえ」ボタン等と重ならないように避難できる）
        /**
         * 開発者用の大きさ調整パネルを、ハンドルのドラッグでステージ内の任意位置へ移動できるようにする。
         * @returns {void}
         */
        export function setupMyroomSizePanelDrag() {
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
                newTop = Math.max(0, Math.min(stageRect.height - CONFIG.SIZE_PANEL_DRAG_EDGE_MARGIN_PX, newTop));
                newLeft = Math.max(0, Math.min(stageRect.width - CONFIG.SIZE_PANEL_DRAG_EDGE_MARGIN_PX, newLeft));
                panel.style.top = newTop + 'px';
                panel.style.left = newLeft + 'px';
                panel.style.right = 'auto';
            });
            const endDrag = () => { dragState = null; handle.style.cursor = 'grab'; };
            handle.addEventListener('pointerup', endDrag);
            handle.addEventListener('pointercancel', endDrag);
        }
        /**
         * 「もようがえ」モードのON/OFFを切り替える。編集UI・アイテム一覧・部屋切替パネルの表示制御と再描画をまとめて行う。
         * @returns {void}
         */
        export function toggleMyroomEditMode() {
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
            // 🎭 もようがえモード中は、家具配置の邪魔になるのでアクションボタンを消す
            const actionBtn = document.getElementById('myroom-action-btn');
            if (actionBtn) actionBtn.style.display = myroomIsEditMode ? 'none' : 'flex';
            if (myroomIsEditMode) closeMyroomActionMenu('edit');
            renderMyroomLayout(); // 削除ボタンの表示/非表示を確実に同期させる
        }
        // 🚶 マイルームでは、もちすけがランダムに歩き回る・立ち止まるを繰り返す
        export let myroomWalkTimer = null;
        /**
         * もちすけのランダム徘徊タイマーを開始する。既存タイマーを止めてから次の歩行をスケジュールする。
         * @returns {void}
         */
        export function startMyroomMochisukeWalk() {
            stopMyroomMochisukeWalk();
            scheduleNextMyroomWalk();
        }
        /**
         * もちすけの徘徊タイマーを停止し、myroomWalkTimerをクリアする。
         * @returns {void}
         */
        export function stopMyroomMochisukeWalk() {
            clearTimeout(myroomWalkTimer);
            myroomWalkTimer = null;
        }
        export const MYROOM_WALK_SPEED_PCT_PER_SEC = 22; // もちすけの歩く速さ（%/秒、一定）
        /**
         * ランダムな待機時間の後に次の歩行(walkMyroomMochisukeToRandomSpot)を実行するタイマーをセットする。
         * @returns {void}
         */
        export function scheduleNextMyroomWalk() {
            const pauseDuration = CONFIG.MOCHISUKE_WALK_PAUSE_MIN_MS + Math.random() * CONFIG.MOCHISUKE_WALK_PAUSE_RANDOM_RANGE_MS; // 3〜7秒くらい、その場に立ち止まる（前より少し頻度を減らした）
            myroomWalkTimer = setTimeout(walkMyroomMochisukeToRandomSpot, pauseDuration);
        }
        /**
         * もちすけをランダムな座標へ、距離に応じた一定速度で移動させる。歩行音・歩行アニメーション・口パーツの開閉制御・次のスケジューリングまでを行う。
         * @returns {void}
         */
        export function walkMyroomMochisukeToRandomSpot() {
            const wrap = document.getElementById('myroom-mochisuke-breathe-wrap');
            if (!wrap) return;
            const currentLeft = parseFloat(wrap.style.left) || 50;
            const newLeftPct = CONFIG.MOCHISUKE_WALK_LEFT_MIN_PCT + Math.random() * CONFIG.MOCHISUKE_WALK_LEFT_RANGE_PCT; // 端に寄りすぎないよう12〜88%の範囲で歩く
            const newBottomPct = CONFIG.MOCHISUKE_WALK_BOTTOM_MIN_PCT + Math.random() * CONFIG.MOCHISUKE_WALK_BOTTOM_RANGE_PCT; // 床の中で少し前後にも動く
            // 🐛修正：距離に関わらず速度が一定になるよう、移動時間を距離から逆算する（前は時間固定で、距離次第で速さがバラついていた）
            const distance = Math.abs(newLeftPct - currentLeft);
            const moveDuration = Math.max(CONFIG.MOCHISUKE_WALK_MIN_DURATION_SEC, distance / MYROOM_WALK_SPEED_PCT_PER_SEC).toFixed(2);
            wrap.style.transition = `left ${moveDuration}s linear, bottom ${moveDuration}s linear`;
            wrap.style.left = newLeftPct + '%';
            wrap.style.bottom = newBottomPct + '%';
            const inner = document.getElementById('myroom-mochisuke-inner');
            if (inner) inner.classList.add('myroom-walking'); // 🚶 スーッと滑るのではなく、とことこ歩いて見えるようにする（内側要素だけをアニメーションさせ、外側の中央寄せtransformとぶつからないようにする）
            playAudioFile('audio/move_small.mp3', CONFIG.MOCHISUKE_WALK_SOUND_VOLUME);
            setMyroomMouthHidden('myroom-mochisuke', 'walk', true); // 👄 歩いている間は口を開ける（叫び中なら叫び終わるまでは戻さない。全身衣装中は触らない）
            setTimeout(() => {
                if (inner) inner.classList.remove('myroom-walking');
                setMyroomMouthHidden('myroom-mochisuke', 'walk', false); // 止まったら口を閉じる（他に理由が残っていなければ）
            }, moveDuration * 1000);
            scheduleNextMyroomWalk();
        }
        // 👆 マイルームでは、もちは出ないが、もちすけをタップすると反応してくれる
        /**
         * マイルームでもちすけをタップした際の反応（タップ音＋縮小→復帰のスケールアニメーション）を行う。もようがえモード中は何もしない。
         * @returns {void}
         */
        export function onMyroomMochisukeTap() {
            if (myroomIsEditMode) return; // もようがえモード中は、ドラッグ操作を優先する
            const inner = document.getElementById('myroom-mochisuke-inner');
            if (!inner) return;
            playAudioFile('audio/tap.mp3');
            inner.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(0.88)' }, { transform: 'scale(1)' }],
                { duration: CONFIG.MOCHISUKE_TAP_ANIM_DURATION_MS, easing: 'ease-out' }
            );
        }
        // 🐛修正：PWA環境ではonclick属性が不安定になることがあるため、pointerupで明示的に判定する
        /**
         * もちすけ要素にpointerupイベントリスナーを一度だけ登録し、タップ時にonMyroomMochisukeTap()を呼ぶようにする。
         * @returns {void}
         */
        export function setupMyroomMochisukeTapHandler() {
            const wrap = document.getElementById('myroom-mochisuke-breathe-wrap');
            if (!wrap || wrap.dataset.tapSetup) return;
            wrap.dataset.tapSetup = '1';
            wrap.addEventListener('pointerup', (e) => {
                e.stopPropagation();
                onMyroomMochisukeTap();
            });
        }
        /**
         * マイルーム画面を開くメイン処理。状態初期化、previewMyroomへのディープコピー、レイアウト描画、モーダル表示、BGM再生、もちすけの徘徊・タップハンドラの起動、開発者用サイズ調整パネルの初期化までを行う。
         * @returns {void}
         */
        export function openMyRoom() {
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
            playBgmLoop('audio/bgm/bgm_myroom.mp3');
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
        /**
         * マイルームを閉じる処理。フェードアウト演出後にモーダルを閉じ、羽ばたきループ・もちすけ徘徊を停止し、通常BGMに戻し、移動メニューを再度開く。
         * @returns {void}
         */
        export function closeMyRoom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('myroom-modal');
                stopWingFlapLoop('myroom');
                stopMyroomMochisukeWalk();
                playBgmLoop('audio/bgm/bgm.mp3');
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.CLOSE_MYROOM_OVERLAY_CLEAR_DELAY_MS);
            }, CONFIG.CLOSE_MYROOM_FADE_DELAY_MS);
        }
        export let selectedMyroomInstance = null; // 今タップして選択中の家具 { cat, idx } または null
        /**
         * previewMyroomの状態に基づき、壁紙・床・配置済み家具をDOMへ再描画する。もようがえモード中で選択中の家具には、反転・削除・前面へ・背面への操作ボタンを動的生成する。
         * @returns {void}
         */
        export function renderMyroomLayout() {
            const wallpaperItem = MYROOM_ITEMS.wallpaper.find(i => i.id === previewMyroom.wallpaper) || MYROOM_ITEMS.wallpaper[0];
            const flooringItem = MYROOM_ITEMS.flooring.find(i => i.id === previewMyroom.flooring) || MYROOM_ITEMS.flooring[0];
            document.getElementById('myroom-wallpaper-layer').src = wallpaperItem.img;
            document.getElementById('myroom-flooring-layer').src = flooringItem.img;

            const layer = document.getElementById('myroom-furniture-layer');
            layer.innerHTML = '';

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
                        flipBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top)}%; left:${Math.min(CONFIG.FLIP_BTN_LEFT_MAX_PCT, inst.left + item.width)}%; width:24px; height:24px; border-radius:50%; border:none; background:rgba(255,255,255,0.92); font-size:0.75rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                        flipBtn.onclick = (e) => { e.stopPropagation(); toggleMyroomInstanceFlip(cat, idx); };
                        layer.appendChild(flipBtn);
                    }
                    const delBtn = document.createElement('button');
                    delBtn.textContent = '✕';
                    delBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top - CONFIG.DEL_BTN_TOP_OFFSET_PCT)}%; left:${Math.max(0, inst.left - CONFIG.DEL_BTN_LEFT_OFFSET_PCT)}%; width:22px; height:22px; border-radius:50%; border:none; background:rgba(244,67,54,0.9); color:#fff; font-size:0.7rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                    delBtn.onclick = (e) => { e.stopPropagation(); removeMyroomInstance(cat, idx); };
                    layer.appendChild(delBtn);

                    const frontBtn = document.createElement('button');
                    frontBtn.textContent = '⬆️';
                    frontBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top + item.height - CONFIG.LAYER_BTN_HEIGHT_OFFSET_PCT)}%; left:${Math.min(CONFIG.LAYER_BTN_LEFT_MAX_PCT, inst.left + item.width)}%; width:22px; height:22px; border-radius:50%; border:none; background:rgba(255,255,255,0.92); font-size:0.65rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                    frontBtn.title = '前面へ';
                    frontBtn.onclick = (e) => { e.stopPropagation(); moveMyroomInstanceLayer(cat, idx, 1); };
                    layer.appendChild(frontBtn);

                    const backBtn = document.createElement('button');
                    backBtn.textContent = '⬇️';
                    backBtn.style.cssText = `position:absolute; top:${Math.max(0, inst.top + item.height)}%; left:${Math.min(CONFIG.LAYER_BTN_LEFT_MAX_PCT, inst.left + item.width)}%; width:22px; height:22px; border-radius:50%; border:none; background:rgba(255,255,255,0.92); font-size:0.65rem; z-index:100; box-shadow:0 2px 4px rgba(0,0,0,0.25); cursor:pointer;`;
                    backBtn.title = '背面へ';
                    backBtn.onclick = (e) => { e.stopPropagation(); moveMyroomInstanceLayer(cat, idx, -1); };
                    layer.appendChild(backBtn);
                });
            });
            setupMyroomFurnitureDrag();
        }
        // ⬆️⬇️ 家具の重なり順（前面・背面）を調整する
        /**
         * 指定した家具インスタンスのzIndexをdelta分増減させ、重なり順（前面/背面）を変更してから再描画する。
         * @param {string} cat - 家具のカテゴリ名
         * @param {number} idx - previewMyroom[cat]内のインデックス
         * @param {number} delta - zIndexの増減量
         * @returns {void}
         */
        export function moveMyroomInstanceLayer(cat, idx, delta) {
            const inst = previewMyroom[cat][idx];
            inst.zIndex = (inst.zIndex || 10) + delta;
            renderMyroomLayout();
        }
        // 🆕 家具を配置に追加する（上限あり）
        /**
         * 指定カテゴリに家具を1つ新規配置する。上限・所持数チェックの上、初期位置を計算して追加し、再描画・一覧クローズ・アイテム名ラベル表示まで行う。
         * @param {string} cat - 家具のカテゴリ名
         * @param {string} itemId - 配置するアイテムのID
         * @returns {void}
         */
        export function addMyroomInstance(cat, itemId) {
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
                    top = MYROOM_WALL_ZONE_BOTTOM - item.height + CONFIG.FLOOR_OVERLAP_EPSILON_PCT; // 床置き家具は、少しでも床に重なるよう強制する
                }
            }
            previewMyroom[cat].push({ itemId, top, left, flip: false });
            renderMyroomLayout();
            closeMyroomItemList();
            const label = document.getElementById('myroom-item-name-label');
            clearTimeout(myroomNameLabelTimeout);
            label.textContent = `${item.name}を置いたよ`;
            label.style.display = 'block';
            myroomNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, CONFIG.ITEM_NAME_LABEL_DURATION_MS);
        }
        /**
         * 指定インデックスの家具インスタンスを配置配列から削除し、選択状態をリセットして再描画する。一覧が開いていれば配置数表示も更新する。
         * @param {string} cat - 家具のカテゴリ名
         * @param {number} idx - previewMyroom[cat]内のインデックス
         * @returns {void}
         */
        export function removeMyroomInstance(cat, idx) {
            previewMyroom[cat].splice(idx, 1);
            selectedMyroomInstance = null; // インデックスがずれるため、選択状態はリセットする
            renderMyroomLayout();
            if (myroomCurrentCategory === cat) openMyroomCategory(cat);
        }
        /**
         * 指定家具インスタンスの左右反転フラグを反転させ、再描画する。
         * @param {string} cat - 家具のカテゴリ名
         * @param {number} idx - previewMyroom[cat]内のインデックス
         * @returns {void}
         */
        export function toggleMyroomInstanceFlip(cat, idx) {
            previewMyroom[cat][idx].flip = !previewMyroom[cat][idx].flip;
            renderMyroomLayout();
        }
        // 📍 配置済みの家具を、プレイヤーが直接ドラッグで動かせるようにする（恒久機能）
        /**
         * 配置済み家具をポインタドラッグで移動できるようにする恒久機能。もようがえモード中のみ動作し、壁掛けは壁ゾーン内、床置き家具は床にわずかに重なる範囲内に位置を制限する。
         * @returns {void}
         */
        export function setupMyroomFurnitureDrag() {
            const stage = document.getElementById('myroom-stage');
            if (stage.dataset.furnitureDragSetup) return;
            stage.dataset.furnitureDragSetup = '1';
            let dragState = null;
            stage.addEventListener('pointerdown', (e) => {
                if (!myroomIsEditMode) return; // 🎨 もようがえモード中だけ動かせる
                if (e.target.tagName === 'BUTTON') return; // 🐛修正：✕・🔄・⬆️⬇️ボタンを押した時、先に選択解除→再描画が走ってボタン自体が消え、押した処理が実行されなくなっていた
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
                    newTop = Math.max(-height * CONFIG.FURNITURE_DRAG_VERTICAL_OVERFLOW_RATIO, Math.min(100 - height * CONFIG.FURNITURE_DRAG_VISIBLE_RATIO, newTop));
                    newLeft = Math.max(-width * CONFIG.FURNITURE_DRAG_HORIZONTAL_OVERFLOW_RATIO, Math.min(100 - width * CONFIG.FURNITURE_DRAG_VISIBLE_RATIO, newLeft));
                    if (newTop + height <= MYROOM_WALL_ZONE_BOTTOM) {
                        newTop = MYROOM_WALL_ZONE_BOTTOM - height + CONFIG.FLOOR_OVERLAP_EPSILON_PCT; // ほんの少しだけ床に触れる位置まで押し下げる
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
        export let myroomSizeAdjustMode = false;
        export let myroomSizeAdjustDragState = null;
        // アイテムごとに調整できるよう、ドロップダウンの選択肢を動的に生成する
        /**
         * 開発者用サイズ調整ツールのドロップダウンに、もちすけ本体および全カテゴリ・全アイテムの選択肢を動的生成する。
         * @returns {void}
         */
        export function renderMyroomSizeAdjustOptions() {
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
        /**
         * サイズ調整ドロップダウンで現在選択中のカテゴリとアイテムオブジェクトを取得する（もちすけの場合はMYROOM_MOCHISUKE_SIZE）。
         * @returns {{cat: string, item: Object|null}} 選択中のカテゴリ名とアイテムオブジェクト
         */
        export function getMyroomSizeAdjustSelection() {
            const val = document.getElementById('myroom-size-adjust-target').value;
            const [cat, itemId] = val.split('__');
            if (cat === 'mochisuke') return { cat: 'mochisuke', item: MYROOM_MOCHISUKE_SIZE };
            return { cat, item: MYROOM_ITEMS[cat] ? MYROOM_ITEMS[cat].find(i => i.id === itemId) : null };
        }
        /**
         * 現在選択中の調整対象（もちすけ本体、またはプレビュー用家具画像）に対応するDOM要素を返す。
         * @returns {HTMLElement} 調整対象のDOM要素
         */
        export function getMyroomSizeAdjustTargetEl() {
            const { cat } = getMyroomSizeAdjustSelection();
            if (cat === 'mochisuke') return document.getElementById('myroom-mochisuke-breathe-wrap');
            return document.getElementById('myroom-size-preview-img');
        }
        /**
         * 開発者用の大きさ調整モードON/OFFを切り替える。ONならターゲットに点線アウトラインとリサイズハンドルを表示し、OFFなら消す。
         * @returns {void}
         */
        export function toggleMyroomSizeAdjustMode() {
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
        /**
         * サイズ調整対象のドロップダウンが変更された際に、既存アウトラインをクリアし、選択されたアイテムをプレビュー表示し、調整モード中ならハンドル位置・数値表示も更新する。
         * @returns {void}
         */
        export function onMyroomSizeAdjustTargetChange() {
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
        /**
         * 現在の調整対象の実際の表示矩形から、右・下・右下の3つのリサイズハンドルの位置(%)を計算してDOMに反映する。
         * @returns {void}
         */
        export function positionMyroomSizeHandles() {
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
        /**
         * 3つのリサイズハンドルのドラッグ操作を設定し、幅のみ・高さのみ・幅高さ同時のいずれかのモードでターゲット要素とMYROOM_ITEMS内の元データのwidth/heightを直接書き換える。
         * @returns {void}
         */
        export function setupMyroomSizeAdjustDrag() {
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
                        target.style.width = Math.max(CONFIG.SIZE_ADJUST_MIN_PCT, parseFloat(target.style.width) + dxPct) + '%';
                        item.width = parseFloat(target.style.width);
                    }
                } else {
                    if (mode === 'width' || mode === 'both') target.style.width = Math.max(CONFIG.SIZE_ADJUST_MIN_PCT, parseFloat(target.style.width) + dxPct) + '%';
                    if (mode === 'height' || mode === 'both') target.style.height = Math.max(CONFIG.SIZE_ADJUST_MIN_PCT, parseFloat(target.style.height) + dyPct) + '%';
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
        /**
         * 現在選択中アイテムのwidth（もちすけの場合はwidthのみ）/heightの数値をテキスト表示欄に反映する。
         * @returns {void}
         */
        export function updateMyroomSizeReadout() {
            const { cat, item } = getMyroomSizeAdjustSelection();
            const el = document.getElementById('myroom-size-adjust-readout');
            if (!item || !el) return;
            el.textContent = (cat === 'mochisuke') ? `width:${item.width}%;` : `width:${item.width}%; height:${item.height}%;`;
        }
        /**
         * もちすけおよび全家具アイテムの現在のwidth/height情報をテキスト化し、テキストエリアに表示・選択状態にし、可能ならクリップボードにもコピーする。
         * @returns {void}
         */
        export function copyMyroomSizeCoords() {
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
        export const MYROOM_CATEGORY_ORDER = ['wallpaper', 'flooring', 'wall_deco', 'big_furniture', 'table', 'small_deco'];
        export let myroomCurrentCategory = 'wallpaper';
        export let myroomItemListVisible = false; // アイテム一覧が今表示されているか
        /**
         * アイテム一覧（左右パネル）と配置数ラベルを非表示にし、表示フラグを下ろす。
         * @returns {void}
         */
        export function closeMyroomItemList() {
            myroomItemListVisible = false;
            document.getElementById('myroom-item-list-left').style.display = 'none';
            document.getElementById('myroom-item-list-right').style.display = 'none';
            const countLabel = document.getElementById('myroom-placed-count-label');
            if (countLabel) countLabel.style.display = 'none';
        }
        /**
         * 指定カテゴリのアイテム一覧を開閉・描画する。既に同カテゴリが開いていればトグルで閉じ、そうでなければ所持アイテムを50音順に並べ、左右パネルにセルを生成し、カテゴリボタンのハイライトも更新する。
         * @param {string} cat - 表示するカテゴリ名
         * @returns {void}
         */
        export function openMyroomCategory(cat) {
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
        export let myroomNameLabelTimeout = null;
        /**
         * 壁紙・床など単一装着系カテゴリのアイテムを装着（またはid=nullで解除）し、再描画・一覧の再表示・アイテム名ラベル表示を行う。
         * @param {string} cat - 対象カテゴリ名
         * @param {string|null} id - 装着するアイテムのID（nullで解除）
         * @returns {void}
         */
        export function equipMyroomItem(cat, id) {
            previewMyroom[cat] = id;
            renderMyroomLayout();
            openMyroomCategory(cat);
            const item = id ? MYROOM_ITEMS[cat].find(i => i.id === id) : null;
            const label = document.getElementById('myroom-item-name-label');
            clearTimeout(myroomNameLabelTimeout);
            label.textContent = item ? item.name : '外す';
            label.style.display = 'block';
            myroomNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, CONFIG.ITEM_NAME_LABEL_DURATION_MS);
        }
        // 🔀 最大3部屋まで持てる。切り替えパネル
        export let myroomSwitcherPreviewIndex = 0; // パネル内で＜＞で選んでいる番号（まだ確定していない）
        /**
         * 部屋切り替えパネルを開く。プレビュー中インデックスを現在の部屋に合わせ、表示を更新してオーバーレイを表示する。
         * @returns {void}
         */
        export function openMyroomSwitcher() {
            myroomSwitcherPreviewIndex = currentMyroomSlotIndex;
            updateMyroomSwitcherView();
            document.getElementById('myroom-switcher-overlay').style.display = 'flex';
        }
        /**
         * 部屋切り替えパネルのオーバーレイを非表示にする。
         * @returns {void}
         */
        export function closeMyroomSwitcher() {
            document.getElementById('myroom-switcher-overlay').style.display = 'none';
        }
        /**
         * 部屋切り替えパネル内で、＜＞ボタンによりプレビュー対象のスロット番号を3部屋の範囲でループ切り替えし、表示を更新する（まだ確定はしない）。
         * @param {number} delta - スロット番号の増減量（-1または1）
         * @returns {void}
         */
        export function switchMyroomSlotPreview(delta) {
            myroomSwitcherPreviewIndex = (myroomSwitcherPreviewIndex + delta + CONFIG.MYROOM_SLOT_COUNT) % CONFIG.MYROOM_SLOT_COUNT;
            updateMyroomSwitcherView();
        }
        /**
         * 部屋切り替えパネルのラベル文言（部屋番号・現在の部屋かどうか）とサムネイルプレビューを更新する。
         * @returns {void}
         */
        export function updateMyroomSwitcherView() {
            const isCurrent = myroomSwitcherPreviewIndex === currentMyroomSlotIndex;
            document.getElementById('myroom-switcher-label').textContent = `部屋${myroomSwitcherPreviewIndex + 1}${isCurrent ? '（今の部屋）' : ''}`;
            renderMyroomSwitcherThumbnail(myroomSwitcherPreviewIndex);
        }
        /**
         * 指定スロット番号の部屋のサムネイル（壁紙・床・配置家具）をHTML文字列で組み立てて表示する。現在編集中のスロットなら保存前のpreviewMyroomを、それ以外は保存済みのmyroomSlotsを参照する。
         * @param {number} slotIndex - 表示するスロット番号
         * @returns {void}
         */
        export function renderMyroomSwitcherThumbnail(slotIndex) {
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
        /**
         * 部屋切り替えを実行する。編集中の部屋を現在のスロットに保存してから、選択したスロットへ切り替え、未作成ならデフォルト状態で新規作成し、previewMyroomとequippedMyroomを更新、保存してパネルを閉じる。
         * @returns {void}
         */
        export function confirmMyroomSlotSwitch() {
            if (myroomSwitcherPreviewIndex === currentMyroomSlotIndex) { closeMyroomSwitcher(); return; }
            // 今編集中の部屋を、抜ける前にスロットへ保存しておく
            myroomSlots[currentMyroomSlotIndex] = JSON.parse(JSON.stringify(previewMyroom));
            setCurrentMyroomSlotIndex(myroomSwitcherPreviewIndex);
            if (!myroomSlots[currentMyroomSlotIndex]) {
                // 新規部屋は、デフォルトの壁紙・床だけの状態で作る
                myroomSlots[currentMyroomSlotIndex] = {
                    wallpaper: 'wallpaper_default', flooring: 'flooring_default',
                    wall_deco: [], big_furniture: [], table: [], small_deco: [],
                };
            }
            previewMyroom = JSON.parse(JSON.stringify(myroomSlots[currentMyroomSlotIndex]));
            setEquippedMyroom(JSON.parse(JSON.stringify(myroomSlots[currentMyroomSlotIndex])));
            selectedMyroomInstance = null;
            renderMyroomLayout();
            saveGame();
            closeMyroomSwitcher();
        }
        /**
         * 現在編集中のプレビュー内容を正式にequippedMyroomとして確定・保存し、決定ボタンの文言を一時的に「決定しました！」に変えてから元に戻す。
         * @returns {void}
         */
        export function confirmMyroomLayout() {
            setEquippedMyroom(JSON.parse(JSON.stringify(previewMyroom))); // 配列(家具配置)も含めて完全に独立させる
            saveGame();
            const btn = document.getElementById('myroom-confirm-btn');
            const original = btn.innerText;
            btn.innerText = '✅ 決定しました！';
            setTimeout(() => { btn.innerText = original; }, CONFIG.CONFIRM_BTN_MESSAGE_DURATION_MS);
        }
        // 🌐 「決定」とは別に、実際にランキング・フレンドから見られるようにするには「公開する」を押す必要がある
        /**
         * 確認ダイアログの後、現在の部屋をequippedMyroomとして確定保存し、window.submitMyroomDataが存在すればそれを呼び出して外部へ公開する。
         * @returns {void}
         */
        export function onPublishMyroomTap() {
            if (!confirm('この部屋を公開しますか？\nランキング・フレンドから見られるようになります。')) return;
            setEquippedMyroom(JSON.parse(JSON.stringify(previewMyroom))); // 公開時点の内容を、決定扱いにもしておく
            saveGame();
            if (window.submitMyroomData) {
                window.submitMyroomData(equippedMyroom);
                alert('🌐 部屋を公開しました！');
            }
        }

        /**
         * 倉庫（おみやげコレクション）画面を開く。購入済みステージ数のバッジを更新し、倉庫アイテム一覧を描画し、モーダル表示と専用BGM再生を行う。
         * @returns {void}
         */
        export function openWarehouse() {
            let boughtCount = 0;
            stages.forEach((s, idx) => { if((purchasedItems[idx] || 0) > 0) boughtCount++; });
            const badge = document.getElementById('warehouse-omiyage-badge');
            if (badge) badge.textContent = `${boughtCount}/${stages.length}`;
            renderWarehouseItems();
            openModal('warehouse-modal');
            playBgmLoop('audio/bgm/bgm_warehouse.mp3');
        }

        // 🎫 ガチャで手に入れたチケットの一覧。個数を確認しながら、好きなタイミングで使える
        /**
         * 所持チケット・スプレー類の一覧画面を開く。各アイテムの所持数・使用ボタンを生成し、スプレーは効果時間中かどうかで表示を切り替える。
         * @returns {void}
         */
        export function openTicketInventory() {
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
                    const hoursLeft = Math.ceil((sprayBuffActiveUntil - Date.now()) / CONFIG.MS_PER_HOUR);
                    btnHtml = `<button class="item-action-btn" disabled style="background:#bbb; color:#fff;">効果中(残り${hoursLeft}h)</button>`;
                } else {
                    btnHtml = `<button class="item-action-btn btn-shop" ${count > 0 ? '' : 'disabled'} onclick="useSpray('${item.id}')" style="background:#e91e63; color:white;">使う</button>`;
                }
                row.innerHTML = `<div class="item-info-row"><div class="item-thumb" style="display:flex; align-items:center; justify-content:center; font-size:1.6rem;">${emoji}</div><div class="item-info"><span class="item-title">✨ ${item.name}　<span style="color:#ff9800; font-weight:900;">×${count}</span></span><span class="item-desc">${item.desc}</span></div></div>${btnHtml}`;
                list.appendChild(row);
            });
            openModal('ticket-inventory-modal');
        }


        // window橋渡し：ここから下は、index.htmlのonclick=""（静的または動的に生成される
        // 文字列の両方）から直接呼ばれる関数を中心に、window経由のアクセスがまだ必要なものをまとめている。
        // ブラウザはonclick="foo()"の実行時にwindow.fooを探すため、橋渡しが無いとボタンを押しても
        // 静かに何も起きない（実際にこれで一度事故を起こした。解体新書 第9章参照）。削除する時は、
        // 他ファイルからのimport参照・index.html内の静的onclick・動的に組み立てられるonclick文字列の
        // 3経路すべてを確認すること。
        Object.defineProperty(window, 'myroomIsEditMode', { configurable: true, get: () => myroomIsEditMode, set: (v) => { myroomIsEditMode = v; } });
        window.openMyRoomEntry = openMyRoomEntry;
        window.toggleMyroomEditMode = toggleMyroomEditMode;
        window.closeMyRoom = closeMyRoom;
        window.toggleMyroomSizeAdjustMode = toggleMyroomSizeAdjustMode;
        window.onMyroomSizeAdjustTargetChange = onMyroomSizeAdjustTargetChange;
        window.copyMyroomSizeCoords = copyMyroomSizeCoords;
        window.openMyroomCategory = openMyroomCategory;
        window.openMyroomSwitcher = openMyroomSwitcher;
        window.closeMyroomSwitcher = closeMyroomSwitcher;
        window.switchMyroomSlotPreview = switchMyroomSlotPreview;
        window.confirmMyroomSlotSwitch = confirmMyroomSlotSwitch;
        window.confirmMyroomLayout = confirmMyroomLayout;
        window.onPublishMyroomTap = onPublishMyroomTap;
        window.openWarehouse = openWarehouse;
