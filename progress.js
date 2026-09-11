// 他ファイルへの依存はすべてこのimportに明示されている。書き換えが必要な値はsetXxx(...)という
// 関数呼び出しの形にしている（importした束縛には直接代入できないため。ESモジュールの仕様）。
import {
  DAILY_MISSION_COUNT, DAILY_MISSION_POOL, PRESTIGE_SHOP_ITEMS, TUTORIAL_MISSIONS,
  WEEKLY_MISSION_COUNT, WEEKLY_MISSION_POOL, dialogueData, stages
} from './data.js?v=2026-09-11-002';
import {
  createParticle, formatMochi, getGameScreenRect, pickRandom, playAudioFile, screenShake,
  setGameBackground, vibrate
} from './main.js?v=2026-09-11-002';
import { setPurchasedItems } from './shop.js?v=2026-09-11-002';
import {
  OFFLINE_EARNINGS_CAP_HOURS_BASE, OFFLINE_EARNINGS_MIN_SECONDS, firstPlayTimestamp,
  lastActiveTimestamp, playerName, saveGame, score, setScore, totalTapsCount
} from './state.js?v=2026-09-11-002';
import { getMps, skills } from './tap.js?v=2026-09-11-002';
import {
  closeModal, diaryPageIndex, flipDiaryPage, openDiary, openModal, renderDiaryPage,
  setDiaryPageIndex, showMochiComment, updateDisplay
} from './ui.js?v=2026-09-11-002';

        // 🔧 CONFIG：ロジック中のマジックナンバーを調整しやすいようにまとめたもの
        const CONFIG = {
            // 都道府県トロフィーのボーダーライン計算（getPrefTrophyLines）
            PREF_TROPHY_BRONZE_BASE: 50,          // 銅ボーダーの基準タップ数（県indexが0の時）
            PREF_TROPHY_BRONZE_PER_INDEX: 15,     // 県indexが1つ進むごとに銅ボーダーへ加算する量
            PREF_TROPHY_SILVER_MULTIPLIER: 2.5,   // 銀ボーダー = 銅ボーダー × この倍率
            PREF_TROPHY_GOLD_MULTIPLIER: 6,       // 金ボーダー = 銅ボーダー × この倍率

            // オフライン収益（checkOfflineEarnings）
            OFFLINE_EARNINGS_SECONDS_PER_HOUR: 3600, // 上限時間(時間)を秒に変換する係数

            // ステージ移動のフェード演出（triggerAreaTransition）
            AREA_TRANSITION_FADE_MS: 300,   // 黒フェードしてからcallbackを実行するまでの時間
            AREA_TRANSITION_UNFADE_MS: 150, // 背景切り替え後、フェードを解除するまでの時間

            // 県クリア時の最低滞在時間（checkStageProgress）
            STAGE_MIN_STAY_MS: 3000,

            // 日本制覇：紙吹雪演出（triggerJapanClearCelebration）
            CONFETTI_PARTICLE_COUNT: 90,             // 紙吹雪の粒の数
            CONFETTI_SPECIAL_COLOR_PROBABILITY: 0.6, // 特別な色になる確率
            CONFETTI_STAGGER_MS: 35,                 // 粒を1つずつ出す間隔
            CONFETTI_ORIGIN_Y_FRACTION: 0.1,         // 発生位置のY（画面上端からの割合）
            JAPAN_CLEAR_VIBRATE_PATTERN: [40, 60, 40, 60, 40, 60, 160], // 達成時のバイブパターン(ms)
            MS_PER_DAY: 86400000, // プレイ日数の計算に使う、1日のミリ秒数

            // 日本制覇モーダルの段階演出タイミング（triggerJapanClearCelebration）
            JAPAN_CLEAR_TITLE_DELAY_MS: 300,     // 称号が現れるまでの遅延
            JAPAN_CLEAR_STATS_DELAY_MS: 900,     // 統計カウントアップ開始までの遅延
            JAPAN_CLEAR_STATS_COUNTUP_MS: 1200,  // 統計カウントアップにかける時間
            JAPAN_CLEAR_MESSAGE_DELAY_MS: 2300,  // もちすけのメッセージが出るまでの遅延
            JAPAN_CLEAR_BUTTONS_DELAY_MS: 3000,  // ボタンが出るまでの遅延

            // 達成画像の保存（saveJapanClearImage）
            SAVE_IMAGE_WIDTH: 900,
            SAVE_IMAGE_HEIGHT: 1600,

            // スタンプ演出（tapStampFrame）
            STAMP_VIBRATE_PATTERN: [25, 20, 70], // スタンプ時のバイブパターン(ms)
            STAMP_RING_COUNT: 3,                 // インクの輪を出す本数
            STAMP_RING_STAGGER_SEC: 0.08,         // 輪ごとのアニメーション開始ずれ（秒）
            STAMP_RING_REMOVE_BASE_MS: 700,      // 輪を消すまでの基本時間
            STAMP_RING_REMOVE_STAGGER_MS: 80,    // 輪ごとに加算する消去タイミングのずれ
        };

        export let prestigeCount = 0;      // 転生した回数

        // 👗 着せ替え部屋：所持アイテムと、今装着中のアイテム（カテゴリごとに1つだけ）
        export let ownedKisekaeItems = { hat: [], face: [], clothes: ['clothes_mochisuke_tshirt'], back: [], fullbody: [] };
        export let equippedKisekae = { hat: null, face: null, clothes: 'clothes_mochisuke_tshirt', back: null, fullbody: null };

        // 💼 おしごとミッション：進捗カウンター・選ばれているミッション・受け取り済みの管理
        // 🔴 ここに無いキーはtrackMissionEvent()が黙って無視する（安全装置）ため、ミッション定義(data.js)で
        // 使っているtrackKeyは、日/週で自動リセットされないものも含めて必ずここに書いておくこと
        export let missionCounters = {
            // 🔰 チュートリアル用：一度きりの累計カウンター（日/週で リセットしない）
            totalTaps: 0, omiyageBoughtTotal: 0, minigamesPlayedTotal: 0, gachaSpinsTotal: 0,
            skillUsedTotal: 0, stampsTotal: 0,
            // 📅 デイリー用：checkAndRotateMissions()内で日が変わるたびに0へリセットされる
            loginToday: 0, tapsToday: 0, minigamesToday: 0, omiyageBoughtToday: 0,
            skillUsedToday: 0, feedToday: 0,
            // 🗓️ ウィークリー用：checkAndRotateMissions()内で週が変わるたびに0へリセットされる
            tapsThisWeek: 0, stampsThisWeek: 0, jackpotsThisWeek: 0, minigamesThisWeek: 0,
            skillUsedThisWeek: 0, loginDaysThisWeek: 0,
        };
        export let missionDailyDate = '';       // 最後にデイリーをリセットした日付(YYYY-MM-DD)
        export let missionWeeklyWeekKey = '';   // 最後にウィークリーをリセットした週(YYYY-Www)
        export let missionDailySelected = [];   // 今日選ばれているデイリーミッションのID
        export let missionWeeklySelected = [];  // 今週選ばれているウィークリーミッションのID
        export let missionClaimed = {};         // { [ミッションID]: true } 受け取り済み
        export let tutorialMissionStep = 0;     // チュートリアルミッション、次に見せるステップ番号

        // 🛋️ マイルーム：所持アイテムと、今の配置状況
        export let ownedMyroomItems = { wallpaper: ['wallpaper_default'], flooring: ['flooring_default'], wall_deco: [], big_furniture: [], table: [], small_deco: [] };
        export let equippedMyroom = {
            wallpaper: 'wallpaper_default', flooring: 'flooring_default',
            // 🛋️ 家具4カテゴリは、複数個の配置インスタンス配列にする： [{ itemId, top, left, flip }, ...]
            wall_deco: [], big_furniture: [], table: [], small_deco: [],
        };
        // 🔀 最大3部屋まで持てる。equippedMyroomは「今表示・編集中の部屋」を指す
        export let myroomSlots = [null, null, null];
        export let currentMyroomSlotIndex = 0;
        export let previewKisekae = { hat: null, face: null, clothes: 'clothes_mochisuke_tshirt' }; // 「決定」を押すまでの試着中の状態
        export let prestigeScoreHistory = []; // 各転生の直前に持っていたもち数の記録（将来使う可能性があるので記録だけしておく）
        export let prestigePoints = 0;     // 転生ポイント（所持数、将来のショップで消費する予定）
        export const PRESTIGE_BONUS_PER_COUNT = 0.02; // 転生1回につき、タップ力・自動増加が恒久的に+2%（控えめ・線形。世界編を見据えてここは急激に伸ばさない）
        /**
         * 転生回数に応じた、タップ力・自動増加への恒久倍率を計算する。
         * @returns {number} 恒久倍率（1 + 転生回数 × PRESTIGE_BONUS_PER_COUNT）
         */
        export function getPrestigeBonusMultiplier() {
            return 1 + prestigeCount * PRESTIGE_BONUS_PER_COUNT;
        }

        // 🎰 ガチャコイン：もちとは別枠の通貨。もちは際限なく増え続けて価値が変わってしまうため、
        // ガチャの対価としては、タップでは稼げない・増え方がゆるやかな別通貨を用意した
        export let gachaCoins = 0;
        export const GACHA_COIN_PER_STAMP = 2;      // 都道府県のスタンプを押すたびに
        export const GACHA_COIN_JAPAN_CLEAR = 50;   // 日本制覇の達成時に
        export const GACHA_COIN_PER_PRESTIGE = 30;  // 転生するたびに

        // 🛍️ 転生ポイントショップ（世界編を見据えて、パワーではなく利便性(QOL)中心。ただし今回、周回の土台になる部分もいくつか追加）
        export let prestigeShopLv = {
            offlineCap: 0, minigamePlays: 0,
            omiyagePriceDiscount: 0, omiyagePriceCurve: 0,
            startingBonus: 0, skillCdReduction: 0, minigameReward: 0,
        };
        /**
         * オフライン収益の上限時間（基準値＋転生ショップ強化分）を返す。
         * @returns {number} 上限時間（時間単位）
         */
        export function getOfflineEarningsCapHours() { return OFFLINE_EARNINGS_CAP_HOURS_BASE + prestigeShopLv.offlineCap; }
        /**
         * ミニゲームの1日あたりプレイ可能回数（基準値＋転生ショップ強化分）を返す。
         * @returns {number} 1日のプレイ可能回数
         */
        export function getMinigameDailyLimit() { return MINIGAME_DAILY_LIMIT_BASE + prestigeShopLv.minigamePlays; }
        // 恒久強化の効果を返す関数群（買い物ショップ・スキルクールタイム・ミニゲーム報酬・初期ボーナス計算から呼ばれる）
        /**
         * 転生ショップで購入した、タップ力・自動増加の初期加算ボーナスを返す。
         * @returns {number} 初期加算ボーナス値
         */
        export function getPrestigeStartingBonus() { return prestigeShopLv.startingBonus; }                     // タップ力・自動増加の初期加算値
        /**
         * 転生ショップで購入した、スキルクールタイムの短縮秒数を返す。
         * @returns {number} 短縮秒数
         */
        export function getPrestigeCdReductionSec() { return prestigeShopLv.skillCdReduction; }                 // スキル基本クールタイムからの短縮秒数
        /**
         * 転生ポイントショップの指定アイテムを購入する。上限到達・ポイント不足の場合は何もせず警告する。
         * @param {string} key - 購入するアイテムのキー（PRESTIGE_SHOP_ITEMSのキー）
         * @returns {void}
         */
        export function buyPrestigeShopItem(key) {
            const item = PRESTIGE_SHOP_ITEMS[key];
            if (!item) return;
            const currentCount = prestigeShopLv[key] || 0;
            if (currentCount >= item.max) { alert('これ以上は購入できません（上限に達しています）'); return; }
            if (prestigePoints < item.cost) { alert('転生ポイントが足りません'); return; }
            prestigePoints -= item.cost;
            prestigeShopLv[key] = currentCount + 1;
            saveGame();
            renderPrestigeShop();
        }
        window.buyPrestigeShopItem = buyPrestigeShopItem; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 転生ポイントショップの一覧DOMを、現在の強化状況に合わせて再描画する。
         * @returns {void}
         */
        export function renderPrestigeShop() {
            const el = document.getElementById('prestige-shop-list');
            if (!el) return;
            el.innerHTML = '';
            Object.entries(PRESTIGE_SHOP_ITEMS).forEach(([key, item]) => {
                const currentCount = prestigeShopLv[key] || 0;
                const maxed = currentCount >= item.max;
                const canBuy = !maxed && prestigePoints >= item.cost;
                const row = document.createElement('div');
                row.className = 'list-item';
                const currentEffect = currentCount * item.step;
                row.innerHTML = `<div class="item-info"><span class="item-title">${item.name}</span><span class="item-desc">現在: +${currentEffect}${item.unit}（上限 +${item.max * item.step}${item.unit}）${item.desc || ''}</span></div>` +
                    `<button class="item-action-btn btn-shop" style="background:#3f51b5; color:#fff;" ${maxed || !canBuy ? 'disabled' : ''} onclick="buyPrestigeShopItem('${key}')">${maxed ? '上限達成' : `🔄${item.cost}pt`}</button>`;
                el.appendChild(row);
            });
            const ptEl = document.getElementById('prestige-shop-points');
            if (ptEl) ptEl.innerText = `所持転生ポイント: ${prestigePoints}`;
        }

        export let hasSeenJapanClear = false; // 日本制覇演出を出したかどうか（何度も出ないようにする）
        export const MINIGAME_DAILY_LIMIT_BASE = 3; // 1日あたりのプレイ回数上限（調整しやすいよう定数化）

        export let prefTaps = new Array(47).fill(0);

        // 県ごとのボーダーライン（調整しやすいよう関数化。県のインデックスiに応じて段階的にスケール）
        /**
         * 都道府県インデックスに応じた、銅・銀・金トロフィーのタップ数ボーダーラインを計算する。
         * @param {number} i - 都道府県のインデックス
         * @returns {Object} {bronzeLine, silverLine, goldLine} ボーダーライン
         */
        export function getPrefTrophyLines(i) {
            const bronzeLine = CONFIG.PREF_TROPHY_BRONZE_BASE + i * CONFIG.PREF_TROPHY_BRONZE_PER_INDEX;
            const silverLine = bronzeLine * CONFIG.PREF_TROPHY_SILVER_MULTIPLIER;
            const goldLine = bronzeLine * CONFIG.PREF_TROPHY_GOLD_MULTIPLIER;
            return { bronzeLine, silverLine, goldLine };
        }

        // タップ数は増える一方なので、この関数は常に「今まで到達した最高のトロフィー」を返す（ダウングレードしない）
        /**
         * 都道府県の滞在中タップ数から、これまでに獲得した最高のトロフィーを判定する（ダウングレードしない）。
         * @param {number} i - 都道府県のインデックス
         * @returns {(string|null)} 'gold'/'silver'/'bronze'、未獲得ならnull
         */
        export function getPrefTrophy(i) {
            const taps = prefTaps[i] || 0;
            const { bronzeLine, silverLine, goldLine } = getPrefTrophyLines(i);
            if (taps >= goldLine) return 'gold';
            if (taps >= silverLine) return 'silver';
            if (taps >= bronzeLine) return 'bronze';
            return null;
        }

        /**
         * トロフィー種別を対応する絵文字アイコンに変換する。
         * @param {string} trophy - トロフィー種別（'gold'/'silver'/'bronze'など）
         * @returns {string} 対応する絵文字（未獲得時は全角スペース）
         */
        export function getPrefTrophyIcon(trophy) {
            if (trophy === 'gold') return '🥇';
            if (trophy === 'silver') return '🥈';
            if (trophy === 'bronze') return '🥉';
            return '　';
        }
        export let currentStageIndex = 0;     
        export let selectedStageIndex = 0;    
        export let currentStageProgress = 0;   
        /**
         * 前回アクティブ時刻からの経過時間をもとにオフライン収益を計算し、加算・保存してモーダルで表示する。
         * @returns {void}
         */
        export function checkOfflineEarnings() {
            if (!lastActiveTimestamp) return; // 初回プレイなど、前回の記録が無ければ何もしない
            const elapsedSeconds = (Date.now() - lastActiveTimestamp) / 1000;
            if (elapsedSeconds < OFFLINE_EARNINGS_MIN_SECONDS) return;
            const cappedSeconds = Math.min(elapsedSeconds, getOfflineEarningsCapHours() * CONFIG.OFFLINE_EARNINGS_SECONDS_PER_HOUR);
            const mps = getMps();
            const earnings = Math.floor(mps * cappedSeconds);
            if (earnings <= 0) return;

            setScore(score + (earnings));
            saveGame(); updateDisplay();

            const totalMinutes = Math.floor(elapsedSeconds / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeText = hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
            const cappedNote = elapsedSeconds > getOfflineEarningsCapHours() * CONFIG.OFFLINE_EARNINGS_SECONDS_PER_HOUR
                ? `（オフライン収益は最大${getOfflineEarningsCapHours()}時間分までです）` : '';

            document.getElementById('offline-earnings-time').innerText = `${timeText}の間、もちすけがひとりで頑張ってくれてたで！`;
            document.getElementById('offline-earnings-amount').innerText = `+${formatMochi(earnings)} もち`;
            document.getElementById('offline-earnings-note').innerText = cappedNote;
            playAudioFile('audio/gold_mochi.mp3');
            openModal('offline-earnings-modal', true);
        }

        /**
         * 画面を黒フェードで覆い、callback実行後に背景を切り替えてフェードを解除するエリア切り替え演出を行う。
         * @param {string} newBgUrl - 切り替え後の背景画像URL
         * @param {Function} callback - フェード中に実行する処理
         * @returns {void}
         */
        export function triggerAreaTransition(newBgUrl, callback) {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                callback();
                setGameBackground(newBgUrl);
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.AREA_TRANSITION_UNFADE_MS);
            }, CONFIG.AREA_TRANSITION_FADE_MS);
        }

        // 波紋・浮き文字はDOM要素を作らずcanvasにまとめて描画する（連打時のcreateElement/appendChild/remove連発による
        // レイアウト負荷とGCの揺れが高速タップ時のカクつきの主因だったため、パーティクルと同じ描画ループに統合）
        /**
         * 都道府県の滞在中タップ数・トロフィー状況・各ボーダーラインをalertで表示する。
         * @param {number} i - 都道府県のインデックス
         * @returns {void}
         */
        export function showPrefTrophyDetail(i) {
            const stage = stages[i];
            const taps = prefTaps[i] || 0;
            const trophy = getPrefTrophy(i);
            const { bronzeLine, silverLine, goldLine } = getPrefTrophyLines(i);
            const trophyText = trophy ? `${getPrefTrophyIcon(trophy)} ${trophy.toUpperCase()}` : "未獲得";
            const goldBonusText = trophy === 'gold' ? "（おみやげ効果+10%発動中！）" : "";
            alert(`【${stage.name}】\n滞在中タップ数: ${taps.toLocaleString()}回\n現在のトロフィー: ${trophyText}${goldBonusText}\n\n🥉銅: ${bronzeLine}回\n🥈銀: ${Math.floor(silverLine)}回\n🥇金: ${Math.floor(goldLine)}回`);
        }

        export const PRESTIGE_POINTS_PER_RUN = 5; // 転生1回あたりに獲得する転生ポイント（v1はシンプルに固定値。将来調整可）

        /**
         * 転生ポイントショップの一覧を描画してからモーダルを開く。
         * @returns {void}
         */
        export function openPrestigeShop() {
            renderPrestigeShop();
            openModal('prestige-shop-modal');
        }

        /**
         * 日本全国制覇済みかどうかから、転生が可能な状態かを判定する。
         * @returns {boolean} 転生可能ならtrue
         */
        export function canPrestige() {
            return hasSeenJapanClear; // 日本全国制覇済みなら転生可能
        }

        /**
         * 転生可能か確認し、可能であれば確認ダイアログを表示して、OKならdoPrestige()を実行する。
         * @returns {void}
         */
        export function openPrestigeConfirm() {
            if (!canPrestige()) {
                alert('日本全国を制覇すると転生できるようになります。まずは沖縄まで旅を続けよう！');
                return;
            }
            const currentBonus = (prestigeCount * PRESTIGE_BONUS_PER_COUNT * 100).toFixed(0);
            const nextBonus = ((prestigeCount + 1) * PRESTIGE_BONUS_PER_COUNT * 100).toFixed(0);
            const msg = `転生すると、もちの数・都道府県の進み具合・おみやげ・スキルレベルが全てリセットされます。\n\n` +
                `代わりに転生ポイントを${PRESTIGE_POINTS_PER_RUN}獲得し、タップ力・自動増加への恒久ボーナスが+${PRESTIGE_BONUS_PER_COUNT * 100}%増えます` +
                `（現在: +${currentBonus}% → 転生後: +${nextBonus}%）。\n\n` +
                `※累計タップ数・都道府県トロフィー・衣装・転生回数は引き継がれます。\n\n本当に転生しますか？`;
            if (confirm(msg)) doPrestige();
        }

        /**
         * 転生処理本体。スコア・進行状況・購入済みアイテムなどをリセットし、転生ポイント等を加算して保存後にリロードする。
         * @returns {void}
         */
        export function doPrestige() {
            prestigeScoreHistory.push({ prestigeNumber: prestigeCount + 1, score: Math.floor(score), timestamp: Date.now() });
            prestigeCount++;
            prestigePoints += PRESTIGE_POINTS_PER_RUN;
            gachaCoins += GACHA_COIN_PER_PRESTIGE; // ガチャコインは転生しても引き継がれる（他の進行データと違い、リセットしない）
            setScore(0);
            currentStageIndex = 0;
            selectedStageIndex = 0;
            currentStageProgress = 0;
            setPurchasedItems({});
            hasSeenJapanClear = false; // 🐛修正：これが無いと、2回目以降は沖縄クリア無しで転生し放題になってしまっていた
            collectedStamps = {}; // スタンプ帳も、絵日記の記録と同様に周回ごとリセットする
            Object.keys(skills).forEach(k => {
                skills[k].lv = 0;
                skills[k].activeTimer = 0;
                skills[k].currentCd = 0;
            });
            saveGame();
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            if (window.backupSaveData) {
                const raw = localStorage.getItem('mochisuke_save_data');
                if (raw) window.backupSaveData(raw, true); // 転生による意図的なリセットなので、ガードを無視して確実にバックアップを更新する
            }
            alert(`転生完了！転生ポイントを${PRESTIGE_POINTS_PER_RUN}獲得しました（合計: ${prestigePoints}）\nもちすけと、また鹿児島から旅をやり直そう！`);
            location.reload(); // 画面各所を確実に初期状態へ戻すため、リロードして最初から表示し直す
        }

        /**
         * 日本制覇の達成演出（SE・バイブレーション・紙吹雪・段階的なモーダル表示）を行う。
         * @returns {void}
         */
        export function triggerJapanClearCelebration() {
            if (hasSeenJapanClear) return;
            hasSeenJapanClear = true;
            gachaCoins += GACHA_COIN_JAPAN_CLEAR;
            saveGame();

            playAudioFile('audio/mochisuke/japan_clear.mp3'); // 専用の祝賀SE（無ければ用意してください。それまでは無音になります）
            vibrate(CONFIG.JAPAN_CLEAR_VIBRATE_PATTERN);

            // 紙吹雪演出：色を増やし、量も時間も伸ばして、より豪華に
            const rect = getGameScreenRect();
            for (let i = 0; i < CONFIG.CONFETTI_PARTICLE_COUNT; i++) {
                setTimeout(() => {
                    const x = rect.left + Math.random() * rect.width;
                    const y = rect.top + rect.height * CONFIG.CONFETTI_ORIGIN_Y_FRACTION;
                    createParticle(x, y, Math.random() < CONFIG.CONFETTI_SPECIAL_COLOR_PROBABILITY);
                }, i * CONFIG.CONFETTI_STAGGER_MS);
            }

            const days = firstPlayTimestamp ? Math.max(1, Math.ceil((Date.now() - firstPlayTimestamp) / CONFIG.MS_PER_DAY)) : 1;
            const finalTaps = totalTapsCount, finalScore = score;

            openModal('japan-clear-modal');

            // 🎬 段階的な演出：①称号がバウンドして現れる →②統計が0からカウントアップ →③もちすけのメッセージ →④ボタン
            const titleEl = document.getElementById('japan-clear-title');
            const statsEl = document.getElementById('japan-clear-stats');
            const msgEl = document.getElementById('japan-clear-message');
            const btnEl = document.getElementById('japan-clear-buttons');

            setTimeout(() => {
                titleEl.style.opacity = '1';
                titleEl.style.transform = 'scale(1)';
            }, CONFIG.JAPAN_CLEAR_TITLE_DELAY_MS);

            setTimeout(() => {
                statsEl.style.opacity = '1';
                const startTime = performance.now();
                const duration = CONFIG.JAPAN_CLEAR_STATS_COUNTUP_MS;
                function countUp(now) {
                    const t = Math.min(1, (now - startTime) / duration);
                    const eased = 1 - Math.pow(1 - t, 3);
                    statsEl.innerHTML = `
                        📍 総タップ数: ${formatMochi(Math.floor(finalTaps * eased))} 回<br>
                        🍡 現在の所持もち: ${formatMochi(Math.floor(finalScore * eased))}<br>
                        📅 プレイ日数: ${days}日目
                    `;
                    if (t < 1) requestAnimationFrame(countUp);
                }
                requestAnimationFrame(countUp);
            }, CONFIG.JAPAN_CLEAR_STATS_DELAY_MS);

            setTimeout(() => {
                msgEl.innerText = '「鹿児島から沖縄まで、ずっと一緒に旅してくれて、ほんまありがとうな。47都道府県、全部お前と一緒に見て回れて、もちすけ幸せやったで。」';
                msgEl.style.opacity = '1';
            }, CONFIG.JAPAN_CLEAR_MESSAGE_DELAY_MS);

            setTimeout(() => {
                btnEl.style.opacity = '1';
            }, CONFIG.JAPAN_CLEAR_BUTTONS_DELAY_MS);
        }

        // 連打の勢いで誤って閉じないよう、必ず確認をはさむ
        /**
         * 日本制覇モーダルを閉じる前に、誤操作防止用の確認UIを表示する。
         * @returns {void}
         */
        export function confirmCloseJapanClear() {
            document.getElementById('japan-clear-confirm').style.display = 'flex';
        }

        /**
         * 確認UIと日本制覇モーダルを閉じ、遅延後に転生の仕組みを説明するalertを表示する。
         * @returns {void}
         */
        export function closeJapanClearAndExplainPrestige() {
            document.getElementById('japan-clear-confirm').style.display = 'none';
            closeModal('japan-clear-modal');
            // 🐛修正：以前は「転生は倉庫の画面から選べます」と案内していたが、実際には倉庫（おみやげ収納）に
            // 転生の入り口は無く、本当のボタン(main-prestige-btn)は次のエリアまでのゲージの下、
            // スタンプボタンと同じ場所に出る作りになっていた。案内文が実態と食い違っていたので修正する。
            setTimeout(() => {
                alert(
                    '🔄 転生について\n\n' +
                    '日本を制覇したことで、「転生」ができるようになりました。\n' +
                    '転生すると、今の進行状況はリセットされますが、代わりに「転生ポイント」がもらえて、次の周回を有利に進められます。\n\n' +
                    '転生は、画面の「次のエリアまで」のゲージの下に出てくる「🔄 転生する」ボタンから選べます。焦らず、気が向いた時に挑戦してみてください。'
                );
            }, 350);
        }

        // 📷 達成画面を、そのまま画像として保存できるようにする
        /**
         * 日本制覇の達成内容をcanvasに描画し、画像として保存できるようプレビューモーダルを開く。
         * @returns {void}
         */
        export function saveJapanClearImage() {
            const cw = CONFIG.SAVE_IMAGE_WIDTH, ch = CONFIG.SAVE_IMAGE_HEIGHT;
            const canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            const ctx = canvas.getContext('2d');

            const bg = new Image();
            bg.onload = () => {
                // 背景（cover相当で描画）
                const scale = Math.max(cw / bg.width, ch / bg.height);
                const dw = bg.width * scale, dh = bg.height * scale;
                ctx.drawImage(bg, (cw - dw) / 2, (ch - dh) / 2, dw, dh);

                const grad = ctx.createLinearGradient(0, ch * 0.55, 0, ch);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(0.45, 'rgba(0,0,0,0.55)');
                grad.addColorStop(1, 'rgba(0,0,0,0.8)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, ch * 0.55, cw, ch * 0.45);

                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 52px sans-serif';
                ctx.fillText('🎉 日本全国制覇！ 🎉', cw / 2, ch - 420);
                ctx.fillStyle = '#ffd54f';
                ctx.font = 'bold 34px sans-serif';
                ctx.fillText('🏅「日本もち王」の称号を獲得！', cw / 2, ch - 360);

                const days = firstPlayTimestamp ? Math.max(1, Math.ceil((Date.now() - firstPlayTimestamp) / CONFIG.MS_PER_DAY)) : 1;
                ctx.fillStyle = '#fff';
                ctx.font = '30px sans-serif';
                ctx.fillText(`📍 総タップ数: ${formatMochi(totalTapsCount)} 回`, cw / 2, ch - 270);
                ctx.fillText(`🍡 所持もち: ${formatMochi(score)}`, cw / 2, ch - 220);
                ctx.fillText(`📅 プレイ日数: ${days}日目`, cw / 2, ch - 170);

                const dataUrl = canvas.toDataURL('image/png');
                const imgEl = document.getElementById('save-image-preview');
                if (imgEl) imgEl.src = dataUrl;
                openModal('save-image-modal');
            };
            bg.onerror = () => {
                alert('画像の生成に失敗しました。しばらくしてからもう一度お試しください。');
            };
            bg.src = 'ui_images/backgrounds/japan_clear.webp';
        }

        export let collectedStamps = {}; // { 都道府県のインデックス: true }  -- スタンプ帳に押した記録

        export let stageArrivalTime = Date.now(); // このエリアに着いた時刻（自動増加が高いと一瞬でゲージが埋まってしまう対策用）
        export let stampGuardRecheckTimer = null;
        // 📊 スタンプ関連の状態を、実機で直接確認するための診断パネル
        export let stampDebugMode = false;
        export let stampDebugInterval = null;
        /**
         * 現在ステージの進行度が距離に達したかを確認し、達していればスタンプボタン表示または日本制覇演出を行う。
         * @returns {void}
         */
        export function checkStageProgress() {
            if (currentStageProgress >= stages[currentStageIndex].distance) {
                currentStageProgress = stages[currentStageIndex].distance; // スタンプを押すまでの間、表示が100%を超えて増え続けないようにする
                if (currentStageIndex < stages.length - 1) {
                    // 🔴 ゲージが溜まっても自動では進まず、スタンプを押すボタンを出して待つ
                    // （自動増加やタップで、閾値の低い序盤の県だと数秒で埋まってしまうことがあるため、最低限の滞在時間を設ける）
                    const elapsed = Date.now() - stageArrivalTime;
                    if (elapsed < CONFIG.STAGE_MIN_STAY_MS) {
                        clearTimeout(stampGuardRecheckTimer);
                        stampGuardRecheckTimer = setTimeout(checkStageProgress, CONFIG.STAGE_MIN_STAY_MS - elapsed); // その後タップが無くても、確実にボタンが出るようにする保険
                        return;
                    }
                    const btn = document.getElementById('stamp-press-btn');
                    if (btn) btn.style.display = 'flex';
                } else {
                    currentStageProgress = stages[currentStageIndex].distance; saveGame();
                    if (!hasSeenJapanClear) triggerJapanClearCelebration();
                }
            }
        }

        // 🔴 スタンプを押す：効果音・演出のあと、少し間を置いてフェードして次のエリアへ
        export let isPendingStampMoment = false; // ゲージが溜まって「スタンプを押す」を待っている状態かどうか

        // 🔴 進捗エリアのボタン：まだスタンプは押さず、絵日記の裏面を開いて「押してもらう」のを待つ
        /**
         * ゲージが満タンであることを確認し、絵日記を開いてスタンプ待ち状態にする。
         * @returns {void}
         */
        export function openDiaryForStamping() {
            if (currentStageProgress < stages[currentStageIndex].distance) return; // 念のため、本当にゲージが満タンか確認する
            const btn = document.getElementById('stamp-press-btn');
            if (btn) btn.style.display = 'none';
            isPendingStampMoment = true;
            openDiary();
            setDiaryPageIndex(currentStageIndex); // openDiary()内でselectedStageIndexに上書きされるため、必ずその後に設定する
            renderDiaryPage();
            flipDiaryPage(true);
        }

        // 🔴 絵日記裏面のスタンプ枠をタップした時：待機中かつ未到達の県でだけ、実際にスタンプを押す
        /**
         * スタンプ待ち状態かつ未到達の現在県であれば、スタンプを記録して演出を行い、次のエリアへ遷移する。
         * @returns {void}
         */
        export function tapStampFrame() {
            if (!isPendingStampMoment) return; // 通常の閲覧中は何も起きない
            if (diaryPageIndex !== currentStageIndex) return;
            if (collectedStamps[currentStageIndex]) return;
            if (currentStageProgress < stages[currentStageIndex].distance) { isPendingStampMoment = false; return; } // 念のため、本当にゲージが満タンか直接確認する

            const idx = currentStageIndex;
            collectedStamps[idx] = true;
            isPendingStampMoment = false;
            gachaCoins += GACHA_COIN_PER_STAMP;
            trackMissionEvent('stampsThisWeek', 1); trackMissionEvent('stampsTotal', 1);
            saveGame();

            playAudioFile('audio/stamp.mp3'); // 専用のスタンプ音（無ければ用意してください。それまでは無音）
            vibrate(CONFIG.STAMP_VIBRATE_PATTERN);
            screenShake('small');

            // 🔴 ハンコがガツンと押されるような演出：上から勢いよく縮んできて、周りにインクが飛び散るような輪が広がる
            const frame = document.getElementById('diary-stamp-frame');
            const mark = document.getElementById('diary-stamp-mark');
            mark.innerText = `${stages[idx].name}\n到達記念`;
            mark.style.opacity = '0';
            mark.style.transition = 'none';
            mark.style.transform = 'rotate(-10deg) scale(2.6)';
            void mark.offsetWidth;
            mark.style.transition = 'transform 0.32s cubic-bezier(0.2,0.9,0.3,1.3), opacity 0.15s';
            mark.style.opacity = '0.88';
            mark.style.borderStyle = 'solid';
            mark.style.transform = 'rotate(-10deg) scale(1)';

            for (let i = 0; i < CONFIG.STAMP_RING_COUNT; i++) {
                const ring = document.createElement('div');
                ring.style.cssText = 'position:absolute; inset:0; margin:auto; width:150px; height:150px; border-radius:50%; border:3px solid #c62828; pointer-events:none; opacity:0.7;';
                frame.appendChild(ring);
                requestAnimationFrame(() => {
                    ring.style.transition = `transform 0.5s ease-out ${i * CONFIG.STAMP_RING_STAGGER_SEC}s, opacity 0.5s ease-out ${i * CONFIG.STAMP_RING_STAGGER_SEC}s`;
                    ring.style.transform = 'scale(1.6)';
                    ring.style.opacity = '0';
                });
                setTimeout(() => ring.remove(), CONFIG.STAMP_RING_REMOVE_BASE_MS + i * CONFIG.STAMP_RING_REMOVE_STAGGER_MS);
            }

            setTimeout(() => {
                closeModal('diary-modal');
                currentStageIndex++; const nextIdx = currentStageIndex; currentStageProgress = 0;
                triggerAreaTransition(stages[nextIdx].bg, () => {
                    selectedStageIndex = nextIdx; stageArrivalTime = Date.now(); updateDisplay(); saveGame();
                    clearTimeout(stampGuardRecheckTimer); // 前のエリアから予約されていた再チェックが、後から誤発火しないようにする
                    const stampBtn = document.getElementById('stamp-press-btn');
                    if (stampBtn) stampBtn.style.display = 'none';
                    const name = stages[nextIdx].name;
                    const prefPool = dialogueData.prefectureComments[name];
                    showMochiComment(prefPool ? `${name}到着！${pickRandom(prefPool)}` : `${name}到着！ここはどんな場所やろな？`);
                });
            }, 900);
        }

        // ===================================================================
        // 🛠️ 管理者専用：沖縄（最終ステージ）まで一気に進める
        // ?dev=1 の開発者メニュー（initDevMode参照）からのみ呼び出される。通常プレイヤーの導線には出てこない
        // ===================================================================
        /**
         * 開発者用。現在地から沖縄（最終ステージ）まで、間の都道府県をスタンプ済み扱いにして一気に進める。
         * スタンプ報酬（ガチャコイン）も通常と同じ計算式で加算し、状態に矛盾が出ないようにする。
         * @returns {void}
         */
        export function adminJumpToFinalStage() {
            const finalIdx = stages.length - 1;
            if (currentStageIndex >= finalIdx) {
                alert('すでに最終ステージ（沖縄）にいます。');
                return;
            }
            clearTimeout(stampGuardRecheckTimer);
            isPendingStampMoment = false;
            let newlyStampedCount = 0;
            for (let i = currentStageIndex; i < finalIdx; i++) {
                if (!collectedStamps[i]) { collectedStamps[i] = true; newlyStampedCount++; }
            }
            gachaCoins += GACHA_COIN_PER_STAMP * newlyStampedCount; // 通常のスタンプ報酬と同じ計算式に揃える
            trackMissionEvent('stampsThisWeek', newlyStampedCount); trackMissionEvent('stampsTotal', newlyStampedCount);
            currentStageIndex = finalIdx;
            currentStageProgress = 0;
            selectedStageIndex = finalIdx;
            stageArrivalTime = Date.now();
            closeModal('menu-modal');
            triggerAreaTransition(stages[finalIdx].bg, () => {
                updateDisplay(); saveGame();
                const stampBtn = document.getElementById('stamp-press-btn');
                if (stampBtn) stampBtn.style.display = 'none';
                showMochiComment(`${stages[finalIdx].name}到着！（管理者機能でジャンプしたで）`);
            });
        }

        // ===================================================================
        // 💼 おしごとミッション：進捗の記録・日/週の切り替え・受け取り処理
        // ===================================================================
        /**
         * 指定キーのミッションカウンターが存在すれば、値を加算する。
         * @param {string} key - missionCountersのキー
         * @param {number} [amount] - 加算する量（省略時は1）
         * @returns {void}
         */
        export function trackMissionEvent(key, amount) {
            if (missionCounters[key] === undefined) return;
            missionCounters[key] += (amount || 1);
        }
        /**
         * 日付からISO週番号ベースの「年-W週番号」文字列を生成する。
         * @param {Date} d - 対象の日付
         * @returns {string} 「年-W週番号」形式の文字列
         */
        export function getWeekKey(d) {
            // ISO週番号ベースの「年-週」文字列を作る（週の変わり目判定に使う）
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = (date.getUTCDay() + 6) % 7;
            date.setUTCDate(date.getUTCDate() - dayNum + 3);
            const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
            const weekNum = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
            return `${date.getUTCFullYear()}-W${weekNum}`;
        }
        /**
         * ミッションプールをシャッフルし、指定件数のミッションIDを抽出する。
         * @param {Array} pool - ミッション定義の配列
         * @param {number} count - 抽出する件数
         * @returns {Array} 抽出されたミッションIDの配列
         */
        export function pickRandomMissions(pool, count) {
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count).map(m => m.id);
        }
        // 日付・週が変わっていたら、カウンターとミッションの選び直しをする（ゲーム起動時に毎回呼ぶ）
        /**
         * 日付・週が変わっていれば、デイリー/ウィークリーのカウンターとミッションを選び直す。
         * @returns {void}
         */
        export function checkAndRotateMissions() {
            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);
            if (missionDailyDate !== todayStr) {
                missionDailyDate = todayStr;
                missionCounters.tapsToday = 0;
                missionCounters.minigamesToday = 0;
                missionCounters.omiyageBoughtToday = 0;
                missionCounters.skillUsedToday = 0;
                missionCounters.feedToday = 0;
                // 🔴 昨日までに受け取り済みだったデイリーミッションを、今日また挑戦できるようにする
                // （missionClaimedはミッションID単位のフラグなので、リセットしないと同じIDは二度と受け取れない）
                DAILY_MISSION_POOL.forEach(m => { delete missionClaimed[m.id]; });
                missionDailySelected = pickRandomMissions(DAILY_MISSION_POOL, DAILY_MISSION_COUNT);
                trackMissionEvent('loginDaysThisWeek', 1);
                // 「ログインする」は、日が変わった時点でその日ぶんは自動的に達成扱いにする
                missionCounters.loginToday = 1;
            }
            const weekKey = getWeekKey(now);
            if (missionWeeklyWeekKey !== weekKey) {
                missionWeeklyWeekKey = weekKey;
                missionCounters.tapsThisWeek = 0;
                missionCounters.stampsThisWeek = 0;
                missionCounters.jackpotsThisWeek = 0;
                missionCounters.minigamesThisWeek = 0;
                missionCounters.skillUsedThisWeek = 0;
                missionCounters.loginDaysThisWeek = 1; // 週の変わり目＝今日ログインした1日目
                // 🔴 デイリーと同様、週替わりで受け取り済みフラグをリセットする
                WEEKLY_MISSION_POOL.forEach(m => { delete missionClaimed[m.id]; });
                missionWeeklySelected = pickRandomMissions(WEEKLY_MISSION_POOL, WEEKLY_MISSION_COUNT);
            }
        }
        /**
         * チュートリアル・デイリー・ウィークリーの各ミッションプールから、指定IDのミッション定義を検索する。
         * @param {string} id - ミッションID
         * @returns {(Object|undefined)} 見つかったミッション定義
         */
        export function getMissionDef(id) {
            return TUTORIAL_MISSIONS.find(m => m.id === id) || DAILY_MISSION_POOL.find(m => m.id === id) || WEEKLY_MISSION_POOL.find(m => m.id === id);
        }
        /**
         * ミッションの現在の進捗数をmissionCountersから取得する。
         * @param {Object} mission - ミッション定義
         * @returns {number} 現在の進捗数
         */
        export function getMissionProgress(mission) {
            return missionCounters[mission.trackKey] || 0;
        }
        /**
         * ミッションの現在の進捗が目標値以上かどうかを判定する。
         * @param {Object} mission - ミッション定義
         * @returns {boolean} 達成済みならtrue
         */
        export function isMissionComplete(mission) {
            return getMissionProgress(mission) >= mission.target;
        }
        /**
         * 指定IDのミッションが未受け取りかつ達成済みであれば、報酬を受け取り済みにする。
         * @param {string} id - ミッションID
         * @returns {boolean} 受け取りに成功したらtrue
         */
        export function claimMission(id) {
            const mission = getMissionDef(id);
            if (!mission || missionClaimed[id] || !isMissionComplete(mission)) return false;
            missionClaimed[id] = true;
            gachaCoins += mission.reward;
            if (id.startsWith('tut_') && tutorialMissionStep < TUTORIAL_MISSIONS.length) tutorialMissionStep++;
            saveGame();
            return true;
        }



        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        /**
         * importした束縛collectedStampsを書き換えるsetter。
         * @param {Object} v - 新しいスタンプ帳データ（{ 都道府県のインデックス: true }）
         * @returns {void}
         */
        export function setCollectedStamps(v) { collectedStamps = v; }
        /**
         * importした束縛currentMyroomSlotIndexを書き換えるsetter。
         * @param {number} v - 新しい部屋スロットのインデックス
         * @returns {void}
         */
        export function setCurrentMyroomSlotIndex(v) { currentMyroomSlotIndex = v; }
        /**
         * importした束縛currentStageIndexを書き換えるsetter。
         * @param {number} v - 新しい現在ステージのインデックス
         * @returns {void}
         */
        export function setCurrentStageIndex(v) { currentStageIndex = v; }
        /**
         * importした束縛currentStageProgressを書き換えるsetter。
         * @param {number} v - 新しい現在ステージの進行度
         * @returns {void}
         */
        export function setCurrentStageProgress(v) { currentStageProgress = v; }
        /**
         * importした束縛equippedKisekaeを書き換えるsetter。
         * @param {Object} v - 新しい装着中の着せ替えアイテム構成
         * @returns {void}
         */
        export function setEquippedKisekae(v) { equippedKisekae = v; }
        /**
         * importした束縛equippedMyroomを書き換えるsetter。
         * @param {Object} v - 新しい配置中のマイルーム構成
         * @returns {void}
         */
        export function setEquippedMyroom(v) { equippedMyroom = v; }
        /**
         * importした束縛gachaCoinsを書き換えるsetter。
         * @param {number} v - 新しいガチャコイン所持数
         * @returns {void}
         */
        export function setGachaCoins(v) { gachaCoins = v; }
        /**
         * importした束縛hasSeenJapanClearを書き換えるsetter。
         * @param {boolean} v - 新しい日本制覇演出済みフラグ
         * @returns {void}
         */
        export function setHasSeenJapanClear(v) { hasSeenJapanClear = v; }
        /**
         * importした束縛missionClaimedを書き換えるsetter。
         * @param {Object} v - 新しい受け取り済みミッションの記録
         * @returns {void}
         */
        export function setMissionClaimed(v) { missionClaimed = v; }
        /**
         * importした束縛missionCountersを書き換えるsetter。
         * @param {Object} v - 新しいミッション進捗カウンター
         * @returns {void}
         */
        export function setMissionCounters(v) { missionCounters = v; }
        /**
         * importした束縛missionDailyDateを書き換えるsetter。
         * @param {string} v - 新しいデイリーリセット日付（YYYY-MM-DD）
         * @returns {void}
         */
        export function setMissionDailyDate(v) { missionDailyDate = v; }
        /**
         * importした束縛missionDailySelectedを書き換えるsetter。
         * @param {Array} v - 新しい今日のデイリーミッションID配列
         * @returns {void}
         */
        export function setMissionDailySelected(v) { missionDailySelected = v; }
        /**
         * importした束縛missionWeeklySelectedを書き換えるsetter。
         * @param {Array} v - 新しい今週のウィークリーミッションID配列
         * @returns {void}
         */
        export function setMissionWeeklySelected(v) { missionWeeklySelected = v; }
        /**
         * importした束縛missionWeeklyWeekKeyを書き換えるsetter。
         * @param {string} v - 新しいウィークリーリセット週キー（YYYY-Www）
         * @returns {void}
         */
        export function setMissionWeeklyWeekKey(v) { missionWeeklyWeekKey = v; }
        /**
         * importした束縛myroomSlotsを書き換えるsetter。
         * @param {Array} v - 新しいマイルームのスロット配列（最大3部屋）
         * @returns {void}
         */
        export function setMyroomSlots(v) { myroomSlots = v; }
        /**
         * importした束縛ownedKisekaeItemsを書き換えるsetter。
         * @param {Object} v - 新しい所持中の着せ替えアイテム構成
         * @returns {void}
         */
        export function setOwnedKisekaeItems(v) { ownedKisekaeItems = v; }
        /**
         * importした束縛ownedMyroomItemsを書き換えるsetter。
         * @param {Object} v - 新しい所持中のマイルームアイテム構成
         * @returns {void}
         */
        export function setOwnedMyroomItems(v) { ownedMyroomItems = v; }
        /**
         * importした束縛prefTapsを書き換えるsetter。
         * @param {Array} v - 新しい都道府県ごとの滞在中タップ数配列
         * @returns {void}
         */
        export function setPrefTaps(v) { prefTaps = v; }
        /**
         * importした束縛prestigeCountを書き換えるsetter。
         * @param {number} v - 新しい転生回数
         * @returns {void}
         */
        export function setPrestigeCount(v) { prestigeCount = v; }
        /**
         * importした束縛prestigePointsを書き換えるsetter。
         * @param {number} v - 新しい転生ポイント所持数
         * @returns {void}
         */
        export function setPrestigePoints(v) { prestigePoints = v; }
        /**
         * importした束縛prestigeScoreHistoryを書き換えるsetter。
         * @param {Array} v - 新しい各転生時のスコア履歴
         * @returns {void}
         */
        export function setPrestigeScoreHistory(v) { prestigeScoreHistory = v; }
        /**
         * importした束縛prestigeShopLvを書き換えるsetter。
         * @param {Object} v - 新しい転生ポイントショップの購入レベル構成
         * @returns {void}
         */
        export function setPrestigeShopLv(v) { prestigeShopLv = v; }
        /**
         * importした束縛previewKisekaeを書き換えるsetter。
         * @param {Object} v - 新しい試着中の着せ替え状態
         * @returns {void}
         */
        export function setPreviewKisekae(v) { previewKisekae = v; }
        /**
         * importした束縛selectedStageIndexを書き換えるsetter。
         * @param {number} v - 新しい選択中ステージのインデックス
         * @returns {void}
         */
        export function setSelectedStageIndex(v) { selectedStageIndex = v; }
        /**
         * importした束縛stampDebugIntervalを書き換えるsetter。
         * @param {*} v - 新しい診断パネルのインターバルID（setIntervalの戻り値、またはnull）
         * @returns {void}
         */
        export function setStampDebugInterval(v) { stampDebugInterval = v; }
        /**
         * importした束縛stampDebugModeを書き換えるsetter。
         * @param {boolean} v - 新しいスタンプ診断モードの有効状態
         * @returns {void}
         */
        export function setStampDebugMode(v) { stampDebugMode = v; }
        /**
         * importした束縛tutorialMissionStepを書き換えるsetter。
         * @param {number} v - 新しいチュートリアルミッションの進行ステップ番号
         * @returns {void}
         */
        export function setTutorialMissionStep(v) { tutorialMissionStep = v; }


        // window橋渡し：ここから下は、index.htmlのonclick=""（静的または動的に生成される
        // 文字列の両方）から直接呼ばれる関数を中心に、window経由のアクセスがまだ必要なものをまとめている。
        // ブラウザはonclick="foo()"の実行時にwindow.fooを探すため、橋渡しが無いとボタンを押しても
        // 静かに何も起きない（実際にこれで一度事故を起こした。解体新書 第9章参照）。削除する時は、
        // 他ファイルからのimport参照・index.html内の静的onclick・動的に組み立てられるonclick文字列の
        // 3経路すべてを確認すること。
        window.openPrestigeShop = openPrestigeShop;
        window.openPrestigeConfirm = openPrestigeConfirm;
        window.confirmCloseJapanClear = confirmCloseJapanClear;
        window.closeJapanClearAndExplainPrestige = closeJapanClearAndExplainPrestige;
        window.saveJapanClearImage = saveJapanClearImage;
        window.openDiaryForStamping = openDiaryForStamping;
        window.tapStampFrame = tapStampFrame;
