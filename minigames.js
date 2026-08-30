        function getMinigameRewardMultiplier() { return 1 + prestigeShopLv.minigameReward * 0.01; }      // ミニゲーム報酬の倍率

        const minigames = {
            quiz:          { id: "quiz",          name: "ご当地クイズ",         icon: "🗾", unlockStage: 0 },
            timeattack:    { id: "timeattack",    name: "タップタイムアタック", icon: "⏱️", unlockStage: 0 },
            concentration: { id: "concentration", name: "ご当地神経衰弱",       icon: "🃏", unlockStage: 5 },
            mochitsuki:    { id: "mochitsuki",    name: "もちつきリズム",       icon: "🍡", unlockStage: 7 },
            slot:          { id: "slot",          name: "スロット",            icon: "🎰", unlockStage: 3, isCoinGame: true }
        };
        // 🎰 スロットの絵柄と配当（3つ揃った時の倍率）。同じ絵柄の並び順で、揃いにくいほど高配当にしてある
        // 🎰 絵柄一覧（価値が低い順）。weightが大きいほど出やすい（＝価値が高いほどレア）
        const SLOT_SYMBOLS = [
            { id: 'cherry',      icon: '🍒', img: 'ui_images/slot_symbol_cherry.webp',      label: 'チェリー',   payout: 2,   weight: 44 },
            { id: 'carrot',      icon: '🥕', img: 'ui_images/slot_symbol_carrot.webp',      label: '人参',      payout: 3,   weight: 36 },
            { id: 'bell',        icon: '🔔', img: 'ui_images/slot_symbol_bell.webp',        label: 'ベル',      payout: 4,   weight: 30 },
            { id: 'sweetpotato', icon: '🍠', img: 'ui_images/slot_symbol_sweetpotato.webp', label: 'さつまいも', payout: 5,   weight: 16 },
            { id: 'banana',      icon: '🍌', img: 'ui_images/slot_symbol_banana.webp',      label: 'バナナ',    payout: 6,   weight: 12 },
            { id: 'apple',       icon: '🍎', img: 'ui_images/slot_symbol_apple.webp',       label: 'リンゴ',    payout: 8,   weight: 9 },
            { id: 'bar1',        icon: '➖',  img: 'ui_images/slot_symbol_bar1.webp',        label: 'BAR',       payout: 10,  weight: 6 },
            { id: 'bar2',        icon: '➖➖', img: 'ui_images/slot_symbol_bar2.webp',        label: 'ダブルBAR',  payout: 15,  weight: 3.5 },
            { id: 'bar3',        icon: '➖➖➖', img: 'ui_images/slot_symbol_bar3.webp',       label: 'トリプルBAR', payout: 25,  weight: 1.8 },
            { id: 'seven',       icon: '7️⃣', img: 'ui_images/slot_symbol_seven.webp',       label: '7',         payout: 60,  weight: 0.5 },
            { id: 'marmot',      icon: '🐹', img: 'ui_images/slot_symbol_marmot.webp',      label: 'マーモット', payout: 150, weight: 0.15, isJackpot: true },
        ];
        // リプレイ：揃うとコインを消費せず、もう一度レバーを引ける（配当表には含めない特殊絵柄）
        const SLOT_REPLAY_SYMBOL = { id: 'replay', icon: '🍡', img: 'ui_images/slot_symbol_replay.webp', label: 'リプレイ', weight: 20 };
        const SLOT_ALL_SYMBOLS = [...SLOT_SYMBOLS, SLOT_REPLAY_SYMBOL]; // リールの帯を作る時に使う、全絵柄（リプレイ含む）
        const SLOT_COIN_COST = 1;        // コインを1回投入するのに必要なミニゲームコイン
        const SLOT_PLAYS_PER_COIN = 5;   // コイン1枚で、レバーを何回引けるか
        let slotPlaysRemaining = 0;      // 今、あと何回レバーを引けるか
        let minigameLastResetDate = null;
        let minigamePlaysUsedToday = { quiz: 0, timeattack: 0, concentration: 0, mochitsuki: 0, slot: 0 };
        let minigameSeenUnlocked = { quiz: false, timeattack: false, concentration: false, mochitsuki: false, slot: false }; // 「新しく解放された」ハイライトを、一度見たら消すためのフラグ
        let minigameBests = { timeattack: 0, concentration: null }; // concentration=最少手数(小さいほど良い)

        // ===================================================================
        // 🏅 県内ランキング＆トロフィーシステム
        // ===================================================================
        // prefTaps[i]: その県に滞在中(selectedStageIndex===i)にタップした累計回数。
        // 過去に訪れた県に戻ってタップしても加算され続ける（進行用のcurrentStageProgressとは別管理）。
        let isMinigameActive = false; // 立っている間はメインのタップ判定を無視する
        function getMinigameBaseReward() {
            const currentStage = stages[currentStageIndex] || stages[0];
            return Math.max(PRESENT_REWARD_MIN, Math.floor(currentStage.distance * PRESENT_REWARD_DISTANCE_RATE) + Math.floor(getMps() * PRESENT_REWARD_MPS_RATE));
        }

        function hasNewlyUnlockedMinigame() {
            return Object.values(minigames).some(g => currentStageIndex >= g.unlockStage && !minigameSeenUnlocked[g.id]);
        }
        // 未獲得(lv===0)で、解放済み(ステージ条件クリア)かつ購入できるスキルがあるか判定（レベルアップは対象外）
        function resetMinigameCountsIfNewDay() {
            const today = getLocalDateString(new Date());
            if (minigameLastResetDate !== today) {
                minigameLastResetDate = today;
                minigamePlaysUsedToday = { quiz: 0, timeattack: 0, concentration: 0, mochitsuki: 0, slot: 0 };
                saveGame();
            }
        }

        function openMinigameCenter() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3'); // 県移動の時と同じ、移動音
            overlay.classList.add('fade-black');
            setTimeout(() => {
                resetMinigameCountsIfNewDay();
                document.getElementById('minigame-play-view').style.display = 'none';
                document.getElementById('minigame-tile-view').style.display = 'flex';
                renderMinigameTiles();
                openModal('minigame-center-modal');
                playBgmLoop('audio/bgm_minigame.mp3'); // ゲームセンター専用BGMに切り替え
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }

        function closeMinigameCenter() {
            cleanupActiveMinigameTimers();
            isMinigameActive = false;
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('minigame-center-modal');
                playBgmLoop('audio/bgm.mp3'); // 通常のBGMに戻す
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }

        // タイムアタック/もちつきのタイマーやアニメーションを、離脱時に必ず止めるための後始末
        function cleanupActiveMinigameTimers() {
            if (typeof timeAttackState !== 'undefined' && timeAttackState && timeAttackState.timerId) {
                clearInterval(timeAttackState.timerId); timeAttackState = null;
            }
            if (typeof mochitsukiState !== 'undefined' && mochitsukiState && mochitsukiState.animId) {
                cancelAnimationFrame(mochitsukiState.animId); mochitsukiState = null;
            }
            slotIsSpinning = false; // 回転中に離脱しても、次に開いた時にボタンが押せなくなったままにならないようにする
            slotReelAnimations.forEach(a => { if (a) { try { a.cancel(); } catch (e) {} } });
            stopSlotSpinLoopSound();
        }

        function renderMinigameTiles() {
            const container = document.getElementById('minigame-tile-view');
            container.innerHTML = '<div id="minigame-button-grid" style="position:absolute; inset:0; display:grid; grid-template-columns:repeat(2, 1fr); gap:16px; align-content:center; justify-items:center; padding:24px; box-sizing:border-box;"></div>';
            const grid = document.getElementById('minigame-button-grid');
            Object.values(minigames).forEach(g => {
                const locked = currentStageIndex < g.unlockStage;
                const usedToday = minigamePlaysUsedToday[g.id] || 0;
                const remaining = getMinigameDailyLimit() - usedToday;
                const btn = document.createElement('button');
                btn.style.cssText = 'width:100%; aspect-ratio:1; border-radius:20px; border:none; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; box-shadow:0 3px 8px rgba(0,0,0,0.25);';
                if (locked) {
                    const reqName = stages[g.unlockStage] ? stages[g.unlockStage].name : "???";
                    btn.style.background = 'rgba(120,120,120,0.75)'; btn.style.color = '#fff';
                    btn.disabled = true;
                    btn.innerHTML = `<div style="font-size:1.8rem;">🔒</div><div style="font-size:0.7rem; font-weight:bold;">${g.name}</div><div style="font-size:0.55rem;">「${reqName}」到達で解放</div>`;
                } else if (g.isCoinGame) {
                    // 🎰 コインを賭けて遊ぶゲームは、1日の回数制限とは別枠（コインが続く限り何度でも遊べる）
                    btn.style.background = 'rgba(255,248,236,0.92)'; btn.style.color = '#5d4037';
                    if (!minigameSeenUnlocked[g.id]) btn.classList.add('minigame-recommend-glow');
                    btn.onclick = () => startMinigame(g.id);
                    btn.innerHTML = `<div style="font-size:1.8rem;">${g.icon}</div><div style="font-size:0.72rem; font-weight:bold;">${g.name}</div><div style="font-size:0.58rem; color:#7b1fa2;">🪙 ${IS_DEV_MODE ? '∞' : minigameCoins} 所持</div>`;
                } else if (remaining <= 0) {
                    btn.style.background = 'rgba(120,120,120,0.75)'; btn.style.color = '#fff';
                    btn.disabled = true;
                    btn.innerHTML = `<div style="font-size:1.8rem;">${g.icon}</div><div style="font-size:0.7rem; font-weight:bold;">${g.name}</div><div style="font-size:0.55rem;">本日は終了！</div>`;
                } else {
                    btn.style.background = 'rgba(255,248,236,0.92)'; btn.style.color = '#5d4037';
                    if (!minigameSeenUnlocked[g.id]) btn.classList.add('minigame-recommend-glow');
                    btn.onclick = () => startMinigame(g.id);
                    btn.innerHTML = `<div style="font-size:1.8rem;">${g.icon}</div><div style="font-size:0.72rem; font-weight:bold;">${g.name}</div><div style="font-size:0.58rem; color:#26a69a;">本日 ${usedToday}/${getMinigameDailyLimit()}回</div>`;
                }
                grid.appendChild(btn);
            });
        }

        function startMinigame(id) {
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

        function endMinigameToTiles() {
            cleanupActiveMinigameTimers();
            isMinigameActive = false;
            document.getElementById('minigame-play-view').style.display = 'none';
            document.getElementById('minigame-tile-view').style.display = 'flex';
            renderMinigameTiles();
        }

        function consumeMinigamePlay(id) {
            minigamePlaysUsedToday[id] = (minigamePlaysUsedToday[id] || 0) + 1;
            saveGame();
        }

        // 🎮 ミニゲームコイン：もちとは別に、ミニゲーム専用の景品交換に使う予定の通貨（ガチャコインと同じく価値が目減りしない）
        let minigameCoins = 0;
        function getMinigameCoinGain(multiplier) {
            return Math.max(1, Math.round(multiplier * 5 * getMinigameRewardMultiplier())); // 出来が良いほど多くもらえるが、最低1枚は必ずもらえる。転生ショップの「ミニゲーム報酬」強化もここに乗る
        }

        function grantMinigameReward(multiplier) {
            const coinGain = getMinigameCoinGain(multiplier);
            minigameCoins += coinGain;
            saveGame(); updateDisplay();
            return { coins: coinGain };
        }

        function showMinigameResult(title, detail, reward) {
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

        // -------------------------------------------------------------
        // 🗾 ① ご当地クイズ
        // -------------------------------------------------------------
        const QUIZ_REWARD_BY_CORRECT = { 3: 1.0, 2: 0.6, 1: 0.3, 0: 0.1 }; // 正解数ごとの倍率（調整用）

        function startQuizGame(container) {
            if (currentStageIndex + 1 < 2) {
                container.innerHTML = `<div style="text-align:center; padding:20px;">
                    <p style="margin-bottom:14px;">もう少し旅を進めてから挑戦してね！</p>
                    <button class="item-action-btn" onclick="endMinigameToTiles()">もどる</button>
                </div>`;
                return;
            }
            const quizState = { qIndex: 0, correct: 0, questions: [] };
            for (let i = 0; i < 3; i++) quizState.questions.push(generateQuizQuestion());
            window.__quizState = quizState;
            renderQuizQuestion(container, quizState);
        }

        function generateQuizQuestion() {
            const pool = [];
            for (let i = 0; i <= currentStageIndex; i++) pool.push(stages[i]);
            const correctStage = pickRandom(pool);
            const isNameToItem = Math.random() < 0.5; // true: 県名→名産品を当てる／false: 名産品→県名を当てる
            const others = pool.filter(s => s !== correctStage).sort(() => Math.random() - 0.5);
            const numDistractors = Math.min(2, others.length); // 解放済みが少ない時は2択にフォールバック
            let choices = [correctStage, ...others.slice(0, numDistractors)];
            choices = choices.sort(() => Math.random() - 0.5);
            return { correctStage, isNameToItem, choices };
        }

        function renderQuizQuestion(container, quizState) {
            const q = quizState.questions[quizState.qIndex];
            const questionText = q.isNameToItem ? `${q.correctStage.name}の名産品は？` : `「${q.correctStage.item}」はどこの県の名産品？`;
            const letters = ['A', 'B', 'C'];
            const choiceButtons = q.choices.map((c, idx) => {
                const label = q.isNameToItem ? c.item : c.name;
                const isCorrect = c === q.correctStage;
                return `<button class="item-action-btn quiz-choice-btn" id="quiz-choice-${idx}" onclick="answerQuizQuestion(${isCorrect}, ${idx})">
                    <span class="quiz-choice-letter">${letters[idx] || '?'}</span><span class="quiz-choice-label">${label}</span>
                </button>`;
            }).join('');
            const dots = quizState.questions.map((_, i) => {
                let cls = 'quiz-dot';
                if (i < quizState.qIndex) cls += quizState.history && quizState.history[i] ? ' quiz-dot-correct' : ' quiz-dot-wrong';
                else if (i === quizState.qIndex) cls += ' quiz-dot-current';
                return `<span class="${cls}"></span>`;
            }).join('');
            container.innerHTML = `
                <div style="text-align:center; padding:14px; background:radial-gradient(circle at 50% 10%, #e8f5ff, #fbfdff); border-radius:20px;">
                    <div style="display:flex; justify-content:center; gap:6px; margin-bottom:10px;">${dots}</div>
                    <div style="font-size:2.2rem; margin-bottom:6px;">🗾</div>
                    <div style="font-weight:900; font-size:1.1rem; margin-bottom:18px; color:#5d4037;">${questionText}</div>
                    <div id="quiz-choices-wrap">${choiceButtons}</div>
                </div>`;
        }

        function answerQuizQuestion(isCorrect, choiceIdx) {
            const quizState = window.__quizState;
            if (!quizState) return;
            document.querySelectorAll('.quiz-choice-btn').forEach(b => b.onclick = null); // 連打防止
            if (!quizState.history) quizState.history = [];
            quizState.history[quizState.qIndex] = isCorrect;

            const btn = document.getElementById(`quiz-choice-${choiceIdx}`);
            if (isCorrect) {
                quizState.correct++;
                playAudioFile('audio/critical.mp3');
                vibrate(20);
                if (btn) {
                    btn.classList.add('quiz-correct-glow');
                    const rect = btn.getBoundingClientRect();
                    spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 6, '#4caf50');
                }
            } else {
                playAudioFile('audio/tap.mp3');
                if (btn) btn.classList.add('quiz-wrong-shake');
                // 不正解の時は、正解の選択肢も光らせて教えてあげる
                const q = quizState.questions[quizState.qIndex];
                const correctIdx = q.choices.findIndex(c => c === q.correctStage);
                const correctBtn = document.getElementById(`quiz-choice-${correctIdx}`);
                if (correctBtn) correctBtn.classList.add('quiz-correct-glow');
            }

            setTimeout(() => {
                quizState.qIndex++;
                if (quizState.qIndex < quizState.questions.length) {
                    renderQuizQuestion(document.getElementById('minigame-play-view'), quizState);
                } else {
                    consumeMinigamePlay('quiz');
                    const mult = QUIZ_REWARD_BY_CORRECT[quizState.correct] ?? 0;
                    const reward = grantMinigameReward(mult);
                    if (quizState.correct === 3) screenFlash('#ffd700', 0.3);
                    showMinigameResult(`🗾 ご当地クイズ結果`, `${quizState.correct} / 3問 正解！`, reward);
                    window.__quizState = null;
                }
            }, 750); // フィードバックが見えるよう少し間を置いてから次の問題へ
        }

        // -------------------------------------------------------------
        // ⏱️ ② タップタイムアタック
        // -------------------------------------------------------------
        const TIME_ATTACK_DURATION_SEC = 15;
        const TIME_ATTACK_THRESHOLDS = [ // [必要タップ数, 倍率]（多い順に判定）
            [60, 1.3], [40, 1.0], [20, 0.6], [0, 0.3]
        ];
        let timeAttackState = null;

        function startTimeAttackGame(container) {
            container.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <div style="font-weight:bold; margin-bottom:10px;">⏱️ タップタイムアタック</div>
                    <div style="font-size:0.85rem; color:#5d4037; margin-bottom:16px;">スタートを押したら${TIME_ATTACK_DURATION_SEC}秒間、ひたすらタップ！</div>
                    <button class="item-action-btn btn-shop" style="background:#26a69a; color:#fff; width:100%;" onclick="beginTimeAttack()">スタート</button>
                </div>`;
        }

        function beginTimeAttack() {
            const container = document.getElementById('minigame-play-view');
            timeAttackState = { taps: 0, timeLeft: TIME_ATTACK_DURATION_SEC, timerId: null };
            container.innerHTML = `
                <div style="text-align:center; padding:14px; background:radial-gradient(circle at 50% 15%, #e3f6f3, #fbfffe); border-radius:20px;">
                    <div id="ta-timer-bar-outer" style="width:100%; height:14px; background:#e6e6e6; border-radius:10px; overflow:hidden; margin-bottom:10px; box-shadow:inset 0 2px 4px rgba(0,0,0,0.18);">
                        <div id="ta-timer-bar-inner" style="height:100%; width:100%; background:linear-gradient(90deg,#81c784,#4caf50); transition:width 0.9s linear, background 0.3s; box-shadow:0 0 8px rgba(76,175,80,0.6);"></div>
                    </div>
                    <div id="ta-timer" style="font-size:1.7rem; font-weight:900; color:#ff9800; margin-bottom:2px;">${TIME_ATTACK_DURATION_SEC}秒</div>
                    <div style="margin:6px 0 18px;">
                        <span id="ta-count" style="font-size:3rem; font-weight:900; color:#26a69a; display:inline-block; text-shadow:0 3px 0 rgba(0,0,0,0.06);">0</span>
                        <span style="font-size:1.1rem; font-weight:bold; color:#5d4037;"> 回</span>
                    </div>
                    <div id="ta-btn-wrap" style="position:relative; width:170px; height:170px; margin:0 auto;">
                        <button id="ta-tap-btn" style="position:relative; width:170px; height:170px; border-radius:50%;
                            background:radial-gradient(circle at 35% 28%, #5ddbcd, #26a69a 65%, #1c8579);
                            color:#fff; font-size:1.25rem; font-weight:900; border:5px solid #fff;
                            box-shadow:0 8px 18px rgba(0,0,0,0.3), inset 0 -6px 10px rgba(0,0,0,0.18); z-index:2;">タップ！</button>
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
                    timerEl.classList.toggle('ta-timer-urgent', timeAttackState.timeLeft <= 3 && timeAttackState.timeLeft > 0);
                }
                const barInner = document.getElementById('ta-timer-bar-inner');
                if (barInner) {
                    const pct = Math.max(0, (timeAttackState.timeLeft / TIME_ATTACK_DURATION_SEC) * 100);
                    barInner.style.width = pct + '%';
                    barInner.style.background = pct > 50 ? 'linear-gradient(90deg,#81c784,#4caf50)' : pct > 20 ? 'linear-gradient(90deg,#ffd54f,#ffc107)' : 'linear-gradient(90deg,#ef5350,#f44336)';
                }
                if (timeAttackState.timeLeft > 0 && timeAttackState.timeLeft <= 3) {
                    playAudioFile('audio/skill_tap.mp3', 0.35); // ラスト3秒のカウントダウン合図に流用
                    vibrate(15);
                }
                if (timeAttackState.timeLeft <= 0) {
                    clearInterval(timeAttackState.timerId);
                    btn.removeEventListener('pointerdown', onTimeAttackTap);
                    finishTimeAttack();
                }
            }, 1000);
        }

        function onTimeAttackTap(e) {
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
                ], { duration: 170, easing: 'ease-out' });
                const rect = btn.getBoundingClientRect();
                spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 3, '#26a69a');
            }
            if (wrap) {
                // ボタンから輪っかが広がって消えるリップル演出
                const ripple = document.createElement('div');
                ripple.className = 'ta-ripple';
                wrap.appendChild(ripple);
                setTimeout(() => ripple.remove(), 500);
            }

            // 叩けば叩くほど音がだんだん高くなっていく（連打の気持ちよさを強化）
            const rate = 1 + Math.min(0.6, timeAttackState.taps * 0.015);
            playAudioFilePitched('audio/tap.mp3', 0.5, rate);

            if (timeAttackState.taps % 20 === 0) { vibrate(20); screenFlash('#26a69a', 0.12); }
        }

        function finishTimeAttack() {
            consumeMinigamePlay('timeattack');
            const taps = timeAttackState ? timeAttackState.taps : 0;
            timeAttackState = null;
            const found = TIME_ATTACK_THRESHOLDS.find(([min]) => taps >= min);
            const mult = found ? found[1] : 0.3;
            const reward = grantMinigameReward(mult);
            const isNewBest = taps > (minigameBests.timeattack || 0);
            if (isNewBest) { minigameBests.timeattack = taps; playAudioFile('audio/levelup.mp3'); saveGame(); screenFlash('#ffd700', 0.35); }
            showMinigameResult(`⏱️ タイムアタック結果`, `${taps}回タップ！${isNewBest ? '🎉自己ベスト更新！' : `（自己ベスト: ${minigameBests.timeattack}回）`}`, reward);
        }

        // -------------------------------------------------------------
        // 🃏 ③ ご当地神経衰弱
        // -------------------------------------------------------------
        const CONCENTRATION_THRESHOLDS = [ // [手数の上限, 倍率]（少ない順に判定）
            [14, 1.4], [18, 1.0], [24, 0.6], [Infinity, 0.3]
        ];
        let concentrationState = null;

        function startConcentrationGame(container) {
            const candidates = [];
            for (let i = 0; i <= currentStageIndex; i++) { if (stages[i].itemImg) candidates.push(stages[i]); }
            if (candidates.length < 6) {
                container.innerHTML = `<div style="text-align:center; padding:20px;">
                    <div style="font-weight:bold; margin-bottom:10px;">🃏 ご当地神経衰弱</div>
                    <p style="font-size:0.85rem; color:#999; margin-bottom:14px;">イラスト準備中です（もう少しお待ちください）</p>
                    <button class="item-action-btn" onclick="endMinigameToTiles()">もどる</button>
                </div>`;
                return;
            }
            const chosen = candidates.sort(() => Math.random() - 0.5).slice(0, 6);
            let cards = [];
            chosen.forEach((stage, idx) => {
                cards.push({ pairId: idx, stage, matched: false });
                cards.push({ pairId: idx, stage, matched: false });
            });
            cards = cards.sort(() => Math.random() - 0.5);
            concentrationState = { cards, flippedIndices: [], moves: 0, matchedPairs: 0, locked: false };
            buildConcentrationBoard(); // DOMはここで1回だけ作る。以降はクラス切り替えのみでCSSアニメーションを効かせる
        }

        // カードのDOMを最初の1回だけ組み立てる（毎回作り直すとCSSのtransitionが再生されないため）
        function buildConcentrationBoard() {
            const container = document.getElementById('minigame-play-view');
            const st = concentrationState;
            const cardsHtml = st.cards.map((c, i) => `
                <div class="concentration-card-outer" onclick="flipConcentrationCard(${i})">
                    <div class="concentration-card-inner" id="concent-inner-${i}">
                        <div class="concentration-card-face concentration-card-back">🍡</div>
                        <div class="concentration-card-face concentration-card-front">
                            <img src="${c.stage.itemImg}" alt="${c.stage.item}">
                        </div>
                    </div>
                </div>
            `).join('');
            container.innerHTML = `
                <div style="padding:12px; background:radial-gradient(circle at 50% 10%, #fff3e0, #fffdf9); border-radius:20px;">
                    <div style="text-align:center; margin-bottom:10px; font-size:0.9rem; color:#5d4037; font-weight:bold;">🃏 めくった回数: <span id="concent-moves" style="color:#ff9800; font-size:1.1rem;">${st.moves}</span></div>
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:7px; margin-bottom:8px;">${cardsHtml}</div>
                </div>`;
        }

        // 個別カードの見た目だけを更新する（既存のDOM要素のクラスを切り替えるだけなので、3D回転アニメーションが正しく再生される）
        function updateConcentrationCardVisual(i) {
            const st = concentrationState;
            const inner = document.getElementById(`concent-inner-${i}`);
            if (!inner) return;
            const isFlipped = st.flippedIndices.includes(i) || st.cards[i].matched;
            inner.classList.toggle('flipped', isFlipped);
            inner.classList.toggle('matched', st.cards[i].matched);
        }

        function flipConcentrationCard(i) {
            const st = concentrationState;
            if (!st || st.locked) return;
            if (st.flippedIndices.includes(i) || st.cards[i].matched) return;
            if (st.flippedIndices.length >= 2) return;
            st.flippedIndices.push(i);
            playAudioFile('audio/tap.mp3');
            updateConcentrationCardVisual(i);

            if (st.flippedIndices.length === 2) {
                st.moves++;
                const movesEl = document.getElementById('concent-moves');
                if (movesEl) movesEl.innerText = st.moves;
                const [a, b] = st.flippedIndices;
                if (st.cards[a].pairId === st.cards[b].pairId) {
                    st.cards[a].matched = true; st.cards[b].matched = true;
                    st.matchedPairs++;
                    playAudioFile('audio/critical.mp3');
                    updateConcentrationCardVisual(a);
                    updateConcentrationCardVisual(b);
                    st.flippedIndices = [];
                    if (st.matchedPairs === 6) setTimeout(() => finishConcentration(), 500);
                } else {
                    st.locked = true;
                    // 不一致の合図に、2枚を軽くシェイクさせる
                    [a, b].forEach(idx => {
                        const inner = document.getElementById(`concent-inner-${idx}`);
                        if (inner) { inner.classList.remove('shake'); void inner.offsetWidth; inner.classList.add('shake'); }
                    });
                    setTimeout(() => {
                        if (!concentrationState) return;
                        const [oldA, oldB] = concentrationState.flippedIndices;
                        concentrationState.flippedIndices = [];
                        concentrationState.locked = false;
                        updateConcentrationCardVisual(oldA);
                        updateConcentrationCardVisual(oldB);
                    }, 800);
                }
            }
        }

        function finishConcentration() {
            consumeMinigamePlay('concentration');
            const moves = concentrationState.moves;
            const found = CONCENTRATION_THRESHOLDS.find(([max]) => moves <= max);
            const mult = found ? found[1] : 0.3;
            const reward = grantMinigameReward(mult);
            const isNewBest = minigameBests.concentration == null || moves < minigameBests.concentration;
            if (isNewBest) { minigameBests.concentration = moves; playAudioFile('audio/levelup.mp3'); saveGame(); }
            concentrationState = null;
            screenFlash('#4caf50', 0.25);
            vibrate([20, 30, 20, 30, 40]);
            const playView = document.getElementById('minigame-play-view');
            if (playView) {
                const rect = playView.getBoundingClientRect();
                spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 3, 14, '#ffd700');
            }
            showMinigameResult(`🃏 神経衰弱結果`, `${moves}回でクリア！${isNewBest ? '🎉自己ベスト更新！' : `（自己ベスト: ${minigameBests.concentration}回）`}`, reward);
        }

        // -------------------------------------------------------------
        // 🍡 ④ もちつきリズム
        // -------------------------------------------------------------
        const MOCHITSUKI_BEATS = 12;
        const MOCHITSUKI_INITIAL_PERIOD_MS = 950; // 最初の速さ（半周期）※以前の1100msより少し速いスタートに
        const MOCHITSUKI_MIN_PERIOD_MS = 340;       // どれだけ速くなっても、これ以上は速くならない下限（以前より速い上限速度）
        const MOCHITSUKI_SPEEDUP_RATE = 0.90;       // タップ毎に前回の何倍の速さになるか（小さいほど加速が急。以前より加速アップ）
        // 判定ランク定義（中央からの誤差%が小さい順、左右対称）。ここを調整するだけで難易度・演出のバランスを変えられます。
        // range: この誤差(%)以内ならこのランク／color: 判定文字＆パーティクル色／particles: 弾けるパーティクル数／weight: 得点への重み
        const MOCHITSUKI_RANKS = [
            { name: 'PERFECT', range: 3,  color: '#ffd700', particles: 10, weight: 1.6, gold: true  },
            { name: 'GREAT',   range: 7,  color: '#ff5722', particles: 7,  weight: 1.2, gold: false },
            { name: 'GOOD',    range: 12, color: '#4caf50', particles: 4,  weight: 0.8, gold: false },
            { name: 'OK',      range: 19, color: '#2196f3', particles: 2,  weight: 0.4, gold: false },
            { name: 'MISS',    range: Infinity, color: '#999', particles: 0, weight: 0.1, gold: false }
        ];
        const MOCHITSUKI_REWARD_CAP = 1.6;
        let mochitsukiState = null;

        // MOCHITSUKI_RANKSから帯を自動生成するので、判定ロジックと見た目のズレ（対称性の崩れ）が原理的に起きない
        function buildMochitsukiBandsHtml() {
            const finite = MOCHITSUKI_RANKS.filter(r => isFinite(r.range)).slice().sort((a, b) => b.range - a.range);
            return finite.map(r => {
                const width = r.range * 2;
                const left = 50 - r.range;
                const rgba = hexToRgba(r.color, 0.35);
                return `<div style="position:absolute; left:${left}%; width:${width}%; height:100%; background:${rgba};"></div>`;
            }).join('');
        }

        function hexToRgba(hex, alpha) {
            const h = hex.replace('#', '');
            const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        function startMochitsukiGame(container) {
            mochitsukiState = { beat: 0, counts: {}, startTime: null, animId: null, periodMs: MOCHITSUKI_INITIAL_PERIOD_MS, streak: 0, bestStreak: 0 };
            MOCHITSUKI_RANKS.forEach(r => mochitsukiState.counts[r.name] = 0);
            container.innerHTML = `
                <div style="text-align:center; padding:14px; background:radial-gradient(circle at 50% 15%, #fff3e0, #fffdf9); border-radius:20px;">
                    <div style="font-weight:bold; margin-bottom:8px;">🍡 もちつきリズム</div>
                    <div style="font-size:0.78rem; color:#5d4037; margin-bottom:6px;">インジケーターが中央に来た瞬間にタップ！タップ毎にどんどん速くなるで（${MOCHITSUKI_BEATS}拍）</div>
                    <div id="mochi-beat-count" style="font-size:0.8rem; color:#999; margin-bottom:4px;">1 / ${MOCHITSUKI_BEATS}拍</div>
                    <div id="mochi-streak-text" style="font-size:0.75rem; font-weight:bold; color:#ff9800; height:1.2em; margin-bottom:6px;"></div>
                    <div id="mochi-track" style="position:relative; width:100%; max-width:280px; height:48px; margin:0 auto 14px; background:linear-gradient(#fffaf0,#fdf3e0); border-radius:24px; overflow:hidden; border:3px solid #ffd699; box-shadow:inset 0 2px 6px rgba(0,0,0,0.08), 0 3px 8px rgba(0,0,0,0.08);">
                        ${buildMochitsukiBandsHtml()}
                        <div id="mochi-indicator" style="position:absolute; top:5px; width:38px; height:38px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #ff8a5c, #ff5722); box-shadow:0 3px 6px rgba(0,0,0,0.35), 0 0 10px rgba(255,87,34,0.5);"></div>
                    </div>
                    <div id="mochi-judge-text" style="font-size:1.5rem; font-weight:900; height:36px; margin-bottom:8px;"></div>
                    <button id="mochi-tap-btn" style="width:100%; padding:17px; border-radius:16px; border:none;
                        background:radial-gradient(circle at 30% 20%, #4dd0c4, #26a69a 65%, #1c8579);
                        color:#fff; font-weight:900; font-size:1.05rem; box-shadow:0 5px 12px rgba(0,0,0,0.25), inset 0 -4px 8px rgba(0,0,0,0.15); border:2px solid #fff;">タップ！</button>
                </div>`;
            mochitsukiState.startTime = performance.now();
            document.getElementById('mochi-tap-btn').addEventListener('pointerdown', onMochitsukiTap);
            animateMochitsukiIndicator();
        }

        function getMochitsukiIndicatorPercent(elapsedMs, periodMs) {
            const t = elapsedMs % (periodMs * 2);
            return t < periodMs ? (t / periodMs) * 100 : 100 - ((t - periodMs) / periodMs) * 100;
        }

        function animateMochitsukiIndicator() {
            if (!mochitsukiState) return;
            const el = document.getElementById('mochi-indicator');
            const track = el ? el.parentElement : null;
            if (el && track) {
                const elapsed = performance.now() - mochitsukiState.startTime;
                const percent = getMochitsukiIndicatorPercent(elapsed, mochitsukiState.periodMs);
                const trackWidth = track.clientWidth;
                el.style.left = Math.max(0, Math.min(trackWidth - 38, (percent / 100) * trackWidth - 19)) + 'px';
            }
            mochitsukiState.animId = requestAnimationFrame(animateMochitsukiIndicator);
        }

        function onMochitsukiTap(e) {
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
                if (Math.random() < 0.4) showMochiComment(pickRandom(["あちゃー！", "むむっ、ズレたで！", "おっと〜！"]));
            } else {
                mochitsukiState.streak++;
                mochitsukiState.bestStreak = Math.max(mochitsukiState.bestStreak, mochitsukiState.streak);
                if (rank.name === 'PERFECT') {
                    playAudioFile('audio/critical.mp3'); vibrate(25);
                    screenFlash('#ffd700', 0.28);
                    if (track) { track.classList.remove('mochi-track-glow'); void track.offsetWidth; track.classList.add('mochi-track-glow'); }
                } else if (rank.name === 'GREAT') {
                    playAudioFile('audio/critical.mp3', 0.4); vibrate(15);
                } else {
                    playAudioFile('audio/tap.mp3');
                }
                // 3連続以上決まったら節目としてもう一段派手にする
                if (mochitsukiState.streak > 0 && mochitsukiState.streak % 5 === 0) {
                    screenShake('small'); vibrate([20, 30, 20]);
                }
            }

            const streakEl = document.getElementById('mochi-streak-text');
            if (streakEl) streakEl.innerText = mochitsukiState.streak >= 3 ? `🔥 ${mochitsukiState.streak}連続！` : '';

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
                setTimeout(() => finishMochitsuki(), 400);
            } else {
                const beatEl = document.getElementById('mochi-beat-count');
                if (beatEl) beatEl.innerText = `${mochitsukiState.beat + 1} / ${MOCHITSUKI_BEATS}拍`;
            }
        }

        function finishMochitsuki() {
            consumeMinigamePlay('mochitsuki');
            const st = mochitsukiState;
            const weightedSum = MOCHITSUKI_RANKS.reduce((sum, r) => sum + st.counts[r.name] * r.weight, 0);
            const mult = Math.min(MOCHITSUKI_REWARD_CAP, weightedSum / MOCHITSUKI_BEATS);
            mochitsukiState = null;
            const reward = grantMinigameReward(mult);
            const summary = MOCHITSUKI_RANKS.map(r => `${r.name}:${st.counts[r.name]}`).join(' ') + (st.bestStreak >= 3 ? ` ／ 最大${st.bestStreak}連続！` : '');
            showMinigameResult(`🍡 もちつきリズム結果`, summary, reward);
        }

        // ===================================================================
        // ===================================================================
        // 🎰 スロット（コインを賭けて遊ぶ、1日の回数制限が無いゲーム）
        // レバーを引く→3つのリールが回る→3つのボタンで1つずつ自分で止める、という本格仕様
        // ===================================================================
        const SLOT_SYMBOL_HEIGHT = 44; // 1コマぶんの高さ(px)。窓に縦3コマ表示するので、窓の高さ(約130px)÷3に合わせてある
        const SLOT_STRIP_REPEATS = 8;  // 全絵柄を、この回数ぶん繰り返して1本の帯を作る（長く回っているように見せるため）
        let slotIsSpinning = false;      // レバーを引いてから、3つとも止まり終えるまでtrue
        let slotSpinLoopSource = null;   // 回転中ループ音の再生ノード（stopで確実に止められるよう保持）

        // 🔊 リールが回っている間、ループするSE。BGMとは別のチャンネルで鳴らすので、BGMを止めずに重ねられる
        function playSlotSpinLoopSound() {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            loadAudioBuffer('audio/slot_spin_loop.mp3').then((buffer) => {
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
        function stopSlotSpinLoopSound() {
            if (slotSpinLoopSource) { try { slotSpinLoopSource.stop(); } catch (e) {} slotSpinLoopSource = null; }
        }

        let slotStoppedCount = 0;
        let slotReelResults = [null, null, null];   // この回で、各リールが最終的にどの絵柄で止まるか（レバーを引いた瞬間に内部で先に決める）
        let slotReelAnimations = [null, null, null]; // 各リールの「回り続ける」アニメーションを、止める時にcancelできるよう保持
        let slotReelLandingRow = [null, null, null]; // 各リールが最終的に止まった時の、帯の中の行番号（揃った絵柄を光らせる時に使う）
        let slotStoppedReels = [];       // 今の回で、すでに止めたリールの番号（リーチ判定に使う）
        let slotBonusZoneSpinsLeft = 0;  // 特化ゾーン：残りこの回数ぶん、当たりやすい状態が続く
        let slotTotalPulls = 0;          // 総回転数（レバーを引いた回数、全期間）
        let slotPullsSinceJackpot = 0;   // 前回マーモットが出てから、何回転しているか
        let slotJackpotCount = 0;        // マーモットが出た回数
        let slotShortestJackpotPulls = null; // マーモットが出るまでの回転数、最短記録
        let slotLongestJackpotPulls = null;  // マーモットが出るまでの回転数、最長記録
        const SLOT_BONUS_ZONE_SPINS = 10; // マーモット後、特化ゾーンが続くレバー回数
        // 特化ゾーン中は、この重みで抽選する（BAR以上の高価値な絵柄が出やすくなる）
        const SLOT_BONUS_ZONE_SYMBOLS = SLOT_SYMBOLS.map(s => ({
            ...s, weight: (s.payout >= 10) ? s.weight * 6 : s.weight * 0.4,
        })).concat([{ ...SLOT_REPLAY_SYMBOL, weight: SLOT_REPLAY_SYMBOL.weight * 2 }]); // リプレイも少し出やすくして、ゾーンが長続きしやすくする
        let slotNextSpinFree = false; // リプレイが揃った直後は、次の1回はコイン消費なし

        // 🛠️ スロットの各パーツ位置・大きさを、実際のイラストに合わせて調整するための開発者用ツール
        let slotAdjustMode = false;
        let slotAdjustDragState = null;
        // 調整中だけ、普段は透明・非表示のパーツ（コイン投入口・払出口・投入コイン）を見える状態にする
        function setSlotPartAdjustVisibility(show) {
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
        function bringSlotTargetToFront(targetId) {
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
        function positionSlotHandles() {
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
        function toggleSlotAdjustMode() {
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
        // 対象を切り替えた時、前の対象の枠線を消して、新しい対象にだけ付け直す
        function onSlotAdjustTargetChange() {
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
        function setupSlotAdjustDrag() {
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
        function adjustSlotLeverRotation(delta) {
            const lever = document.getElementById('slot-lever');
            const cur = parseFloat(lever.dataset.rotation || '0');
            const next = cur + delta;
            lever.dataset.rotation = next;
            lever.style.transform = `rotate(${next}deg)`;
            updateSlotAdjustReadout();
        }
        // 高さを、そのパーツの実際の描画結果(getBoundingClientRect)から%で計算する。
        // style.heightが「auto」のままの場合でも、必ず具体的な数値を返す
        function getSlotPartHeightPct(el) {
            const stage = document.getElementById('slot-machine-stage');
            const stageRect = stage.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            if (elRect.height === 0 && getComputedStyle(el).display === 'none') {
                // 非表示中(display:none)は正しく測れないので、生のstyle.heightをそのまま返す（未設定ならauto）
                return el.style.height || 'auto';
            }
            return (elRect.height / stageRect.height * 100).toFixed(4) + '%';
        }
        function updateSlotAdjustReadout() {
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
        function copyAllSlotCoords() {
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

        function toggleSlotHelpOverlay() {
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

        // 残りプレイ回数に応じて、次に光らせるべきパーツを決める（残っていればレバー、無くなっていればコイン投入口）
        function inviteNextSlotStep() {
            if (slotPlaysRemaining > 0) {
                document.getElementById('slot-lever').classList.add('slot-invite-glow');
            } else {
                document.getElementById('slot-coin-slot-in').classList.add('slot-invite-glow-ring');
            }
        }
        function updateSlotPlaysRemainingDisplay() {
            const el = document.getElementById('slot-plays-remaining');
            if (el) el.innerText = slotPlaysRemaining > 0 ? `（あと${slotPlaysRemaining}回引けます）` : '';
        }
        function updateSlotBonusZoneDisplay() {
            const el = document.getElementById('slot-bonus-zone-text');
            const active = slotBonusZoneSpinsLeft > 0;
            if (el) el.innerText = active ? `✨ 特化ゾーン 残り${slotBonusZoneSpinsLeft}回 ✨` : '';
            [0, 1, 2].forEach(i => {
                const win = document.getElementById(`slot-reel-window-${i}`);
                if (win) win.classList.toggle('slot-bonus-zone-active', active);
            });
        }
        function updateSlotPullsSinceJackpotDisplay() {
            const el = document.getElementById('slot-pulls-since-jackpot');
            if (el) el.innerText = `前回のマーモットから ${slotPullsSinceJackpot}回転`;
        }

        function pickWeightedSlotSymbol() {
            const pool = slotBonusZoneSpinsLeft > 0 ? SLOT_BONUS_ZONE_SYMBOLS : SLOT_ALL_SYMBOLS;
            const total = pool.reduce((s, sym) => s + sym.weight, 0);
            let roll = Math.random() * total;
            for (const sym of pool) {
                if (roll < sym.weight) return sym;
                roll -= sym.weight;
            }
            return pool[0];
        }

        function buildSlotReelStripHtml() {
            let html = '';
            for (let rep = 0; rep < SLOT_STRIP_REPEATS; rep++) {
                SLOT_ALL_SYMBOLS.forEach(s => {
                    html += `<div style="height:${SLOT_SYMBOL_HEIGHT}px; display:flex; align-items:center; justify-content:center;"><img src="${s.img}" alt="${s.label}" style="max-width:80%; max-height:80%;"></div>`;
                });
            }
            return html;
        }

        // 🛠️ 調整対象のパーツ一覧（位置調整ツールがこのリストを見て動く）
        const SLOT_ADJUSTABLE_PARTS = [
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

        function startSlotGame(container) {
            slotIsSpinning = false; slotStoppedCount = 0; slotNextSpinFree = false; // slotPlaysRemainingは、離脱しても引き継がれるようリセットしない
            container.style.background = 'transparent'; // 機体イラストの後ろに白い箱が見えないよう、この画面だけ背景を消す
            container.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <div style="display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:6px 10px; margin-bottom:10px;">
                        <div style="font-weight:900; color:#7b1fa2; text-shadow:0 1px 3px rgba(255,255,255,0.8);"><img src="ui_images/slot_coin.webp" alt="コイン" style="width:18px; vertical-align:-3px;"> <span id="slot-coin-value">${IS_DEV_MODE ? '∞' : minigameCoins}</span> 所持<span id="slot-plays-remaining" style="font-size:0.7rem; color:#e91e63;"></span></div>
                        <div id="slot-bonus-zone-text" style="font-weight:900; color:#ffab00; font-size:0.8rem; text-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>
                        <button onclick="toggleSlotHelpOverlay()" style="width:24px; height:24px; border-radius:50%; border:none; background:#5d4037; color:#fff; font-weight:900; font-size:0.75rem;">？</button>
                    </div>
                    <div id="slot-pulls-since-jackpot" style="font-size:0.68rem; color:#8d6e63; text-shadow:0 1px 3px rgba(255,255,255,0.8); margin-bottom:6px;"></div>

                    <div id="slot-machine-stage" style="position:relative; width:100%; max-width:280px; height:280px; margin:0 auto;">
                        ${[0, 1, 2].map(i => `
                            <div id="slot-reel-window-${i}" style="position:absolute; box-sizing:border-box; top:${[42.285715, 42.285715, 41.928575][i]}%; left:${[7.499995, 37.857139, 68.571429][i]}%; width:${[24.142858, 23.785714, 23.428572][i]}%; height:${[47.8571, 47.8571, 48.5714][i]}%; overflow:hidden; background:#fff; z-index:1;">
                                <div id="slot-reel-strip-${i}" style="transform:translateY(0);">${buildSlotReelStripHtml()}</div>
                            </div>
                        `).join('')}

                        <img id="slot-lever" src="ui_images/slot_lever.webp" alt="レバー" onclick="pullSlotLever()"
                             style="position:absolute; top:52.142868%; left:101.642867%; width:13.14286%; height:27.8125%; transform-origin:50% 88%; z-index:5; cursor:pointer;" data-rotation="10">

                        <img id="slot-machine-body" src="ui_images/slot_machine_body.webp" alt="スロットマシン" style="position:absolute; top:5.714281%; left:-8.928571%; width:116.428577%; height:158.2031%; display:block; z-index:10; pointer-events:none;">

                        <img id="slot-lever-mount" src="ui_images/slot_lever_mount.webp" alt="レバー取り付け部品"
                             style="position:absolute; top:65.142855%; left:104.214279%; width:7.642855%; height:28.1585%; z-index:15; pointer-events:none;">

                        <img id="slot-stop-btn-0" src="ui_images/slot_button_1.webp" alt="① 止める" onclick="stopSlotReel(0)" style="position:absolute; top:93.428576%; left:13.071423%; width:16%; height:11.8750%; cursor:pointer; z-index:16;">
                        <img id="slot-stop-btn-1" src="ui_images/slot_button_2.webp" alt="② 止める" onclick="stopSlotReel(1)" style="position:absolute; top:93.428581%; left:41.642851%; width:16%; height:11.3672%; cursor:pointer; z-index:16;">
                        <img id="slot-stop-btn-2" src="ui_images/slot_button_3.webp" alt="③ 止める" onclick="stopSlotReel(2)" style="position:absolute; top:93.428582%; left:70.214287%; width:16%; height:11.5625%; cursor:pointer; z-index:16;">

                        <div id="slot-coin-slot-in" onclick="insertSlotCoin()" style="position:absolute; top:137.142856%; left:7.857135%; width:8.071431%; height:5.2596%; cursor:pointer; z-index:21;"></div>
                        <div id="slot-coin-slot-out" style="position:absolute; top:137.500007%; left:72.500008%; width:20%; height:15.4967%;"></div>
                        <img id="slot-coin-insert-img" src="ui_images/slot_coin_side.webp" alt="" style="display:none; position:absolute; top:138.214276%; left:7.142852%; width:9.642859%; height:auto; z-index:20; pointer-events:none;">

                        <div id="slot-pivot-marker" style="display:none; position:absolute; width:10px; height:10px; margin:-5px; border-radius:50%; background:#00e5ff; border:2px solid #fff; z-index:998; pointer-events:none;"></div>
                        <div id="slot-resize-handle-r" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#4caf50; border:2px solid #fff; z-index:999; cursor:ew-resize;"></div>
                        <div id="slot-resize-handle-b" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#4caf50; border:2px solid #fff; z-index:999; cursor:ns-resize;"></div>
                        <div id="slot-resize-handle-br" style="display:none; position:absolute; width:16px; height:16px; margin:-8px; border-radius:50%; background:#ff9800; border:2px solid #fff; z-index:999; cursor:nwse-resize;"></div>
                    </div>

                    <p id="slot-result-text" style="font-weight:900; font-size:1rem; margin:10px 0 6px; min-height:1.4em; text-shadow:0 1px 3px rgba(255,255,255,0.8);"></p>
                    <div id="slot-payout-popup" style="display:none; font-weight:900; font-size:1.8rem; color:#ffd700; text-shadow:0 2px 8px rgba(0,0,0,0.5), 0 0 12px #ff6ec7;"></div>

                    <div id="slot-help-overlay" style="display:none; position:fixed; inset:0; z-index:2000; background:rgba(255,248,236,0.98); padding:20px; overflow-y:auto; box-sizing:border-box; text-align:left;">
                        <button onclick="toggleSlotHelpOverlay()" style="position:absolute; top:8px; right:8px; width:26px; height:26px; border-radius:50%; border:none; background:#5d4037; color:#fff; font-weight:900;">×</button>
                        <h3 style="margin:0 0 10px; color:#5d4037; text-align:center;">🎰 スロットの遊び方</h3>
                        <p style="font-size:0.78rem; color:#5d4037; line-height:1.6;">① 光っているコインをタップして投入します（1枚で1回）<br>② 光っているレバーを引くとリールが回り始めます<br>③ 光っている3つのボタンで、リールを1つずつ好きなタイミングで止められます<br>④ 上段・中段・下段・斜め2本、5つのライン上に絵柄が3つ揃うと、コインが払い出されます<br>（複数ラインが同時に揃うと、その分コインも増えます）</p>
                        <div style="margin-top:14px;">
                            ${SLOT_SYMBOLS.slice().reverse().map(s => `
                                <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-bottom:6px;">
                                    <img src="${s.img}" alt="${s.label}" style="width:26px; height:26px; object-fit:contain;">
                                    <img src="${s.img}" alt="" style="width:26px; height:26px; object-fit:contain;">
                                    <img src="${s.img}" alt="" style="width:26px; height:26px; object-fit:contain;">
                                    <span style="font-size:0.9rem; color:#5d4037; margin:0 4px;">→</span>
                                    <img src="ui_images/slot_coin.webp" alt="コイン" style="width:20px; height:20px; object-fit:contain;">
                                    <span style="font-size:0.85rem; font-weight:900; color:#5d4037;">×${s.payout}枚</span>
                                </div>
                            `).join('')}
                            <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-top:4px;">
                                <img src="ui_images/slot_symbol_replay.webp" alt="リプレイ" style="width:26px; height:26px; object-fit:contain;">
                                <img src="ui_images/slot_symbol_replay.webp" alt="" style="width:26px; height:26px; object-fit:contain;">
                                <img src="ui_images/slot_symbol_replay.webp" alt="" style="width:26px; height:26px; object-fit:contain;">
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
        function playSlotCoinInsertAnim() {
            const stage = document.getElementById('slot-machine-stage');
            const slotIn = document.getElementById('slot-coin-slot-in');
            const coinImg = document.getElementById('slot-coin-insert-img');
            if (!stage || !slotIn || !coinImg) return;
            const stageRect = stage.getBoundingClientRect();
            const slotRect = slotIn.getBoundingClientRect();
            const targetTopPct = ((slotRect.top - stageRect.top) / stageRect.height) * 100;
            const targetLeftPct = ((slotRect.left - stageRect.left) / stageRect.width) * 100;

            coinImg.style.display = 'block';
            coinImg.style.top = (targetTopPct - 15) + '%';
            coinImg.style.left = targetLeftPct + '%';
            coinImg.style.opacity = '1';
            coinImg.getAnimations().forEach(a => a.cancel());
            coinImg.animate(
                [
                    { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                    { transform: 'translateY(28px) rotate(180deg)', opacity: 1, offset: 0.85 },
                    { transform: 'translateY(32px) rotate(200deg)', opacity: 0 },
                ],
                { duration: 380, easing: 'ease-in', fill: 'forwards' }
            );
            playAudioFile('audio/slot_coin_insert.mp3');
        }

        // 🪙① コインをタップして投入する（1枚=1プレイぶん）。投入し終わったら、次はレバーが光って誘導する
        function insertSlotCoin() {
            if (slotIsSpinning) return; // 回っている最中だけは投入できない
            const coinSlot = document.getElementById('slot-coin-slot-in');
            if (!IS_DEV_MODE && minigameCoins < SLOT_COIN_COST) {
                document.getElementById('slot-result-text').innerText = `コインが足りません（あと${SLOT_COIN_COST - minigameCoins}枚）`;
                return;
            }
            if (!IS_DEV_MODE) minigameCoins -= SLOT_COIN_COST;
            slotPlaysRemaining += SLOT_PLAYS_PER_COIN; // 残りがあっても、さらに継ぎ足せる（何度でも連続投入できる）
            saveGame(); updateDisplay();
            document.getElementById('slot-coin-value').innerText = IS_DEV_MODE ? '∞' : minigameCoins;
            updateSlotPlaysRemainingDisplay();

            coinSlot.classList.remove('slot-invite-glow-ring');
            playSlotCoinInsertAnim();
            setTimeout(() => {
                document.getElementById('slot-lever').classList.add('slot-invite-glow'); // 次はレバーの番、という合図
            }, 300);
        }

        function pullSlotLever() {
            if (slotIsSpinning) return;
            const lever = document.getElementById('slot-lever');
            if (!slotNextSpinFree && !lever.classList.contains('slot-invite-glow')) return; // コイン投入がまだの時は引けない
            slotIsSpinning = true;
            slotStoppedCount = 0;
            slotStoppedReels = [];
            slotTotalPulls++; slotPullsSinceJackpot++; // 総回転数・前回マーモットからの回転数は、リプレイぶんも含めて数える
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
            playAudioFile('audio/gacha_crank.mp3');
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

        function stopSlotReel(reelIndex) {
            const btn = document.getElementById(`slot-stop-btn-${reelIndex}`);
            if (!btn || btn.dataset.stoppable !== '1') return; // 回っていない・すでに止めた列は無視
            btn.dataset.stoppable = '0';
            btn.classList.remove('slot-invite-glow');
            // 押した瞬間、光がパッと弾けるような一瞬のフラッシュ演出
            btn.animate(
                [{ filter: 'brightness(1)' }, { filter: 'brightness(2.2) drop-shadow(0 0 14px #fff176)' }, { filter: 'brightness(1)' }],
                { duration: 300, easing: 'ease-out' }
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
            const landingRep = SLOT_STRIP_REPEATS - 2;
            const topSymbolIndex = (symbolIndex - 1 + n) % n;
            const targetRow = landingRep * n + topSymbolIndex;
            const targetY = -(targetRow * SLOT_SYMBOL_HEIGHT);
            slotReelLandingRow[reelIndex] = targetRow; // 揃った絵柄を光らせる時に、DOM要素を逆算するために覚えておく

            strip.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.4, 1)';
            strip.style.transform = `translateY(${targetY}px)`;

            playAudioFile('audio/tap.mp3');
            vibrate([10]);

            slotStoppedReels.push(reelIndex);
            slotStoppedCount++;
            if (slotStoppedCount === 2) {
                setTimeout(checkSlotReach, 250); // 着地演出が落ち着いてから判定する
            } else if (slotStoppedCount >= 3) {
                stopSlotSpinLoopSound();
                setTimeout(evaluateSlotResult, 300);
            }
        }

        // 🎰 リーチ判定：2つ止まった時点で、5ラインのどこかで2つとも同じ絵柄が揃っていれば「リーチ」
        function checkSlotReach() {
            if (slotStoppedReels.length !== 2) return;
            const cols = {};
            slotStoppedReels.forEach(i => { cols[i] = getSlotReelColumn(slotReelResults[i]); });

            let bestReachSymbol = null;
            SLOT_LINE_ROW_OFFSETS.forEach((offsets) => {
                const a = cols[slotStoppedReels[0]][offsets[slotStoppedReels[0]]];
                const b = cols[slotStoppedReels[1]][offsets[slotStoppedReels[1]]];
                if (a.id !== b.id) return;
                const value = a.id === 'replay' ? 1 : a.payout;
                if (!bestReachSymbol || value > (bestReachSymbol.id === 'replay' ? 1 : bestReachSymbol.payout)) bestReachSymbol = a;
            });
            if (bestReachSymbol) triggerSlotReachEffect(bestReachSymbol);
        }

        // 🎰 リーチ演出：効果音・絵柄の強調・大きな当たりの時だけカットイン
        function triggerSlotReachEffect(symbol) {
            playAudioFile('audio/slot_reach.mp3');
            vibrate([20, 30, 20]);
            document.getElementById('slot-result-text').style.color = '#ff3d00';
            document.getElementById('slot-result-text').innerText = 'リーチ！！';

            // 揃っている2つの絵柄を、3つ目が止まるまで強調して光らせる
            slotStoppedReels.forEach((reelIndex) => {
                const strip = document.getElementById(`slot-reel-strip-${reelIndex}`);
                const landingRow = slotReelLandingRow[reelIndex];
                SLOT_LINE_ROW_OFFSETS.forEach((offsets) => {
                    const el = strip.children[landingRow + offsets[reelIndex]];
                    if (el) el.classList.add('slot-reach-pulse');
                });
            });

            // BAR以上の高価値な絵柄が2つ揃っている時だけ、カットインで盛り上げる
            const isBigReach = symbol.id === 'replay' ? false : symbol.payout >= 10;
            if (isBigReach) showSlotCutin();
        }

        // 🎬 カットイン：もちすけの驚き顔が、横から勢いよく滑り込んでくる演出
        function showSlotCutin() {
            const stage = document.getElementById('slot-machine-stage');
            if (!stage) return;
            const cutin = document.createElement('img');
            cutin.src = 'ui_images/image_scream.webp';
            cutin.style.cssText = 'position:absolute; top:30%; left:50%; width:70%; transform:translate(-50%,-50%); z-index:500; pointer-events:none; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5)); animation: slotCutinSlide 900ms ease-in-out;';
            stage.appendChild(cutin);
            playAudioFile('audio/gacha_crank.mp3');
            setTimeout(() => cutin.remove(), 900);
        }

        // 🪙 払い出し口から、コインが実際に出てくる演出。countが多いほど「あふれ出す」感じになる
        function spawnSlotPayoutCoins(count, pitchRate = 1) {
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
                    coin.src = 'ui_images/slot_coin.webp';
                    const startLeft = baseLeftPct + Math.random() * slotWidthPct;
                    coin.style.cssText = `position:absolute; top:${baseTopPct}%; left:${startLeft}%; width:9%; z-index:20; pointer-events:none;`;
                    stage.appendChild(coin);
                    const dx = (Math.random() - 0.5) * 40; // 左右にランダムに散らばりながら落ちる
                    const rot = (Math.random() - 0.5) * 540;
                    coin.animate(
                        [
                            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0 },
                            { transform: `translate(${dx * 0.5}px, -18px) rotate(${rot * 0.3}deg)`, opacity: 1, offset: 0.3 },
                            { transform: `translate(${dx}px, 46px) rotate(${rot}deg)`, opacity: 0, offset: 1 },
                        ],
                        { duration: 650 + Math.random() * 200, easing: 'ease-in' }
                    ).finished.then(() => coin.remove());
                    // 当たりが大きいほど、ピッチを少し上げて景気良く聞こえるようにする
                    playAudioFilePitched('audio/tap.mp3', 0.6, pitchRate + (Math.random() - 0.5) * 0.1);
                }, i * 45);
            }
        }

        // 真ん中の絵柄から、帯の並び順にもとづいて上・下の絵柄を求める（実際に窓に見えている3段ぶん）
        function getSlotReelColumn(centerSymbol) {
            const n = SLOT_ALL_SYMBOLS.length;
            const idx = SLOT_ALL_SYMBOLS.findIndex(s => s.id === centerSymbol.id);
            return [SLOT_ALL_SYMBOLS[(idx - 1 + n) % n], centerSymbol, SLOT_ALL_SYMBOLS[(idx + 1) % n]]; // [上段, 中段, 下段]
        }

        // 揃ったラインの、実際に画面に見えている絵柄の要素を光らせる（rowOffsets=[各リールの段:0上/1中/2下]）
        function highlightSlotWinLine(rowOffsets) {
            rowOffsets.forEach((rowOffset, reelIndex) => {
                const strip = document.getElementById(`slot-reel-strip-${reelIndex}`);
                const landingRow = slotReelLandingRow[reelIndex];
                if (landingRow == null || !strip) return;
                const el = strip.children[landingRow + rowOffset];
                if (el) el.classList.add('slot-win-pulse');
            });
        }
        // 次にコインを投入する時（新しい回）に、前回光っていた絵柄をすべて消しておく
        function clearSlotWinPulse() {
            document.querySelectorAll('.slot-win-pulse').forEach(el => el.classList.remove('slot-win-pulse'));
        }

        const SLOT_LINE_ROW_OFFSETS = [
            [0, 0, 0], // 上段
            [1, 1, 1], // 中段
            [2, 2, 2], // 下段
            [0, 1, 2], // 斜め ↘
            [2, 1, 0], // 斜め ↗
        ];

        function evaluateSlotResult() {
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
                playAudioFile('audio/slot_replay.mp3');
                vibrate([15, 15, 15]);
                document.getElementById('slot-lever').classList.add('slot-invite-glow'); // コイン投入を飛ばして、直接レバーへ誘導
                return;
            }

            // 複数ライン揃った場合は、それぞれの配当を合計する
            const totalPayout = payoutLines.reduce((sum, l) => sum + SLOT_COIN_COST * l[0].payout, 0);
            minigameCoins += totalPayout;
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
            const coinCount = bestSymbol.payout >= 60 ? 18 : bestSymbol.payout >= 25 ? 10 : bestSymbol.payout >= 10 ? 6 : 3;
            const coinPitch = bestSymbol.payout >= 60 ? 1.35 : bestSymbol.payout >= 25 ? 1.2 : bestSymbol.payout >= 10 ? 1.1 : 1.0;
            spawnSlotPayoutCoins(coinCount + (payoutLines.length - 1) * 3, coinPitch); // 複数ライン揃った時は、その分コインも増える
            inviteNextSlotStep(); // 残りプレイがあればレバー、無ければコイン投入口を光らせる

            if (bestSymbol.isJackpot) {
                // 🐹 マーモット：最上位の大当たり演出。コインだけでは物足りないので、ガチャコインも一緒に付与する
                const bonusGachaCoins = 30;
                gachaCoins += bonusGachaCoins;
                slotJackpotCount++;
                slotShortestJackpotPulls = (slotShortestJackpotPulls == null) ? slotPullsSinceJackpot : Math.min(slotShortestJackpotPulls, slotPullsSinceJackpot);
                slotLongestJackpotPulls = (slotLongestJackpotPulls == null) ? slotPullsSinceJackpot : Math.max(slotLongestJackpotPulls, slotPullsSinceJackpot);
                slotPullsSinceJackpot = 0;
                updateSlotPullsSinceJackpotDisplay();
                saveGame();
                resultText.innerHTML = `<span style="font-size:1.3rem;">🎉✨ ${bestSymbol.icon}${bestSymbol.icon}${bestSymbol.icon} 大当たり！！ ✨🎉</span><br>マーモット揃い！${lineWord} +${totalPayout}枚！！<br>🎰 ガチャコイン+${bonusGachaCoins}枚もおまけ！`;
                playAudioFile('audio/japan_clear.mp3');
                screenFlash('#ff6ec7', 0.75);
                vibrate([40, 50, 40, 50, 40, 50, 80]);
                setTimeout(() => showSlotMarmotCelebration(totalPayout, bonusGachaCoins), 500);
            } else {
                resultText.innerText = `${bestSymbol.icon}${bestSymbol.icon}${bestSymbol.icon} 揃った！${lineWord} +${totalPayout}枚！`;
                playAudioFile(bestSymbol.payout >= 60 ? 'audio/slot_win_seven.mp3' : bestSymbol.payout >= 10 ? 'audio/slot_win_bar.mp3' : 'audio/slot_win_small.mp3');
                screenFlash('#ffd700', bestSymbol.payout >= 25 ? 0.55 : 0.3);
                vibrate(bestSymbol.payout >= 25 ? [30, 40, 30, 40, 50] : [20, 30, 20]);
            }
        }


        // 🐹 マーモット揃いの、専用の豪華演出（画面暗転→大きなマーモット→もちすけの専用セリフ）
        function showSlotMarmotCelebration(payout, bonusGachaCoins) {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; inset:0; z-index:3000; background:rgba(0,0,0,0); display:flex; flex-direction:column; align-items:center; justify-content:center; transition:background 0.4s;';
            overlay.innerHTML = `
                <img src="ui_images/slot_symbol_marmot.webp" alt="マーモット" style="width:0; transition:width 0.5s cubic-bezier(0.2,0.8,0.3,1.2); filter:drop-shadow(0 0 30px #ff6ec7);">
                <p style="color:#fff; font-weight:900; font-size:1.3rem; margin-top:16px; text-align:center; text-shadow:0 2px 8px rgba(0,0,0,0.6); opacity:0; transition:opacity 0.4s;">マーモットや！！<br>こんなん初めて見たで！！</p>
                <p style="color:#ffd700; font-weight:900; font-size:1.1rem; margin-top:10px; opacity:0; transition:opacity 0.4s;">+${payout}枚 獲得！</p>
                <p style="color:#e91e63; font-weight:900; font-size:1rem; margin-top:4px; opacity:0; transition:opacity 0.4s;">🎰 ガチャコイン +${bonusGachaCoins}枚もおまけ！</p>
                <p style="color:#ffab00; font-weight:900; font-size:1rem; margin-top:10px; opacity:0; transition:opacity 0.4s;">✨ この後${SLOT_BONUS_ZONE_SPINS}回、当たりやすい特化ゾーンに突入！ ✨</p>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => {
                overlay.style.background = 'rgba(20,10,20,0.88)';
                overlay.querySelector('img').style.width = '55%';
                overlay.querySelectorAll('p').forEach((p, i) => setTimeout(() => p.style.opacity = '1', 300 + i * 200));
            });
            overlay.addEventListener('click', () => {
                overlay.style.background = 'rgba(0,0,0,0)';
                overlay.querySelectorAll('*').forEach(el => el.style.opacity = '0');
                setTimeout(() => overlay.remove(), 400);
                slotBonusZoneSpinsLeft = SLOT_BONUS_ZONE_SPINS;
                saveGame();
                updateSlotBonusZoneDisplay();
            });
        }

