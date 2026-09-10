/**
 * src/minigames/concentration.js
 * ミニゲーム「🃏ご当地神経衰弱」本体。訪問済み県の名産品カードをめくって
 * ペアを揃える。タイマーやアニメーションフレームを持たない（カードめくりの状態だけの）
 * ゲームなので、離脱時の特別な後始末は不要。
 * 元は他の4ゲームと同じくminigames.js内にあったものを、ゲーム単位でファイル分割した
 * （ロジック・数値は一切変更していない。コードの再配置のみ）。
 */

import { stages } from '../../data.js?v=2026-09-10-001';
import { playAudioFile, screenFlash, spawnModalParticleBurst, vibrate } from '../../main.js?v=2026-09-10-001';
import { currentStageIndex } from '../../progress.js?v=2026-09-10-001';
import { saveGame } from '../../state.js?v=2026-09-10-001';
import { consumeMinigamePlay, endMinigameToTiles, grantMinigameReward, minigameBests, showMinigameResult } from './core.js?v=2026-09-10-001';

        const CONFIG = {
            CONCENTRATION_PAIR_COUNT: 6,             // 使うペアの数（カード総数はこの2倍）
            CONCENTRATION_MISMATCH_DELAY_MS: 800,    // 不一致だった時、シェイクを見せてから裏返すまでの時間
            CONCENTRATION_FINISH_DELAY_MS: 500,      // 全ペア成立から結果画面へ進むまでの間
            CONCENTRATION_CLEAR_FLASH_OPACITY: 0.25, // クリア時の画面フラッシュの強さ
            CONCENTRATION_CLEAR_PARTICLE_COUNT: 14,  // クリア時に弾けるパーティクルの数
            CONCENTRATION_DEFAULT_MULT: 0.3,         // 該当する閾値が無かった場合のフォールバック倍率
        };

        // -------------------------------------------------------------
        // 🃏 ③ ご当地神経衰弱
        // -------------------------------------------------------------
        export const CONCENTRATION_THRESHOLDS = [ // [手数の上限, 倍率]（少ない順に判定）
            [14, 1.4], [18, 1.0], [24, 0.6], [Infinity, 0.3]
        ];
        export let concentrationState = null;

        /**
         * 名産品イラストを持つ解放済み県から6件をランダムに選んで12枚のカード(ペア×2)を作りシャッフルする。
         * @param {HTMLElement} container - 描画先のコンテナ要素
         * @returns {void}
         */
        export function startConcentrationGame(container) {
            const candidates = [];
            for (let i = 0; i <= currentStageIndex; i++) { if (stages[i].itemImg) candidates.push(stages[i]); }
            if (candidates.length < CONFIG.CONCENTRATION_PAIR_COUNT) {
                container.innerHTML = `<div style="text-align:center; padding:20px;">
                    <div style="font-weight:bold; margin-bottom:10px;">🃏 ご当地神経衰弱</div>
                    <p style="font-size:0.85rem; color:#999; margin-bottom:14px;">イラスト準備中です（もう少しお待ちください）</p>
                    <button class="item-action-btn" onclick="endMinigameToTiles()">もどる</button>
                </div>`;
                return;
            }
            const chosen = candidates.sort(() => Math.random() - 0.5).slice(0, CONFIG.CONCENTRATION_PAIR_COUNT);
            let cards = [];
            chosen.forEach((stage, idx) => {
                cards.push({ pairId: idx, stage, matched: false });
                cards.push({ pairId: idx, stage, matched: false });
            });
            cards = cards.sort(() => Math.random() - 0.5);
            concentrationState = { cards, flippedIndices: [], moves: 0, matchedPairs: 0, locked: false };
            buildConcentrationBoard(); // DOMはここで1回だけ作る。以降はクラス切り替えのみでCSSアニメーションを効かせる
        }

        // カードのDOMを最初の1回だけ組み立てる（毎回作り直すとCSSのtransitionが再生されないため）
        /**
         * 神経衰弱のカードDOMを最初の1回だけ丸ごと組み立てる。
         * @returns {void}
         */
        export function buildConcentrationBoard() {
            const container = document.getElementById('minigame-play-view');
            const st = concentrationState;
            const cardsHtml = st.cards.map((c, i) => `
                <div class="concentration-card-outer" onclick="flipConcentrationCard(${i})">
                    <div class="concentration-card-inner" id="concent-inner-${i}">
                        <div class="concentration-card-face concentration-card-back">
                            <img src="ui_images/concentration/card_back.webp" alt="" style="width:100%; height:100%; object-fit:contain;">
                        </div>
                        <div class="concentration-card-face concentration-card-front">
                            <img src="ui_images/concentration/card_front.webp" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain;">
                            <img src="${c.stage.itemImg}" alt="${c.stage.item}" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:78%; height:78%; object-fit:contain;">
                        </div>
                    </div>
                </div>
            `).join('');
            container.innerHTML = `
                <div style="min-height:100%; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; padding:12px; background:radial-gradient(circle at 50% 10%, #fff3e0, #fffdf9); border-radius:20px;">
                    <div style="text-align:center; margin-bottom:10px; font-size:0.9rem; color:#5d4037; font-weight:bold;">🃏 めくった回数: <span id="concent-moves" style="color:#ff9800; font-size:1.1rem;">${st.moves}</span></div>
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:8px;">${cardsHtml}</div>
                </div>`;
        }

        // 個別カードの見た目だけを更新する（既存のDOM要素のクラスを切り替えるだけなので、3D回転アニメーションが正しく再生される）
        /**
         * 指定インデックスのカードのDOM要素に対し、表向き/裏向き・一致済みのCSSクラスだけを切り替える。
         * @param {number} i - カードのインデックス
         * @returns {void}
         */
        export function updateConcentrationCardVisual(i) {
            const st = concentrationState;
            const inner = document.getElementById(`concent-inner-${i}`);
            if (!inner) return;
            const isFlipped = st.flippedIndices.includes(i) || st.cards[i].matched;
            inner.classList.toggle('flipped', isFlipped);
            inner.classList.toggle('matched', st.cards[i].matched);
        }

        /**
         * カードをめくる処理本体。2枚目がめくられた時点で一致判定を行い、一致すれば揃え、不一致ならロックして裏返す。
         * @param {number} i - めくるカードのインデックス
         * @returns {void}
         */
        export function flipConcentrationCard(i) {
            const st = concentrationState;
            if (!st || st.locked) return;
            if (st.flippedIndices.includes(i) || st.cards[i].matched) return;
            if (st.flippedIndices.length >= 2) return;
            st.flippedIndices.push(i);
            playAudioFile('audio/tap.mp3');
            updateConcentrationCardVisual(i);

            if (st.flippedIndices.length === 2) {
                st.moves++;
                const movesEl = document.getElementById('concent-moves');
                if (movesEl) movesEl.innerText = st.moves;
                const [a, b] = st.flippedIndices;
                if (st.cards[a].pairId === st.cards[b].pairId) {
                    st.cards[a].matched = true; st.cards[b].matched = true;
                    st.matchedPairs++;
                    playAudioFile('audio/critical.mp3');
                    updateConcentrationCardVisual(a);
                    updateConcentrationCardVisual(b);
                    st.flippedIndices = [];
                    if (st.matchedPairs === CONFIG.CONCENTRATION_PAIR_COUNT) setTimeout(() => finishConcentration(), CONFIG.CONCENTRATION_FINISH_DELAY_MS);
                } else {
                    st.locked = true;
                    // 不一致の合図に、2枚を軽くシェイクさせる
                    [a, b].forEach(idx => {
                        const inner = document.getElementById(`concent-inner-${idx}`);
                        if (inner) { inner.classList.remove('shake'); void inner.offsetWidth; inner.classList.add('shake'); }
                    });
                    setTimeout(() => {
                        if (!concentrationState) return;
                        const [oldA, oldB] = concentrationState.flippedIndices;
                        concentrationState.flippedIndices = [];
                        concentrationState.locked = false;
                        updateConcentrationCardVisual(oldA);
                        updateConcentrationCardVisual(oldB);
                    }, CONFIG.CONCENTRATION_MISMATCH_DELAY_MS);
                }
            }
        }
        window.flipConcentrationCard = flipConcentrationCard; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 手数をCONCENTRATION_THRESHOLDSの閾値表で判定して報酬倍率を求め、報酬付与・自己ベスト更新・結果画面表示を行う。
         * @returns {void}
         */
        export function finishConcentration() {
            consumeMinigamePlay('concentration');
            const moves = concentrationState.moves;
            const found = CONCENTRATION_THRESHOLDS.find(([max]) => moves <= max);
            const mult = found ? found[1] : CONFIG.CONCENTRATION_DEFAULT_MULT;
            const reward = grantMinigameReward(mult);
            const isNewBest = minigameBests.concentration == null || moves < minigameBests.concentration;
            if (isNewBest) { minigameBests.concentration = moves; playAudioFile('audio/levelup.mp3'); saveGame(); }
            concentrationState = null;
            screenFlash('#4caf50', CONFIG.CONCENTRATION_CLEAR_FLASH_OPACITY);
            vibrate([20, 30, 20, 30, 40]);
            const playView = document.getElementById('minigame-play-view');
            if (playView) {
                const rect = playView.getBoundingClientRect();
                spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 3, CONFIG.CONCENTRATION_CLEAR_PARTICLE_COUNT, '#ffd700');
            }
            showMinigameResult(`🃏 神経衰弱結果`, `${moves}回でクリア！${isNewBest ? '🎉自己ベスト更新！' : `（自己ベスト: ${minigameBests.concentration}回）`}`, reward);
        }

