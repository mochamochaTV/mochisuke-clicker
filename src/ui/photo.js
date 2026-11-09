        // photo.js：記念写真（撮影画面・アルバム）を担当するファイル。ui.js の窓口から読み込まれる。
        // 写真は画像ではなく「作り方のデータ（レシピ）」として保存し、見る時に canvas で描き直す。
        // （画像そのものを保存すると、47県ぶんでセーブデータが数MBになってしまう。レシピなら全部で数十KBで済む。
        //   後で公開機能を作る時も、このレシピを送れば相手の端末で同じ写真を描ける）

        import { stages } from '../../data.js?v=2026-10-13-001';
        import { playAudioFile } from '../../main.js?v=2026-10-13-001';
        import { currentStageIndex, selectedStageIndex } from '../../progress.js?v=2026-10-13-001';
        import { saveGame } from '../../state.js?v=2026-10-13-001';
        import { closeModal, isTutorialActive, openModal, showMochiComment } from './core.js?v=2026-10-13-001';

        // 🔧 このファイル内で使う数値の設定
        const CONFIG = {
            PHOTO_WIDTH_PX: 720,    // 大きく見る時・端末に保存する時の写真の横幅
            THUMB_WIDTH_PX: 240,    // アルバムの一覧に並べる小さい写真の横幅
            SCALE_MIN: 0.5,         // 大きさスライダーの最小（撮影画面を開いた時の大きさを1とする）
            SCALE_MAX: 2.5,         // 大きさスライダーの最大
            ROTATE_MAX_DEG: 45,     // 傾きスライダーの範囲（左右それぞれ、度）
            FLASH_MS: 250,          // シャッターを押した時の白い光の長さ
        };

        export let photoAlbum = {};   // 県の番号 → 写真のレシピ（1県1枚）。state.js がセーブ・ロードする
        export let photoDraft = null; // 撮影画面で調整中の写真のレシピ
        export let photoBaseWidth = 0; // 撮影画面を開いた時の、もちすけの横幅（画面幅に対する割合）。大きさ1倍の基準
        export let photoStartMochi = null; // 撮影画面を開いた時の、もちすけの位置・大きさ・傾き・向き（「戻す」ボタン用）
        export let photoStageW = 0;   // 撮影画面の幅(px)
        export let photoStageH = 0;   // 撮影画面の高さ(px)
        export let photoViewerCanvas = null; // 写真を大きく見ている時の canvas（端末に保存する時に使う）

        // ===================================================================
        // 📷 撮影画面
        // ===================================================================

        /**
         * 撮影画面を開く。ホーム画面の背景と、今の見た目のもちすけをそのまま持ってくる。
         * @returns {void}
         */
        export function openPhotoMode() {
            if (isTutorialActive) return;
            // 記念写真は、今旅している県でだけ撮れる（地図で前の県に飛んでいる時は撮れない）
            // ../../progress.js: currentStageIndex：旅で到達している県の番号、selectedStageIndex：今画面に表示している県の番号
            if (selectedStageIndex !== currentStageIndex) {
                // ./core.js の showMochiComment()：もちすけにセリフを話させる
                showMochiComment(`記念写真は、今旅している${stages[currentStageIndex].name}で撮れるで！`);
                return;
            }
            const screen = document.getElementById('game-screen').getBoundingClientRect();
            const mochi = measureMochisuke(screen);
            if (!mochi) return;

            photoBaseWidth = mochi.w;
            photoStageW = screen.width;
            photoStageH = screen.height;
            photoDraft = {
                stage: currentStageIndex,
                aspect: screen.height / screen.width, // 写真の縦横比（ホーム画面と同じ）
                mochi: { cx: mochi.cx, cy: mochi.cy, w: mochi.w, ar: mochi.ar, rot: 0, flip: false },
                layers: mochi.layers,
            };
            photoStartMochi = { ...photoDraft.mochi };

            // 撮影画面を、ホーム画面と同じ位置・大きさに重ねる（開いた瞬間に、もちすけが同じ場所にいるように見える）
            const stage = document.getElementById('photo-stage');
            stage.style.left = screen.left + 'px';
            stage.style.top = screen.top + 'px';
            stage.style.width = screen.width + 'px';
            stage.style.height = screen.height + 'px';
            // data.js: stages[番号].bg：その県の背景画像
            stage.style.backgroundImage = `url('${stages[currentStageIndex].bg}')`;
            document.getElementById('photo-place-label').innerText = `📍 ${stages[currentStageIndex].name}`;

            // スライダーの範囲と初期値を、上の CONFIG に合わせる
            const scaleSlider = document.getElementById('photo-scale-slider');
            scaleSlider.min = CONFIG.SCALE_MIN; scaleSlider.max = CONFIG.SCALE_MAX; scaleSlider.value = 1;
            const rotateSlider = document.getElementById('photo-rotate-slider');
            rotateSlider.min = -CONFIG.ROTATE_MAX_DEG; rotateSlider.max = CONFIG.ROTATE_MAX_DEG; rotateSlider.value = 0;

            buildPhotoMochi();
            // ./core.js の openModal()：画面（モーダル）を開く
            openModal('photo-modal');
        }

        /**
         * 撮影画面を閉じる。
         * @returns {void}
         */
        export function closePhotoMode() {
            closePhotoModal('photo-modal');
        }

        /**
         * ホーム画面のもちすけの「見えている画像」を全部測って、レシピ用の重ね順・位置のリストにする。
         * （服・帽子・顔パーツ・羽・口などが別々の画像なので、1枚ずつ位置と大きさを記録する）
         * @param {DOMRect} screen - ホーム画面（#game-screen）の位置と大きさ
         * @returns {Object|null} {cx, cy, w, ar, layers}（位置・大きさはホーム画面に対する割合）
         */
        export function measureMochisuke(screen) {
            const frame = document.getElementById('mochisuke-img-frame');
            const breathe = document.getElementById('mochisuke-breathe-wrap');
            // 呼吸アニメで伸び縮みしている途中の形を測らないよう、測る間だけ止める
            const hadBreathe = breathe.classList.contains('breathe-idle');
            breathe.classList.remove('breathe-idle');
            void frame.offsetWidth; // 止めた状態で位置を計算し直させる

            const fr = frame.getBoundingClientRect();
            const layers = [];
            if (fr.width > 0 && fr.height > 0) {
                frame.querySelectorAll('img').forEach((img, order) => {
                    const cs = getComputedStyle(img);
                    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return; // 隠れている画像は写さない
                    if (!img.complete || img.naturalWidth === 0) return; // まだ読み込めていない画像も写さない
                    let r = img.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) return;
                    // object-fit:contain の画像（ロボなど）は、枠いっぱいではなく実際に絵がある部分だけを使う
                    if (cs.objectFit === 'contain') r = getContainRect(r, img.naturalWidth, img.naturalHeight);
                    layers.push({
                        src: img.getAttribute('src'),
                        x: (r.left - fr.left) / fr.width, y: (r.top - fr.top) / fr.height,
                        w: r.width / fr.width, h: r.height / fr.height,
                        z: getLayerZIndex(img, frame), order,
                    });
                });
            }
            if (hadBreathe) breathe.classList.add('breathe-idle');
            if (layers.length === 0) return null;

            // 重なり順（z-index）の小さい順に並べる。同じなら、HTMLに書かれている順
            layers.sort((a, b) => a.z - b.z || a.order - b.order);
            return {
                cx: (fr.left + fr.width / 2 - screen.left) / screen.width,
                cy: (fr.top + fr.height / 2 - screen.top) / screen.height,
                w: fr.width / screen.width,
                ar: fr.height / fr.width,
                layers: layers.map(({ src, x, y, w, h }) => ({ src, x, y, w, h })),
            };
        }

        /**
         * 要素の重なり順（自分か親の z-index のうち、一番近いもの）を返す。
         * @param {Element} el - 調べる要素
         * @param {Element} stopAt - ここまで親をたどったら止める
         * @returns {number} z-index（指定が無ければ0）
         */
        export function getLayerZIndex(el, stopAt) {
            for (let node = el; node && node !== stopAt; node = node.parentElement) {
                const z = getComputedStyle(node).zIndex;
                if (z !== 'auto') return parseInt(z, 10) || 0;
            }
            return 0;
        }

        /**
         * object-fit:contain で表示されている画像の、実際に絵が描かれている範囲を返す。
         * @param {DOMRect} r - 画像の枠
         * @param {number} nw - 画像本来の幅
         * @param {number} nh - 画像本来の高さ
         * @returns {Object} {left, top, width, height}
         */
        export function getContainRect(r, nw, nh) {
            const scale = Math.min(r.width / nw, r.height / nh);
            const width = nw * scale, height = nh * scale;
            return { left: r.left + (r.width - width) / 2, top: r.top + (r.height - height) / 2, width, height };
        }

        /**
         * 撮影画面のもちすけを、レシピの画像リストから組み立てる。
         * @returns {void}
         */
        export function buildPhotoMochi() {
            const box = document.getElementById('photo-mochi');
            box.innerHTML = '';
            photoDraft.layers.forEach(l => {
                const img = document.createElement('img');
                img.src = l.src;
                img.draggable = false;
                img.style.cssText = `position:absolute; left:${l.x * 100}%; top:${l.y * 100}%; width:${l.w * 100}%; height:${l.h * 100}%; pointer-events:none;`;
                box.appendChild(img);
            });
            applyPhotoMochiTransform();
        }

        /**
         * 撮影画面のもちすけに、今の位置・大きさ・傾き・反転を反映する。
         * @returns {void}
         */
        export function applyPhotoMochiTransform() {
            const m = photoDraft.mochi;
            const box = document.getElementById('photo-mochi');
            const w = m.w * photoStageW;
            box.style.width = w + 'px';
            box.style.height = (w * m.ar) + 'px';
            box.style.left = (m.cx * photoStageW) + 'px';
            box.style.top = (m.cy * photoStageH) + 'px';
            // 中心を基準に「傾ける → 反転する」。canvas で描き直す時（renderPhoto）も同じ順番にしている
            box.style.transform = `translate(-50%, -50%) rotate(${m.rot}deg) scaleX(${m.flip ? -1 : 1})`;
        }

        /**
         * 大きさスライダーを動かした時の処理。
         * @param {string} value - スライダーの値（1が撮影画面を開いた時の大きさ）
         * @returns {void}
         */
        export function onPhotoScaleInput(value) {
            photoDraft.mochi.w = photoBaseWidth * parseFloat(value);
            applyPhotoMochiTransform();
        }

        /**
         * 傾きスライダーを動かした時の処理。
         * @param {string} value - スライダーの値（度）
         * @returns {void}
         */
        export function onPhotoRotateInput(value) {
            photoDraft.mochi.rot = parseFloat(value);
            applyPhotoMochiTransform();
        }

        /**
         * もちすけの向きを左右反転する。
         * @returns {void}
         */
        export function togglePhotoFlip() {
            photoDraft.mochi.flip = !photoDraft.mochi.flip;
            applyPhotoMochiTransform();
        }

        /**
         * もちすけの位置・大きさ・傾き・向きを、撮影画面を開いた時の状態に戻す。
         * @returns {void}
         */
        export function resetPhotoPose() {
            photoDraft.mochi = { ...photoStartMochi };
            document.getElementById('photo-scale-slider').value = 1;
            document.getElementById('photo-rotate-slider').value = 0;
            applyPhotoMochiTransform();
        }

        // もちすけをドラッグして動かす（指を置いた位置からの移動量だけ、中心をずらす）
        export let photoDrag = null;
        const photoMochiEl = document.getElementById('photo-mochi');
        photoMochiEl.addEventListener('pointerdown', (e) => {
            if (!photoDraft) return;
            photoDrag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, cx: photoDraft.mochi.cx, cy: photoDraft.mochi.cy };
            photoMochiEl.setPointerCapture(e.pointerId); // 指がもちすけの外に出ても、離すまで追いかける
            e.preventDefault();
        });
        photoMochiEl.addEventListener('pointermove', (e) => {
            if (!photoDrag || e.pointerId !== photoDrag.id) return;
            // 画面の外に出ていかないよう、中心は画面内(0〜1)に収める
            photoDraft.mochi.cx = Math.min(1, Math.max(0, photoDrag.cx + (e.clientX - photoDrag.startX) / photoStageW));
            photoDraft.mochi.cy = Math.min(1, Math.max(0, photoDrag.cy + (e.clientY - photoDrag.startY) / photoStageH));
            applyPhotoMochiTransform();
        });
        const endPhotoDrag = (e) => { if (photoDrag && e.pointerId === photoDrag.id) photoDrag = null; };
        photoMochiEl.addEventListener('pointerup', endPhotoDrag);
        photoMochiEl.addEventListener('pointercancel', endPhotoDrag);

        /**
         * シャッター：今の構図をレシピとしてアルバムに保存する（1県1枚。もうあれば撮り直しの確認をする）。
         * @returns {void}
         */
        export function takePhoto() {
            const idx = photoDraft.stage;
            if (photoAlbum[idx] && !confirm(`${stages[idx].name}の写真はもうあるで。撮り直すと、前の写真は消えるけどええか？`)) return;
            photoAlbum[idx] = { ...JSON.parse(JSON.stringify(photoDraft)), takenAt: Date.now() };
            // ../../state.js の saveGame()：アルバムも含めて今の状態をセーブする
            saveGame();

            // 白く光らせてから、撮った写真を大きく見せる
            // ../../main.js の playAudioFile()：効果音を鳴らす
            playAudioFile('audio/stamp.mp3');
            const flash = document.getElementById('photo-flash');
            flash.classList.add('show');
            setTimeout(() => {
                flash.classList.remove('show');
                closePhotoModal('photo-modal');
                openPhotoViewer(idx, true);
            }, CONFIG.FLASH_MS);
        }

        // ===================================================================
        // 🖼️ レシピから写真を描く
        // ===================================================================

        // 一度読み込んだ画像は使い回す（アルバムで何枚も描く時に、同じ背景や服を何度も読み込まないように）
        const photoImageCache = {};
        /**
         * 画像を読み込む（読み込めなかった時は null を返す）。
         * @param {string} src - 画像のパス
         * @returns {Promise<HTMLImageElement|null>}
         */
        export function loadPhotoImage(src) {
            if (!photoImageCache[src]) {
                photoImageCache[src] = new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = src;
                });
            }
            return photoImageCache[src];
        }

        /**
         * 写真のレシピを canvas に描く（背景 → もちすけの画像を下から順に）。
         * @param {Object} recipe - 写真のレシピ
         * @param {number} width - 描く横幅(px)。高さはレシピの縦横比から決まる
         * @returns {Promise<HTMLCanvasElement>}
         */
        export async function renderPhoto(recipe, width) {
            const W = width, H = Math.round(width * recipe.aspect);
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext('2d');
            const [bg, ...layerImgs] = await Promise.all([
                loadPhotoImage(stages[recipe.stage].bg),
                ...recipe.layers.map(l => loadPhotoImage(l.src)),
            ]);

            // 背景：画面いっぱいに、はみ出す分は切り落とす（ホーム画面の background-size: cover と同じ）
            if (bg) {
                const s = Math.max(W / bg.width, H / bg.height);
                ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
            }

            // もちすけ：中心へ移動 → 傾ける → 反転、の順（撮影画面の applyPhotoMochiTransform と同じ順番）
            const m = recipe.mochi;
            const boxW = m.w * W, boxH = boxW * m.ar;
            ctx.save();
            ctx.translate(m.cx * W, m.cy * H);
            ctx.rotate(m.rot * Math.PI / 180);
            ctx.scale(m.flip ? -1 : 1, 1);
            recipe.layers.forEach((l, i) => {
                if (!layerImgs[i]) return;
                ctx.drawImage(layerImgs[i], -boxW / 2 + l.x * boxW, -boxH / 2 + l.y * boxH, l.w * boxW, l.h * boxH);
            });
            ctx.restore();
            return canvas;
        }

        // ===================================================================
        // 📖 アルバム
        // ===================================================================

        /**
         * アルバムを開く。47県のマスを並べ、撮った県には写真、行った県には「まだ」、まだ行っていない県には「？？？」を出す。
         * @returns {void}
         */
        export function openAlbum() {
            openModal('album-modal');
            const grid = document.getElementById('album-grid');
            grid.innerHTML = '';
            document.getElementById('album-count').innerText = `📷 ${Object.keys(photoAlbum).length} / ${stages.length} 県`;

            stages.forEach((stage, idx) => {
                const visited = idx <= currentStageIndex;
                const photo = photoAlbum[idx];
                const card = document.createElement('div');
                card.className = 'album-card' + (photo ? ' has-photo' : '');
                card.innerHTML = `<div class="album-thumb">${photo ? '' : (visited ? '📷<br>まだ' : '❔')}</div>`
                    + `<div class="album-name">${visited ? stage.name : '？？？'}</div>`;
                if (photo) {
                    card.addEventListener('click', () => openPhotoViewer(idx, false));
                    // 小さい写真は、描けたものから順に差し込む
                    renderPhoto(photo, CONFIG.THUMB_WIDTH_PX).then(c => {
                        const img = document.createElement('img');
                        img.src = c.toDataURL('image/jpeg', 0.85);
                        card.querySelector('.album-thumb').appendChild(img);
                    });
                }
                grid.appendChild(card);
            });
        }

        /**
         * アルバムを閉じる。
         * @returns {void}
         */
        export function closeAlbum() {
            closePhotoModal('album-modal');
        }

        /**
         * 1枚の写真を大きく見る画面を開く。
         * @param {number} idx - 県の番号
         * @param {boolean} justTaken - 撮った直後ならtrue（見出しを「貼ったで！」にする）
         * @returns {Promise<void>}
         */
        export async function openPhotoViewer(idx, justTaken) {
            const photo = photoAlbum[idx];
            if (!photo) return;
            const name = stages[idx].name;
            document.getElementById('photo-viewer-title').innerText = justTaken ? `📖 アルバムの「${name}」のページに貼ったで！` : `📍 ${name}`;
            document.getElementById('photo-viewer-date').innerText = new Date(photo.takenAt).toLocaleDateString('ja-JP') + ' 撮影';
            const img = document.getElementById('photo-viewer-img');
            img.removeAttribute('src');
            photoViewerCanvas = null;
            openModal('photo-viewer-modal');
            photoViewerCanvas = await renderPhoto(photo, CONFIG.PHOTO_WIDTH_PX);
            img.src = photoViewerCanvas.toDataURL('image/jpeg', 0.9);
        }

        /**
         * 写真を大きく見る画面を閉じる。
         * @returns {void}
         */
        export function closePhotoViewer() {
            closePhotoModal('photo-viewer-modal');
        }

        /**
         * 大きく見ている写真を端末に保存する。スマホは共有シート（「画像を保存」がある）、PCはダウンロードにする。
         * @returns {void}
         */
        export function savePhotoToDevice() {
            if (!photoViewerCanvas) return;
            photoViewerCanvas.toBlob(async (blob) => {
                const file = new File([blob], 'punicker_photo.jpg', { type: 'image/jpeg' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try { await navigator.share({ files: [file] }); } catch (e) { /* 共有シートを閉じただけなら何もしない */ }
                    return;
                }
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'punicker_photo.jpg';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }, 'image/jpeg', 0.92);
        }

        /**
         * 記念写真まわりの画面を閉じる。他の画面がまだ開いていれば「画面が開いている」状態を保つ。
         * （./core.js の closeModal() は、1つ閉じると「画面が開いている」印を外してしまうため、重ねて開いた時に付け直す）
         * @param {string} id - 閉じる画面のid
         * @returns {void}
         */
        export function closePhotoModal(id) {
            closeModal(id);
            const stillOpen = [...document.querySelectorAll('.modal')].some(m => m.style.display === 'flex');
            if (stillOpen) document.body.classList.add('modal-open');
        }

        /**
         * photoAlbumを書き換える（他ファイルからのsetter。state.js のロードで使う）。
         * @param {Object} newPhotoAlbum - 県の番号 → 写真のレシピ
         * @returns {void}
         */
        export function setPhotoAlbum(newPhotoAlbum) { photoAlbum = newPhotoAlbum; }

        // HTMLの onclick="" から呼べるように、関数を window に登録する
        window.openPhotoMode = openPhotoMode;
        window.closePhotoMode = closePhotoMode;
        window.onPhotoScaleInput = onPhotoScaleInput;
        window.onPhotoRotateInput = onPhotoRotateInput;
        window.togglePhotoFlip = togglePhotoFlip;
        window.resetPhotoPose = resetPhotoPose;
        window.takePhoto = takePhoto;
        window.openAlbum = openAlbum;
        window.closeAlbum = closeAlbum;
        window.closePhotoViewer = closePhotoViewer;
        window.savePhotoToDevice = savePhotoToDevice;
