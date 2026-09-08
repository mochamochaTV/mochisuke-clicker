        // ===================================================================
        // ui.js から分割されたファイルです（着せ替え部屋（コーデ装備・羽ばたき等の演出・調整ツール））。
        // 元々は1つの巨大な ui.js（4000行超）にすべて入っていましたが、見通しを良くするため
        // 機能ごとに src/ui/ 以下のファイルへ分割しました。ui.js 自身は今、この下の7ファイルを
        // まとめて re-export するだけの「窓口」になっています（他のファイルからの
        // import { X } from './ui.js' は今まで通りそのまま動きます）。
        // ===================================================================

        import { DEFAULT_MOUTH_POSITION, KISEKAE_CATEGORY_LABELS, KISEKAE_ITEMS, MYROOM_MOCHISUKE_SIZE } from '../../data.js?v=2026-09-08-005';
        import { IS_DEV_MODE, playAudioFile } from '../../main.js?v=2026-09-08-005';
        import { equippedKisekae, ownedKisekaeItems, previewKisekae, setEquippedKisekae, setPreviewKisekae } from '../../progress.js?v=2026-09-08-005';
        import { setActiveSprayId, setSprayBuffActiveUntil, sprayInventory } from '../../shop.js?v=2026-09-08-005';
        import { saveGame } from '../../state.js?v=2026-09-08-005';
        import { closeModal, openModal } from './core.js?v=2026-09-08-005';
        import { openTicketInventory } from './myroom.js?v=2026-09-08-005';
        import { updateDisplay, updateSprayEffectDisplay } from './hud.js?v=2026-09-08-005';

        // ✨ スプレーを使う：1日だけ自動増加バフ＋見た目エフェクトが有効になる
        export function useSpray(itemId) {
            if ((sprayInventory[itemId] || 0) <= 0) return;
            sprayInventory[itemId]--;
            setActiveSprayId(itemId);
            setSprayBuffActiveUntil(Date.now() + 24 * 60 * 60 * 1000);
            saveGame(); updateDisplay(); updateSprayEffectDisplay();
            openTicketInventory(); // 一覧を開いている場合、表示を更新する
        }
        window.useSpray = useSpray; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        // ===================================================================
        // 👗 着せ替え部屋
        // ===================================================================
        export function openKisekaeRoom() {
            openModal('kisekae-room-modal'); // タップ音のみでOK、フェード・移動音は不要
            setPreviewKisekae({ ...equippedKisekae }); // 確定済みの状態から、試着用のコピーを作る
            renderKisekaeMochisuke();
            openKisekaeCategory('clothes');
        }
        export function closeKisekaeRoom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('kisekae-room-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }

        // 着せ替え部屋のもちすけと、通常のタップ画面のもちすけ、両方に今の装着状態を反映する
        export function renderKisekaeMochisuke() {
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
        export let wingFlapTimers = { room: null, main: null };
        export let wingFlapFrameIndex = { room: 0, main: 0 };
        export let WING_FLAP_INTERVAL_MS = 130; // 8コマ ×130ms ≒ 1040msで1周（実機調整パネルから変更できる）
        // 🚧 速度が確定したので、いったんパネルを非表示にしている。また使う時は true に戻すだけでOK
        export const WING_SPEED_TOOL_ENABLED = false;
        export let WING_FLAP_VOLUME = 0.1; // 羽ばたき音の音量（0〜1）。実機調整パネルから変更できる
        // 🚧 音量が確定したので、いったんパネルを非表示にしている。また使う時は true に戻すだけでOK
        export const WING_VOLUME_TOOL_ENABLED = false;
        export function adjustWingFlapVolume(delta) {
            WING_FLAP_VOLUME = Math.max(0, Math.min(1, Math.round((WING_FLAP_VOLUME + delta) * 10) / 10));
            document.getElementById('wing-flap-volume-readout').textContent = WING_FLAP_VOLUME.toFixed(1);
            playAudioFile('audio/kisekae/wing_flap.mp3', WING_FLAP_VOLUME); // 押した音量でその場で試し鳴らしする
        }
        export function copyWingFlapVolume() {
            const text = `羽ばたき音量: ${WING_FLAP_VOLUME}`;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
            alert(`コピーしました\n${text}`);
        }
        // タップ画面('main')・着せ替え部屋('room')・マイルーム('myroom')、それぞれの要素IDプレフィックスを解決する
        export function kisekaeElPrefix(target) {
            if (target === 'room') return 'kisekae-mochisuke';
            if (target === 'myroom') return 'myroom-mochisuke';
            return 'mochisuke';
        }
        export function updateKisekaeWingDisplay(target, backId) {
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
        export function applyWingFrame(leftEl, rightEl, item, frameIdx) {
            leftEl.src = item.leftFrames[frameIdx];
            rightEl.src = item.rightFrames[frameIdx];
            const lp = item.leftFramePos[frameIdx], rp = item.rightFramePos[frameIdx];
            leftEl.style.top = lp.top + '%'; leftEl.style.left = lp.left + '%';
            rightEl.style.top = rp.top + '%'; rightEl.style.left = rp.left + '%';
        }
        // 🐹 もちすけが実際に見えている画面（タップ画面 or 着せ替え部屋）かどうかを判定する
        export function isMochisukeVisible() {
            const kisekaeModal = document.getElementById('kisekae-room-modal');
            const isKisekaeOpen = kisekaeModal && kisekaeModal.style.display === 'flex';
            const isAnyModalOpen = document.body.classList.contains('modal-open');
            return isKisekaeOpen || !isAnyModalOpen;
        }
        export function startWingFlapLoop(target, item) {
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
        export function stopWingFlapLoop(target) {
            if (wingFlapTimers[target]) clearInterval(wingFlapTimers[target]);
            wingFlapTimers[target] = null;
        }

        // 🚧 通常のタップ画面にも反映する。服については、既存の「衣装（きせかえタブ）」システムと
        // 見た目の適用先が重なるため、しばらくは「後から呼ばれた方が勝つ」形で共存させている
        // 🎩💨 叫んだ勢いで、帽子・顔パーツが吹っ飛んでいく（服だけは1枚絵の都合で諦めて、初期衣装に戻る）
        export function flyOffKisekaeOverlays() {
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
        export function flyBackKisekaeOverlays() {
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

        export function applyKisekaeToMainScreen() {
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
        export function applyKisekaeToMyroom() {
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

        export let kisekaeCurrentCategory = 'clothes';
        // カテゴリを開いて、名前順・Zの字並びで左右にアイテムを並べる
        // 🛠️ 開発者用：翼の羽ばたき速度を実機で調整する（位置調整パネルとは独立して、常に使える）
        export function adjustWingFlapSpeed(delta) {
            WING_FLAP_INTERVAL_MS = Math.max(20, WING_FLAP_INTERVAL_MS + delta);
            document.getElementById('wing-flap-speed-readout').textContent = WING_FLAP_INTERVAL_MS + 'ms';
            // 今表示中の翼があれば、新しい速度ですぐ再スタートして確認できるようにする
            const backId = previewKisekae.back;
            if (backId) {
                const item = KISEKAE_ITEMS.back.find(i => i.id === backId);
                if (item) startWingFlapLoop('room', item);
            }
        }
        export function copyWingFlapSpeed() {
            const text = `羽ばたき速度: ${WING_FLAP_INTERVAL_MS}ms`;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
            alert(`コピーしました\n${text}`);
        }
        export function openKisekaeCategory(cat) {
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

        export let kisekaeNameLabelTimeout = null;
        export function showKisekaeItemNameLabel(name) {
            const label = document.getElementById('kisekae-item-name-label');
            if (!label) return;
            clearTimeout(kisekaeNameLabelTimeout);
            label.textContent = name;
            label.style.display = 'block';
            kisekaeNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, 2200);
        }
        export function equipKisekaeItem(cat, id) {
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
        export function confirmKisekaeOutfit() {
            setEquippedKisekae({ ...previewKisekae });
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
        export let kisekaeAdjustMode = false;
        export let kisekaeAdjustDragState = null;
        // 選択中の対象を解決する：通常のhat/faceか、backカテゴリの左右どちらの翼か
        export function resolveKisekaeAdjustTarget() {
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
        export function syncMirroredRightWing(resolved, posObj, sizeObj) {
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
        export function getKisekaeAdjustRefs(resolved) {
            if (resolved.side) {
                const posArr = resolved.item[resolved.side + 'FramePos'];
                return { posObj: posArr[resolved.frameIdx], sizeObj: resolved.item };
            }
            return { posObj: resolved.item, sizeObj: resolved.item };
        }
        export function getKisekaeAdjustTargetEl() {
            return resolveKisekaeAdjustTarget().el;
        }
        // 🚧 座標が一通り確定したので、いったんパネルを非表示にしている。また使う時は true に戻すだけでOK
        export const KISEKAE_ADJUST_TOOL_ENABLED = false;
        export function renderKisekaeAdjustPanel(cat) {
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
        export function renderWingGhostFrames(item, activeFrameIdx) {
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
        export function clearWingGhostFrames() {
            document.querySelectorAll('.wing-ghost-frame').forEach(el => el.remove());
        }
        export function toggleKisekaeAdjustMode() {
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
        export function onKisekaeAdjustTargetChange() {
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
        export function positionKisekaeHandles() {
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
        export function setupKisekaeAdjustDrag() {
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
        export function adjustKisekaeFaceRotation(delta) {
            const val = document.getElementById('kisekae-adjust-target').value;
            const item = KISEKAE_ITEMS.face.find(i => i.id === val);
            if (!item) return;
            item.rotation = (item.rotation || 0) + delta;
            const target = getKisekaeAdjustTargetEl();
            target.style.transform = `rotate(${item.rotation}deg)`;
            updateKisekaeAdjustReadout();
        }
        export function updateKisekaeAdjustReadout() {
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
        export function copyAllKisekaeCoords() {
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
        window.openKisekaeRoom = openKisekaeRoom;
        window.closeKisekaeRoom = closeKisekaeRoom;
        window.adjustWingFlapVolume = adjustWingFlapVolume;
        window.copyWingFlapVolume = copyWingFlapVolume;
        window.adjustWingFlapSpeed = adjustWingFlapSpeed;
        window.copyWingFlapSpeed = copyWingFlapSpeed;
        window.openKisekaeCategory = openKisekaeCategory;
        window.confirmKisekaeOutfit = confirmKisekaeOutfit;
        window.toggleKisekaeAdjustMode = toggleKisekaeAdjustMode;
        window.onKisekaeAdjustTargetChange = onKisekaeAdjustTargetChange;
        window.adjustKisekaeFaceRotation = adjustKisekaeFaceRotation;
        window.copyAllKisekaeCoords = copyAllKisekaeCoords;
