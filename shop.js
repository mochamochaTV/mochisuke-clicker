// 他ファイルへの依存はすべてこのimportに明示されている。書き換えが必要な値はsetXxx(...)という
// 関数呼び出しの形にしている（importした束縛には直接代入できないため。ESモジュールの仕様）。
import {
  GACHA_RARITIES, KISEKAE_ITEMS, MYROOM_CATEGORY_LABELS, MYROOM_ITEMS, MYROOM_WALL_ZONE_BOTTOM,
  NORMAL_CONSUMABLE_ITEMS, OMIYAGE_COLS, OMIYAGE_ROWS, SPRAY_ITEMS, clothesData, dialogueData,
  stages
} from './data.js?v=2026-09-09-003';
import {
  IS_DEV_MODE, formatMochi, isRunningStandalone, lazyLoadImage, pickRandom, playAudioFile,
  playBgmLoop, screenFlash, screenShake, vibrate
} from './main.js?v=2026-09-09-003';
import { minigamePlaysUsedToday } from './minigames.js?v=2026-09-09-003';
import {
  currentStageIndex, equippedMyroom, gachaCoins, getPrefTrophy, ownedKisekaeItems,
  ownedMyroomItems, prestigeShopLv, setGachaCoins, trackMissionEvent
} from './progress.js?v=2026-09-09-003';
import { saveGame, score, setScore } from './state.js?v=2026-09-09-003';
import { getMps, getTapPower, resetMochiFilter, skills } from './tap.js?v=2026-09-09-003';
import {
  closeModal, hasNewlyPurchasableOmiyage, hasNewlyPurchasableSkill, openModal, openMoveMenu,
  openTicketInventory, showMochiComment, updateDisplay
} from './ui.js?v=2026-09-09-003';

        // ===================================================================
        // 調整用の数値をまとめた設定オブジェクト。既に名前付きでexportされている
        // レート表（GACHA_RATE_TAB_LABELS等）やGACHA_COST_SINGLE等はそのまま。
        // ===================================================================
        const CONFIG = {
            // --- おみやげ価格計算 ---
            OMIYAGE_PRICE_DISCOUNT_PER_LEVEL: 0.02, // 転生ショップの割引レベル1につき何%割引くか
            OMIYAGE_PRICE_CURVE_BASE: 1.5,          // 値上がりカーブの基準倍率（べき乗の底の初期値）
            OMIYAGE_PRICE_CURVE_REDUCTION_PER_LEVEL: 0.01, // 転生ショップの値上がり緩和レベル1につき底をどれだけ下げるか

            // --- おみやげ棚UI ---
            OMIYAGE_SHELF_MAX_SAFE_CROP_RATIO: 0.16, // 横長画面で看板部分を安全に切り詰めてよい上限比率
            OMIYAGE_SHELF_SHAKE_STAGGER_S: 0.03,     // 棚切り替え時、スロットごとの揺れ開始をずらす間隔（秒）
            OMIYAGE_MONEY_FLASH_DURATION_MS: 1600,   // 「-〇〇もち」演出の表示時間
            OMIYAGE_MONEY_FLASH_OFFSET_X_PX: 4,      // 演出テキストの所持金表示からの横方向オフセット
            OMIYAGE_MONEY_FLASH_OFFSET_Y_PX: -14,    // 演出テキストの所持金表示からの縦方向オフセット
            GOLD_TROPHY_BONUS_MULT: 1.1,             // 金トロフィー獲得済み県のおみやげ効果倍率
            CONTRIBUTION_MIN_DISPLAY_PERCENT: 0.1,   // 全体貢献度がこの値未満なら「<0.1%」表示にする閾値

            // --- ショップ画面の暗転演出 ---
            SHOP_TRANSITION_MS: 300, // 開閉時、暗転してから中身を切り替えるまでの待ち時間
            SHOP_FADE_CLEAR_MS: 150, // 暗転を解除するまでの待ち時間

            // --- アイテムサムネイル ---
            ITEM_THUMB_DEFAULT_SIZE_PX: 48, // sizeが指定されない場合のデフォルトサイズ
            ITEM_THUMB_EMOJI_RATIO: 0.5,    // フォールバック絵文字のフォントサイズをサムネイルサイズの何倍にするか

            // --- ガチャ演出タイミング ---
            GACHA_CRANK_SPIN1_MS: 700,  // クランク演出①：ゆっくり1回転
            GACHA_CRANK_SPIN2_MS: 500,  // クランク演出②：やや速く2回転
            GACHA_CRANK_SPIN3_MS: 450,  // クランク演出③：最速3回転
            GACHA_CRANK_SHAKE_MS: 200,  // 演出②③で本体・レバーを揺らす1周期の長さ
            GACHA_CRANK_SHAKE_ITERATIONS: 3, // 揺れの繰り返し回数
            GACHA_VIBRATE_STAGE2: [15, 15, 15],       // クランク演出②の振動パターン
            GACHA_VIBRATE_STAGE3: [20, 20, 20, 20, 40], // クランク演出③の振動パターン
            GACHA_DROP_VIBRATE: [15, 30, 60],   // カプセル落下時の振動パターン
            GACHA_DROP_DURATION_MS: 500,        // カプセル落下アニメーションの長さ
            GACHA_PULSE_DURATION_MS: 800,       // タップ待ちカプセルの脈動アニメーション1周期
            GACHA_OPEN_VIBRATE: [10, 20, 10],   // カプセルが開く瞬間の振動パターン
            GACHA_OPEN_SPLIT_DURATION_MS: 500,  // カプセル上下パーツが飛び散るアニメーションの長さ
            GACHA_FLASH_ALPHA_STANDARD: 0.25,   // カプセル開封・10連終了時の画面フラッシュの濃さ
            GACHA_REVEAL_DELAY_MS: 320,         // カプセルが開いてから景品を表示するまでの間
            GACHA_PRIZE_NAME_BASE_REM: 1.15,    // 景品名テキストの基準フォントサイズ（rem）
            GACHA_PRIZE_REVEAL_DURATION_MS: 420, // 景品がせり出してくるアニメーションの長さ
            GACHA_PRIZE_TAP_GUARD_MS: 400,      // 誤タップで即閉じないよう、閉じる判定を有効にするまでの待ち時間
            GACHA_TEN_PULL_COUNT: 10,           // 10連ガチャの抽選回数
            GACHA_MULTI_DROP_VIBRATE: [12],     // 10連：カプセルを1個ずつ出す際の振動パターン
            GACHA_MULTI_DROP_DURATION_MS: 420,  // 10連：カプセルが1個落下するアニメーションの長さ
            GACHA_MULTI_FADE_DELAY_MS: 220,     // 10連：着地後、フェードアウトを始めるまでの待ち時間
            GACHA_MULTI_FADE_DURATION_MS: 260,  // 10連：カプセルがフェードアウトするアニメーションの長さ
            GACHA_SUMMARY_CAPSULE_PX: 130,      // 10連：一覧グリッドに並べるカプセル1個分のサイズ
            GACHA_MULTI_FLASH_SCALE: 0.6,       // 10連：1個ずつ開封時の画面フラッシュを1連より抑える倍率
            GACHA_MULTI_OPEN_DURATION_MS: 400,  // 10連：カプセルが開く演出の長さ
            GACHA_MULTI_OPEN_ICON_DELAY_MS: 120, // 10連：中身アイコンが出てくるまでの遅延
            GACHA_MULTI_OPEN_NEXT_DELAY_MS: 180, // 10連：次のカプセルの開封に進むまでの間
            GACHA_SPRAY_SPLIT_RATE: 0.5,        // ノーマルレア・レアで、衣装とスプレーを分ける割合
            GACHA_CRANK_MIN_WIDTH_PCT: 2,       // 開発用クランク位置調整ツールで許容する最小幅（%）

            // --- チケット効果 ---
            MOCHI_30MIN_TICKET_SECONDS: 1800, // 「30分ぶんもちチケット」が即座に付与する秒数

            // --- 家具プレビュー ---
            FURNITURE_PREVIEW_CENTER_PCT: 50,       // プレビュー時、画面中央とみなす基準位置（%）
            FURNITURE_PREVIEW_SNAP_EPSILON_PCT: 0.1 // 壁ゾーン下端にぴったり合わせる際の微調整量（%）
        };

        /**
         * 転生ショップの「おみやげ価格割引」レベルに応じた価格倍率（1未満）を計算する。
         * @returns {number} 価格にかける割引倍率
         */
        export function getOmiyagePriceMultiplier() { return 1 - prestigeShopLv.omiyagePriceDiscount * CONFIG.OMIYAGE_PRICE_DISCOUNT_PER_LEVEL; } // 価格そのものを割引
        /**
         * 転生ショップの「おみやげ値上がり緩和」レベルに応じた、レベルごとの価格上昇倍率（べき乗の底）を計算する。
         * @returns {number} べき乗計算に使う底の値
         */
        export function getOmiyagePriceCurveBase() { return CONFIG.OMIYAGE_PRICE_CURVE_BASE - prestigeShopLv.omiyagePriceCurve * CONFIG.OMIYAGE_PRICE_CURVE_REDUCTION_PER_LEVEL; }   // レベルごとの値上がり倍率
        /**
         * あるステージのおみやげについて、現在のレベルから次のレベルへ上げるのに必要な価格を計算する。
         * @param {Object} stage - 価格の基準となるステージデータ（price等を持つ）
         * @param {number} currentLv - 現在の購入レベル
         * @returns {number} 次のレベルに上げるのに必要な価格
         */
        export function getOmiyagePrice(stage, currentLv) {
            return Math.floor(stage.price * Math.pow(getOmiyagePriceCurveBase(), currentLv) * getOmiyagePriceMultiplier());
        }
        export let purchasedItems = {};
        export let purchasedClothes = { normal: true };
        export let equippedClotheId = "normal";
        export let currentShopTab = "omiyage";

        /**
         * 指定した衣装IDを現在の装備として反映し、見た目のフィルターをリセットして保存・画面更新する。
         * @param {string} id - 装備する衣装のID
         * @returns {void}
         */
        export function equipClothe(id) {
            equippedClotheId = id;
            resetMochiFilter();
            saveGame(); updateDisplay();
        }

        // 起動時に読み込まなくていい大きな画像（マップ・おみやげ屋の背景）は、実際に開いた時だけ読み込む
        /**
         * ショップモーダルを開く。画面を暗転させ、おみやげ屋背景の遅延読み込みと直前のタブ復元、ショップBGMへの切り替えを行う。
         * @returns {void}
         */
        export function openShop() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3'); // 県移動の時と同じ、移動音
            overlay.classList.add('fade-black');
            setTimeout(() => {
                lazyLoadImage('omiyage-shelf-img');
                openModal('shop-modal');
                switchShopTab(currentShopTab);
                updateShopTabHighlight();
                playBgmLoop('audio/bgm/bgm_shop.mp3'); // ショップ専用BGMに切り替え
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.SHOP_FADE_CLEAR_MS);
            }, CONFIG.SHOP_TRANSITION_MS);
        }
        /**
         * ショップモーダルを閉じる。画面を暗転させ、通常BGMに戻して移動メニューを開き直す。
         * @returns {void}
         */
        export function closeShop() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('shop-modal');
                playBgmLoop('audio/bgm/bgm.mp3'); // 通常のBGMに戻す
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.SHOP_FADE_CLEAR_MS);
            }, CONFIG.SHOP_TRANSITION_MS);
        }

        // ✖ボタンを廃止した代わりに、棚の背景(商品以外の場所)をタップすると詳細パネルを閉じるようにする
        document.addEventListener('DOMContentLoaded', () => {
            const shelfImg = document.getElementById('omiyage-shelf-img');
            if (shelfImg) shelfImg.addEventListener('click', () => { if (omiyageSelectedIdx != null) closeOmiyageDetail(); });
        });
        // お土産イラスト（stage.itemImg）表示用ヘルパー。未整備の県は🎁の絵文字にフォールバックする
        /**
         * ステージのお土産イラストがあればimgタグ、無ければ🎁絵文字のプレースホルダーHTMLを生成する。
         * @param {Object} stage - お土産情報を持つステージデータ
         * @param {number} [size] - サムネイルのサイズ（px）。省略時はデフォルトサイズを使う
         * @returns {string} 生成したHTML文字列
         */
        export function getItemThumbHtml(stage, size) {
            size = size || CONFIG.ITEM_THUMB_DEFAULT_SIZE_PX;
            if (stage.itemImg) {
                return `<img class="item-thumb" src="${stage.itemImg}" style="width:${size}px; height:${size}px;" alt="${stage.item}">`;
            }
            return `<div class="item-thumb" style="width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; font-size:${Math.floor(size * CONFIG.ITEM_THUMB_EMOJI_RATIO)}px; background:#fff8ec;">🎁</div>`;
        }

        /**
         * ショップの表示タブを切り替え、各タブのハイライトやおみやげ専用UIの表示状態を更新してリストを再描画する。
         * @param {string} tab - 切り替え先のタブ名（'omiyage'|'furniture'|'skills'|'gacha'）
         * @returns {void}
         */
        export function switchShopTab(tab) {
            currentShopTab = tab;
            updateShopTabHighlight();
            document.getElementById('shop-tab-omiyage').classList.toggle('tab-active', tab === 'omiyage');
            document.getElementById('shop-tab-furniture').classList.toggle('tab-active', tab === 'furniture');
            document.getElementById('shop-tab-skills').classList.toggle('tab-active', tab === 'skills');
            document.getElementById('shop-tab-gacha').classList.toggle('tab-active', tab === 'gacha');
            // 棚イラスト自体は常に全画面表示のまま。おみやげ以外のタブでは、上に半透明パネルを重ねるだけ。
            document.getElementById('omiyage-slots-layer').style.display = (tab === 'omiyage') ? 'block' : 'none';
            document.getElementById('omiyage-arrow-left').style.display = (tab === 'omiyage') ? 'flex' : 'none';
            document.getElementById('omiyage-arrow-right').style.display = (tab === 'omiyage') ? 'flex' : 'none';
            document.getElementById('omiyage-page-indicator').style.display = (tab === 'omiyage') ? 'block' : 'none';
            document.getElementById('shop-overlay-panel').classList.toggle('show', tab !== 'omiyage');
            if (tab !== 'omiyage') closeOmiyageDetail();
            renderShopList();
        }

        // 🎰 ガチャの演出本体：①3段階の回転（だんだん速く・揺れも強く）→②カプセル排出→③パカッと開いて中身が出る
        // 🎨 レア度ごとのカプセルの色（実際のイラストが無くても、同じ画像に色フィルターをかけて表現する）
        export let currentGachaRarity = null; // この回のレア度（色分けに使う）
        /**
         * GACHA_RARITIESの重み付きで1つのレア度オブジェクトを抽選して返す。
         * @returns {Object} 抽選されたレア度オブジェクト
         */
        export function pickGachaRarity() {
            const total = GACHA_RARITIES.reduce((s, r) => s + r.weight, 0);
            let roll = Math.random() * total;
            for (const r of GACHA_RARITIES) {
                if (roll < r.weight) return r;
                roll -= r.weight;
            }
            return GACHA_RARITIES[0];
        }

        // 🎰 3段階の回転演出（1連・10連で共通）：Promiseを返し、終わったら呼び出し側が次の処理に進める
        /**
         * ガチャクランクの3段階回転アニメーション（1連・10連で共通）を順番に再生する。
         * @returns {Promise<void>} 全段階のアニメーションが終わったら解決するPromise
         */
        export function playGachaCrankSequence() {
            const crank = document.getElementById('gacha-crank');
            playAudioFile('audio/gacha/crank.mp3');

            // ステージ①：ゆっくり1回転
            return crank.animate(
                [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
                { duration: CONFIG.GACHA_CRANK_SPIN1_MS, easing: 'ease-in' }
            ).finished.then(() => {
                // ステージ②：少し速く2回転、軽い振動
                screenShake('small');
                vibrate(CONFIG.GACHA_VIBRATE_STAGE2);
                return crank.animate(
                    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(720deg)' }],
                    { duration: CONFIG.GACHA_CRANK_SPIN2_MS, easing: 'linear' }
                ).finished;
            }).then(() => {
                // ステージ③：一番速く3回転、本体ごと揺れる
                playAudioFile('audio/gacha/crank.mp3');
                screenShake('big');
                vibrate(CONFIG.GACHA_VIBRATE_STAGE3);
                // 本体・レバー・カプセルをまとめている枠ごと揺らす（枠自体はtop/leftで位置決めしているため、
                // transformで揺らしても中央寄せなどとぶつからず安全）
                document.getElementById('gacha-illustration-wrap').animate(
                    [
                        { transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
                        { transform: 'translateX(4px)' }, { transform: 'translateX(-3px)' },
                        { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
                    ],
                    { duration: CONFIG.GACHA_CRANK_SHAKE_MS, iterations: CONFIG.GACHA_CRANK_SHAKE_ITERATIONS }
                );
                // レバーも本体と一緒に揺れる（回転アニメーションとぶつからないよう、加算合成で重ねる）
                crank.animate(
                    [
                        { transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
                        { transform: 'translateX(4px)' }, { transform: 'translateX(-3px)' },
                        { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
                    ],
                    { duration: CONFIG.GACHA_CRANK_SHAKE_MS, iterations: CONFIG.GACHA_CRANK_SHAKE_ITERATIONS, composite: 'add' }
                );
                return crank.animate(
                    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(1080deg)' }],
                    { duration: CONFIG.GACHA_CRANK_SPIN3_MS, easing: 'linear' }
                ).finished;
            });
        }

        /**
         * ガチャの「1回まわす」「10連まとめて」ボタンの有効/無効と見た目の透明度を一括で切り替える。
         * @param {boolean} disabled - trueならボタンを無効化する
         * @returns {void}
         */
        export function setGachaButtonsDisabled(disabled) {
            ['gacha-spin-btn', 'gacha-spin10-btn'].forEach(id => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.disabled = disabled;
                btn.style.opacity = disabled ? '0.5' : '1';
            });
        }

        // 🎁 ノーマル（灰）が出た時：3種類の消耗品からランダムに1つ選んで、その場で効果を発動する
        export let ticketInventory = { minigameTicket: 0, cooldownTicket: 0, mochi30minTicket: 0 }; // 🎫 ガチャで手に入れたチケットの所持数（すぐ使わず倉庫にためておける）
        export let sprayInventory = { spray_normalRare: 0, spray_rare: 0 }; // ✨ ガチャで手に入れたスプレーの所持数
        export let activeSprayId = null;    // 今かかっているスプレーのID
        export let sprayBuffActiveUntil = 0; // このタイムスタンプまで、自動増加バフ＋見た目エフェクトが有効
        export let favoriteFriendIds = []; // ⭐ お気に入りに登録したフレンドのuid一覧
        export let blockedUserIds = []; // 🚫 ブロックしたユーザーのuid一覧（この人からの招待・スタンプは今後無視する）

        /**
         * NORMAL_CONSUMABLE_ITEMSからランダムに1つ選び、所持数を1増やして保存・画面更新する。
         * @returns {Object} 選ばれた消耗品アイテムのデータ
         */
        export function grantRandomNormalConsumable() {
            const item = pickRandom(NORMAL_CONSUMABLE_ITEMS);
            ticketInventory[item.id] = (ticketInventory[item.id] || 0) + 1;
            saveGame(); updateDisplay();
            return item;
        }

        // 🎫 倉庫にためたチケットを、好きなタイミングで実際に使う
        /**
         * 所持しているチケットを1個消費し、対応する効果を即座に発動してから在庫を減らす。
         * @param {string} itemId - 使用するチケットのID（'minigameTicket'|'cooldownTicket'|'mochi30minTicket'）
         * @returns {void}
         */
        export function useTicket(itemId) {
            if ((ticketInventory[itemId] || 0) <= 0) return;
            if (itemId === 'minigameTicket') {
                Object.keys(minigamePlaysUsedToday).forEach(k => {
                    minigamePlaysUsedToday[k] = Math.max(0, (minigamePlaysUsedToday[k] || 0) - 1);
                });
            } else if (itemId === 'cooldownTicket') {
                Object.keys(skills).forEach(k => { skills[k].currentCd = 0; });
            } else if (itemId === 'mochi30minTicket') {
                setScore(score + (getMps() * CONFIG.MOCHI_30MIN_TICKET_SECONDS)); // 30分ぶんの自動増加を即座に付与
            }
            ticketInventory[itemId]--;
            saveGame(); updateDisplay();
            openTicketInventory(); // 一覧を開いている場合、個数表示を更新する
        }
        window.useTicket = useTicket; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * ガチャ画面上部のコイン枚数表示を更新する（開発モードなら∞表示）。
         * @returns {void}
         */
        export function updateGachaCoinDisplay() {
            const el = document.getElementById('gacha-coin-value');
            if (el) el.innerText = IS_DEV_MODE ? '∞' : formatMochi(gachaCoins);
        }

        /**
         * 排出率一覧オーバーレイの表示/非表示を切り替え、表示時はレア度一覧とアイテム別排出率タブを描画する。
         * @returns {void}
         */
        export function toggleGachaRatesOverlay() {
            const overlay = document.getElementById('gacha-rates-overlay');
            if (!overlay) return;
            const showing = overlay.style.display === 'block';
            if (showing) { overlay.style.display = 'none'; return; }

            const listEl = document.getElementById('gacha-rates-list');
            listEl.innerHTML = GACHA_RARITIES.map(r => `
                <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #eee;">
                    <div style="width:14px; height:14px; border-radius:50%; background:${r.color}; flex-shrink:0; box-shadow:0 0 0 2px #fff, 0 0 0 3px ${r.color};"></div>
                    <div style="flex:1;">
                        <div style="font-weight:900; color:${r.color};">${r.label}　<span style="color:#5d4037;">${r.weight}%</span></div>
                        <div style="font-size:0.72rem; color:#8d6e63;">${r.desc}</div>
                    </div>
                </div>
            `).join('');
            renderGachaRateTabs();
            overlay.style.display = 'block';
        }
        window.toggleGachaRatesOverlay = toggleGachaRatesOverlay; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        // 🎁 レア度ごとに、実際に排出されるアイテムと確率を一覧表示する
        export const GACHA_RATE_TAB_LABELS = { normal: 'ノーマル', normalRare: 'ノーマルレア', rare: 'レア', sr: 'スーパーレア', ur: 'ウルトラレア' };
        export let currentGachaRateTab = 'normal';
        /**
         * レア度カテゴリごとのタブボタンをGACHA_RATE_TAB_LABELSから生成し、現在選択中タブの内容を描画する。
         * @returns {void}
         */
        export function renderGachaRateTabs() {
            const tabsEl = document.getElementById('gacha-rate-tabs');
            tabsEl.innerHTML = Object.keys(GACHA_RATE_TAB_LABELS).map(id => {
                const rarity = GACHA_RARITIES.find(r => r.id === id);
                const active = currentGachaRateTab === id;
                return `<button onclick="switchGachaRateTab('${id}')" style="flex:1; min-width:70px; padding:6px 4px; border-radius:10px; border:2px solid ${active ? rarity.color : '#ddd'}; background:${active ? rarity.color : '#fff'}; color:${active ? '#fff' : '#5d4037'}; font-weight:900; font-size:0.68rem;">${GACHA_RATE_TAB_LABELS[id]}</button>`;
            }).join('');
            switchGachaRateTab(currentGachaRateTab);
        }
        /**
         * 指定したレア度タブに切り替え、そのレア度で実際に出るアイテムと排出率を計算して一覧表示する。
         * @param {string} tabId - 切り替え先のレア度タブID
         * @returns {void}
         */
        export function switchGachaRateTab(tabId) {
            currentGachaRateTab = tabId;
            const tabsEl = document.getElementById('gacha-rate-tabs');
            [...tabsEl.children].forEach((btn, i) => {
                const id = Object.keys(GACHA_RATE_TAB_LABELS)[i];
                const rarity = GACHA_RARITIES.find(r => r.id === id);
                const active = id === tabId;
                btn.style.border = `2px solid ${active ? rarity.color : '#ddd'}`;
                btn.style.background = active ? rarity.color : '#fff';
                btn.style.color = active ? '#fff' : '#5d4037';
            });
            const rarity = GACHA_RARITIES.find(r => r.id === tabId);
            const listEl = document.getElementById('gacha-item-rate-list');
            let rows = [];
            if (tabId === 'normal') {
                const per = (rarity.weight / NORMAL_CONSUMABLE_ITEMS.length).toFixed(2);
                rows = NORMAL_CONSUMABLE_ITEMS.map(item => ({ img: item.img, name: item.name, rate: per }));
            } else if (tabId === 'sr' || tabId === 'ur') {
                const star = { sr: 3, ur: 4 }[tabId];
                const pool = getKisekaeItemsByStar(star);
                const per = (rarity.weight / pool.length).toFixed(2);
                rows = pool.map(item => ({ img: item.img || (item.leftFrames ? item.leftFrames[0] : ''), name: item.name, rate: per }));
            } else {
                // normalRare / rare：衣装とスプレーが半々
                const star = { normalRare: 1, rare: 2 }[tabId];
                const pool = getKisekaeItemsByStar(star);
                const sprayItem = SPRAY_ITEMS.find(i => i.star === star);
                const costumeRate = (rarity.weight * CONFIG.GACHA_SPRAY_SPLIT_RATE / pool.length).toFixed(2);
                rows = pool.map(item => ({ img: item.img || (item.leftFrames ? item.leftFrames[0] : ''), name: item.name, rate: costumeRate }));
                if (sprayItem) {
                    const emoji = sprayItem.effectId === 'sparkle' ? '✨' : '🌟';
                    rows.push({ emoji, name: sprayItem.name, rate: (rarity.weight * CONFIG.GACHA_SPRAY_SPLIT_RATE).toFixed(2) });
                }
            }
            listEl.innerHTML = rows.map(row => `
                <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #f0f0f0;">
                    ${row.img ? `<img src="${row.img}" style="width:36px; height:36px; object-fit:contain; flex-shrink:0;">` : `<div style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">${row.emoji}</div>`}
                    <div style="flex:1;">
                        <div style="font-size:0.78rem; color:#5d4037; font-weight:700;">${row.name}</div>
                        <div style="font-size:0.68rem; color:#e91e63; font-weight:900;">${row.rate}%</div>
                    </div>
                </div>
            `).join('');
        }
        window.switchGachaRateTab = switchGachaRateTab; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        // ===== 1連：カプセルが落ちてきて、タップすると開く =====
        export const GACHA_COST_SINGLE = 10;
        export const GACHA_COST_TEN = 90; // 1回x10より少しお得な価格設定

        export let pendingGachaResult = null; // 🐛修正：コイン消費と同時に確定させ、演出中に中断されてもコインだけ失うことが無いようにする
        /**
         * ガチャ1回分の開始処理。コイン残高チェックと消費、レア度抽選、景品の確定・付与、保存を行い、演出を開始する。
         * @returns {void}
         */
        export function startGachaSpin() {
            const spinBtn = document.getElementById('gacha-spin-btn');
            if (spinBtn.disabled) return;
            if (!IS_DEV_MODE && gachaCoins < GACHA_COST_SINGLE) {
                alert(`🎰 ガチャコインが足りません（あと${GACHA_COST_SINGLE - gachaCoins}枚必要です）\n\nステージクリア（スタンプ）やおしごとミッションのクリア、日本制覇・転生でも手に入ります！`);
                return;
            }
            if (!IS_DEV_MODE) setGachaCoins(gachaCoins - (GACHA_COST_SINGLE));
            trackMissionEvent('gachaSpinsToday', 1); trackMissionEvent('gachaSpinsThisWeek', 1);

            currentGachaRarity = pickGachaRarity(); // 🎨 この回で出るレア度を先に決めておく（カプセルの色に反映する）
            pendingGachaResult = grantGachaPrizeForRarity(currentGachaRarity); // 🐛修正：景品もこの時点で確定・付与してしまう
            saveGame(); // コイン消費と景品付与を同時に保存する（演出は見た目だけ、後から再生する）
            updateGachaCoinDisplay();
            setGachaButtonsDisabled(true);

            const capsuleWrap = document.getElementById('gacha-capsule-wrap');
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            const capsuleTop = document.getElementById('gacha-capsule-top');
            const capsuleBottom = document.getElementById('gacha-capsule-bottom');
            const prizeReveal = document.getElementById('gacha-prize-reveal');

            // リセット（2回目以降のために）：前回のアニメーションが終了状態を保持し続けているため、まず打ち切る
            [capsuleWrap, capsuleWhole, capsuleTop, capsuleBottom, prizeReveal].forEach(el => {
                el.getAnimations().forEach(a => a.cancel());
            });
            document.getElementById('gacha-multi-panel').style.display = 'none';
            capsuleWrap.style.display = 'block';
            capsuleWrap.style.transform = 'translate(-50%, -50%) scale(0)';
            capsuleWhole.style.display = 'block';
            capsuleWhole.style.filter = 'none';
            capsuleTop.style.display = 'none';
            capsuleBottom.style.display = 'none';
            capsuleTop.style.opacity = '1'; capsuleBottom.style.opacity = '1';
            prizeReveal.style.opacity = '0';
            prizeReveal.style.transform = 'translate(-50%,-50%) scale(0)';

            playGachaCrankSequence().then(() => {
                document.getElementById('gacha-reveal-fullscreen').style.display = 'flex';
                document.getElementById('gacha-reveal-single').style.display = 'flex';
                dropGachaCapsule();
            });
        }
        window.startGachaSpin = startGachaSpin; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 確定済みレア度の色フィルターをカプセルに適用し、跳ねながら落下するアニメーションを再生してタップ待ちにする。
         * @returns {void}
         */
        export function dropGachaCapsule() {
            const capsuleWrap = document.getElementById('gacha-capsule-wrap');
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            const capsuleTop = document.getElementById('gacha-capsule-top');
            const capsuleBottom = document.getElementById('gacha-capsule-bottom');
            capsuleWhole.style.filter = currentGachaRarity.filter;
            capsuleTop.style.filter = currentGachaRarity.filter;
            capsuleBottom.style.filter = currentGachaRarity.filter;

            playAudioFile('audio/gacha/drop.mp3');
            vibrate(CONFIG.GACHA_DROP_VIBRATE);
            capsuleWrap.animate(
                [
                    { transform: 'translate(-50%, calc(-50% - 60px)) scale(0)', offset: 0 },
                    { transform: 'translate(-50%, calc(-50% + 16px)) scale(1.1)', offset: 0.6 },
                    { transform: 'translate(-50%, calc(-50% - 8px)) scale(0.95)', offset: 0.82 },
                    { transform: 'translate(-50%, -50%) scale(1)', offset: 1 },
                ],
                { duration: CONFIG.GACHA_DROP_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
            ).finished.then(() => {
                capsuleWrap.style.transform = 'translate(-50%, -50%) scale(1)';
                enableGachaCapsuleTapToOpen();
            });
        }

        // 🫳 落ちたカプセルは自動で開かず、プレイヤーがタップした時に開く
        /**
         * 落下し終えたカプセルにパルスアニメーションを付けてタップ可能にし、タップされたらopenGachaCapsule()を呼ぶ。
         * @returns {void}
         */
        export function enableGachaCapsuleTapToOpen() {
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            capsuleWhole.style.pointerEvents = 'auto';
            capsuleWhole.style.cursor = 'pointer';
            const pulse = capsuleWhole.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
                { duration: CONFIG.GACHA_PULSE_DURATION_MS, iterations: Infinity }
            );
            capsuleWhole.onclick = () => {
                capsuleWhole.onclick = null;
                capsuleWhole.style.pointerEvents = 'none';
                pulse.cancel();
                openGachaCapsule();
            };
        }

        /**
         * カプセルが上下にパカッと割れて開く演出（効果音・振動・画面フラッシュ・飛散アニメーション）を再生し、景品表示を予約する。
         * @returns {void}
         */
        export function openGachaCapsule() {
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            const capsuleTop = document.getElementById('gacha-capsule-top');
            const capsuleBottom = document.getElementById('gacha-capsule-bottom');
            playAudioFile('audio/gacha/open.mp3');
            vibrate(CONFIG.GACHA_OPEN_VIBRATE);
            screenFlash('#ffffff', CONFIG.GACHA_FLASH_ALPHA_STANDARD);

            capsuleWhole.style.display = 'none';
            capsuleTop.style.display = 'block';
            capsuleBottom.style.display = 'block';

            capsuleTop.animate(
                [{ transform: 'translateY(-10px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(-140px) rotate(-35deg)', opacity: 0 }],
                { duration: CONFIG.GACHA_OPEN_SPLIT_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
            );
            capsuleBottom.animate(
                [{ transform: 'translateY(10px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(110px) rotate(28deg)', opacity: 0 }],
                { duration: CONFIG.GACHA_OPEN_SPLIT_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
            );

            setTimeout(revealGachaPrize, CONFIG.GACHA_REVEAL_DELAY_MS);
        }

        // 🎰 ガチャ：星ランク別のアイテムプールを取得し、1つ抽選して付与する
        /**
         * 帽子・顔・服・背中・フルボディの各カテゴリから、指定★ランクに一致するアイテムのプールを集めて返す。
         * @param {number} star - 対象の星ランク
         * @returns {Array<Object>} 条件に一致するアイテムの配列
         */
        export function getKisekaeItemsByStar(star) {
            const pool = [];
            ['hat', 'face', 'clothes', 'back', 'fullbody'].forEach(cat => {
                KISEKAE_ITEMS[cat].forEach(item => {
                    if (item.star === star && item.id !== 'clothes_mochisuke_tshirt') pool.push({ ...item, category: cat });
                });
            });
            return pool;
        }
        export const DUPLICATE_REFUND_BY_STAR = { 1: 3, 2: 8, 3: 20, 4: 50 }; // 重複時は、レア度に応じてガチャコインを還元する
        // ✨ ノーマルレア・レアだけ、衣装かスプレーかを半々で抽選する（スーパーレア・ウルトラレアは衣装のみ）
        /**
         * ノーマルレア・レア排出時、該当★のスプレーがあれば一定確率でスプレーを付与し、それ以外は衣装抽選に回す。
         * @param {number} star - 対象の星ランク
         * @returns {Object} 付与結果（item, isSpray, isDuplicate, refundCoinsを含む）
         */
        export function grantGachaNormalRareOrRareReward(star) {
            const sprayItem = SPRAY_ITEMS.find(i => i.star === star);
            if (sprayItem && Math.random() < CONFIG.GACHA_SPRAY_SPLIT_RATE) {
                sprayInventory[sprayItem.id] = (sprayInventory[sprayItem.id] || 0) + 1;
                return { item: sprayItem, isSpray: true, isDuplicate: false, refundCoins: 0 };
            }
            return grantGachaKisekaeItem(star);
        }
        /**
         * 指定★の衣装プールから未所持優先で1つ抽選して付与し、重複時は星ランクに応じたコインを還元する。
         * @param {number} star - 対象の星ランク
         * @returns {Object} 付与結果（item, isDuplicate, refundCoinsを含む）
         */
        export function grantGachaKisekaeItem(star) {
            const pool = getKisekaeItemsByStar(star);
            const notOwned = pool.filter(item => !(ownedKisekaeItems[item.category] || []).includes(item.id));
            const candidates = notOwned.length > 0 ? notOwned : pool; // 全部持っていたら重複当選になる
            const picked = pickRandom(candidates);
            if (!ownedKisekaeItems[picked.category]) ownedKisekaeItems[picked.category] = [];
            const isDuplicate = ownedKisekaeItems[picked.category].includes(picked.id);
            let refundCoins = 0;
            if (!isDuplicate) {
                ownedKisekaeItems[picked.category].push(picked.id);
            } else {
                refundCoins = DUPLICATE_REFUND_BY_STAR[star] || 0;
                setGachaCoins(gachaCoins + (refundCoins));
            }
            return { item: picked, isDuplicate, refundCoins };
        }
        // 🎰 レア度から、実際の景品を確定・付与する（コイン消費と同時に呼ぶ）
        /**
         * 抽選で決まったレア度オブジェクトから、実際の景品（消耗品または衣装/スプレー）を確定・付与する。
         * @param {Object} rarity - 抽選されたレア度オブジェクト
         * @returns {Object|null} 付与結果をkind付きでまとめたオブジェクト（該当なしならnull）
         */
        export function grantGachaPrizeForRarity(rarity) {
            if (rarity.id === 'normal') {
                return { kind: 'normal', item: grantRandomNormalConsumable() };
            } else if (['normalRare', 'rare', 'sr', 'ur'].includes(rarity.id)) {
                const starMap = { normalRare: 1, rare: 2, sr: 3, ur: 4 };
                const useSprayPool = ['normalRare', 'rare'].includes(rarity.id);
                const result = useSprayPool ? grantGachaNormalRareOrRareReward(starMap[rarity.id]) : grantGachaKisekaeItem(starMap[rarity.id]);
                return { kind: 'kisekae', result };
            }
            return null;
        }
        /**
         * 確定済みのpendingGachaResultを読み出して景品名・画像・レア度演出（グロー・後光・フラッシュ・振動）を表示する。
         * @returns {void}
         */
        export function revealGachaPrize() {
            const prizeReveal = document.getElementById('gacha-prize-reveal');
            const prizeImg = document.getElementById('gacha-prize-img');
            const prizeName = document.getElementById('gacha-prize-name');
            const flair = currentGachaRarity.flair;
            const sparkle = flair.rays ? '✨ ' : '';
            const rarityTag = `<span style="color:${currentGachaRarity.color}; text-shadow:0 1px 2px rgba(0,0,0,0.4);">【${sparkle}${currentGachaRarity.label}${sparkle}】</span><br>`;

            // 🐛修正：景品は既にstartGachaSpinの時点で確定・保存済み。ここでは表示するだけ（再抽選しない）
            const pending = pendingGachaResult;
            if (pending && pending.kind === 'normal') {
                const item = pending.item;
                prizeImg.src = item.img;
                prizeImg.style.display = 'block';
                prizeName.innerHTML = `${rarityTag}${item.name}`;
            } else if (pending && pending.kind === 'kisekae') {
                const result = pending.result;
                const starText = '⭐'.repeat(result.item.star);
                if (result.isSpray) {
                    prizeImg.style.display = 'none';
                    const emoji = result.item.effectId === 'sparkle' ? '✨' : '🌟';
                    prizeName.innerHTML = `${rarityTag}<div style="font-size:2.5rem;">${emoji}</div>${result.item.name}<br><span style="font-size:0.7em;">${starText}</span>`;
                } else {
                    prizeImg.src = result.item.img || (result.item.leftFrames ? result.item.leftFrames[0] : '');
                    prizeImg.style.display = 'block';
                    const dupText = result.isDuplicate ? `<br><span style="font-size:0.7em; color:#999;">（すでに持っています・🪙${result.refundCoins}還元）</span>` : '';
                    prizeName.innerHTML = `${rarityTag}${result.item.name}<br><span style="font-size:0.7em;">${starText}</span>${dupText}`;
                }
            }
            updateDisplay();

            // 🌟 レア度が高いほど、グロー・フラッシュ・振動・文字の大きさが豪華になる
            prizeImg.style.filter = `drop-shadow(0 4px 10px rgba(0,0,0,0.4)) drop-shadow(0 0 ${flair.glow}px ${currentGachaRarity.color})`;
            prizeName.style.fontSize = `${(CONFIG.GACHA_PRIZE_NAME_BASE_REM * flair.nameScale).toFixed(2)}rem`;
            let raysHtml = '';
            if (flair.rays) {
                raysHtml = `<div id="gacha-prize-rays" style="position:absolute; top:50%; left:50%; width:340px; height:340px; transform:translate(-50%,-50%);
                    background:conic-gradient(from 0deg, transparent 0deg, ${currentGachaRarity.color}55 8deg, transparent 16deg, transparent 40deg, ${currentGachaRarity.color}55 48deg, transparent 56deg, transparent 80deg, ${currentGachaRarity.color}55 88deg, transparent 96deg, transparent 120deg, ${currentGachaRarity.color}55 128deg, transparent 136deg, transparent 160deg, ${currentGachaRarity.color}55 168deg, transparent 176deg, transparent 200deg, ${currentGachaRarity.color}55 208deg, transparent 216deg, transparent 240deg, ${currentGachaRarity.color}55 248deg, transparent 256deg, transparent 280deg, ${currentGachaRarity.color}55 288deg, transparent 296deg, transparent 320deg, ${currentGachaRarity.color}55 328deg, transparent 336deg);
                    animation: gachaRaysSpin 6s linear infinite; border-radius:50%;"></div>`;
            }
            const oldRays = document.getElementById('gacha-prize-rays');
            if (oldRays) oldRays.remove();
            if (raysHtml) prizeReveal.insertAdjacentHTML('afterbegin', raysHtml);

            playAudioFile('audio/levelup.mp3');
            screenFlash('#ffd700', flair.flash);
            vibrate(flair.vibrate);

            prizeReveal.animate(
                [
                    { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
                    { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 1, offset: 0.7 },
                    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                ],
                { duration: CONFIG.GACHA_PRIZE_REVEAL_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
            );

            setGachaButtonsDisabled(false);

            // タップで結果画面を閉じて、通常のガチャ画面に戻る
            const fullscreen = document.getElementById('gacha-reveal-fullscreen');
            const closeOnTap = () => {
                fullscreen.removeEventListener('click', closeOnTap);
                fullscreen.style.display = 'none';
                document.getElementById('gacha-reveal-single').style.display = 'none';
            };
            setTimeout(() => fullscreen.addEventListener('click', closeOnTap), CONFIG.GACHA_PRIZE_TAP_GUARD_MS); // 出た瞬間の誤タップで即閉じないよう少し待つ
        }

        // ===== 10連：レバーは1回、カプセル10個が続けて出て、全部落ちてから順番にパカパカ開いていく =====
        export let pendingGachaResults10 = null; // 🐛修正：10連分も、コイン消費と同時に確定させる
        /**
         * ガチャ10連の開始処理。コイン残高チェックと消費、10回分のレア度抽選・景品確定・保存を行い、演出を開始する。
         * @returns {void}
         */
        export function startGachaSpin10() {
            const spin10Btn = document.getElementById('gacha-spin10-btn');
            if (spin10Btn.disabled) return;
            if (!IS_DEV_MODE && gachaCoins < GACHA_COST_TEN) {
                alert(`🎰 ガチャコインが足りません（あと${GACHA_COST_TEN - gachaCoins}枚必要です）\n\nステージクリア（スタンプ）やおしごとミッションのクリア、日本制覇・転生でも手に入ります！`);
                return;
            }
            if (!IS_DEV_MODE) setGachaCoins(gachaCoins - (GACHA_COST_TEN));
            trackMissionEvent('gachaSpinsToday', 1); trackMissionEvent('gachaSpinsThisWeek', 1);
            const rarities10 = [];
            for (let i = 0; i < CONFIG.GACHA_TEN_PULL_COUNT; i++) rarities10.push(pickGachaRarity());
            pendingGachaResults10 = rarities10.map(r => grantGachaPrizeForRarity(r)); // 🐛修正：この時点で10個分すべて確定・付与する
            saveGame(); // コイン消費と10個分の景品、全部同時に保存する
            updateGachaCoinDisplay();
            setGachaButtonsDisabled(true);

            document.getElementById('gacha-prize-reveal').getAnimations().forEach(a => a.cancel());
            document.getElementById('gacha-prize-reveal').style.opacity = '0';
            document.getElementById('gacha-multi-grid').innerHTML = '';
            document.getElementById('gacha-multi-panel').style.display = 'none';
            document.getElementById('gacha-capsule-wrap-mini').getAnimations().forEach(a => a.cancel());
            document.getElementById('gacha-capsule-wrap-mini').style.display = 'none';
            document.getElementById('gacha-capsule-wrap-mini').style.transform = 'translate(-50%, 0) scale(0)';
            const oldPrompt = document.getElementById('gacha10-finish-prompt');
            if (oldPrompt) oldPrompt.remove();
            const oldHint = document.getElementById('gacha-tap-hint');
            if (oldHint) oldHint.remove();

            playGachaCrankSequence().then(() => {
                dropGachaCapsuleOneByOne(rarities10, 0);
            });
        }
        window.startGachaSpin10 = startGachaSpin10; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        // 🔴 10連のカプセルは、まず機体の小さな絵の上（1連と同じ場所）に1個ずつ出す。前のカプセルが残っていると
        // 次と重なって邪魔になるため、バウンドして着地した後、少し間を置いてフェードアウトしてから次に道を譲る。
        // 全部出し終わってから、初めて全画面の演出に切り替える。
        /**
         * 10連分のカプセルを機体上の同じ場所に1個ずつ順番に落として見せ、全部出し終えたら一覧グリッド表示へ切り替える。
         * @param {Array<Object>} rarities - 10連分のレア度オブジェクト配列
         * @param {number} index - 現在処理中のカプセルのインデックス
         * @returns {void}
         */
        export function dropGachaCapsuleOneByOne(rarities, index) {
            if (index >= rarities.length) {
                document.getElementById('gacha-reveal-fullscreen').style.display = 'flex';
                showGacha10SummaryGrid(rarities);
                return;
            }
            const capsuleWrap = document.getElementById('gacha-capsule-wrap-mini');
            const capsuleImg = capsuleWrap.querySelector('img');
            capsuleWrap.getAnimations().forEach(a => a.cancel());
            capsuleImg.style.filter = rarities[index].filter;
            capsuleWrap.style.display = 'block';

            playAudioFile('audio/gacha/drop.mp3');
            vibrate(CONFIG.GACHA_MULTI_DROP_VIBRATE);
            capsuleWrap.animate(
                [
                    { transform: 'translate(-50%, -40px) scale(0)', opacity: 1, offset: 0 },
                    { transform: 'translate(-50%, 12px) scale(1.1)', opacity: 1, offset: 0.6 },
                    { transform: 'translate(-50%, -6px) scale(0.95)', opacity: 1, offset: 0.82 },
                    { transform: 'translate(-50%, 0px) scale(1)', opacity: 1, offset: 1 },
                ],
                { duration: CONFIG.GACHA_MULTI_DROP_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
            ).finished.then(() => {
                // 少し見せてから、次のカプセルに道を譲るためフェードアウト
                setTimeout(() => {
                    capsuleWrap.animate(
                        [
                            { transform: 'translate(-50%, 0px) scale(1)', opacity: 1 },
                            { transform: 'translate(-50%, -14px) scale(0.7)', opacity: 0 },
                        ],
                        { duration: CONFIG.GACHA_MULTI_FADE_DURATION_MS, easing: 'ease-in', fill: 'forwards' }
                    ).finished.then(() => {
                        dropGachaCapsuleOneByOne(rarities, index + 1);
                    });
                }, CONFIG.GACHA_MULTI_FADE_DELAY_MS);
            });
        }

        // 🔴 10個出し終わったら、まとめて表示。画面をタップすると、1個ずつ自動で開いていく
        /**
         * 10個のカプセル（未開封状態）をグリッドで並べて表示し、タップされたら1個ずつ順番に開封する処理を仕込む。
         * @param {Array<Object>} rarities - 10連分のレア度オブジェクト配列
         * @returns {void}
         */
        export function showGacha10SummaryGrid(rarities) {
            document.getElementById('gacha-capsule-wrap-mini').getAnimations().forEach(a => a.cancel());
            document.getElementById('gacha-capsule-wrap-mini').style.display = 'none';

            const panel = document.getElementById('gacha-multi-panel');
            const grid = document.getElementById('gacha-multi-grid');
            grid.innerHTML = '';
            panel.style.display = 'block';

            const CAPSULE_PX = CONFIG.GACHA_SUMMARY_CAPSULE_PX;
            const capsuleSets = [], iconEls = [];
            rarities.forEach((r) => {
                const cell = document.createElement('div');
                cell.style.cssText = `position:relative; width:${CAPSULE_PX}px; height:${CAPSULE_PX}px; display:flex; align-items:center; justify-content:center;`;

                const whole = document.createElement('img');
                whole.src = 'ui_images/gacha/capsule.webp';
                whole.style.cssText = `position:absolute; width:100%; display:block; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35)) ${r.filter};`;

                const top = document.createElement('img');
                top.src = 'ui_images/gacha/capsule_top.webp';
                top.style.cssText = `position:absolute; width:100%; display:none; filter:${r.filter};`;

                const bottom = document.createElement('img');
                bottom.src = 'ui_images/gacha/capsule_bottom.webp';
                bottom.style.cssText = `position:absolute; width:100%; display:none; filter:${r.filter};`;

                const icon = document.createElement('div');
                icon.style.cssText = 'position:absolute; width:100%; text-align:center; opacity:0; transform:scale(0.5);';
                icon.innerHTML = `<div style="font-size:3rem;">🍡</div><div style="display:inline-block; font-size:0.78rem; font-weight:900; color:#fff; background:${r.color}; padding:2px 10px; border-radius:10px; margin-top:2px; box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`;

                cell.appendChild(whole); cell.appendChild(top); cell.appendChild(bottom); cell.appendChild(icon);
                grid.appendChild(cell);
                capsuleSets.push({ whole, top, bottom, cell }); iconEls.push(icon);
            });

            panel.style.pointerEvents = 'auto'; // 念のため明示的に有効化（他の要素の影響でクリックが効かなくなる事故を防ぐ）

            const tapHint = document.createElement('p');
            tapHint.id = 'gacha-tap-hint';
            tapHint.style.cssText = 'text-align:center; font-size:0.9rem; color:#fff; font-weight:bold; margin:2px 0 10px; text-shadow:0 2px 4px rgba(0,0,0,0.5); animation: gachaTapHintPulse 1s ease-in-out infinite;';
            tapHint.innerText = '👆 画面をタップして開封！';
            panel.insertBefore(tapHint, grid);

            let hasOpened = false; // 二重発火防止（パネルとステージ両方にリスナーを付けるため）
            const openHandler = (e) => {
                if (hasOpened) return;
                if (e && e.target && e.target.closest && e.target.closest('button')) return; // 「？」ボタンなどのタップは対象外
                hasOpened = true;
                panel.removeEventListener('click', openHandler);
                document.getElementById('gacha-stage').removeEventListener('click', openHandler);
                tapHint.remove();
                openGacha10CapsulesSequentially(capsuleSets, iconEls, rarities, 0);
            };
            panel.addEventListener('click', openHandler);
            document.getElementById('gacha-stage').addEventListener('click', openHandler); // 保険として、ステージ全体でも拾う
        }

        /**
         * グリッド内のカプセルを1個ずつ、確定済みの景品を表示しながら開封演出し、自分自身を再帰呼び出しして次へ進める。
         * @param {Array<Object>} capsuleSets - 各カプセルのDOM要素セット（whole/top/bottom/cell）の配列
         * @param {Array<HTMLElement>} iconEls - 各カプセルの中身アイコン表示用要素の配列
         * @param {Array<Object>} rarities - 10連分のレア度オブジェクト配列
         * @param {number} index - 現在開封中のカプセルのインデックス
         * @returns {void}
         */
        export function openGacha10CapsulesSequentially(capsuleSets, iconEls, rarities, index) {
            if (index >= capsuleSets.length) {
                finishGachaSpin10();
                return;
            }
            const { whole, top, bottom, cell } = capsuleSets[index];
            const icon = iconEls[index];
            const flair = rarities[index].flair;
            cell.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 入りきらない分は、開く場所に合わせて自動でスクロール
            playAudioFile('audio/gacha/open.mp3');
            vibrate(flair.vibrate);
            if (flair.glow > 0) screenFlash(rarities[index].color, flair.flash * CONFIG.GACHA_MULTI_FLASH_SCALE); // 10連は連続で光ると煩わしいので、1連より控えめに

            // 🐛修正：景品は既にstartGachaSpin10の時点で確定・保存済み。ここでは表示するだけ（再抽選しない）
            const pending = pendingGachaResults10[index];
            if (pending && pending.kind === 'normal') {
                const item = pending.item;
                icon.innerHTML = `<img src="${item.img}" style="width:60%; display:block; margin:0 auto 4px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)) drop-shadow(0 0 ${flair.glow}px ${rarities[index].color});"><div style="display:inline-block; font-size:0.68rem; font-weight:900; color:#fff; background:${rarities[index].color}; padding:2px 8px; border-radius:10px; line-height:1.3; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${item.name}</div>`;
            } else if (pending && pending.kind === 'kisekae') {
                const result = pending.result;
                const starText = '⭐'.repeat(result.item.star);
                if (result.isSpray) {
                    const emoji = result.item.effectId === 'sparkle' ? '✨' : '🌟';
                    icon.innerHTML = `<div style="font-size:2.2rem;">${emoji}</div><div style="display:inline-block; font-size:0.68rem; font-weight:900; color:#fff; background:${rarities[index].color}; padding:2px 8px; border-radius:10px; line-height:1.3; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${result.item.name} ${starText}</div>`;
                } else {
                    const dupText = result.isDuplicate ? ` <span style="opacity:0.8;">(🪙${result.refundCoins})</span>` : '';
                    const thumbSrc = result.item.img || (result.item.leftFrames ? result.item.leftFrames[0] : '');
                    icon.innerHTML = `<img src="${thumbSrc}" style="width:60%; display:block; margin:0 auto 4px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)) drop-shadow(0 0 ${flair.glow}px ${rarities[index].color});"><div style="display:inline-block; font-size:0.68rem; font-weight:900; color:#fff; background:${rarities[index].color}; padding:2px 8px; border-radius:10px; line-height:1.3; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${result.item.name} ${starText}${dupText}</div>`;
                }
                updateDisplay();
            }

            // 1連と同じ「上下にパカッと割れて開く」演出
            whole.style.display = 'none';
            top.style.display = 'block';
            bottom.style.display = 'block';
            top.animate(
                [{ transform: 'translateY(-6px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(-75px) rotate(-32deg)', opacity: 0 }],
                { duration: CONFIG.GACHA_MULTI_OPEN_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
            );
            bottom.animate(
                [{ transform: 'translateY(6px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(58px) rotate(25deg)', opacity: 0 }],
                { duration: CONFIG.GACHA_MULTI_OPEN_DURATION_MS, easing: 'ease-out', fill: 'forwards' }
            );
            icon.animate(
                [{ transform: 'scale(0.5)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
                { duration: CONFIG.GACHA_MULTI_OPEN_DURATION_MS, easing: 'ease-out', fill: 'forwards', delay: CONFIG.GACHA_MULTI_OPEN_ICON_DELAY_MS }
            ).finished.then(() => {
                setTimeout(() => openGacha10CapsulesSequentially(capsuleSets, iconEls, rarities, index + 1), CONFIG.GACHA_MULTI_OPEN_NEXT_DELAY_MS);
            });
        }

        // 🔴 全部開き終わったら、結果のUIをそのまま残さず、「もう10連／やめる」の選択だけ出す
        /**
         * 10連の全開封が終わったタイミングで保存・演出を行い、「もう10連／やめる」の選択プロンプトを表示する。
         * @returns {void}
         */
        export function finishGachaSpin10() {
            saveGame();
            playAudioFile('audio/levelup.mp3');
            screenFlash('#ffd700', CONFIG.GACHA_FLASH_ALPHA_STANDARD);

            const panel = document.getElementById('gacha-multi-panel');
            const promptDiv = document.createElement('div');
            promptDiv.id = 'gacha10-finish-prompt';
            promptDiv.style.cssText = 'display:flex; gap:8px; padding:16px 12px 20px;';
            promptDiv.innerHTML = `
                <button class="item-action-btn btn-shop" style="flex:1; background:#9c27b0; color:#fff;" onclick="event.stopPropagation(); closeGacha10ResultsAnd(true);">🎰 もう10連</button>
                <button class="item-action-btn" style="flex:1; background:#eee; color:#4a3622;" onclick="event.stopPropagation(); closeGacha10ResultsAnd(false);">やめる</button>
            `;
            panel.appendChild(promptDiv);
            promptDiv.scrollIntoView({ behavior: 'smooth', block: 'end' }); // 最後のカプセルより下に、続けて見えるようにする
        }

        // 🔴 「もう10連」「やめる」どちらを押しても、結果表示はいったんすべて消してから次に進む
        /**
         * 10連結果表示のパネル・グリッド・プロンプトを片付けてボタンを再有効化し、spinAgainがtrueなら再度10連を回す。
         * @param {boolean} spinAgain - trueなら続けて10連ガチャを開始する
         * @returns {void}
         */
        export function closeGacha10ResultsAnd(spinAgain) {
            const panel = document.getElementById('gacha-multi-panel');
            panel.style.display = 'none';
            document.getElementById('gacha-multi-grid').innerHTML = '';
            document.getElementById('gacha-reveal-fullscreen').style.display = 'none';
            const prompt = document.getElementById('gacha10-finish-prompt');
            if (prompt) prompt.remove();
            setGachaButtonsDisabled(false);
            if (spinAgain) startGachaSpin10();
        }
        window.closeGacha10ResultsAnd = closeGacha10ResultsAnd; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        // 🎰 クランクの位置：通常URLとPWA(ホーム画面)で見え方が変わるため、別々の座標を持つ
        export const GACHA_CRANK_POS = { top: 62.402035, left: 40.200326, width: 19.031814 };
        export const GACHA_CRANK_POS_PWA = { top: 63.284389, left: 40.200326, width: 19.031814 };
        // 🚧 座標が確定したので、いったんパネルを非表示にしている。また使う時は true に戻すだけでOK
        export const GACHA_CRANK_ADJUST_TOOL_ENABLED = false;
        /**
         * 実行環境（PWA/通常ブラウザ）に応じた座標定数を使って、ガチャクランク画像の位置・幅を設定する。
         * @returns {void}
         */
        export function applyGachaCrankPosition() {
            const crank = document.getElementById('gacha-crank');
            if (!crank) return;
            const pos = isRunningStandalone() ? GACHA_CRANK_POS_PWA : GACHA_CRANK_POS;
            crank.style.top = pos.top + '%';
            crank.style.left = pos.left + '%';
            crank.style.width = pos.width + '%';
        }
        /**
         * ガチャタブへの切り替えのみを行う薄いラッパー関数。
         * @returns {void}
         */
        export function onGachaTabTap() {
            switchShopTab('gacha');
        }
        // 🛋️ 家具の購入・プレビュー
        /**
         * 指定カテゴリ・IDの家具アイテムをもちで購入し、所持リストに追加してから保存・再描画する。
         * @param {string} cat - 家具のカテゴリ
         * @param {string} itemId - 購入する家具アイテムのID
         * @returns {void}
         */
        export function buyFurnitureItem(cat, itemId) {
            const item = MYROOM_ITEMS[cat].find(i => i.id === itemId);
            if (!item) return;
            if (!IS_DEV_MODE && score < item.price) return;
            if (!IS_DEV_MODE) setScore(score - (item.price));
            if (!ownedMyroomItems[cat]) ownedMyroomItems[cat] = [];
            ownedMyroomItems[cat].push(itemId); // 複数個買えるよう、重複を許可する（所持数は個数で管理）
            playAudioFile('audio/levelup.mp3');
            saveGame();
            updateDisplay();
            renderShopList();
        }
        window.buyFurnitureItem = buyFurnitureItem; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        /**
         * 選択した家具アイテムを、現在の壁紙・床の上に実際の配置ルールに沿って重ねて表示するプレビューモーダルを開く。
         * @param {string} cat - 家具のカテゴリ
         * @param {string} itemId - プレビューする家具アイテムのID
         * @returns {void}
         */
        export function previewShopFurniture(cat, itemId) {
            const item = MYROOM_ITEMS[cat].find(i => i.id === itemId);
            if (!item) return;
            const wallpaperItem = MYROOM_ITEMS.wallpaper.find(i => i.id === equippedMyroom.wallpaper) || MYROOM_ITEMS.wallpaper[0];
            const flooringItem = MYROOM_ITEMS.flooring.find(i => i.id === equippedMyroom.flooring) || MYROOM_ITEMS.flooring[0];
            document.getElementById('furniture-preview-wallpaper').src = wallpaperItem.img;
            document.getElementById('furniture-preview-flooring').src = flooringItem.img;
            const itemEl = document.getElementById('furniture-preview-item');
            // 実際の配置と同じ考え方で、なるべく画面中央（壁掛けは壁の中央）に表示する
            let top, left;
            if (cat === 'wall_deco') {
                top = (MYROOM_WALL_ZONE_BOTTOM - item.height) / 2;
                left = (100 - item.width) / 2;
            } else {
                top = CONFIG.FURNITURE_PREVIEW_CENTER_PCT - item.height / 2;
                left = CONFIG.FURNITURE_PREVIEW_CENTER_PCT - item.width / 2;
                if (top + item.height <= MYROOM_WALL_ZONE_BOTTOM) top = MYROOM_WALL_ZONE_BOTTOM - item.height + CONFIG.FURNITURE_PREVIEW_SNAP_EPSILON_PCT;
            }
            itemEl.src = item.img;
            itemEl.style.top = top + '%';
            itemEl.style.left = left + '%';
            itemEl.style.width = item.width + '%';
            itemEl.style.height = item.height + '%';
            document.getElementById('furniture-preview-name').textContent = `👁️ ${item.name}（プレビュー）`;
            const ownedCount = (ownedMyroomItems[cat] || []).filter(id => id === itemId).length;
            document.getElementById('furniture-preview-price').textContent = ownedCount > 0 ? `所持:${ownedCount}個 ／ 追加：${formatMochi(item.price)}もち` : `${formatMochi(item.price)}もち`;
            openModal('furniture-preview-modal');
        }
        window.previewShopFurniture = previewShopFurniture; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        /**
         * 家具プレビューモーダルを閉じ、ショップモーダルが開いたままならbodyのmodal-openクラスを付け直す。
         * @returns {void}
         */
        export function closeFurniturePreview() {
            closeModal('furniture-preview-modal');
            // 🐛修正：closeModalがbodyのmodal-openクラスを消してしまうため、ショップがまだ開いたままなら付け直す
            const shopModal = document.getElementById('shop-modal');
            if (shopModal && shopModal.style.display === 'flex') {
                document.body.classList.add('modal-open');
            }
        }

        // 🛠️ 開発者用：ガチャのクランク（回す部分）の位置調整ツール
        export let gachaCrankAdjustMode = false;
        export let gachaCrankAdjustDragState = null;
        /**
         * 開発者用のクランク位置調整モードのオン/オフを切り替え、オンならドラッグ設定とハンドル配置を初期化する。
         * @returns {void}
         */
        export function toggleGachaCrankAdjustMode() {
            gachaCrankAdjustMode = !gachaCrankAdjustMode;
            const btn = document.getElementById('gacha-adjust-toggle-btn');
            const target = document.getElementById('gacha-crank');
            if (gachaCrankAdjustMode) {
                target.style.outline = '2px dashed #e91e63';
                target.style.pointerEvents = 'auto'; // 🐛修正：通常時はpointer-events:noneのため、調整中だけ一時的にクリック判定を復活させる
                btn.style.background = '#4caf50';
                setupGachaCrankAdjustDrag();
                positionGachaCrankHandles();
                updateGachaCrankReadout();
            } else {
                target.style.outline = '';
                target.style.pointerEvents = 'none'; // 通常表示に戻す
                ['gacha-resize-handle-r', 'gacha-resize-handle-b', 'gacha-resize-handle-br'].forEach(id => document.getElementById(id).style.display = 'none');
                btn.style.background = '#e91e63';
            }
        }
        window.toggleGachaCrankAdjustMode = toggleGachaCrankAdjustMode; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        /**
         * 調整モード中、クランク要素の右端・下端・右下角に対応するリサイズハンドルの位置をDOM座標から%に変換して配置し直す。
         * @returns {void}
         */
        export function positionGachaCrankHandles() {
            if (!gachaCrankAdjustMode) return;
            const stage = document.getElementById('gacha-illustration-wrap');
            const target = document.getElementById('gacha-crank');
            const stageRect = stage.getBoundingClientRect();
            const tRect = target.getBoundingClientRect();
            const rightPct = ((tRect.right - stageRect.left) / stageRect.width) * 100;
            const bottomPct = ((tRect.bottom - stageRect.top) / stageRect.height) * 100;
            const midYPct = ((tRect.top + tRect.height / 2 - stageRect.top) / stageRect.height) * 100;
            const midXPct = ((tRect.left + tRect.width / 2 - stageRect.left) / stageRect.width) * 100;
            const hR = document.getElementById('gacha-resize-handle-r'), hB = document.getElementById('gacha-resize-handle-b'), hBr = document.getElementById('gacha-resize-handle-br');
            [hR, hB, hBr].forEach(h => h.style.display = 'block');
            hR.style.left = rightPct + '%'; hR.style.top = midYPct + '%';
            hB.style.left = midXPct + '%'; hB.style.top = bottomPct + '%';
            hBr.style.left = rightPct + '%'; hBr.style.top = bottomPct + '%';
        }
        /**
         * クランク調整モード用のポインタードラッグ操作（移動・幅リサイズ）のイベントリスナーを一度だけ設定する。
         * @returns {void}
         */
        export function setupGachaCrankAdjustDrag() {
            const stage = document.getElementById('gacha-illustration-wrap');
            if (stage.dataset.dragSetup) return;
            stage.dataset.dragSetup = '1';
            const target = document.getElementById('gacha-crank');
            const startDrag = (e, mode) => {
                if (!gachaCrankAdjustMode) return;
                e.stopPropagation(); e.preventDefault();
                try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
                gachaCrankAdjustDragState = { startX: e.clientX, startY: e.clientY, mode };
            };
            stage.addEventListener('pointerdown', (e) => {
                if (!gachaCrankAdjustMode) return;
                if (e.target.id === 'gacha-resize-handle-r') return startDrag(e, 'width');
                if (e.target.id === 'gacha-resize-handle-b') return startDrag(e, 'height');
                if (e.target.id === 'gacha-resize-handle-br') return startDrag(e, 'both');
                if (e.target !== target) return;
                startDrag(e, 'move');
            });
            stage.addEventListener('pointermove', (e) => {
                if (!gachaCrankAdjustDragState || !gachaCrankAdjustMode) return;
                e.stopPropagation();
                const stageRect = stage.getBoundingClientRect();
                const dxPct = ((e.clientX - gachaCrankAdjustDragState.startX) / stageRect.width) * 100;
                const dyPct = ((e.clientY - gachaCrankAdjustDragState.startY) / stageRect.height) * 100;
                const mode = gachaCrankAdjustDragState.mode;
                if (mode === 'move') {
                    target.style.top = (parseFloat(target.style.top) + dyPct) + '%';
                    target.style.left = (parseFloat(target.style.left) + dxPct) + '%';
                } else {
                    if (mode === 'width' || mode === 'both') target.style.width = Math.max(CONFIG.GACHA_CRANK_MIN_WIDTH_PCT, parseFloat(target.style.width) + dxPct) + '%';
                }
                gachaCrankAdjustDragState.startX = e.clientX; gachaCrankAdjustDragState.startY = e.clientY;
                positionGachaCrankHandles();
                updateGachaCrankReadout();
            });
            stage.addEventListener('pointerup', () => { gachaCrankAdjustDragState = null; });
            stage.addEventListener('pointercancel', () => { gachaCrankAdjustDragState = null; });
        }
        /**
         * 現在のクランクのtop/left/width（%指定文字列）を、調整パネルの座標読み取り表示欄に反映する。
         * @returns {void}
         */
        export function updateGachaCrankReadout() {
            const target = document.getElementById('gacha-crank');
            const el = document.getElementById('gacha-adjust-readout');
            if (!target || !el) return;
            el.textContent = `top:${target.style.top}; left:${target.style.left}; width:${target.style.width};`;
        }
        /**
         * 現在のクランク座標をテキストにまとめてテキストエリアに表示・選択状態にし、可能ならクリップボードにコピーする。
         * @returns {void}
         */
        export function copyGachaCrankCoords() {
            const target = document.getElementById('gacha-crank');
            const text = `クランク: top:${target.style.top}; left:${target.style.left}; width:${target.style.width};`;
            const textarea = document.getElementById('gacha-adjust-copy-textarea');
            textarea.value = text;
            textarea.style.display = 'block';
            textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }
        window.copyGachaCrankCoords = copyGachaCrankCoords; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要

        /**
         * 現在選択中のショップタブ（おみやげ／ガチャ／家具／スキル）に応じて、それぞれ専用のDOM構築処理を呼び分ける。
         * @returns {void}
         */
        export function renderShopList() {
            if (currentShopTab === 'omiyage') {
                renderOmiyageShelf();
                return;
            }

            const listContainer = document.getElementById('shop-overlay-list');
            listContainer.innerHTML = "";

            if (currentShopTab === 'gacha') { renderGachaTab(listContainer); return; }
            if (currentShopTab === 'furniture') { renderFurnitureTab(listContainer); return; }
            if (currentShopTab === 'skills') { renderSkillsTab(listContainer); return; }
        }

        /**
         * ガチャタブのDOM（本体イラスト・排出率オーバーレイ・演出用の各要素）を組み立てて表示する。
         * @param {HTMLElement} listContainer - ショップ一覧のコンテナ要素（#shop-overlay-list）
         * @returns {void}
         */
        function renderGachaTab(listContainer) {
            listContainer.innerHTML = `
                <div id="gacha-stage" style="position:relative; width:100%; height:360px;">
                    <div id="gacha-illustration-wrap" style="position:absolute; top:24px; left:0; width:100%; height:340px;">
                        ${IS_DEV_MODE ? `
                        <div id="gacha-adjust-panel" style="display:none; position:absolute; top:4px; left:4px; z-index:50; background:rgba(255,255,255,0.95); border-radius:8px; padding:8px; width:150px; font-size:0.6rem;">
                            <div style="font-size:0.6rem; font-weight:900; margin-bottom:4px;">クランクの位置調整</div>
                            <button onclick="toggleGachaCrankAdjustMode()" id="gacha-adjust-toggle-btn" style="background:#e91e63; color:#fff; border:none; padding:3px 6px; border-radius:5px; font-size:0.58rem; width:100%;">位置調整ON/OFF</button>
                            <p style="font-size:0.52rem; color:#999; margin:4px 0;">緑（縁・角）をドラッグで大きさ調整</p>
                            <div id="gacha-adjust-readout" style="font-size:0.52rem; color:#555; white-space:pre-wrap;"></div>
                            <button onclick="copyGachaCrankCoords()" style="background:#2196f3; color:#fff; border:none; padding:4px 6px; border-radius:5px; font-size:0.58rem; margin-top:4px; width:100%;">📋 座標コピー</button>
                            <textarea id="gacha-adjust-copy-textarea" readonly style="display:none; width:100%; height:60px; font-size:0.52rem; margin-top:4px; box-sizing:border-box;"></textarea>
                        </div>
                        <div id="gacha-resize-handle-r" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#4caf50; border:2px solid #fff; z-index:999; cursor:ew-resize;"></div>
                        <div id="gacha-resize-handle-b" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#4caf50; border:2px solid #fff; z-index:999; cursor:ns-resize;"></div>
                        <div id="gacha-resize-handle-br" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#ff9800; border:2px solid #fff; z-index:999; cursor:nwse-resize;"></div>
                        ` : ''}
                        <img id="gacha-machine-body" src="ui_images/gacha/machine_body.webp" alt="ガチャガチャ" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:70%; max-width:230px; z-index:2;">
                        <img id="gacha-crank" src="ui_images/gacha/crank.webp" alt="" style="position:absolute; width:19.031814%; top:62.402035%; left:40.200326%; transform-origin:50% 50%; z-index:3; pointer-events:none;">

                        <div id="gacha-capsule-wrap-mini" style="position:absolute; top:77.967692%; left:49.573535%; transform:translate(-50%, 0) scale(0); width:22%; z-index:4;">
                            <img src="ui_images/gacha/capsule.webp" alt="" style="width:100%; display:block;">
                        </div>
                    </div>

                    <button onclick="toggleGachaRatesOverlay()" style="position:absolute; top:4px; right:4px; z-index:9; width:26px; height:26px; border-radius:50%; border:none; background:rgba(93,64,55,0.75); color:#fff; font-weight:900; font-size:0.8rem;">？</button>

                    <div id="gacha-rates-overlay" style="display:none; position:fixed; inset:0; z-index:2000; background:rgba(255,248,236,0.98); padding:calc(20px + env(safe-area-inset-top, 0px)) 20px 20px; overflow-y:auto; box-sizing:border-box;">
                        <button onclick="toggleGachaRatesOverlay()" style="position:absolute; top:calc(8px + env(safe-area-inset-top, 0px)); right:8px; width:26px; height:26px; border-radius:50%; border:none; background:#5d4037; color:#fff; font-weight:900;">×</button>
                        <h3 style="margin:0 0 10px; color:#5d4037;">🎰 排出率</h3>
                        <div id="gacha-rates-list"></div>
                        <h3 style="margin:16px 0 8px; color:#5d4037;">🎁 各アイテムの排出率</h3>
                        <div id="gacha-rate-tabs" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;"></div>
                        <div id="gacha-item-rate-list"></div>
                    </div>
                </div>
                <div id="gacha-coin-display" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#fff8ec,#ffe9c2); border:2px solid #e8c88a; border-radius:20px; padding:6px 16px; font-weight:900; color:#8d6e63; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.08);">🪙 <span id="gacha-coin-value">0</span> コイン</div>
                <button id="gacha-spin-btn" class="item-action-btn btn-shop" style="width:80%; background:linear-gradient(135deg,#ff6fa5,#e91e63); color:#fff; border-radius:24px; box-shadow:0 3px 0 #b0184a, 0 4px 8px rgba(0,0,0,0.15); font-weight:900; letter-spacing:0.5px;" onclick="startGachaSpin()">🎰 1回まわす（${GACHA_COST_SINGLE}枚）</button>
                <button id="gacha-spin10-btn" class="item-action-btn btn-shop" style="width:80%; background:linear-gradient(135deg,#c162e8,#9c27b0); color:#fff; margin-top:10px; border-radius:24px; box-shadow:0 3px 0 #6a1b7a, 0 4px 8px rgba(0,0,0,0.15); font-weight:900; letter-spacing:0.5px;" onclick="startGachaSpin10()">🎰 10連まとめて（${GACHA_COST_TEN}枚）</button>

                <div id="gacha-reveal-fullscreen" style="display:none; position:fixed; inset:0; max-width:480px; margin:0 auto; z-index:1500; background:radial-gradient(ellipse at center, #5a4330 0%, #1a0f08 100%); align-items:center; justify-content:center;">
                    <div id="gacha-reveal-single" style="display:none; position:relative; width:100%; height:100%; align-items:center; justify-content:center;">
                        <div id="gacha-capsule-wrap" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) scale(0); width:45%; max-width:220px; z-index:4;">
                            <img id="gacha-capsule-whole" src="ui_images/gacha/capsule.webp" alt="" style="width:100%; display:block;">
                            <img id="gacha-capsule-top" src="ui_images/gacha/capsule_top.webp" alt="" style="width:100%; display:none; position:absolute; top:0; left:0;">
                            <img id="gacha-capsule-bottom" src="ui_images/gacha/capsule_bottom.webp" alt="" style="width:100%; display:none; position:absolute; top:0; left:0;">
                        </div>

                        <div id="gacha-prize-reveal" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) scale(0); text-align:center; z-index:5; opacity:0;">
                            <img id="gacha-prize-img" src="" alt="" style="width:170px; height:170px; object-fit:contain; filter:drop-shadow(0 4px 10px rgba(0,0,0,0.4));">
                            <p id="gacha-prize-name" style="font-size:1.15rem; font-weight:bold; color:#fff; margin:8px 0 0; text-shadow:0 2px 6px rgba(0,0,0,0.6);"></p>
                        </div>
                    </div>

                    <div id="gacha-multi-panel" style="display:none; position:absolute; inset:6% 4%; overflow-y:auto;">
                        <div id="gacha-multi-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:16px 14px; padding:10px; justify-items:center;"></div>
                    </div>
                </div>
            `;
            updateGachaCoinDisplay();
            applyGachaCrankPosition();
            if (IS_DEV_MODE && GACHA_CRANK_ADJUST_TOOL_ENABLED) { const p = document.getElementById('gacha-adjust-panel'); if (p) p.style.display = 'block'; }
        }

        /**
         * 家具タブの一覧（壁掛け／大型家具／テーブル）を、カテゴリ見出し付きで描画する。
         * @param {HTMLElement} listContainer - ショップ一覧のコンテナ要素（#shop-overlay-list）
         * @returns {void}
         */
        function renderFurnitureTab(listContainer) {
            ['wall_deco', 'big_furniture', 'table'].forEach(cat => {
                const heading = document.createElement('div');
                heading.style.cssText = 'font-size:0.75rem; font-weight:900; color:#8d6e63; margin:10px 0 4px;';
                heading.textContent = `${MYROOM_CATEGORY_LABELS[cat]}`;
                listContainer.appendChild(heading);
                MYROOM_ITEMS[cat].forEach(item => {
                    const ownedCount = (ownedMyroomItems[cat] || []).filter(id => id === item.id).length;
                    const row = document.createElement('div');
                    row.className = 'list-item';
                    const canBuy = score >= item.price;
                    const countBadge = ownedCount > 0 ? `<span style="color:#4caf50; font-weight:900; font-size:0.68rem;">所持:${ownedCount}個</span>` : '';
                    const btnHtml = `<button class="item-action-btn btn-shop" ${canBuy ? '' : 'disabled'} onclick="buyFurnitureItem('${cat}','${item.id}')" style="background:#ff9800; color:white;">${formatMochi(item.price)}もち</button>`;
                    row.innerHTML = `<div class="item-info-row"><img class="item-thumb" src="${item.img}" alt="${item.name}"><div class="item-info"><span class="item-title">🛋️ ${item.name}</span><span class="item-desc">${countBadge}</span></div></div><div style="display:flex; flex-direction:column; gap:4px;"><button onclick="previewShopFurniture('${cat}','${item.id}')" style="background:#8d6e63; color:#fff; border:none; border-radius:8px; padding:4px 8px; font-size:0.65rem; font-weight:900;">👁️ プレビュー</button>${btnHtml}</div>`;
                    listContainer.appendChild(row);
                });
            });
        }

        /**
         * スキルタブの一覧を、未解放／未獲得／獲得済み(レベルアップ可)の状態別に描画する。
         * ✨ ステージ進行に応じて段階的に解放される
         * @param {HTMLElement} listContainer - ショップ一覧のコンテナ要素（#shop-overlay-list）
         * @returns {void}
         */
        function renderSkillsTab(listContainer) {
            Object.keys(skills).forEach(key => {
                const s = skills[key];
                const row = document.createElement('div');
                row.className = "list-item";

                if (currentStageIndex < s.unlockStage) {
                    // まだ解放条件を満たしていない
                    const reqStageName = stages[s.unlockStage] ? stages[s.unlockStage].name : "???";
                    row.style.opacity = "0.55";
                    row.innerHTML = `<div class="item-info"><span class="item-title">🔒 ${s.name}</span><span class="item-desc">「${reqStageName}」到達で解放</span></div><button class="item-action-btn" disabled>ロック中</button>`;
                } else if (s.lv === 0) {
                    // 未獲得：獲得ボタン（初回購入できる状態なら、行ごと光らせる。レベルアップはここに来ないので対象外）
                    const canBuy = score >= s.unlockPrice;
                    if (canBuy) row.classList.add('shop-recommend-glow');
                    row.innerHTML = `<div class="item-info"><span class="item-title">✨ ${s.name}</span><span class="item-desc">${s.desc}</span></div><button class="item-action-btn btn-shop" ${canBuy ? '' : 'disabled'} onclick="buySkillLevel('${key}')" style="background:#ff9800; color:white;">${formatMochi(s.unlockPrice)}もちで獲得</button>`;
                } else {
                    // 獲得済み：レベルアップボタン
                    const nextPrice = Math.floor(s.unlockPrice * Math.pow(s.lvPriceMult, s.lv));
                    const canBuy = score >= nextPrice;
                    row.innerHTML = `<div class="item-info"><span class="item-title">✨ ${s.name} <span style="color:#ff9800; font-weight:900;">Lv.${s.lv}</span></span><span class="item-desc">${s.desc}</span></div><button class="item-action-btn btn-shop" ${canBuy ? '' : 'disabled'} onclick="buySkillLevel('${key}')" style="background:#ff9800; color:white;">${formatMochi(nextPrice)}もちでLvUP</button>`;
                }
                listContainer.appendChild(row);
            });
        }

        export const OMIYAGE_PAGE_SIZE = 9;
        export let omiyagePage = 0;
        export let omiyageSelectedIdx = null;
        export const OMIYAGE_IMG_NATURAL_RATIO = 851 / 1847; // 棚イラストの実寸比率（幅/高さ）

        // #omiyage-image-frameを、コンテナ内で棚イラストが実際に表示される範囲(レターボックス考慮済み)に
        // ピッタリ合わせる。これにより、中の%指定（スロット位置・名札・詳細パネルなど）が常に画像基準で正確になる。
        /**
         * #omiyage-image-frameを、コンテナ内で棚イラストが実際に表示される範囲（レターボックス考慮済み）に合わせる。
         * @returns {void}
         */
        export function syncOmiyageImageFrame() {
            const container = document.getElementById('omiyage-shelf-container');
            const frame = document.getElementById('omiyage-image-frame');
            if (!container || !frame) return;
            const cw = container.clientWidth, ch = container.clientHeight;
            if (cw === 0 || ch === 0) return;
            const containerRatio = cw / ch;
            let w, h, top;
            if (containerRatio > OMIYAGE_IMG_NATURAL_RATIO) {
                // 横長すぎるコンテナ：本来は左右がレターボックスされるが、メイン画面の背景と同じ考え方で、
                // 下部のショップタブ・棚を絶対に隠さない範囲でだけ、看板寄りの上部を安全に切り詰めて幅優先にする
                w = cw; h = cw / OMIYAGE_IMG_NATURAL_RATIO;
                const MAX_SAFE_CROP_RATIO = CONFIG.OMIYAGE_SHELF_MAX_SAFE_CROP_RATIO; // 看板部分など、削っても実害が無い上部の目安（下のタブ等には絶対届かせない）
                const overflowH = h - ch;
                const cropTop = Math.max(0, Math.min(overflowH, h * MAX_SAFE_CROP_RATIO));
                top = -cropTop;
                const stillOverflowing = h - cropTop - ch;
                if (stillOverflowing > 0) {
                    // それでも収まりきらない分だけ、従来通り少し縮めてレターボックスに戻す（safeクロップの範囲は超えない）
                    const scale = ch / (h - cropTop);
                    w *= scale; h *= scale;
                    top = -cropTop * scale;
                }
            } else {
                // 縦長すぎるコンテナ → 幅いっぱいに合わせて高さを計算（上下がレターボックス）
                w = cw; h = cw / OMIYAGE_IMG_NATURAL_RATIO;
                top = (ch - h) / 2;
            }
            frame.style.width = w + 'px';
            frame.style.height = h + 'px';
            frame.style.left = ((cw - w) / 2) + 'px';
            frame.style.top = top + 'px';
        }

        /**
         * おみやげタブの棚表示を担当。現在ページ分のスロットを生成し、ロック状態や新規購入可能演出、詳細パネルを反映する。
         * @param {boolean} [shake] - trueなら棚切り替え時の揺れ演出を出す
         * @returns {void}
         */
        export function renderOmiyageShelf(shake) {
            syncOmiyageImageFrame();
            const maxPage = Math.ceil(stages.length / OMIYAGE_PAGE_SIZE) - 1;
            if (omiyagePage > maxPage) omiyagePage = 0;
            document.getElementById('omiyage-money-value').innerText = formatMochi(score);

            const slotsLayer = document.getElementById('omiyage-slots-layer');
            slotsLayer.innerHTML = '';
            const startIdx = omiyagePage * OMIYAGE_PAGE_SIZE;

            for (let slot = 0; slot < OMIYAGE_PAGE_SIZE; slot++) {
                const i = startIdx + slot;
                if (i >= stages.length) continue;
                const rowDef = OMIYAGE_ROWS[Math.floor(slot / 3)];
                const colDef = OMIYAGE_COLS[slot % 3];
                const stage = stages[i];
                const isLocked = i > currentStageIndex;

                const itemDiv = document.createElement('div');
                const curLv = purchasedItems[i] || 0;
                const isNewlyAffordable = !isLocked && curLv === 0 && score >= getOmiyagePrice(stage, 0);
                itemDiv.className = 'omiyage-slot' + (isLocked ? ' locked' : '') + (isNewlyAffordable ? ' shop-recommend-glow' : '');
                itemDiv.style.left = colDef.left + '%';
                itemDiv.style.top = rowDef.itemTop + '%';
                itemDiv.style.width = (colDef.right - colDef.left) + '%';
                itemDiv.style.height = (rowDef.itemBottom - rowDef.itemTop) + '%';
                itemDiv.innerHTML = isLocked
                    ? `<div class="omiyage-slot-emoji">❔</div>`
                    : (stage.itemImg ? `<img class="omiyage-slot-img" src="${stage.itemImg}" alt="${stage.item}">` : `<div class="omiyage-slot-emoji">🎁</div>`);
                if (shake) {
                    // 棚を切り替えた時だけ、左上から順に少しずつ揺れるようにする（一斉に同時ではなく、波が伝わる感じにする）
                    itemDiv.style.animation = `omiyageShelfShake 0.4s ease-in-out ${slot * CONFIG.OMIYAGE_SHELF_SHAKE_STAGGER_S}s`;
                }
                if (!isLocked) itemDiv.addEventListener('click', () => onOmiyageSlotTap(i, itemDiv));
                slotsLayer.appendChild(itemDiv);

                const plateDiv = document.createElement('div');
                plateDiv.className = 'omiyage-nameplate';
                plateDiv.style.left = colDef.left + '%';
                plateDiv.style.top = rowDef.plateTop + '%';
                plateDiv.style.width = (colDef.right - colDef.left) + '%';
                plateDiv.style.height = (rowDef.plateBottom - rowDef.plateTop) + '%';
                plateDiv.innerText = isLocked ? '？？？' : stage.item;
                slotsLayer.appendChild(plateDiv);
            }

            // 選択中の商品が今のページにあれば詳細パネルを更新表示、無ければ隠す
            if (omiyageSelectedIdx != null && omiyageSelectedIdx >= startIdx && omiyageSelectedIdx < startIdx + OMIYAGE_PAGE_SIZE) {
                showOmiyageDetail(omiyageSelectedIdx);
            } else {
                closeOmiyageDetailUI();
            }

            document.getElementById('omiyage-page-indicator').innerText = `${omiyagePage + 1} / ${maxPage + 1} ページ`;
        }

        /**
         * おみやげ棚のページを前後（dir=±1）に切り替え、切り替え効果音を鳴らして棚を再描画する。
         * @param {number} dir - ページ移動方向（+1で次、-1で前）
         * @returns {void}
         */
        export function omiyagePageBy(dir) {
            const maxPage = Math.ceil(stages.length / OMIYAGE_PAGE_SIZE) - 1;
            omiyagePage = (omiyagePage + dir + maxPage + 1) % (maxPage + 1); // 最初で←→最後、最後で→→最初
            omiyageSelectedIdx = null;
            playAudioFile('audio/shelf_switch.mp3'); // 棚を切り替える専用の効果音
            renderOmiyageShelf(true); // trueで、切り替え時の揺れ演出を出す
        }

        /**
         * 棚のスロットがタップされた時、効果音とゆれ演出を出してからそのスロットを選択状態にして詳細パネルを表示する。
         * @param {number} idx - タップされたステージのインデックス
         * @param {HTMLElement} el - タップされたスロットのDOM要素
         * @returns {void}
         */
        export function onOmiyageSlotTap(idx, el) {
            playAudioFile('audio/tap.mp3');
            el.classList.remove('mochitto'); void el.offsetWidth; el.classList.add('mochitto'); // もちっと演出
            omiyageSelectedIdx = idx;
            showOmiyageDetail(idx);
        }

        /**
         * 指定したおみやげの詳細パネルに、画像・名前・現在の効果量・全体貢献度・次のレベルの価格と購入ボタンを表示する。
         * @param {number} idx - 表示するステージのインデックス
         * @returns {void}
         */
        export function showOmiyageDetail(idx) {
            const stage = stages[idx];
            const currentLv = purchasedItems[idx] || 0;
            const nextPrice = getOmiyagePrice(stage, currentLv);
            const canBuy = score >= nextPrice;
            const baseEffectText = stage.tapBonus ? `タップ力 +${formatMochi(stage.tapBonus)}` : `自動増加 +${formatMochi(stage.mpsBonus)}もち/秒`;

            const imgEl = document.getElementById('omiyage-detail-img');
            if (stage.itemImg) { imgEl.src = stage.itemImg; imgEl.style.display = 'block'; }
            else { imgEl.style.display = 'none'; }
            document.getElementById('omiyage-detail-name').innerText = `${stage.item} Lv.${currentLv}`;

            // このおみやげ1つが、今のタップ力(or 自動増加)全体のうち何%を占めているかを表示する
            // →どのおみやげが伸びすぎているか、プレイヤー自身が実感しやすいように
            let contributionText = '';
            if (currentLv > 0) {
                const isGoldTrophyHere = getPrefTrophy(idx) === 'gold';
                const myValue = currentLv * (stage.tapBonus || stage.mpsBonus) * (isGoldTrophyHere ? CONFIG.GOLD_TROPHY_BONUS_MULT : 1);
                const totalValue = stage.tapBonus ? getTapPower() : getMps();
                const percent = totalValue > 0 ? (myValue / totalValue * 100) : 0;
                contributionText = ` ／ 全体の${percent < CONFIG.CONTRIBUTION_MIN_DISPLAY_PERCENT ? '<0.1' : percent.toFixed(1)}%`;
            }
            document.getElementById('omiyage-detail-effect').innerText = `${baseEffectText}（現在+${formatMochi(currentLv * (stage.tapBonus || stage.mpsBonus))}${contributionText}）`;

            const buyBtn = document.getElementById('omiyage-detail-buy-btn');
            buyBtn.innerText = `${formatMochi(nextPrice)}もちで購入`;
            buyBtn.disabled = !canBuy;
            buyBtn.onclick = () => buyOmiyageFromShelf(idx, nextPrice);

            document.getElementById('omiyage-detail-panel').classList.add('show');
        }

        // 見た目だけ隠す（選択状態は保持しない呼び出し元でクリアする）
        /**
         * 詳細パネルの見た目（showクラス）だけを外して非表示にする。選択状態自体はクリアしない。
         * @returns {void}
         */
        export function closeOmiyageDetailUI() {
            document.getElementById('omiyage-detail-panel').classList.remove('show');
        }

        // 🍡 お土産一覧（倉庫）：持っているおみやげを並べて、タップで「もちすけにあげる」を選べる
        /**
         * 選択中のおみやげIDをクリアした上で、詳細パネルを非表示にする。
         * @returns {void}
         */
        export function closeOmiyageDetail() {
            omiyageSelectedIdx = null;
            closeOmiyageDetailUI();
        }

        /**
         * 所持金が足りているか確認した上でbuyOmiyage()を呼んで購入処理を実行し、消費額の演出テキストを表示する。
         * @param {number} idx - 購入するステージのインデックス
         * @param {number} price - 表示・チェック用の購入価格
         * @returns {void}
         */
        export function buyOmiyageFromShelf(idx, price) {
            if (score < price) return;
            buyOmiyage(idx); // 既存の購入ロジックを流用（効果音・セリフ・セーブ・再描画まで全部やってくれる）
            flashOmiyageMoneySpent(price);
        }

        /**
         * 所持金表示の右上あたりに「-〇〇もち」の消費額テキストを配置し、一定時間だけフェード表示する。
         * @param {number} price - 表示する消費額
         * @returns {void}
         */
        export function flashOmiyageMoneySpent(price) {
            const el = document.getElementById('omiyage-money-flash');
            const valueEl = document.getElementById('omiyage-money-value');
            const container = document.getElementById('omiyage-shelf-container'); // #omiyage-money-displayと同じ絶対配置の基準
            el.innerText = `-${formatMochi(price)}もち`;

            // 所持もち数の桁数によって表示幅が変わるため、その時点での右上位置を実測して合わせる
            const valueRect = valueEl.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            el.style.left = (valueRect.right - containerRect.left + CONFIG.OMIYAGE_MONEY_FLASH_OFFSET_X_PX) + 'px';
            el.style.top = (valueRect.top - containerRect.top + CONFIG.OMIYAGE_MONEY_FLASH_OFFSET_Y_PX) + 'px';

            el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), CONFIG.OMIYAGE_MONEY_FLASH_DURATION_MS);
        }

        /**
         * 指定インデックスのおみやげについて、価格分のもちを消費してレベルを1上げ、進捗記録・演出・保存・再描画を行う。
         * @param {number} idx - 購入するステージのインデックス
         * @returns {void}
         */
        export function buyOmiyage(idx) {
            const stage = stages[idx]; const currentLv = purchasedItems[idx] || 0;
            const nextPrice = getOmiyagePrice(stage, currentLv);
            if (score >= nextPrice) {
                setScore(score - (nextPrice)); purchasedItems[idx] = currentLv + 1;
                trackMissionEvent('omiyageBoughtTotal', 1); trackMissionEvent('omiyageBoughtToday', 1);
                playAudioFile('audio/levelup.mp3');
                showMochiComment(pickRandom(dialogueData.eventComments.levelUp));
                saveGame(); renderShopList(); updateDisplay(); updateShopTabHighlight();
            }
        }

        /**
         * 指定IDの衣装をclothesDataから探し、未購入かつ所持金が足りていれば購入・もち消費・自動装備を行う。
         * @param {string} id - 購入する衣装のID
         * @returns {void}
         */
        export function buyKisekae(id) {
            const target = clothesData.find(c => c.id === id);
            if (score >= target.price && !purchasedClothes[id]) {
                setScore(score - (target.price)); purchasedClothes[id] = true;
                equipClothe(id); // 🐛修正：装備専用のUIを廃止したので、買ったらその場で自動装備する（能力ボーナスが有効になるように）
                saveGame(); renderShopList(); updateDisplay();
            }
        }

        // 🗺️ 地図の拡大縮小・ドラッグ操作の状態
        /**
         * スキルタブ・おみやげタブに、新しく購入可能なものがあることを示す光る演出クラスを付け外しする。
         * @returns {void}
         */
        export function updateShopTabHighlight() {
            const skillTab = document.getElementById('shop-tab-skills');
            if (skillTab) skillTab.classList.toggle('shop-recommend-glow', hasNewlyPurchasableSkill());
            const omiyageTab = document.getElementById('shop-tab-omiyage');
            if (omiyageTab) omiyageTab.classList.toggle('shop-recommend-glow', hasNewlyPurchasableOmiyage());
        }




        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        /**
         * activeSprayId（装備中のスプレーID）を書き換える。importした束縛に直接代入できないための橋渡し。
         * @param {*} v - 新しい値
         * @returns {void}
         */
        export function setActiveSprayId(v) { activeSprayId = v; }
        /**
         * blockedUserIds（ブロックしたユーザーID一覧）を書き換える。
         * @param {Array} v - 新しい値
         * @returns {void}
         */
        export function setBlockedUserIds(v) { blockedUserIds = v; }
        /**
         * equippedClotheId（現在装備中の衣装ID）を書き換える。
         * @param {string} v - 新しい値
         * @returns {void}
         */
        export function setEquippedClotheId(v) { equippedClotheId = v; }
        /**
         * favoriteFriendIds（お気に入り登録したフレンドのuid一覧）を書き換える。
         * @param {Array} v - 新しい値
         * @returns {void}
         */
        export function setFavoriteFriendIds(v) { favoriteFriendIds = v; }
        /**
         * purchasedClothes（購入済み衣装の一覧）を書き換える。
         * @param {Object} v - 新しい値
         * @returns {void}
         */
        export function setPurchasedClothes(v) { purchasedClothes = v; }
        /**
         * purchasedItems（各ステージのおみやげ購入レベル一覧）を書き換える。
         * @param {Object} v - 新しい値
         * @returns {void}
         */
        export function setPurchasedItems(v) { purchasedItems = v; }
        /**
         * sprayBuffActiveUntil（スプレーの自動増加バフが有効な期限タイムスタンプ）を書き換える。
         * @param {number} v - 新しい値
         * @returns {void}
         */
        export function setSprayBuffActiveUntil(v) { sprayBuffActiveUntil = v; }
        /**
         * sprayInventory（所持スプレー数）を書き換える。
         * @param {Object} v - 新しい値
         * @returns {void}
         */
        export function setSprayInventory(v) { sprayInventory = v; }
        /**
         * ticketInventory（所持チケット数）を書き換える。
         * @param {Object} v - 新しい値
         * @returns {void}
         */
        export function setTicketInventory(v) { ticketInventory = v; }


        // window橋渡し：ここから下は、index.htmlのonclick=""（静的または動的に生成される
        // 文字列の両方）から直接呼ばれる関数を中心に、window経由のアクセスがまだ必要なものをまとめている。
        // ブラウザはonclick="foo()"の実行時にwindow.fooを探すため、橋渡しが無いとボタンを押しても
        // 静かに何も起きない（実際にこれで一度事故を起こした。解体新書 第9章参照）。削除する時は、
        // 他ファイルからのimport参照・index.html内の静的onclick・動的に組み立てられるonclick文字列の
        // 3経路すべてを確認すること。
        window.openShop = openShop;
        window.closeShop = closeShop;
        window.switchShopTab = switchShopTab;
        window.onGachaTabTap = onGachaTabTap;
        window.closeFurniturePreview = closeFurniturePreview;
        window.omiyagePageBy = omiyagePageBy;
