/**
 * src/minigames/timeAttack.js
 * ミニゲーム「⏱️タップタイムアタック」本体。制限時間内のタップ数に応じて
 * ミニゲームコインを付与し、自己ベストを更新する。
 * 元は他の4ゲームと同じくminigames.js内にあったものを、ゲーム単位でファイル分割した
 * （ロジック・数値は一切変更していない。コードの再配置のみ）。
 *
 * cleanupTimeAttackTimer()は、分割にあたって新設した関数：離脱時のタイマー後始末は
 * 以前はcore側のcleanupActiveMinigameTimers()が直接timeAttackStateを書き換えていたが、
 * ファイルが分かれるとimportした変数には直接代入できない（ESモジュールの仕様）ため、
 * この状態を持つ本ファイル自身に後始末専用の関数として切り出した。処理の中身は同じ。
 */

import { playAudioFile, playAudioFilePitched, screenFlash, spawnModalParticleBurst, vibrate } from '../../main.js?v=2026-09-11-001';
import { saveGame } from '../../state.js?v=2026-09-11-001';
import { consumeMinigamePlay, grantMinigameReward, minigameBests, showMinigameResult } from './core.js?v=2026-09-11-001';

        const CONFIG = {
            TIME_ATTACK_TICK_MS: 1000,             // 残り時間を1減らす間隔
            TIME_ATTACK_URGENT_SEC: 3,             // 残りこの秒数以下になったら「ラスト」演出にする閾値
            TIME_ATTACK_URGENT_VIBRATE_MS: 15,     // ラスト数秒のカウントダウン時のバイブ時間
            TIME_ATTACK_BAR_HIGH_PCT: 50,          // タイマーバーが緑色でいられる残り％の閾値
            TIME_ATTACK_BAR_MID_PCT: 20,           // タイマーバーが黄色になる残り％の閾値（これ未満で赤）
            TIME_ATTACK_TAP_SQUASH_MS: 170,        // タップボタンが潰れて戻るアニメーションの時間
            TIME_ATTACK_TAP_PARTICLE_COUNT: 3,     // タップ毎に弾けるパーティクルの数
            TIME_ATTACK_RIPPLE_DURATION_MS: 500,   // タップ時のリップル演出が消えるまでの時間
            TIME_ATTACK_PITCH_MAX_BOOST: 0.6,      // タップ音のピッチが上がる上限（連打時）
            TIME_ATTACK_PITCH_PER_TAP: 0.015,      // タップ1回ごとにピッチが上がる量
            TIME_ATTACK_MILESTONE_TAPS: 20,        // 何タップごとに節目演出（バイブ＋フラッシュ）を出すか
            TIME_ATTACK_MILESTONE_VIBRATE_MS: 20,  // 節目演出のバイブ時間
            TIME_ATTACK_MILESTONE_FLASH_OPACITY: 0.12, // 節目演出の画面フラッシュの強さ
            TIME_ATTACK_DEFAULT_MULT: 0.3,         // 該当する閾値が無かった場合のフォールバック倍率
            TIME_ATTACK_BEST_FLASH_OPACITY: 0.35,  // 自己ベスト更新時の画面フラッシュの強さ
        };

        // -------------------------------------------------------------
        // ⏱️ ② タップタイムアタック
        // -------------------------------------------------------------
        export const TIME_ATTACK_DURATION_SEC = 15;
        export const TIME_ATTACK_THRESHOLDS = [ // [必要タップ数, 倍率]（多い順に判定）
            [60, 1.3], [40, 1.0], [20, 0.6], [0, 0.3]
        ];
        export let timeAttackState = null;

        /**
         * タイムアタックの説明とスタートボタンのみの導入画面を表示する。
         * @param {HTMLElement} container - 描画先のコンテナ要素
         * @returns {void}
         */
        export function startTimeAttackGame(container) {
            container.innerHTML = `
                <div style="min-height:100%; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; text-align:center; padding:14px; background:radial-gradient(circle at 50% 15%, #e3f6f3, #fbfffe); border-radius:20px;">
                    <div style="font-size:3.5rem; margin-bottom:14px;">⏱️</div>
                    <div style="font-weight:900; font-size:1.3rem; margin-bottom:14px; color:#5d4037;">タップタイムアタック</div>
                    <div style="font-size:0.95rem; color:#5d4037; margin-bottom:28px; line-height:1.6;">スタートを押したら<br><span style="font-size:1.5rem; font-weight:900; color:#26a69a;">${TIME_ATTACK_DURATION_SEC}秒間</span>、ひたすらタップ！</div>
                    <button class="item-action-btn btn-shop" style="background:#26a69a; color:#fff; width:100%; padding:16px; font-size:1.1rem; font-weight:900; border-radius:16px; box-shadow:0 5px 0 rgba(0,0,0,0.2);" onclick="beginTimeAttack()">スタート</button>
                </div>`;
        }

        /**
         * 実プレイ画面(タイマーバー・カウント・タップボタン)を構築し、1秒毎に残り時間を減らすタイマーを開始する。
         * @returns {void}
         */
        export function beginTimeAttack() {
            const container = document.getElementById('minigame-play-view');
            timeAttackState = { taps: 0, timeLeft: TIME_ATTACK_DURATION_SEC, timerId: null };
            container.innerHTML = `
                <div style="min-height:100%; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; text-align:center; padding:14px; background:radial-gradient(circle at 50% 15%, #e3f6f3, #fbfffe); border-radius:20px;">
                    <div id="ta-timer-bar-outer" style="width:100%; height:16px; background:#e6e6e6; border-radius:10px; overflow:hidden; margin-bottom:14px; box-shadow:inset 0 2px 4px rgba(0,0,0,0.18);">
                        <div id="ta-timer-bar-inner" style="height:100%; width:100%; background:linear-gradient(90deg,#81c784,#4caf50); transition:width 0.9s linear, background 0.3s; box-shadow:0 0 8px rgba(76,175,80,0.6);"></div>
                    </div>
                    <div id="ta-timer" style="font-size:2rem; font-weight:900; color:#ff9800; margin-bottom:6px;">${TIME_ATTACK_DURATION_SEC}秒</div>
                    <div style="margin:10px 0 32px;">
                        <span id="ta-count" style="font-size:4rem; font-weight:900; color:#26a69a; display:inline-block; text-shadow:0 3px 0 rgba(0,0,0,0.06);">0</span>
                        <span style="font-size:1.2rem; font-weight:bold; color:#5d4037;"> 回</span>
                    </div>
                    <div id="ta-btn-wrap" style="position:relative; width:210px; height:210px; margin:0 auto;">
                        <button id="ta-tap-btn" style="position:relative; width:210px; height:210px; border-radius:50%;
                            background:radial-gradient(circle at 35% 28%, #5ddbcd, #26a69a 65%, #1c8579);
                            color:#fff; font-size:1.5rem; font-weight:900; border:6px solid #fff;
                            box-shadow:0 10px 22px rgba(0,0,0,0.3), inset 0 -6px 10px rgba(0,0,0,0.18); z-index:2;">タップ！</button>
                    </div>
                </div>`;
            const btn = document.getElementById('ta-tap-btn');
            btn.addEventListener('pointerdown', onTimeAttackTap);
            timeAttackState.timerId = setInterval(() => {
                if (!timeAttackState) return;
                timeAttackState.timeLeft--;
                const timerEl = document.getElementById('ta-timer');
                if (timerEl) {
                    timerEl.innerText = timeAttackState.timeLeft + '秒';
                    timerEl.classList.toggle('ta-timer-urgent', timeAttackState.timeLeft <= CONFIG.TIME_ATTACK_URGENT_SEC && timeAttackState.timeLeft > 0);
                }
                const barInner = document.getElementById('ta-timer-bar-inner');
                if (barInner) {
                    const pct = Math.max(0, (timeAttackState.timeLeft / TIME_ATTACK_DURATION_SEC) * 100);
                    barInner.style.width = pct + '%';
                    barInner.style.background = pct > CONFIG.TIME_ATTACK_BAR_HIGH_PCT ? 'linear-gradient(90deg,#81c784,#4caf50)' : pct > CONFIG.TIME_ATTACK_BAR_MID_PCT ? 'linear-gradient(90deg,#ffd54f,#ffc107)' : 'linear-gradient(90deg,#ef5350,#f44336)';
                }
                if (timeAttackState.timeLeft > 0 && timeAttackState.timeLeft <= CONFIG.TIME_ATTACK_URGENT_SEC) {
                    playAudioFile('audio/skill_tap.mp3', 0.35); // ラスト3秒のカウントダウン合図に流用
                    vibrate(CONFIG.TIME_ATTACK_URGENT_VIBRATE_MS);
                }
                if (timeAttackState.timeLeft <= 0) {
                    clearInterval(timeAttackState.timerId);
                    btn.removeEventListener('pointerdown', onTimeAttackTap);
                    finishTimeAttack();
                }
            }, CONFIG.TIME_ATTACK_TICK_MS);
        }
        window.beginTimeAttack = beginTimeAttack; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * タップボタンのpointerdownハンドラ。タップ数を加算し、潰れて戻るアニメーション・リップル・パーティクル・音程変化の演出を出す。
         * @param {Event} e - pointerdownイベント
         * @returns {void}
         */
        export function onTimeAttackTap(e) {
            e.preventDefault();
            if (!timeAttackState) return;
            timeAttackState.taps++;
            const countEl = document.getElementById('ta-count');
            if (countEl) {
                countEl.innerText = timeAttackState.taps;
                countEl.classList.remove('ta-count-pop'); void countEl.offsetWidth; countEl.classList.add('ta-count-pop');
            }

            const btn = document.getElementById('ta-tap-btn');
            const wrap = document.getElementById('ta-btn-wrap');
            if (btn) {
                // タップの度に「もちっ」と潰れて戻る手応えを出す
                btn.animate([
                    { transform: 'scale(0.8, 1.16)', filter: 'brightness(0.85)' },
                    { transform: 'scale(1.1, 0.9)', filter: 'brightness(1.1)', offset: 0.45 },
                    { transform: 'scale(1, 1)', filter: 'brightness(1)' }
                ], { duration: CONFIG.TIME_ATTACK_TAP_SQUASH_MS, easing: 'ease-out' });
                const rect = btn.getBoundingClientRect();
                spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, CONFIG.TIME_ATTACK_TAP_PARTICLE_COUNT, '#26a69a');
            }
            if (wrap) {
                // ボタンから輪っかが広がって消えるリップル演出
                const ripple = document.createElement('div');
                ripple.className = 'ta-ripple';
                wrap.appendChild(ripple);
                setTimeout(() => ripple.remove(), CONFIG.TIME_ATTACK_RIPPLE_DURATION_MS);
            }

            // 叩けば叩くほど音がだんだん高くなっていく（連打の気持ちよさを強化）
            const rate = 1 + Math.min(CONFIG.TIME_ATTACK_PITCH_MAX_BOOST, timeAttackState.taps * CONFIG.TIME_ATTACK_PITCH_PER_TAP);
            playAudioFilePitched('audio/tap.mp3', 0.5, rate);

            if (timeAttackState.taps % CONFIG.TIME_ATTACK_MILESTONE_TAPS === 0) { vibrate(CONFIG.TIME_ATTACK_MILESTONE_VIBRATE_MS); screenFlash('#26a69a', CONFIG.TIME_ATTACK_MILESTONE_FLASH_OPACITY); }
        }

        /**
         * タップ数をTIME_ATTACK_THRESHOLDSの閾値表で判定して報酬倍率を求め、報酬付与・自己ベスト更新・結果画面表示を行う。
         * @returns {void}
         */
        export function finishTimeAttack() {
            consumeMinigamePlay('timeattack');
            const taps = timeAttackState ? timeAttackState.taps : 0;
            timeAttackState = null;
            const found = TIME_ATTACK_THRESHOLDS.find(([min]) => taps >= min);
            const mult = found ? found[1] : CONFIG.TIME_ATTACK_DEFAULT_MULT;
            const reward = grantMinigameReward(mult);
            const isNewBest = taps > (minigameBests.timeattack || 0);
            if (isNewBest) { minigameBests.timeattack = taps; playAudioFile('audio/levelup.mp3'); saveGame(); screenFlash('#ffd700', CONFIG.TIME_ATTACK_BEST_FLASH_OPACITY); }
            showMinigameResult(`⏱️ タイムアタック結果`, `${taps}回タップ！${isNewBest ? '🎉自己ベスト更新！' : `（自己ベスト: ${minigameBests.timeattack}回）`}`, reward);
        }


/**
 * 稼働中のタップタイムアタックのタイマーを停止し、状態をリセットする。
 * ミニゲームセンターを離脱する際、core.jsのcleanupActiveMinigameTimers()から呼ばれる。
 * @returns {void}
 */
export function cleanupTimeAttackTimer() {
    if (timeAttackState && timeAttackState.timerId) {
        clearInterval(timeAttackState.timerId);
        timeAttackState = null;
    }
}
