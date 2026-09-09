/**
 * src/minigames/core.js
 * ミニゲームセンター共通のインフラ部分（センターの開閉、筐体タイル一覧の描画、
 * どのゲームを起動するかの振り分け、ミニゲームコイン・本日プレイ回数などの共有状態、
 * 各ゲーム共通の結果画面）を担当する。個々のミニゲームのルール自体は
 * quiz.js / timeAttack.js / concentration.js / mochitsuki.js / slotMachine.js に分かれている。
 *
 * 元は1つの巨大なminigames.jsファイル（2000行超）に全ゲームが同居していたものを、
 * ゲームごとに明確に境界が引けたため、役割単位でファイル分割した。
 * ロジック・処理内容・数値は一切変更していない（コードの再配置のみ。
 * 例外的に、他ファイルへ切り出した状態をこちらから直接書き換えられなくなった箇所だけ、
 * 各ゲーム側にcleanupXxxTimer()のような後始末専用の関数を新設し、
 * ここから呼び出す形に置き換えている＝処理の中身は完全に同じで、置き場所だけを変えた）。
 */

// 他ファイルへの依存はすべてこのimportに明示されている。書き換えが必要な値はsetXxx(...)という
// 関数呼び出しの形にしている（importした束縛には直接代入できないため。ESモジュールの仕様）。
import { ARCADE_CABINET_PARTS, stages } from '../../data.js?v=2026-09-09-003';
import {
  IS_DEV_MODE, PRESENT_REWARD_DISTANCE_RATE, PRESENT_REWARD_MIN, PRESENT_REWARD_MPS_RATE,
  playAudioFile, playBgmLoop
} from '../../main.js?v=2026-09-09-003';
import { currentStageIndex, getMinigameDailyLimit, prestigeShopLv, trackMissionEvent } from '../../progress.js?v=2026-09-09-003';
import { saveGame } from '../../state.js?v=2026-09-09-003';
import { getMps } from '../../tap.js?v=2026-09-09-003';
import { closeModal, getLocalDateString, openModal, openMoveMenu, updateDisplay } from '../../ui.js?v=2026-09-09-003';
import { startQuizGame } from './quiz.js?v=2026-09-09-003';
import { startTimeAttackGame, cleanupTimeAttackTimer } from './timeAttack.js?v=2026-09-09-003';
import { startConcentrationGame } from './concentration.js?v=2026-09-09-003';
import { startMochitsukiGame, cleanupMochitsukiTimer } from './mochitsuki.js?v=2026-09-09-003';
import { startSlotGame, cleanupSlotSpinState } from './slotMachine.js?v=2026-09-09-003';

        const CONFIG = {
            MINIGAME_CENTER_FADE_OUT_MS: 300,        // ミニゲームセンター開閉時、画面が暗転してから中身を切り替えるまでの時間
            MINIGAME_CENTER_FADE_IN_DELAY_MS: 150,   // 中身を切り替えた後、暗転を解除するまでの追加待ち時間
            MINIGAME_COIN_GAIN_BASE: 5,              // ミニゲームコイン計算の基礎倍率（multiplier×これ）
            MINIGAME_COIN_GAIN_MIN: 1,               // ミニゲームコインの最低獲得枚数
            MINIGAME_REWARD_PER_PRESTIGE_LEVEL: 0.01, // 転生ショップ「ミニゲーム報酬」1レベルごとの倍率上昇分
        };

        /**
         * 転生ショップの「ミニゲーム報酬」強化レベルから、ミニゲーム報酬に掛ける倍率を計算する。
         * @returns {number} 報酬倍率（1.0が等倍）
         */
        export function getMinigameRewardMultiplier() { return 1 + prestigeShopLv.minigameReward * CONFIG.MINIGAME_REWARD_PER_PRESTIGE_LEVEL; }      // ミニゲーム報酬の倍率

        export const minigames = {
            quiz:          { id: "quiz",          name: "ご当地クイズ",         icon: "🗾", unlockStage: 0 },
            timeattack:    { id: "timeattack",    name: "タップタイムアタック", icon: "⏱️", unlockStage: 0 },
            concentration: { id: "concentration", name: "ご当地神経衰弱",       icon: "🃏", unlockStage: 0 },
            mochitsuki:    { id: "mochitsuki",    name: "もちつきリズム",       icon: "🍡", unlockStage: 0 },
            slot:          { id: "slot",          name: "スロット",            icon: "🎰", unlockStage: 0, isCoinGame: true }
        };
        export let minigameLastResetDate = null;
        export let minigamePlaysUsedToday = { quiz: 0, timeattack: 0, concentration: 0, mochitsuki: 0, slot: 0 };
        export let minigameSeenUnlocked = { quiz: false, timeattack: false, concentration: false, mochitsuki: false, slot: false }; // 「新しく解放された」ハイライトを、一度見たら消すためのフラグ
        export let minigameBests = { timeattack: 0, concentration: null }; // concentration=最少手数(小さいほど良い)

        // ===================================================================
        // 🏅 県内ランキング＆トロフィーシステム
        // ===================================================================
        // prefTaps[i]: その県に滞在中(selectedStageIndex===i)にタップした累計回数。
        // 過去に訪れた県に戻ってタップしても加算され続ける（進行用のcurrentStageProgressとは別管理）。
        export let isMinigameActive = false; // 立っている間はメインのタップ判定を無視する
        /**
         * 現在の県の距離と秒速タップ数(mps)から、ミニゲームの基礎報酬額を計算する。
         * @returns {number} 基礎報酬額
         */
        export function getMinigameBaseReward() {
            const currentStage = stages[currentStageIndex] || stages[0];
            return Math.max(PRESENT_REWARD_MIN, Math.floor(currentStage.distance * PRESENT_REWARD_DISTANCE_RATE) + Math.floor(getMps() * PRESENT_REWARD_MPS_RATE));
        }

        /**
         * 解放済みのミニゲームのうち、まだ「新着」表示を見ていないものが1つでもあるかを判定する。
         * @returns {boolean} 新着の未確認ミニゲームがあればtrue
         */
        export function hasNewlyUnlockedMinigame() {
            return Object.values(minigames).some(g => currentStageIndex >= g.unlockStage && !minigameSeenUnlocked[g.id]);
        }
        /**
         * ローカル日付が前回リセット時と変わっていたら、本日プレイ回数を全て0にリセットして保存する。
         * @returns {void}
         */
        export function resetMinigameCountsIfNewDay() {
            const today = getLocalDateString(new Date());
            if (minigameLastResetDate !== today) {
                minigameLastResetDate = today;
                minigamePlaysUsedToday = { quiz: 0, timeattack: 0, concentration: 0, mochitsuki: 0, slot: 0 };
                saveGame();
            }
        }

        /**
         * 画面を黒くフェードさせてからミニゲームセンターのモーダルを開き、タイル一覧を描画してBGMを切り替える。
         * @returns {void}
         */
        export function openMinigameCenter() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3'); // 県移動の時と同じ、移動音
            overlay.classList.add('fade-black');
            setTimeout(() => {
                resetMinigameCountsIfNewDay();
                document.getElementById('minigame-play-view').style.display = 'none';
                document.getElementById('minigame-tile-view').style.display = 'flex';
                renderMinigameTiles();
                openModal('minigame-center-modal');
                playBgmLoop('audio/bgm/bgm_minigame.mp3'); // ゲームセンター専用BGMに切り替え
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.MINIGAME_CENTER_FADE_IN_DELAY_MS);
            }, CONFIG.MINIGAME_CENTER_FADE_OUT_MS);
        }

        /**
         * プレイ中ならタイル選択画面に戻すだけに留め、そうでなければモーダルを閉じて通常BGMに戻す。
         * @returns {void}
         */
        export function closeMinigameCenter() {
            if (isMinigameActive) {
                endMinigameToTiles(); // プレイ中は、まず1つ前のミニゲーム選択画面に戻すだけ
                return;
            }
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                cleanupActiveMinigameTimers();
                closeModal('minigame-center-modal');
                playBgmLoop('audio/bgm/bgm.mp3'); // 通常のBGMに戻す
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.MINIGAME_CENTER_FADE_IN_DELAY_MS);
            }, CONFIG.MINIGAME_CENTER_FADE_OUT_MS);
        }

        // タイムアタック/もちつきのタイマーやアニメーションを、離脱時に必ず止めるための後始末
        /**
         * タイムアタックのタイマー、もちつきのアニメーション、スロットの回転など、稼働中のタイマー/演出をまとめて停止する。
         * @returns {void}
         */
        export function cleanupActiveMinigameTimers() {
            // 🔀 各ゲームの後始末は、それぞれの状態を持つファイル自身にしかできない
            // （importした変数には直接代入できないため）。ここでは3つを順に呼ぶだけ。
            // 処理の中身自体は分割前と完全に同じ（タイムアタックのタイマー停止／
            // もちつきのアニメーション停止／スロットの回転停止とループ音停止）。
            cleanupTimeAttackTimer();
            cleanupMochitsukiTimer();
            cleanupSlotSpinState();
        }

        /**
         * ARCADE_CABINET_PARTSの座標データをもとに各ミニゲーム筐体イラストを配置し、鍵/コイン数/残り回数のバッジを表示する。
         * @returns {void}
         */
        export function renderMinigameTiles() {
            const container = document.getElementById('minigame-tile-view');
            // 調整パネル・ハンドルは残しつつ、筐体イラストだけ作り直す（毎回呼ばれるため、既存の筐体要素は先に消す）
            container.querySelectorAll('.arcade-cabinet-wrap').forEach(el => el.remove());

            ARCADE_CABINET_PARTS.forEach(part => {
                const g = minigames[part.gameId];
                if (!g) return;
                const locked = currentStageIndex < g.unlockStage;
                const usedToday = minigamePlaysUsedToday[g.id] || 0;
                const remaining = getMinigameDailyLimit() - usedToday;

                const wrap = document.createElement('div');
                wrap.className = 'arcade-cabinet-wrap';
                wrap.id = part.id;
                wrap.style.cssText = `position:absolute; top:${part.top}%; left:${part.left}%; width:${part.width}%; height:${part.height}%;`;

                const img = document.createElement('img');
                img.src = part.img;
                img.alt = g.name;
                img.style.cssText = 'width:100%; height:100%; object-fit:contain; display:block;';

                let badgeHtml = '';
                if (locked) {
                    const reqName = stages[g.unlockStage] ? stages[g.unlockStage].name : "???";
                    wrap.style.filter = 'grayscale(1) brightness(0.6)';
                    badgeHtml = `<div class="arcade-cabinet-badge">🔒「${reqName}」到達で解放</div>`;
                } else if (g.isCoinGame) {
                    if (!minigameSeenUnlocked[g.id]) wrap.classList.add('minigame-recommend-glow');
                    wrap.onclick = () => startMinigame(g.id);
                    badgeHtml = `<div class="arcade-cabinet-badge" style="color:#7b1fa2;">🪙 ${IS_DEV_MODE ? '∞' : minigameCoins} 所持</div>`;
                } else if (remaining <= 0) {
                    wrap.style.filter = 'grayscale(1) brightness(0.75)';
                    badgeHtml = `<div class="arcade-cabinet-badge">本日は終了！</div>`;
                } else {
                    if (!minigameSeenUnlocked[g.id]) wrap.classList.add('minigame-recommend-glow');
                    wrap.onclick = () => startMinigame(g.id);
                    badgeHtml = `<div class="arcade-cabinet-badge" style="color:#26a69a;">本日 ${usedToday}/${getMinigameDailyLimit()}回</div>`;
                }
                wrap.appendChild(img);
                wrap.insertAdjacentHTML('beforeend', badgeHtml);
                container.appendChild(wrap);
            });
        }

        /**
         * 1日の残りプレイ回数を確認してから、指定idに応じて各ゲームのstart関数を呼び分け、プレイ画面に切り替える。
         * @param {string} id - ミニゲームID（quiz/timeattack/concentration/mochitsuki/slot）
         * @returns {void}
         */
        export function startMinigame(id) {
            const g = minigames[id];
            if (!g.isCoinGame && (minigamePlaysUsedToday[id] || 0) >= getMinigameDailyLimit()) return;
            if (!minigameSeenUnlocked[id]) { minigameSeenUnlocked[id] = true; saveGame(); }
            document.getElementById('minigame-tile-view').style.display = 'none';
            const playView = document.getElementById('minigame-play-view');
            playView.style.display = 'block';
            playView.style.background = 'rgba(255,248,236,0.95)'; // slotが透明にするので、他のゲームに移る時は毎回既定値へ戻す
            isMinigameActive = true;
            if (id === 'quiz') startQuizGame(playView);
            else if (id === 'timeattack') startTimeAttackGame(playView);
            else if (id === 'concentration') startConcentrationGame(playView);
            else if (id === 'mochitsuki') startMochitsukiGame(playView);
            else if (id === 'slot') startSlotGame(playView);
        }

        /**
         * 稼働中タイマーを後始末してからプレイ中フラグを下ろし、タイル選択画面に戻す。
         * @returns {void}
         */
        export function endMinigameToTiles() {
            cleanupActiveMinigameTimers();
            isMinigameActive = false;
            document.getElementById('minigame-play-view').style.display = 'none';
            document.getElementById('minigame-tile-view').style.display = 'flex';
            renderMinigameTiles();
        }
        window.endMinigameToTiles = endMinigameToTiles; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 指定ゲームの本日プレイ回数を1加算して保存する。
         * @param {string} id - ミニゲームID
         * @returns {void}
         */
        export function consumeMinigamePlay(id) {
            minigamePlaysUsedToday[id] = (minigamePlaysUsedToday[id] || 0) + 1;
            saveGame();
        }

        // 🎮 ミニゲームコイン：もちとは別に、ミニゲーム専用の景品交換に使う予定の通貨（ガチャコインと同じく価値が目減りしない）
        export let minigameCoins = 0;
        /**
         * 出来栄えの倍率からミニゲームコインの獲得枚数を計算する。最低枚数は保証し、転生ショップの強化倍率も乗算する。
         * @param {number} multiplier - 出来栄えの倍率
         * @returns {number} 獲得するミニゲームコイン枚数
         */
        export function getMinigameCoinGain(multiplier) {
            return Math.max(CONFIG.MINIGAME_COIN_GAIN_MIN, Math.round(multiplier * CONFIG.MINIGAME_COIN_GAIN_BASE * getMinigameRewardMultiplier())); // 出来が良いほど多くもらえるが、最低1枚は必ずもらえる。転生ショップの「ミニゲーム報酬」強化もここに乗る
        }

        /**
         * ミニゲームコインを加算し、関連するミッション進捗を記録して保存・画面更新を行う共通の報酬付与処理。
         * @param {number} multiplier - 出来栄えの倍率
         * @returns {Object} { coins: number } 付与したコイン枚数
         */
        export function grantMinigameReward(multiplier) {
            const coinGain = getMinigameCoinGain(multiplier);
            minigameCoins += coinGain;
            trackMissionEvent('minigamesPlayedTotal', 1); trackMissionEvent('minigamesToday', 1); trackMissionEvent('minigamesThisWeek', 1);
            saveGame(); updateDisplay();
            return { coins: coinGain };
        }

        /**
         * プレイ画面のDOMを結果表示用HTMLに差し替え、タイトル・詳細・獲得コイン数を表示する共通の結果画面。
         * @param {string} title - 結果画面のタイトル
         * @param {string} detail - 結果の詳細テキスト
         * @param {Object} reward - grantMinigameReward()が返した報酬オブジェクト（coinsを持つ）
         * @returns {void}
         */
        export function showMinigameResult(title, detail, reward) {
            isMinigameActive = false; // 結果画面ではメイン画面のタップ判定を戻してもよい
            playAudioFile('audio/levelup.mp3');
            const container = document.getElementById('minigame-play-view');
            container.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <div style="font-size:1.8rem; margin-bottom:8px;">🎉</div>
                    <div style="font-weight:bold; font-size:1.05rem; margin-bottom:6px;">${title}</div>
                    <div style="color:#5d4037; margin-bottom:10px; font-size:0.9rem;">${detail}</div>
                    <div style="font-weight:bold; color:#7b1fa2; font-size:1.2rem; margin-bottom:16px;">🎮 +${reward.coins} ミニゲームコイン獲得！</div>
                    <button class="item-action-btn btn-red" style="width:100%;" onclick="endMinigameToTiles()">もどる</button>
                </div>`;
        }


        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        /**
         * ミニゲームの自己ベスト記録を書き換える（他ファイルからのsetter）。
         * @param {object} v - 新しい自己ベスト記録（{timeattack, concentration}）
         * @returns {void}
         */
        export function setMinigameBests(v) { minigameBests = v; }
        /**
         * ミニゲームコインの所持数を書き換える（他ファイルからのsetter）。
         * @param {number} v - 新しいミニゲームコインの枚数
         * @returns {void}
         */
        export function setMinigameCoins(v) { minigameCoins = v; }
        /**
         * ミニゲームの「1日の回数制限」を最後にリセットした日付を書き換える（他ファイルからのsetter）。
         * @param {string|null} v - 新しい最終リセット日（YYYY-MM-DD形式の文字列など）
         * @returns {void}
         */
        export function setMinigameLastResetDate(v) { minigameLastResetDate = v; }
        /**
         * 各ミニゲームの、今日すでに使ったプレイ回数を書き換える（他ファイルからのsetter）。
         * @param {object} v - ミニゲームIDごとの本日消化回数
         * @returns {void}
         */
        export function setMinigamePlaysUsedToday(v) { minigamePlaysUsedToday = v; }
        /**
         * 各ミニゲームの「新規解放」ハイライトを見たかどうかのフラグを書き換える（他ファイルからのsetter）。
         * @param {object} v - ミニゲームIDごとの既読フラグ
         * @returns {void}
         */
        export function setMinigameSeenUnlocked(v) { minigameSeenUnlocked = v; }

        // window橋渡し：ここから下は、index.htmlのonclick=""（静的または動的に生成される
        // 文字列の両方）から直接呼ばれる関数を中心に、window経由のアクセスがまだ必要なものをまとめている。
        // ブラウザはonclick="foo()"の実行時にwindow.fooを探すため、橋渡しが無いとボタンを押しても
        // 静かに何も起きない（実際にこれで一度事故を起こした。解体新書 第9章参照）。削除する時は、
        // 他ファイルからのimport参照・index.html内の静的onclick・動的に組み立てられるonclick文字列の
        // 3経路すべてを確認すること。
        window.openMinigameCenter = openMinigameCenter;
        window.closeMinigameCenter = closeMinigameCenter;
