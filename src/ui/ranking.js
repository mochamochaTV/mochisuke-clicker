        // ui.js を機能ごとに分割したファイルの1つ（ランキング・日記帳）。ui.js 自身は7ファイルをre-exportする窓口。

        import { KISEKAE_ITEMS, stages } from '../../data.js?v=2026-09-11-001';
        import { escapeHtml, formatMochi, playAudioFile } from '../../main.js?v=2026-09-11-001';
        import { collectedStamps, currentStageIndex, equippedKisekae, prestigeCount, selectedStageIndex } from '../../progress.js?v=2026-09-11-001';
        import { purchasedItems } from '../../shop.js?v=2026-09-11-001';
        import { playerName, score, totalTapsCount } from '../../state.js?v=2026-09-11-001';
        import { closeModal, openModal } from './core.js?v=2026-09-11-001';
        import { setupChatInputEnterKey } from './chat.js?v=2026-09-11-001';


        const CONFIG = {
            FADE_OUT_DURATION_MS: 300, // ランキング画面を閉じる際の黒フェードの時間
            FADE_CLEANUP_DELAY_MS: 150, // モーダルを閉じた後、黒フェードを解除するまでの遅延
            PAGE_TURN_VOLUME: 1.0, // 絵日記のページをめくる音の音量
        };

        export let currentRankingTab = 'score';

        /**
         * 移動音を鳴らしながら画面を黒フェードで覆い、ランキングモーダルを閉じる。
         * @returns {void}
         */
        export function closeRanking() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('ranking-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.FADE_CLEANUP_DELAY_MS);
            }, CONFIG.FADE_OUT_DURATION_MS);
        }
        /**
         * ランキング画面のヘルプオーバーレイの表示・非表示をトグルする。
         * @returns {void}
         */
        export function toggleRankingHelpOverlay() {
            const overlay = document.getElementById('ranking-help-overlay');
            if (overlay) overlay.style.display = (overlay.style.display === 'block') ? 'none' : 'block';
        }

        /**
         * 現在のランキングタブを切り替え、タブボタンの見た目を更新してランキング一覧を再描画する。
         * @param {string} tab - 切り替え先のタブ名（'score' | 'taps' | 'prestige' | 'room'）
         * @returns {void}
         */
        export function switchRankingTab(tab) {
            currentRankingTab = tab;
            document.getElementById('rank-tab-score').classList.toggle('active', tab === 'score');
            document.getElementById('rank-tab-taps').classList.toggle('active', tab === 'taps');
            document.getElementById('rank-tab-prestige').classList.toggle('active', tab === 'prestige');
            document.getElementById('rank-tab-room').classList.toggle('active', tab === 'room');
            renderRankingList();
        }

        /**
         * ランキングモーダルを開き、ランキング一覧の描画完了を待つ。
         * @returns {Promise<void>}
         */
        export async function openRanking() {
            openModal('ranking-modal');
            await renderRankingList();
        }

        // 順位の見た目（1〜3位は特別扱い）
        /**
         * 順位に応じた背景グラデーションと文字色のスタイル情報を返す。
         * @param {number} rank - 順位（1始まり）
         * @returns {Object} 背景(bg)と文字色(color)を持つスタイルオブジェクト
         */
        export function rankNumberStyle(rank) {
            if (rank === 1) return { bg: 'linear-gradient(135deg,#ffd700,#ffb300)', color: '#5d4037' };
            if (rank === 2) return { bg: 'linear-gradient(135deg,#e0e0e0,#b0bec5)', color: '#5d4037' };
            if (rank === 3) return { bg: 'linear-gradient(135deg,#d7a06e,#b5651d)', color: '#fff' };
            return { bg: '#fff', color: '#8d6e63' };
        }
        // そのプレイヤーの装着中の服・帽子・顔パーツを、小さいもちすけとして重ねて表示するHTMLを作る
        /**
         * 装備情報から、フルボディ装備または服・翼・帽子・顔パーツを重ねたミニプレビュー画像のHTMLを生成する。
         * @param {Object} outfit - プレイヤーの装備情報（fullbody/clothes/back/hat/faceなどのID）
         * @returns {string} プレビュー用のHTML文字列
         */
        export function renderRankOutfitPreviewHtml(outfit) {
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
        /**
         * 現在のタブに応じてランキングデータを取得し、取得できればソートして各プレイヤーの行を、
         * 取得できなければオフライン表示をDOMに描画する。
         * @returns {Promise<void>}
         */
        export async function renderRankingList() {
            const listContainer = document.getElementById('ranking-list');
            listContainer.innerHTML = `<div style="text-align:center; color:#aaa; padding:20px;">読み込み中...</div>`;

            if (currentRankingTab === 'room') {
                const ready = window.isRankingReady && window.isRankingReady();
                const result = ready ? await window.fetchRoomLikeRanking() : { list: null, error: 'offline' };
                if (!result.list) {
                    listContainer.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.75rem; padding:10px;">部屋ランキングを取得できませんでした。<br>${escapeHtml(result.error || '')}</div>`;
                    return;
                }
                const list = result.list;
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

        export let diaryPageIndex = 0;
        /**
         * 絵日記のページインデックスを現在選択中のステージに合わせ、表面表示にリセットしてモーダルを開く。
         * @returns {void}
         */
        export function openDiary() {
            diaryPageIndex = selectedStageIndex;
            diaryShowingBack = false;
            document.getElementById('diary-front-content').style.display = 'block';
            document.getElementById('diary-back-content').style.display = 'none';
            renderDiaryPage();
            openModal('diary-modal');
        }
        export let diaryShowingBack = false;
        /**
         * 現在の絵日記ページに対応するステージ情報から、表面・裏面の内容とフッターのページ数表示を更新する。
         * @returns {void}
         */
        export function renderDiaryPage() {
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
        /**
         * 絵日記の表面/裏面の表示を切り替え、ページをめくる音を再生する。
         * @param {boolean} showBack - trueで裏面を表示、falseで表面を表示
         * @returns {void}
         */
        export function flipDiaryPage(showBack) {
            diaryShowingBack = showBack;
            document.getElementById('diary-front-content').style.display = showBack ? 'none' : 'block';
            document.getElementById('diary-back-content').style.display = showBack ? 'block' : 'none';
            playAudioFile('audio/page_turn.mp3', CONFIG.PAGE_TURN_VOLUME);
        }
        /**
         * 到達済み最終ステージ・全ステージ末尾より手前であれば、絵日記のページを1つ進めて再描画する。
         * @returns {void}
         */
        export function nextPage() { if (diaryPageIndex < currentStageIndex && diaryPageIndex < stages.length - 1) { diaryPageIndex++; flipDiaryPage(false); renderDiaryPage(); } }
        /**
         * 現在ページが先頭より後ろであれば、絵日記のページを1つ戻して再描画する。
         * @returns {void}
         */
        export function prevPage() { if (diaryPageIndex > 0) { diaryPageIndex--; flipDiaryPage(false); renderDiaryPage(); } }

        // 💬 マイルームのライブチャット：入力欄でEnterキーを押した時に送信できるようにする
        setupChatInputEnterKey();
        /**
         * diaryPageIndexを指定した値に設定する。
         * @param {number} v - 設定するページインデックス
         * @returns {void}
         */
        export function setDiaryPageIndex(v) { diaryPageIndex = v; }
        window.closeRanking = closeRanking;
        window.toggleRankingHelpOverlay = toggleRankingHelpOverlay;
        window.switchRankingTab = switchRankingTab;
        window.openRanking = openRanking;
        window.flipDiaryPage = flipDiaryPage;
        window.nextPage = nextPage;
        window.prevPage = prevPage;
