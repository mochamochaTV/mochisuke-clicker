/**
 * src/minigames/quiz.js
 * ミニゲーム「🗾ご当地クイズ」本体。県名⇔名産品の3択クイズを出題し、正解数に応じて
 * ミニゲームコインを付与する。センターの開閉やコイン付与など共通処理はcore.jsに委ねている。
 * 元は他の4ゲームと同じくminigames.js内にあったものを、ゲーム単位でファイル分割した
 * （ロジック・数値は一切変更していない。コードの再配置のみ）。
 */

import { stages } from '../../data.js?v=2026-09-11-001';
import { pickRandom, playAudioFile, screenFlash, spawnModalParticleBurst, vibrate } from '../../main.js?v=2026-09-11-001';
import { currentStageIndex } from '../../progress.js?v=2026-09-11-001';
import { consumeMinigamePlay, grantMinigameReward, showMinigameResult } from './core.js?v=2026-09-11-001';

        const CONFIG = {
            QUIZ_QUESTION_COUNT: 3,             // 1プレイあたりの出題数
            QUIZ_MIN_STAGES_REQUIRED: 2,        // クイズに挑戦するために必要な訪問済み県の数
            QUIZ_MAX_DISTRACTORS: 3,            // 正解以外の選択肢の最大数（合計最大4択）
            QUIZ_NAME_TO_ITEM_PROBABILITY: 0.5, // 「県名→名産品」を問う問題になる確率
            QUIZ_FEEDBACK_DELAY_MS: 750,        // 正誤フィードバックを見せてから次の問題/結果へ進むまでの間
            QUIZ_CORRECT_VIBRATE_MS: 20,        // 正解時のバイブ時間
            QUIZ_CORRECT_PARTICLE_COUNT: 6,     // 正解時に弾けるパーティクルの数
            QUIZ_PERFECT_FLASH_OPACITY: 0.3,    // 全問正解時の画面フラッシュの強さ
        };

        // -------------------------------------------------------------
        // 🗾 ① ご当地クイズ
        // -------------------------------------------------------------
        export const QUIZ_REWARD_BY_CORRECT = { 3: 1.0, 2: 0.6, 1: 0.3, 0: 0.1 }; // 正解数ごとの倍率（調整用）

        /**
         * 訪問県が2県未満なら挑戦不可の案内を出し、そうでなければ3問ぶんのクイズを生成して最初の問題を表示する。
         * @param {HTMLElement} container - クイズ画面を描画するコンテナ要素
         * @returns {void}
         */
        export function startQuizGame(container) {
            if (currentStageIndex + 1 < CONFIG.QUIZ_MIN_STAGES_REQUIRED) {
                container.innerHTML = `<div style="text-align:center; padding:20px;">
                    <p style="margin-bottom:14px;">もう少し旅を進めてから挑戦してね！</p>
                    <button class="item-action-btn" onclick="endMinigameToTiles()">もどる</button>
                </div>`;
                return;
            }
            const quizState = { qIndex: 0, correct: 0, questions: [] };
            for (let i = 0; i < CONFIG.QUIZ_QUESTION_COUNT; i++) quizState.questions.push(generateQuizQuestion());
            window.__quizState = quizState;
            renderQuizQuestion(container, quizState);
        }

        /**
         * 解放済みの県からランダムに正解の県を選び、県名→名産品か名産品→県名かをランダムに決め、最大4択の選択肢を組み立てる。
         * @returns {Object} { correctStage, isNameToItem, choices } 1問分のデータ
         */
        export function generateQuizQuestion() {
            const pool = [];
            for (let i = 0; i <= currentStageIndex; i++) pool.push(stages[i]);
            const correctStage = pickRandom(pool);
            const isNameToItem = Math.random() < CONFIG.QUIZ_NAME_TO_ITEM_PROBABILITY; // true: 県名→名産品を当てる／false: 名産品→県名を当てる
            const others = pool.filter(s => s !== correctStage).sort(() => Math.random() - 0.5);
            const numDistractors = Math.min(CONFIG.QUIZ_MAX_DISTRACTORS, others.length); // 解放済みが少ない時は、それ以下の択数にフォールバック
            let choices = [correctStage, ...others.slice(0, numDistractors)];
            choices = choices.sort(() => Math.random() - 0.5);
            return { correctStage, isNameToItem, choices };
        }

        /**
         * 現在の問題番号の問題文・選択肢ボタン(A〜D)・進捗ドットをHTMLとして描画する。
         * @param {HTMLElement} container - 描画先のコンテナ要素
         * @param {Object} quizState - startQuizGame()が作るクイズの状態オブジェクト
         * @returns {void}
         */
        export function renderQuizQuestion(container, quizState) {
            const q = quizState.questions[quizState.qIndex];
            const questionText = q.isNameToItem ? `${q.correctStage.name}の名産品は？` : `「${q.correctStage.item}」はどこの県の名産品？`;
            // 「名産品→県名を当てる」問題の時だけ、その名産品のイラストを見せる（答えの県名は分からないので成立する）
            const itemImgHtml = (!q.isNameToItem && q.correctStage.itemImg)
                ? `<img src="${q.correctStage.itemImg}" alt="${q.correctStage.item}" style="width:90px; height:90px; object-fit:contain; margin:6px auto 10px; display:block; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.2));">`
                : '';
            const colors = ['#ff8a65', '#4fc3f7', '#81c784', '#ba68c8']; // 左上・右上・左下・右下、それぞれ別の色
            const letters = ['A', 'B', 'C', 'D'];
            const choiceButtons = q.choices.map((c, idx) => {
                const label = q.isNameToItem ? c.item : c.name;
                const isCorrect = c === q.correctStage;
                return `<button class="quiz-choice-btn-grid" id="quiz-choice-${idx}" style="background:${colors[idx % colors.length]};" onclick="answerQuizQuestion(${isCorrect}, ${idx})">
                    <span class="quiz-choice-grid-letter">${letters[idx] || '?'}</span>
                    <span class="quiz-choice-grid-label">${label}</span>
                </button>`;
            }).join('');
            const dots = quizState.questions.map((_, i) => {
                let cls = 'quiz-dot';
                if (i < quizState.qIndex) cls += quizState.history && quizState.history[i] ? ' quiz-dot-correct' : ' quiz-dot-wrong';
                else if (i === quizState.qIndex) cls += ' quiz-dot-current';
                return `<span class="${cls}"></span>`;
            }).join('');
            container.innerHTML = `
                <div style="min-height:100%; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; text-align:center; padding:14px; background:radial-gradient(circle at 50% 10%, #e8f5ff, #fbfdff); border-radius:20px;">
                    <div style="display:flex; justify-content:center; gap:6px; margin-bottom:12px;">${dots}</div>
                    <div style="font-weight:900; font-size:0.85rem; color:#999; margin-bottom:4px;">${quizState.qIndex + 1}問目</div>
                    <div style="font-weight:900; font-size:1.3rem; margin-bottom:10px; color:#5d4037;">${questionText}</div>
                    ${itemImgHtml}
                    <div id="quiz-choices-wrap" style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:20px;">${choiceButtons}</div>
                </div>`;
        }

        /**
         * 選んだ選択肢の正誤を判定して演出を出し、750ms後に次の問題または結果画面へ進める。
         * @param {boolean} isCorrect - 選んだ選択肢が正解かどうか
         * @param {number} choiceIdx - 選んだ選択肢のインデックス
         * @returns {void}
         */
        export function answerQuizQuestion(isCorrect, choiceIdx) {
            const quizState = window.__quizState;
            if (!quizState) return;
            document.querySelectorAll('.quiz-choice-btn-grid').forEach(b => b.onclick = null); // 連打防止（実際に生成されるボタンのクラス名に合わせて修正）
            if (!quizState.history) quizState.history = [];
            quizState.history[quizState.qIndex] = isCorrect;

            const btn = document.getElementById(`quiz-choice-${choiceIdx}`);
            if (isCorrect) {
                quizState.correct++;
                playAudioFile('audio/critical.mp3');
                vibrate(CONFIG.QUIZ_CORRECT_VIBRATE_MS);
                if (btn) {
                    btn.classList.add('quiz-correct-glow');
                    const rect = btn.getBoundingClientRect();
                    spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, CONFIG.QUIZ_CORRECT_PARTICLE_COUNT, '#4caf50');
                }
            } else {
                playAudioFile('audio/tap.mp3');
                if (btn) btn.classList.add('quiz-wrong-shake');
                // 不正解の時は、正解の選択肢も光らせて教えてあげる
                const q = quizState.questions[quizState.qIndex];
                const correctIdx = q.choices.findIndex(c => c === q.correctStage);
                const correctBtn = document.getElementById(`quiz-choice-${correctIdx}`);
                if (correctBtn) correctBtn.classList.add('quiz-correct-glow');
            }

            setTimeout(() => {
                quizState.qIndex++;
                if (quizState.qIndex < quizState.questions.length) {
                    renderQuizQuestion(document.getElementById('minigame-play-view'), quizState);
                } else {
                    consumeMinigamePlay('quiz');
                    const mult = QUIZ_REWARD_BY_CORRECT[quizState.correct] ?? 0;
                    const reward = grantMinigameReward(mult);
                    if (quizState.correct === CONFIG.QUIZ_QUESTION_COUNT) screenFlash('#ffd700', CONFIG.QUIZ_PERFECT_FLASH_OPACITY);
                    showMinigameResult(`🗾 ご当地クイズ結果`, `${quizState.correct} / ${CONFIG.QUIZ_QUESTION_COUNT}問 正解！`, reward);
                    window.__quizState = null;
                }
            }, CONFIG.QUIZ_FEEDBACK_DELAY_MS); // フィードバックが見えるよう少し間を置いてから次の問題へ
        }
        window.answerQuizQuestion = answerQuizQuestion; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

