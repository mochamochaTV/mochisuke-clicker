        // ui.js を機能ごとに分割したファイルの1つ（共通UI基盤（モーダル開閉・音量設定・チュートリアル・セリフ表示・4隅ボタン配置・実績ミッション））。ui.js 自身は7ファイルをre-exportする窓口。

        import { CORNER_BTN_OFFSETS, CORNER_BTN_OFFSETS_PWA_OVERRIDE, CORNER_BTN_SIZE, KISEKAE_ITEMS, MOCHI_ICON_BASE_SIZE_PX, MOCHI_ICON_OFFSET, MOCHI_ICON_SIZE, FEATURE_UNLOCKS, GUIDED_TUTORIAL_STEPS, TUTORIAL_MISSIONS, TUTORIAL_STEPS, dialogueData, stages } from '../../data.js?v=2026-10-13-001';
        import { applyBgmVolume, bgmVolumeMult, fixBottomGap, getTimeBucketIndex, isRunningStandalone, pickRandom, playAudioFile, setBgmVolumeMult, setLastGreetingHourBucket, setSfxVolumeMult, sfxVolumeMult } from '../../main.js?v=2026-10-13-001';
        import { checkAndRotateMissions, claimMission, currentStageIndex, equippedKisekae, getMissionDef, getMissionProgress, getPrefTrophy, getPrefTrophyIcon, isMissionComplete, isPendingStampMoment, missionClaimed, missionDailySelected, missionWeeklySelected, prestigeCount, showPrefTrophyDetail, tutorialMissionStep } from '../../progress.js?v=2026-10-13-001';
        import { playerName, refreshCloudBackupStatus, sanitizePlayerName, saveGame, score, setPlayerName, totalTapsCount } from '../../state.js?v=2026-10-13-001';
        import { cancelFeedDragIfActive, isDraggingSqueeze, isScreamActive, isSqueezeSettling, setLastTappedTime, skills } from '../../tap.js?v=2026-10-13-001';
        import { isMochisukeVisible } from './kisekae.js?v=2026-10-13-001';
        import { openMap, openOmiyageCollection, updateDisplay } from './hud.js?v=2026-10-13-001';

        // 🔧 このファイル内でロジックに使う「調整可能な」数値をまとめたもの（CSS文字列内の値や、配列添字などの構造的な数値は対象外）
        const CONFIG = {
            // 音量設定関連
            DEFAULT_BGM_VOLUME_PCT: 30, // BGM音量のデフォルト値（%）
            DEFAULT_SFX_VOLUME_PCT: 100, // 効果音音量のデフォルト値（%）

            // PWA / Service Worker関連
            SW_UPDATE_CHECK_INTERVAL_MS: 5 * 60 * 1000, // Service Workerの更新チェック間隔（開いたままの人のためのフォローアップ）
            SW_RELOAD_COOLDOWN_MS: 60 * 1000, // controllerchangeによる自動リロードのクールダウン（連続リロード事故の防止）

            // もちすけのセリフ・口パーツ関連
            BALLOON_AUTO_HIDE_MS: 4000, // セリフ吹き出しが自動で消えるまでの時間
            ROBO_MOUTH_FRAME_INTERVAL_MS: 60, // ロボもちすけの口アニメ、1コマあたりの再生間隔

            // 口パーツ位置調整関連
            MOUTH_DEFAULT_WIDTH_PCT: 18, // 口パーツ幅のデフォルト値（%）
            MOUTH_MIN_WIDTH_PCT: 3, // 口パーツ幅の最小値（%）

            // もちすけ本体サイズ調整関連
            MOCHISUKE_DEFAULT_WIDTH_PX: 170, // もちすけ本体幅のデフォルト値
            MOCHISUKE_DEFAULT_MAX_HEIGHT_PX: 206, // もちすけ本体の最大高さのデフォルト値
            MOCHISUKE_MIN_SIZE_PX: 60, // もちすけ本体サイズの最小値

            // おしごとミッション画面の画面切り替え演出
            OSHIGOTO_FADE_OUT_MS: 300, // 画面を暗転させるまでの時間
            OSHIGOTO_FADE_IN_DELAY_MS: 150, // 暗転を解除するまでの遅延

            // 誘導チュートリアル関連
            TUTORIAL_CHECK_INTERVAL_MS: 200, // 穴の位置合わせと「次へ進む条件」のチェックをする間隔
            TUTORIAL_SPOTLIGHT_PADDING_PX: 10, // 穴を、明るくする要素より少し広げる余白
            TUTORIAL_BALLOON_GAP_PX: 18, // もちすけの頭と、吹き出しの下端とのすき間（しっぽの分）
            UNLOCK_CHECK_INTERVAL_MS: 1000, // 機能の解放（鍵の付け外し・解放チュートリアルを出すか）をチェックする間隔
            UNLOCK_TUTORIAL_DELAY_MS: 3000, // 解放を見つけてから、解放チュートリアルを出すまで待つ時間（県の到着セリフを読む間）
        };

        /**
         * BGM音量スライダーの変更を反映する。
         * @param {number} val - スライダーの値（0〜100のパーセント）
         * @returns {void}
         */
        export function onBgmVolumeChange(val) {
            // ../../main.js: setBgmVolumeMult/bgmVolumeMult はBGM音量の倍率を設定・保持する変数と関数、
            // applyBgmVolume は現在の倍率を実際の再生中BGMに反映する関数
            setBgmVolumeMult(val / 100);
            document.getElementById('bgm-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_bgm_volume', bgmVolumeMult);
            applyBgmVolume();
        }

        /**
         * 効果音音量スライダーの変更を反映する。
         * @param {number} val - スライダーの値（0〜100のパーセント）
         * @returns {void}
         */
        export function onSfxVolumeChange(val) {
            // ../../main.js: setSfxVolumeMult/sfxVolumeMult：効果音音量の倍率を設定・保持する変数と関数
            setSfxVolumeMult(val / 100);
            document.getElementById('sfx-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_sfx_volume', sfxVolumeMult);
        }

        /**
         * BGM・効果音の音量設定を初期値にリセットする。
         * @returns {void}
         */
        export function resetVolumeSettings() {
            onBgmVolumeChange(CONFIG.DEFAULT_BGM_VOLUME_PCT);
            onSfxVolumeChange(CONFIG.DEFAULT_SFX_VOLUME_PCT);
            document.getElementById('bgm-vol-slider').value = CONFIG.DEFAULT_BGM_VOLUME_PCT;
            document.getElementById('sfx-vol-slider').value = CONFIG.DEFAULT_SFX_VOLUME_PCT;
        }

        /**
         * 音量スライダーとプレイヤー名入力欄に、保存済みの値を反映して初期化する。
         * @returns {void}
         */
        export function initVolumeSliders() {
            const bgmSlider = document.getElementById('bgm-vol-slider');
            const sfxSlider = document.getElementById('sfx-vol-slider');
            if (bgmSlider) { bgmSlider.value = Math.round(bgmVolumeMult * 100); document.getElementById('bgm-vol-label').innerText = bgmSlider.value + '%'; }
            if (sfxSlider) { sfxSlider.value = Math.round(sfxVolumeMult * 100); document.getElementById('sfx-vol-label').innerText = sfxSlider.value + '%'; }
            const nameInput = document.getElementById('player-name-input');
            // ../../state.js: playerName は現在のプレイヤー名
            if (nameInput) nameInput.value = playerName;
        }

        export let uiDeclutterState = 0;
        /**
         * UI表示の簡素化モードを順番に切り替える（通常→モード1→モード2→モード3→通常…）。
         * @returns {void}
         */
        export function toggleUiDeclutter() {
            uiDeclutterState = (uiDeclutterState + 1) % 4;
            document.body.classList.remove('ui-mode-1', 'ui-mode-2', 'ui-mode-3');
            if (uiDeclutterState > 0) {
                document.body.classList.add('ui-mode-' + uiDeclutterState);
            }
            // ../../main.js: fixBottomGap：#game-screenの実際の高さを測り直してレイアウトのズレを補正する
            fixBottomGap(); // 表示するバーが変わって#game-screenの自然な高さが変わるので測り直す
        }

        // PWA: Service Workerを登録（対応ブラウザのみ、失敗しても通常プレイに影響なし）
        // 修正：GitHub Pagesは自分でHTTPヘッダーを設定できないため、ブラウザがsw.js自体を
        // 予想より長くキャッシュしてしまい、通常モードだと更新が反映されないことがあった。
        // register()直後にupdate()を明示的に呼んで、sw.js自体の再チェックを強制する。
        // さらに、新しいSWが実際に有効になった瞬間を検知して、自動でページを再読み込みする。
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').then((reg) => {
                    reg.update().catch(() => {});
                    setInterval(() => reg.update().catch(() => {}), CONFIG.SW_UPDATE_CHECK_INTERVAL_MS); // 開いたままの人のためのフォローアップ
                }).catch(() => {});

                // 修正：以前はこのページ内だけのただの変数(let hasReloadedForUpdate)でリロード済みを
                // 管理していたが、この変数自体がlocation.reload()のたびに消えてしまうため、何らかの理由で
                // controllerchangeが立て続けに発生すると（GitHub Pagesのキャッシュの揺れでSWの更新判定が
                // 安定しない場合など）「リロード→また即controllerchange→またリロード」の無限ループになり、
                // タップしても数値が反映される前にリロードされて進んでいないように見えたり、リロードのたびに
                // BGMの初期化処理が重なって二重に鳴って聞こえたりする恐れがあった。
                // sessionStorageに直近リロード時刻を記録することで、リロードをまたいでクールダウンを効かせる。
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    let lastReload = 0;
                    try { lastReload = Number(sessionStorage.getItem('punicker_sw_last_reload') || 0); } catch (e) {}
                    if (Date.now() - lastReload < CONFIG.SW_RELOAD_COOLDOWN_MS) return; // クールダウン中は再リロードしない
                    try { sessionStorage.setItem('punicker_sw_last_reload', String(Date.now())); } catch (e) {}
                    location.reload();
                });
            });
        }

        // スマホ環境の2本指ズーム・ダブルタップズームを制限
        document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
        export let hasSeenTutorial = false;

        // 🍴 もちすけにお土産をあげる機能（回数制限なし）
        export let balloonAutoHideTimer = null;
        /**
         * もちすけのセリフ吹き出しを表示する。
         * @param {string} text - 表示するセリフのテキスト
         * @returns {void}
         */
        export function showMochiComment(text) {
            const balloon = document.getElementById('mochi-balloon');
            if (!balloon) return;
            balloon.innerText = text;
            balloon.classList.add('balloon-show');
            // ../../tap.js: setLastTappedTime は「最後にタップした時刻」を書き換えるsetter
            setLastTappedTime(Date.now()); // 表示直後にすぐ別のセリフへ切り替わらないようにリセット
            clearTimeout(balloonAutoHideTimer);
            if (!isTutorialActive) {
                balloonAutoHideTimer = setTimeout(() => { balloon.classList.remove('balloon-show'); }, CONFIG.BALLOON_AUTO_HIDE_MS);
            }
        }

        // プレゼントや黄金もちが消えた時など、表示中のセリフを引っ込めるためのヘルパー
        /**
         * 表示中のもちすけのセリフ吹き出しを非表示にする。
         * @returns {void}
         */
        export function hideMochiComment() {
            const balloon = document.getElementById('mochi-balloon');
            if (balloon) balloon.classList.remove('balloon-show');
        }

        // 🎙️ セリフの表示/非表示を一元的に検知して、口パーツの切り替えと効果音をまとめて処理する
        // （showMochiComment/updateCheerBalloon/チュートリアルなど、色々な場所からセリフが更新されても、ここ1箇所で拾える）
        // 👄 口パーツは「通常の姿・話していない・叫んでいない・必殺技で巨大化していない」時だけ表示する。
        // 叫び顔・必殺技巨大化は、それぞれ専用のイラスト/拡大を使うため、口パーツを重ねると浮いて見えてしまう。
        /**
         * セリフ表示・叫び・必殺技・伸縮アニメーションの状態に応じて、口パーツの表示/非表示を切り替える。
         * @returns {void}
         */
        export function updateMouthPatchVisibility() {
            const mouthPatchEl = document.getElementById('mochisuke-mouth-patch');
            if (!mouthPatchEl) return;
            if (mouthAdjustMode) { mouthPatchEl.style.display = 'block'; return; } // 修正：調整中は、セリフ等で見えなくなるとイライラするので常に表示する
            const balloonEl = document.getElementById('mochi-balloon');
            const isTalking = balloonEl && balloonEl.classList.contains('balloon-show');
            // ../../tap.js: skills：スキル状態一式、isScreamActive/isDraggingSqueeze/isSqueezeSettling は
            // それぞれ「叫び中」「スクイーズをドラッグ中」「スクイーズが揺れ戻り中」を表すフラグ
            const isHissatsuActive = skills.hissatsu && skills.hissatsu.activeTimer > 0;
            // 伸ばしたり潰したりしている間・その後の揺れ戻りアニメーション中は、口パーツが元の位置に浮いて見えてしまうため非表示にする
            const shouldHide = isTalking || isScreamActive || isHissatsuActive || isDraggingSqueeze || isSqueezeSettling;
            mouthPatchEl.style.display = shouldHide ? 'none' : 'block';
        }

        /**
         * セリフ吹き出しの表示/非表示の変化をMutationObserverで監視し、口パーツ表示の更新や開閉音の再生を行う。
         * @returns {void}
         */
        (function setupBalloonObserver() {
            const balloonEl = document.getElementById('mochi-balloon');
            if (!balloonEl) return;
            let wasShowing = false;
            const observer = new MutationObserver(() => {
                const isShowing = balloonEl.classList.contains('balloon-show');
                if (isShowing === wasShowing) return;
                wasShowing = isShowing;
                updateMouthPatchVisibility();
                // ../../progress.js: equippedKisekae は現在装備中の着せ替えアイテムのID一式
                // 🤖 ロボもちすけ装備中は、通常の「パッ」ではなく専用の口（窓）アニメ＋「ウィーン」音にする
                if (equippedKisekae.fullbody === 'fullbody_robo') {
                    playRoboMouthAnimation(isShowing);
                } else if (isShowing) {
                    // ../../main.js: playAudioFile で効果音を再生
                    playAudioFile('audio/talk_pop.mp3');
                }
            });
            observer.observe(balloonEl, { attributes: true, attributeFilter: ['class'] });
        })();

        // 🤖 ロボもちすけの口（窓）アニメーション。open=trueで開くコマ送り、falseで閉じるコマ送り（開く時の逆再生）
        export let roboMouthAnimTimer = null;
        /**
         * ロボもちすけの口（窓）のコマ送りアニメーションを再生する。
         * @param {boolean} open - trueで開くコマ送り、falseで閉じるコマ送り
         * @returns {void}
         */
        export function playRoboMouthAnimation(open) {
            // ../../data.js: KISEKAE_ITEMS：カテゴリ別の着せ替えアイテムデータ
            const item = KISEKAE_ITEMS.fullbody.find(i => i.id === 'fullbody_robo');
            const mainImg = document.getElementById('mochisuke-fullbody');
            if (!item || !mainImg) return;
            const frames = item.mouthFrames;
            clearInterval(roboMouthAnimTimer);
            // ./kisekae.js: isMochisukeVisible はもちすけが画面上に表示されているか判定する
            if (isMochisukeVisible()) playAudioFile('audio/kisekae/robo_whir.mp3'); // ウィーン音（開閉どちらも同じ音、見えている画面の時だけ）
            let i = open ? 0 : frames.length - 1;
            const step = open ? 1 : -1;
            roboMouthAnimTimer = setInterval(() => {
                mainImg.src = frames[i];
                i += step;
                if ((open && i >= frames.length) || (!open && i < 0)) {
                    clearInterval(roboMouthAnimTimer);
                    mainImg.src = open ? frames[frames.length - 1] : item.img; // 開き切ったら最終フレーム維持、閉じ切ったら口閉じ画像に戻る
                }
            }, CONFIG.ROBO_MOUTH_FRAME_INTERVAL_MS); // 5コマを300msで再生
        }

        // 🫁 口パーツの呼吸は、もちすけ画像と共通の親要素(#mochisuke-breathe-wrap)にアニメーションをかけることで、
        // 追いかけて同期させるのではなく、そもそもズレようがない形で実現している（詳細はHTML側を参照）
        export let mouthAdjustMode = false;

        // 時間帯の並び順（インデックスは他の場所でも共通して使う）
        export const TIME_BUCKETS = ['morning', 'noon', 'evening', 'lateNight'];
        /**
         * 現在時刻の時間帯に応じた、もちすけの挨拶セリフをランダムに1つ取得する。
         * @returns {string} 挨拶セリフ
         */
        export function getTimeGreeting() {
            // ../../main.js: getTimeBucketIndex：時刻(0-23)から時間帯インデックスを求める
            const bucket = TIME_BUCKETS[getTimeBucketIndex(new Date().getHours())];
            // ../../main.js: pickRandom は配列からランダムに1つ選ぶ関数、../../data.js: dialogueData はセリフ集データ
            return pickRandom(dialogueData.timeGreetings[bucket]);
        }

        /**
         * 日付をYYYY-M-D形式（月日は2桁ゼロ埋め）の文字列に変換する。
         * @param {Date} d - 変換対象の日付
         * @returns {string} ローカル日付文字列
         */
        export function getLocalDateString(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        // 画面を開いた直後の挨拶。その日その時間帯にまだ挨拶していなければ「おはよう」等、
        // 既に挨拶済みなら「おかえり」を出す。両方ともlocalStorageに記録して次回に引き継ぐ。
        export const GREETING_STATE_KEY = 'punicker_last_greeting_bucket';
        export let tutorialStepIndex = 0;
        export let tutorialTimer = null;
        export let isTutorialActive = false;
        export let tutorialSteps = GUIDED_TUTORIAL_STEPS; // 今進めている誘導チュートリアルのステップ一覧（最初のチュートリアル、または解放チュートリアル）
        export let tutorialOnEnd = null; // そのチュートリアルが終わった時（スキップも含む）に呼ぶ処理

        /**
         * まだチュートリアルを見ていない、かつプレイ履歴もない場合にチュートリアルを開始する。
         * @returns {void}
         */
        export function checkShowTutorial() {
            if (hasSeenTutorial) return;
            // ../../state.js: score/totalTapsCount：現在のもちの数・累計タップ数、saveGame はセーブ
            // 何かしら既にプレイした形跡があれば、初見扱いにしない
            if (score > 0 || totalTapsCount > 0) { hasSeenTutorial = true; saveGame(); return; }
            openTutorial();
        }

        /**
         * チュートリアルを最初のステップから開始する。
         * @returns {void}
         */
        export function openTutorial() {
            // ../../data.js: GUIDED_TUTORIAL_STEPS：最初の誘導チュートリアルのステップ一覧
            startGuidedTutorial(GUIDED_TUTORIAL_STEPS, () => {
                // 終わったら「チュートリアル済み」を保存して、名前を決めてもらう
                hasSeenTutorial = true;
                // ../../state.js の saveGame()：今の状態をセーブする
                saveGame();
                promptPlayerNameIfNeeded();
            });
        }

        /**
         * 指定したステップ一覧で、誘導チュートリアルを最初から始める（最初のチュートリアルと解放チュートリアルで共通）。
         * @param {Array} steps - ステップ一覧（書き方は data.js の GUIDED_TUTORIAL_STEPS と同じ）
         * @param {Function} onEnd - 終わった時（スキップも含む）に呼ぶ処理
         * @returns {void}
         */
        export function startGuidedTutorial(steps, onEnd) {
            tutorialSteps = steps;
            tutorialOnEnd = onEnd;
            tutorialStepIndex = 0;
            isTutorialActive = true;
            document.body.classList.add('tutorial-active');
            document.querySelectorAll('.recommended-glow').forEach(el => el.classList.remove('recommended-glow'));
            runTutorialStep();
        }

        /**
         * 誘導チュートリアルの現在のステップを表示する。全ステップが終わったらチュートリアルを終了する。
         * @returns {void}
         */
        export function runTutorialStep() {
            // tutorialSteps：今進めているチュートリアルのステップ一覧（startGuidedTutorial() で決まる）
            if (tutorialStepIndex >= tutorialSteps.length) {
                endTutorial();
                return;
            }
            updateTutorialGuide();

            // 一定間隔で、穴の位置合わせと「ミッション達成」のチェックをする
            // （画面の切り替えや、もちすけの呼吸アニメで位置が変わるため、毎回測り直す）
            clearInterval(tutorialTimer);
            tutorialTimer = setInterval(() => {
                updateTutorialGuide();
                const step = tutorialSteps[tutorialStepIndex];
                if (step && step.next === 'mission') {
                    // ../../progress.js の getMissionDef()：ミッションIDから定義を取り出す。
                    // ../../progress.js の isMissionComplete()：そのミッションが目標回数に届いたかを返す
                    if (isMissionComplete(getMissionDef(step.missionId))) advanceTutorialStep();
                }
            }, CONFIG.TUTORIAL_CHECK_INTERVAL_MS);
        }

        /**
         * 誘導チュートリアルを次のステップへ進める。
         * @returns {void}
         */
        export function advanceTutorialStep() {
            tutorialStepIndex++;
            runTutorialStep();
        }

        /**
         * 要素が画面のどこに見えているかを返す（非表示や大きさ0なら null）。
         * @param {Element|null} el - 対象の要素
         * @param {number} pad - 範囲を外側に広げる余白(px)
         * @returns {Object|null} {left, top, right, bottom}（px）
         */
        export function getTutorialRect(el, pad) {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return null; // 閉じているモーダルの中など、まだ見えていない
            const W = window.innerWidth, H = window.innerHeight;
            return {
                left: Math.max(0, r.left - pad), top: Math.max(0, r.top - pad),
                right: Math.min(W, r.right + pad), bottom: Math.min(H, r.bottom + pad),
            };
        }

        /**
         * 現在のステップのセリフを表示し、押せる穴をあける（穴の外は暗くして押せなくする）。
         * @returns {void}
         */
        export function updateTutorialGuide() {
            const step = tutorialSteps[tutorialStepIndex];
            if (!step) return;

            // セリフ（ミッション待ちのステップには、進み具合「（3/10）」を付ける）
            let text = step.text;
            if (step.next === 'mission') {
                const mission = getMissionDef(step.missionId);
                // ../../progress.js の getMissionProgress()：ミッションの今の進み具合（回数）を返す
                text += `（${Math.min(getMissionProgress(mission), mission.target)}/${mission.target}）`;
            }
            const textEl = document.getElementById('tutorial-guide-text');
            if (textEl.innerText !== text) textEl.innerText = text;

            const W = window.innerWidth, H = window.innerHeight;
            // 押せる穴（step.target に書いた要素の位置。まだ表示されていなければ穴なし）
            const hole = step.target ? getTutorialRect(document.querySelector(step.target), CONFIG.TUTORIAL_SPOTLIGHT_PADDING_PX) : null;
            // ホーム画面で話すステップでは、話しているもちすけ本体も明るく見せる（押せる穴と重なる時は、押せる穴だけで十分）
            const mochiRect = step.at === 'mochisuke' ? getTutorialRect(document.getElementById('mochisuke-btn'), 0) : null;
            const overlapsHole = hole && mochiRect && mochiRect.left < hole.right && hole.left < mochiRect.right && mochiRect.top < hole.bottom && hole.top < mochiRect.bottom;
            const speakerHole = (mochiRect && !overlapsHole) ? mochiRect : null;

            // 暗幕：画面全体の四角から、穴の四角を切り抜く（evenodd＝重なった部分を抜く塗り方）
            const points = [`0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px, 0px 0px`];
            [hole, speakerHole].forEach(r => {
                if (!r) return;
                points.push(`${r.left}px ${r.top}px, ${r.right}px ${r.top}px, ${r.right}px ${r.bottom}px, ${r.left}px ${r.bottom}px, ${r.left}px ${r.top}px, 0px 0px`);
            });
            document.getElementById('tutorial-dim').style.clipPath = `polygon(evenodd, ${points.join(', ')})`;

            // もちすけ本体の穴には透明なふたを置き、押せる穴のふちは光らせる
            placeTutorialRect('tutorial-speaker-guard', speakerHole);
            placeTutorialRect('tutorial-spotlight', hole);

            // セリフの置き場所
            const box = document.getElementById('tutorial-guide-box');
            if (mochiRect) {
                // ホーム画面：もちすけの頭の上に吹き出しを出す
                box.className = 'guide-at-mochisuke';
                box.style.bottom = (H - mochiRect.top + CONFIG.TUTORIAL_BALLOON_GAP_PX) + 'px';
            } else {
                // もちすけが見えない画面：小さなもちすけの横に吹き出しを出す。穴が上半分なら下、それ以外は上に置いて重ならないようにする
                const holeIsUpper = hole && (hole.top + hole.bottom) / 2 < H / 2;
                box.className = holeIsUpper ? 'guide-side guide-bottom' : 'guide-side guide-top';
                box.style.bottom = '';
            }
        }

        /**
         * 要素を指定の範囲に置く（範囲が null なら隠す）。
         * @param {string} id - 置く要素のid
         * @param {Object|null} r - {left, top, right, bottom}（px）
         * @returns {void}
         */
        export function placeTutorialRect(id, r) {
            const el = document.getElementById(id);
            if (!r) { el.style.display = 'none'; return; }
            el.style.display = 'block';
            el.style.left = r.left + 'px';
            el.style.top = r.top + 'px';
            el.style.width = (r.right - r.left) + 'px';
            el.style.height = (r.bottom - r.top) + 'px';
        }

        // 暗いところ（もちすけのふたも含む）をタップした時：「タップで次へ」のステップなら次へ進む
        document.getElementById('tutorial-overlay').addEventListener('click', (e) => {
            if (e.target.closest('#tutorial-skip-btn')) return; // スキップボタンは confirmSkipTutorial() 側で処理する
            const step = tutorialSteps[tutorialStepIndex];
            if (isTutorialActive && step && step.next === 'tapScreen') advanceTutorialStep();
        });

        // 「押したら次へ」のステップ：明るくしたボタンが押されたら次へ進む
        // （ボタン本来の処理は止めずにそのまま動かす。ここでは押されたかどうかを見ているだけ）
        document.addEventListener('click', (e) => {
            if (!isTutorialActive) return;
            const step = tutorialSteps[tutorialStepIndex];
            if (step && step.next === 'click' && e.target.closest(step.target)) advanceTutorialStep();
        }, true);

        /**
         * チュートリアルを終了状態にし、進捗を保存してプレイヤー名の入力を促す。
         * @returns {void}
         */
        export function endTutorial() {
            clearInterval(tutorialTimer); // 穴の位置合わせ・条件チェックを止める
            hideMochiComment(); // チュートリアル中に出たふだんのセリフ（おみやげ購入時など）は自動で消えないので、ここで消す
            isTutorialActive = false;
            document.body.classList.remove('tutorial-active');
            document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));
            // 始める時に渡された「終わった時の処理」を呼ぶ（最初のチュートリアルなら名前決め、解放チュートリアルなら見終わった記録）
            const onEnd = tutorialOnEnd;
            tutorialOnEnd = null;
            if (onEnd) onEnd();
        }

        // ===================================================================
        // 🔓 進行で解放する機能（data.js の FEATURE_UNLOCKS）
        // 解放前はボタンに鍵をかけ、解放されたら短い誘導チュートリアルを出す
        // ===================================================================
        export let seenFeatureUnlocks = {}; // 解放チュートリアルを見終わった機能（id → true）。state.js がセーブ・ロードする
        export let unlockReadySince = 0; // 解放チュートリアルを出せる状態になった時刻（0＝まだ）

        /**
         * その機能が解放されているか（解放する県に着いたか）を返す。
         * @param {Object} feature - FEATURE_UNLOCKS の1行
         * @returns {boolean} 解放済みならtrue
         */
        export function isFeatureUnlocked(feature) {
            // ../../progress.js: currentStageIndex：今いる県の番号
            return currentStageIndex >= feature.unlockStage;
        }

        /**
         * 解放前のボタンに鍵の見た目（feature-locked クラス）を付け、解放済みなら外す。
         * @returns {void}
         */
        export function updateFeatureLocks() {
            FEATURE_UNLOCKS.forEach(f => {
                const btn = document.getElementById(f.buttonId);
                if (btn) btn.classList.toggle('feature-locked', !isFeatureUnlocked(f));
            });
        }

        /**
         * 鍵の付け外しをした上で、解放されたのにまだ見ていない機能があれば、落ち着いたタイミングで解放チュートリアルを出す。
         * @returns {void}
         */
        export function checkFeatureUnlockTutorial() {
            updateFeatureLocks();
            if (!hasSeenTutorial || isTutorialActive) { unlockReadySince = 0; return; }
            const next = FEATURE_UNLOCKS.find(f => isFeatureUnlocked(f) && !seenFeatureUnlocks[f.id]);
            // 他の画面を開いている間・画面切り替えの暗転中・スタンプ待ちの間は出さない
            // ../../progress.js: isPendingStampMoment：ゲージが溜まって「スタンプを押す」を待っている状態か
            const isBusy = document.body.classList.contains('modal-open')
                || document.getElementById('fade-overlay').classList.contains('fade-black')
                || isPendingStampMoment;
            if (!next || isBusy) { unlockReadySince = 0; return; }
            if (!unlockReadySince) { unlockReadySince = Date.now(); return; }
            if (Date.now() - unlockReadySince < CONFIG.UNLOCK_TUTORIAL_DELAY_MS) return; // 県の到着セリフを読む時間を空ける
            unlockReadySince = 0;
            startGuidedTutorial(next.steps, () => {
                seenFeatureUnlocks[next.id] = true;
                saveGame();
            });
        }
        setInterval(checkFeatureUnlockTutorial, CONFIG.UNLOCK_CHECK_INTERVAL_MS);

        // 鍵付きのボタンを押した時：本来の画面は開かず、もちすけが解放の条件を話す
        // （ボタン本来の処理より先に受け取って、そこで止める）
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.feature-locked');
            if (!btn) return;
            e.stopPropagation();
            e.preventDefault();
            const feature = FEATURE_UNLOCKS.find(f => f.buttonId === btn.id);
            if (feature) showMochiComment(feature.lockedText);
        }, true);

        /**
         * seenFeatureUnlocksを書き換える（他ファイルからのsetter。state.js のロードで使う）。
         * @param {Object} newSeenFeatureUnlocks - 解放チュートリアルを見終わった機能（id → true）
         * @returns {void}
         */
        export function setSeenFeatureUnlocks(newSeenFeatureUnlocks) { seenFeatureUnlocks = newSeenFeatureUnlocks; }

        /**
         * チュートリアルをスキップするかどうかの確認ダイアログを表示する。
         * @returns {void}
         */
        export function confirmSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'flex';
        }
        /**
         * チュートリアルのスキップを確定し、確認ダイアログを閉じてチュートリアルを終了する。
         * @returns {void}
         */
        export function doSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'none';
            clearTimeout(tutorialTimer);
            hideMochiComment();
            endTutorial(); // そのまま名前を決めるところまで進む
        }

        // 🍴 チュートリアルの最後に、まだ名前を決めていなければ聞いておく
        /**
         * プレイヤー名が未設定であれば、チュートリアル用の名前入力モーダルを開く。
         * @returns {void}
         */
        export function promptPlayerNameIfNeeded() {
            if (localStorage.getItem('punicker_player_name')) return;
            const input = document.getElementById('tutorial-name-input');
            // ../../state.js: playerName：現在のプレイヤー名（自動生成された初期名がここに入っている）
            if (input) input.value = playerName;
            openModal('tutorial-name-modal');
        }
        /**
         * チュートリアルの名前入力欄の内容を検証し、プレイヤー名として保存する。
         * @returns {void}
         */
        export function saveTutorialPlayerName() {
            const input = document.getElementById('tutorial-name-input');
            // ../../state.js: sanitizePlayerName は入力された名前が使えるか検証する
            const result = sanitizePlayerName(input.value);
            if (!result.ok) { alert(result.reason); return; }
            // ../../state.js: setPlayerName：playerName変数を書き換えるsetter（importした束縛には直接代入できないため）
            setPlayerName(result.name);
            localStorage.setItem('punicker_player_name', playerName);
            // src/engine/firebase.js: window.submitRankingScore はランキングにスコアを送信する関数（window経由なのは、
            // firebase.jsがtype="module"で別読み込みされ、ここから直接importできないため）。
            // ../../progress.js: prestigeCount/equippedKisekae：転生回数・現在の装備
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            closeModal('tutorial-name-modal');
        }

        // 💬 4つの丸ボタン、初めて押した時だけ軽くヒントを出す（チュートリアル終了後の、2周目以降のフォロー用）
        export let seenButtonHints = { map: false, menu: false, ui: false, feed: false };
        /**
         * 地図ボタンのタップを処理する。初回のみヒントを表示してから地図画面を開く。
         * @returns {void}
         */
        export function onMapButtonTap() {
            if (!seenButtonHints.map) { seenButtonHints.map = true; saveGame(); showMochiComment('地図で好きな県に飛べるで！'); }
            // ./hud.js: openMap はマップモーダルを開く
            openMap();
        }
        // 🗺️⚙️🖼️🍴 4隅ボタンの位置・大きさを反映する
        /**
         * 4隅ボタン（地図・設定・背景・お土産）の大きさと位置を、設定値に基づいてDOMに反映する。
         * @returns {void}
         */
        export function applyCornerBtnPositions() {
            // ../../data.js: CORNER_BTN_SIZE：4隅ボタンの共通サイズ（px）
            document.documentElement.style.setProperty('--corner-btn-size', CORNER_BTN_SIZE + 'px');
            // ../../main.js: isRunningStandalone はPWA（ホーム画面起動）として動いているか判定する
            const isPwa = isRunningStandalone();
            // ../../data.js: CORNER_BTN_OFFSETS_PWA_OVERRIDE/CORNER_BTN_OFFSETS：PWA用/通常用の
            // 4隅ボタンごとの位置オフセットデータ
            const getOffsets = (id) => (isPwa && CORNER_BTN_OFFSETS_PWA_OVERRIDE[id]) ? CORNER_BTN_OFFSETS_PWA_OVERRIDE[id] : CORNER_BTN_OFFSETS[id];
            const map = document.getElementById('map-toggle-btn');
            map.style.top = `calc(8px + env(safe-area-inset-top, 0px) + ${getOffsets('map-toggle-btn').vert}px)`;
            map.style.left = getOffsets('map-toggle-btn').horiz + 'px';
            const menu = document.getElementById('menu-toggle-btn');
            menu.style.top = `calc(8px + env(safe-area-inset-top, 0px) + ${getOffsets('menu-toggle-btn').vert}px)`;
            menu.style.right = getOffsets('menu-toggle-btn').horiz + 'px';
            const ui = document.getElementById('ui-toggle-btn');
            ui.style.bottom = `calc(14px + env(safe-area-inset-bottom, 0px) + ${getOffsets('ui-toggle-btn').vert}px)`;
            ui.style.left = getOffsets('ui-toggle-btn').horiz + 'px';
            const feed = document.getElementById('feed-toggle-btn');
            feed.style.bottom = `calc(14px + env(safe-area-inset-bottom, 0px) + ${getOffsets('feed-toggle-btn').vert}px)`;
            feed.style.right = getOffsets('feed-toggle-btn').horiz + 'px';
        }
        // 💰 所持もち数アイコン（#mochi-count-icon）の大きさ・位置を反映する
        /**
         * #mochi-count-icon（所持もち数アイコン）の大きさ・位置（data.jsの値）を、CSS変数としてDOMに反映する。
         * @returns {void}
         */
        export function applyMochiIconAdjust() {
            // 【まもすいの指摘で修正】width/heightではなくtransform:scaleで見た目だけを拡大縮小することで、
            // 所持もち数の枠（.score-row）の大きさ自体はMOCHI_ICON_BASE_SIZE_PX（アプデ前と同じ24px）のまま
            // 変わらないようにしている（style.cssの.mochi-count-icon-wrap参照）
            // ../../data.js: MOCHI_ICON_SIZE/MOCHI_ICON_BASE_SIZE_PX/MOCHI_ICON_OFFSET は
            // 所持もち数アイコンの現在サイズ・基準サイズ・位置ずらし量のデータ
            document.documentElement.style.setProperty('--mochi-count-icon-scale', MOCHI_ICON_SIZE / MOCHI_ICON_BASE_SIZE_PX);
            document.documentElement.style.setProperty('--mochi-count-icon-dx', MOCHI_ICON_OFFSET.dx + 'px');
            document.documentElement.style.setProperty('--mochi-count-icon-dy', MOCHI_ICON_OFFSET.dy + 'px');
        }
        /**
         * 設定（メニュー）ボタンのタップを処理する。初回のみヒントを表示してからメニューモーダルを開く。
         * @returns {void}
         */
        export function onMenuButtonTap() {
            if (!seenButtonHints.menu) { seenButtonHints.menu = true; saveGame(); showMochiComment('設定はここから触れるで！'); }
            // ../../state.js: refreshCloudBackupStatus：クラウド上の最終バックアップ日時を取得して画面に反映する
            openModal('menu-modal'); refreshCloudBackupStatus();
        }
        /**
         * 背景（UI簡素化）ボタンのタップを処理する。初回のみヒントを表示してからUI表示を切り替える。
         * @returns {void}
         */
        export function onUiButtonTap() {
            if (!seenButtonHints.ui) { seenButtonHints.ui = true; saveGame(); showMochiComment('写真撮る時とかに使こてな！'); }
            toggleUiDeclutter();
        }
        /**
         * お土産ボタンのタップを処理する。初回のみヒントを表示してからお土産コレクション画面を開く。
         * @returns {void}
         */
        export function onFeedButtonTap() {
            if (!seenButtonHints.feed) { seenButtonHints.feed = true; saveGame(); showMochiComment('ここからお土産あげられるんやで！'); }
            // ./hud.js: openOmiyageCollection はおみやげコレクション画面を開く
            openOmiyageCollection();
        }

        /**
         * 画面を開いた直後の挨拶を表示する。その日その時間帯にまだ挨拶していなければ挨拶を、既に挨拶済みならおかえりのセリフを出す。
         * @returns {void}
         */
        export function showOpeningGreeting() {
            const now = new Date();
            // ../../main.js: getTimeBucketIndex：時刻から時間帯インデックスを求める
            const bucketIdx = getTimeBucketIndex(now.getHours());
            const bucketName = TIME_BUCKETS[bucketIdx];
            const todayKey = getLocalDateString(now) + '_' + bucketName;
            const lastKey = localStorage.getItem(GREETING_STATE_KEY);
            let text;
            // ../../main.js: pickRandom は配列からランダムに1つ選ぶ関数、../../data.js: dialogueData はセリフ集データ
            if (lastKey === todayKey) {
                text = pickRandom(dialogueData.welcomeBack[bucketName]);
            } else {
                text = pickRandom(dialogueData.timeGreetings[bucketName]);
                localStorage.setItem(GREETING_STATE_KEY, todayKey);
            }
            // ../../main.js: setLastGreetingHourBucket：「最後に挨拶した時間帯」を書き換えるsetter
            setLastGreetingHourBucket(bucketIdx); // アイドルループがすぐ二重に挨拶し直さないように
            showMochiComment(text);
        }

        export let mouthDragState = null;
        /**
         * 口パーツの位置調整モードのON/OFFを切り替える（開発者用調整ツール）。
         * @returns {void}
         */
        export function toggleMouthAdjustMode() {
            mouthAdjustMode = !mouthAdjustMode;
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const wrap = document.getElementById('mochisuke-breathe-wrap');
            const btn = document.getElementById('mouth-adjust-toggle-btn');
            if (!anchor || !wrap) return;
            if (mouthAdjustMode) {
                // 呼吸などの動きが付いたままだと位置合わせしづらいので、いったん基本の姿勢で止める
                wrap.classList.remove('breathe-idle');
                wrap.style.transform = 'scale(1, 1)';
                hideMochiComment(); // セリフも消して、口を閉じた状態の見た目で正確に合わせられるようにする
                anchor.style.display = 'block';
                anchor.style.pointerEvents = 'auto';
                anchor.style.outline = '2px dashed #e91e63';
                if (btn) btn.style.background = '#4caf50';
                setupMouthDrag(anchor);
                updateMouthReadout();
            } else {
                wrap.style.transform = '';
                wrap.classList.add('breathe-idle');
                anchor.style.pointerEvents = 'none';
                anchor.style.outline = '';
                if (btn) btn.style.background = '#e91e63';
            }
        }
        /**
         * 口パーツのドラッグによる位置調整を、指定のアンカー要素に対して一度だけセットアップする（開発者用調整ツール）。
         * @param {HTMLElement} anchor - ドラッグ対象となる口パーツのアンカー要素
         * @returns {void}
         */
        export function setupMouthDrag(anchor) {
            if (anchor.dataset.dragSetup) return; // 二重登録防止
            anchor.dataset.dragSetup = '1';
            anchor.addEventListener('pointerdown', (e) => {
                if (!mouthAdjustMode) return;
                e.stopPropagation(); e.preventDefault();
                try { anchor.setPointerCapture(e.pointerId); } catch (err) {}
                mouthDragState = { startX: e.clientX, startY: e.clientY };
            });
            anchor.addEventListener('pointermove', (e) => {
                if (!mouthDragState || !mouthAdjustMode) return;
                e.stopPropagation();
                const frame = document.getElementById('mochisuke-img-frame');
                const rect = frame.getBoundingClientRect();
                const dxPct = ((e.clientX - mouthDragState.startX) / rect.width) * 100;
                const dyPct = ((e.clientY - mouthDragState.startY) / rect.height) * 100;
                const curLeft = parseFloat(anchor.style.left) || 0;
                const curTop = parseFloat(anchor.style.top) || 0;
                anchor.style.left = (curLeft + dxPct) + '%';
                anchor.style.top = (curTop + dyPct) + '%';
                mouthDragState.startX = e.clientX;
                mouthDragState.startY = e.clientY;
                updateMouthReadout();
            });
            anchor.addEventListener('pointerup', () => { mouthDragState = null; });
            anchor.addEventListener('pointercancel', () => { mouthDragState = null; });
        }
        /**
         * 口パーツの幅を増減させる（開発者用調整ツール）。
         * @param {number} delta - 幅の変化量（%）
         * @returns {void}
         */
        export function adjustMouthSize(delta) {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            if (!anchor) return;
            const cur = parseFloat(anchor.style.width) || CONFIG.MOUTH_DEFAULT_WIDTH_PCT;
            anchor.style.width = Math.max(CONFIG.MOUTH_MIN_WIDTH_PCT, cur + delta) + '%';
            updateMouthReadout();
        }
        /**
         * 口パーツの現在位置・幅の座標情報を、readout表示欄に反映する。
         * @returns {void}
         */
        export function updateMouthReadout() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const el = document.getElementById('mouth-adjust-readout');
            if (!anchor || !el) return;
            el.textContent = `top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
        }
        /**
         * 口パーツの現在の座標情報をテキストにまとめ、クリップボードにコピーする（開発者用調整ツール）。
         * @returns {void}
         */
        export function copyMouthCoords() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const text = `口パーツ: top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
            const textarea = document.getElementById('mouth-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        // 🛠️ もちすけ本体の大きさ調整。着せ替え部屋も全く同じ大きさに揃える約束なので、
        // ここで変えた値は、着せ替え部屋のもちすけ本体にもその場で同期する
        /**
         * もちすけ本体の大きさを増減させ、着せ替え部屋のもちすけ本体にも同じ大きさを同期する（開発者用調整ツール）。
         * @param {number} deltaWidth - 幅の変化量（px）
         * @param {number} deltaMaxHeight - 最大高さの変化量（px）
         * @returns {void}
         */
        export function adjustMochisukeBodySize(deltaWidth, deltaMaxHeight) {
            const btn = document.getElementById('mochisuke-btn');
            const curWidth = parseFloat(btn.style.width) || CONFIG.MOCHISUKE_DEFAULT_WIDTH_PX;
            const curMaxH = parseFloat(btn.style.maxHeight) || CONFIG.MOCHISUKE_DEFAULT_MAX_HEIGHT_PX;
            const newWidth = Math.max(CONFIG.MOCHISUKE_MIN_SIZE_PX, curWidth + deltaWidth);
            const newMaxH = Math.max(CONFIG.MOCHISUKE_MIN_SIZE_PX, curMaxH + deltaMaxHeight);
            btn.style.width = newWidth + 'px';
            btn.style.maxHeight = newMaxH + 'px';
            const roomWrap = document.getElementById('kisekae-mochisuke-wrap');
            if (roomWrap) { roomWrap.style.width = newWidth + 'px'; roomWrap.style.maxHeight = newMaxH + 'px'; }
            updateMochisukeBodyReadout();
        }
        /**
         * もちすけ本体の現在の大きさ情報を、readout表示欄に反映する。
         * @returns {void}
         */
        export function updateMochisukeBodyReadout() {
            const btn = document.getElementById('mochisuke-btn');
            const el = document.getElementById('mochisuke-body-readout');
            if (!btn || !el) return;
            el.textContent = `width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};（着せ替え部屋にも自動で同期済み）`;
        }
        /**
         * もちすけ本体の現在の大きさ情報をテキストにまとめ、クリップボードにコピーする（開発者用調整ツール）。
         * @returns {void}
         */
        export function copyMochisukeBodyCoords() {
            const btn = document.getElementById('mochisuke-btn');
            const text = `もちすけ本体: width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};`;
            const textarea = document.getElementById('mochisuke-body-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        /**
         * 指定IDのモーダルを開く。給餌中であれば片付け、効果音を鳴らす（skipSound指定時は無音）。
         * @param {string} id - 開くモーダルのDOM要素ID
         * @param {boolean} [skipSound] - trueの場合、開く効果音を鳴らさない
         * @returns {void}
         */
        export function openModal(id, skipSound) {
            // ../../tap.js: cancelFeedDragIfActive は給餌中のドラッグ状態を中断して片付ける
            cancelFeedDragIfActive(); // 給餌中に他画面へ移動したら、置きっぱなしのおみやげを片付ける
            // ../../main.js: playAudioFile で効果音を再生
            if (!skipSound) playAudioFile('audio/skill_tap.mp3');
            document.body.classList.add('modal-open');
            document.getElementById(id).style.display = "flex";
        }
        /**
         * 指定IDのモーダルを閉じる。絵日記モーダルをスタンプ未押下で閉じた場合は、スタンプボタンを再表示する。
         * @param {string} id - 閉じるモーダルのDOM要素ID
         * @returns {void}
         */
        export function closeModal(id) {
            document.body.classList.remove('modal-open'); document.getElementById(id).style.display = "none";
            // ../../progress.js: isPendingStampMoment：スタンプを押すべき瞬間かどうかを表すフラグ
            // 🔴 スタンプを押さずに絵日記を閉じた場合、進捗エリアのボタンを再表示して操作不能にならないようにする
            if (id === 'diary-modal' && isPendingStampMoment) {
                const btn = document.getElementById('stamp-press-btn');
                if (btn) btn.style.display = 'flex';
            }
        }

        /**
         * トロフィールームを開き、各都道府県のトロフィー獲得状況をグリッド表示する。
         * @returns {void}
         */
        export function openTrophyRoom() {
            const grid = document.getElementById('trophy-grid');
            grid.innerHTML = "";
            // ../../data.js: stages は各ステージ（都道府県）のデータ配列
            stages.forEach((stage, i) => {
                const cell = document.createElement('div');
                cell.style.cssText = "text-align:center; padding:6px 2px; border-radius:8px; background:#fff8ec; cursor:pointer;";
                // ../../progress.js: currentStageIndex：到達済み最終ステージの番号
                if (i > currentStageIndex) {
                    cell.style.opacity = "0.4";
                    cell.innerHTML = `<div style="font-size:1.3rem;">❓</div><div style="font-size:0.55rem; color:#999;">???</div>`;
                    cell.onclick = () => alert("まだ訪れていない県じゃ！旅を進めよう。");
                } else {
                    // ../../progress.js: getPrefTrophy/getPrefTrophyIcon/showPrefTrophyDetail は、それぞれ
                    // 県ごとのトロフィー種類の判定・アイコン取得・詳細表示を行う関数
                    const trophy = getPrefTrophy(i);
                    cell.innerHTML = `<div style="font-size:1.3rem;">${getPrefTrophyIcon(trophy)}</div><div style="font-size:0.55rem; color:#5d4037;">${stage.name}</div>`;
                    cell.onclick = () => showPrefTrophyDetail(i);
                }
                grid.appendChild(cell);
            });
            openModal('trophy-room-modal');
        }

        // 💼 おしごとミッション
        /**
         * 画面を暗転させてから、おしごとミッションモーダルを閉じる。
         * @returns {void}
         */
        export function closeOshigoto() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('mission-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.OSHIGOTO_FADE_IN_DELAY_MS);
            }, CONFIG.OSHIGOTO_FADE_OUT_MS);
        }
        /**
         * ミッションの日付/週またぎを最新化してから、おしごとミッションモーダルを開き、現在のタブを表示する。
         * @returns {void}
         */
        export function openOshigotoPlaceholder() {
            // ../../progress.js: checkAndRotateMissions：日付/週が変わっていればミッション内容を入れ替える
            checkAndRotateMissions(); // 開くたびに、日付/週またぎを最新化する
            openModal('mission-modal');
            switchMissionTab(currentMissionTab);
        }
        export let currentMissionTab = 'tutorial';
        /**
         * ミッションタブ（チュートリアル/デイリー/ウィークリー）を切り替え、ミッション一覧を再描画する。
         * @param {string} tab - 切り替え先のタブ名（'tutorial' | 'daily' | 'weekly'）
         * @returns {void}
         */
        export function switchMissionTab(tab) {
            currentMissionTab = tab;
            ['tutorial', 'daily', 'weekly'].forEach(t => {
                document.getElementById(`mission-tab-${t}`).classList.toggle('active', t === tab);
            });
            renderMissionList();
        }
        /**
         * 1件分のミッションカードのHTML文字列を生成する（進捗バー・受取ボタンの状態を含む）。
         * @param {Object} mission - ミッション定義（id/text/target/rewardなどを持つオブジェクト）
         * @returns {string} ミッションカードのHTML文字列
         */
        export function renderMissionRow(mission) {
            // ../../progress.js: getMissionProgress/isMissionComplete/missionClaimed は、それぞれ
            // ミッションの現在の進捗値を求める関数・達成済みか判定する関数・受取済みミッションIDの記録
            const progress = getMissionProgress(mission);
            const complete = isMissionComplete(mission);
            const claimed = missionClaimed[mission.id];
            let btnHtml;
            if (claimed) {
                btnHtml = `<button class="item-action-btn" disabled style="background:#bbb; color:#fff;">受取済</button>`;
            } else if (complete) {
                btnHtml = `<button class="item-action-btn btn-green" onclick="onClaimMissionTap('${mission.id}')">受け取る</button>`;
            } else {
                btnHtml = `<button class="item-action-btn" disabled style="background:#ddd; color:#999;">未達成</button>`;
            }
            const progressText = `${Math.min(progress, mission.target)}/${mission.target}`;
            const pct = Math.min(100, (progress / mission.target) * 100);
            const isDone = claimed || complete; // 進捗バーの色分け用（水色にするかどうか）
            let cardClass = '';
            if (claimed) cardClass = 'mission-card-claimed'; // 受取済みだけ、ポケポケ風に薄い灰色にする
            else if (complete) cardClass = 'mission-card-done';
            return `
                <div class="mission-card ${cardClass}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.85rem; font-weight:700; color:#5d4037;">${mission.text}</span>
                        <span style="font-size:0.7rem; color:#e91e63; font-weight:900; flex-shrink:0; margin-left:8px;">🪙${mission.reward}</span>
                    </div>
                    <div style="background:#e8e0d5; border-radius:6px; height:8px; overflow:hidden; margin-top:8px;">
                        <div style="background:${isDone ? '#4fc3f7' : '#4caf50'}; height:100%; width:${pct}%; transition:width 0.3s;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <span style="font-size:0.7rem; color:#999;">${progressText}</span>
                        ${btnHtml}
                    </div>
                </div>
            `;
        }
        /**
         * 現在選択中のミッションタブの内容に応じて、ミッション一覧を描画する。
         * @returns {void}
         */
        export function renderMissionList() {
            const container = document.getElementById('mission-list-container');
            let html = '';

            // ../../progress.js: tutorialMissionStep：現在のチュートリアルミッション段階、
            // ../../data.js: TUTORIAL_MISSIONS はチュートリアルミッション定義の配列
            if (currentMissionTab === 'tutorial') {
                if (tutorialMissionStep < TUTORIAL_MISSIONS.length) {
                    html += renderMissionRow(TUTORIAL_MISSIONS[tutorialMissionStep]);
                } else {
                    html += `<div style="text-align:center; color:#aaa; font-size:0.8rem; padding:24px;">はじめてのおしごとは、もう全部クリアしたで！</div>`;
                }
            } else if (currentMissionTab === 'daily') {
                // ../../progress.js: missionDailySelected：今日選ばれているデイリーミッションIDの配列、
                // getMissionDef はIDからミッション定義を引く関数
                missionDailySelected.forEach(id => {
                    const m = getMissionDef(id);
                    if (m) html += renderMissionRow(m);
                });
            } else if (currentMissionTab === 'weekly') {
                // ../../progress.js: missionWeeklySelected は今週選ばれているウィークリーミッションIDの配列
                missionWeeklySelected.forEach(id => {
                    const m = getMissionDef(id);
                    if (m) html += renderMissionRow(m);
                });
            }

            container.innerHTML = html;
        }
        /**
         * ミッションの報酬受け取りボタンのタップを処理する。受け取り成功時は効果音を鳴らし表示を更新する。
         * @param {string} id - 受け取り対象のミッションID
         * @returns {void}
         */
        export function onClaimMissionTap(id) {
            // ../../progress.js: claimMission：ミッション報酬を受け取り済みにして報酬を付与する
            const success = claimMission(id);
            if (success) {
                // ../../main.js: playAudioFile で効果音を再生、./hud.js: updateDisplay でHUD表示を更新
                playAudioFile('audio/levelup.mp3');
                updateDisplay();
                renderMissionList();
            }
        }
        window.onClaimMissionTap = onClaimMissionTap; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要



        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        /**
         * balloonAutoHideTimerを書き換える（他ファイルからのsetter）。
         * @param {*} v - セリフ吹き出し自動非表示用のタイマーID
         * @returns {void}
         */
        export function setBalloonAutoHideTimer(newBalloonAutoHideTimer) { balloonAutoHideTimer = newBalloonAutoHideTimer; }
        /**
         * hasSeenTutorialを書き換える（他ファイルからのsetter）。
         * @param {boolean} v - チュートリアルを見たかどうか
         * @returns {void}
         */
        export function setHasSeenTutorial(newHasSeenTutorial) { hasSeenTutorial = newHasSeenTutorial; }
        /**
         * seenButtonHintsを書き換える（他ファイルからのsetter）。
         * @param {Object} v - 4隅ボタンごとのヒント表示済みフラグ
         * @returns {void}
         */
        export function setSeenButtonHints(newSeenButtonHints) { seenButtonHints = newSeenButtonHints; }
        window.onBgmVolumeChange = onBgmVolumeChange;
        window.onSfxVolumeChange = onSfxVolumeChange;
        window.resetVolumeSettings = resetVolumeSettings;
        window.confirmSkipTutorial = confirmSkipTutorial;
        window.doSkipTutorial = doSkipTutorial;
        window.saveTutorialPlayerName = saveTutorialPlayerName;
        window.onMapButtonTap = onMapButtonTap;
        window.onMenuButtonTap = onMenuButtonTap;
        window.onUiButtonTap = onUiButtonTap;
        window.onFeedButtonTap = onFeedButtonTap;
        window.toggleMouthAdjustMode = toggleMouthAdjustMode;
        window.adjustMouthSize = adjustMouthSize;
        window.copyMouthCoords = copyMouthCoords;
        window.adjustMochisukeBodySize = adjustMochisukeBodySize;
        window.copyMochisukeBodyCoords = copyMochisukeBodyCoords;
        window.openModal = openModal;
        window.closeModal = closeModal;
        window.closeOshigoto = closeOshigoto;
        window.openOshigotoPlaceholder = openOshigotoPlaceholder;
        window.switchMissionTab = switchMissionTab;
