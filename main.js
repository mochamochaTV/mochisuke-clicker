// 他ファイルへの依存はすべてこのimportに明示されている。書き換えが必要な値はsetXxx(...)という
// 関数呼び出しの形にしている（importした束縛には直接代入できないため。ESモジュールの仕様）。
import {
  CORNER_BTN_ADJUST_TOOL_ENABLED, KISEKAE_ITEMS, MYROOM_ITEMS, SFX_FILES, dialogueData, stages
} from './data.js?v=2026-09-09-002';
import { resetMinigameCountsIfNewDay } from './minigames.js?v=2026-09-09-002';
import {
  checkAndRotateMissions, checkOfflineEarnings, checkStageProgress, currentStageIndex,
  currentStageProgress, equippedKisekae, ownedKisekaeItems, ownedMyroomItems, prestigeCount,
  selectedStageIndex, setCurrentStageProgress
} from './progress.js?v=2026-09-09-002';
import { currentShopTab, syncOmiyageImageFrame } from './shop.js?v=2026-09-09-002';
import {
  checkForCloudRestoreOnLoad, loadGame, playerName, saveGame, score, setScore, totalTapsCount
} from './state.js?v=2026-09-09-002';
import {
  bunshinCloneRects, endSkillVisualEffect, gameScreenRect, getMps, isFever, lastTappedTime,
  refreshBunshinCloneRects, resetMochiFilter, setGameScreenRect, skills, startFeverSpawningLoop,
  triggerFeverTime, updateSkillUI
} from './tap.js?v=2026-09-09-002';
import {
  applyCornerBtnPositions, applyKisekaeToMainScreen, checkIncomingGiftsOnLaunch, checkShowTutorial,
  getTimeGreeting, hideMochiComment, initMapInteractions, initVolumeSliders, isTutorialActive,
  showMochiComment, showOpeningGreeting, startIncomingRoomInviteWatch,
  startIncomingVisitStampWatch, updateCornerBtnReadout, updateDisplay
} from './ui.js?v=2026-09-09-002';

        // ⚙️ 調整用パラメータ集約：演出・タイミング・しきい値などの「数字だけ」をここにまとめている。
        // 値そのものは元のコードから一切変更していない（挙動は完全に同一）。グループごとに短い説明を付けてある。
        const CONFIG = {
            // 📲 インストール誘導・レイアウト計測
            IOS_INSTALL_BANNER_DELAY_MS: 4000,        // iOS端末で「ホーム画面に追加」バナーを出すまでの待機時間
            BOTTOM_GAP_THRESHOLD_PX: 0.5,             // この値を超える隙間があれば高さを強制的に足す
            BOTTOM_GAP_RETRY_DELAYS_MS: [50, 200, 500, 1000, 2000], // 起動直後の再計測リトライタイミング
            DOUBLE_TAP_PREVENT_WINDOW_MS: 15,         // 誤ダブルタップズーム防止の判定間隔

            // 🌧️ もちの雨
            MOCHI_RAIN_SPAWN_INTERVAL_MS: 1200,       // 生成抽選を行う間隔
            MOCHI_RAIN_MPS_SCALE: 40,                 // mpsがこの値の時に出現確率が100%になる
            MOCHI_RAIN_LOG_SCALE: 1.5,                // 一度に降らせる粒数を決めるlogのスケール
            MOCHI_RAIN_MAX_DROPS_PER_TICK: 3,         // 1回の抽選で追加する粒数の上限
            MOCHI_RAIN_SPAWN_Y_OFFSET: -20,           // 出現時のY座標（画面上端より少し上）
            MOCHI_RAIN_VY_MIN: 0.9,                   // 落下速度の最小値
            MOCHI_RAIN_VY_RANGE: 0.7,                 // 落下速度のランダム幅
            MOCHI_RAIN_VX_RANGE: 0.4,                 // 横方向の揺れ幅
            MOCHI_RAIN_ROT_SPEED_RANGE: 3,            // 回転速度のランダム幅
            MOCHI_RAIN_SIZE_MIN: 36,                  // 粒の大きさの最小値
            MOCHI_RAIN_SIZE_RANGE: 14,                // 粒の大きさのランダム幅

            // ✨ 環境スパークル（常時漂うキラキラ）
            AMBIENT_SPARKLE_SPAWN_INTERVAL_MS: 900,   // 生成間隔
            AMBIENT_SPARKLE_SPAWN_Y_OFFSET: 10,       // 画面下端より少し下から出現させる
            AMBIENT_SPARKLE_VX_RANGE: 0.25,           // 横方向の速度幅
            AMBIENT_SPARKLE_VY_MIN: 0.25,             // 上昇速度の最小値
            AMBIENT_SPARKLE_VY_RANGE: 0.35,           // 上昇速度のランダム幅
            AMBIENT_SPARKLE_SIZE_MIN: 1.5,            // 粒の大きさの最小値
            AMBIENT_SPARKLE_SIZE_RANGE: 2.5,          // 粒の大きさのランダム幅
            AMBIENT_SPARKLE_LIFE_MIN: 500,            // 寿命(フレーム数)の最小値
            AMBIENT_SPARKLE_LIFE_RANGE: 300,          // 寿命(フレーム数)のランダム幅
            AMBIENT_SPARKLE_MAX_COUNT: 18,            // 同時に存在できる最大数
            PARTICLE_IMG_FALLBACK_SIZE: 64,           // 画像サイズが取得できない時のフォールバック(px)

            // 🕐 時間帯・つぶやき
            TIME_BUCKET_MORNING_START: 5,             // 朝の開始時刻(時)
            TIME_BUCKET_NOON_START: 11,               // 昼の開始時刻(時)
            TIME_BUCKET_EVENING_START: 17,            // 夕方の開始時刻(時)
            TIME_BUCKET_LATENIGHT_START: 22,          // 深夜の開始時刻(時)
            MOCHI_LIFE_LOOP_INTERVAL_MS: 12000,       // つぶやき抽選ループの間隔
            MOCHI_IDLE_THRESHOLD_MS: 5000,            // これ以上未タップならつぶやきを検討する
            PREFECTURE_COMMENT_CHANCE: 0.4,           // ご当地セリフを混ぜる確率

            // 🔊 音量デフォルト
            DEFAULT_BGM_VOLUME_STORED: 0.3,           // localStorage未保存時のBGM音量初期値
            DEFAULT_SFX_VOLUME_STORED: 1,             // localStorage未保存時の効果音音量初期値
            FALLBACK_VOLUME_ON_PARSE_ERROR: 1,        // 保存値の解析に失敗した時のフォールバック音量
            DEFAULT_TAP_SFX_VOLUME: 0.6,              // playAudioFileの既定音量

            // 🎬 演出タイミング
            OP_SCREEN_FADE_OUT_MS: 650,               // OP画面が完全に消えるまでの時間
            SCREEN_SHAKE_DEBOUNCE_MS: 150,            // 短時間の連続シェイクを間引く間隔
            SCREEN_SHAKE_DURATION_MS: 400,            // シェイク演出の継続時間
            SCREEN_FLASH_DEFAULT_OPACITY: 0.35,       // フラッシュの既定の最大不透明度
            SCREEN_FLASH_DEBOUNCE_MS: 120,            // 短時間の連続フラッシュを間引く間隔
            REM_TO_PX: 16,                            // 1remを何pxとして扱うか

            // 💥 モーダル内DOM演出（particle-canvasより手前に出したい時用）
            MODAL_PARTICLE_BURST_DIST_MIN: 30,        // 弾け飛ぶ距離の最小値
            MODAL_PARTICLE_BURST_DIST_RANGE: 50,      // 弾け飛ぶ距離のランダム幅
            MODAL_PARTICLE_BURST_Y_BIAS: 20,          // 上方向にずらすバイアス
            MODAL_PARTICLE_BURST_LIFETIME_MS: 650,    // DOM要素を消すまでの時間
            MODAL_FLOATING_TEXT_LIFETIME_MS: 1150,    // DOM要素を消すまでの時間

            // 🎆 タップ演出（canvas共通）
            FLOATING_TEXT_MAX_COUNT: 40,              // 同時に存在できる浮き文字の最大数
            PARTICLE_MAX_COUNT: 50,                   // 同時に存在できるパーティクルの最大数
            PARTICLE_VX_RANGE: 15,                    // 横方向初速のランダム幅
            PARTICLE_VY_RANDOM_RANGE: 6,              // 縦方向初速のランダム幅
            PARTICLE_VY_BASE: 11,                     // 縦方向初速の基準値（上方向）
            PARTICLE_GRAVITY: 0.38,                   // 重力加速度

            // 🖼️ 描画ループ（updateAndRenderParticles）専用
            AMBIENT_FRAME_SKIP_MS: 33,                // アイドル時に描画を間引く閾値（約30fps）
            GOLD_PARTICLE_SHADOW_BLUR: 14,             // 金色パーティクルの発光の強さ
            GOLD_PARTICLE_DRAW_SIZE: 70,               // 金色パーティクルの描画サイズ(px)
            GOLD_PARTICLE_DRAW_OFFSET: 35,             // 描画サイズの半分（中心合わせ用オフセット）
            PARTICLE_DRAW_SIZE: 42,                    // 通常パーティクルの描画サイズ(px)
            PARTICLE_DRAW_OFFSET: 21,                  // 描画サイズの半分（中心合わせ用オフセット）
            PARTICLE_OFFSCREEN_MARGIN: 50,             // 画面外に出たと判定するまでの余白
            SPARKLE_FADE_IN_END: 0.15,                 // フェードイン完了とみなす経過割合
            SPARKLE_FADE_OUT_START: 0.8,               // フェードアウト開始とみなす経過割合
            SPARKLE_FADE_OUT_DURATION: 0.2,            // フェードアウトの割合幅
            SPARKLE_OUTER_RADIUS_MULT: 1.8,            // 外側の薄い円の半径倍率
            SPARKLE_OUTER_ALPHA: 0.16,                 // 外側の円の最大不透明度
            SPARKLE_INNER_ALPHA: 0.35,                 // 内側の円の最大不透明度
            RIPPLE_DURATION_MS: 400,                   // 波紋アニメーションの継続時間
            RIPPLE_PEAK_ALPHA: 0.6,                    // 波紋の開始時の不透明度
            RIPPLE_LINE_WIDTH: 4,                      // 波紋の線の太さ
            RIPPLE_MAX_RADIUS: 65,                     // 波紋が広がる最大半径
            FLOATING_TEXT_DURATION_MS: 600,            // 浮き文字アニメーションの継続時間
            FLOATING_TEXT_RISE_PHASE_END: 0.2,         // 上昇フェーズが終わるとみなす経過割合
            FLOATING_TEXT_SCALE_START: 0.8,            // 上昇フェーズ開始時の拡大率
            FLOATING_TEXT_SCALE_RISE_RANGE: 0.4,       // 上昇フェーズでの拡大率の増加幅
            FLOATING_TEXT_RISE_Y: 10,                  // 上昇フェーズでのY移動量
            FLOATING_TEXT_FALL_PHASE_RANGE: 0.8,       // 下降フェーズの割合幅
            FLOATING_TEXT_SCALE_PEAK: 1.2,             // 下降フェーズ開始時の拡大率
            FLOATING_TEXT_SCALE_FALL_RANGE: 0.2,       // 下降フェーズでの拡大率の減少幅
            FLOATING_TEXT_FALL_Y_RANGE: 50,            // 下降フェーズでのY移動幅
            FLOATING_TEXT_STROKE_WIDTH: 4,             // 文字の縁取りの太さ

            // 💴 表示・デバッグ
            MOCHI_UNIT_OKU: 1e8,                      // 億の閾値
            MOCHI_UNIT_CHO: 1e12,                     // 兆の閾値
            MOCHI_UNIT_KEI: 1e16,                     // 京の閾値
            MOCHI_UNIT_GAI: 1e20,                     // 垓の閾値
            MAX_CAPTURED_ERRORS: 8,                   // 保持しておくエラーログの最大件数
            DEBUG_ADD_MOCHI_FALLBACK: 1000000,        // ステージ情報が無い時のデバッグ加算量

            // 🚀 起動シーケンス（window.onload）
            GIFT_CHECK_DELAY_MS: 2000,                // 起動後、届いたギフト確認を始めるまでの待機時間
            ROOM_INVITE_WATCH_DELAY_MS: 3500,         // 部屋招待の監視を始めるまでの待機時間
            VISIT_STAMP_WATCH_DELAY_MS: 3500,         // 訪問スタンプの監視を始めるまでの待機時間
            HEARTBEAT_INTERVAL_MS: 60000,             // オンライン通知の送信間隔
            TUTORIAL_CHECK_DELAY_MS: 1200,            // チュートリアル表示判定までの待機時間
            AUTOSAVE_INTERVAL_MS: 10000,              // オートセーブ・ランキング送信の間隔

            // 🎁 プレゼント・黄金もちの出現演出
            EVENT_SPAWN_Y_RANGE_MARGIN: 350,          // 出現Y座標の範囲を決める上下マージン
            EVENT_SPAWN_Y_MIN: 160,                   // 出現Y座標の最小値
            PRESENT_Z_INDEX: 95,                      // プレゼント要素の重なり順
            PRESENT_START_X: -110,                    // 出現開始時のX座標（画面外左）
            PRESENT_END_X_MARGIN: 220,                // 画面外へ抜けるまでのX方向の余白
            PRESENT_ANIMATION_START_DELAY_MS: 50,     // 横移動アニメーションを開始するまでの待機時間
            PRESENT_BURST_PARTICLE_COUNT: 10,         // 割れた時に飛び散る白いもちの数
            PRESENT_BURST_ANGLE_JITTER: 0.3,          // 飛び散る角度のランダムなブレ
            PRESENT_BURST_DIST_MIN: 30,               // 飛び散る距離の最小値
            PRESENT_BURST_DIST_RANGE: 20,             // 飛び散る距離のランダム幅
            PRESENT_POP_VIBRATION_PATTERN: [20, 30, 60], // 割れた瞬間の振動パターン
            PRESENT_LIFETIME_MS: 11000,               // タップされなかった場合に自動消滅するまでの時間
            GOLD_MOCHI_X_MARGIN: 80,                  // 出現X座標の右側マージン
            GOLD_MOCHI_LIFETIME_MS: 6000,             // タップされなかった場合に自動消滅するまでの時間
        };

        // 🚧🚧🚧 メンテナンスモード 🚧🚧🚧
        // 大きな更新をする直前に true にしてから公開すると、プレイヤーには「メンテナンス中」画面だけが表示され、
        // ゲーム本体・セーブ/ロード・クラウドバックアップは一切動かなくなる（壊れた状態が保存されてしまう事故を防ぐ）。
        // 手元で動作確認が終わったら、false に戻して公開し直す。
        export const MAINTENANCE_MODE = false;

        // 画面の実測高さ(--app-height)は<head>内で先に設定済み。ここでは重複させない。

        // 📲 ホーム画面に追加まわり
        // PWA化(manifest+ServiceWorker)しただけでは自動でホーム画面に追加はされない。
        // ・Android/Chrome系 → beforeinstallpromptイベントを捕まえて自前ボタンから誘導すれば即インストール可
        // ・iOS Safari → ブラウザ側に自動インストールAPIが無いため「共有→ホーム画面に追加」を手動案内するしかない
        export let deferredInstallPrompt = null;
        export const installBanner = document.getElementById('install-banner');
        export const installBannerText = document.getElementById('install-banner-text');
        export const installBannerAction = document.getElementById('install-banner-action');
        export const installBannerClose = document.getElementById('install-banner-close');
        export const INSTALL_DISMISS_KEY = 'punicker_install_dismissed_v1';

        /**
         * PWAとしてホーム画面から起動されている（standaloneモード）かどうかを判定する。
         * @returns {boolean} standaloneモードで実行中ならtrue
         */
        export function isRunningStandalone() {
            return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        }

        /**
         * OS/ブラウザの種類に応じて文言を出し分け、ホーム画面追加を促すバナーを表示する。
         * @param {string} mode - バナーの種類（'android' | 'ios-inapp' | それ以外はios想定）
         * @returns {void}
         */
        export function showInstallBanner(mode) {
            if (isRunningStandalone() || localStorage.getItem(INSTALL_DISMISS_KEY)) return;
            if (mode === 'android') {
                installBannerText.innerText = '📲 ホーム画面に追加すると次回から一瞬で起動できます';
                installBannerAction.style.display = 'inline-block';
            } else if (mode === 'ios-inapp') {
                // X・LINE・Discordなどのアプリ内ブラウザは、Safari自体が持つ「ホーム画面に追加」機能を使えないため、
                // まず外部のSafariで開き直してもらう必要がある（ウェブサイト側では回避できない、iOS側の制限）
                installBannerText.innerText = '📲 ホーム画面に追加するには、右上のメニューから「Safariで開く」を選んでから、共有ボタン→「ホーム画面に追加」を選んでください';
                installBannerAction.style.display = 'none';
            } else {
                installBannerText.innerText = '📲 共有ボタン → 「ホーム画面に追加」でアプリのように使えます';
                installBannerAction.style.display = 'none';
            }
            installBanner.style.display = 'flex';
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            showInstallBanner('android');
        });

        installBannerAction.addEventListener('click', async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            installBanner.style.display = 'none';
        });

        installBannerClose.addEventListener('click', () => {
            installBanner.style.display = 'none';
            localStorage.setItem(INSTALL_DISMISS_KEY, '1');
        });

        window.addEventListener('appinstalled', () => {
            installBanner.style.display = 'none';
            deferredInstallPrompt = null;
        });

        // iOSはbeforeinstallpromptが発火しないため、UAで判定して案内バナーを出す
        export const ua = navigator.userAgent.toLowerCase();
        export const isIOSDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        // X・LINE・Discord・Instagram・Facebookなどのアプリ内ブラウザを検出（それぞれUAに特徴的な文字列が入る）
        export const isInAppBrowser = /line\/|fban|fbav|instagram|discord|twitter/.test(ua);
        if (isIOSDevice) {
            setTimeout(() => showInstallBanner(isInAppBrowser ? 'ios-inapp' : 'ios'), CONFIG.IOS_INSTALL_BANNER_DELAY_MS);
        }

        // 📏 下の余白を「測って強制的に埋める」最終手段
        // 100vh/100dvh/JS実測のvh変数/position:fixed+inset:0、と何を試してもiPhoneのPWAで
        // 下に隙間が残るケースがあったため、今回はCSSの単位を信じるのをやめ、
        // 実際に画面の下端と#game-screenの下端の差(px)を毎回測って、その分だけ
        // 高さを強制的に足す方式に変更した。原因の理屈が何であれ、実測して埋めるので確実に効く。
        /**
         * #game-screenの下端と画面実測下端との隙間を測り、隙間があればその分だけ高さを強制的に足す。
         * @returns {void}
         */
        export function fixBottomGap() {
            const gs = document.getElementById('game-screen');
            if (!gs) return;
            gs.style.height = ''; // 一旦flexの自然な高さに戻す
            requestAnimationFrame(() => {
                const rect = gs.getBoundingClientRect();
                const trueHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
                const gap = trueHeight - rect.bottom;
                if (gap > CONFIG.BOTTOM_GAP_THRESHOLD_PX) {
                    gs.style.height = (rect.height + gap) + 'px';
                }
            });
        }
        window.addEventListener('load', fixBottomGap);
        window.addEventListener('resize', fixBottomGap);
        window.addEventListener('orientationchange', fixBottomGap);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', fixBottomGap);
        // iOS standaloneは起動直後、数値が数百ms遅れて確定することがあるため複数回リトライする
        CONFIG.BOTTOM_GAP_RETRY_DELAYS_MS.forEach((ms) => setTimeout(fixBottomGap, ms));

        // ☰ メニュー機能
        // ✏️ 意見・要望の送信（サーバーが無いので、メールアプリに下書きを渡す形にしています。
        // 実際に使う時は下のFEEDBACK_EMAILを自分の受け取りたいメールアドレスに書き換えてください）
        export const FEEDBACK_EMAIL = 'your-email@example.com';
        /**
         * フィードバック用テキストエリアの内容を、Firebase経由の送信が使えればそちらへ送り、
         * 使えない/失敗した場合はmailtoリンクでメールアプリへの下書き渡しにフォールバックする。
         * @returns {Promise<void>}
         */
        export async function sendFeedback() {
            const textEl = document.getElementById('feedback-text');
            const text = textEl.value.trim();
            if (!text) { alert("意見を入力してから送信してください！"); return; }

            if (window.submitFeedback && window.isRankingReady && window.isRankingReady()) {
                const ok = await window.submitFeedback(text, playerName);
                if (ok) {
                    alert("送信しました！ありがとうございます🍡");
                    textEl.value = '';
                    return;
                }
            }
            // Firebaseが使えない場合はメールへフォールバック
            const subject = encodeURIComponent('【ぷにっかー】ご意見');
            const body = encodeURIComponent(text);
            window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
        }

        // 🖼️ 画面写真モード切替（もちすけ/スキル/もち数だけ → もちすけ+背景だけ → 背景だけ → 元通り）
        export let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= CONFIG.DOUBLE_TAP_PREVENT_WINDOW_MS) e.preventDefault();
            lastTouchEnd = now;
        }, { passive: false });

        export let isBgmInitialized = false;
        export let canvas = null; export let ctx = null; export let particleList = [];
        export let rainCanvas = null; export let rainCtx = null;
        // 🌧️ もちの雨（自動増加(mps)がある時、もちすけの後ろにうっすら降ってくる。収入が少ない時はほとんど降らない）
        export let mochiRainList = [];
        export const MOCHI_RAIN_MAX = 10;
        /**
         * 自動増加(mps)の大きさに応じた確率・個数で「もちの雨」の粒をmochiRainListへ追加する。
         * @returns {void}
         */
        export function spawnMochiRain() {
            const mps = getMps();
            // 🐛パフォーマンス修正：モーダルが開いていてタップ画面が見えていない間は、どうせ見えない
            // もちの雨を新しく降らせても無駄なので生成自体を止める（描画側もモーダル中は丸ごと止めている）
            if (!rainCanvas || mps <= 0 || document.hidden || document.body.classList.contains('modal-open')) return;
            if (mochiRainList.length >= MOCHI_RAIN_MAX) return; // 上限に達している間は新規追加を控える（既存の粒を消して落下を妨げないため）
            // mpsが小さいうちは滅多に降らないようにし、育つにつれて自然に増える
            const spawnChance = Math.min(1, mps / CONFIG.MOCHI_RAIN_MPS_SCALE);
            if (Math.random() > spawnChance) return;
            const dropCount = Math.min(CONFIG.MOCHI_RAIN_MAX_DROPS_PER_TICK, Math.max(1, Math.floor(Math.log10(mps + 1) / CONFIG.MOCHI_RAIN_LOG_SCALE)));
            for (let i = 0; i < dropCount; i++) {
                if (mochiRainList.length >= MOCHI_RAIN_MAX) break;
                mochiRainList.push({
                    x: Math.random() * rainCanvas.width,
                    y: CONFIG.MOCHI_RAIN_SPAWN_Y_OFFSET,
                    vy: CONFIG.MOCHI_RAIN_VY_MIN + Math.random() * CONFIG.MOCHI_RAIN_VY_RANGE,
                    vx: (Math.random() - 0.5) * CONFIG.MOCHI_RAIN_VX_RANGE,
                    rot: Math.random() * 360,
                    rotSpeed: (Math.random() - 0.5) * CONFIG.MOCHI_RAIN_ROT_SPEED_RANGE,
                    size: CONFIG.MOCHI_RAIN_SIZE_MIN + Math.random() * CONFIG.MOCHI_RAIN_SIZE_RANGE
                });
            }
        }
        setInterval(spawnMochiRain, CONFIG.MOCHI_RAIN_SPAWN_INTERVAL_MS);
        // ✨ 常時ふわふわ漂う環境パーティクル（タップしていない時も画面に生命感を出す）
        export let ambientSparkles = [];
        /**
         * canvas上をゆっくり漂う環境パーティクル（キラキラ）を1個ambientSparklesへ追加する。
         * @returns {void}
         */
        export function spawnAmbientSparkle() {
            // 🐛パフォーマンス修正：このキラキラも spawnMochiRain と同じくタップ画面専用の演出。
            // モーダルが開いていて画面が見えていない間は生成しても無駄なので止める
            if (!canvas || document.hidden || document.body.classList.contains('modal-open')) return;
            ambientSparkles.push({
                x: Math.random() * canvas.width,
                y: canvas.height + CONFIG.AMBIENT_SPARKLE_SPAWN_Y_OFFSET,
                vx: (Math.random() - 0.5) * CONFIG.AMBIENT_SPARKLE_VX_RANGE,
                vy: -(CONFIG.AMBIENT_SPARKLE_VY_MIN + Math.random() * CONFIG.AMBIENT_SPARKLE_VY_RANGE),
                size: CONFIG.AMBIENT_SPARKLE_SIZE_MIN + Math.random() * CONFIG.AMBIENT_SPARKLE_SIZE_RANGE,
                life: 0,
                maxLife: CONFIG.AMBIENT_SPARKLE_LIFE_MIN + Math.random() * CONFIG.AMBIENT_SPARKLE_LIFE_RANGE
            });
            if (ambientSparkles.length > CONFIG.AMBIENT_SPARKLE_MAX_COUNT) ambientSparkles.shift(); // 増えすぎ防止
        }
        setInterval(spawnAmbientSparkle, CONFIG.AMBIENT_SPARKLE_SPAWN_INTERVAL_MS);
        export const particleImg = new Image(); particleImg.src = 'ui_images/mochisuke/mochi_particle.webp';
        // ctx.filter (hue-rotate/drop-shadow) はスマホブラウザ(特にiOS Safari)で
        // 正しく適用されないことがあるため、金色版画像を事前に1回だけ焼き込んで使い回す
        export let goldParticleImg = null;
        particleImg.onload = () => {
            try {
                const w = particleImg.naturalWidth || particleImg.width || CONFIG.PARTICLE_IMG_FALLBACK_SIZE;
                const h = particleImg.naturalHeight || particleImg.height || CONFIG.PARTICLE_IMG_FALLBACK_SIZE;
                const off = document.createElement('canvas');
                off.width = w; off.height = h;
                const octx = off.getContext('2d');
                octx.drawImage(particleImg, 0, 0, w, h);
                octx.globalCompositeOperation = 'source-atop';
                octx.fillStyle = 'rgba(255, 196, 0, 0.55)';
                octx.fillRect(0, 0, w, h);
                octx.fillStyle = 'rgba(255, 235, 140, 0.25)';
                octx.fillRect(0, 0, w, h);
                goldParticleImg = off;
            } catch (e) { goldParticleImg = null; }
        };

        /**
         * 渡された配列からランダムなインデックスの要素を1つ返す汎用ヘルパー。
         * @param {Array} arr - 抽選対象の配列
         * @returns {*} 配列からランダムに選ばれた1要素
         */
        export function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

        // もちすけの吹き出しにテキストを表示するヘルパー（イベント時にどこからでも呼べます）
        /**
         * 0〜23の時刻を、朝(0)/昼(1)/夕方(2)/深夜(3)の4区分いずれかのインデックスに変換する。
         * @param {number} h - 時刻（0〜23）
         * @returns {number} 時間帯インデックス（0〜3）
         */
        export function getTimeBucketIndex(h) {
            if (h >= CONFIG.TIME_BUCKET_MORNING_START && h < CONFIG.TIME_BUCKET_NOON_START) return 0;  // morning
            if (h >= CONFIG.TIME_BUCKET_NOON_START && h < CONFIG.TIME_BUCKET_EVENING_START) return 1; // noon
            if (h >= CONFIG.TIME_BUCKET_EVENING_START && h < CONFIG.TIME_BUCKET_LATENIGHT_START) return 2; // evening
            return 3;                        // lateNight
        }

        // 今の時間帯に合った挨拶をランダムで1つ返す
        export let lastGreetingHourBucket = -1;
        // 📖 初回チュートリアル：もちすけのセリフで進行し、該当ボタンを光らせながら説明する。
        // 他のボタンは（もちすけ本体を除いて）誤操作防止のため一時的に押せなくする。
        export let audioCtx = null;
        export const audioBuffers = {};        // fileName -> デコード済みAudioBuffer
        export const audioBufferPromises = {}; // fileName -> デコード中のPromise（二重読み込み防止）

        /**
         * Web Audio APIのAudioContextをシングルトンとして取得する。未生成なら新規作成する。
         * @returns {AudioContext} 共有のAudioContextインスタンス
         */
        export function getAudioContext() {
            if (!audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AC();
            }
            return audioCtx;
        }

        /**
         * 音声ファイルをfetch→decodeAudioDataでAudioBuffer化し、audioBuffersにキャッシュする。
         * デコード済み/デコード中の場合はそれを再利用し、二重読み込みを防ぐ。
         * @param {string} fileName - 読み込む音声ファイルのパス
         * @returns {Promise<AudioBuffer|null>} デコード済みAudioBuffer（失敗時はnull）
         */
        export function loadAudioBuffer(fileName) {
            if (audioBuffers[fileName]) return Promise.resolve(audioBuffers[fileName]);
            if (audioBufferPromises[fileName]) return audioBufferPromises[fileName];
            const ctx = getAudioContext();
            const promise = fetch(fileName)
                .then((res) => res.arrayBuffer())
                .then((data) => ctx.decodeAudioData(data))
                .then((buffer) => { audioBuffers[fileName] = buffer; return buffer; })
                .catch(() => null);
            audioBufferPromises[fileName] = promise;
            return promise;
        }

        /**
         * data.jsのSFX_FILES一覧をすべてloadAudioBufferへ渡し、事前にロードしておく。
         * @returns {void}
         */
        export function preloadAllSfx() {
            SFX_FILES.forEach(loadAudioBuffer);
        }

        // 🔊 音量設定（BGM/効果音を別々に調整できる。0〜1の倍率としてlocalStorageに保存）
        export let bgmVolumeMult = parseFloat(localStorage.getItem('punicker_bgm_volume') ?? String(CONFIG.DEFAULT_BGM_VOLUME_STORED));
        export let sfxVolumeMult = parseFloat(localStorage.getItem('punicker_sfx_volume') ?? String(CONFIG.DEFAULT_SFX_VOLUME_STORED));
        if (isNaN(bgmVolumeMult)) bgmVolumeMult = CONFIG.FALLBACK_VOLUME_ON_PARSE_ERROR;
        if (isNaN(sfxVolumeMult)) sfxVolumeMult = CONFIG.FALLBACK_VOLUME_ON_PARSE_ERROR;

        // 🎵 BGM再生システム（Web Audio API方式）
        // 【重要】iOSのSafariは<audio>要素の.volumeプロパティを完全に無視する仕様がある
        // （音量はハードウェアの音量ボタンでしか変えられないようにする、というAppleの意図的な制限）。
        // 効果音は既にWeb Audio APIのGainNodeで音量調整していたので問題なかったが、
        // BGMだけ従来の<audio>要素のままだったため、スライダーを動かしても一切変化しなかった。
        // BGMもGainNode経由の再生に統一し、これで確実に音量調整できるようにする。
        export let bgmGainNode = null;
        export let bgmSourceNode = null;
        export let currentBgmFile = null;

        /**
         * BGM用のGainNodeが無ければAudioContext上に作成し、現在のbgmVolumeMultを設定して接続する。
         * @returns {GainNode} BGM用のGainNode
         */
        export function ensureBgmGain() {
            if (!bgmGainNode) {
                const ctx = getAudioContext();
                bgmGainNode = ctx.createGain();
                bgmGainNode.gain.value = bgmVolumeMult;
                bgmGainNode.connect(ctx.destination);
            }
            return bgmGainNode;
        }

        /**
         * 指定ファイルを新しいBufferSourceでループ再生する。既に同じ曲が再生中なら何もしない。
         * @param {string} fileName - 再生するBGMファイルのパス
         * @returns {void}
         */
        export function playBgmLoop(fileName) {
            if (currentBgmFile === fileName && bgmSourceNode) return;
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const gain = ensureBgmGain();
            loadAudioBuffer(fileName).then((buffer) => {
                if (!buffer) return;
                if (bgmSourceNode) { try { bgmSourceNode.stop(); } catch (e) {} }
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                source.connect(gain);
                source.start(0);
                bgmSourceNode = source;
                currentBgmFile = fileName;
            });
        }

        /**
         * 再生中のBGM(bgmSourceNode)があれば停止し、状態をリセットする。
         * @returns {void}
         */
        export function stopBgm() {
            if (bgmSourceNode) { try { bgmSourceNode.stop(); } catch (e) {} bgmSourceNode = null; currentBgmFile = null; }
        }

        /**
         * bgmGainNodeが存在すれば、そのgain.valueを現在のbgmVolumeMultの値に更新する。
         * @returns {void}
         */
        export function applyBgmVolume() {
            if (bgmGainNode) bgmGainNode.gain.value = bgmVolumeMult;
        }

        /**
         * デコード済みAudioBufferを即座に再生する内部ヘルパー。
         * @param {AudioBuffer} buffer - 再生するAudioBuffer
         * @param {number} vol - 音量（sfxVolumeMultと掛け合わされる）
         * @param {number} [rate=1] - 再生速度（ピッチ）
         * @returns {void}
         */
        export function playBufferNow(buffer, vol, rate = 1) {
            const ctx = getAudioContext();
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = rate;
            const gain = ctx.createGain();
            gain.gain.value = vol * sfxVolumeMult;
            source.connect(gain).connect(ctx.destination);
            source.start(0);
        }

        /**
         * 効果音再生の主入口。AudioContextを起こしてから、デコード済みなら即再生、未デコードならロード後に再生する。
         * @param {string} fileName - 再生する音声ファイルのパス
         * @param {number} [vol=0.6] - 音量（0〜1）
         * @returns {void}
         */
        export function playAudioFile(fileName, vol = CONFIG.DEFAULT_TAP_SFX_VOLUME) {
            // alert()などのブロッキングダイアログの後、AudioContextがsuspendedのまま
            // 二度と再生されなくなるバグ対策：鳴らす直前に毎回、寝ていたら起こす
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});

            const buffer = audioBuffers[fileName];
            if (buffer) {
                playBufferNow(buffer, vol);
            } else {
                // まだデコードが終わっていない場合（通常は起動直後の一瞬だけ）は、終わり次第再生する
                loadAudioBuffer(fileName).then((buf) => { if (buf) playBufferNow(buf, vol); });
            }
        }

        // ピッチを変えて再生する版（ミニゲームの連続成功演出などで使用）
        /**
         * playAudioFileと同様の仕組みで再生速度(pitch)を指定できる版。
         * @param {string} fileName - 再生する音声ファイルのパス
         * @param {number} vol - 音量（0〜1）
         * @param {number} rate - 再生速度（ピッチ）
         * @returns {void}
         */
        export function playAudioFilePitched(fileName, vol, rate) {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const buffer = audioBuffers[fileName];
            if (buffer) {
                playBufferNow(buffer, vol, rate);
            } else {
                loadAudioBuffer(fileName).then((buf) => { if (buf) playBufferNow(buf, vol, rate); });
            }
        }

        // 🔓 iOSの音声再生ロック解除
        // 画面に触れるたびにAudioContextの状態を確認し、寝ていたら起こす。
        // 以前は「最初の1回だけ」解錠していたが、alert()などのブロッキングダイアログを挟むと
        // AudioContextが勝手にsuspendedへ戻ってしまい、それ以降ずっと無音になるバグがあったため、
        // 一度きりではなく毎回のタップとアプリ復帰時にチェックするようにした。
        /**
         * AudioContextがsuspended状態なら resume() して音声再生ロックを解除する。
         * @returns {void}
         */
        export function unlockAllPooledAudio() {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        }
        document.addEventListener('pointerdown', unlockAllPooledAudio, { capture: true });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') unlockAllPooledAudio();
        });

        // ※以前はここで画面のどこをタップしてもtap.mp3が鳴るグローバル監視をしていたが、
        // もちすけ以外（背景など）をタップしても音が鳴ってしまう原因になっていたため削除。
        // タップ音はもちすけ本体（下のpointerdownハンドラ）と、必殺技中の「どこでも連打」時のみ鳴る。

        export const capturedErrors = [];
        window.addEventListener('error', (e) => {
            capturedErrors.push(`[JSエラー] ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);
            if (capturedErrors.length > CONFIG.MAX_CAPTURED_ERRORS) capturedErrors.shift();
        });
        window.addEventListener('unhandledrejection', (e) => {
            capturedErrors.push(`[Promiseエラー] ${e.reason}`);
            if (capturedErrors.length > CONFIG.MAX_CAPTURED_ERRORS) capturedErrors.shift();
        });

        /* 🛠️ 開発者専用メニュー：URLに ?dev=1 を付けた時だけ有効になる（通常プレイヤーには一切見えない） */
        export let IS_DEV_MODE = false;
        /**
         * URLの?dev=1（固定キー）またはlocalStorageの記憶フラグから開発者モードかどうかを判定し、
         * 該当すればIS_DEV_MODEをtrueにして開発者ツールパネルを表示する。
         * @returns {void}
         */
        export function initDevMode() {
            // 推測されないよう、単純な値ではなく長いランダムな文字列をキーにしている
            const isDevParam = new URLSearchParams(location.search).get('dev') === 'zk9m2xq7wv4p8trh21bs';
            // 🐛修正：PWAとしてホーム画面に追加すると、manifest.jsonの固定start_urlが使われ、
            // クエリパラメータが失われてしまう。一度でも管理者URLでアクセスしたら、
            // localStorageに記憶しておき、以後クエリパラメータが無くてもdevモードを維持する
            if (isDevParam) {
                try { localStorage.setItem('punicker_dev_mode', '1'); } catch (e) {}
            }
            let isDevStored = false;
            try { isDevStored = localStorage.getItem('punicker_dev_mode') === '1'; } catch (e) {}
            const isDev = isDevParam || isDevStored;
            if (!isDev) return;
            IS_DEV_MODE = true;
            window.IS_DEV_MODE = true; // Firebase送信は別のtype="module"スクリプトにあるため、windowを通して橋渡しする
            const section = document.getElementById('dev-tools-section');
            if (section) section.style.display = 'block';
        }

        /**
         * デバッグ用。現在のステージの距離ぶんをscoreに加算し、進捗・表示更新・セーブまで行う。
         * @returns {void}
         */
        export function debugAddMochi() {
            const currentReq = stages[currentStageIndex] ? stages[currentStageIndex].distance : CONFIG.DEBUG_ADD_MOCHI_FALLBACK;
            setScore(score + (currentReq));
            if (selectedStageIndex === currentStageIndex && currentStageIndex < stages.length) {
                setCurrentStageProgress(currentStageProgress + (currentReq)); checkStageProgress();
            }
            updateDisplay(); saveGame();
        }

        /**
         * デバッグ用。指定キーのスキルのlvを1つ上げ、レベルアップ音を鳴らしてUI更新・セーブする。
         * @param {string} key - スキルのキー
         * @returns {void}
         */
        export function debugLevelUpSkill(key) {
            skills[key].lv++;
            playAudioFile('audio/levelup.mp3');
            updateSkillUI(); saveGame();
        }

        /**
         * デバッグ用。全スキルのlvを一括で+1し、レベルアップ音を鳴らしてUI更新・セーブし、完了をalertで知らせる。
         * @returns {void}
         */
        export function debugLevelUpAllSkills() {
            Object.keys(skills).forEach(key => { skills[key].lv++; });
            playAudioFile('audio/levelup.mp3');
            updateSkillUI(); saveGame();
            alert("⚡ すべてのスキル・必殺技を即時獲得＆Lv+1しました！");
        }

        /**
         * デバッグ用。全スキルのcurrentCd/activeTimerを0にリセットし、演出も終了させてUI更新後アラートで通知する。
         * @returns {void}
         */
        export function debugResetCooldowns() {
            Object.keys(skills).forEach(key => {
                skills[key].currentCd = 0; skills[key].activeTimer = 0;
                endSkillVisualEffect(key);
            });
            updateSkillUI();
            alert("⏳ 全スキルのクールタイムをリセットしました！");
        }

        // 👄 口パーツを、実際のゲーム画面上で直接ドラッグして位置調整するモード（デバイスによるズレを避けるため）
        /**
         * isBgmInitializedフラグで多重初期化を防ぎつつ、通常BGMのループ再生を開始する。
         * @returns {void}
         */
        export function initAndPlayBGM() {
            if (isBgmInitialized) return;
            isBgmInitialized = true;
            playBgmLoop('audio/bgm/bgm.mp3');
        }

        // 🎬 OP画面をタップしてゲームへ。ブラウザの仕様上「一切操作なしで音を鳴らす」ことはiOSではできないが、
        // どのみちOP画面をタップしないとゲームに入れない作りなので、そのタップの瞬間にBGMを鳴らせば
        // 体感的には「ゲームを開いたら音楽が鳴る」とほぼ同じ感覚になる。
        /**
         * initAndPlayBGM()でBGMを鳴らし、#op-screenをフェードアウトさせた後に完全に隠す。
         * @returns {void}
         */
        export function startGameFromOpScreen() {
            initAndPlayBGM();
            const op = document.getElementById('op-screen');
            if (op) {
                op.classList.add('op-hide');
                setTimeout(() => { op.style.display = 'none'; }, CONFIG.OP_SCREEN_FADE_OUT_MS);
            }
        }

        /**
         * #game-screenの矩形をキャッシュし直し、雨用canvasとパーティクル用canvasの幅・高さを合わせて更新する。
         * @returns {void}
         */
        export function resizeParticleCanvas() {
            const rect = document.getElementById('game-screen').getBoundingClientRect();
            setGameScreenRect(rect); // タップ演出（リップル/文字/パーティクル）で使い回すキャッシュ
            if (bunshinCloneRects.length > 0) refreshBunshinCloneRects();
            if (rainCanvas) { rainCanvas.width = rect.width; rainCanvas.height = rect.height; }
            if (!canvas) return;
            canvas.width = rect.width; canvas.height = rect.height;
        }
        /**
         * tap.js側が保持するgameScreenRectのキャッシュを返す。無ければ都度取得する。
         * @returns {DOMRect} #game-screenの矩形
         */
        export function getGameScreenRect() {
            return gameScreenRect || document.getElementById('game-screen').getBoundingClientRect();
        }

        // #game-screenの背景と同じ画像をbodyにも敷いておく。
        // これで万一OS側のビューポート計算のクセで数十px程度のズレが残っても、
        // 見えるのは同じ背景の続きになるので「白い余白」としては目立たなくなる。
        /**
         * 背景画像を先読みしてから#game-screenとdocument.bodyの背景画像を同時に切り替える。
         * @param {string} url - 背景画像のURL
         * @returns {void}
         */
        export function setGameBackground(url) {
            const gameScreen = document.getElementById('game-screen');
            const bgCss = `url('${url}')`;
            // 先読みしてから切り替えることで、読み込み中に背景が真っ白/壊れて見える瞬間を防ぐ
            const preloader = new Image();
            preloader.onload = preloader.onerror = () => {
                gameScreen.style.backgroundImage = bgCss;
                document.body.style.backgroundImage = bgCss;
            };
            preloader.src = url;
        }

        // 長押しでの画像保存・コンテキストメニューを防ぐ（iOS向けCSSだけではChrome/Android系で漏れることがあるための保険）
        // ただし入力欄では、右クリックでの貼り付け等を邪魔しないよう対象外にする
        document.addEventListener('contextmenu', (e) => {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
        });

        window.onload = function() {
            if (MAINTENANCE_MODE) {
                document.body.innerHTML = `
                    <div style="position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
                                background:#fcf8f2; text-align:center; padding:24px; box-sizing:border-box; font-family:sans-serif;">
                        <div style="font-size:3rem; margin-bottom:12px;">🔧</div>
                        <h2 style="color:#5d4037; margin:0 0 10px;">ただいまメンテナンス中です</h2>
                        <p style="color:#8d6e63; font-size:0.9rem; margin:0;">アップデート作業を行っています。<br>もうしばらくしてから、もう一度開いてみてください。</p>
                    </div>
                `;
                return; // これ以降の初期化（セーブ・ロード・クラウド送信を含む）は一切実行しない
            }
            initDevMode();
            if (isRunningStandalone()) document.body.classList.add('is-standalone'); // ホーム画面追加版だけの見た目調整に使う
            // Safariのタブでそのまま開かれている場合（ホーム画面追加のスタンドアロンではない場合）は、
            // 上下のブラウザUI(URLバー・共有ボタン等)ぶん表示領域が狭くなるので、レイアウトの余白を少し詰める
            if (!isRunningStandalone()) document.body.classList.add('browser-tab-mode');

            canvas = document.getElementById('particle-canvas');
            ctx = canvas.getContext('2d');
            rainCanvas = document.getElementById('mochi-rain-canvas');
            rainCtx = rainCanvas.getContext('2d');
            resizeParticleCanvas();
            window.addEventListener('resize', resizeParticleCanvas);
            window.addEventListener('orientationchange', resizeParticleCanvas);
            if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeParticleCanvas);

            preloadAllSfx(); // 会心・黄金など出現頻度の低い効果音も先に読み込んでおき、初回再生の遅延を防ぐ

            loadGame();
            applyKisekaeToMainScreen(); // 🐛修正：確定済みの服装が、ページを開き直すと反映されないままだった
            checkAndRotateMissions(); // 日付・週が変わっていたら、デイリー/ウィークリーミッションを選び直す
            applyCornerBtnPositions();
            // 🚧 座標が確定したので、いったんパネルを非表示にしている。また使う時はCORNER_BTN_ADJUST_TOOL_ENABLEDをtrueに戻すだけでOK
            if (IS_DEV_MODE && CORNER_BTN_ADJUST_TOOL_ENABLED) {
                const panel = document.getElementById('corner-btn-adjust-panel');
                if (panel) { panel.style.display = 'block'; updateCornerBtnReadout(); }
            }
            setTimeout(checkIncomingGiftsOnLaunch, CONFIG.GIFT_CHECK_DELAY_MS); // Firebase接続が整うのを少し待ってから確認する
            // 🐛修正：招待・スタンプの検知は、以前は45秒/20秒おきのポーリングだったため届くまで
            // 数十秒の時間差があった。onSnapshotによるリアルタイム監視に変更（起動時に1回だけ開始すればよい）
            setTimeout(startIncomingRoomInviteWatch, CONFIG.ROOM_INVITE_WATCH_DELAY_MS); // ギフト通知と重ならないよう、少し後にずらす
            setTimeout(startIncomingVisitStampWatch, CONFIG.VISIT_STAMP_WATCH_DELAY_MS);
            if (window.sendHeartbeat) { window.sendHeartbeat(); setInterval(window.sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL_MS); } // 🟢 60秒おきに、自分がオンラインであることを知らせる
            // 🎫 着せ替えアイテムは、まだガチャ実装前なので、開発者URLの人だけ全部持っている状態にする
            // 🐛修正：loadGame()より前にやると、セーブデータの読み込みで上書きされて消えてしまっていた
            if (IS_DEV_MODE) {
                Object.keys(KISEKAE_ITEMS).forEach(cat => {
                    KISEKAE_ITEMS[cat].forEach(item => {
                        if (!ownedKisekaeItems[cat].includes(item.id)) ownedKisekaeItems[cat].push(item.id);
                    });
                });
                // 🛋️ マイルームの家具も、管理者URLの人だけ全部持っている状態にする
                Object.keys(MYROOM_ITEMS).forEach(cat => {
                    MYROOM_ITEMS[cat].forEach(item => {
                        if (!ownedMyroomItems[cat].includes(item.id)) ownedMyroomItems[cat].push(item.id);
                    });
                });
            }
            checkForCloudRestoreOnLoad();
            checkOfflineEarnings();
            setTimeout(checkShowTutorial, CONFIG.TUTORIAL_CHECK_DELAY_MS);

            resetMochiFilter();

            setGameBackground(stages[selectedStageIndex].bg);

            updateDisplay();
            updateSkillUI();
            startFeverSpawningLoop();
            startPresentSpawningLoop();
            startMochiLifeLoop();
            showOpeningGreeting();
            resetMinigameCountsIfNewDay();
            initVolumeSliders();
            initMapInteractions();
            
            requestAnimationFrame(updateAndRenderParticles);
        };

        // スキル効果を含んだタップ力計算コア
        // もちの数が大きくなりすぎてもUIからはみ出さないよう、日本語の単位（万/億/兆/京）で短く表示する
        export const MOCHI_DECIMAL_PLACES = 6; // 大きい数字の時、小数点以下を何桁まで表示するか（5〜10の範囲で調整可能）
        // 🔒 他プレイヤーが入力した名前などをそのままinnerHTMLに差し込むと、
        // 悪意のあるスクリプトを名前に仕込まれて他の人の画面で実行されてしまう(XSS)ため、必ずこれを通す
        /**
         * 文字列をdiv要素のtextContentに設定してからinnerHTMLを読み出すことで、HTML特殊文字をエスケープする。
         * @param {string} str - エスケープ対象の文字列
         * @returns {string} エスケープ済みのHTML文字列
         */
        export function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = String(str ?? '');
            return div.innerHTML;
        }

        /**
         * もちの所持数を、大きくなってもUIからはみ出さないよう日本語の単位（億/兆/京/垓）で短く整形する。
         * @param {number} n - 整形対象の数値
         * @returns {string} 整形済みの文字列
         */
        export function formatMochi(n) {
            n = Math.floor(n);
            if (n < CONFIG.MOCHI_UNIT_OKU) return n.toLocaleString(); // 1億未満はそのまま数字表示（万単位の小数は意味が薄いので廃止）
            if (n >= CONFIG.MOCHI_UNIT_GAI) return (n / CONFIG.MOCHI_UNIT_GAI).toFixed(MOCHI_DECIMAL_PLACES) + '垓';
            if (n >= CONFIG.MOCHI_UNIT_KEI) return (n / CONFIG.MOCHI_UNIT_KEI).toFixed(MOCHI_DECIMAL_PLACES) + '京';
            if (n >= CONFIG.MOCHI_UNIT_CHO) return (n / CONFIG.MOCHI_UNIT_CHO).toFixed(MOCHI_DECIMAL_PLACES) + '兆';
            return (n / CONFIG.MOCHI_UNIT_OKU).toFixed(MOCHI_DECIMAL_PLACES) + '億';
        }

        // 📳 振動（ハプティクス）
        // 【重要】iOSのSafari/PWAはVibration API自体を実装していないため、iPhoneでは何も起きません
        // （AndroidのChromeなどでは有効です）。iPhone側でも「叩いた感」を出したい場合は、
        // 振動の代わりに画面のフラッシュ/シェイク演出などの視覚効果で代替するのがおすすめです。
        /**
         * navigator.vibrateが存在する場合にのみ、指定パターンで端末を振動させる。
         * @param {number|number[]} pattern - 振動パターン（ms）
         * @returns {void}
         */
        export function vibrate(pattern) {
            if (navigator.vibrate) {
                try { navigator.vibrate(pattern); } catch (e) {}
            }
        }

        // 🎬 画面シェイク（iPhoneで振動が効かない分、視覚的な「叩いた感」を強化する）
        export let shakeTimeout = null;
        export let lastScreenShakeTime = 0;
        /**
         * #game-screenにshake-small/shake-bigクラスを付け直して短時間振動させる画面演出。
         * @param {string} [size='small'] - 'big'または'small'
         * @returns {void}
         */
        export function screenShake(size = 'small') {
            const el = document.getElementById('game-screen');
            if (!el) return;
            const now = performance.now();
            // 必殺技中など、短時間に何度も会心が重なる場面で、強制リフロー(void el.offsetWidth)が
            // 何度も走って重くなるのを防ぐため、短い間隔では新しいシェイクを間引く
            if (now - lastScreenShakeTime < CONFIG.SCREEN_SHAKE_DEBOUNCE_MS) return;
            lastScreenShakeTime = now;
            el.classList.remove('shake-small', 'shake-big');
            void el.offsetWidth;
            el.classList.add(size === 'big' ? 'shake-big' : 'shake-small');
            clearTimeout(shakeTimeout);
            shakeTimeout = setTimeout(() => el.classList.remove('shake-small', 'shake-big'), CONFIG.SCREEN_SHAKE_DURATION_MS);
        }

        // 🎬 画面フラッシュ（会心・黄金・フィーバーなどの「決まった瞬間」を派手に見せる）
        export let lastScreenFlashTime = 0;
        /**
         * #screen-flash-overlayの背景色と不透明度を設定し、直後にフェードアウトさせる画面フラッシュ演出。
         * @param {string} color - フラッシュの背景色
         * @param {number} [peakOpacity=0.35] - フラッシュ開始時の最大不透明度
         * @returns {void}
         */
        export function screenFlash(color, peakOpacity = CONFIG.SCREEN_FLASH_DEFAULT_OPACITY) {
            const el = document.getElementById('screen-flash-overlay');
            if (!el) return;
            const now = performance.now();
            // 連打で会心が連発すると、フラッシュが完全に消える前に次のフラッシュが割り込み、
            // 画面(もちすけを含む)がずっと光ったまま見えてしまうため、短い間隔では新しいフラッシュを間引く
            if (now - lastScreenFlashTime < CONFIG.SCREEN_FLASH_DEBOUNCE_MS) return;
            lastScreenFlashTime = now;
            el.classList.remove('fade-out');
            el.style.background = color;
            el.style.opacity = String(peakOpacity);
            requestAnimationFrame(() => {
                el.classList.add('fade-out');
                el.style.opacity = '0';
            });
        }

        export let rippleList = [];
        export let floatingTextList = [];

        /**
         * '1.3rem'のような文字列や'20px'、あるいは数値そのものを受け取り、px数値に統一する。
         * @param {string|number} sizeStr - remまたはpx表記の文字列、または数値
         * @returns {number} px換算した数値
         */
        export function remToPx(sizeStr) {
            if (typeof sizeStr === 'number') return sizeStr;
            const s = String(sizeStr).trim();
            if (s.endsWith('rem')) return parseFloat(s) * CONFIG.REM_TO_PX;
            if (s.endsWith('px')) return parseFloat(s);
            return parseFloat(s) || CONFIG.REM_TO_PX;
        }

        // モーダル内（ミニゲームなど）で使う軽量パーティクル演出。
        // #particle-canvasはモーダルより下のレイヤーにあるため、モーダルを開いた状態でcreateParticle()を
        // 呼んでも画面には映らない（もちすけの後ろに隠れて見える原因もこれ）。これはposition:fixedのDOM要素で
        // モーダルより手前に直接描画するので、どこで呼んでも確実に見える。
        /**
         * position:fixedのdiv要素をcount個生成し、ランダムな角度・距離に弾け飛ばして消す軽量パーティクル演出。
         * @param {number} x - 発生位置のX座標
         * @param {number} y - 発生位置のY座標
         * @param {number} count - 生成する個数
         * @param {string} color - パーティクルの色
         * @returns {void}
         */
        export function spawnModalParticleBurst(x, y, count, color) {
            for (let i = 0; i < count; i++) {
                const p = document.createElement('div');
                const angle = Math.random() * Math.PI * 2;
                const dist = CONFIG.MODAL_PARTICLE_BURST_DIST_MIN + Math.random() * CONFIG.MODAL_PARTICLE_BURST_DIST_RANGE;
                const dx = Math.cos(angle) * dist;
                const dy = Math.sin(angle) * dist - CONFIG.MODAL_PARTICLE_BURST_Y_BIAS;
                p.style.cssText = `position:fixed; left:${x}px; top:${y}px; width:10px; height:10px; border-radius:50%;
                    background:${color}; z-index:30000; pointer-events:none;
                    transition: transform 0.6s ease-out, opacity 0.6s ease-out; opacity:1; transform:translate(-50%,-50%);`;
                document.body.appendChild(p);
                requestAnimationFrame(() => {
                    p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    p.style.opacity = '0';
                });
                setTimeout(() => p.remove(), CONFIG.MODAL_PARTICLE_BURST_LIFETIME_MS);
            }
        }

        // 🎭 マイルームのタップ・叫ぶ・ごはん演出用：モーダルの手前に浮かび上がって消えるテキスト。
        // createFloatingText()はタップ画面専用のcanvasに描くため、マイルームのモーダル内では見えない。
        // こちらはposition:fixedのDOM要素なので、どのモーダルの上にいても確実に見える
        /**
         * position:fixedのdiv要素でテキストを表示し、上に浮きながらフェードアウトさせて消す演出。
         * @param {number} x - 発生位置のX座標
         * @param {number} y - 発生位置のY座標
         * @param {string} text - 表示するテキスト
         * @param {string} [color='#ff9800'] - 文字色
         * @param {string} [size='1.2rem'] - フォントサイズ
         * @returns {void}
         */
        export function spawnModalFloatingText(x, y, text, color = '#ff9800', size = '1.2rem') {
            const el = document.createElement('div');
            el.textContent = text;
            el.style.cssText = `position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%); font-size:${size};
                font-weight:900; color:${color}; z-index:30000; pointer-events:none; text-shadow:0 2px 4px rgba(0,0,0,0.25);
                transition: transform 1.1s ease-out, opacity 1.1s ease-out; opacity:1;`;
            document.body.appendChild(el);
            requestAnimationFrame(() => {
                el.style.transform = 'translate(-50%, calc(-50% - 60px))';
                el.style.opacity = '0';
            });
            setTimeout(() => el.remove(), CONFIG.MODAL_FLOATING_TEXT_LIFETIME_MS);
        }

        // 波紋・浮き文字はDOM要素を作らずcanvasにまとめて描画する（連打時のcreateElement/appendChild/remove連発による
        // レイアウト負荷とGCの揺れが高速タップ時のカクつきの主因だったため、パーティクルと同じ描画ループに統合）
        /**
         * 画面座標をgetGameScreenRect基準の相対座標に変換し、開始時刻とともにrippleListへ登録する。
         * 実際の描画はupdateAndRenderParticles側で行う。
         * @param {number} x - 画面上のX座標
         * @param {number} y - 画面上のY座標
         * @returns {void}
         */
        export function createRippleEffect(x, y) {
            const rect = getGameScreenRect();
            rippleList.push({ x: x - rect.left, y: y - rect.top, start: performance.now() });
        }

        /**
         * floatingTextListへ座標・テキスト・色・フォントサイズ・開始時刻を積み、描画ループでアニメーションさせる。
         * @param {number} x - 画面上のX座標
         * @param {number} y - 画面上のY座標
         * @param {string} text - 表示するテキスト
         * @param {string} [color="#ff9800"] - 文字色
         * @param {string} [size="1.3rem"] - フォントサイズ
         * @returns {void}
         */
        export function createFloatingText(x, y, text, color = "#ff9800", size = "1.3rem") {
            if (floatingTextList.length > CONFIG.FLOATING_TEXT_MAX_COUNT) return; // パーティクルと同様、連打が続いても際限なく増えないように上限を設ける
            const rect = getGameScreenRect();
            floatingTextList.push({
                x: x - rect.left, y: y - rect.top,
                text, color: color || '#ff9800', fontSize: remToPx(size),
                start: performance.now()
            });
        }

        /**
         * particleListへ座標・初速・重力・金色フラグを持つ粒を1つ追加する。実際の物理計算と描画はupdateAndRenderParticlesが担う。
         * @param {number} x - 画面上のX座標
         * @param {number} y - 画面上のY座標
         * @param {boolean} [isGold=false] - 金色パーティクルにするか
         * @returns {void}
         */
        export function createParticle(x, y, isGold = false) {
            if (particleList.length > CONFIG.PARTICLE_MAX_COUNT) return;
            const rect = getGameScreenRect();
            particleList.push({
                x: x - rect.left, y: y - rect.top,
                vx: (Math.random() - 0.5) * CONFIG.PARTICLE_VX_RANGE,
                vy: -(Math.random() * CONFIG.PARTICLE_VY_RANDOM_RANGE + CONFIG.PARTICLE_VY_BASE),
                gravity: CONFIG.PARTICLE_GRAVITY,
                isGold: isGold
            });
        }

        // 🐛パフォーマンス修正：タップ演出（particleList/rippleList/floatingTextList）が全部空＝
        // 「今まさに反応が必要なものは何もない、環境演出だけが動いているアイドル状態」の時だけ、
        // 描画を約30fpsに間引いて負荷とバッテリー消費を抑える。タップした瞬間にこれらのリストへ
        // 要素が入るので、その場で即座に60fpsへ戻り、タップの反応速度には一切影響しない
        export let lastAmbientFrameTs = 0;
        /**
         * 毎フレームのメイン描画ループ本体。パーティクル・環境スパークル・波紋・浮き文字を更新・描画し、
         * アイドル状態では約30fpsに間引く。renderMochiRainFrame()も同じフレーム内で呼び出す。
         * @param {number} ts - requestAnimationFrameから渡されるタイムスタンプ
         * @returns {void}
         */
        export const updateAndRenderParticles = (ts) => {
            if (!ctx || !canvas) { requestAnimationFrame(updateAndRenderParticles); return; }
            // 🐛パフォーマンス修正：この描画loopはタップ画面のcanvas専用だが、ランキング・移動・ショップ・
            // マイルームなど、何かモーダルを開いている間はタップ画面自体が見えない（モーダルの黒い背景に
            // 覆われる）。見えていないのに毎フレーム描画し続けるのは完全に無駄なので、モーダルが開いている
            // 間は描画処理を丸ごとスキップする（RAFの連鎖だけは切らさず維持し、モーダルを閉じた瞬間に
            // すぐ元の頻度で再開できるようにする）
            if (document.body.classList.contains('modal-open')) { requestAnimationFrame(updateAndRenderParticles); return; }
            const isAmbientIdle = particleList.length === 0 && rippleList.length === 0 && floatingTextList.length === 0;
            if (isAmbientIdle) {
                if (ts - lastAmbientFrameTs < CONFIG.AMBIENT_FRAME_SKIP_MS) { requestAnimationFrame(updateAndRenderParticles); return; }
                lastAmbientFrameTs = ts;
            }
            renderMochiRainFrame(); // もちの雨も同じフレームでまとめて処理する（RAFを2重に走らせない）
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = particleList.length - 1; i >= 0; i--) {
                const p = particleList[i];
                p.x += p.vx; p.y += p.vy; p.vy += p.gravity;

                if (p.isGold) {
                    // 金色みと輝きを強化（事前に焼き込んだ金色画像＋canvasネイティブのshadowで表現。
                    // ctx.filterはモバイルブラウザで無視されることがあるため使わない）
                    ctx.shadowColor = 'rgba(255, 215, 0, 0.9)';
                    ctx.shadowBlur = CONFIG.GOLD_PARTICLE_SHADOW_BLUR;
                    ctx.drawImage(goldParticleImg || particleImg, p.x - CONFIG.GOLD_PARTICLE_DRAW_OFFSET, p.y - CONFIG.GOLD_PARTICLE_DRAW_OFFSET, CONFIG.GOLD_PARTICLE_DRAW_SIZE, CONFIG.GOLD_PARTICLE_DRAW_SIZE);
                    ctx.shadowBlur = 0; // 次の描画に影響しないよう明示的に戻す（save/restoreより軽い）
                } else {
                    ctx.drawImage(particleImg, p.x - CONFIG.PARTICLE_DRAW_OFFSET, p.y - CONFIG.PARTICLE_DRAW_OFFSET, CONFIG.PARTICLE_DRAW_SIZE, CONFIG.PARTICLE_DRAW_SIZE);
                }

                if (p.y > canvas.height + CONFIG.PARTICLE_OFFSCREEN_MARGIN) { particleList.splice(i, 1); }
            }

            // ✨ 環境パーティクル（ゆっくり漂う光の粒。フェードイン→フェードアウト）
            // 🐛パフォーマンス修正：この演出はタップ操作に関係なく常時（何もしていなくても）動き続けるため、
            // 従来のshadowBlur（canvasの中でも特にモバイルSafariで負荷が重い処理）を使っていると、
            // 起動しているだけでスマホが熱くなったりバッテリーを消費し続ける一因になっていた。
            // 見た目はほぼそのままに、影(shadow)ではなく単純に二重の円（外側は薄く大きく、内側は濃く小さく）を
            // 重ねて描くだけの方式に変更し、常時実行される処理を軽量化した
            for (let i = ambientSparkles.length - 1; i >= 0; i--) {
                const s = ambientSparkles[i];
                s.x += s.vx; s.y += s.vy; s.life++;
                if (s.life >= s.maxLife) { ambientSparkles.splice(i, 1); continue; }
                const t = s.life / s.maxLife;
                const fade = t < CONFIG.SPARKLE_FADE_IN_END ? t / CONFIG.SPARKLE_FADE_IN_END : t > CONFIG.SPARKLE_FADE_OUT_START ? (1 - t) / CONFIG.SPARKLE_FADE_OUT_DURATION : 1;
                ctx.save();
                ctx.fillStyle = '#ffe9a8';
                ctx.globalAlpha = Math.max(0, fade * CONFIG.SPARKLE_OUTER_ALPHA);
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * CONFIG.SPARKLE_OUTER_RADIUS_MULT, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff8dc';
                ctx.globalAlpha = Math.max(0, fade * CONFIG.SPARKLE_INNER_ALPHA);
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            const now = performance.now();

            // 波紋エフェクト（strokeStyle/lineWidthは毎回上書きするのでsave/restore不要）
            for (let i = rippleList.length - 1; i >= 0; i--) {
                const r = rippleList[i];
                const t = (now - r.start) / CONFIG.RIPPLE_DURATION_MS; // 0.4秒
                if (t >= 1) { rippleList.splice(i, 1); continue; }
                const eased = 1 - Math.pow(1 - t, 2);
                ctx.strokeStyle = `rgba(255, 152, 0, ${(CONFIG.RIPPLE_PEAK_ALPHA * (1 - t)).toFixed(3)})`;
                ctx.lineWidth = CONFIG.RIPPLE_LINE_WIDTH;
                ctx.beginPath();
                ctx.arc(r.x, r.y, eased * CONFIG.RIPPLE_MAX_RADIUS, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 浮き上がる文字
            for (let i = floatingTextList.length - 1; i >= 0; i--) {
                const f = floatingTextList[i];
                const t = (now - f.start) / CONFIG.FLOATING_TEXT_DURATION_MS; // 0.6秒
                if (t >= 1) { floatingTextList.splice(i, 1); continue; }
                let scale, translateY, opacity;
                if (t < CONFIG.FLOATING_TEXT_RISE_PHASE_END) {
                    const local = t / CONFIG.FLOATING_TEXT_RISE_PHASE_END;
                    scale = CONFIG.FLOATING_TEXT_SCALE_START + CONFIG.FLOATING_TEXT_SCALE_RISE_RANGE * local;
                    translateY = -CONFIG.FLOATING_TEXT_RISE_Y * local;
                    opacity = 1;
                } else {
                    const local = (t - CONFIG.FLOATING_TEXT_RISE_PHASE_END) / CONFIG.FLOATING_TEXT_FALL_PHASE_RANGE;
                    scale = CONFIG.FLOATING_TEXT_SCALE_PEAK - CONFIG.FLOATING_TEXT_SCALE_FALL_RANGE * local;
                    translateY = -CONFIG.FLOATING_TEXT_RISE_Y - CONFIG.FLOATING_TEXT_FALL_Y_RANGE * local;
                    opacity = 1 - local;
                }
                ctx.save();
                ctx.globalAlpha = Math.max(0, opacity);
                ctx.translate(f.x, f.y + translateY);
                ctx.scale(scale, scale);
                ctx.font = `900 ${f.fontSize}px 'M PLUS Rounded 1c', 'Helvetica Neue', Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = CONFIG.FLOATING_TEXT_STROKE_WIDTH;
                ctx.strokeStyle = '#ffffff';
                ctx.strokeText(f.text, 0, 0);
                ctx.fillStyle = f.color;
                ctx.fillText(f.text, 0, 0);
                ctx.restore();
            }

            requestAnimationFrame(updateAndRenderParticles);
        };

        // もちの雨の描画。以前は独立したrequestAnimationFrameループを持っていたが、
        // メインのパーティクルループと合わせて画面を1フレームに2回更新することになり負荷が高かったため、
        // メインループから呼び出す普通の関数に統合した（RAFの二重登録を解消）。
        // また、パーティクル毎のsave()/restore()はコストが高いので、setTransformで直接位置と回転を
        // 指定し、最後に1回だけリセットする方式に変更して負荷を下げている。
        /**
         * mochiRainListの各粒を移動・回転させてrainCtxへ描画し、画面下端に達した粒を削除する。
         * @returns {void}
         */
        export function renderMochiRainFrame() {
            if (!rainCtx || !rainCanvas) return;
            rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
            for (let i = mochiRainList.length - 1; i >= 0; i--) {
                const r = mochiRainList[i];
                r.x += r.vx; r.y += r.vy; r.rot += r.rotSpeed;
                if (r.y > rainCanvas.height) { mochiRainList.splice(i, 1); continue; } // 下端に着いたらそこで消える（手前でフェードしない）
                const rad = r.rot * Math.PI / 180;
                rainCtx.setTransform(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), r.x, r.y);
                if (particleImg) rainCtx.drawImage(particleImg, -r.size / 2, -r.size / 2, r.size, r.size);
            }
            rainCtx.setTransform(1, 0, 0, 1, 0, 0); // 変形をまとめて1回だけリセット
        }

        /**
         * 指定IDの&lt;img&gt;要素がまだsrc未設定でdata-src属性を持っていれば、srcへ反映して読み込みを開始させる。
         * @param {string} imgId - 対象img要素のid
         * @returns {void}
         */
        export function lazyLoadImage(imgId) {
            const img = document.getElementById(imgId);
            if (img && !img.src && img.dataset.src) img.src = img.dataset.src;
        }

        window.addEventListener('resize', () => {
            const shopModal = document.getElementById('shop-modal');
            if (shopModal && shopModal.style.display === 'flex' && currentShopTab === 'omiyage') {
                syncOmiyageImageFrame();
            }
        });

        /**
         * 一定間隔で、チュートリアル中でなく一定時間未タップかつフィーバー中でなければ、
         * 時間帯の挨拶かご当地セリフ・通常のつぶやきを吹き出し表示する定期処理を開始する。
         * @returns {void}
         */
        export function startMochiLifeLoop() {
            setInterval(() => {
                if (isTutorialActive) return;
                const idleDuration = Date.now() - lastTappedTime;
                const balloon = document.getElementById('mochi-balloon');
                if (idleDuration > CONFIG.MOCHI_IDLE_THRESHOLD_MS && !isFever) {
                    if (!balloon.classList.contains('balloon-show')) {
                        // 時間帯が切り替わった直後は優先的に挨拶する
                        const bucket = getTimeBucketIndex(new Date().getHours());
                        let text;
                        if (bucket !== lastGreetingHourBucket) {
                            lastGreetingHourBucket = bucket;
                            text = getTimeGreeting();
                        } else {
                            // 現在地のご当地セリフがあれば時々混ぜる、それ以外は通常のつぶやき
                            const stageName = stages[selectedStageIndex] ? stages[selectedStageIndex].name : null;
                            const prefPool = stageName ? dialogueData.prefectureComments[stageName] : null;
                            if (prefPool && Math.random() < CONFIG.PREFECTURE_COMMENT_CHANCE) {
                                text = pickRandom(prefPool);
                            } else {
                                text = pickRandom(dialogueData.idleComments);
                            }
                        }
                        showMochiComment(text);
                    }
                }
            }, CONFIG.MOCHI_LIFE_LOOP_INTERVAL_MS);
        }

        // 🎁 プレゼント出現頻度・報酬の調整用定数（ここを変えるだけでバランス調整できます）
        export const PRESENT_SPAWN_CHANCE = 0.2;      // 20秒毎の抽選確率（旧0.4→期待間隔が約2倍の100秒程度に）
        export const PRESENT_SPAWN_INTERVAL_MS = 20000;
        export const PRESENT_REWARD_MIN = 400;        // 旧200→倍
        export const PRESENT_REWARD_DISTANCE_RATE = 0.1; // 旧0.05→倍
        export const PRESENT_REWARD_MPS_RATE = 120;      // 旧60→倍

        // ミニゲームの基準報酬額（プレゼントボーナスと同じ考え方の基準額を使い回す）
        /**
         * PRESENT_SPAWN_INTERVAL_MSごとに、条件を満たせばPRESENT_SPAWN_CHANCEの確率でspawnLuckyPresent()を呼ぶ。
         * @returns {void}
         */
        export function startPresentSpawningLoop() {
            setInterval(() => { if (!isTutorialActive && !document.getElementById('lucky-present') && Math.random() < PRESENT_SPAWN_CHANCE) spawnLuckyPresent(); }, PRESENT_SPAWN_INTERVAL_MS);
        }

        export const PRESENT_TAPS_REQUIRED = 10; // 風船(プレゼント)を割るのに必要なタップ数

        /**
         * 画面外から浮遊してくるプレゼント(風船)要素を生成し、規定タップ数で破裂させて福もちボーナスを付与する。
         * @returns {void}
         */
        export function spawnLuckyPresent() {
            const gameScreen = document.getElementById('game-screen');
            showMochiComment(pickRandom(dialogueData.eventComments.presentSpawn));
            const present = document.createElement('div'); present.id = 'lucky-present';
            present.innerHTML = '<img src="ui_images/present.webp" alt="プレゼント" class="present-floating-img" style="width:95px; height:95px; object-fit:contain; pointer-events:none;">';
            present.style.position = 'absolute'; present.style.cursor = 'pointer'; present.style.zIndex = String(CONFIG.PRESENT_Z_INDEX); present.style.transition = 'transform 11s linear';
            const rect = gameScreen.getBoundingClientRect();
            present.style.left = CONFIG.PRESENT_START_X + 'px'; present.style.top = (Math.random() * (rect.height - CONFIG.EVENT_SPAWN_Y_RANGE_MARGIN) + CONFIG.EVENT_SPAWN_Y_MIN) + 'px';
            gameScreen.appendChild(present);
            setTimeout(() => present.style.transform = `translateX(${rect.width + CONFIG.PRESENT_END_X_MARGIN}px)`, CONFIG.PRESENT_ANIMATION_START_DELAY_MS);

            let popTaps = 0;
            const imgEl = present.querySelector('.present-floating-img');

            present.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                popTaps++;

                if (popTaps < PRESENT_TAPS_REQUIRED) {
                    // もちすけをタップした時と同じ「もちっ」演出＋効果音のみ（まだ割れない・もちは出さない）
                    playAudioFile('audio/tap.mp3');
                    imgEl.classList.remove('present-mochitto'); void imgEl.offsetWidth; imgEl.classList.add('present-mochitto');
                    return;
                }

                // 10回目：破裂して白いもちが10個飛び出す＋福もちボーナス獲得
                playAudioFile('audio/balloon_pop.mp3');
                vibrate(CONFIG.PRESENT_POP_VIBRATION_PATTERN);
                for (let i = 0; i < CONFIG.PRESENT_BURST_PARTICLE_COUNT; i++) {
                    const angle = (Math.PI * 2 * i) / CONFIG.PRESENT_BURST_PARTICLE_COUNT + Math.random() * CONFIG.PRESENT_BURST_ANGLE_JITTER;
                    const dist = CONFIG.PRESENT_BURST_DIST_MIN + Math.random() * CONFIG.PRESENT_BURST_DIST_RANGE;
                    createParticle(e.clientX + Math.cos(angle) * dist, e.clientY + Math.sin(angle) * dist, false);
                }
                const currentStage = stages[currentStageIndex] || stages[0];
                const bonus = Math.max(PRESENT_REWARD_MIN, Math.floor(currentStage.distance * PRESENT_REWARD_DISTANCE_RATE) + Math.floor(getMps() * PRESENT_REWARD_MPS_RATE));
                setScore(score + (bonus));
                createFloatingText(e.clientX, e.clientY, `🎁福もちボーナス +${formatMochi(bonus)}`, "#ff9800", "1.5rem");
                saveGame(); updateDisplay();
                present.remove();
                hideMochiComment();
            });
            setTimeout(() => { if (present.parentNode) { present.remove(); hideMochiComment(); } }, CONFIG.PRESENT_LIFETIME_MS);
        }

        /**
         * 画面内のランダムな位置に黄金もち要素を生成し、タップされるとフィーバータイムを発動させる。
         * @returns {void}
         */
        export function spawnGoldMochi() {
            const gameScreen = document.getElementById('game-screen');
            showMochiComment(pickRandom(dialogueData.eventComments.goldMochiSpawn));
            const goldMochi = document.createElement('div'); goldMochi.id = 'fever-pop';
            const rect = gameScreen.getBoundingClientRect();
            goldMochi.style.left = (Math.random() * (rect.width - CONFIG.GOLD_MOCHI_X_MARGIN)) + 'px'; goldMochi.style.top = (Math.random() * (rect.height - CONFIG.EVENT_SPAWN_Y_RANGE_MARGIN) + CONFIG.EVENT_SPAWN_Y_MIN) + 'px';
            gameScreen.appendChild(goldMochi);
            goldMochi.addEventListener('pointerdown', (e) => { e.stopPropagation(); goldMochi.remove(); hideMochiComment(); triggerFeverTime(); });
            setTimeout(() => { if (goldMochi.parentNode) { goldMochi.remove(); hideMochiComment(); } }, CONFIG.GOLD_MOCHI_LIFETIME_MS);
        }

        export const appStartTime = Date.now();
        export const AUTOSAVE_CLOUD_GRACE_MS = 8000; // 起動直後の数秒間は、クラウドへの送信（ランキング・バックアップ）を見送る
                                                 // （起動直後の一瞬だけ表示がおかしくなるケースがあっても、それをクラウドに送ってしまわないための保険）
        setInterval(() => {
            saveGame();
            if (Date.now() - appStartTime < AUTOSAVE_CLOUD_GRACE_MS) return;
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            if (window.backupSaveData) {
                const raw = localStorage.getItem('mochisuke_save_data');
                if (raw) window.backupSaveData(raw);
            }
        }, CONFIG.AUTOSAVE_INTERVAL_MS); // 10秒毎オートセーブ＋ランキング送信＋クラウドバックアップ




        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        /**
         * bgmVolumeMultの値を外部から書き換えるためのsetter関数（importした束縛への直接代入を回避するため）。
         * @param {number} v - 新しいBGM音量倍率
         * @returns {void}
         */
        export function setBgmVolumeMult(v) { bgmVolumeMult = v; }
        /**
         * lastGreetingHourBucket（直近に挨拶した時間帯バケット）の値を外部から更新するためのsetter関数。
         * @param {number} v - 新しい時間帯バケットのインデックス
         * @returns {void}
         */
        export function setLastGreetingHourBucket(v) { lastGreetingHourBucket = v; }
        /**
         * sfxVolumeMult（効果音の音量倍率）の値を外部から更新するためのsetter関数。
         * @param {number} v - 新しい効果音音量倍率
         * @returns {void}
         */
        export function setSfxVolumeMult(v) { sfxVolumeMult = v; }


        // window橋渡し：ここから下は、index.htmlのonclick=""（静的または動的に生成される
        // 文字列の両方）から直接呼ばれる関数を中心に、window経由のアクセスがまだ必要なものをまとめている。
        // ブラウザはonclick="foo()"の実行時にwindow.fooを探すため、橋渡しが無いとボタンを押しても
        // 静かに何も起きない（実際にこれで一度事故を起こした。解体新書 第9章参照）。削除する時は、
        // 他ファイルからのimport参照・index.html内の静的onclick・動的に組み立てられるonclick文字列の
        // 3経路すべてを確認すること。
        Object.defineProperty(window, 'IS_DEV_MODE', { configurable: true, get: () => IS_DEV_MODE, set: (v) => { IS_DEV_MODE = v; } });
        window.sendFeedback = sendFeedback;
        window.debugAddMochi = debugAddMochi;
        window.debugLevelUpSkill = debugLevelUpSkill;
        window.debugLevelUpAllSkills = debugLevelUpAllSkills;
        window.debugResetCooldowns = debugResetCooldowns;
        window.startGameFromOpScreen = startGameFromOpScreen;
