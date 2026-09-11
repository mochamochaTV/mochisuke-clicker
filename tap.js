// 他ファイルへの依存はすべてこのimportに明示されている。書き換えが必要な値はsetXxx(...)という
// 関数呼び出しの形にしている（importした束縛には直接代入できないため。ESモジュールの仕様）。
import {
  FEED_TEASE_MAX_LEVEL, KISEKAE_ITEMS, SPRAY_ITEMS, cheerLines, clothesData, comboEndLines,
  dialogueData, feedTeaseComments, stages
} from './data.js?v=2026-09-11-002';
import {
  audioBuffers, createFloatingText, createParticle, createRippleEffect, formatMochi,
  getAudioContext, initAndPlayBGM, isBgmInitialized, pickRandom, playAudioFile, playBgmLoop,
  screenFlash, screenShake, sfxVolumeMult, spawnGoldMochi, vibrate
} from './main.js?v=2026-09-11-002';
import { isMinigameActive } from './minigames.js?v=2026-09-11-002';
import {
  checkStageProgress, currentStageIndex, currentStageProgress, equippedKisekae, getPrefTrophy,
  getPrestigeBonusMultiplier, getPrestigeCdReductionSec, getPrestigeStartingBonus, prefTaps,
  selectedStageIndex, setCurrentStageProgress, trackMissionEvent
} from './progress.js?v=2026-09-11-002';
import {
  activeSprayId, equippedClotheId, purchasedItems, renderShopList, sprayBuffActiveUntil,
  updateShopTabHighlight
} from './shop.js?v=2026-09-11-002';
import { saveGame, score, setScore, setTotalTapsCount, totalTapsCount } from './state.js?v=2026-09-11-002';
import {
  balloonAutoHideTimer, closeModal, feedMochisuke, flyBackKisekaeOverlays, flyOffKisekaeOverlays,
  getLocalDateString, hideMochiComment, isTutorialActive, setBalloonAutoHideTimer,
  showMochiComment, updateDisplay, updateMouthPatchVisibility
} from './ui.js?v=2026-09-11-002';

        // 🔧 タップ・スキル・演出まわりの調整用マジックナンバーをまとめた設定オブジェクト
        // （値は元のコードと完全に同じ。散らばっていた数値に名前を付けて集約しただけ）
        const CONFIG = {
          // --- タップ力・自動増加(MPS)計算 ---
          GOLD_TROPHY_BONUS_MULT: 1.1, // 🥇金トロフィー：その県の効果+10%
          FEVER_TAP_MULTIPLIER: 5, // フィーバー中はタップ力が5倍
          FEED_BUFF_MULTIPLIER: 2, // 給餌バフ中はタップ力/MPSが2倍
          MPS_GLOBAL_BOOST_MULT: 1.5, // 自動増加の全体的な底上げ倍率

          // --- コンボ ---
          COMBO_BONUS_TAP_INTERVAL: 10, // これだけコンボするごとにボーナス%が上がる
          COMBO_BONUS_PERCENT_PER_INTERVAL: 2, // 1区間あたりのボーナス%上昇量
          COMBO_REFLOW_THROTTLE_MS: 150, // 連打中の強制リフローを間引く間隔
          COMBO_TIER_50: 50,
          COMBO_TIER_100: 100,
          COMBO_TIER_500: 500,
          COMBO_TIER_1000: 1000,
          COMBO_MILESTONE_FIRST: 10, // 最初の演出節目
          COMBO_MILESTONE_SECOND: 25, // 2番目の演出節目
          COMBO_MILESTONE_REPEAT_INTERVAL: 50, // 1000コンボ超え後、これ毎に演出を繰り返す
          COMBO_1000_PARTICLE_COUNT: 30, // 1000コンボ達成時に散らすパーティクル数
          COMBO_1000_PARTICLE_SPREAD_X: 200, // パーティクル散布範囲(横)
          COMBO_1000_PARTICLE_SPREAD_Y: 300, // パーティクル散布範囲(縦)
          COMBO_TITLE_ALERT_DELAY_MS: 300, // 称号アラート表示までの遅延
          COMBO_FLASH_ALPHA_1000: 0.45,
          COMBO_FLASH_ALPHA_500: 0.35,
          COMBO_FLASH_ALPHA_100: 0.28,
          COMBO_FLASH_ALPHA_50: 0.25,
          COMBO_FLASH_ALPHA_DEFAULT: 0.2,
          COMBO_END_TIMEOUT_MS: 1200, // これだけタップが無いとコンボが終了する
          COMBO_END_COMMENT_MIN: 5, // これ以上コンボしていた時だけ終了セリフを出す
          BALLOON_AUTO_HIDE_MS: 4000, // 応援吹き出し・叫びセリフが自動で消えるまでの時間

          // --- 叫び演出 ---
          SCREAM_REVERT_MS: 2600, // 叫び顔から元に戻るまでの時間
          SCREAM_KANA_BURST_COUNT: 8, // 「あ゛」を飛び散らせる数
          SCREAM_KANA_MIN_DIST: 35,
          SCREAM_KANA_DIST_RANGE: 75,
          SCREAM_KANA_Y_OFFSET: 20,
          SCREAM_KANA_STAGGER_MS: 55, // 「あ゛」が時間差で出る間隔
          SCREAM_KANA_MIN_SIZE_REM: 1.1,
          SCREAM_KANA_SIZE_RANGE_REM: 0.9,
          SCREAM_VIBRATE_PATTERN: [60, 40, 60, 40, 80, 40, 100], // 覚醒・じらし限界共通の叫びバイブパターン
          AWAKENING_FLASH_ALPHA: 0.35,
          TEASE_LIMIT_FLASH_ALPHA: 0.28,
          TEASE_LIMIT_KANA_REPEAT: 10, // 我慢の限界で「あ゛」を繰り返す回数

          // --- タップ判定（会心・黄金・覚醒） ---
          SKILL1_BASE_BONUS_PERCENT: 100,
          SKILL1_BONUS_PER_LV: 50,
          SKILL1_PARTICLE_COUNT: 3, // スキル1発動中のパーティクル増加数
          SKILL2_CRIT_BASE_CHANCE: 0.20,
          SKILL2_CRIT_CHANCE_PER_LV: 0.05,
          SKILL3_BASE_BONUS_PERCENT: 200,
          SKILL3_BONUS_PER_LV: 25,
          SKILL4_GOLD_BASE_CHANCE: 0.10,
          SKILL4_GOLD_CHANCE_PER_LV: 0.02,
          SKILL4_GOLD_BONUS_PERCENT: 100, // 黄金判定成功時に加算されるボーナス%
          SKILL2_CRIT_BONUS_PERCENT: 100, // 会心判定成功時に加算されるボーナス%
          AWAKENING_CHANCE: 0.01, // 1/100の確率で覚醒
          AWAKENING_MULTIPLIER: 10,
          CRIT_FILTER_RESET_MS: 180, // 会心演出のフィルターを戻すまでの時間
          CRIT_FLASH_ALPHA: 0.22,
          CRIT_VIBRATE_MS: 30,
          GOLD_FLASH_ALPHA: 0.3,
          HISSATSU_TAP_MULTIPLIER: 5, // 必殺技発動中は1タップが5連打扱い

          // --- スキル共通のクールタイム計算 ---
          SKILL1_MIN_CD: 6,
          SKILL2_MIN_CD: 10,
          SKILL3_MIN_CD: 14,
          SKILL4_MIN_CD: 18,
          SKILL4_CD_REDUCTION_PER_LV_MULT: 2, // スキル4はLv毎の短縮量が2倍効く
          HISSATSU_MIN_TAPS_REQUIRED: 150,
          HISSATSU_BASE_TAPS_REQUIRED: 400,
          HISSATSU_TAPS_REDUCTION_PER_LV: 20,
          HISSATSU_ACTIVATE_FLASH_ALPHA: 0.4,
          SKILL_ACTIVATE_FLASH_ALPHA: 0.18,
          READY_SFX_VOLUME: 0.4, // クールタイム完了音の音量

          // --- 分身(スキル3)の見た目 ---
          BUNSHIN_CLONE_X_OFFSET: 130, // 左右の分身のX軸オフセット(px)
          BUNSHIN_CLONE_WIDTH_PX: 190,
          BUNSHIN_CLONE_OPACITY: 0.55,

          // --- スクイーズ（引っ張り伸縮） ---
          STRETCH_SOUND_BASE_PITCH: 0.85,
          STRETCH_SOUND_PITCH_RANGE: 0.5,
          STRETCH_SOUND_MAX_GAIN: 0.35,
          SQUEEZE_OVERSHOOT_RATIO: 0.55, // 離した時の揺れ戻りの大きさ
          SQUEEZE_OVERSHOOT_BASE_DURATION_MS: 420,
          SQUEEZE_OVERSHOOT_DURATION_RANGE_MS: 280,
          SQUEEZE_TRANSFORM_ORIGIN_RESET_MS: 720,
          TAP_RELEASE_ANIM_DURATION_MS: 240, // 通常タップ後の「もちっ」アニメーション時間
          BREATHE_IDLE_DELAY_MS: 1200, // 指を離してから呼吸アニメーションに戻るまでの時間

          // --- 給餌（おみやげ）まわり ---
          FEED_ICON_Y_OFFSET_PX: 68, // もちすけの足元からのアイコン初期位置オフセット
          FEED_ICON_PLACEMENT_DELAY_MS: 150, // モーダルが閉じるアニメと被らないための遅延
          FEED_ICON_RETURN_ANIM_MS: 320, // ドロップ失敗時、足元へ戻るアニメの時間
          FEED_BUFF_INDICATOR_INTERVAL_MS: 250,

          // --- フィーバー ---
          FEVER_SPAWN_CHECK_INTERVAL_MS: 25000,
          FEVER_SPAWN_CHANCE: 0.08,
          FEVER_DURATION_SEC: 10,
          FEVER_FLASH_ALPHA: 0.4,
          FEVER_TICK_INTERVAL_MS: 1000,

          // --- メインループ（100ms毎の自動増加・スキルタイマー更新） ---
          MAIN_TICK_INTERVAL_MS: 100,
          MAIN_TICK_DT: 0.1,
          MAIN_TICK_MPS_DIVISOR: 10,
          HISSATSU_AUTO_CHARGE_PER_TICK: 0.05, // タップしなくても少しずつたまる必殺技ゲージ
        };

        export let skills = {
            skill1: { id: "skill1", name: "もちもちクリック", lv: 0, cd: 30, currentCd: 0, duration: 10, activeTimer: 0, unlockStage: 0, unlockPrice: 300, lvPriceMult: 1.9, desc: "発動中はタップでパーティクルが3倍出る" },
            skill2: { id: "skill2", name: "会心のもち肌", lv: 0, cd: 40, currentCd: 0, duration: 10, activeTimer: 0, unlockStage: 1, unlockPrice: 1200, lvPriceMult: 1.9, desc: "発動中は一定確率でタップが会心(×2)になる" },
            skill3: { id: "skill3", name: "もちすけ分身の術", lv: 0, cd: 50, currentCd: 0, duration: 12, activeTimer: 0, unlockStage: 4, unlockPrice: 6000, lvPriceMult: 2.0, desc: "発動中は分身が出現し打撃力が3倍になる" },
            skill4: { id: "skill4", name: "黄金のもち福", lv: 0, cd: 60, currentCd: 0, duration: 10, activeTimer: 0, unlockStage: 8, unlockPrice: 20000, lvPriceMult: 2.0, desc: "発動中は一定確率でタップが黄金(×2)になる" },
            hissatsu: { id: "hissatsu", name: "もちもちビッグバン", lv: 0, cd: 90, currentCd: 0, duration: 15, activeTimer: 0, unlockStage: 15, unlockPrice: 100000, lvPriceMult: 2.1, desc: "発動中はタップが5連打扱いになる大技（クールタイムはタップ数で回復）" }
        };

        // 基本セーブ用変数
        export const FEED_BUFF_DURATION_MS = 10000; // 効果の持続時間（🍴ボタン追加で与えやすくなった分、20秒→10秒に短縮）
        export let feedBuffActiveUntil = 0; // このタイムスタンプまで、タップ力が2倍になる
        export const FEED_DAILY_LIMIT = 5; // 1日にあげられる回数の上限
        export let feedLastResetDate = '';
        export let feedPlaysUsedToday = 0;
        export let isFever = false; export let feverTimeLeft = 0; export let feverInterval = null;
        export let comboCount = 0; export let comboTimer = null; export let comboEndCommentId = 0; export let lastComboReflowTime = 0;
        export let mochiLongPressTimer = null;
        export const MOCHI_LONGPRESS_MS = 600; // これ以上押しっぱなしにすると「つぶれる〜」的なセリフが出る
        export let lastTappedTime = Date.now();

        // ===================================================================
        // 🗨️ もちすけのセリフデータ（ここに追記するだけで自由にセリフを増やせます）
        // ===================================================================
        // ・timeGreetings : 時間帯ごとの挨拶。1日に何度か、時間帯が変わったタイミングでランダムに1つ喋ります。
        // ・idleComments  : 特に何もない時、たまにランダムで喋る汎用のつぶやき集。
        // ・eventComments : プレゼント出現やレベルアップなど「できごと」が起きた時に喋るセリフ。
        //                   配列の中からランダムに1つ選ばれます。
        // ・prefectureComments : 今いる都道府県だけで喋る、ご当地限定セリフ。配列に複数書けばランダムに選ばれます。
        //                        キーは stages 配列の name（例:"東京"）と完全に一致させてください。
        // すべて配列に1行追加するだけで増やせます。改行はできないので、長い文は短く区切ってください。
        // ===================================================================
        export let breatheTimer = null; export let isMochiPressed = false;
        // 🫧 スクイーズ機能：引っ張った方向にもちすけが伸び縮みする（回転はしない）
        export let squeezeStartX = 0, squeezeStartY = 0, isDraggingSqueeze = false, isSqueezeSettling = false;
        export let squeezeLastDx = 0, squeezeLastDy = 0;
        export const SQUEEZE_MAX_DRAG = 70; // これ以上引っ張っても伸びが頭打ちになる距離(px)
        export const SQUEEZE_MAX_STRETCH = 0.38; // 最大でどれだけ伸びるか（+38%）
        export const SQUEEZE_MAX_SQUASH = 0.22; // 伸びる方向と垂直に、最大どれだけ縮むか（-22%）
        export const SQUEEZE_MIN_DRAG = 9; // これ未満の移動は「タップ」として扱い、通常のもちっとアニメーションにする
        export const SQUEEZE_ELEMENT_RADIUS = 95; // もちすけの見た目上の半径の目安(px)。伸びを引っ張った側だけに見せるためのオフセット計算に使う

        // 🫧🫧 2本指ストレッチ機能：指2本でもちすけを逆方向に引っ張ると、中心を固定したまま両側へ伸びる。
        // 1本指スクイーズ（片側だけ固定して反対側だけ伸ばす）とは見た目の計算式が異なるため、状態・関数ともに分けている。
        export let squeezePointers = new Map(); // pointerId -> {x, y}  現在もちすけに触れている指ごとの座標
        export let twoFingerStretchActive = false; // 2本指ストレッチ中かどうか
        export let twoFingerStartDist = 0;  // 2本目の指が触れた瞬間の、2点間の距離(px)。ここからの伸びだけを見る
        export let twoFingerLastRatio = 0;  // 直近の2本指ストレッチ比率（0〜1）。離した時の揺れ戻りの大きさに使う
        export let twoFingerLastAngleDeg = 0; // 直近の2本指ストレッチの軸の角度（離した時の揺れ戻りに使う）
        export const TWO_FINGER_MAX_STRETCH_DIST = 130; // 2点間の距離がこれだけ開くと伸びが頭打ちになる(px)。指1本分のSQUEEZE_MAX_DRAGより大きめにしているのは、指2本だと自然と大きく開けるため
        export const TWO_FINGER_MIN_STRETCH_RATIO = 0.05; // これ未満の伸びは「ただ2本指で触れただけ」として扱い、揺れ戻り演出を出さない
        export let stretchSoundSource = null, stretchSoundGain = null;
        

        // 🔊 効果音再生システム（Web Audio API方式）
        // これまでは<audio>要素を1音につき6個ずつ使い回すプール方式でしたが、iOSは
        // 「実際にユーザー操作の中で.play()を呼んだ"その要素"」しか解錠しない仕様があり、
        // ローテーションで残りの要素が回ってきた時に無音になったり、解錠のために48個ものAudio要素を
        // 一斉にplay/pauseすることで起動直後に処理が重くなったりしていました。
        // Web Audio APIなら、AudioContextを1個resume()するだけで以後すべての音が解錠されるため、
        // 個別のAudio要素を大量に操作する必要が無くなり、軽量かつ確実になります。
        // また音声データは事前にデコードしてメモリ上に持つので、Service Workerのキャッシュ
        // （Rangeリクエストの不整合が起きやすい）を一切経由しません。
        export let gameScreenRect = null;
        export let bunshinCloneRects = [];
        export let bunshinCloneEls = [];
        /**
         * 分身(スキル3)のDOM要素を取得し直し、それぞれの矩形をキャッシュし直す。
         * @returns {void}
         */
        export function refreshBunshinCloneRects() {
            bunshinCloneEls = Array.from(document.querySelectorAll('.bunshin-clone-img'));
            bunshinCloneRects = bunshinCloneEls.map(c => c.getBoundingClientRect());
        }
        /**
         * 現在の基礎タップ力（1回タップで得られるもちの量）を各種ボーナスを反映して計算する。
         * @returns {number} 整数に切り捨てたタップ力
         */
        export function getTapPower() {
            let power = 1 + getPrestigeStartingBonus();
            stages.forEach((stage, idx) => {
                const lv = purchasedItems[idx] || 0;
                if (lv > 0) {
                    let bonus = stage.tapBonus * lv;
                    if (getPrefTrophy(idx) === 'gold') bonus *= CONFIG.GOLD_TROPHY_BONUS_MULT; // 🥇金トロフィー：その県の効果+10%
                    power += bonus;
                }
            });
            const activeClothe = clothesData.find(c => c.id === equippedClotheId);
            if (activeClothe) power += activeClothe.tapBonus;
            // コンボのボーナスはここではなく、executeSingleTap側の加算方式(bonusPercent)で一括管理する
            if (isFever) power *= CONFIG.FEVER_TAP_MULTIPLIER;
            power *= getPrestigeBonusMultiplier(); // 転生ボーナス（控えめ・線形）
            if (Date.now() < feedBuffActiveUntil) power *= CONFIG.FEED_BUFF_MULTIPLIER; // もちすけにお土産をあげた効果（一時的）

            // 【重要】スキル1(もちもちクリック)・スキル3(分身)によるタップ力ブーストは、
            // ここではなくexecuteSingleTap()側の加算方式(bonusPercent)でのみ適用する。
            // 以前はここでも掛け算していたため、実際のタップ時に二重にブーストがかかってしまっていた。
            return Math.floor(power);
        }

        /**
         * 現在の自動増加量(もち/秒＝MPS)を各種ボーナスを反映して計算する。
         * @returns {number} 自動増加量(もち/秒)
         */
        export function getMps() {
            let mps = getPrestigeStartingBonus();
            stages.forEach((stage, idx) => {
                const lv = purchasedItems[idx] || 0;
                if (lv > 0) {
                    let bonus = stage.mpsBonus * lv;
                    if (getPrefTrophy(idx) === 'gold') bonus *= CONFIG.GOLD_TROPHY_BONUS_MULT; // 🥇金トロフィー：その県の効果+10%
                    mps += bonus;
                }
            });
            const activeClothe = clothesData.find(c => c.id === equippedClotheId);
            if (activeClothe) mps += activeClothe.mpsBonus;
            mps *= CONFIG.MPS_GLOBAL_BOOST_MULT; // 🔧 自動増加の恩恵を全体的に強化（プレイヤーからの要望を受けて底上げ）
            mps *= getPrestigeBonusMultiplier(); // 転生ボーナス（控えめ・線形）
            if (Date.now() < feedBuffActiveUntil) mps *= CONFIG.FEED_BUFF_MULTIPLIER; // もちすけにお土産をあげた効果（一時的）
            if (Date.now() < sprayBuffActiveUntil && activeSprayId) {
                const sprayItem = SPRAY_ITEMS.find(i => i.id === activeSprayId);
                if (sprayItem) mps *= sprayItem.mpsMultiplier; // ✨ スプレーの自動増加バフ（1日）
            }
            return mps;
        }

        // 10コンボ毎に+2%（例：50コンボで+10%、100コンボで+20%）。控えめな伸び方にして、頭打ちなく積み上げていける
        /**
         * 現在のコンボ数から、タップ力に加算するコンボボーナス(%)を計算する。
         * @returns {number} ボーナス割合(%)
         */
        export function getComboBonusPercent() {
            return Math.floor(comboCount / CONFIG.COMBO_BONUS_TAP_INTERVAL) * CONFIG.COMBO_BONUS_PERCENT_PER_INTERVAL;
        }

        // 🎉 応援セリフ（コンボ中、タップしても消えない専用のセリフ。段階ごとに複数用意し、確率でランダムに選ぶ）
        /**
         * 現在のコンボ数がどの応援セリフ段階に属するかを判定する。
         * @param {number} count - 現在のコンボ数
         * @returns {number} 段階を表す閾値（1000/500/100/50/0）
         */
        export function getCheerTier(count) {
            if (count >= CONFIG.COMBO_TIER_1000) return CONFIG.COMBO_TIER_1000;
            if (count >= CONFIG.COMBO_TIER_500) return CONFIG.COMBO_TIER_500;
            if (count >= CONFIG.COMBO_TIER_100) return CONFIG.COMBO_TIER_100;
            if (count >= CONFIG.COMBO_TIER_50) return CONFIG.COMBO_TIER_50;
            return 0;
        }
        export let lastCheerTier = -1;
        export let lastCheerChangeTime = 0;
        export const CHEER_MIN_DISPLAY_MS = 1800; // これより短い間隔では、セリフを切り替えない（読めないほど頻繁に変わるのを防ぐ）
        /**
         * コンボ段階が変わったか、前回切り替えから一定時間経過していれば、応援セリフを吹き出しに表示する。
         * @param {number} count - 現在のコンボ数
         * @returns {void}
         */
        export function updateCheerBalloon(count) {
            if (count <= 0 || isTutorialActive) return;
            const tier = getCheerTier(count);
            const now = Date.now();
            const tierChanged = tier !== lastCheerTier;
            if (tierChanged || (now - lastCheerChangeTime > CHEER_MIN_DISPLAY_MS)) {
                lastCheerTier = tier;
                lastCheerChangeTime = now;
                const balloon = document.getElementById('mochi-balloon');
                clearTimeout(balloonAutoHideTimer);
                balloon.innerText = pickRandom(cheerLines[tier]);
                balloon.classList.add('balloon-show');
                setBalloonAutoHideTimer(setTimeout(() => { balloon.classList.remove('balloon-show'); }, CONFIG.BALLOON_AUTO_HIDE_MS));
            }
        }

        // 節目ちょうどの瞬間だけ、スロットリングを無視して即座に専用セリフへ切り替える
        /**
         * スロットリングを無視して、指定テキストを即座に応援吹き出しへ表示する。
         * @param {string} text - 表示するセリフ
         * @param {number} tierMarker - lastCheerTierに保存する段階マーカー
         * @returns {void}
         */
        export function forceCheerLine(text, tierMarker) {
            lastCheerTier = tierMarker;
            lastCheerChangeTime = Date.now();
            const balloon = document.getElementById('mochi-balloon');
            clearTimeout(balloonAutoHideTimer);
            balloon.innerText = text;
            balloon.classList.add('balloon-show');
            setBalloonAutoHideTimer(setTimeout(() => { balloon.classList.remove('balloon-show'); }, CONFIG.BALLOON_AUTO_HIDE_MS));
        }

        export let hasComboTitle1000 = false; // 1000コンボ到達の称号を、初回だけお祝いするためのフラグ
        /**
         * コンボ数を加算し、コンボ表示・演出（節目のシェイク/フラッシュ/パーティクル等）を更新する。
         * @param {number} [times=1] - 加算するコンボ数
         * @returns {void}
         */
        export function handleCombo(times = 1) {
            const prevCount = comboCount;
            comboCount += times;
            const comboEl = document.getElementById('combo-display');
            const numEl = document.getElementById('combo-num');
            const labelEl = document.getElementById('combo-label');

            numEl.textContent = comboCount;
            if (comboCount >= 10) {
                const multiplier = (1 + getComboBonusPercent() / 100).toFixed(2);
                labelEl.innerHTML = `コンボ！<span class="combo-mult-part">×${multiplier}</span>`;
            } else {
                labelEl.textContent = 'コンボ！';
            }

            // 強制リフロー(void .offsetWidth)は、超連打中に毎回走ると重くなるため、直近150ms以内は間引く
            // （テキスト自体はスキップせず毎回更新、"ポンと弾む"再アニメーションだけを間引く）
            const nowCombo = performance.now();
            if (nowCombo - lastComboReflowTime > CONFIG.COMBO_REFLOW_THROTTLE_MS) {
                lastComboReflowTime = nowCombo;
                comboEl.classList.remove('combo-bounce', 'combo-tier-50', 'combo-tier-100', 'combo-tier-500', 'combo-tier-1000');
                void comboEl.offsetWidth;
                comboEl.classList.add('combo-bounce');
            } else {
                comboEl.classList.add('combo-bounce'); // 既に表示中なら、reflow無しでそのまま維持
            }
            if (comboCount >= CONFIG.COMBO_TIER_1000) comboEl.classList.add('combo-tier-1000');
            else if (comboCount >= CONFIG.COMBO_TIER_500) comboEl.classList.add('combo-tier-500');
            else if (comboCount >= CONFIG.COMBO_TIER_100) comboEl.classList.add('combo-tier-100');
            else if (comboCount >= CONFIG.COMBO_TIER_50) comboEl.classList.add('combo-tier-50');

            // 節目のコンボ数で、画面にも一段大きなご褒美演出を出す（大きな節目ほど豪華に）
            const namedMilestones = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
            const bigMilestone = namedMilestones.find(m => prevCount < m && comboCount >= m);
            if (comboCount === CONFIG.COMBO_MILESTONE_FIRST || comboCount === CONFIG.COMBO_MILESTONE_SECOND || bigMilestone || (comboCount > CONFIG.COMBO_TIER_1000 && comboCount % CONFIG.COMBO_MILESTONE_REPEAT_INTERVAL === 0)) {
                comboEl.classList.remove('combo-milestone-pop');
                void comboEl.offsetWidth;
                comboEl.classList.add('combo-milestone-pop');

                if (bigMilestone === CONFIG.COMBO_TIER_1000) {
                    screenShake('big'); screenFlash('#ffd700', CONFIG.COMBO_FLASH_ALPHA_1000);
                    for (let i = 0; i < CONFIG.COMBO_1000_PARTICLE_COUNT; i++) createParticle(window.innerWidth / 2 + (Math.random() - 0.5) * CONFIG.COMBO_1000_PARTICLE_SPREAD_X, window.innerHeight / 2 + (Math.random() - 0.5) * CONFIG.COMBO_1000_PARTICLE_SPREAD_Y, true);
                    if (!hasComboTitle1000) {
                        hasComboTitle1000 = true;
                        saveGame();
                        setTimeout(() => alert('🏆 称号「もちマスター」を獲得しました！\n1000コンボ、本当にお疲れさまでした！'), CONFIG.COMBO_TITLE_ALERT_DELAY_MS);
                    }
                } else if (bigMilestone >= CONFIG.COMBO_TIER_500) {
                    screenShake('big'); screenFlash('#e0e0e0', CONFIG.COMBO_FLASH_ALPHA_500);
                } else if (bigMilestone >= CONFIG.COMBO_TIER_100) {
                    screenShake('small'); screenFlash('#ff5252', CONFIG.COMBO_FLASH_ALPHA_100);
                } else if (bigMilestone === CONFIG.COMBO_TIER_50) {
                    screenShake('small'); screenFlash('#fff176', CONFIG.COMBO_FLASH_ALPHA_50);
                } else {
                    screenShake('small'); screenFlash('#ffab00', CONFIG.COMBO_FLASH_ALPHA_DEFAULT);
                }
            }

            // 節目ちょうどの瞬間は、実際の数字入りの専用セリフを最優先で出す（「300コンボ中なのに100コンボ突破や」のようなズレを防ぐ）
            if (bigMilestone) {
                const exactLine = bigMilestone === 1000 ? '1000コンボ突破おめでとう！' : `${bigMilestone}コンボ突破や！`;
                forceCheerLine(exactLine, getCheerTier(comboCount));
            } else {
                updateCheerBalloon(comboCount);
            }

            clearTimeout(comboTimer);
            comboTimer = setTimeout(() => {
                const finishedCombo = comboCount;
                comboCount = 0;
                lastCheerTier = -1;
                comboEl.classList.remove('combo-bounce', 'combo-tier-50', 'combo-tier-100', 'combo-tier-500', 'combo-tier-1000');
                if (finishedCombo >= CONFIG.COMBO_END_COMMENT_MIN && !isTutorialActive) {
                    showMochiComment(pickRandom(comboEndLines));
                    // 通常のセリフと同様、しばらく経ってもタップされなければ自然に引っ込める
                    const myEndCommentId = ++comboEndCommentId;
                    setTimeout(() => {
                        if (myEndCommentId === comboEndCommentId) hideMochiComment();
                    }, CONFIG.BALLOON_AUTO_HIDE_MS);
                }
            }, CONFIG.COMBO_END_TIMEOUT_MS);
        }

        // 単一タップの計算と個別エフェクト処理の分離
        // 🗣️ 叫び演出（覚醒・お腹すいた、共通）：どちらから呼ばれても、タイマーを1本化して競合を防ぐ
        export let screamRevertTimeout = null;
        /**
         * もちすけの見た目を叫び顔に切り替え、帽子・顔パーツを吹き飛ばし、一定時間後に元へ戻すタイマーをセットする。
         * @returns {void}
         */
        export function startScreamFace() {
            isScreamActive = true;
            mochiBreatheWrapEl.classList.remove('breathe-idle');
            mochiDeformWrap.classList.remove('mochi-scream');
            void mochiDeformWrap.offsetWidth;
            mochiDeformWrap.classList.add('mochi-scream'); // 拡大・シェイクは、帽子・顔パーツも道連れの入れ物にかける
            mochiBtnElement.src = 'ui_images/mochisuke/image_scream.webp';
            // 🤖 ロボもちすけ装備中は、叫ぶ間だけロボを隠して、下の素の叫び顔を見せる
            if (typeof equippedKisekae !== 'undefined' && equippedKisekae.fullbody) {
                mochiBtnElement.style.opacity = '1';
                const fbEl = document.getElementById('mochisuke-fullbody');
                if (fbEl) fbEl.style.display = 'none';
            }
            flyOffKisekaeOverlays(); // 🎩💨 叫びの勢いで、帽子・顔パーツが吹っ飛ぶ
            updateMouthPatchVisibility();

            clearTimeout(screamRevertTimeout);
            screamRevertTimeout = setTimeout(revertScreamFace, CONFIG.SCREAM_REVERT_MS); // 連打中でも「叫んでいる」とちゃんと分かるよう、数秒間キープする
        }
        // タイマー経過でも、給餌などによる途中中断でも、必ずこの1箇所を通して確実に元へ戻す
        /**
         * 叫び顔状態を解除して通常のもちすけ画像に戻し、帽子・顔パーツを元通りに戻す。
         * @returns {void}
         */
        export function revertScreamFace() {
            clearTimeout(screamRevertTimeout);
            isScreamActive = false;
            mochiBtnElement.src = getMochisukeBaseImg();
            mochiDeformWrap.classList.remove('mochi-scream');
            // 🤖 ロボもちすけ装備中なら、叫び終わったのでロボの表示に戻す
            if (typeof equippedKisekae !== 'undefined' && equippedKisekae.fullbody) {
                mochiBtnElement.style.opacity = '0';
                const fbEl = document.getElementById('mochisuke-fullbody');
                if (fbEl) fbEl.style.display = 'block';
            }
            flyBackKisekaeOverlays(); // 🎩 通常に戻ったら、飛んでいった帽子・顔パーツをまた着け直す
            if (!isMochiPressed) mochiBreatheWrapEl.classList.add('breathe-idle');
            updateMouthPatchVisibility();
        }

        // 🌟 覚醒：ごく低確率でもちすけが覚醒して叫び、そのタップだけ10倍のもちを吐き出す
        // （おみやげをあげないときの「我慢の限界」の叫びとは完全に別の仕組み。見た目・音は使い回すが、もちの量には影響しない）
        /**
         * ごく低確率の覚醒演出一式（効果音・バイブ・画面シェイク/フラッシュ・叫び顔・専用セリフ）をまとめて実行する。
         * @returns {void}
         */
        export function triggerAwakeningScream() {
            playAudioFile('audio/mochisuke/mochi_scream.mp3');
            vibrate(CONFIG.SCREAM_VIBRATE_PATTERN);
            screenShake('big');
            screenFlash('#ffd700', CONFIG.AWAKENING_FLASH_ALPHA);

            startScreamFace();

            spawnScreamKanaBurst();
            showMochiComment('もちもちパワー全開やああああ！！');
        }

        /**
         * 1回分のタップ処理の中核。ボーナス%を積み上げてタップ力を確定し、会心/黄金/覚醒抽選、パーティクル・スコア・演出処理までを行う。
         * @param {number} clientX - タップされたクライアントX座標
         * @param {number} clientY - タップされたクライアントY座標
         * @returns {void}
         */
        export function executeSingleTap(clientX, clientY) {
            let power = getTapPower();
            let isCrit = false;
            let isGold = false;

            // 各スキルの倍率を「%」で積み上げて、最後にまとめて1回だけ掛ける方式に変更。
            // 以前は ×2 × ×2 × ×3 のように掛け算を連鎖させていたため、全部同時発動すると
            // 最大12倍(確率込みだと更に上)まで跳ね上がってしまっていた。
            // 加算方式なら +100% +100% +200% = 合計+400%(＝5倍)で頭打ちになり、伸びすぎを防げる。
            let bonusPercent = 0;
            bonusPercent += getComboBonusPercent(); // コンボボーナス（10コンボ毎に+2%）

            // スキル1：もちもちクリック効果（Lvに応じて加算）。旧・掛け算式(2 + (lv-1)*0.5)の等価値
            if (skills.skill1.activeTimer > 0) {
                bonusPercent += CONFIG.SKILL1_BASE_BONUS_PERCENT + (skills.skill1.lv - 1) * CONFIG.SKILL1_BONUS_PER_LV;
            }

            // スキル4：黄金のもち福の判定（会心と重ねて乗ってOK）
            if (skills.skill4.activeTimer > 0) {
                const goldChance = CONFIG.SKILL4_GOLD_BASE_CHANCE + (skills.skill4.lv - 1) * CONFIG.SKILL4_GOLD_CHANCE_PER_LV;
                if (Math.random() < goldChance) {
                    isGold = true;
                    bonusPercent += CONFIG.SKILL4_GOLD_BONUS_PERCENT;
                }
            }

            // スキル2：会心のもち肌の判定（黄金と重複してOK）
            if (skills.skill2.activeTimer > 0) {
                const critChance = CONFIG.SKILL2_CRIT_BASE_CHANCE + (skills.skill2.lv - 1) * CONFIG.SKILL2_CRIT_CHANCE_PER_LV;
                if (Math.random() < critChance) {
                    isCrit = true;
                    bonusPercent += CONFIG.SKILL2_CRIT_BONUS_PERCENT;
                }
            }

            // スキル3：分身発動中は打撃力そのものにもボーナスが乗る。
            // Lv8未満は固定+200%(×3相当)、Lv8以降はそこからさらに緩やかに伸びる
            const SKILL3_SCALING_LV = 8;
            if (skills.skill3.activeTimer > 0) {
                const skill3Bonus = skills.skill3.lv < SKILL3_SCALING_LV
                    ? CONFIG.SKILL3_BASE_BONUS_PERCENT
                    : CONFIG.SKILL3_BASE_BONUS_PERCENT + (skills.skill3.lv - SKILL3_SCALING_LV) * CONFIG.SKILL3_BONUS_PER_LV;
                bonusPercent += skill3Bonus;
            }

            power = Math.floor(power * (1 + bonusPercent / 100));

            // 🌟 覚醒判定：1/100の確率で、このタップだけもちが10倍になる
            let isAwakening = false;
            if (!isTutorialActive && Math.random() < CONFIG.AWAKENING_CHANCE) {
                isAwakening = true;
                power *= CONFIG.AWAKENING_MULTIPLIER;
            }

            // パーティクルの色設定（スキル4の確率判定(isGold)に当たった時だけ金色にする）
            let isGoldParticle = isGold;

            // スキル1：もちもちクリック発動時は弾ける量をさらに追加
            let pCount = skills.skill1.activeTimer > 0 ? CONFIG.SKILL1_PARTICLE_COUNT : 1;
            for (let i = 0; i < pCount; i++) {
                createParticle(clientX, clientY, isGoldParticle);
            }

            // スキル3：分身発動時は左右の分身からも個別にパーティクルを発射
            // （毎タップでquerySelectorAll+getBoundingClientRectを呼ぶと強制レイアウトが走るため、
            //   分身作成/変形のタイミングで一度だけ計測してキャッシュしたものを使い回す）
            if (skills.skill3.activeTimer > 0 && bunshinCloneRects.length > 0) {
                bunshinCloneRects.forEach(cRect => {
                    const cx = cRect.left + cRect.width / 2;
                    const cy = cRect.top + cRect.height / 2;
                    createParticle(cx, cy, isGoldParticle);
                });
            }

            // スコア・進捗加算
            if (selectedStageIndex === currentStageIndex && currentStageIndex < stages.length) {
                setScore(score + (power)); setCurrentStageProgress(currentStageProgress + (power)); checkStageProgress();
            } else {
                setScore(score + (power));
            }

            // 新SE視覚演出（音を先に鳴らしてから見た目の処理をする＝DOM生成が音の発火を遅らせないようにする）
            if (isAwakening) {
                triggerAwakeningScream();
                createFloatingText(clientX, clientY, `😱覚醒！×10 +${formatMochi(power)}`, "#ff1744", "2rem");
            } else if (isCrit) {
                playAudioFile('audio/critical.mp3');
                vibrate(CONFIG.CRIT_VIBRATE_MS);
                screenShake('small');
                screenFlash('#ff5722', CONFIG.CRIT_FLASH_ALPHA);
                createFloatingText(clientX, clientY, `🔥会心! +${formatMochi(power)}`, "#ff3d00", "1.65rem");
                mochiBtnElement.style.filter = "contrast(2.5) brightness(1.1) grayscale(0.2)";
                clearTimeout(critFilterTimeout); // 連続で会心が出た時に前のタイマーが後から発火して消し合うのを防ぐ
                const myCritId = ++critTapId;
                critFilterTimeout = setTimeout(() => {
                    if (myCritId === critTapId) resetMochiFilter(); // 自分より後の会心が発生していなければリセット
                }, CONFIG.CRIT_FILTER_RESET_MS);
            } else if (isGold) {
                playAudioFile('audio/gold_mochi.mp3');
                vibrate([20, 30, 20]);
                screenShake('big');
                screenFlash('#ffd700', CONFIG.GOLD_FLASH_ALPHA);
                createFloatingText(clientX, clientY, `✨黄金! +${formatMochi(power)}`, "#ffd700", "1.65rem");
            } else {
                createFloatingText(clientX, clientY, `+${formatMochi(power)} もち`);
            }
        }

        export const mochiBtnElement = document.getElementById('mochisuke-btn');
        export const mochiDeformWrap = document.getElementById('mochisuke-deform-wrap'); // タップ・スクイーズの見た目の変形は、もちすけ本体ではなくこちらにかける（帽子・顔パーツ・口も道連れで一緒に動くように）
        export const mochiBreatheWrapEl = document.getElementById('mochisuke-breathe-wrap'); // 呼吸アニメーションは、もちすけ画像と口パーツをまとめて包むこちらにかける
        mochiBtnElement.addEventListener('contextmenu', (e) => e.preventDefault());

        // メインのもちすけタップ処理
        mochiBtnElement.addEventListener('pointerdown', (e) => {
            if (isMinigameActive) return;
            e.preventDefault();
            try { mochiBtnElement.setPointerCapture(e.pointerId); } catch (err) {}
            initAndPlayBGM();
            playAudioFile('audio/tap.mp3'); 
            setTotalTapsCount(totalTapsCount + 1);
            trackMissionEvent('totalTaps', 1); trackMissionEvent('tapsToday', 1); trackMissionEvent('tapsThisWeek', 1);
            chargeHissatsuByTap();
            prefTaps[selectedStageIndex] = (prefTaps[selectedStageIndex] || 0) + 1;
            
            lastTappedTime = Date.now();
            mochiBreatheWrapEl.classList.remove('breathe-idle');
            clearTimeout(breatheTimer);

            isMochiPressed = true;
            const clones = bunshinCloneEls;

            if (skills.hissatsu.activeTimer > 0) {
                mochiDeformWrap.style.transform = 'scale(1.55, 1.2)';
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1.55, 1.2)');
            } else {
                // 🫧 指ごとの座標をpointerIdで記録する（2本指ストレッチの判定に使う）
                squeezePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

                if (squeezePointers.size === 2) {
                    // 🫧🫧 2本目の指が触れた瞬間：ここから「2本の指を逆方向に引っ張って両側から伸ばす」モードに切り替える。
                    // 見た目（1本指の押し込みポーズ）は変えず、次のpointermoveから2本指用の計算に切り替わる。
                    const pts = [...squeezePointers.values()];
                    twoFingerStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                    twoFingerStretchActive = true;
                } else if (squeezePointers.size === 1) {
                    // 1本目の指：従来通り「引っ張った方向にだけ伸ばす」スクイーズを開始
                    mochiDeformWrap.style.transform = 'scale(1.25, 0.72)';
                    clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1.25, 0.72)');
                    squeezeStartX = e.clientX; squeezeStartY = e.clientY;
                    isDraggingSqueeze = true;
                    updateMouthPatchVisibility();
                    startStretchSound();
                }
                // 3本目以降の指は無視する（伸縮の計算が複雑になるだけなので、対象は指2本まで）
            }

            createRippleEffect(e.clientX, e.clientY);

            // 長押し検知：一定時間押しっぱなしにすると「つぶれる〜」的なセリフを言う
            clearTimeout(mochiLongPressTimer);
            mochiLongPressTimer = setTimeout(() => {
                if (!isTutorialActive) showMochiComment(pickRandom(dialogueData.longPressComments));
            }, MOCHI_LONGPRESS_MS);

            // 必殺技発動中なら1タップが5連打になる
            // 会心演出のリセットは、この連打ループの前に1回だけ行う（以前はexecuteSingleTapの中で毎回やっていて、
            // 5連打×連打で最大何十回にもなり、つぶれるアニメーションが再生されたりされなかったりする原因になっていた）
            clearTimeout(critFilterTimeout);
            resetMochiFilter();
            let clickLoops = skills.hissatsu.activeTimer > 0 ? 5 : 1;
            handleCombo(1); // コンボは何があっても「1タップ＝1コンボ」で固定（必殺技中でも増える量は変えない）
            for (let i = 0; i < clickLoops; i++) {
                executeSingleTap(e.clientX, e.clientY);
            }
            updateDisplay();
        });

        // 必殺技（もちもちビッグバン）発動中の「画面のどこを触っても連打」をゲームスクリーン全体で検知
        document.getElementById('game-screen').addEventListener('pointerdown', (e) => {
            if (isMinigameActive) return;
            if (skills.hissatsu.activeTimer > 0) {
                // UIボタンやメニュー、モーダル内部の誤反応を防止
                if (e.target.closest('#control-panel') || e.target.closest('#header-container') || e.target.closest('#progress-area') || e.target.closest('#ui-toggle-btn') || e.target.closest('.modal')) {
                    return; 
                }
                // もちすけ本体以外をタップした時に5連打を発動
                if (e.target.id !== 'mochisuke-btn') {
                    playAudioFile('audio/tap.mp3');
                    createRippleEffect(e.clientX, e.clientY);
                    clearTimeout(critFilterTimeout);
                    resetMochiFilter();
                    handleCombo(1); // コンボは何があっても「1タップ＝1コンボ」で固定
                    for (let i = 0; i < 5; i++) {
                        executeSingleTap(e.clientX, e.clientY);
                    }
                    updateDisplay();
                }
            }
        });

        // 引っ張った方向・つぶれ量dから変形のtransform文字列を作る。
        // d が正＝引っ張り/つぶし方向、負＝その逆方向（オーバーシュート用）に使える共通関数。
        // 下向き成分の方が大きい場合は「伸ばす」のではなく「つぶす」動きにする（体積保存的に横へ少し膨らむ）。
        // 横・斜め方向は、引っ張った側だけに伸びるよう、反対側を起点に固定して見せる（transformOriginではなくtranslateで実現）。
        /**
         * 引っ張り/つぶし量dと方向(dx,dy)から、伸縮とオフセットを含むCSS transform文字列を組み立てる。
         * @param {number} dx - 引っ張り方向のX成分
         * @param {number} dy - 引っ張り方向のY成分
         * @param {number} d - 伸縮量（正=伸び/つぶし方向、負=逆方向のオーバーシュート）
         * @returns {string} CSSのtransformプロパティ用文字列
         */
        export function squeezeTransformFor(dx, dy, d) {
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = angleRad * (180 / Math.PI);

            const along = 1 + d * SQUEEZE_MAX_STRETCH;
            const perp = 1 - d * SQUEEZE_MAX_SQUASH;
            const growthPx = SQUEEZE_ELEMENT_RADIUS * 2 * (along - 1);
            const offsetPx = growthPx / 2;
            const offsetX = Math.cos(angleRad) * offsetPx;
            const offsetY = Math.sin(angleRad) * offsetPx;
            return `translate(${offsetX}px, ${offsetY}px) rotate(${angleDeg}deg) scale(${along}, ${perp}) rotate(${-angleDeg}deg)`;
        }

        // 引っ張った方向・距離から、今の伸縮状態を反映する（ドラッグ中に毎回呼ばれる）
        /**
         * ドラッグ移動量から伸縮比率を計算し、もちすけ要素にtransformと伸び音を反映する。
         * @param {number} dx - 開始位置からのX移動量
         * @param {number} dy - 開始位置からのY移動量
         * @returns {number} 0〜1の伸縮比率
         */
        export function applySqueezeTransform(dx, dy) {
            const dist = Math.min(Math.sqrt(dx * dx + dy * dy), SQUEEZE_MAX_DRAG);
            const ratio = dist / SQUEEZE_MAX_DRAG;
            mochiDeformWrap.style.transformOrigin = 'center center';
            mochiDeformWrap.style.transform = squeezeTransformFor(dx, dy, ratio);
            updateStretchSound(ratio);
            return ratio;
        }

        // 🫧🫧 2本指ストレッチ用のtransform。1本指版(squeezeTransformFor)は「片側だけ固定して反対側を伸ばす」ため
        // translateでオフセットを付けているが、2本指は両端が均等に伸びて中心が動かないので、offsetは不要でscaleだけでよい。
        /**
         * 2本の指を結ぶ軸の角度と伸縮量dから、中心固定・左右対称なCSS transform文字列を組み立てる。
         * @param {number} angleDeg - 2点を結ぶ軸の角度（度）
         * @param {number} d - 伸縮量（正=伸び方向、負=揺れ戻りのオーバーシュート用）
         * @returns {string} CSSのtransformプロパティ用文字列
         */
        export function twoFingerSqueezeTransformFor(angleDeg, d) {
            const along = 1 + d * SQUEEZE_MAX_STRETCH;
            const perp = 1 - d * SQUEEZE_MAX_SQUASH;
            return `rotate(${angleDeg}deg) scale(${along}, ${perp}) rotate(${-angleDeg}deg)`;
        }

        // 2本の指が離れていく方向・距離から、今の伸縮状態を反映する（2本指ドラッグ中に毎回呼ばれる）
        /**
         * 2本指の伸縮比率から、もちすけ要素にtransformと伸び音を反映する。
         * @param {number} angleDeg - 2点を結ぶ軸の角度（度）
         * @param {number} ratio - 0〜1の伸縮比率
         * @returns {void}
         */
        export function applyTwoFingerSqueezeTransform(angleDeg, ratio) {
            mochiDeformWrap.style.transformOrigin = 'center center';
            mochiDeformWrap.style.transform = twoFingerSqueezeTransformFor(angleDeg, ratio);
            updateStretchSound(ratio);
        }

        // 🔊 伸ばしている間だけ鳴る、ループ再生＋伸びに応じてピッチが変わる効果音
        /**
         * 伸ばしている間だけ鳴らす、ループ再生の伸び音を音量0の状態で再生開始する。
         * @returns {void}
         */
        export function startStretchSound() {
            if (stretchSoundSource) return;
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const buffer = audioBuffers['audio/mochisuke/mochi_stretch.mp3'];
            if (!buffer) return;
            stretchSoundSource = ctx.createBufferSource();
            stretchSoundSource.buffer = buffer;
            stretchSoundSource.loop = true;
            stretchSoundGain = ctx.createGain();
            stretchSoundGain.gain.value = 0;
            stretchSoundSource.connect(stretchSoundGain).connect(ctx.destination);
            stretchSoundSource.start(0);
        }
        /**
         * 伸縮比率に応じて、再生中の伸び音のピッチと音量を更新する。
         * @param {number} ratio - 0〜1の伸縮比率
         * @returns {void}
         */
        export function updateStretchSound(ratio) {
            if (!stretchSoundSource) return;
            stretchSoundSource.playbackRate.value = CONFIG.STRETCH_SOUND_BASE_PITCH + ratio * CONFIG.STRETCH_SOUND_PITCH_RANGE; // 伸びるほど音が高くなる
            stretchSoundGain.gain.value = ratio * CONFIG.STRETCH_SOUND_MAX_GAIN * sfxVolumeMult; // 伸びるほど音が大きくなる
        }
        /**
         * 再生中の伸び音を停止し、参照をクリアする。
         * @returns {void}
         */
        export function stopStretchSound() {
            if (!stretchSoundSource) return;
            try { stretchSoundSource.stop(); } catch (e) {}
            stretchSoundSource = null;
            stretchSoundGain = null;
        }

        // 指を離した時、伸ばして/つぶしていた分だけ大きく「ぷるん」と揺れ戻ってから通常に収束する
        /**
         * 指を離した瞬間、伸ばして/つぶしていた分だけオーバーシュートする揺れ戻りアニメーションを再生する。
         * @param {number} dx - 引っ張り方向のX成分
         * @param {number} dy - 引っ張り方向のY成分
         * @returns {void}
         */
        export function releaseSqueezeWithOvershoot(dx, dy) {
            const dist = Math.min(Math.sqrt(dx * dx + dy * dy), SQUEEZE_MAX_DRAG);
            const ratio = dist / SQUEEZE_MAX_DRAG;
            const overshoot = ratio * CONFIG.SQUEEZE_OVERSHOOT_RATIO; // 伸ばした/つぶした分だけ、戻る時のプルンも大きくなる

            mochiDeformWrap.animate([
                { transform: squeezeTransformFor(dx, dy, ratio) },
                { transform: squeezeTransformFor(dx, dy, -overshoot * 0.65), offset: 0.32 },
                { transform: squeezeTransformFor(dx, dy, overshoot * 0.32), offset: 0.58 },
                { transform: squeezeTransformFor(dx, dy, -overshoot * 0.12), offset: 0.8 },
                { transform: 'scale(1, 1)' },
            ], { duration: CONFIG.SQUEEZE_OVERSHOOT_BASE_DURATION_MS + ratio * CONFIG.SQUEEZE_OVERSHOOT_DURATION_RANGE_MS, easing: 'ease-out' });
            mochiDeformWrap.style.transform = 'scale(1, 1)';
        }

        // 2本指版の揺れ戻り。1本指版と違い中心固定・左右対称なので、twoFingerSqueezeTransformForを使う。
        /**
         * 2本指ストレッチを離した瞬間、伸ばしていた分だけオーバーシュートする揺れ戻りアニメーションを再生する。
         * @param {number} angleDeg - 伸ばしていた軸の角度（度）
         * @param {number} ratio - 0〜1の伸縮比率
         * @returns {void}
         */
        export function releaseTwoFingerSqueezeWithOvershoot(angleDeg, ratio) {
            const overshoot = ratio * CONFIG.SQUEEZE_OVERSHOOT_RATIO;

            mochiDeformWrap.animate([
                { transform: twoFingerSqueezeTransformFor(angleDeg, ratio) },
                { transform: twoFingerSqueezeTransformFor(angleDeg, -overshoot * 0.65), offset: 0.32 },
                { transform: twoFingerSqueezeTransformFor(angleDeg, overshoot * 0.32), offset: 0.58 },
                { transform: twoFingerSqueezeTransformFor(angleDeg, -overshoot * 0.12), offset: 0.8 },
                { transform: 'scale(1, 1)' },
            ], { duration: CONFIG.SQUEEZE_OVERSHOOT_BASE_DURATION_MS + ratio * CONFIG.SQUEEZE_OVERSHOOT_DURATION_RANGE_MS, easing: 'ease-out' });
            mochiDeformWrap.style.transform = 'scale(1, 1)';
        }

        /**
         * ポインタが離れた時の後処理全体を行い、必殺技中/2本指ストレッチ中/1本指スクイーズ中/通常タップの
         * 4パターンで戻りアニメーションを再生する。
         * 🫧🫧 2本指ストレッチ中は、2本のうちどちらか片方でも指が離れた時点で「引っ張るのをやめた」とみなし、
         * もう片方がまだ触れていても一連の動作を終わりとして大きく揺れ戻す（残り1本での1本指モードへの
         * 引き継ぎはせず、指2本の状態が崩れたら必ずリセットする、というシンプルな設計にしている）。
         * @param {PointerEvent} [e] - pointerup/pointerleave/pointercancelのイベント（離れた指を特定するため）
         * @returns {void}
         */
        export function releaseMochiSucre(e) {
            if (!isMochiPressed) return;
            if (e && e.pointerId !== undefined) squeezePointers.delete(e.pointerId);

            const wasTwoFingerStretch = twoFingerStretchActive; // クリアする前に記憶しておく

            isMochiPressed = false;
            squeezePointers.clear();
            twoFingerStretchActive = false;
            clearTimeout(mochiLongPressTimer);
            stopStretchSound();

            const clones = bunshinCloneEls;

            if (skills.hissatsu.activeTimer > 0) {
                mochiDeformWrap.style.transform = 'scale(1.5)';
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1.5)');
            } else if (wasTwoFingerStretch && twoFingerLastRatio >= TWO_FINGER_MIN_STRETCH_RATIO) {
                // 🫧🫧 2本指ストレッチ：一定以上伸ばされていた時だけ、中心固定で大きく「ぷるん」と揺れ戻る
                releaseTwoFingerSqueezeWithOvershoot(twoFingerLastAngleDeg, twoFingerLastRatio);
                setTimeout(() => { mochiDeformWrap.style.transformOrigin = ''; }, CONFIG.SQUEEZE_TRANSFORM_ORIGIN_RESET_MS);
                clones.forEach(c => {
                    c.animate([
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.25, 0.72)' },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(0.86, 1.14)', offset: 0.4 },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.04, 0.96)', offset: 0.75 },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)' }
                    ], { duration: CONFIG.TAP_RELEASE_ANIM_DURATION_MS, easing: 'ease-out' });
                    c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)';
                });
            } else if (isDraggingSqueeze && Math.sqrt(squeezeLastDx * squeezeLastDx + squeezeLastDy * squeezeLastDy) >= SQUEEZE_MIN_DRAG) {
                // 🫧 スクイーズ：一定以上引っ張られていた時だけ、伸ばして/つぶしていた分だけ大きく「ぷるん」と揺れ戻る
                releaseSqueezeWithOvershoot(squeezeLastDx, squeezeLastDy);
                setTimeout(() => { mochiDeformWrap.style.transformOrigin = ''; }, CONFIG.SQUEEZE_TRANSFORM_ORIGIN_RESET_MS);
                clones.forEach(c => {
                    c.animate([
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.25, 0.72)' },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(0.86, 1.14)', offset: 0.4 },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.04, 0.96)', offset: 0.75 },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)' }
                    ], { duration: CONFIG.TAP_RELEASE_ANIM_DURATION_MS, easing: 'ease-out' });
                    c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)';
                });
            } else {
                // 引っ張りとして扱うほどの移動が無かった＝ただのタップ。従来通りの「もちっ」とした押し込みアニメーション
                mochiDeformWrap.style.transformOrigin = '';
                mochiDeformWrap.animate([
                    { transform: 'scale(1.25, 0.72)' },
                    { transform: 'scale(0.86, 1.14)', offset: 0.4 }, 
                    { transform: 'scale(1.04, 0.96)', offset: 0.75 }, 
                    { transform: 'scale(1, 1)' }
                ], { duration: CONFIG.TAP_RELEASE_ANIM_DURATION_MS, easing: 'ease-out' });
                mochiDeformWrap.style.transform = 'scale(1, 1)';
                
                clones.forEach(c => {
                    c.animate([
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.25, 0.72)' },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(0.86, 1.14)', offset: 0.4 }, 
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.04, 0.96)', offset: 0.75 }, 
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)' }
                    ], { duration: CONFIG.TAP_RELEASE_ANIM_DURATION_MS, easing: 'ease-out' });
                    c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)';
                });
            }
            isDraggingSqueeze = false;
            isSqueezeSettling = true; // 揺れ戻りアニメーションが収まるまで、口パーツは出さない
            updateMouthPatchVisibility();
            squeezeLastDx = 0; squeezeLastDy = 0;
            twoFingerLastRatio = 0; twoFingerLastAngleDeg = 0;

            breatheTimer = setTimeout(() => {
                if (!isMochiPressed && skills.hissatsu.activeTimer <= 0) {
                    mochiBreatheWrapEl.classList.add('breathe-idle');
                }
                isSqueezeSettling = false;
                updateMouthPatchVisibility();
            }, CONFIG.BREATHE_IDLE_DELAY_MS);
        }

        mochiBtnElement.addEventListener('pointerup', releaseMochiSucre);
        mochiBtnElement.addEventListener('pointerleave', releaseMochiSucre);
        mochiBtnElement.addEventListener('pointercancel', releaseMochiSucre);

        // 🫧 スクイーズ：押している間、指の動きを追いかけて伸縮を更新する（要素の外に出ても追従させたいのでdocument側で監視）
        document.addEventListener('pointermove', (e) => {
            if (!isMochiPressed) return;
            if (squeezePointers.has(e.pointerId)) {
                squeezePointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); // 押している指の最新座標を更新
            }
            if (twoFingerStretchActive) {
                // 🫧🫧 2本指ストレッチ中：2点間の距離の伸びから、中心固定の左右対称な伸縮を計算する
                if (squeezePointers.size < 2) return; // 保険（通常はここに来る前にreleaseMochiSucreで解除される）
                const pts = [...squeezePointers.values()];
                const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
                const dist = Math.hypot(dx, dy);
                const growth = Math.max(0, dist - twoFingerStartDist); // 2点が離れた分だけを「伸び」として扱う
                twoFingerLastRatio = Math.min(growth, TWO_FINGER_MAX_STRETCH_DIST) / TWO_FINGER_MAX_STRETCH_DIST;
                twoFingerLastAngleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                applyTwoFingerSqueezeTransform(twoFingerLastAngleDeg, twoFingerLastRatio);
                return;
            }
            if (!isDraggingSqueeze) return;
            squeezeLastDx = e.clientX - squeezeStartX;
            squeezeLastDy = e.clientY - squeezeStartY;
            applySqueezeTransform(squeezeLastDx, squeezeLastDy);
        });

        /* 🔮 スキル発動＆タイマー管理システムロジック */
        // 必殺技だけはクールタイムが「時間経過」ではなく「一定回数タップ」で回復する特別仕様
        /**
         * 必殺技のLvに応じて、クールタイム回復に必要なタップ数を計算する。
         * @param {number} lv - 必殺技のLv
         * @returns {number} 回復に必要なタップ数
         */
        export function getHissatsuTapsRequired(lv) {
            return Math.max(CONFIG.HISSATSU_MIN_TAPS_REQUIRED, CONFIG.HISSATSU_BASE_TAPS_REQUIRED - (lv - 1) * CONFIG.HISSATSU_TAPS_REDUCTION_PER_LV);
        }

        // 各スキルの実際のクールタイムを計算する共通関数（レベルによる短縮＋転生ポイントショップの恒久短縮を反映）
        /**
         * スキルの種類ごとに、Lvによる短縮量と転生ショップの恒久短縮を反映した実際のクールタイムを計算する。
         * @param {string} key - スキルのキー（'skill1'〜'skill4'/'hissatsu'）
         * @param {Object} s - 対象スキルのデータオブジェクト
         * @returns {number} 実際のクールタイム（秒、必殺技のみ必要タップ数）
         */
        export function getSkillCalculatedCd(key, s) {
            const reduce = getPrestigeCdReductionSec();
            if (key === 'skill1') return Math.max(CONFIG.SKILL1_MIN_CD, s.cd - (s.lv - 1) - reduce);
            if (key === 'skill2') return Math.max(CONFIG.SKILL2_MIN_CD, s.cd - (s.lv - 1) - reduce);
            if (key === 'skill3') return Math.max(CONFIG.SKILL3_MIN_CD, s.cd - (s.lv - 1) - reduce);
            if (key === 'skill4') return Math.max(CONFIG.SKILL4_MIN_CD, s.cd - (s.lv - 1) * CONFIG.SKILL4_CD_REDUCTION_PER_LV_MULT - reduce);
            if (key === 'hissatsu') return getHissatsuTapsRequired(s.lv); // タップ数なので短縮対象外
            return s.cd;
        }

        /**
         * 指定したスキルを発動する。未獲得ならアラートを出し、クールタイム中/発動中なら何もしない。
         * @param {string} key - スキルのキー
         * @returns {void}
         */
        export function useSkill(key) {
            const s = skills[key];
            if (s.lv === 0) {
                alert("このスキルはまだ獲得していません！\nショップの「✨スキル」タブから獲得できます。");
                return;
            }
            if (s.currentCd > 0 || s.activeTimer > 0) return;
            trackMissionEvent('skillUsedToday', 1); trackMissionEvent('skillUsedThisWeek', 1); trackMissionEvent('skillUsedTotal', 1);

            playAudioFile('audio/skill_tap.mp3');
            if (key === 'hissatsu') {
                screenShake('big');
                screenFlash('#ff9800', CONFIG.HISSATSU_ACTIVATE_FLASH_ALPHA);
            } else {
                screenFlash('#fff59d', CONFIG.SKILL_ACTIVATE_FLASH_ALPHA);
            }

            s.activeTimer = s.duration;
            
            // クールタイム計算 (Lvアップに応じて段階的に短縮)
            let calculatedCd = getSkillCalculatedCd(key, s);
            s.currentCd = calculatedCd;

            startSkillVisualEffect(key);
            updateSkillUI();
            updateDisplay();
        }

        /**
         * スキルごとの発動時の見た目演出を開始する（skill3は分身生成、hissatsuはBGM切り替え＋巨大化）。
         * @param {string} key - スキルのキー
         * @returns {void}
         */
        export function startSkillVisualEffect(key) {
            const btn = document.getElementById('btn-' + key);
            if (btn) btn.classList.remove('ready');

            if (key === 'skill3') {
                // 分身の術：中央のもちすけ＋左右に1匹ずつ、計3人体制に
                const container = document.getElementById('bunshin-container');
                container.innerHTML = '';

                // 左右に1匹ずつ配置するためのX軸オフセット値
                const xOffsets = [-CONFIG.BUNSHIN_CLONE_X_OFFSET, CONFIG.BUNSHIN_CLONE_X_OFFSET];
                for (let i = 0; i < 2; i++) {
                    const img = document.createElement('img');
                    img.src = 'ui_images/mochisuke/image_0.webp';
                    img.className = 'bunshin-clone-img';
                    img.style.position = 'absolute';
                    img.style.width = CONFIG.BUNSHIN_CLONE_WIDTH_PX + 'px';
                    img.style.height = 'auto';
                    img.style.opacity = String(CONFIG.BUNSHIN_CLONE_OPACITY);
                    img.style.left = '50%';
                    img.style.top = '50%';
                    img.style.setProperty('--tx', `${xOffsets[i]}px`);
                    img.style.transform = `translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)`;
                    img.style.filter = mochiBtnElement.style.filter + " saturate(0.7)";
                    img.style.pointerEvents = 'none';
                    container.appendChild(img);
                }
                refreshBunshinCloneRects();
            }
            
            if (key === 'hissatsu') {
                // 必殺技専用BGMの再生（通常BGMから切り替え）
                playBgmLoop('audio/bgm/hissatsu_bgm.mp3');

                // 親方化して巨大に固定
                mochiBreatheWrapEl.classList.remove('breathe-idle');
                mochiDeformWrap.style.transform = 'scale(1.5)';
                const clones = document.querySelectorAll('.bunshin-clone-img');
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1.5)');
                mochiBtnElement.style.filter = mochiBtnElement.style.filter + " contrast(1.4) brightness(1.05)";
                refreshBunshinCloneRects();
            }
        }

        /**
         * スキルの発動時間終了時に見た目演出を元に戻す（skill3は分身DOM削除、hissatsuはBGM・サイズ・フィルターを復元）。
         * @param {string} key - スキルのキー
         * @returns {void}
         */
        export function endSkillVisualEffect(key) {
            if (key === 'skill3') { document.getElementById('bunshin-container').innerHTML = ''; bunshinCloneRects = []; bunshinCloneEls = []; }
            if (key === 'hissatsu') {
                // 必殺技BGMを終了し通常BGMを再開
                if (isBgmInitialized) playBgmLoop('audio/bgm/bgm.mp3');

                mochiDeformWrap.style.transform = 'scale(1)';
                const clones = document.querySelectorAll('.bunshin-clone-img');
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1)');
                resetMochiFilter();
                if (!isMochiPressed) mochiBreatheWrapEl.classList.add('breathe-idle');
            }
        }

        export let critFilterTimeout = null;
        export let critTapId = 0;
        export let isScreamActive = false; // 叫び演出中は、会心などの他の演出が画像を上書きしないようにするためのフラグ
        // 🐛修正：以前はここが古い衣装システム(clothesData)だけを見ていたため、タップのたびに
        // 着せ替え部屋で選んだ服が初期状態に戻ってしまっていた。今は着せ替え部屋の選択を優先する。
        /**
         * 着せ替え部屋・旧衣装システムの優先順位に沿って、現在表示すべきもちすけの基準画像パスを返す。
         * @returns {string} 画像パス
         */
        export function getMochisukeBaseImg() {
            const clothesItem = (typeof KISEKAE_ITEMS !== 'undefined' && typeof equippedKisekae !== 'undefined')
                ? KISEKAE_ITEMS.clothes.find(i => i.id === equippedKisekae.clothes)
                : null;
            if (clothesItem) return clothesItem.img;
            const target = clothesData.find(c => c.id === equippedClotheId);
            return (target && target.img) ? target.img : 'ui_images/mochisuke/image_0.webp';
        }
        /**
         * 叫び演出中でなければもちすけ画像を基準画像に戻し、装備中衣装のfilterを適用する。
         * @returns {void}
         */
        export function resetMochiFilter() {
            if (!isScreamActive) {
                mochiBtnElement.src = getMochisukeBaseImg();
            }
            const target2 = clothesData.find(c => c.id === equippedClotheId);
            let baseFilter = target2 ? (target2.filter || "drop-shadow(0 10px 10px rgba(0,0,0,0.15))") : "drop-shadow(0 10px 10px rgba(0,0,0,0.15))";
            // 必殺技が発動中なら、そちらの見た目(コントラスト強化)を消さずに保つ
            if (skills.hissatsu.activeTimer > 0) baseFilter += " contrast(1.4) brightness(1.05)";
            mochiBtnElement.style.filter = baseFilter;
        }

        /**
         * 全スキルのactiveTimer/currentCdをdt分だけ経過させ、発動終了やクールタイム完了に応じた処理を行う。
         * @param {number} dt - 経過時間（秒）
         * @returns {void}
         */
        export function updateSkillTimers(dt) {
            // 🐛パフォーマンス修正：このupdateSkillTimers自体は100ms毎（1秒に10回）に呼ばれ続けるが、
            // 以前は「発動中・クールダウン中のスキルが1つも無い（＝完全に待機中）」時でも毎回
            // updateSkillUI()（各スキルボタンのDOM要素を複数回問い合わせ、ゲージ等を書き換える処理）
            // を呼んでいた。これはスキルを使っていない・使い終わった後もずっと動き続ける、無駄な
            // 常時コストになっていたため、実際にゲージが変化しうる時（発動中 or クールダウン中）だけ
            // updateSkillUI()を呼ぶように変更。発動中・クールダウン中の見た目の滑らかさは変わらない
            let needsUiUpdate = false;
            Object.keys(skills).forEach(key => {
                const s = skills[key];
                if (s.activeTimer > 0) {
                    needsUiUpdate = true;
                    s.activeTimer -= dt;
                    if (s.activeTimer <= 0) { s.activeTimer = 0; endSkillVisualEffect(key); }
                }
                // クールタイム完了の判定（必殺技はタップ数で回復するのでここでは時間経過させない）
                else if (s.currentCd > 0 && key !== 'hissatsu') {
                    needsUiUpdate = true;
                    s.currentCd -= dt;
                    if (s.currentCd <= 0) {
                        s.currentCd = 0;
                        if (s.lv > 0) {
                            playAudioFile('audio/ready.mp3', CONFIG.READY_SFX_VOLUME);
                        }
                    }
                }
            });
            // 🐛パフォーマンス修正：スキルボタン自体もタップ画面にしかないので、モーダルで隠れている間は
            // ゲージの状態計算(上のforEach)は行いつつ、DOMの書き換え(updateSkillUI)だけは省略する
            if (needsUiUpdate && !document.body.classList.contains('modal-open')) updateSkillUI();
        }

        // 必殺技のクールタイムをタップ数で回復させる（実際のタップの度に呼ぶ）
        /**
         * 必殺技のクールタイムをタップ数で回復させる。0になったら効果音を鳴らしUIを更新する。
         * @returns {void}
         */
        export function chargeHissatsuByTap() {
            const s = skills.hissatsu;
            if (s.lv > 0 && s.activeTimer <= 0 && s.currentCd > 0) {
                s.currentCd -= 1;
                if (s.currentCd <= 0) {
                    s.currentCd = 0;
                    playAudioFile('audio/ready.mp3', CONFIG.READY_SFX_VOLUME);
                }
                updateSkillUI();
            }
        }

        /**
         * 各スキルボタンのLv表示・ロック状態・クールタイム/発動中ゲージの見た目を現在の状態に合わせて更新する。
         * @returns {void}
         */
        export function updateSkillUI() {
            updateMouthPatchVisibility();
            Object.keys(skills).forEach(key => {
                const s = skills[key];
                const btn = document.getElementById('btn-' + key);
                if (!btn) return;

                const lvText = document.getElementById('lv-' + key);
                if (lvText) lvText.innerText = `Lv.${s.lv}`;

                if (s.lv === 0) {
                    btn.classList.add('locked');
                } else {
                    btn.classList.remove('locked');
                }

                let calculatedCd = getSkillCalculatedCd(key, s);

                const overlay = btn.querySelector('.cd-overlay');
                const gaugeFill = key === 'hissatsu' ? document.getElementById('hissatsu-gauge-fill') : null;
                const gaugeTrack = key === 'hissatsu' ? document.querySelector('.hissatsu-gauge-track') : null;

                // ゲージ表示システムの分岐（発動中なら緑ゲージが減り、終了後は黒いクールダウンに遷移）
                // ※ イラスト背景(background-image)を消さないよう、色は必ずbackgroundColorではなくoverlay側で表現する
                // ※ 必殺技(巻物イラスト)は、ゲージをイラストの上ではなく下の専用バーで表現する
                if (s.activeTimer > 0) {
                    let percentage = (s.activeTimer / s.duration) * 100;
                    if (overlay) {
                        overlay.style.background = `conic-gradient(rgba(76,175,80,0.55) ${percentage}%, transparent 0deg)`;
                    }
                    if (key === 'hissatsu' && gaugeFill) {
                        gaugeFill.style.width = `${percentage}%`;
                        gaugeFill.style.background = "rgba(76,175,80,0.8)";
                        gaugeTrack.classList.add('show');
                    }
                    btn.classList.remove('on-cooldown');
                    btn.classList.remove('ready');
                } else if (s.currentCd > 0) {
                    let percentage = (s.currentCd / calculatedCd) * 100;
                    if (overlay) {
                        overlay.style.background = `conic-gradient(rgba(0,0,0,0.45) ${percentage}%, transparent 0deg)`;
                    }
                    if (key === 'hissatsu' && gaugeFill) {
                        gaugeFill.style.width = `${percentage}%`;
                        gaugeFill.style.background = "rgba(0,0,0,0.5)";
                        gaugeTrack.classList.add('show');
                    }
                    btn.classList.add('on-cooldown');
                    btn.classList.remove('ready');
                } else {
                    if (overlay) overlay.style.background = "none";
                    if (key === 'hissatsu' && gaugeFill) {
                        gaugeFill.style.width = "0%";
                        gaugeTrack.classList.remove('show');
                    }
                    btn.classList.remove('on-cooldown');
                    if (s.lv > 0) btn.classList.add('ready');
                }
            });

            // 必殺技ボタンの初期非表示解除トリガー
            const hissatsuBtn = document.getElementById('btn-hissatsu');
            if (skills.hissatsu.lv > 0) { hissatsuBtn.style.display = "block"; }
        }

        /* モーダル関連 */
        /**
         * 指定スキルの次Lvを購入する。価格を計算し、購入可能ならscoreを消費してLvを1上げ演出・保存・UI更新を行う。
         * @param {string} key - スキルのキー
         * @returns {void}
         */
        export function buySkillLevel(key) {
            const s = skills[key];
            if (!s || currentStageIndex < s.unlockStage) return;
            const price = s.lv === 0 ? s.unlockPrice : Math.floor(s.unlockPrice * Math.pow(s.lvPriceMult, s.lv));
            if (score < price) return;
            setScore(score - (price));
            s.lv += 1;
            playAudioFile('audio/levelup.mp3');
            showMochiComment(pickRandom(dialogueData.eventComments.levelUp));
            saveGame(); renderShopList(); updateSkillUI(); updateDisplay(); updateShopTabHighlight();
        }
        window.buySkillLevel = buySkillLevel; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 日付が変わっていたら、給餌のデイリー使用回数をリセットして保存する。
         * @returns {void}
         */
        export function resetFeedCountIfNewDay() {
            const today = getLocalDateString(new Date());
            if (feedLastResetDate !== today) {
                feedLastResetDate = today;
                feedPlaysUsedToday = 0;
                saveGame();
            }
        }

        export let feedDragState = null;

        // 🐛修正：給餌中に他のボタン（ランキング等）を押して別画面へ移動しても、
        // 置きっぱなしのおみやげアイコンが最前面に残り続けてしまっていたのを片付ける
        /**
         * 給餌中に置いたおみやげアイコンをDOMから削除し、ドラッグ関連のリスナー・状態・じらしタイマーを片付ける。
         * @returns {void}
         */
        export function cancelFeedDragIfActive() {
            const icon = document.getElementById('feed-placed-icon');
            if (icon) icon.remove();
            document.removeEventListener('pointermove', onFeedDragMove);
            document.removeEventListener('pointerup', onFeedDragEnd);
            document.removeEventListener('pointercancel', onFeedDragEnd);
            feedDragState = null;
            clearTimeout(feedTeaseTimer);
        }

        // じらすとだんだん機嫌が悪くなっていくセリフ（最終段階で叫ぶ）
        export const FEED_TEASE_TIME_MS = 10000; // これだけ経つと、ドロップに失敗しなくても自動で機嫌が悪くなる
        export let feedTeaseLevel = 0;
        export let feedTeaseTimer = null;

        /**
         * FEED_TEASE_TIME_MSごとに、ドロップ失敗が無くてもfeedTeaseLevelを1段階上げてセリフを表示し、自分自身を再スケジュールする。
         * @returns {void}
         */
        export function scheduleFeedTeaseEscalation() {
            clearTimeout(feedTeaseTimer);
            if (feedTeaseLevel >= FEED_TEASE_MAX_LEVEL) return; // 最大まで達したら、時間経過では増やさない（外した時だけ増える）
            feedTeaseTimer = setTimeout(() => {
                feedTeaseLevel++;
                showFeedTeaseComment();
                scheduleFeedTeaseEscalation();
            }, FEED_TEASE_TIME_MS);
        }

        /**
         * feedTeaseLevelに応じたじらしセリフを表示する。最大レベルなら専用の叫び演出を出す。
         * @returns {void}
         */
        export function showFeedTeaseComment() {
            if (isTutorialActive) return;
            if (feedTeaseLevel >= FEED_TEASE_MAX_LEVEL) {
                // 我慢の限界：専用の叫び効果音＋専用イラスト＋周りに散る「あ゛」で叫んでる感を強化
                playAudioFile('audio/mochisuke/mochi_scream.mp3');
                vibrate(CONFIG.SCREAM_VIBRATE_PATTERN);
                screenShake('big');
                screenFlash('#ff1744', CONFIG.TEASE_LIMIT_FLASH_ALPHA);

                startScreamFace();

                spawnScreamKanaBurst();
                showMochiComment('あ\u3099'.repeat(CONFIG.TEASE_LIMIT_KANA_REPEAT) + '！！');
            } else {
                showMochiComment(feedTeaseComments[feedTeaseLevel]);
            }
        }

        // もちすけの周りに「あ゛」を何個も時間差で飛び散らせる（叫んでいる迫力を強化）
        /**
         * もちすけの周りに「あ゛」の浮遊テキストを時間差で複数飛び散らせる叫び演出。
         * @returns {void}
         */
        export function spawnScreamKanaBurst() {
            const rect = mochiBtnElement.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            for (let i = 0; i < CONFIG.SCREAM_KANA_BURST_COUNT; i++) {
                setTimeout(() => {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = CONFIG.SCREAM_KANA_MIN_DIST + Math.random() * CONFIG.SCREAM_KANA_DIST_RANGE;
                    const x = cx + Math.cos(angle) * dist;
                    const y = cy + Math.sin(angle) * dist - CONFIG.SCREAM_KANA_Y_OFFSET;
                    createFloatingText(x, y, 'あ\u3099', '#e91e63', (CONFIG.SCREAM_KANA_MIN_SIZE_REM + Math.random() * CONFIG.SCREAM_KANA_SIZE_RANGE_REM) + 'rem');
                }, i * CONFIG.SCREAM_KANA_STAGGER_MS);
            }
        }

        /**
         * 指定したおみやげのアイコンをもちすけの足元付近に生成し、じらし状態の初期化とドラッグ開始の登録を行う。
         * @param {number} idx - おみやげ（都道府県）のインデックス
         * @returns {void}
         */
        export function placeFeedIconNearMochisuke(idx) {
            const stage = stages[idx];
            closeModal('omiyage-feed-confirm-modal');
            closeModal('warehouse-modal'); // もちすけが見える画面まで戻す

            // 既に置きっぱなしのアイコンが残っていたら片付ける
            const old = document.getElementById('feed-placed-icon');
            if (old) old.remove();

            setTimeout(() => {
                const mochiRect = mochiBtnElement.getBoundingClientRect();
                const startX = mochiRect.left + mochiRect.width / 2;
                const startY = mochiRect.bottom + CONFIG.FEED_ICON_Y_OFFSET_PX; // もちすけの足元より、アイコン1個分ほど下

                const icon = document.createElement('img');
                icon.id = 'feed-placed-icon';
                icon.src = stage.itemImg;
                icon.alt = stage.item;
                icon.className = 'feed-icon-drop-in';
                icon.style.cssText = `position:fixed; width:78px; height:78px; object-fit:contain; z-index:99999;
                    left:${startX}px; top:${startY}px; transform:translate(-50%,-50%);
                    filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4)); touch-action:none; cursor:grab;`;
                document.body.appendChild(icon);

                feedTeaseLevel = 0;
                showFeedTeaseComment(); // level 0の「ちょうだい！」
                scheduleFeedTeaseEscalation();

                // このアイコン自体を長押し・ドラッグして、もちすけの上まで運んでもらう
                icon.addEventListener('pointerdown', (e) => startFeedDrag(idx, icon, e));
            }, CONFIG.FEED_ICON_PLACEMENT_DELAY_MS); // 倉庫のモーダルが閉じるアニメーションと被らないよう少し待つ
        }

        /**
         * おみやげアイコンのドラッグ操作を開始し、documentへ移動・終了イベントのリスナーを登録する。
         * @param {number} idx - おみやげ（都道府県）のインデックス
         * @param {HTMLElement} icon - ドラッグ対象のアイコン要素
         * @param {PointerEvent} e - ドラッグ開始のポインタイベント
         * @returns {void}
         */
        export function startFeedDrag(idx, icon, e) {
            e.preventDefault();
            icon.classList.remove('feed-icon-drop-in');
            icon.style.cursor = 'grabbing';
            icon.style.transition = 'none';
            feedDragState = { idx, icon };

            document.addEventListener('pointermove', onFeedDragMove);
            document.addEventListener('pointerup', onFeedDragEnd);
            document.addEventListener('pointercancel', onFeedDragEnd);
        }

        /**
         * ドラッグ中のポインタ位置に合わせて、置いたおみやげアイコンの座標を更新する。
         * @param {PointerEvent} e - 移動中のポインタイベント
         * @returns {void}
         */
        export function onFeedDragMove(e) {
            if (!feedDragState) return;
            feedDragState.icon.style.left = e.clientX + 'px';
            feedDragState.icon.style.top = e.clientY + 'px';
        }

        /**
         * おみやげアイコンのドラッグ操作を終了し、もちすけの上に落とせていれば給餌を実行、
         * そうでなければ足元へ戻すアニメーションを行う。
         * @param {PointerEvent} e - ドラッグ終了のポインタイベント
         * @returns {void}
         */
        export function onFeedDragEnd(e) {
            if (!feedDragState) return;
            const { idx, icon } = feedDragState;
            document.removeEventListener('pointermove', onFeedDragMove);
            document.removeEventListener('pointerup', onFeedDragEnd);
            document.removeEventListener('pointercancel', onFeedDragEnd);
            feedDragState = null;

            const mochiRect = mochiBtnElement.getBoundingClientRect();
            const x = e.clientX, y = e.clientY;
            const isOverMochi = x >= mochiRect.left && x <= mochiRect.right && y >= mochiRect.top && y <= mochiRect.bottom;

            if (isOverMochi) {
                icon.remove();
                feedMochisuke(idx);
            } else {
                // もちすけの上じゃなければ、足元にすとんと戻って、またやり直せるようにする
                const mochiRectNow = mochiBtnElement.getBoundingClientRect();
                icon.style.transition = 'left 0.3s ease-out, top 0.3s ease-out, transform 0.3s';
                icon.style.left = (mochiRectNow.left + mochiRectNow.width / 2) + 'px';
                icon.style.top = (mochiRectNow.bottom + CONFIG.FEED_ICON_Y_OFFSET_PX) + 'px';
                icon.style.cursor = 'grab';
                setTimeout(() => { icon.style.transition = 'none'; }, CONFIG.FEED_ICON_RETURN_ANIM_MS);
                feedTeaseLevel++;
                showFeedTeaseComment();
            }
        }

        export let feedBuffIndicatorTimer = null;
        /**
         * 給餌バフの残り時間インジケーターを表示し、一定間隔で残り秒数の表示を更新する。
         * バフが切れたら自動的にインジケーターを非表示にする。
         * @returns {void}
         */
        export function startFeedBuffIndicator() {
            const el = document.getElementById('feed-buff-indicator');
            const timerEl = document.getElementById('feed-buff-timer');
            if (!el) return;
            el.classList.add('show');
            clearInterval(feedBuffIndicatorTimer);
            feedBuffIndicatorTimer = setInterval(() => {
                const remaining = Math.ceil((feedBuffActiveUntil - Date.now()) / 1000);
                if (remaining <= 0) {
                    el.classList.remove('show');
                    clearInterval(feedBuffIndicatorTimer);
                } else if (timerEl) {
                    timerEl.innerText = remaining;
                }
            }, CONFIG.FEED_BUFF_INDICATOR_INTERVAL_MS);
        }

        /**
         * 一定間隔でフィーバー(黄金もち)の抽選を行い、条件を満たせば黄金もちを出現させるループを開始する。
         * @returns {void}
         */
        export function startFeverSpawningLoop() {
            setInterval(() => { if (!isTutorialActive && !isFever && !document.getElementById('fever-pop') && Math.random() < CONFIG.FEVER_SPAWN_CHANCE) spawnGoldMochi(); }, CONFIG.FEVER_SPAWN_CHECK_INTERVAL_MS);
        }

        /**
         * フィーバータイムを開始し、演出（画面シェイク・フラッシュ）を出したうえで、
         * 1秒ごとに残り時間を減らして終了処理まで行うタイマーをセットする。
         * @returns {void}
         */
        export function triggerFeverTime() {
            isFever = true; feverTimeLeft = CONFIG.FEVER_DURATION_SEC;
            document.getElementById('mochi-balloon').classList.remove('balloon-show');
            document.getElementById('header-container').classList.add('fever-active');
            screenShake('big');
            screenFlash('#ff3d81', CONFIG.FEVER_FLASH_ALPHA);
            updateDisplay();
            if (feverInterval) clearInterval(feverInterval);
            feverInterval = setInterval(() => {
                feverTimeLeft--;
                if (feverTimeLeft <= 0) { clearInterval(feverInterval); isFever = false; document.getElementById('header-container').classList.remove('fever-active'); }
                updateDisplay();
            }, CONFIG.FEVER_TICK_INTERVAL_MS);
        }

        export let hissatsuAutoChargeAccum = 0;
        // 🐛パフォーマンス修正（第2版）：以前はここで3回に1回だけ画面に反映する間引きをしていたが、
        // タップ画面を見ている間の反応が鈍く感じられたため、間引きはやめて元通り毎回(100ms毎)反映する。
        // その代わり、ランキング・移動・ショップ・きせかえ部屋など「何かモーダルが開いていて
        // スコア表示(score-text等)が画面上に見えていない」時は、どうせ見えていない要素を書き換えても
        // 無駄なので、そもそもupdateDisplay()を呼ばないようにする。
        // 🐛注意：mochisuke自体が見えるかを判定する isMochisukeVisible() はきせかえ部屋の時にtrueを
        // 返してしまう（きせかえ部屋にも別のもちすけがいるため）が、score-textはきせかえ部屋には無いので
        // ここでは使わず、「モーダルが1つも開いていないか」を直接見る。
        // スコアの加算自体はモーダルが開いていても裏で正確に増え続ける（他の画面を見ている間も
        // 収入が止まったように感じさせないため）ので、そこは今まで通り毎回行う
        setInterval(() => {
            let mps = getMps();
            if (mps > 0) {
                let gain = mps / 10; setScore(score + (gain));
                if (selectedStageIndex === currentStageIndex && currentStageIndex < stages.length) { setCurrentStageProgress(currentStageProgress + (gain)); checkStageProgress(); }
                if (!document.body.classList.contains('modal-open')) updateDisplay();
            }
            updateSkillTimers(0.1); // スキルのクールタイムや持続タイマーを100ms単位でリアルタイム更新

            // 🥋 必殺技ゲージは、タップしなくてもかなりゆっくり自動でたまる（他の自動増加と比べてかなり控えめ）
            const hs = skills.hissatsu;
            if (hs.lv > 0 && hs.activeTimer <= 0 && hs.currentCd > 0) {
                hissatsuAutoChargeAccum += 0.05; // 1秒あたり0.5ぶん＝満タン(150〜400)まで約5〜13分
                if (hissatsuAutoChargeAccum >= 1) {
                    const wholeAmount = Math.floor(hissatsuAutoChargeAccum);
                    hissatsuAutoChargeAccum -= wholeAmount;
                    const wasCharging = hs.currentCd > 0;
                    hs.currentCd = Math.max(0, hs.currentCd - wholeAmount);
                    if (wasCharging && hs.currentCd <= 0) playAudioFile('audio/ready.mp3', CONFIG.READY_SFX_VOLUME);
                    updateSkillUI();
                }
            }
        }, 100);




        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        /**
         * 給餌バフが有効なタイムスタンプ(feedBuffActiveUntil)を書き換える。
         * @param {number} v - バフが有効な期限のタイムスタンプ(ms)
         * @returns {void}
         */
        export function setFeedBuffActiveUntil(v) { feedBuffActiveUntil = v; }
        /**
         * 給餌の1日上限がリセットされた日付(feedLastResetDate)を書き換える。
         * @param {string} v - リセット済みとして記録する日付文字列
         * @returns {void}
         */
        export function setFeedLastResetDate(v) { feedLastResetDate = v; }
        /**
         * その日すでに使った給餌回数(feedPlaysUsedToday)を書き換える。
         * @param {number} v - 本日使用済みの給餌回数
         * @returns {void}
         */
        export function setFeedPlaysUsedToday(v) { feedPlaysUsedToday = v; }
        /**
         * 給餌のじらしレベル(feedTeaseLevel)を書き換える。
         * @param {number} v - 新しいじらしレベル
         * @returns {void}
         */
        export function setFeedTeaseLevel(v) { feedTeaseLevel = v; }
        /**
         * ゲーム画面の矩形情報(gameScreenRect)を書き換える。
         * @param {DOMRect|null} v - 新しい画面矩形
         * @returns {void}
         */
        export function setGameScreenRect(v) { gameScreenRect = v; }
        /**
         * 1000コンボ称号を初回お祝い済みかどうかのフラグ(hasComboTitle1000)を書き換える。
         * @param {boolean} v - 初回お祝い済みかどうか
         * @returns {void}
         */
        export function setHasComboTitle1000(v) { hasComboTitle1000 = v; }
        /**
         * 直前にタップした時刻(lastTappedTime)を書き換える。
         * @param {number} v - タップ時刻のタイムスタンプ(ms)
         * @returns {void}
         */
        export function setLastTappedTime(v) { lastTappedTime = v; }


        // window橋渡し：ここから下は、index.htmlのonclick=""（静的または動的に生成される
        // 文字列の両方）から直接呼ばれる関数を中心に、window経由のアクセスがまだ必要なものをまとめている。
        // ブラウザはonclick="foo()"の実行時にwindow.fooを探すため、橋渡しが無いとボタンを押しても
        // 静かに何も起きない（実際にこれで一度事故を起こした。解体新書 第9章参照）。削除する時は、
        // 他ファイルからのimport参照・index.html内の静的onclick・動的に組み立てられるonclick文字列の
        // 3経路すべてを確認すること。
        window.useSkill = useSkill;
