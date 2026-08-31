        // 🚧🚧🚧 メンテナンスモード 🚧🚧🚧
        // 大きな更新をする直前に true にしてから公開すると、プレイヤーには「メンテナンス中」画面だけが表示され、
        // ゲーム本体・セーブ/ロード・クラウドバックアップは一切動かなくなる（壊れた状態が保存されてしまう事故を防ぐ）。
        // 手元で動作確認が終わったら、false に戻して公開し直す。
        const MAINTENANCE_MODE = false;

        // 画面の実測高さ(--app-height)は<head>内で先に設定済み。ここでは重複させない。

        // 📲 ホーム画面に追加まわり
        // PWA化(manifest+ServiceWorker)しただけでは自動でホーム画面に追加はされない。
        // ・Android/Chrome系 → beforeinstallpromptイベントを捕まえて自前ボタンから誘導すれば即インストール可
        // ・iOS Safari → ブラウザ側に自動インストールAPIが無いため「共有→ホーム画面に追加」を手動案内するしかない
        let deferredInstallPrompt = null;
        const installBanner = document.getElementById('install-banner');
        const installBannerText = document.getElementById('install-banner-text');
        const installBannerAction = document.getElementById('install-banner-action');
        const installBannerClose = document.getElementById('install-banner-close');
        const INSTALL_DISMISS_KEY = 'punicker_install_dismissed_v1';

        function isRunningStandalone() {
            return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        }

        function showInstallBanner(mode) {
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
        const ua = navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        // X・LINE・Discord・Instagram・Facebookなどのアプリ内ブラウザを検出（それぞれUAに特徴的な文字列が入る）
        const isInAppBrowser = /line\/|fban|fbav|instagram|discord|twitter/.test(ua);
        if (isIOSDevice) {
            setTimeout(() => showInstallBanner(isInAppBrowser ? 'ios-inapp' : 'ios'), 4000);
        }

        // 📏 下の余白を「測って強制的に埋める」最終手段
        // 100vh/100dvh/JS実測のvh変数/position:fixed+inset:0、と何を試してもiPhoneのPWAで
        // 下に隙間が残るケースがあったため、今回はCSSの単位を信じるのをやめ、
        // 実際に画面の下端と#game-screenの下端の差(px)を毎回測って、その分だけ
        // 高さを強制的に足す方式に変更した。原因の理屈が何であれ、実測して埋めるので確実に効く。
        function fixBottomGap() {
            const gs = document.getElementById('game-screen');
            if (!gs) return;
            gs.style.height = ''; // 一旦flexの自然な高さに戻す
            requestAnimationFrame(() => {
                const rect = gs.getBoundingClientRect();
                const trueHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
                const gap = trueHeight - rect.bottom;
                if (gap > 0.5) {
                    gs.style.height = (rect.height + gap) + 'px';
                }
            });
        }
        window.addEventListener('load', fixBottomGap);
        window.addEventListener('resize', fixBottomGap);
        window.addEventListener('orientationchange', fixBottomGap);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', fixBottomGap);
        // iOS standaloneは起動直後、数値が数百ms遅れて確定することがあるため複数回リトライする
        [50, 200, 500, 1000, 2000].forEach((ms) => setTimeout(fixBottomGap, ms));

        // ☰ メニュー機能
        const FEEDBACK_EMAIL = 'your-email@example.com';
        async function sendFeedback() {
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
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 15) e.preventDefault();
            lastTouchEnd = now;
        }, { passive: false });

        // 47都道府県ステージデータ
        let isBgmInitialized = false;
        let canvas = null; let ctx = null; let particleList = [];
        let rainCanvas = null; let rainCtx = null;
        // 🌧️ もちの雨（自動増加(mps)がある時、もちすけの後ろにうっすら降ってくる。収入が少ない時はほとんど降らない）
        let mochiRainList = [];
        const MOCHI_RAIN_MAX = 10;
        function spawnMochiRain() {
            const mps = getMps();
            if (!rainCanvas || mps <= 0 || document.hidden) return;
            if (mochiRainList.length >= MOCHI_RAIN_MAX) return; // 上限に達している間は新規追加を控える（既存の粒を消して落下を妨げないため）
            // mpsが小さいうちは滅多に降らないようにし、育つにつれて自然に増える
            const spawnChance = Math.min(1, mps / 40);
            if (Math.random() > spawnChance) return;
            const dropCount = Math.min(3, Math.max(1, Math.floor(Math.log10(mps + 1) / 1.5)));
            for (let i = 0; i < dropCount; i++) {
                if (mochiRainList.length >= MOCHI_RAIN_MAX) break;
                mochiRainList.push({
                    x: Math.random() * rainCanvas.width,
                    y: -20,
                    vy: 0.9 + Math.random() * 0.7,
                    vx: (Math.random() - 0.5) * 0.4,
                    rot: Math.random() * 360,
                    rotSpeed: (Math.random() - 0.5) * 3,
                    size: 36 + Math.random() * 14
                });
            }
        }
        setInterval(spawnMochiRain, 1200);
        // ✨ 常時ふわふわ漂う環境パーティクル（タップしていない時も画面に生命感を出す）
        let ambientSparkles = [];
        function spawnAmbientSparkle() {
            if (!canvas || document.hidden) return;
            ambientSparkles.push({
                x: Math.random() * canvas.width,
                y: canvas.height + 10,
                vx: (Math.random() - 0.5) * 0.25,
                vy: -(0.25 + Math.random() * 0.35),
                size: 1.5 + Math.random() * 2.5,
                life: 0,
                maxLife: 500 + Math.random() * 300
            });
            if (ambientSparkles.length > 18) ambientSparkles.shift(); // 増えすぎ防止
        }
        setInterval(spawnAmbientSparkle, 900);
        const particleImg = new Image(); particleImg.src = 'ui_images/mochi_particle.webp';
        // ctx.filter (hue-rotate/drop-shadow) はスマホブラウザ(特にiOS Safari)で
        // 正しく適用されないことがあるため、金色版画像を事前に1回だけ焼き込んで使い回す
        let goldParticleImg = null;
        particleImg.onload = () => {
            try {
                const w = particleImg.naturalWidth || particleImg.width || 64;
                const h = particleImg.naturalHeight || particleImg.height || 64;
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

        function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

        // もちすけの吹き出しにテキストを表示するヘルパー（イベント時にどこからでも呼べます）
        function getTimeBucketIndex(h) {
            if (h >= 5 && h < 11) return 0;  // morning
            if (h >= 11 && h < 17) return 1; // noon
            if (h >= 17 && h < 22) return 2; // evening
            return 3;                        // lateNight
        }

        // 今の時間帯に合った挨拶をランダムで1つ返す
        let lastGreetingHourBucket = -1;
        // 📖 初回チュートリアル：もちすけのセリフで進行し、該当ボタンを光らせながら説明する。
        // 他のボタンは（もちすけ本体を除いて）誤操作防止のため一時的に押せなくする。
        let audioCtx = null;
        const audioBuffers = {};        // fileName -> デコード済みAudioBuffer
        const audioBufferPromises = {}; // fileName -> デコード中のPromise（二重読み込み防止）

        function getAudioContext() {
            if (!audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AC();
            }
            return audioCtx;
        }

        function loadAudioBuffer(fileName) {
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

        function preloadAllSfx() {
            SFX_FILES.forEach(loadAudioBuffer);
        }

        // 🔊 音量設定（BGM/効果音を別々に調整できる。0〜1の倍率としてlocalStorageに保存）
        let bgmVolumeMult = parseFloat(localStorage.getItem('punicker_bgm_volume') ?? '0.3');
        let sfxVolumeMult = parseFloat(localStorage.getItem('punicker_sfx_volume') ?? '1');
        if (isNaN(bgmVolumeMult)) bgmVolumeMult = 1;
        if (isNaN(sfxVolumeMult)) sfxVolumeMult = 1;

        // 🎵 BGM再生システム（Web Audio API方式）
        // 【重要】iOSのSafariは<audio>要素の.volumeプロパティを完全に無視する仕様がある
        // （音量はハードウェアの音量ボタンでしか変えられないようにする、というAppleの意図的な制限）。
        // 効果音は既にWeb Audio APIのGainNodeで音量調整していたので問題なかったが、
        // BGMだけ従来の<audio>要素のままだったため、スライダーを動かしても一切変化しなかった。
        // BGMもGainNode経由の再生に統一し、これで確実に音量調整できるようにする。
        let bgmGainNode = null;
        let bgmSourceNode = null;
        let currentBgmFile = null;

        function ensureBgmGain() {
            if (!bgmGainNode) {
                const ctx = getAudioContext();
                bgmGainNode = ctx.createGain();
                bgmGainNode.gain.value = bgmVolumeMult;
                bgmGainNode.connect(ctx.destination);
            }
            return bgmGainNode;
        }

        function playBgmLoop(fileName) {
            if (currentBgmFile === fileName && bgmSourceNode) return; // 既に同じ曲が再生中なら何もしない
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

        function stopBgm() {
            if (bgmSourceNode) { try { bgmSourceNode.stop(); } catch (e) {} bgmSourceNode = null; currentBgmFile = null; }
        }

        function applyBgmVolume() {
            if (bgmGainNode) bgmGainNode.gain.value = bgmVolumeMult;
        }

        function playBufferNow(buffer, vol, rate = 1) {
            const ctx = getAudioContext();
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = rate;
            const gain = ctx.createGain();
            gain.gain.value = vol * sfxVolumeMult;
            source.connect(gain).connect(ctx.destination);
            source.start(0);
        }

        function playAudioFile(fileName, vol = 0.6) {
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
        function playAudioFilePitched(fileName, vol, rate) {
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
        function unlockAllPooledAudio() {
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

        const capturedErrors = [];
        window.addEventListener('error', (e) => {
            capturedErrors.push(`[JSエラー] ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);
            if (capturedErrors.length > 8) capturedErrors.shift();
        });
        window.addEventListener('unhandledrejection', (e) => {
            capturedErrors.push(`[Promiseエラー] ${e.reason}`);
            if (capturedErrors.length > 8) capturedErrors.shift();
        });

        /* 🛠️ 開発者専用メニュー：URLに ?dev=1 を付けた時だけ有効になる（通常プレイヤーには一切見えない） */
        let IS_DEV_MODE = false;
        function initDevMode() {
            // 推測されないよう、単純な値ではなく長いランダムな文字列をキーにしている
            const isDev = new URLSearchParams(location.search).get('dev') === 'zk9m2xq7wv4p8trh21bs';
            if (!isDev) return;
            IS_DEV_MODE = true;
            window.IS_DEV_MODE = true; // Firebase送信は別のtype="module"スクリプトにあるため、windowを通して橋渡しする
            const section = document.getElementById('dev-tools-section');
            if (section) section.style.display = 'block';
        }

        function debugAddMochi() {
            const currentReq = stages[currentStageIndex] ? stages[currentStageIndex].distance : 1000000;
            score += currentReq;
            if (selectedStageIndex === currentStageIndex && currentStageIndex < stages.length) {
                currentStageProgress += currentReq; checkStageProgress();
            }
            updateDisplay(); saveGame();
        }

        function debugLevelUpSkill(key) {
            skills[key].lv++;
            playAudioFile('audio/levelup.mp3');
            updateSkillUI(); saveGame();
        }

        function debugLevelUpAllSkills() {
            Object.keys(skills).forEach(key => { skills[key].lv++; });
            playAudioFile('audio/levelup.mp3');
            updateSkillUI(); saveGame();
            alert("⚡ すべてのスキル・必殺技を即時獲得＆Lv+1しました！");
        }

        function debugResetCooldowns() {
            Object.keys(skills).forEach(key => {
                skills[key].currentCd = 0; skills[key].activeTimer = 0;
                endSkillVisualEffect(key);
            });
            updateSkillUI();
            alert("⏳ 全スキルのクールタイムをリセットしました！");
        }

        // 👄 口パーツを、実際のゲーム画面上で直接ドラッグして位置調整するモード（デバイスによるズレを避けるため）
        function initAndPlayBGM() {
            if (isBgmInitialized) return;
            isBgmInitialized = true;
            playBgmLoop('audio/bgm.mp3');
        }

        // 🎬 OP画面をタップしてゲームへ。ブラウザの仕様上「一切操作なしで音を鳴らす」ことはiOSではできないが、
        // どのみちOP画面をタップしないとゲームに入れない作りなので、そのタップの瞬間にBGMを鳴らせば
        // 体感的には「ゲームを開いたら音楽が鳴る」とほぼ同じ感覚になる。
        function startGameFromOpScreen() {
            initAndPlayBGM();
            const op = document.getElementById('op-screen');
            if (op) {
                op.classList.add('op-hide');
                setTimeout(() => { op.style.display = 'none'; }, 650);
            }
        }

        function resizeParticleCanvas() {
            const rect = document.getElementById('game-screen').getBoundingClientRect();
            gameScreenRect = rect; // タップ演出（リップル/文字/パーティクル）で使い回すキャッシュ
            if (bunshinCloneRects.length > 0) refreshBunshinCloneRects();
            if (rainCanvas) { rainCanvas.width = rect.width; rainCanvas.height = rect.height; }
            if (!canvas) return;
            canvas.width = rect.width; canvas.height = rect.height;
        }
        function getGameScreenRect() {
            return gameScreenRect || document.getElementById('game-screen').getBoundingClientRect();
        }

        // #game-screenの背景と同じ画像をbodyにも敷いておく。
        // これで万一OS側のビューポート計算のクセで数十px程度のズレが残っても、
        // 見えるのは同じ背景の続きになるので「白い余白」としては目立たなくなる。
        function setGameBackground(url) {
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
            initKisekaeTransformSync(); // タップ・長押し・伸ばす等の変形に、帽子・顔パーツを追従させる仕組みを開始する
            // 🎫 着せ替えアイテムは、まだガチャ実装前なので、開発者URLの人だけ全部持っている状態にする
            // 🐛修正：loadGame()より前にやると、セーブデータの読み込みで上書きされて消えてしまっていた
            if (IS_DEV_MODE) {
                Object.keys(KISEKAE_ITEMS).forEach(cat => {
                    KISEKAE_ITEMS[cat].forEach(item => {
                        if (!ownedKisekaeItems[cat].includes(item.id)) ownedKisekaeItems[cat].push(item.id);
                    });
                });
            }
            checkForCloudRestoreOnLoad();
            checkOfflineEarnings();
            setTimeout(checkShowTutorial, 1200);

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
        const MOCHI_DECIMAL_PLACES = 6; // 大きい数字の時、小数点以下を何桁まで表示するか（5〜10の範囲で調整可能）
        // 🔒 他プレイヤーが入力した名前などをそのままinnerHTMLに差し込むと、
        // 悪意のあるスクリプトを名前に仕込まれて他の人の画面で実行されてしまう(XSS)ため、必ずこれを通す
        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = String(str ?? '');
            return div.innerHTML;
        }

        function formatMochi(n) {
            n = Math.floor(n);
            if (n < 1e8) return n.toLocaleString(); // 1億未満はそのまま数字表示（万単位の小数は意味が薄いので廃止）
            if (n >= 1e20) return (n / 1e20).toFixed(MOCHI_DECIMAL_PLACES) + '垓';
            if (n >= 1e16) return (n / 1e16).toFixed(MOCHI_DECIMAL_PLACES) + '京';
            if (n >= 1e12) return (n / 1e12).toFixed(MOCHI_DECIMAL_PLACES) + '兆';
            return (n / 1e8).toFixed(MOCHI_DECIMAL_PLACES) + '億';
        }

        // 📳 振動（ハプティクス）
        // 【重要】iOSのSafari/PWAはVibration API自体を実装していないため、iPhoneでは何も起きません
        // （AndroidのChromeなどでは有効です）。iPhone側でも「叩いた感」を出したい場合は、
        // 振動の代わりに画面のフラッシュ/シェイク演出などの視覚効果で代替するのがおすすめです。
        function vibrate(pattern) {
            if (navigator.vibrate) {
                try { navigator.vibrate(pattern); } catch (e) {}
            }
        }

        // 🎬 画面シェイク（iPhoneで振動が効かない分、視覚的な「叩いた感」を強化する）
        let shakeTimeout = null;
        let lastScreenShakeTime = 0;
        function screenShake(size = 'small') {
            const el = document.getElementById('game-screen');
            if (!el) return;
            const now = performance.now();
            // 必殺技中など、短時間に何度も会心が重なる場面で、強制リフロー(void el.offsetWidth)が
            // 何度も走って重くなるのを防ぐため、短い間隔では新しいシェイクを間引く
            if (now - lastScreenShakeTime < 150) return;
            lastScreenShakeTime = now;
            el.classList.remove('shake-small', 'shake-big');
            void el.offsetWidth;
            el.classList.add(size === 'big' ? 'shake-big' : 'shake-small');
            clearTimeout(shakeTimeout);
            shakeTimeout = setTimeout(() => el.classList.remove('shake-small', 'shake-big'), 400);
        }

        // 🎬 画面フラッシュ（会心・黄金・フィーバーなどの「決まった瞬間」を派手に見せる）
        let lastScreenFlashTime = 0;
        function screenFlash(color, peakOpacity = 0.35) {
            const el = document.getElementById('screen-flash-overlay');
            if (!el) return;
            const now = performance.now();
            // 連打で会心が連発すると、フラッシュが完全に消える前に次のフラッシュが割り込み、
            // 画面(もちすけを含む)がずっと光ったまま見えてしまうため、短い間隔では新しいフラッシュを間引く
            if (now - lastScreenFlashTime < 120) return;
            lastScreenFlashTime = now;
            el.classList.remove('fade-out');
            el.style.background = color;
            el.style.opacity = String(peakOpacity);
            requestAnimationFrame(() => {
                el.classList.add('fade-out');
                el.style.opacity = '0';
            });
        }

        let rippleList = [];
        let floatingTextList = [];

        function remToPx(sizeStr) {
            if (typeof sizeStr === 'number') return sizeStr;
            const s = String(sizeStr).trim();
            if (s.endsWith('rem')) return parseFloat(s) * 16;
            if (s.endsWith('px')) return parseFloat(s);
            return parseFloat(s) || 16;
        }

        // モーダル内（ミニゲームなど）で使う軽量パーティクル演出。
        // #particle-canvasはモーダルより下のレイヤーにあるため、モーダルを開いた状態でcreateParticle()を
        // 呼んでも画面には映らない（もちすけの後ろに隠れて見える原因もこれ）。これはposition:fixedのDOM要素で
        // モーダルより手前に直接描画するので、どこで呼んでも確実に見える。
        function spawnModalParticleBurst(x, y, count, color) {
            for (let i = 0; i < count; i++) {
                const p = document.createElement('div');
                const angle = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * 50;
                const dx = Math.cos(angle) * dist;
                const dy = Math.sin(angle) * dist - 20;
                p.style.cssText = `position:fixed; left:${x}px; top:${y}px; width:10px; height:10px; border-radius:50%;
                    background:${color}; z-index:30000; pointer-events:none;
                    transition: transform 0.6s ease-out, opacity 0.6s ease-out; opacity:1; transform:translate(-50%,-50%);`;
                document.body.appendChild(p);
                requestAnimationFrame(() => {
                    p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    p.style.opacity = '0';
                });
                setTimeout(() => p.remove(), 650);
            }
        }

        function createRippleEffect(x, y) {
            const rect = getGameScreenRect();
            rippleList.push({ x: x - rect.left, y: y - rect.top, start: performance.now() });
        }

        function createFloatingText(x, y, text, color = "#ff9800", size = "1.3rem") {
            if (floatingTextList.length > 40) return; // パーティクルと同様、連打が続いても際限なく増えないように上限を設ける
            const rect = getGameScreenRect();
            floatingTextList.push({
                x: x - rect.left, y: y - rect.top,
                text, color: color || '#ff9800', fontSize: remToPx(size),
                start: performance.now()
            });
        }

        function createParticle(x, y, isGold = false) {
            if (particleList.length > 50) return; 
            const rect = getGameScreenRect();
            particleList.push({
                x: x - rect.left, y: y - rect.top,
                vx: (Math.random() - 0.5) * 15,
                vy: -(Math.random() * 6 + 11),
                gravity: 0.38,
                isGold: isGold
            });
        }

        const updateAndRenderParticles = () => {
            if (!ctx || !canvas) { requestAnimationFrame(updateAndRenderParticles); return; }
            renderMochiRainFrame(); // もちの雨も同じフレームでまとめて処理する（RAFを2重に走らせない）
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = particleList.length - 1; i >= 0; i--) {
                const p = particleList[i];
                p.x += p.vx; p.y += p.vy; p.vy += p.gravity;

                if (p.isGold) {
                    // 金色みと輝きを強化（事前に焼き込んだ金色画像＋canvasネイティブのshadowで表現。
                    // ctx.filterはモバイルブラウザで無視されることがあるため使わない）
                    ctx.shadowColor = 'rgba(255, 215, 0, 0.9)';
                    ctx.shadowBlur = 14;
                    ctx.drawImage(goldParticleImg || particleImg, p.x - 35, p.y - 35, 70, 70);
                    ctx.shadowBlur = 0; // 次の描画に影響しないよう明示的に戻す（save/restoreより軽い）
                } else {
                    ctx.drawImage(particleImg, p.x - 21, p.y - 21, 42, 42);
                }

                if (p.y > canvas.height + 50) { particleList.splice(i, 1); }
            }

            // ✨ 環境パーティクル（ゆっくり漂う光の粒。フェードイン→フェードアウト）
            for (let i = ambientSparkles.length - 1; i >= 0; i--) {
                const s = ambientSparkles[i];
                s.x += s.vx; s.y += s.vy; s.life++;
                if (s.life >= s.maxLife) { ambientSparkles.splice(i, 1); continue; }
                const t = s.life / s.maxLife;
                const fade = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
                ctx.save();
                ctx.globalAlpha = Math.max(0, fade * 0.35);
                ctx.fillStyle = '#fff8dc';
                ctx.shadowColor = '#ffe9a8';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            const now = performance.now();

            // 波紋エフェクト（strokeStyle/lineWidthは毎回上書きするのでsave/restore不要）
            for (let i = rippleList.length - 1; i >= 0; i--) {
                const r = rippleList[i];
                const t = (now - r.start) / 400; // 0.4秒
                if (t >= 1) { rippleList.splice(i, 1); continue; }
                const eased = 1 - Math.pow(1 - t, 2);
                ctx.strokeStyle = `rgba(255, 152, 0, ${(0.6 * (1 - t)).toFixed(3)})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(r.x, r.y, eased * 65, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 浮き上がる文字
            for (let i = floatingTextList.length - 1; i >= 0; i--) {
                const f = floatingTextList[i];
                const t = (now - f.start) / 600; // 0.6秒
                if (t >= 1) { floatingTextList.splice(i, 1); continue; }
                let scale, translateY, opacity;
                if (t < 0.2) {
                    const local = t / 0.2;
                    scale = 0.8 + 0.4 * local;
                    translateY = -10 * local;
                    opacity = 1;
                } else {
                    const local = (t - 0.2) / 0.8;
                    scale = 1.2 - 0.2 * local;
                    translateY = -10 - 50 * local;
                    opacity = 1 - local;
                }
                ctx.save();
                ctx.globalAlpha = Math.max(0, opacity);
                ctx.translate(f.x, f.y + translateY);
                ctx.scale(scale, scale);
                ctx.font = `900 ${f.fontSize}px 'M PLUS Rounded 1c', 'Helvetica Neue', Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = 4;
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
        function renderMochiRainFrame() {
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

        // 10コンボ毎に+2%（例：50コンボで+10%、100コンボで+20%）。控えめな伸び方にして、頭打ちなく積み上げていける
        function lazyLoadImage(imgId) {
            const img = document.getElementById(imgId);
            if (img && !img.src && img.dataset.src) img.src = img.dataset.src;
        }

        window.addEventListener('resize', () => {
            const shopModal = document.getElementById('shop-modal');
            if (shopModal && shopModal.style.display === 'flex' && currentShopTab === 'omiyage') {
                syncOmiyageImageFrame();
            }
        });

        function startMochiLifeLoop() {
            setInterval(() => {
                if (isTutorialActive) return;
                const idleDuration = Date.now() - lastTappedTime;
                const balloon = document.getElementById('mochi-balloon');
                if (idleDuration > 5000 && !isFever) {
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
                            if (prefPool && Math.random() < 0.4) {
                                text = pickRandom(prefPool);
                            } else {
                                text = pickRandom(dialogueData.idleComments);
                            }
                        }
                        showMochiComment(text);
                    }
                }
            }, 12000);
        }

        // 🎁 プレゼント出現頻度・報酬の調整用定数（ここを変えるだけでバランス調整できます）
        const PRESENT_SPAWN_CHANCE = 0.2;      // 20秒毎の抽選確率（旧0.4→期待間隔が約2倍の100秒程度に）
        const PRESENT_SPAWN_INTERVAL_MS = 20000;
        const PRESENT_REWARD_MIN = 400;        // 旧200→倍
        const PRESENT_REWARD_DISTANCE_RATE = 0.1; // 旧0.05→倍
        const PRESENT_REWARD_MPS_RATE = 120;      // 旧60→倍

        // ミニゲームの基準報酬額（プレゼントボーナスと同じ考え方の基準額を使い回す）
        function startPresentSpawningLoop() {
            setInterval(() => { if (!isTutorialActive && !document.getElementById('lucky-present') && Math.random() < PRESENT_SPAWN_CHANCE) spawnLuckyPresent(); }, PRESENT_SPAWN_INTERVAL_MS);
        }

        const PRESENT_TAPS_REQUIRED = 10; // 風船(プレゼント)を割るのに必要なタップ数

        function spawnLuckyPresent() {
            const gameScreen = document.getElementById('game-screen');
            showMochiComment(pickRandom(dialogueData.eventComments.presentSpawn));
            const present = document.createElement('div'); present.id = 'lucky-present';
            present.innerHTML = '<img src="ui_images/present.webp" alt="プレゼント" class="present-floating-img" style="width:95px; height:95px; object-fit:contain; pointer-events:none;">';
            present.style.position = 'absolute'; present.style.cursor = 'pointer'; present.style.zIndex = '95'; present.style.transition = 'transform 11s linear';
            const rect = gameScreen.getBoundingClientRect();
            present.style.left = '-110px'; present.style.top = (Math.random() * (rect.height - 350) + 160) + 'px';
            gameScreen.appendChild(present);
            setTimeout(() => present.style.transform = `translateX(${rect.width + 220}px)`, 50);

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
                vibrate([20, 30, 60]);
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
                    const dist = 30 + Math.random() * 20;
                    createParticle(e.clientX + Math.cos(angle) * dist, e.clientY + Math.sin(angle) * dist, false);
                }
                const currentStage = stages[currentStageIndex] || stages[0];
                const bonus = Math.max(PRESENT_REWARD_MIN, Math.floor(currentStage.distance * PRESENT_REWARD_DISTANCE_RATE) + Math.floor(getMps() * PRESENT_REWARD_MPS_RATE));
                score += bonus;
                createFloatingText(e.clientX, e.clientY, `🎁福もちボーナス +${formatMochi(bonus)}`, "#ff9800", "1.5rem");
                saveGame(); updateDisplay();
                present.remove();
                hideMochiComment();
            });
            setTimeout(() => { if (present.parentNode) { present.remove(); hideMochiComment(); } }, 11000);
        }

        function spawnGoldMochi() {
            const gameScreen = document.getElementById('game-screen');
            showMochiComment(pickRandom(dialogueData.eventComments.goldMochiSpawn));
            const goldMochi = document.createElement('div'); goldMochi.id = 'fever-pop';
            const rect = gameScreen.getBoundingClientRect();
            goldMochi.style.left = (Math.random() * (rect.width - 80)) + 'px'; goldMochi.style.top = (Math.random() * (rect.height - 350) + 160) + 'px';
            gameScreen.appendChild(goldMochi);
            goldMochi.addEventListener('pointerdown', (e) => { e.stopPropagation(); goldMochi.remove(); hideMochiComment(); triggerFeverTime(); });
            setTimeout(() => { if (goldMochi.parentNode) { goldMochi.remove(); hideMochiComment(); } }, 6000);
        }

        const appStartTime = Date.now();
        const AUTOSAVE_CLOUD_GRACE_MS = 8000; // 起動直後の数秒間は、クラウドへの送信（ランキング・バックアップ）を見送る
                                                 // （起動直後の一瞬だけ表示がおかしくなるケースがあっても、それをクラウドに送ってしまわないための保険）
        setInterval(() => {
            saveGame();
            if (Date.now() - appStartTime < AUTOSAVE_CLOUD_GRACE_MS) return; // 起動直後はクラウド送信を見送る
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount);
            if (window.backupSaveData) {
                const raw = localStorage.getItem('mochisuke_save_data');
                if (raw) window.backupSaveData(raw);
            }
        }, 10000); // 10秒毎オートセーブ＋ランキング送信＋クラウドバックアップ

