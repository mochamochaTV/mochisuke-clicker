/**
 * src/minigames/slotMachine.js
 * ミニゲーム「🎰スロット」本体。ミニゲームコインを賭けて遊ぶ、1日の回数制限が無いコインゲーム。
 * レバー演出・リール停止・リーチ判定・配当計算・マーモット（大当たり）演出、および
 * 開発者用の位置調整ツール一式を含む。5つのミニゲームの中でも突出して規模が大きく、
 * 演出も独立しているため、他の4ゲームとは別ファイルに分けている。
 * 元は他の4ゲームと同じくminigames.js内にあったものを、ゲーム単位でファイル分割した
 * （ロジック・数値は一切変更していない。コードの再配置のみ。
 * 例外的に、minigameCoinsがcore.js側の変数になったことに伴い、直接代入していた2箇所
 * （コイン投入時の減算・払い出し時の加算）だけを、既存のsetMinigameCoins()セッター
 * 経由の書き換えに直している＝計算結果は完全に同じ）。
 *
 * cleanupSlotSpinState()は、分割にあたって新設した関数：離脱時の回転停止処理は
 * 以前はcore側のcleanupActiveMinigameTimers()が直接slotIsSpinning等を書き換えていたが、
 * ファイルが分かれるとimportした変数には直接代入できない（ESモジュールの仕様）ため、
 * この状態を持つ本ファイル自身に後始末専用の関数として切り出した。処理の中身は同じ。
 */

import {
  IS_DEV_MODE, getAudioContext, loadAudioBuffer, playAudioFile, playAudioFilePitched,
  screenFlash, sfxVolumeMult, vibrate
} from '../../main.js?v=2026-09-10-001';
import { gachaCoins, setGachaCoins, trackMissionEvent } from '../../progress.js?v=2026-09-10-001';
import { saveGame } from '../../state.js?v=2026-09-10-001';
import { updateDisplay } from '../../ui.js?v=2026-09-10-001';
import { minigameCoins, setMinigameCoins } from './core.js?v=2026-09-10-001';

        const CONFIG = {
            SLOT_STRIP_LANDING_MARGIN: 2,          // リールが止まる位置を、帯の最後から何周ぶん手前にするか
            SLOT_LEVER_PULL_ANIM_MS: 550,          // レバーが倒れて戻るアニメーションの時間
            SLOT_LEVER_TILT_DEGREES: 180,          // レバーを引いた時に倒れる角度
            SLOT_REEL_SPIN_LOOP_MS: 550,           // リールが1周ぶん回転して見えるアニメーションの周期
            SLOT_STOP_FLASH_MS: 300,               // 「止める」ボタンを押した瞬間のフラッシュ演出の時間
            SLOT_REACH_CHECK_DELAY_MS: 250,        // 2列目が止まってから、リーチ判定を行うまでの間
            SLOT_RESULT_EVALUATE_DELAY_MS: 300,    // 3列目が止まってから、最終判定を行うまでの間
            SLOT_REPLAY_REACH_VALUE: 1,            // リーチ比較で、リプレイ絵柄に割り当てる仮の価値
            SLOT_CUTIN_DURATION_MS: 900,           // カットイン演出の表示時間
            SLOT_COIN_INSERT_ANIM_MS: 380,         // コイン投入アニメーションの時間
            SLOT_COIN_INSERT_START_OFFSET_PCT: 15, // コイン投入アニメーションの、投入口からの開始位置オフセット(%)
            SLOT_COIN_INSERT_LEVER_GLOW_DELAY_MS: 300, // コイン投入後、レバーを光らせて誘導するまでの間
            SLOT_PAYOUT_COIN_STAGGER_MS: 45,       // 払い出しコインを1枚ずつ生成する間隔
            SLOT_PAYOUT_COIN_FALL_DURATION_MS: 650,         // 払い出しコインが落ちきるまでの基本時間
            SLOT_PAYOUT_COIN_FALL_DURATION_VARIANCE_MS: 200, // 払い出しコインの落下時間のランダムなばらつき幅
            SLOT_PAYOUT_COIN_DX_RANGE: 40,         // 払い出しコインが左右に散らばる幅
            SLOT_PAYOUT_COIN_ROTATION_RANGE: 540,  // 払い出しコインが回転する角度の幅
            SLOT_PAYOUT_COIN_PITCH_JITTER: 0.1,    // 払い出しコインの効果音ピッチのランダムなばらつき幅
            SLOT_PAYOUT_POPUP_ANIM_MS: 450,        // 獲得枚数ポップアップがバウンドするアニメーションの時間
            SLOT_PAYOUT_EXTRA_COINS_PER_LINE: 3,   // 複数ライン同時成立時、1ライン増えるごとに追加する演出コイン枚数
            SLOT_WIN_TIER_HIGH_PAYOUT: 60,         // 「7」クラス（最上位級）とみなす配当の閾値
            SLOT_WIN_TIER_MID_PAYOUT: 25,          // 「トリプルBAR」クラスとみなす配当の閾値
            SLOT_WIN_TIER_LOW_PAYOUT: 10,          // 「BAR」クラス（＝ビッグリーチ）とみなす配当の閾値
            SLOT_PAYOUT_COIN_COUNT_TIER_HIGH: 18,  // 最上位級が揃った時に降らせるコイン枚数
            SLOT_PAYOUT_COIN_COUNT_TIER_MID: 10,   // トリプルBARクラスが揃った時に降らせるコイン枚数
            SLOT_PAYOUT_COIN_COUNT_TIER_LOW: 6,    // BARクラスが揃った時に降らせるコイン枚数
            SLOT_PAYOUT_COIN_COUNT_TIER_MIN: 3,    // それ以外が揃った時に降らせるコイン枚数
            SLOT_PAYOUT_PITCH_TIER_HIGH: 1.35,     // 最上位級のコイン音ピッチ
            SLOT_PAYOUT_PITCH_TIER_MID: 1.2,       // トリプルBARクラスのコイン音ピッチ
            SLOT_PAYOUT_PITCH_TIER_LOW: 1.1,       // BARクラスのコイン音ピッチ
            SLOT_PAYOUT_PITCH_TIER_MIN: 1.0,       // それ以外のコイン音ピッチ
            SLOT_WIN_FLASH_OPACITY_HIGH: 0.55,     // トリプルBAR以上が揃った時の画面フラッシュの強さ
            SLOT_WIN_FLASH_OPACITY_NORMAL: 0.3,    // それ以外が揃った時の画面フラッシュの強さ
            SLOT_JACKPOT_BONUS_GACHA_COINS: 30,    // マーモット的中時に、おまけで付与するガチャコインの枚数
            SLOT_MARMOT_TEXT_STAGGER_BASE_MS: 300,   // マーモット演出、最初のテキストが浮き出るまでの時間
            SLOT_MARMOT_TEXT_STAGGER_STEP_MS: 200,   // マーモット演出、テキストが1行ずつ浮き出る間隔
            SLOT_MARMOT_OVERLAY_FADE_MS: 400,        // マーモット演出のオーバーレイを閉じるフェード時間
            SLOT_REEL_STOP_VIBRATE_MS: 10,           // リールを1つ止めた瞬間のバイブ時間
            SLOT_JACKPOT_FLASH_OPACITY: 0.75,        // マーモット（大当たり）確定時の画面フラッシュの強さ
            SLOT_MARMOT_CELEBRATION_DELAY_MS: 500,   // 大当たり確定表示から、マーモット専用演出を始めるまでの間
        };

        // 🎰 スロットの絵柄と配当（3つ揃った時の倍率）。同じ絵柄の並び順で、揃いにくいほど高配当にしてある
        // 🎰 絵柄一覧（価値が低い順）。weightが大きいほど出やすい（＝価値が高いほどレア）
        export const SLOT_SYMBOLS = [
            { id: 'cherry',      icon: '🍒', img: 'ui_images/slot/symbol_cherry.webp',      label: 'チェリー',   payout: 2,   weight: 44 },
            { id: 'carrot',      icon: '🥕', img: 'ui_images/slot/symbol_carrot.webp',      label: '人参',      payout: 3,   weight: 36 },
            { id: 'bell',        icon: '🔔', img: 'ui_images/slot/symbol_bell.webp',        label: 'ベル',      payout: 4,   weight: 30 },
            { id: 'sweetpotato', icon: '🍠', img: 'ui_images/slot/symbol_sweetpotato.webp', label: 'さつまいも', payout: 5,   weight: 16 },
            { id: 'banana',      icon: '🍌', img: 'ui_images/slot/symbol_banana.webp',      label: 'バナナ',    payout: 6,   weight: 12 },
            { id: 'apple',       icon: '🍎', img: 'ui_images/slot/symbol_apple.webp',       label: 'リンゴ',    payout: 8,   weight: 9 },
            { id: 'bar1',        icon: '➖',  img: 'ui_images/slot/symbol_bar1.webp',        label: 'BAR',       payout: 10,  weight: 6 },
            { id: 'bar2',        icon: '➖➖', img: 'ui_images/slot/symbol_bar2.webp',        label: 'ダブルBAR',  payout: 15,  weight: 3.5 },
            { id: 'bar3',        icon: '➖➖➖', img: 'ui_images/slot/symbol_bar3.webp',       label: 'トリプルBAR', payout: 25,  weight: 1.8 },
            { id: 'seven',       icon: '7️⃣', img: 'ui_images/slot/symbol_seven.webp',       label: '7',         payout: 60,  weight: 0.5 },
            { id: 'marmot',      icon: '🐹', img: 'ui_images/slot/symbol_marmot.webp',      label: 'マーモット', payout: 150, weight: 0.15, isJackpot: true },
        ];
        // リプレイ：揃うとコインを消費せず、もう一度レバーを引ける（配当表には含めない特殊絵柄）
        export const SLOT_REPLAY_SYMBOL = { id: 'replay', icon: '🍡', img: 'ui_images/slot/symbol_replay.webp', label: 'リプレイ', weight: 20 };
        export const SLOT_ALL_SYMBOLS = [...SLOT_SYMBOLS, SLOT_REPLAY_SYMBOL]; // リールの帯を作る時に使う、全絵柄（リプレイ含む）
        export const SLOT_COIN_COST = 1;        // コインを1回投入するのに必要なミニゲームコイン
        export const SLOT_PLAYS_PER_COIN = 5;   // コイン1枚で、レバーを何回引けるか
        export let slotPlaysRemaining = 0;      // 今、あと何回レバーを引けるか
        export const SLOT_SYMBOL_HEIGHT = 44; // 1コマぶんの高さ(px)。窓に縦3コマ表示するので、窓の高さ(約130px)÷3に合わせてある
        export const SLOT_STRIP_REPEATS = 8;  // 全絵柄を、この回数ぶん繰り返して1本の帯を作る（長く回っているように見せるため）
        export let slotIsSpinning = false;      // レバーを引いてから、3つとも止まり終えるまでtrue
        export let slotSpinLoopSource = null;   // 回転中ループ音の再生ノード（stopで確実に止められるよう保持）

        // 🔊 リールが回っている間、ループするSE。BGMとは別のチャンネルで鳴らすので、BGMを止めずに重ねられる
        /**
         * リール回転中に鳴らし続けるループ効果音を、Web Audio APIのBufferSourceで独自に再生する。
         * @returns {void}
         */
        export function playSlotSpinLoopSound() {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            loadAudioBuffer('audio/slot/spin_loop.mp3').then((buffer) => {
                if (!buffer || !slotIsSpinning) return; // 読み込み中に止まっていたら鳴らさない
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                const gain = ctx.createGain();
                gain.gain.value = 0.5 * sfxVolumeMult;
                source.connect(gain).connect(ctx.destination);
                source.start(0);
                slotSpinLoopSource = source;
            });
        }
        /**
         * 再生中のスロット回転ループ音があれば停止する。
         * @returns {void}
         */
        export function stopSlotSpinLoopSound() {
            if (slotSpinLoopSource) { try { slotSpinLoopSource.stop(); } catch (e) {} slotSpinLoopSource = null; }
        }

        export let slotStoppedCount = 0;
        export let slotReelResults = [null, null, null];   // この回で、各リールが最終的にどの絵柄で止まるか（レバーを引いた瞬間に内部で先に決める）
        export let slotReelAnimations = [null, null, null]; // 各リールの「回り続ける」アニメーションを、止める時にcancelできるよう保持
        export let slotReelLandingRow = [null, null, null]; // 各リールが最終的に止まった時の、帯の中の行番号（揃った絵柄を光らせる時に使う）
        export let slotStoppedReels = [];       // 今の回で、すでに止めたリールの番号（リーチ判定に使う）
        export let slotBonusZoneSpinsLeft = 0;  // 特化ゾーン：残りこの回数ぶん、当たりやすい状態が続く
        export let slotTotalPulls = 0;          // 総回転数（レバーを引いた回数、全期間）
        export let slotPullsSinceJackpot = 0;   // 前回マーモットが出てから、何回転しているか
        export let slotJackpotCount = 0;        // マーモットが出た回数
        export let slotShortestJackpotPulls = null; // マーモットが出るまでの回転数、最短記録
        export let slotLongestJackpotPulls = null;  // マーモットが出るまでの回転数、最長記録
        export const SLOT_BONUS_ZONE_SPINS = 10; // マーモット後、特化ゾーンが続くレバー回数
        // 特化ゾーン中は、この重みで抽選する（BAR以上の高価値な絵柄が出やすくなる）
        export const SLOT_BONUS_ZONE_SYMBOLS = SLOT_SYMBOLS.map(s => ({
            ...s, weight: (s.payout >= 10) ? s.weight * 6 : s.weight * 0.4,
        })).concat([{ ...SLOT_REPLAY_SYMBOL, weight: SLOT_REPLAY_SYMBOL.weight * 2 }]); // リプレイも少し出やすくして、ゾーンが長続きしやすくする
        export let slotNextSpinFree = false; // リプレイが揃った直後は、次の1回はコイン消費なし

        // 🛠️ スロットの各パーツ位置・大きさを、実際のイラストに合わせて調整するための開発者用ツール
        export let slotAdjustMode = false;
        export let slotAdjustDragState = null;
        // 調整中だけ、普段は透明・非表示のパーツ（コイン投入口・払出口・投入コイン）を見える状態にする
        /**
         * 開発者用の位置調整モード中だけ、普段は非表示のコイン投入イラストや、コイン投入口・払出口の枠線を可視化する。
         * @param {boolean} show - 可視化するかどうか
         * @returns {void}
         */
        export function setSlotPartAdjustVisibility(show) {
            const coinInsertImg = document.getElementById('slot-coin-insert-img');
            if (coinInsertImg) {
                if (show) { coinInsertImg.style.display = 'block'; coinInsertImg.style.opacity = '0.7'; }
                else { coinInsertImg.style.display = 'none'; coinInsertImg.style.opacity = '1'; }
            }
            ['slot-coin-slot-in', 'slot-coin-slot-out'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.style.background = show ? 'rgba(233,30,99,0.15)' : '';
                el.style.border = show ? '2px dashed #e91e63' : '';
            });
        }
        // 選ばれたパーツを一時的に最前面に出し、他のパーツと重なっていてもドラッグで確実につかめるようにする。
        // 普段はpointer-events:noneのパーツ（レバー取り付け部品・投入コインなど）も、調整中だけ掴めるようにする
        /**
         * 位置調整対象に選ばれたパーツだけを最前面(z-index)に出し、普段pointer-events:noneのパーツも掴めるようにする。
         * @param {string} targetId - 最前面に出す対象パーツのDOM要素ID
         * @returns {void}
         */
        export function bringSlotTargetToFront(targetId) {
            SLOT_ADJUSTABLE_PARTS.forEach(p => {
                const el = document.getElementById(p.id);
                if (!el) return;
                if (p.id === targetId) {
                    el.style.zIndex = '997';
                    if (!el.dataset.origPointerEvents) el.dataset.origPointerEvents = el.style.pointerEvents || '';
                    el.style.pointerEvents = 'auto';
                } else {
                    el.style.zIndex = '';
                    if (el.dataset.origPointerEvents !== undefined) {
                        el.style.pointerEvents = el.dataset.origPointerEvents;
                        delete el.dataset.origPointerEvents;
                    }
                }
            });
        }
        // ハンドル（縁・角の丸）と回転軸マーカーを、今選ばれているパーツの実際の位置に合わせて配置し直す
        /**
         * 選択中パーツの実際の描画位置に合わせて、リサイズ用ハンドルと回転軸マーカーを再配置する。
         * @returns {void}
         */
        export function positionSlotHandles() {
            if (!slotAdjustMode) return;
            const stage = document.getElementById('slot-machine-stage');
            const partId = document.getElementById('slot-adjust-target').value;
            const part = SLOT_ADJUSTABLE_PARTS.find(p => p.id === partId);
            const target = document.getElementById(partId);
            const handleR = document.getElementById('slot-resize-handle-r');
            const handleB = document.getElementById('slot-resize-handle-b');
            const handleBr = document.getElementById('slot-resize-handle-br');
            if (!stage || !target) return;
            const stageRect = stage.getBoundingClientRect();
            const tRect = target.getBoundingClientRect();
            const rightPct = ((tRect.right - stageRect.left) / stageRect.width) * 100;
            const bottomPct = ((tRect.bottom - stageRect.top) / stageRect.height) * 100;
            const midYPct = ((tRect.top + tRect.height / 2 - stageRect.top) / stageRect.height) * 100;
            const midXPct = ((tRect.left + tRect.width / 2 - stageRect.left) / stageRect.width) * 100;

            [handleR, handleB, handleBr].forEach(h => h.style.display = 'block');
            handleR.style.left = rightPct + '%'; handleR.style.top = midYPct + '%';
            handleB.style.left = midXPct + '%'; handleB.style.top = bottomPct + '%';
            handleBr.style.left = rightPct + '%'; handleBr.style.top = bottomPct + '%';

            const pivotMarker = document.getElementById('slot-pivot-marker');
            const rotationControls = document.getElementById('slot-rotation-controls');
            if (part && part.hasRotation) {
                rotationControls.style.display = 'block';
                pivotMarker.style.display = 'block';
                // transform-originの%指定(パーツ自身の箱の中の位置)を、ステージ全体に対する%へ変換して置く
                const originStr = getComputedStyle(target).transformOrigin; // 例: "40px 8px" のようなpx値で返ってくる
                const [ox, oy] = originStr.split(' ').map(parseFloat);
                pivotMarker.style.left = (((tRect.left + ox) - stageRect.left) / stageRect.width * 100) + '%';
                pivotMarker.style.top = (((tRect.top + oy) - stageRect.top) / stageRect.height * 100) + '%';
            } else {
                rotationControls.style.display = 'none';
                pivotMarker.style.display = 'none';
            }
        }
        /**
         * 開発者用パーツ位置調整モードのON/OFFを切り替え、枠線・ハンドル・ドラッグ設定などを一括で有効化/無効化する。
         * @returns {void}
         */
        export function toggleSlotAdjustMode() {
            slotAdjustMode = !slotAdjustMode;
            const btn = document.getElementById('slot-adjust-toggle-btn');
            setSlotPartAdjustVisibility(slotAdjustMode);
            if (slotAdjustMode) {
                const targetId = document.getElementById('slot-adjust-target').value;
                const target = document.getElementById(targetId);
                if (target) target.style.outline = '2px dashed #e91e63';
                bringSlotTargetToFront(targetId);
                if (btn) btn.style.background = '#4caf50';
                setupSlotAdjustDrag();
                positionSlotHandles();
                updateSlotAdjustReadout();
            } else {
                SLOT_ADJUSTABLE_PARTS.forEach(p => {
                    const el = document.getElementById(p.id);
                    if (!el) return;
                    el.style.outline = ''; el.style.zIndex = '';
                    if (el.dataset.origPointerEvents !== undefined) {
                        el.style.pointerEvents = el.dataset.origPointerEvents;
                        delete el.dataset.origPointerEvents;
                    }
                });
                ['slot-resize-handle-r', 'slot-resize-handle-b', 'slot-resize-handle-br', 'slot-pivot-marker'].forEach(id => {
                    document.getElementById(id).style.display = 'none';
                });
                if (btn) btn.style.background = '#e91e63';
            }
        }
        window.toggleSlotAdjustMode = toggleSlotAdjustMode; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        // 対象を切り替えた時、前の対象の枠線を消して、新しい対象にだけ付け直す
        /**
         * 調整対象パーツを切り替えるプルダウンのonchangeハンドラ。枠線・最前面化・ハンドル再配置を新対象に適用する。
         * @returns {void}
         */
        export function onSlotAdjustTargetChange() {
            SLOT_ADJUSTABLE_PARTS.forEach(p => {
                const el = document.getElementById(p.id);
                if (el) { el.style.outline = ''; el.style.zIndex = ''; }
            });
            if (slotAdjustMode) {
                const targetId = document.getElementById('slot-adjust-target').value;
                const target = document.getElementById(targetId);
                if (target) target.style.outline = '2px dashed #e91e63';
                bringSlotTargetToFront(targetId);
                positionSlotHandles();
            }
            updateSlotAdjustReadout();
        }
        window.onSlotAdjustTargetChange = onSlotAdjustTargetChange; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        /**
         * スロット筐体ステージにpointerイベントを一度だけ登録し、選択中パーツの移動・リサイズ・回転軸移動をドラッグで行えるようにする。
         * @returns {void}
         */
        export function setupSlotAdjustDrag() {
            const stage = document.getElementById('slot-machine-stage');
            if (stage.dataset.dragSetup) return;
            stage.dataset.dragSetup = '1';

            const startDrag = (e, mode) => {
                if (!slotAdjustMode) return;
                e.stopPropagation(); e.preventDefault();
                const targetId = document.getElementById('slot-adjust-target').value;
                const target = document.getElementById(targetId);
                try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
                slotAdjustDragState = { startX: e.clientX, startY: e.clientY, target, mode };
            };

            stage.addEventListener('pointerdown', (e) => {
                if (!slotAdjustMode) return;
                if (e.target.id === 'slot-resize-handle-r') return startDrag(e, 'width');
                if (e.target.id === 'slot-resize-handle-b') return startDrag(e, 'height');
                if (e.target.id === 'slot-resize-handle-br') return startDrag(e, 'both');
                if (e.target.id === 'slot-pivot-marker') return startDrag(e, 'pivot');
                const targetId = document.getElementById('slot-adjust-target').value;
                const target = document.getElementById(targetId);
                if (!target.contains(e.target) && e.target !== target) return;
                startDrag(e, 'move');
            });

            stage.addEventListener('pointermove', (e) => {
                if (!slotAdjustDragState || !slotAdjustMode) return;
                e.stopPropagation();
                const rect = stage.getBoundingClientRect();
                const dxPct = ((e.clientX - slotAdjustDragState.startX) / rect.width) * 100;
                const dyPct = ((e.clientY - slotAdjustDragState.startY) / rect.height) * 100;
                const t = slotAdjustDragState.target;
                const mode = slotAdjustDragState.mode;

                if (mode === 'move') {
                    const curLeft = parseFloat(t.style.left) || 0;
                    const curTop = parseFloat(t.style.top) || 0;
                    t.style.left = (curLeft + dxPct) + '%';
                    t.style.top = (curTop + dyPct) + '%';
                } else if (mode === 'pivot') {
                    // 回転軸は「パーツ自身の箱の中の位置」なので、パーツ自身の大きさに対する割合で動かす
                    const tRect = t.getBoundingClientRect();
                    const [curOx, curOy] = getComputedStyle(t).transformOrigin.split(' ').map(parseFloat);
                    const newOx = Math.min(tRect.width, Math.max(0, curOx + (e.clientX - slotAdjustDragState.startX)));
                    const newOy = Math.min(tRect.height, Math.max(0, curOy + (e.clientY - slotAdjustDragState.startY)));
                    t.style.transformOrigin = `${(newOx / tRect.width * 100).toFixed(1)}% ${(newOy / tRect.height * 100).toFixed(1)}%`;
                } else {
                    const curWidth = parseFloat(t.style.width) || 16;
                    if (mode === 'width' || mode === 'both') t.style.width = Math.max(2, curWidth + dxPct) + '%';
                    if (mode === 'height' || mode === 'both') {
                        const curHeight = parseFloat(t.style.height) || (t.getBoundingClientRect().height / rect.height * 100);
                        t.style.height = Math.max(2, curHeight + dyPct) + '%';
                    }
                }
                slotAdjustDragState.startX = e.clientX;
                slotAdjustDragState.startY = e.clientY;
                positionSlotHandles();
                updateSlotAdjustReadout();
            });
            stage.addEventListener('pointerup', () => { slotAdjustDragState = null; });
            stage.addEventListener('pointercancel', () => { slotAdjustDragState = null; });
        }
        /**
         * レバーの初期角度(dataset.rotation)をdelta分だけ増減させ、見た目の回転にも反映する。
         * @param {number} delta - 角度の増減量(度)
         * @returns {void}
         */
        export function adjustSlotLeverRotation(delta) {
            const lever = document.getElementById('slot-lever');
            const cur = parseFloat(lever.dataset.rotation || '0');
            const next = cur + delta;
            lever.dataset.rotation = next;
            lever.style.transform = `rotate(${next}deg)`;
            updateSlotAdjustReadout();
        }
        window.adjustSlotLeverRotation = adjustSlotLeverRotation; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        // 高さを、そのパーツの実際の描画結果(getBoundingClientRect)から%で計算する。
        // style.heightが「auto」のままの場合でも、必ず具体的な数値を返す
        /**
         * 対象パーツの実際の描画結果からステージ全体に対する高さ%を計算する。非表示中はstyle.heightの生値を返す。
         * @param {HTMLElement} el - 対象パーツのDOM要素
         * @returns {string} 高さの%文字列（またはstyle.heightの生値）
         */
        export function getSlotPartHeightPct(el) {
            const stage = document.getElementById('slot-machine-stage');
            const stageRect = stage.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            if (elRect.height === 0 && getComputedStyle(el).display === 'none') {
                // 非表示中(display:none)は正しく測れないので、生のstyle.heightをそのまま返す（未設定ならauto）
                return el.style.height || 'auto';
            }
            return (elRect.height / stageRect.height * 100).toFixed(4) + '%';
        }
        /**
         * 選択中パーツの現在のtop/left/width/height（回転パーツならtransform-originと初期角度も）をテキスト表示する。
         * @returns {void}
         */
        export function updateSlotAdjustReadout() {
            const partId = document.getElementById('slot-adjust-target').value;
            const part = SLOT_ADJUSTABLE_PARTS.find(p => p.id === partId);
            const target = document.getElementById(partId);
            const el = document.getElementById('slot-adjust-readout');
            if (!target || !el) return;
            let text = `top:${target.style.top}; left:${target.style.left}; width:${target.style.width}; height:${getSlotPartHeightPct(target)};`;
            if (part && part.hasRotation) text += `\ntransform-origin:${target.style.transformOrigin}; 初期角度:${target.dataset.rotation || 0}deg;`;
            el.textContent = text;
        }
        // 全パーツぶんの座標を、名前つきでまとめてテキスト化する
        /**
         * SLOT_ADJUSTABLE_PARTS全パーツぶんの座標情報をラベル付きでテキスト化し、テキストエリアとクリップボードに出力する。
         * @returns {void}
         */
        export function copyAllSlotCoords() {
            const lines = SLOT_ADJUSTABLE_PARTS.map(p => {
                const el = document.getElementById(p.id);
                if (!el) return `${p.label}(${p.id}): 要素が見つかりません`;
                let line = `${p.label}(${p.id}): top:${el.style.top}; left:${el.style.left}; width:${el.style.width}; height:${getSlotPartHeightPct(el)};`;
                if (p.hasRotation) line += ` transform-origin:${el.style.transformOrigin}; 初期角度:${el.dataset.rotation || 0}deg;`;
                return line;
            });
            const text = lines.join('\n');
            const textarea = document.getElementById('slot-copy-all-textarea');
            textarea.value = text;
            textarea.style.display = 'block';
            textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).catch(() => {});
            }
        }
        window.copyAllSlotCoords = copyAllSlotCoords; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 遊び方・配当表・記録を表示するヘルプオーバーレイの表示/非表示を切り替える。開く時に最新の記録を再描画する。
         * @returns {void}
         */
        export function toggleSlotHelpOverlay() {
            const overlay = document.getElementById('slot-help-overlay');
            if (!overlay) return;
            const opening = overlay.style.display !== 'block';
            overlay.style.display = opening ? 'block' : 'none';
            if (opening) {
                const statsEl = document.getElementById('slot-stats-content');
                if (statsEl) statsEl.innerHTML = `
                    総回転数：${slotTotalPulls}回転<br>
                    マーモット獲得回数：${slotJackpotCount}回<br>
                    最短：${slotShortestJackpotPulls == null ? '－' : slotShortestJackpotPulls + '回転'}<br>
                    最長：${slotLongestJackpotPulls == null ? '－' : slotLongestJackpotPulls + '回転'}
                `;
            }
        }
        window.toggleSlotHelpOverlay = toggleSlotHelpOverlay; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        // 残りプレイ回数に応じて、次に光らせるべきパーツを決める（残っていればレバー、無くなっていればコイン投入口）
        /**
         * 残りプレイ回数があればレバーを、無ければコイン投入口を光らせて、次の操作をプレイヤーに視覚的に誘導する。
         * @returns {void}
         */
        export function inviteNextSlotStep() {
            if (slotPlaysRemaining > 0) {
                document.getElementById('slot-lever').classList.add('slot-invite-glow');
            } else {
                document.getElementById('slot-coin-slot-in').classList.add('slot-invite-glow-ring');
            }
        }
        /**
         * 「あとN回引けます」の表示を、slotPlaysRemainingの現在値で更新する。
         * @returns {void}
         */
        export function updateSlotPlaysRemainingDisplay() {
            const el = document.getElementById('slot-plays-remaining');
            if (el) el.innerText = slotPlaysRemaining > 0 ? `（あと${slotPlaysRemaining}回引けます）` : '';
        }
        /**
         * 特化ゾーンの残り回数表示テキストと、各リール窓のハイライト演出クラスの付け外しを行う。
         * @returns {void}
         */
        export function updateSlotBonusZoneDisplay() {
            const el = document.getElementById('slot-bonus-zone-text');
            const active = slotBonusZoneSpinsLeft > 0;
            if (el) el.innerText = active ? `✨ 特化ゾーン 残り${slotBonusZoneSpinsLeft}回 ✨` : '';
            [0, 1, 2].forEach(i => {
                const win = document.getElementById(`slot-reel-window-${i}`);
                if (win) win.classList.toggle('slot-bonus-zone-active', active);
            });
        }
        /**
         * 「前回のマーモットからN回転」の表示を、slotPullsSinceJackpotの現在値で更新する。
         * @returns {void}
         */
        export function updateSlotPullsSinceJackpotDisplay() {
            const el = document.getElementById('slot-pulls-since-jackpot');
            if (el) el.innerText = `前回のマーモットから ${slotPullsSinceJackpot}回転`;
        }

        /**
         * 重み(weight)付き抽選で1つの絵柄を選ぶ。特化ゾーン中はSLOT_BONUS_ZONE_SYMBOLS、通常時はSLOT_ALL_SYMBOLSから抽選する。
         * @returns {Object} 抽選された絵柄オブジェクト
         */
        export function pickWeightedSlotSymbol() {
            const pool = slotBonusZoneSpinsLeft > 0 ? SLOT_BONUS_ZONE_SYMBOLS : SLOT_ALL_SYMBOLS;
            const total = pool.reduce((s, sym) => s + sym.weight, 0);
            let roll = Math.random() * total;
            for (const sym of pool) {
                if (roll < sym.weight) return sym;
                roll -= sym.weight;
            }
            return pool[0];
        }

        /**
         * 全絵柄(SLOT_ALL_SYMBOLS)をSLOT_STRIP_REPEATS回繰り返して連結した、1本のリール帯のHTMLを組み立てる。
         * @returns {string} リール帯のHTML文字列
         */
        export function buildSlotReelStripHtml() {
            let html = '';
            for (let rep = 0; rep < SLOT_STRIP_REPEATS; rep++) {
                SLOT_ALL_SYMBOLS.forEach(s => {
                    html += `<div style="height:${SLOT_SYMBOL_HEIGHT}px; display:flex; align-items:center; justify-content:center;"><img src="${s.img}" alt="${s.label}" style="max-width:80%; max-height:80%;"></div>`;
                });
            }
            return html;
        }

        // 🛠️ 調整対象のパーツ一覧（位置調整ツールがこのリストを見て動く）
        export const SLOT_ADJUSTABLE_PARTS = [
            { id: 'slot-machine-body', label: '本体' },
            { id: 'slot-lever-mount', label: 'レバー取り付け部品' },
            { id: 'slot-lever', label: 'レバー', hasRotation: true },
            { id: 'slot-stop-btn-0', label: 'ボタン①' },
            { id: 'slot-stop-btn-1', label: 'ボタン②' },
            { id: 'slot-stop-btn-2', label: 'ボタン③' },
            { id: 'slot-coin-insert-img', label: '投入コイン(横向き)' },
            { id: 'slot-reel-window-0', label: 'リール窓①', isBox: true },
            { id: 'slot-reel-window-1', label: 'リール窓②', isBox: true },
            { id: 'slot-reel-window-2', label: 'リール窓③', isBox: true },
            { id: 'slot-coin-slot-in', label: 'コイン投入口', isBox: true },
            { id: 'slot-coin-slot-out', label: 'コイン払い出し口', isBox: true },
        ];

        /**
         * スロット機の画面全体（リール窓・レバー・止めるボタン・コイン投入口/払出口・ヘルプ・記録表示・調整パネル）を構築する。
         * @param {HTMLElement} container - 描画先のコンテナ要素
         * @returns {void}
         */
        export function startSlotGame(container) {
            slotIsSpinning = false; slotStoppedCount = 0; slotNextSpinFree = false; // slotPlaysRemainingは、離脱しても引き継がれるようリセットしない
            container.style.background = 'transparent'; // 機体イラストの後ろに白い箱が見えないよう、この画面だけ背景を消す
            container.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <div style="display:inline-flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:6px 12px; margin-bottom:8px; background:rgba(255,255,255,0.85); border-radius:20px; padding:7px 16px; box-shadow:0 2px 6px rgba(0,0,0,0.12);">
                        <div style="font-weight:900; color:#7b1fa2;"><img src="ui_images/slot/coin.webp" alt="コイン" style="width:18px; vertical-align:-3px;"> <span id="slot-coin-value">${IS_DEV_MODE ? '∞' : minigameCoins}</span> 所持<span id="slot-plays-remaining" style="font-size:0.7rem; color:#e91e63;"></span></div>
                        <div id="slot-bonus-zone-text" style="font-weight:900; color:#ffab00; font-size:0.8rem;"></div>
                        <button onclick="toggleSlotHelpOverlay()" style="width:24px; height:24px; border-radius:50%; border:none; background:#5d4037; color:#fff; font-weight:900; font-size:0.75rem;">？</button>
                    </div>
                    <div id="slot-pulls-since-jackpot" style="display:inline-block; font-size:0.7rem; font-weight:700; color:#5d4037; background:rgba(255,255,255,0.85); border-radius:14px; padding:4px 12px; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.1);"></div>

                    <div id="slot-machine-stage" style="position:relative; width:100%; max-width:280px; height:280px; margin:0 auto;">
                        ${[0, 1, 2].map(i => `
                            <div id="slot-reel-window-${i}" style="position:absolute; box-sizing:border-box; top:${[42.285715, 42.285715, 41.928575][i]}%; left:${[7.499995, 37.857139, 68.571429][i]}%; width:${[24.142858, 23.785714, 23.428572][i]}%; height:${[47.8571, 47.8571, 48.5714][i]}%; overflow:hidden; background:#fff; z-index:1;">
                                <div id="slot-reel-strip-${i}" style="transform:translateY(0);">${buildSlotReelStripHtml()}</div>
                            </div>
                        `).join('')}

                        <img id="slot-lever" src="ui_images/slot/lever.webp" alt="レバー" onclick="pullSlotLever()"
                             style="position:absolute; top:52.142868%; left:101.642867%; width:13.14286%; height:27.8125%; transform-origin:50% 88%; z-index:5; cursor:pointer;" data-rotation="10">

                        <img id="slot-machine-body" src="ui_images/slot/machine_body.webp" alt="スロットマシン" style="position:absolute; top:5.714281%; left:-8.928571%; width:116.428577%; height:158.2031%; display:block; z-index:10; pointer-events:none;">

                        <img id="slot-lever-mount" src="ui_images/slot/lever_mount.webp" alt="レバー取り付け部品"
                             style="position:absolute; top:65.142855%; left:104.214279%; width:7.642855%; height:28.1585%; z-index:15; pointer-events:none;">

                        <img id="slot-stop-btn-0" src="ui_images/slot/button_1.webp" alt="① 止める" onclick="stopSlotReel(0)" style="position:absolute; top:93.428576%; left:13.071423%; width:16%; height:11.8750%; cursor:pointer; z-index:16;">
                        <img id="slot-stop-btn-1" src="ui_images/slot/button_2.webp" alt="② 止める" onclick="stopSlotReel(1)" style="position:absolute; top:93.428581%; left:41.642851%; width:16%; height:11.3672%; cursor:pointer; z-index:16;">
                        <img id="slot-stop-btn-2" src="ui_images/slot/button_3.webp" alt="③ 止める" onclick="stopSlotReel(2)" style="position:absolute; top:93.428582%; left:70.214287%; width:16%; height:11.5625%; cursor:pointer; z-index:16;">

                        <div id="slot-coin-slot-in" onclick="insertSlotCoin()" style="position:absolute; top:137.142856%; left:7.857135%; width:8.071431%; height:5.2596%; cursor:pointer; z-index:21;"></div>
                        <div id="slot-coin-slot-out" style="position:absolute; top:137.500007%; left:72.500008%; width:20%; height:15.4967%;"></div>
                        <img id="slot-coin-insert-img" src="ui_images/slot/coin_side.webp" alt="" style="display:none; position:absolute; top:138.214276%; left:7.142852%; width:9.642859%; height:auto; z-index:20; pointer-events:none;">

                        <div id="slot-pivot-marker" style="display:none; position:absolute; width:10px; height:10px; margin:-5px; border-radius:50%; background:#00e5ff; border:2px solid #fff; z-index:998; pointer-events:none;"></div>
                        <div id="slot-resize-handle-r" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#4caf50; border:2px solid #fff; z-index:999; cursor:ew-resize;"></div>
                        <div id="slot-resize-handle-b" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#4caf50; border:2px solid #fff; z-index:999; cursor:ns-resize;"></div>
                        <div id="slot-resize-handle-br" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#ff9800; border:2px solid #fff; z-index:999; cursor:nwse-resize;"></div>
                    </div>

                    <p id="slot-result-text" style="font-weight:900; font-size:1rem; margin:10px 0 6px; min-height:1.4em; text-shadow:0 1px 3px rgba(255,255,255,0.8);"></p>
                    <div id="slot-payout-popup" style="display:none; font-weight:900; font-size:1.8rem; color:#ffd700; text-shadow:0 2px 8px rgba(0,0,0,0.5), 0 0 12px #ff6ec7;"></div>

                    <!-- 🐛修正：PWA(ホーム画面追加/standalone)で開くと、Safariのタブ表示と違い画面が
                         ノッチ/ステータスバーの裏まで完全に覆うため、固定20pxのpaddingだけだと
                         閉じるボタンや見出しがその下に隠れて「全体的に上がった」ように見えていた。
                         env(safe-area-inset-top)ぶんを上だけ追加で確保する（ブラウザ表示では
                         この値は0になるため、通常表示には影響しない） -->
                    <div id="slot-help-overlay" style="display:none; position:fixed; inset:0; z-index:2000; background:rgba(255,248,236,0.98); padding:calc(20px + env(safe-area-inset-top, 0px)) 20px 20px; overflow-y:auto; box-sizing:border-box; text-align:left;">
                        <button onclick="toggleSlotHelpOverlay()" style="position:absolute; top:calc(8px + env(safe-area-inset-top, 0px)); right:8px; width:26px; height:26px; border-radius:50%; border:none; background:#5d4037; color:#fff; font-weight:900;">×</button>
                        <h3 style="margin:0 0 10px; color:#5d4037; text-align:center;">🎰 スロットの遊び方</h3>
                        <p style="font-size:0.78rem; color:#5d4037; line-height:1.6;">① 光っているコインをタップして投入します（1枚で1回）<br>② 光っているレバーを引くとリールが回り始めます<br>③ 光っている3つのボタンで、リールを1つずつ好きなタイミングで止められます<br>④ 上段・中段・下段・斜め2本、5つのライン上に絵柄が3つ揃うと、コインが払い出されます<br>（複数ラインが同時に揃うと、その分コインも増えます）</p>
                        <div style="margin-top:14px;">
                            ${SLOT_SYMBOLS.slice().reverse().map(s => `
                                <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-bottom:6px;">
                                    <img src="${s.img}" alt="${s.label}" style="width:26px; height:26px; object-fit:contain;">
                                    <img src="${s.img}" alt="" style="width:26px; height:26px; object-fit:contain;">
                                    <img src="${s.img}" alt="" style="width:26px; height:26px; object-fit:contain;">
                                    <span style="font-size:0.9rem; color:#5d4037; margin:0 4px;">→</span>
                                    <img src="ui_images/slot/coin.webp" alt="コイン" style="width:20px; height:20px; object-fit:contain;">
                                    <span style="font-size:0.85rem; font-weight:900; color:#5d4037;">×${s.payout}枚</span>
                                </div>
                            `).join('')}
                            <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-top:4px;">
                                <img src="ui_images/slot/symbol_replay.webp" alt="リプレイ" style="width:26px; height:26px; object-fit:contain;">
                                <img src="ui_images/slot/symbol_replay.webp" alt="" style="width:26px; height:26px; object-fit:contain;">
                                <img src="ui_images/slot/symbol_replay.webp" alt="" style="width:26px; height:26px; object-fit:contain;">
                                <span style="font-size:0.78rem; color:#4caf50; margin-left:6px;">→ コイン消費なしでもう一度！</span>
                            </div>
                        </div>

                        <div style="margin-top:16px; padding-top:10px; border-top:1px dashed #ddd; text-align:center;">
                            <div style="font-size:0.7rem; color:#8d6e63; font-weight:900; margin-bottom:6px;">📊 記録</div>
                            <div id="slot-stats-content" style="font-size:0.72rem; color:#5d4037; line-height:1.8;">
                                総回転数：${slotTotalPulls}回転<br>
                                マーモット獲得回数：${slotJackpotCount}回<br>
                                最短：${slotShortestJackpotPulls == null ? '－' : slotShortestJackpotPulls + '回転'}<br>
                                最長：${slotLongestJackpotPulls == null ? '－' : slotLongestJackpotPulls + '回転'}
                            </div>
                        </div>

                        ${IS_DEV_MODE ? `
                        <div style="margin-top:16px; padding-top:10px; border-top:1px dashed #ddd; text-align:center;">
                            <div style="font-size:0.68rem; color:#bbb; margin-bottom:4px;">🛠️ 位置調整（開発者用）</div>
                            <select id="slot-adjust-target" style="font-size:0.68rem;" onchange="onSlotAdjustTargetChange()">
                                ${SLOT_ADJUSTABLE_PARTS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
                            </select>
                            <button onclick="toggleSlotAdjustMode()" id="slot-adjust-toggle-btn" style="background:#e91e63; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-size:0.65rem; margin-left:4px;">位置調整</button>
                            <p style="font-size:0.58rem; color:#999; margin:4px 0 0;">緑（縁・角）をドラッグで大きさ調整、水色（レバーのみ）をドラッグで回転軸を移動</p>
                            <div id="slot-rotation-controls" style="display:none; margin-top:6px;">
                                <button onclick="adjustSlotLeverRotation(-5)" style="padding:2px 6px; font-size:0.6rem;">回転－</button>
                                <button onclick="adjustSlotLeverRotation(5)" style="padding:2px 6px; font-size:0.6rem;">回転＋</button>
                            </div>
                            <div id="slot-adjust-readout" style="font-size:0.58rem; color:#555; margin-top:4px; white-space:pre-wrap;"></div>
                            <button onclick="copyAllSlotCoords()" style="background:#2196f3; color:#fff; border:none; padding:5px 10px; border-radius:6px; font-size:0.65rem; margin-top:8px;">📋 全パーツの座標をまとめてコピー</button>
                            <textarea id="slot-copy-all-textarea" readonly style="display:none; width:100%; height:120px; font-size:0.6rem; margin-top:6px; box-sizing:border-box;"></textarea>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            updateSlotPlaysRemainingDisplay();
            inviteNextSlotStep(); // 前回の残り回数を引き継いでいるので、それに応じてレバーかコイン投入口、どちらかが光る
            updateSlotBonusZoneDisplay(); // 特化ゾーンが残っていれば、それも引き継いで表示する
            updateSlotPullsSinceJackpotDisplay();
        }

        // 🪙 コインを投入口にポトッと落とす演出。位置は#slot-coin-slot-inの座標を実測して使う
        /**
         * コイン投入口の実測位置を基準に、コインが落ちて消えていくアニメーションを再生する。
         * @returns {void}
         */
        export function playSlotCoinInsertAnim() {
            const stage = document.getElementById('slot-machine-stage');
            const slotIn = document.getElementById('slot-coin-slot-in');
            const coinImg = document.getElementById('slot-coin-insert-img');
            if (!stage || !slotIn || !coinImg) return;
            const stageRect = stage.getBoundingClientRect();
            const slotRect = slotIn.getBoundingClientRect();
            const targetTopPct = ((slotRect.top - stageRect.top) / stageRect.height) * 100;
            const targetLeftPct = ((slotRect.left - stageRect.left) / stageRect.width) * 100;

            coinImg.style.display = 'block';
            coinImg.style.top = (targetTopPct - CONFIG.SLOT_COIN_INSERT_START_OFFSET_PCT) + '%';
            coinImg.style.left = targetLeftPct + '%';
            coinImg.style.opacity = '1';
            coinImg.getAnimations().forEach(a => a.cancel());
            coinImg.animate(
                [
                    { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                    { transform: 'translateY(28px) rotate(180deg)', opacity: 1, offset: 0.85 },
                    { transform: 'translateY(32px) rotate(200deg)', opacity: 0 },
                ],
                { duration: CONFIG.SLOT_COIN_INSERT_ANIM_MS, easing: 'ease-in', fill: 'forwards' }
            );
            playAudioFile('audio/slot/coin_insert.mp3');
        }

        // 🪙① コインをタップして投入する（1枚=1プレイぶん）。投入し終わったら、次はレバーが光って誘導する
        /**
         * コインを1枚消費してプレイ可能回数を増やし、コインが足りなければ不足数を案内する。投入後、レバーを光らせて誘導する。
         * @returns {void}
         */
        export function insertSlotCoin() {
            if (slotIsSpinning) return;
            const coinSlot = document.getElementById('slot-coin-slot-in');
            if (!IS_DEV_MODE && minigameCoins < SLOT_COIN_COST) {
                document.getElementById('slot-result-text').innerText = `コインが足りません（あと${SLOT_COIN_COST - minigameCoins}枚）`;
                return;
            }
            if (!IS_DEV_MODE) setMinigameCoins(minigameCoins - SLOT_COIN_COST);
            slotPlaysRemaining += SLOT_PLAYS_PER_COIN; // 残りがあっても、さらに継ぎ足せる（何度でも連続投入できる）
            saveGame(); updateDisplay();
            document.getElementById('slot-coin-value').innerText = IS_DEV_MODE ? '∞' : minigameCoins;
            updateSlotPlaysRemainingDisplay();

            coinSlot.classList.remove('slot-invite-glow-ring');
            playSlotCoinInsertAnim();
            setTimeout(() => {
                document.getElementById('slot-lever').classList.add('slot-invite-glow'); // 次はレバーの番、という合図
            }, CONFIG.SLOT_COIN_INSERT_LEVER_GLOW_DELAY_MS);
        }
        window.insertSlotCoin = insertSlotCoin; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * レバーを引く処理本体。3リールぶんの結果を先に内部で決定し、レバー・各リールのアニメーションと効果音を開始する。
         * @returns {void}
         */
        export function pullSlotLever() {
            if (slotIsSpinning) return;
            const lever = document.getElementById('slot-lever');
            if (!slotNextSpinFree && !lever.classList.contains('slot-invite-glow')) return; // コイン投入がまだの時は引けない
            slotIsSpinning = true;
            slotStoppedCount = 0;
            slotStoppedReels = [];
            slotTotalPulls++; slotPullsSinceJackpot++; // 総回転数・前回マーモットからの回転数は、リプレイぶんも含めて数える
            trackMissionEvent('minigamesToday', 1); trackMissionEvent('minigamesPlayedTotal', 1); trackMissionEvent('gachaSpinsToday', 1); trackMissionEvent('minigamesThisWeek', 1); trackMissionEvent('gachaSpinsThisWeek', 1);
            updateSlotPullsSinceJackpotDisplay();
            if (!slotNextSpinFree) {
                slotPlaysRemaining--; // リプレイは無料なので、残り回数を消費しない
                if (slotBonusZoneSpinsLeft > 0) slotBonusZoneSpinsLeft--; // 特化ゾーンも、リプレイでは消費しない
            }
            slotNextSpinFree = false;
            lever.classList.remove('slot-invite-glow');
            updateSlotPlaysRemainingDisplay();
            updateSlotBonusZoneDisplay();
            saveGame(); updateDisplay();
            document.getElementById('slot-result-text').innerText = '';
            document.getElementById('slot-payout-popup').style.display = 'none';
            clearSlotWinPulse();

            // レバーを引いた瞬間に、3つとも最終的な「真ん中の絵柄」を内部で先に決めてしまう（本物のスロットと同じ考え方）
            // 上・下の絵柄は、帯の並び順（SLOT_ALL_SYMBOLS）で真ん中の1つ前・1つ後ろに固定される
            slotReelResults = [pickWeightedSlotSymbol(), pickWeightedSlotSymbol(), pickWeightedSlotSymbol()];

            // レバー自体を、軸を中心に大きく倒れて戻る、という演出で動かす（180度近く回転し、軸を挟んで折りたたまれたような形になる）
            const baseRotation = parseFloat(lever.dataset.rotation || '0');
            lever.animate(
                [
                    { transform: `rotate(${baseRotation}deg)`, offset: 0 },
                    { transform: `rotate(${baseRotation + 180}deg)`, offset: 0.55 },
                    { transform: `rotate(${baseRotation + 180}deg)`, offset: 0.7 },
                    { transform: `rotate(${baseRotation}deg)`, offset: 1 },
                ],
                { duration: 550, easing: 'ease-in-out' }
            );
            lever.style.pointerEvents = 'none';
            playAudioFile('audio/gacha/crank.mp3');
            vibrate([15]);

            // 3つのリールを、それぞれ止まるまでずっと回し続ける（回転中のループ音も鳴らす）
            playSlotSpinLoopSound();
            [0, 1, 2].forEach(i => {
                const strip = document.getElementById(`slot-reel-strip-${i}`);
                const loopHeight = SLOT_ALL_SYMBOLS.length * SLOT_SYMBOL_HEIGHT;
                slotReelAnimations[i] = strip.animate(
                    [{ transform: 'translateY(0)' }, { transform: `translateY(-${loopHeight}px)` }],
                    { duration: 550, easing: 'linear', iterations: Infinity }
                );
                const btn = document.getElementById(`slot-stop-btn-${i}`);
                btn.classList.add('slot-invite-glow'); // 「今ここを押せる」の合図
                btn.dataset.stoppable = '1';
            });
        }
        window.pullSlotLever = pullSlotLever; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 指定したリールを止める。すでに1〜2列止まっている状況に応じて、リーチ判定・最終判定を予約する。
         * @param {number} reelIndex - 止めるリールの番号（0〜2）
         * @returns {void}
         */
        export function stopSlotReel(reelIndex) {
            const btn = document.getElementById(`slot-stop-btn-${reelIndex}`);
            if (!btn || btn.dataset.stoppable !== '1') return; // 回っていない・すでに止めた列は無視
            btn.dataset.stoppable = '0';
            btn.classList.remove('slot-invite-glow');
            // 押した瞬間、光がパッと弾けるような一瞬のフラッシュ演出
            btn.animate(
                [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2) drop-shadow(0 0 14px #fff176)' }, { filter: 'brightness(1)' }],
                { duration: CONFIG.SLOT_STOP_FLASH_MS, easing: 'ease-out' }
            );

            const strip = document.getElementById(`slot-reel-strip-${reelIndex}`);
            const symbol = slotReelResults[reelIndex];
            const n = SLOT_ALL_SYMBOLS.length;
            const symbolIndex = SLOT_ALL_SYMBOLS.findIndex(s => s.id === symbol.id);

            // 今の回転位置を保持したまま、決められた絵柄の位置へなめらかにスナップさせる
            const currentTransform = getComputedStyle(strip).transform;
            slotReelAnimations[reelIndex].cancel();
            strip.style.transform = currentTransform;
            void strip.offsetWidth;

            // 真ん中の絵柄が窓のちょうど中央（縦3コマの2段目）に来るよう、その1つ前の絵柄を窓の一番上に合わせる。
            // 帯の後ろの方（最後から2周目）に着地させることで、長く回った末に止まったように見せつつ、帯の端が見えないようにする
            const landingRep = SLOT_STRIP_REPEATS - CONFIG.SLOT_STRIP_LANDING_MARGIN;
            const topSymbolIndex = (symbolIndex - 1 + n) % n;
            const targetRow = landingRep * n + topSymbolIndex;
            const targetY = -(targetRow * SLOT_SYMBOL_HEIGHT);
            slotReelLandingRow[reelIndex] = targetRow; // 揃った絵柄を光らせる時に、DOM要素を逆算するために覚えておく

            strip.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.4, 1)';
            strip.style.transform = `translateY(${targetY}px)`;

            playAudioFile('audio/tap.mp3');
            vibrate([CONFIG.SLOT_REEL_STOP_VIBRATE_MS]);

            slotStoppedReels.push(reelIndex);
            slotStoppedCount++;
            if (slotStoppedCount === 2) {
                setTimeout(checkSlotReach, CONFIG.SLOT_REACH_CHECK_DELAY_MS); // 着地演出が落ち着いてから判定する
            } else if (slotStoppedCount >= 3) {
                stopSlotSpinLoopSound();
                setTimeout(evaluateSlotResult, CONFIG.SLOT_RESULT_EVALUATE_DELAY_MS);
            }
        }
        window.stopSlotReel = stopSlotReel; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        // 🎰 リーチ判定：2つ止まった時点で、5ラインのどこかで2つとも同じ絵柄が揃っていれば「リーチ」
        /**
         * 2つのリールが止まった時点で、5ラインのいずれかで絵柄が2つ揃っているか（リーチか）を判定する。
         * @returns {void}
         */
        export function checkSlotReach() {
            if (slotStoppedReels.length !== 2) return;
            const cols = {};
            slotStoppedReels.forEach(i => { cols[i] = getSlotReelColumn(slotReelResults[i]); });

            // 実際に一致しているラインだけを集める（斜めは、真ん中を含む場合は真ん中の段のみ、
            // 含まない場合は左右2列の対角の角どうしが一致した時だけ対象になる）
            const matchingLines = [];
            SLOT_LINE_ROW_OFFSETS.forEach((offsets, lineIdx) => {
                const a = cols[slotStoppedReels[0]][offsets[slotStoppedReels[0]]];
                const b = cols[slotStoppedReels[1]][offsets[slotStoppedReels[1]]];
                if (a.id === b.id) matchingLines.push({ lineIdx, symbol: a });
            });
            if (matchingLines.length === 0) return;

            const bestReach = matchingLines.reduce((best, m) => {
                const val = m.symbol.id === 'replay' ? CONFIG.SLOT_REPLAY_REACH_VALUE : m.symbol.payout;
                const bestVal = best.symbol.id === 'replay' ? CONFIG.SLOT_REPLAY_REACH_VALUE : best.symbol.payout;
                return val > bestVal ? m : best;
            }, matchingLines[0]);
            triggerSlotReachEffect(bestReach.symbol, matchingLines);
        }

        // 🎰 リーチ演出：効果音・絵柄の強調・大きな当たりの時だけカットイン
        /**
         * リーチ演出（効果音・絵柄の強調表示）を行い、高価値な絵柄のリーチの時はカットインも表示する。
         * @param {object} symbol - リーチしている絵柄（SLOT_SYMBOLS等の要素）
         * @param {Array<object>} matchingLines - 一致しているライン情報の配列（{lineIdx, symbol}）
         * @returns {void}
         */
        export function triggerSlotReachEffect(symbol, matchingLines) {
            playAudioFile('audio/slot/reach.mp3');
            vibrate([20, 30, 20]);
            document.getElementById('slot-result-text').style.color = '#ff3d00';
            document.getElementById('slot-result-text').innerText = 'リーチ！！';

            // 実際に一致しているラインの位置「だけ」を、3つ目が止まるまで強調して光らせる
            matchingLines.forEach(({ lineIdx }) => {
                const offsets = SLOT_LINE_ROW_OFFSETS[lineIdx];
                slotStoppedReels.forEach((reelIndex) => {
                    const strip = document.getElementById(`slot-reel-strip-${reelIndex}`);
                    const landingRow = slotReelLandingRow[reelIndex];
                    const el = strip.children[landingRow + offsets[reelIndex]];
                    if (el) el.classList.add('slot-reach-pulse');
                });
            });

            // BAR以上の高価値な絵柄が2つ揃っている時だけ、カットインで盛り上げる
            const isBigReach = symbol.id === 'replay' ? false : symbol.payout >= CONFIG.SLOT_WIN_TIER_LOW_PAYOUT;
            if (isBigReach) showSlotCutin();
        }

        // 🎬 カットイン：もちすけの驚き顔が、横から勢いよく滑り込んでくる演出
        /**
         * もちすけの驚き顔が横から滑り込んでくるカットイン演出を表示し、一定時間後に消す。
         * @returns {void}
         */
        export function showSlotCutin() {
            const stage = document.getElementById('slot-machine-stage');
            if (!stage) return;
            const cutin = document.createElement('img');
            cutin.src = 'ui_images/mochisuke/image_scream.webp';
            cutin.style.cssText = 'position:absolute; top:30%; left:50%; width:70%; transform:translate(-50%,-50%); z-index:500; pointer-events:none; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5)); animation: slotCutinSlide 900ms ease-in-out;';
            stage.appendChild(cutin);
            playAudioFile('audio/gacha/crank.mp3');
            setTimeout(() => cutin.remove(), CONFIG.SLOT_CUTIN_DURATION_MS);
        }

        // 🪙 払い出し口から、コインが実際に出てくる演出。countが多いほど「あふれ出す」感じになる
        /**
         * 払い出し口からコインが飛び出す演出を、count枚ぶん時間差で生成する。
         * @param {number} count - 生成するコインの枚数
         * @param {number} [pitchRate=1] - コイン効果音のピッチ倍率
         * @returns {void}
         */
        export function spawnSlotPayoutCoins(count, pitchRate = 1) {
            const stage = document.getElementById('slot-machine-stage');
            const slotOut = document.getElementById('slot-coin-slot-out');
            if (!stage || !slotOut) return;
            const stageRect = stage.getBoundingClientRect();
            const slotRect = slotOut.getBoundingClientRect();
            const baseTopPct = ((slotRect.top - stageRect.top) / stageRect.height) * 100;
            const baseLeftPct = ((slotRect.left - stageRect.left) / stageRect.width) * 100;
            const slotWidthPct = (slotRect.width / stageRect.width) * 100;

            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    const coin = document.createElement('img');
                    coin.src = 'ui_images/slot/coin.webp';
                    const startLeft = baseLeftPct + Math.random() * slotWidthPct;
                    coin.style.cssText = `position:absolute; top:${baseTopPct}%; left:${startLeft}%; width:9%; z-index:20; pointer-events:none;`;
                    stage.appendChild(coin);
                    const dx = (Math.random() - 0.5) * CONFIG.SLOT_PAYOUT_COIN_DX_RANGE; // 左右にランダムに散らばりながら落ちる
                    const rot = (Math.random() - 0.5) * CONFIG.SLOT_PAYOUT_COIN_ROTATION_RANGE;
                    coin.animate(
                        [
                            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0 },
                            { transform: `translate(${dx * 0.5}px, -18px) rotate(${rot * 0.3}deg)`, opacity: 1, offset: 0.3 },
                            { transform: `translate(${dx}px, 46px) rotate(${rot}deg)`, opacity: 0, offset: 1 },
                        ],
                        { duration: CONFIG.SLOT_PAYOUT_COIN_FALL_DURATION_MS + Math.random() * CONFIG.SLOT_PAYOUT_COIN_FALL_DURATION_VARIANCE_MS, easing: 'ease-in' }
                    ).finished.then(() => coin.remove());
                    // 当たりが大きいほど、ピッチを少し上げて景気良く聞こえるようにする
                    playAudioFilePitched('audio/tap.mp3', 0.6, pitchRate + (Math.random() - 0.5) * CONFIG.SLOT_PAYOUT_COIN_PITCH_JITTER);
                }, i * CONFIG.SLOT_PAYOUT_COIN_STAGGER_MS);
            }
        }

        // 真ん中の絵柄から、帯の並び順にもとづいて上・下の絵柄を求める（実際に窓に見えている3段ぶん）
        /**
         * 真ん中の絵柄から、帯の並び順にもとづいて上・下段の絵柄を求める（窓に見えている縦3段ぶん）。
         * @param {object} centerSymbol - 中段（真ん中）の絵柄（SLOT_ALL_SYMBOLS等の要素）
         * @returns {Array<object>} [上段, 中段, 下段] の絵柄配列
         */
        export function getSlotReelColumn(centerSymbol) {
            const n = SLOT_ALL_SYMBOLS.length;
            const idx = SLOT_ALL_SYMBOLS.findIndex(s => s.id === centerSymbol.id);
            return [SLOT_ALL_SYMBOLS[(idx - 1 + n) % n], centerSymbol, SLOT_ALL_SYMBOLS[(idx + 1) % n]]; // [上段, 中段, 下段]
        }

        // 揃ったラインの、実際に画面に見えている絵柄の要素を光らせる（rowOffsets=[各リールの段:0上/1中/2下]）
        /**
         * 揃ったラインについて、実際に画面に見えている絵柄の要素を光らせる。
         * @param {Array<number>} rowOffsets - 各リールの段（0=上/1=中/2=下）を並べた配列
         * @returns {void}
         */
        export function highlightSlotWinLine(rowOffsets) {
            rowOffsets.forEach((rowOffset, reelIndex) => {
                const strip = document.getElementById(`slot-reel-strip-${reelIndex}`);
                const landingRow = slotReelLandingRow[reelIndex];
                if (landingRow == null || !strip) return;
                const el = strip.children[landingRow + rowOffset];
                if (el) el.classList.add('slot-win-pulse');
            });
        }
        // 次にコインを投入する時（新しい回）に、前回光っていた絵柄をすべて消しておく
        /**
         * 前回光らせた「揃った絵柄」の強調表示（slot-win-pulse）をすべて解除する。
         * @returns {void}
         */
        export function clearSlotWinPulse() {
            document.querySelectorAll('.slot-win-pulse').forEach(el => el.classList.remove('slot-win-pulse'));
        }

        export const SLOT_LINE_ROW_OFFSETS = [
            [0, 0, 0], // 上段
            [1, 1, 1], // 中段
            [2, 2, 2], // 下段
            [0, 1, 2], // 斜め ↘
            [2, 1, 0], // 斜め ↗
        ];

        /**
         * 3列すべて止まった後の最終判定を行う。当選ラインの集計・コイン払い出し・演出（カットイン/フラッシュ/マーモット演出）を行う。
         * @returns {void}
         */
        export function evaluateSlotResult() {
            slotIsSpinning = false;
            const resultText = document.getElementById('slot-result-text');
            if (!resultText) return; // 回転中に画面を離れていたら、何もしない
            const lever = document.getElementById('slot-lever');
            if (lever) lever.style.pointerEvents = 'auto';
            document.querySelectorAll('.slot-reach-pulse').forEach(el => el.classList.remove('slot-reach-pulse')); // リーチ演出は、結果が出たら一旦リセット

            // 3列ぶんの縦3コマ(上・中・下)を求めて、5ライン(上段・中段・下段・斜め2本)を判定する
            const cols = slotReelResults.map(getSlotReelColumn); // cols[reel] = [top, mid, bottom]
            const lines = SLOT_LINE_ROW_OFFSETS.map(offsets => offsets.map((o, i) => cols[i][o]));
            const winningIndexes = lines.map((line, i) => (line[0].id === line[1].id && line[1].id === line[2].id) ? i : -1).filter(i => i >= 0);

            if (winningIndexes.length === 0) {
                resultText.style.color = '#8d6e63';
                resultText.innerText = 'また挑戦してね！';
                inviteNextSlotStep(); // 残りプレイがあればレバー、無ければコイン投入口を光らせる
                return;
            }

            winningIndexes.forEach(i => highlightSlotWinLine(SLOT_LINE_ROW_OFFSETS[i]));
            const winningLines = winningIndexes.map(i => lines[i]);
            const replayLines = winningLines.filter(l => l[0].id === 'replay');
            const payoutLines = winningLines.filter(l => l[0].id !== 'replay');

            if (payoutLines.length === 0) {
                // 揃ったのがリプレイのみ：コインは出ない代わりに、もう一度無料でレバーを引ける
                slotNextSpinFree = true;
                resultText.style.color = '#4caf50';
                resultText.innerText = `🍡 リプレイ！(${replayLines.length}ライン) コイン消費なしでもう一度！`;
                playAudioFile('audio/slot/replay.mp3');
                vibrate([15, 15, 15]);
                document.getElementById('slot-lever').classList.add('slot-invite-glow'); // コイン投入を飛ばして、直接レバーへ誘導
                return;
            }

            // 複数ライン揃った場合は、それぞれの配当を合計する
            const totalPayout = payoutLines.reduce((sum, l) => sum + SLOT_COIN_COST * l[0].payout, 0);
            setMinigameCoins(minigameCoins + totalPayout);
            saveGame(); updateDisplay();
            document.getElementById('slot-coin-value').innerText = IS_DEV_MODE ? '∞' : minigameCoins;
            resultText.style.color = '#e91e63';

            // 獲得枚数を、大きくバウンドしながら表示する演出
            const popup = document.getElementById('slot-payout-popup');
            popup.innerText = `+${totalPayout}枚！`;
            popup.style.display = 'block';
            popup.animate(
                [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
                { duration: 450, easing: 'ease-out', fill: 'forwards' }
            );

            const bestLine = payoutLines.reduce((best, l) => l[0].payout > best[0].payout ? l : best, payoutLines[0]);
            const bestSymbol = bestLine[0];
            const lineWord = payoutLines.length > 1 ? `${payoutLines.length}ライン` : '';

            // 出てくるコインの枚数・音の高さは、一番高い当たりの価値に応じて段階的に増やす（7・マーモットはあふれ出す量に）
            const coinCount = bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_HIGH_PAYOUT ? CONFIG.SLOT_PAYOUT_COIN_COUNT_TIER_HIGH : bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_MID_PAYOUT ? CONFIG.SLOT_PAYOUT_COIN_COUNT_TIER_MID : bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_LOW_PAYOUT ? CONFIG.SLOT_PAYOUT_COIN_COUNT_TIER_LOW : CONFIG.SLOT_PAYOUT_COIN_COUNT_TIER_MIN;
            const coinPitch = bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_HIGH_PAYOUT ? CONFIG.SLOT_PAYOUT_PITCH_TIER_HIGH : bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_MID_PAYOUT ? CONFIG.SLOT_PAYOUT_PITCH_TIER_MID : bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_LOW_PAYOUT ? CONFIG.SLOT_PAYOUT_PITCH_TIER_LOW : CONFIG.SLOT_PAYOUT_PITCH_TIER_MIN;
            spawnSlotPayoutCoins(coinCount + (payoutLines.length - 1) * CONFIG.SLOT_PAYOUT_EXTRA_COINS_PER_LINE, coinPitch); // 複数ライン揃った時は、その分コインも増える
            inviteNextSlotStep(); // 残りプレイがあればレバー、無ければコイン投入口を光らせる

            if (bestSymbol.isJackpot) {
                // 🐹 マーモット：最上位の大当たり演出。コインだけでは物足りないので、ガチャコインも一緒に付与する
                const bonusGachaCoins = CONFIG.SLOT_JACKPOT_BONUS_GACHA_COINS;
                setGachaCoins(gachaCoins + (bonusGachaCoins));
                slotJackpotCount++;
                trackMissionEvent('jackpotsThisWeek', 1);
                slotShortestJackpotPulls = (slotShortestJackpotPulls == null) ? slotPullsSinceJackpot : Math.min(slotShortestJackpotPulls, slotPullsSinceJackpot);
                slotLongestJackpotPulls = (slotLongestJackpotPulls == null) ? slotPullsSinceJackpot : Math.max(slotLongestJackpotPulls, slotPullsSinceJackpot);
                slotPullsSinceJackpot = 0;
                updateSlotPullsSinceJackpotDisplay();
                saveGame();
                resultText.innerHTML = `<span style="font-size:1.3rem;">🎉✨ ${bestSymbol.icon}${bestSymbol.icon}${bestSymbol.icon} 大当たり！！ ✨🎉</span><br>マーモット揃い！${lineWord} +${totalPayout}枚！！<br>🎰 ガチャコイン+${bonusGachaCoins}枚もおまけ！`;
                playAudioFile('audio/mochisuke/japan_clear.mp3');
                screenFlash('#ff6ec7', CONFIG.SLOT_JACKPOT_FLASH_OPACITY);
                vibrate([40, 50, 40, 50, 40, 50, 80]);
                setTimeout(() => showSlotMarmotCelebration(totalPayout, bonusGachaCoins), CONFIG.SLOT_MARMOT_CELEBRATION_DELAY_MS);
            } else {
                resultText.innerText = `${bestSymbol.icon}${bestSymbol.icon}${bestSymbol.icon} 揃った！${lineWord} +${totalPayout}枚！`;
                playAudioFile(bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_HIGH_PAYOUT ? 'audio/slot/win_seven.mp3' : bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_LOW_PAYOUT ? 'audio/slot/win_bar.mp3' : 'audio/slot/win_small.mp3');
                screenFlash('#ffd700', bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_MID_PAYOUT ? CONFIG.SLOT_WIN_FLASH_OPACITY_HIGH : CONFIG.SLOT_WIN_FLASH_OPACITY_NORMAL);
                vibrate(bestSymbol.payout >= CONFIG.SLOT_WIN_TIER_MID_PAYOUT ? [30, 40, 30, 40, 50] : [20, 30, 20]);
            }
        }


        // 🐹 マーモット揃いの、専用の豪華演出（画面暗転→大きなマーモット→もちすけの専用セリフ）
        /**
         * マーモット（大当たり）専用の演出オーバーレイを表示する。画面暗転→マーモット拡大→テキスト表示の順に見せ、
         * クリックで閉じると特化ゾーンへの突入処理を行う。
         * @param {number} payout - 今回の払い出し枚数
         * @param {number} bonusGachaCoins - おまけで付与するガチャコインの枚数
         * @returns {void}
         */
        export function showSlotMarmotCelebration(payout, bonusGachaCoins) {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; inset:0; z-index:3000; background:rgba(0,0,0,0); display:flex; flex-direction:column; align-items:center; justify-content:center; transition:background 0.4s;';
            overlay.innerHTML = `
                <img src="ui_images/slot/symbol_marmot.webp" alt="マーモット" style="width:0; transition:width 0.5s cubic-bezier(0.2,0.8,0.3,1.2); filter:drop-shadow(0 0 30px #ff6ec7);">
                <p style="color:#fff; font-weight:900; font-size:1.3rem; margin-top:16px; text-align:center; text-shadow:0 2px 8px rgba(0,0,0,0.6); opacity:0; transition:opacity 0.4s;">マーモットや！！<br>こんなん初めて見たで！！</p>
                <p style="color:#ffd700; font-weight:900; font-size:1.1rem; margin-top:10px; opacity:0; transition:opacity 0.4s;">+${payout}枚 獲得！</p>
                <p style="color:#e91e63; font-weight:900; font-size:1rem; margin-top:4px; opacity:0; transition:opacity 0.4s;">🎰 ガチャコイン +${bonusGachaCoins}枚もおまけ！</p>
                <p style="color:#ffab00; font-weight:900; font-size:1rem; margin-top:10px; opacity:0; transition:opacity 0.4s;">✨ この後${SLOT_BONUS_ZONE_SPINS}回、当たりやすい特化ゾーンに突入！ ✨</p>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => {
                overlay.style.background = 'rgba(20,10,20,0.88)';
                overlay.querySelector('img').style.width = '55%';
                overlay.querySelectorAll('p').forEach((p, i) => setTimeout(() => p.style.opacity = '1', CONFIG.SLOT_MARMOT_TEXT_STAGGER_BASE_MS + i * CONFIG.SLOT_MARMOT_TEXT_STAGGER_STEP_MS));
            });
            overlay.addEventListener('click', () => {
                overlay.style.background = 'rgba(0,0,0,0)';
                overlay.querySelectorAll('*').forEach(el => el.style.opacity = '0');
                setTimeout(() => overlay.remove(), CONFIG.SLOT_MARMOT_OVERLAY_FADE_MS);
                slotBonusZoneSpinsLeft = SLOT_BONUS_ZONE_SPINS;
                saveGame();
                updateSlotBonusZoneDisplay();
            });
        }





        /**
         * スロットの特化ゾーン残り回数を書き換える（他ファイルからのsetter）。
         * @param {number} v - 新しい特化ゾーン残り回数
         * @returns {void}
         */
        export function setSlotBonusZoneSpinsLeft(v) { slotBonusZoneSpinsLeft = v; }
        /**
         * スロットのマーモット的中回数を書き換える（他ファイルからのsetter）。
         * @param {number} v - 新しいマーモット的中回数
         * @returns {void}
         */
        export function setSlotJackpotCount(v) { slotJackpotCount = v; }
        /**
         * マーモットが出るまでの回転数の最長記録を書き換える（他ファイルからのsetter）。
         * @param {number|null} v - 新しい最長記録（未達成ならnull）
         * @returns {void}
         */
        export function setSlotLongestJackpotPulls(v) { slotLongestJackpotPulls = v; }
        /**
         * スロットの残りプレイ可能回数を書き換える（他ファイルからのsetter）。
         * @param {number} v - 新しい残りプレイ回数
         * @returns {void}
         */
        export function setSlotPlaysRemaining(v) { slotPlaysRemaining = v; }
        /**
         * 前回マーモットが出てからの回転数を書き換える（他ファイルからのsetter）。
         * @param {number} v - 新しい経過回転数
         * @returns {void}
         */
        export function setSlotPullsSinceJackpot(v) { slotPullsSinceJackpot = v; }
        /**
         * マーモットが出るまでの回転数の最短記録を書き換える（他ファイルからのsetter）。
         * @param {number|null} v - 新しい最短記録（未達成ならnull）
         * @returns {void}
         */
        export function setSlotShortestJackpotPulls(v) { slotShortestJackpotPulls = v; }
        /**
         * スロットの総回転数（全期間の累計プル回数）を書き換える（他ファイルからのsetter）。
         * @param {number} v - 新しい総回転数
         * @returns {void}
         */
        export function setSlotTotalPulls(v) { slotTotalPulls = v; }

/**
 * 稼働中のスロットの回転（リールアニメーション・回転ループ音）を停止する。
 * ミニゲームセンターを離脱する際、core.jsのcleanupActiveMinigameTimers()から呼ばれる。
 * @returns {void}
 */
export function cleanupSlotSpinState() {
    slotIsSpinning = false; // 回転中に離脱しても、次に開いた時にボタンが押せなくなったままにならないようにする
    slotReelAnimations.forEach(a => { if (a) { try { a.cancel(); } catch (e) {} } });
    stopSlotSpinLoopSound();
}
