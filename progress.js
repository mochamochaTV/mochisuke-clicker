        let prestigeCount = 0;      // 転生した回数

        // 👗 着せ替え部屋：所持アイテムと、今装着中のアイテム（カテゴリごとに1つだけ）
        let ownedKisekaeItems = { hat: [], face: [], clothes: ['clothes_mochisuke_tshirt'] };
        let equippedKisekae = { hat: null, face: null, clothes: 'clothes_mochisuke_tshirt' };

        // 💼 おしごとミッション：進捗カウンター・選ばれているミッション・受け取り済みの管理
        let missionCounters = {
            totalTaps: 0, omiyageBoughtTotal: 0, minigamesPlayedTotal: 0,
            tapsToday: 0, minigamesToday: 0, omiyageBoughtToday: 0, gachaSpinsToday: 0,
            tapsThisWeek: 0, stampsThisWeek: 0, jackpotsThisWeek: 0, loginDaysThisWeek: 0,
        };
        let missionDailyDate = '';       // 最後にデイリーをリセットした日付(YYYY-MM-DD)
        let missionWeeklyWeekKey = '';   // 最後にウィークリーをリセットした週(YYYY-Www)
        let missionDailySelected = [];   // 今日選ばれているデイリーミッションのID
        let missionWeeklySelected = [];  // 今週選ばれているウィークリーミッションのID
        let missionClaimed = {};         // { [ミッションID]: true } 受け取り済み
        let tutorialMissionStep = 0;     // チュートリアルミッション、次に見せるステップ番号

        // 🛋️ マイルーム：所持アイテムと、今の配置状況
        let ownedMyroomItems = { wallpaper: ['wallpaper_default'], flooring: ['flooring_default'], wall_deco: [], big_furniture: [], table: [], small_deco: [] };
        let equippedMyroom = { wallpaper: 'wallpaper_default', flooring: 'flooring_default', wall_deco: null, big_furniture: null, table: null, small_deco: null };
        let previewKisekae = { hat: null, face: null, clothes: 'clothes_mochisuke_tshirt' }; // 「決定」を押すまでの試着中の状態
        let prestigeScoreHistory = []; // 各転生の直前に持っていたもち数の記録（将来使う可能性があるので記録だけしておく）
        let prestigePoints = 0;     // 転生ポイント（所持数、将来のショップで消費する予定）
        const PRESTIGE_BONUS_PER_COUNT = 0.02; // 転生1回につき、タップ力・自動増加が恒久的に+2%（控えめ・線形。世界編を見据えてここは急激に伸ばさない）
        function getPrestigeBonusMultiplier() {
            return 1 + prestigeCount * PRESTIGE_BONUS_PER_COUNT;
        }

        // 🎰 ガチャコイン：もちとは別枠の通貨。もちは際限なく増え続けて価値が変わってしまうため、
        // ガチャの対価としては、タップでは稼げない・増え方がゆるやかな別通貨を用意した
        let gachaCoins = 0;
        const GACHA_COIN_PER_STAMP = 2;      // 都道府県のスタンプを押すたびに
        const GACHA_COIN_JAPAN_CLEAR = 50;   // 日本制覇の達成時に
        const GACHA_COIN_PER_PRESTIGE = 30;  // 転生するたびに

        // 🛍️ 転生ポイントショップ（世界編を見据えて、パワーではなく利便性(QOL)中心。ただし今回、周回の土台になる部分もいくつか追加）
        let prestigeShopLv = {
            offlineCap: 0, minigamePlays: 0,
            omiyagePriceDiscount: 0, omiyagePriceCurve: 0,
            startingBonus: 0, skillCdReduction: 0, minigameReward: 0,
        };
        function getOfflineEarningsCapHours() { return OFFLINE_EARNINGS_CAP_HOURS_BASE + prestigeShopLv.offlineCap; }
        function getMinigameDailyLimit() { return MINIGAME_DAILY_LIMIT_BASE + prestigeShopLv.minigamePlays; }
        // 恒久強化の効果を返す関数群（買い物ショップ・スキルクールタイム・ミニゲーム報酬・初期ボーナス計算から呼ばれる）
        function getPrestigeStartingBonus() { return prestigeShopLv.startingBonus; }                     // タップ力・自動増加の初期加算値
        function getPrestigeCdReductionSec() { return prestigeShopLv.skillCdReduction; }                 // スキル基本クールタイムからの短縮秒数
        function buyPrestigeShopItem(key) {
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

        function renderPrestigeShop() {
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

        let hasSeenJapanClear = false; // 日本制覇演出を出したかどうか（何度も出ないようにする）
        const MINIGAME_DAILY_LIMIT_BASE = 3; // 1日あたりのプレイ回数上限（調整しやすいよう定数化）

        let prefTaps = new Array(47).fill(0);

        // 県ごとのボーダーライン（調整しやすいよう関数化。県のインデックスiに応じて段階的にスケール）
        function getPrefTrophyLines(i) {
            const bronzeLine = 50 + i * 15;
            const silverLine = bronzeLine * 2.5;
            const goldLine = bronzeLine * 6;
            return { bronzeLine, silverLine, goldLine };
        }

        // タップ数は増える一方なので、この関数は常に「今まで到達した最高のトロフィー」を返す（ダウングレードしない）
        function getPrefTrophy(i) {
            const taps = prefTaps[i] || 0;
            const { bronzeLine, silverLine, goldLine } = getPrefTrophyLines(i);
            if (taps >= goldLine) return 'gold';
            if (taps >= silverLine) return 'silver';
            if (taps >= bronzeLine) return 'bronze';
            return null;
        }

        function getPrefTrophyIcon(trophy) {
            if (trophy === 'gold') return '🥇';
            if (trophy === 'silver') return '🥈';
            if (trophy === 'bronze') return '🥉';
            return '　';
        }
        let currentStageIndex = 0;     
        let selectedStageIndex = 0;    
        let currentStageProgress = 0;   
        function checkOfflineEarnings() {
            if (!lastActiveTimestamp) return; // 初回プレイなど、前回の記録が無ければ何もしない
            const elapsedSeconds = (Date.now() - lastActiveTimestamp) / 1000;
            if (elapsedSeconds < OFFLINE_EARNINGS_MIN_SECONDS) return;
            const cappedSeconds = Math.min(elapsedSeconds, getOfflineEarningsCapHours() * 3600);
            const mps = getMps();
            const earnings = Math.floor(mps * cappedSeconds);
            if (earnings <= 0) return;

            score += earnings;
            saveGame(); updateDisplay();

            const totalMinutes = Math.floor(elapsedSeconds / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeText = hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
            const cappedNote = elapsedSeconds > getOfflineEarningsCapHours() * 3600
                ? `（オフライン収益は最大${getOfflineEarningsCapHours()}時間分までです）` : '';

            document.getElementById('offline-earnings-time').innerText = `${timeText}の間、もちすけがひとりで頑張ってくれてたで！`;
            document.getElementById('offline-earnings-amount').innerText = `+${formatMochi(earnings)} もち`;
            document.getElementById('offline-earnings-note').innerText = cappedNote;
            playAudioFile('audio/gold_mochi.mp3');
            openModal('offline-earnings-modal', true);
        }

        // 実機で今どうなっているかを数値で見るための簡易パネル。
        // 推測でCSSを直すのではなく、ここに出た実際の数字をスクショで送ってもらえれば原因を一発で特定できます。
        function triggerAreaTransition(newBgUrl, callback) {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                callback();
                setGameBackground(newBgUrl);
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }

        // 波紋・浮き文字はDOM要素を作らずcanvasにまとめて描画する（連打時のcreateElement/appendChild/remove連発による
        // レイアウト負荷とGCの揺れが高速タップ時のカクつきの主因だったため、パーティクルと同じ描画ループに統合）
        function showPrefTrophyDetail(i) {
            const stage = stages[i];
            const taps = prefTaps[i] || 0;
            const trophy = getPrefTrophy(i);
            const { bronzeLine, silverLine, goldLine } = getPrefTrophyLines(i);
            const trophyText = trophy ? `${getPrefTrophyIcon(trophy)} ${trophy.toUpperCase()}` : "未獲得";
            const goldBonusText = trophy === 'gold' ? "（おみやげ効果+10%発動中！）" : "";
            alert(`【${stage.name}】\n滞在中タップ数: ${taps.toLocaleString()}回\n現在のトロフィー: ${trophyText}${goldBonusText}\n\n🥉銅: ${bronzeLine}回\n🥈銀: ${Math.floor(silverLine)}回\n🥇金: ${Math.floor(goldLine)}回`);
        }

        const PRESTIGE_POINTS_PER_RUN = 5; // 転生1回あたりに獲得する転生ポイント（v1はシンプルに固定値。将来調整可）

        function openPrestigeShop() {
            renderPrestigeShop();
            openModal('prestige-shop-modal');
        }

        function canPrestige() {
            return hasSeenJapanClear; // 日本全国制覇済みなら転生可能
        }

        function openPrestigeConfirm() {
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

        function doPrestige() {
            prestigeScoreHistory.push({ prestigeNumber: prestigeCount + 1, score: Math.floor(score), timestamp: Date.now() });
            prestigeCount++;
            prestigePoints += PRESTIGE_POINTS_PER_RUN;
            gachaCoins += GACHA_COIN_PER_PRESTIGE; // ガチャコインは転生しても引き継がれる（他の進行データと違い、リセットしない）
            score = 0;
            currentStageIndex = 0;
            selectedStageIndex = 0;
            currentStageProgress = 0;
            purchasedItems = {};
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

        function triggerJapanClearCelebration() {
            if (hasSeenJapanClear) return;
            hasSeenJapanClear = true;
            gachaCoins += GACHA_COIN_JAPAN_CLEAR;
            saveGame();

            playAudioFile('audio/mochisuke/japan_clear.mp3'); // 専用の祝賀SE（無ければ用意してください。それまでは無音になります）
            vibrate([40, 60, 40, 60, 40, 60, 160]);

            // 紙吹雪演出：色を増やし、量も時間も伸ばして、より豪華に
            const rect = getGameScreenRect();
            for (let i = 0; i < 90; i++) {
                setTimeout(() => {
                    const x = rect.left + Math.random() * rect.width;
                    const y = rect.top + rect.height * 0.1;
                    createParticle(x, y, Math.random() < 0.6);
                }, i * 35);
            }

            const days = firstPlayTimestamp ? Math.max(1, Math.ceil((Date.now() - firstPlayTimestamp) / 86400000)) : 1;
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
            }, 300);

            setTimeout(() => {
                statsEl.style.opacity = '1';
                const startTime = performance.now();
                const duration = 1200;
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
            }, 900);

            setTimeout(() => {
                msgEl.innerText = '「鹿児島から沖縄まで、ずっと一緒に旅してくれて、ほんまありがとうな。47都道府県、全部お前と一緒に見て回れて、もちすけ幸せやったで。」';
                msgEl.style.opacity = '1';
            }, 2300);

            setTimeout(() => {
                btnEl.style.opacity = '1';
            }, 3000);
        }

        // 連打の勢いで誤って閉じないよう、必ず確認をはさむ
        function confirmCloseJapanClear() {
            document.getElementById('japan-clear-confirm').style.display = 'flex';
        }

        function closeJapanClearAndExplainPrestige() {
            document.getElementById('japan-clear-confirm').style.display = 'none';
            closeModal('japan-clear-modal');
            // 転生について、ここで初めて説明する（倉庫から選べることも伝える）
            setTimeout(() => {
                alert(
                    '🔄 転生について\n\n' +
                    '日本を制覇したことで、「転生」ができるようになりました。\n' +
                    '転生すると、今の進行状況はリセットされますが、代わりに「転生ポイント」がもらえて、次の周回を有利に進められます。\n\n' +
                    '転生は、倉庫の画面から選べます。焦らず、気が向いた時に挑戦してみてください。'
                );
            }, 350);
        }

        // 📷 達成画面を、そのまま画像として保存できるようにする
        function saveJapanClearImage() {
            const cw = 900, ch = 1600;
            const canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            const ctx = canvas.getContext('2d');

            const bg = new Image();
            bg.onload = () => {
                // 背景（cover相当で描画）
                const scale = Math.max(cw / bg.width, ch / bg.height);
                const dw = bg.width * scale, dh = bg.height * scale;
                ctx.drawImage(bg, (cw - dw) / 2, (ch - dh) / 2, dw, dh);

                // 下部グラデーション
                const grad = ctx.createLinearGradient(0, ch * 0.55, 0, ch);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(0.45, 'rgba(0,0,0,0.55)');
                grad.addColorStop(1, 'rgba(0,0,0,0.8)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, ch * 0.55, cw, ch * 0.45);

                // テキスト
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 52px sans-serif';
                ctx.fillText('🎉 日本全国制覇！ 🎉', cw / 2, ch - 420);
                ctx.fillStyle = '#ffd54f';
                ctx.font = 'bold 34px sans-serif';
                ctx.fillText('🏅「日本もち王」の称号を獲得！', cw / 2, ch - 360);

                const days = firstPlayTimestamp ? Math.max(1, Math.ceil((Date.now() - firstPlayTimestamp) / 86400000)) : 1;
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

        let collectedStamps = {}; // { 都道府県のインデックス: true }  -- スタンプ帳に押した記録

        let stageArrivalTime = Date.now(); // このエリアに着いた時刻（自動増加が高いと一瞬でゲージが埋まってしまう対策用）
        let stampGuardRecheckTimer = null;
        // 📊 スタンプ関連の状態を、実機で直接確認するための診断パネル
        let stampDebugMode = false;
        let stampDebugInterval = null;
        function checkStageProgress() {
            if (currentStageProgress >= stages[currentStageIndex].distance) {
                currentStageProgress = stages[currentStageIndex].distance; // スタンプを押すまでの間、表示が100%を超えて増え続けないようにする
                if (currentStageIndex < stages.length - 1) {
                    // 🔴 ゲージが溜まっても自動では進まず、スタンプを押すボタンを出して待つ
                    // （自動増加やタップで、閾値の低い序盤の県だと数秒で埋まってしまうことがあるため、最低限の滞在時間を設ける）
                    const elapsed = Date.now() - stageArrivalTime;
                    if (elapsed < 3000) {
                        clearTimeout(stampGuardRecheckTimer);
                        stampGuardRecheckTimer = setTimeout(checkStageProgress, 3000 - elapsed); // その後タップが無くても、確実にボタンが出るようにする保険
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
        let isPendingStampMoment = false; // ゲージが溜まって「スタンプを押す」を待っている状態かどうか

        // 🔴 進捗エリアのボタン：まだスタンプは押さず、絵日記の裏面を開いて「押してもらう」のを待つ
        function openDiaryForStamping() {
            if (currentStageProgress < stages[currentStageIndex].distance) return; // 念のため、本当にゲージが満タンか確認する
            const btn = document.getElementById('stamp-press-btn');
            if (btn) btn.style.display = 'none';
            isPendingStampMoment = true;
            openDiary();
            diaryPageIndex = currentStageIndex; // openDiary()内でselectedStageIndexに上書きされるため、必ずその後に設定する
            renderDiaryPage();
            flipDiaryPage(true);
        }

        // 🔴 絵日記裏面のスタンプ枠をタップした時：待機中かつ未到達の県でだけ、実際にスタンプを押す
        function tapStampFrame() {
            if (!isPendingStampMoment) return; // 通常の閲覧中は何も起きない
            if (diaryPageIndex !== currentStageIndex) return;
            if (collectedStamps[currentStageIndex]) return;
            if (currentStageProgress < stages[currentStageIndex].distance) { isPendingStampMoment = false; return; } // 念のため、本当にゲージが満タンか直接確認する

            const idx = currentStageIndex;
            collectedStamps[idx] = true;
            isPendingStampMoment = false;
            gachaCoins += GACHA_COIN_PER_STAMP;
            trackMissionEvent('stampsThisWeek', 1);
            saveGame();

            playAudioFile('audio/stamp.mp3'); // 専用のスタンプ音（無ければ用意してください。それまでは無音）
            vibrate([25, 20, 70]);
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

            for (let i = 0; i < 3; i++) {
                const ring = document.createElement('div');
                ring.style.cssText = 'position:absolute; inset:0; margin:auto; width:150px; height:150px; border-radius:50%; border:3px solid #c62828; pointer-events:none; opacity:0.7;';
                frame.appendChild(ring);
                requestAnimationFrame(() => {
                    ring.style.transition = `transform 0.5s ease-out ${i * 0.08}s, opacity 0.5s ease-out ${i * 0.08}s`;
                    ring.style.transform = 'scale(1.6)';
                    ring.style.opacity = '0';
                });
                setTimeout(() => ring.remove(), 700 + i * 80);
            }

            setTimeout(() => {
                closeModal('diary-modal');
                currentStageIndex++; const nextIdx = currentStageIndex; currentStageProgress = 0;
                triggerAreaTransition(stages[nextIdx].bg, () => {
                    selectedStageIndex = nextIdx; stageArrivalTime = Date.now(); updateDisplay(); saveGame();
                    clearTimeout(stampGuardRecheckTimer); // 前のエリアから予約されていた再チェックが、後から誤発火しないようにする
                    const stampBtn = document.getElementById('stamp-press-btn');
                    if (stampBtn) stampBtn.style.display = 'none'; // 新しいエリアに来た時点で、必ずいったん隠す
                    const name = stages[nextIdx].name;
                    const prefPool = dialogueData.prefectureComments[name];
                    showMochiComment(prefPool ? `${name}到着！${pickRandom(prefPool)}` : `${name}到着！ここはどんな場所やろな？`);
                });
            }, 900);
        }

        // ===================================================================
        // 💼 おしごとミッション：進捗の記録・日/週の切り替え・受け取り処理
        // ===================================================================
        function trackMissionEvent(key, amount) {
            if (missionCounters[key] === undefined) return;
            missionCounters[key] += (amount || 1);
        }
        function getWeekKey(d) {
            // ISO週番号ベースの「年-週」文字列を作る（週の変わり目判定に使う）
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = (date.getUTCDay() + 6) % 7;
            date.setUTCDate(date.getUTCDate() - dayNum + 3);
            const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
            const weekNum = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
            return `${date.getUTCFullYear()}-W${weekNum}`;
        }
        function pickRandomMissions(pool, count) {
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count).map(m => m.id);
        }
        // 日付・週が変わっていたら、カウンターとミッションの選び直しをする（ゲーム起動時に毎回呼ぶ）
        function checkAndRotateMissions() {
            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);
            if (missionDailyDate !== todayStr) {
                missionDailyDate = todayStr;
                missionCounters.tapsToday = 0;
                missionCounters.minigamesToday = 0;
                missionCounters.omiyageBoughtToday = 0;
                missionCounters.gachaSpinsToday = 0;
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
                missionCounters.loginDaysThisWeek = 1; // 週の変わり目＝今日ログインした1日目
                missionWeeklySelected = pickRandomMissions(WEEKLY_MISSION_POOL, WEEKLY_MISSION_COUNT);
            }
        }
        function getMissionDef(id) {
            return TUTORIAL_MISSIONS.find(m => m.id === id) || DAILY_MISSION_POOL.find(m => m.id === id) || WEEKLY_MISSION_POOL.find(m => m.id === id);
        }
        function getMissionProgress(mission) {
            return missionCounters[mission.trackKey] || 0;
        }
        function isMissionComplete(mission) {
            return getMissionProgress(mission) >= mission.target;
        }
        function claimMission(id) {
            const mission = getMissionDef(id);
            if (!mission || missionClaimed[id] || !isMissionComplete(mission)) return false;
            missionClaimed[id] = true;
            gachaCoins += mission.reward;
            if (id.startsWith('tut_') && tutorialMissionStep < TUTORIAL_MISSIONS.length) tutorialMissionStep++;
            saveGame();
            return true;
        }
