/**
 * src/minigames/mochitsuki.js
 * ミニゲーム「🍡もちつきリズム」本体。流れてくる判定帯に合わせてタップするリズムゲーム。
 * 元は他の4ゲームと同じくminigames.js内にあったものを、ゲーム単位でファイル分割した
 * （ロジック・数値は一切変更していない。コードの再配置のみ）。
 *
 * cleanupMochitsukiTimer()は、分割にあたって新設した関数：離脱時のアニメーション後始末は
 * 以前はcore側のcleanupActiveMinigameTimers()が直接mochitsukiStateを書き換えていたが、
 * ファイルが分かれるとimportした変数には直接代入できない（ESモジュールの仕様）ため、
 * この状態を持つ本ファイル自身に後始末専用の関数として切り出した。処理の中身は同じ。
 */

import { pickRandom, playAudioFile, screenFlash, screenShake, spawnModalParticleBurst, vibrate } from '../../main.js?v=2026-09-10-001';
import { showMochiComment } from '../../ui.js?v=2026-09-10-001';
import { consumeMinigamePlay, grantMinigameReward, showMinigameResult } from './core.js?v=2026-09-10-001';

        const CONFIG = {
            MOCHI_BAND_OPACITY: 0.35,           // 判定帯（トラック上の色付きゾーン）の透明度
            MOCHI_MISS_COMMENT_CHANCE: 0.4,     // MISS時に、もちすけのコメントを出す確率
            MOCHI_STREAK_DISPLAY_THRESHOLD: 3,  // 連続成功を「🔥N連続！」と表示し始める閾値
            MOCHI_STREAK_MILESTONE: 5,          // 何連続ごとに、演出をもう一段派手にするか
            MOCHI_FINISH_DELAY_MS: 400,         // 最終拍のタップから結果画面へ進むまでの間
            MOCHI_PERFECT_VIBRATE_MS: 25,       // PERFECT判定時のバイブ時間
            MOCHI_GREAT_VIBRATE_MS: 15,         // GREAT判定時のバイブ時間
            MOCHI_PERFECT_FLASH_OPACITY: 0.28,  // PERFECT判定時の画面フラッシュの強さ
        };

        // -------------------------------------------------------------
        // 🍡 ④ もちつきリズム
        // -------------------------------------------------------------
        export const MOCHITSUKI_BEATS = 12;
        export const MOCHITSUKI_INITIAL_PERIOD_MS = 950; // 最初の速さ（半周期）※以前の1100msより少し速いスタートに
        export const MOCHITSUKI_MIN_PERIOD_MS = 340;       // どれだけ速くなっても、これ以上は速くならない下限（以前より速い上限速度）
        export const MOCHITSUKI_SPEEDUP_RATE = 0.90;       // タップ毎に前回の何倍の速さになるか（小さいほど加速が急。以前より加速アップ）
        // 判定ランク定義（中央からの誤差%が小さい順、左右対称）。ここを調整するだけで難易度・演出のバランスを変えられます。
        // range: この誤差(%)以内ならこのランク／color: 判定文字＆パーティクル色／particles: 弾けるパーティクル数／weight: 得点への重み
        export const MOCHITSUKI_RANKS = [
            { name: 'PERFECT', range: 3,  color: '#ffd700', particles: 10, weight: 1.6, gold: true  },
            { name: 'GREAT',   range: 7,  color: '#ff5722', particles: 7,  weight: 1.2, gold: false },
            { name: 'GOOD',    range: 12, color: '#4caf50', particles: 4,  weight: 0.8, gold: false },
            { name: 'OK',      range: 19, color: '#2196f3', particles: 2,  weight: 0.4, gold: false },
            { name: 'MISS',    range: Infinity, color: '#999', particles: 0, weight: 0.1, gold: false }
        ];
        export const MOCHITSUKI_REWARD_CAP = 1.6;
        export let mochitsukiState = null;

        // MOCHITSUKI_RANKSから帯を自動生成するので、判定ロジックと見た目のズレ（対称性の崩れ）が原理的に起きない
        /**
         * MOCHITSUKI_RANKSの各ランクのrange値から、判定帯（トラック上の色付きゾーン）のHTMLを自動生成する。
         * @returns {string} 判定帯のHTML文字列
         */
        export function buildMochitsukiBandsHtml() {
            const finite = MOCHITSUKI_RANKS.filter(r => isFinite(r.range)).slice().sort((a, b) => b.range - a.range);
            return finite.map(r => {
                const width = r.range * 2;
                const left = 50 - r.range;
                const rgba = hexToRgba(r.color, CONFIG.MOCHI_BAND_OPACITY);
                return `<div style="position:absolute; left:${left}%; width:${width}%; height:100%; background:${rgba};"></div>`;
            }).join('');
        }

        /**
         * "#rrggbb"形式の16進カラーコードをrgba()文字列に変換する汎用ユーティリティ。
         * @param {string} hex - "#rrggbb"形式の16進カラーコード
         * @param {number} alpha - 透明度(0〜1)
         * @returns {string} rgba(...)形式の文字列
         */
        export function hexToRgba(hex, alpha) {
            const h = hex.replace('#', '');
            const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        /**
         * もちつきリズムの状態を初期化し、判定帯・インジケーター・タップボタンを含む画面を構築してアニメーションループを開始する。
         * @param {HTMLElement} container - 描画先のコンテナ要素
         * @returns {void}
         */
        export function startMochitsukiGame(container) {
            mochitsukiState = { beat: 0, counts: {}, startTime: null, animId: null, periodMs: MOCHITSUKI_INITIAL_PERIOD_MS, streak: 0, bestStreak: 0 };
            MOCHITSUKI_RANKS.forEach(r => mochitsukiState.counts[r.name] = 0);
            container.innerHTML = `
                <div style="min-height:100%; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; text-align:center; padding:14px; background:radial-gradient(circle at 50% 15%, #fff3e0, #fffdf9); border-radius:20px;">
                    <div style="font-size:2.6rem; margin-bottom:6px;">🍡</div>
                    <div style="font-weight:900; font-size:1.15rem; margin-bottom:10px; color:#5d4037;">もちつきリズム</div>
                    <div style="font-size:0.85rem; color:#5d4037; margin-bottom:10px; line-height:1.5;">インジケーターが中央に来た瞬間にタップ！<br>タップ毎にどんどん速くなるで（${MOCHITSUKI_BEATS}拍）</div>
                    <div id="mochi-beat-count" style="font-size:0.85rem; color:#999; margin-bottom:6px;">1 / ${MOCHITSUKI_BEATS}拍</div>
                    <div id="mochi-streak-text" style="font-size:0.8rem; font-weight:bold; color:#ff9800; height:1.3em; margin-bottom:10px;"></div>
                    <div id="mochi-track" style="position:relative; width:100%; max-width:320px; height:62px; margin:0 auto 20px; background:linear-gradient(#fffaf0,#fdf3e0); border-radius:32px; overflow:hidden; border:4px solid #ffd699; box-shadow:inset 0 2px 6px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.1);">
                        ${buildMochitsukiBandsHtml()}
                        <div id="mochi-indicator" style="position:absolute; top:6px; width:48px; height:48px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #ff8a5c, #ff5722); box-shadow:0 3px 6px rgba(0,0,0,0.35), 0 0 10px rgba(255,87,34,0.5);"></div>
                    </div>
                    <div id="mochi-judge-text" style="font-size:1.8rem; font-weight:900; height:42px; margin-bottom:14px;"></div>
                    <button id="mochi-tap-btn" style="width:100%; padding:22px; border-radius:18px; border:none;
                        background:radial-gradient(circle at 30% 20%, #4dd0c4, #26a69a 65%, #1c8579);
                        color:#fff; font-weight:900; font-size:1.2rem; box-shadow:0 6px 14px rgba(0,0,0,0.25), inset 0 -4px 8px rgba(0,0,0,0.15); border:2px solid #fff;">タップ！</button>
                </div>`;
            mochitsukiState.startTime = performance.now();
            document.getElementById('mochi-tap-btn').addEventListener('pointerdown', onMochitsukiTap);
            animateMochitsukiIndicator();
        }

        /**
         * 経過時間と半周期(periodMs)から、三角波の要領でインジケーターの水平位置(0〜100%、50%が中央)を計算する純粋関数。
         * @param {number} elapsedMs - 経過時間(ms)
         * @param {number} periodMs - 半周期(ms)
         * @returns {number} インジケーターの水平位置(0〜100)
         */
        export function getMochitsukiIndicatorPercent(elapsedMs, periodMs) {
            const t = elapsedMs % (periodMs * 2);
            return t < periodMs ? (t / periodMs) * 100 : 100 - ((t - periodMs) / periodMs) * 100;
        }

        /**
         * requestAnimationFrameで自分自身を繰り返し呼び出しながら、インジケーターのDOM位置をフレーム毎に更新し続ける。
         * @returns {void}
         */
        export function animateMochitsukiIndicator() {
            if (!mochitsukiState) return;
            const el = document.getElementById('mochi-indicator');
            const track = el ? el.parentElement : null;
            if (el && track) {
                const elapsed = performance.now() - mochitsukiState.startTime;
                const percent = getMochitsukiIndicatorPercent(elapsed, mochitsukiState.periodMs);
                const trackWidth = track.clientWidth;
                el.style.left = Math.max(0, Math.min(trackWidth - 48, (percent / 100) * trackWidth - 24)) + 'px';
            }
            mochitsukiState.animId = requestAnimationFrame(animateMochitsukiIndicator);
        }

        /**
         * タップ時点のインジケーター位置から誤差を求めてランク判定し、演出を出しつつ次のタップに向けて速度を上げる。
         * @param {Event} e - pointerdownイベント
         * @returns {void}
         */
        export function onMochitsukiTap(e) {
            e.preventDefault();
            if (!mochitsukiState) return;
            const elapsed = performance.now() - mochitsukiState.startTime;
            const percent = getMochitsukiIndicatorPercent(elapsed, mochitsukiState.periodMs);
            const diff = Math.abs(percent - 50);
            const rank = MOCHITSUKI_RANKS.find(r => diff <= r.range);
            mochitsukiState.counts[rank.name]++;

            // 判定文字を毎回アニメーションさせつつ表示
            const judgeEl = document.getElementById('mochi-judge-text');
            if (judgeEl) {
                judgeEl.innerText = rank.name;
                judgeEl.style.color = rank.color;
                judgeEl.style.textShadow = rank.gold ? '0 0 10px rgba(255,215,0,0.8)' : 'none';
                judgeEl.classList.remove('mochi-judge-pop'); void judgeEl.offsetWidth; judgeEl.classList.add('mochi-judge-pop');
            }

            const track = document.getElementById('mochi-track');
            if (rank.name === 'MISS') {
                // ミス：連続記録をリセットし、トラックが軽くよろける演出＋もちすけの反応
                mochitsukiState.streak = 0;
                if (track) { track.classList.remove('mochi-track-miss'); void track.offsetWidth; track.classList.add('mochi-track-miss'); }
                if (Math.random() < CONFIG.MOCHI_MISS_COMMENT_CHANCE) showMochiComment(pickRandom(["あちゃー！", "むむっ、ズレたで！", "おっと〜！"]));
            } else {
                mochitsukiState.streak++;
                mochitsukiState.bestStreak = Math.max(mochitsukiState.bestStreak, mochitsukiState.streak);
                if (rank.name === 'PERFECT') {
                    playAudioFile('audio/critical.mp3'); vibrate(CONFIG.MOCHI_PERFECT_VIBRATE_MS);
                    screenFlash('#ffd700', CONFIG.MOCHI_PERFECT_FLASH_OPACITY);
                    if (track) { track.classList.remove('mochi-track-glow'); void track.offsetWidth; track.classList.add('mochi-track-glow'); }
                } else if (rank.name === 'GREAT') {
                    playAudioFile('audio/critical.mp3', 0.4); vibrate(CONFIG.MOCHI_GREAT_VIBRATE_MS);
                } else {
                    playAudioFile('audio/tap.mp3');
                }
                // 3連続以上決まったら節目としてもう一段派手にする
                if (mochitsukiState.streak > 0 && mochitsukiState.streak % CONFIG.MOCHI_STREAK_MILESTONE === 0) {
                    screenShake('small'); vibrate([20, 30, 20]);
                }
            }

            const streakEl = document.getElementById('mochi-streak-text');
            if (streakEl) streakEl.innerText = mochitsukiState.streak >= CONFIG.MOCHI_STREAK_DISPLAY_THRESHOLD ? `🔥 ${mochitsukiState.streak}連続！` : '';

            // 判定ランクに応じて、バーがあった位置からパーティクルが複数個弾ける
            // （#particle-canvasはモーダルの下に隠れて見えなくなるため、モーダル内で完結する専用の演出を使う）
            const indicatorEl = document.getElementById('mochi-indicator');
            if (indicatorEl && rank.particles > 0) {
                const rect = indicatorEl.getBoundingClientRect();
                spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, rank.particles, rank.color);
            }

            // タップ毎にバーがどんどん速くなる（下限あり）。位置は今いる場所からそのまま繋げて、
            // 左端に戻らず同じ向きに進み続けるよう、新しい速さに合わせた経過時間を逆算する
            const oldElapsed = performance.now() - mochitsukiState.startTime;
            const oldPeriod = mochitsukiState.periodMs;
            const curPercent = getMochitsukiIndicatorPercent(oldElapsed, oldPeriod);
            const wasIncreasing = (oldElapsed % (oldPeriod * 2)) < oldPeriod;

            mochitsukiState.periodMs = Math.max(MOCHITSUKI_MIN_PERIOD_MS, mochitsukiState.periodMs * MOCHITSUKI_SPEEDUP_RATE);
            const newPeriod = mochitsukiState.periodMs;
            const newElapsed = wasIncreasing
                ? (curPercent / 100) * newPeriod
                : newPeriod + ((100 - curPercent) / 100) * newPeriod;
            mochitsukiState.startTime = performance.now() - newElapsed;

            mochitsukiState.beat++;
            if (mochitsukiState.beat >= MOCHITSUKI_BEATS) {
                cancelAnimationFrame(mochitsukiState.animId);
                document.getElementById('mochi-tap-btn').removeEventListener('pointerdown', onMochitsukiTap);
                setTimeout(() => finishMochitsuki(), CONFIG.MOCHI_FINISH_DELAY_MS);
            } else {
                const beatEl = document.getElementById('mochi-beat-count');
                if (beatEl) beatEl.innerText = `${mochitsukiState.beat + 1} / ${MOCHITSUKI_BEATS}拍`;
            }
        }

        /**
         * 各ランクの出現回数×重みの合計を拍数で割った加重平均から報酬倍率を計算し、報酬付与と結果画面表示を行う。
         * @returns {void}
         */
        export function finishMochitsuki() {
            consumeMinigamePlay('mochitsuki');
            const st = mochitsukiState;
            const weightedSum = MOCHITSUKI_RANKS.reduce((sum, r) => sum + st.counts[r.name] * r.weight, 0);
            const mult = Math.min(MOCHITSUKI_REWARD_CAP, weightedSum / MOCHITSUKI_BEATS);
            mochitsukiState = null;
            const reward = grantMinigameReward(mult);
            const summary = MOCHITSUKI_RANKS.map(r => `${r.name}:${st.counts[r.name]}`).join(' ') + (st.bestStreak >= CONFIG.MOCHI_STREAK_DISPLAY_THRESHOLD ? ` ／ 最大${st.bestStreak}連続！` : '');
            showMinigameResult(`🍡 もちつきリズム結果`, summary, reward);
        }

        // ===================================================================
        // 🎰 スロット（コインを賭けて遊ぶ、1日の回数制限が無いゲーム）
        // レバーを引く→3つのリールが回る→3つのボタンで1つずつ自分で止める、という本格仕様
        // ===================================================================

/**
 * 稼働中のもちつきリズムのアニメーションフレームを停止し、状態をリセットする。
 * ミニゲームセンターを離脱する際、core.jsのcleanupActiveMinigameTimers()から呼ばれる。
 * @returns {void}
 */
export function cleanupMochitsukiTimer() {
    if (mochitsukiState && mochitsukiState.animId) {
        cancelAnimationFrame(mochitsukiState.animId);
        mochitsukiState = null;
    }
}
