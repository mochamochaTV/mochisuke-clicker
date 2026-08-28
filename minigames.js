        function getMinigameRewardMultiplier() { return 1 + prestigeShopLv.minigameReward * 0.01; }      // ミニゲーム報酬の倍率

        const minigames = {
            quiz:          { id: "quiz",          name: "ご当地クイズ",         icon: "🗾", unlockStage: 0 },
            timeattack:    { id: "timeattack",    name: "タップタイムアタック", icon: "⏱️", unlockStage: 0 },
            concentration: { id: "concentration", name: "ご当地神経衰弱",       icon: "🃏", unlockStage: 5 },
            mochitsuki:    { id: "mochitsuki",    name: "もちつきリズム",       icon: "🍡", unlockStage: 7 },
            slot:          { id: "slot",          name: "スロット",            icon: "🎰", unlockStage: 3, isCoinGame: true }
        };
        // 🎰 スロットの絵柄と配当（3つ揃った時の倍率）。同じ絵柄の並び順で、揃いにくいほど高配当にしてある
        const SLOT_SYMBOLS = [
            { id: 'mochi',  icon: '🍡', payout: 2 },
            { id: 'ticket', icon: '🎫', payout: 3 },
            { id: 'coin',   icon: '🪙', payout: 5 },
            { id: 'clover', icon: '🍀', payout: 10 },
            { id: 'seven',  icon: '7️⃣', payout: 20 },
        ];
        const SLOT_SPIN_COST = 5; // 1回まわすのに必要なミニゲームコイン
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
            resetMinigameCountsIfNewDay();
            document.getElementById('minigame-play-view').style.display = 'none';
            document.getElementById('minigame-tile-view').style.display = 'flex';
            renderMinigameTiles();
            openModal('minigame-center-modal');
        }

        function closeMinigameCenter() {
            cleanupActiveMinigameTimers();
            isMinigameActive = false;
            closeModal('minigame-center-modal');
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
                    btn.innerHTML = `<div style="font-size:1.8rem;">${g.icon}</div><div style="font-size:0.72rem; font-weight:bold;">${g.name}</div><div style="font-size:0.58rem; color:#7b1fa2;">🪙 ${minigameCoins} 所持</div>`;
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
        // 🎰 スロット（コインを賭けて遊ぶ、1日の回数制限が無いゲーム）
        // ===================================================================
        const SLOT_SYMBOL_HEIGHT = 80; // 1コマぶんの高さ(px)。窓の高さ・帯の1コマ分と必ず一致させる
        const SLOT_STRIP_REPEATS = 8;  // 絵柄5種類を、この回数ぶん繰り返して1本の帯を作る（長く回っているように見せるため）
        let slotIsSpinning = false;

        function buildSlotReelStripHtml() {
            let html = '';
            for (let rep = 0; rep < SLOT_STRIP_REPEATS; rep++) {
                SLOT_SYMBOLS.forEach(s => {
                    html += `<div style="height:${SLOT_SYMBOL_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-size:2.2rem;">${s.icon}</div>`;
                });
            }
            return html;
        }

        function startSlotGame(container) {
            container.innerHTML = `
                <div style="text-align:center; padding:10px;">
                    <h3 style="margin:0 0 4px; color:#5d4037;">🎰 スロット</h3>
                    <p style="font-size:0.7rem; color:#8d6e63; margin:0 0 12px;">3つ絵柄が揃うと、賭けたコインが増えて返ってくる！</p>

                    <div style="display:flex; justify-content:center; gap:8px; margin-bottom:14px;">
                        ${[0, 1, 2].map(i => `
                            <div style="width:72px; height:${SLOT_SYMBOL_HEIGHT}px; overflow:hidden; border:3px solid #5d4037; border-radius:10px; background:#fff8ec; box-shadow:inset 0 3px 8px rgba(0,0,0,0.2);">
                                <div id="slot-reel-strip-${i}" style="transform:translateY(0);">${buildSlotReelStripHtml()}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-bottom:10px; font-weight:900; color:#7b1fa2;">🪙 <span id="slot-coin-value">${minigameCoins}</span> 所持</div>
                    <button id="slot-spin-btn" class="item-action-btn btn-shop" style="width:80%; background:#26a69a; color:#fff;" onclick="spinSlot()">🎰 まわす（${SLOT_SPIN_COST}枚）</button>
                    <p id="slot-result-text" style="font-weight:900; font-size:1rem; margin-top:12px; min-height:1.4em;"></p>

                    <div style="margin-top:10px; font-size:0.62rem; color:#aaa;">
                        ${SLOT_SYMBOLS.map(s => `${s.icon}×3 → ${s.payout}倍`).join('　')}
                    </div>

                    <button class="item-action-btn btn-red" style="width:100%; margin-top:14px;" onclick="endMinigameToTiles()">やめる</button>
                </div>
            `;
        }

        function spinSlot() {
            if (slotIsSpinning) return;
            if (minigameCoins < SLOT_SPIN_COST) {
                document.getElementById('slot-result-text').innerText = `コインが足りません（あと${SLOT_SPIN_COST - minigameCoins}枚）`;
                return;
            }
            slotIsSpinning = true;
            minigameCoins -= SLOT_SPIN_COST;
            saveGame(); updateDisplay();
            document.getElementById('slot-coin-value').innerText = minigameCoins;
            document.getElementById('slot-spin-btn').disabled = true;
            document.getElementById('slot-result-text').innerText = '';

            // この回で、それぞれのリールが最終的にどの絵柄で止まるかを先に決めておく
            const resultIndexes = [0, 1, 2].map(() => Math.floor(Math.random() * SLOT_SYMBOLS.length));
            const durations = [1600, 2100, 2600]; // 1列目→2列目→3列目の順に、だんだん長く回してから止める

            playAudioFile('audio/gacha_crank.mp3');
            vibrate([15]);

            resultIndexes.forEach((symbolIndex, reelIndex) => {
                const strip = document.getElementById(`slot-reel-strip-${reelIndex}`);
                // 帯の後ろの方（最後から2周目）に着地させることで、長く回っているように見せつつ、帯の端が見えないようにする
                const landingRep = SLOT_STRIP_REPEATS - 2;
                const targetRow = landingRep * SLOT_SYMBOLS.length + symbolIndex;
                const targetY = -(targetRow * SLOT_SYMBOL_HEIGHT);

                strip.style.transition = 'none';
                strip.style.transform = 'translateY(0)';
                void strip.offsetWidth; // 強制リフローで、リセットを確実に反映させてからアニメーションを開始する

                strip.style.transition = `transform ${durations[reelIndex]}ms cubic-bezier(0.12, 0.85, 0.32, 1)`;
                strip.style.transform = `translateY(${targetY}px)`;

                setTimeout(() => {
                    playAudioFile('audio/tap.mp3');
                    vibrate([10]);
                }, durations[reelIndex]);
            });

            setTimeout(() => finishSlotSpin(resultIndexes), Math.max(...durations) + 100);
        }

        function finishSlotSpin(resultIndexes) {
            slotIsSpinning = false;
            const resultText = document.getElementById('slot-result-text');
            if (!resultText) return; // 回転中に画面を離れていたら、何もしない
            document.getElementById('slot-spin-btn').disabled = false;

            const isWin = resultIndexes[0] === resultIndexes[1] && resultIndexes[1] === resultIndexes[2];

            if (isWin) {
                const symbol = SLOT_SYMBOLS[resultIndexes[0]];
                const payout = SLOT_SPIN_COST * symbol.payout;
                minigameCoins += payout;
                saveGame(); updateDisplay();
                document.getElementById('slot-coin-value').innerText = minigameCoins;
                resultText.style.color = '#e91e63';
                resultText.innerText = `${symbol.icon}${symbol.icon}${symbol.icon} 揃った！ +${payout}枚！`;
                playAudioFile('audio/levelup.mp3');
                screenFlash('#ffd700', symbol.payout >= 20 ? 0.6 : 0.3);
                vibrate(symbol.payout >= 20 ? [30, 40, 30, 40, 50] : [20, 30, 20]);
            } else {
                resultText.style.color = '#8d6e63';
                resultText.innerText = 'また挑戦してね！';
            }
        }
