        let skills = {
            skill1: { id: "skill1", name: "もちもちクリック", lv: 0, cd: 30, currentCd: 0, duration: 10, activeTimer: 0, unlockStage: 0, unlockPrice: 300, lvPriceMult: 1.9, desc: "発動中はタップでパーティクルが3倍出る" },
            skill2: { id: "skill2", name: "会心のもち肌", lv: 0, cd: 40, currentCd: 0, duration: 10, activeTimer: 0, unlockStage: 1, unlockPrice: 1200, lvPriceMult: 1.9, desc: "発動中は一定確率でタップが会心(×2)になる" },
            skill3: { id: "skill3", name: "もちすけ分身の術", lv: 0, cd: 50, currentCd: 0, duration: 12, activeTimer: 0, unlockStage: 4, unlockPrice: 6000, lvPriceMult: 2.0, desc: "発動中は分身が出現し打撃力が3倍になる" },
            skill4: { id: "skill4", name: "黄金のもち福", lv: 0, cd: 60, currentCd: 0, duration: 10, activeTimer: 0, unlockStage: 8, unlockPrice: 20000, lvPriceMult: 2.0, desc: "発動中は一定確率でタップが黄金(×2)になる" },
            hissatsu: { id: "hissatsu", name: "もちもちビッグバン", lv: 0, cd: 90, currentCd: 0, duration: 15, activeTimer: 0, unlockStage: 15, unlockPrice: 100000, lvPriceMult: 2.1, desc: "発動中はタップが5連打扱いになる大技（クールタイムはタップ数で回復）" }
        };

        // 基本セーブ用変数
        const FEED_BUFF_DURATION_MS = 10000; // 効果の持続時間（🍴ボタン追加で与えやすくなった分、20秒→10秒に短縮）
        let feedBuffActiveUntil = 0; // このタイムスタンプまで、タップ力が2倍になる
        const FEED_DAILY_LIMIT = 5; // 1日にあげられる回数の上限
        let feedLastResetDate = '';
        let feedPlaysUsedToday = 0;
        let isFever = false; let feverTimeLeft = 0; let feverInterval = null;
        let comboCount = 0; let comboTimer = null; let comboEndCommentId = 0; let lastComboReflowTime = 0;
        let mochiLongPressTimer = null;
        const MOCHI_LONGPRESS_MS = 600; // これ以上押しっぱなしにすると「つぶれる〜」的なセリフが出る
        let lastTappedTime = Date.now();

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
        let breatheTimer = null; let isMochiPressed = false;
        // 🫧 スクイーズ機能：引っ張った方向にもちすけが伸び縮みする（回転はしない）
        let squeezeStartX = 0, squeezeStartY = 0, isDraggingSqueeze = false, isSqueezeSettling = false;
        let squeezeLastDx = 0, squeezeLastDy = 0;
        const SQUEEZE_MAX_DRAG = 70; // これ以上引っ張っても伸びが頭打ちになる距離(px)
        const SQUEEZE_MAX_STRETCH = 0.38; // 最大でどれだけ伸びるか（+38%）
        const SQUEEZE_MAX_SQUASH = 0.22; // 伸びる方向と垂直に、最大どれだけ縮むか（-22%）
        const SQUEEZE_MIN_DRAG = 9; // これ未満の移動は「タップ」として扱い、通常のもちっとアニメーションにする
        const SQUEEZE_ELEMENT_RADIUS = 95; // もちすけの見た目上の半径の目安(px)。伸びを引っ張った側だけに見せるためのオフセット計算に使う
        let stretchSoundSource = null, stretchSoundGain = null;
        

        // 🔊 効果音再生システム（Web Audio API方式）
        // これまでは<audio>要素を1音につき6個ずつ使い回すプール方式でしたが、iOSは
        // 「実際にユーザー操作の中で.play()を呼んだ"その要素"」しか解錠しない仕様があり、
        // ローテーションで残りの要素が回ってきた時に無音になったり、解錠のために48個ものAudio要素を
        // 一斉にplay/pauseすることで起動直後に処理が重くなったりしていました。
        // Web Audio APIなら、AudioContextを1個resume()するだけで以後すべての音が解錠されるため、
        // 個別のAudio要素を大量に操作する必要が無くなり、軽量かつ確実になります。
        // また音声データは事前にデコードしてメモリ上に持つので、Service Workerのキャッシュ
        // （Rangeリクエストの不整合が起きやすい）を一切経由しません。
        let gameScreenRect = null;
        let bunshinCloneRects = [];
        let bunshinCloneEls = [];
        function refreshBunshinCloneRects() {
            bunshinCloneEls = Array.from(document.querySelectorAll('.bunshin-clone-img'));
            bunshinCloneRects = bunshinCloneEls.map(c => c.getBoundingClientRect());
        }
        function getTapPower() {
            let power = 1 + getPrestigeStartingBonus(); 
            stages.forEach((stage, idx) => {
                const lv = purchasedItems[idx] || 0;
                if (lv > 0) {
                    let bonus = stage.tapBonus * lv;
                    if (getPrefTrophy(idx) === 'gold') bonus *= 1.1; // 🥇金トロフィー：その県の効果+10%
                    power += bonus;
                }
            });
            const activeClothe = clothesData.find(c => c.id === equippedClotheId);
            if (activeClothe) power += activeClothe.tapBonus;
            // コンボのボーナスはここではなく、executeSingleTap側の加算方式(bonusPercent)で一括管理する
            if (isFever) power *= 5;
            power *= getPrestigeBonusMultiplier(); // 転生ボーナス（控えめ・線形）
            if (Date.now() < feedBuffActiveUntil) power *= 2; // もちすけにお土産をあげた効果（一時的）

            // 【重要】スキル1(もちもちクリック)・スキル3(分身)によるタップ力ブーストは、
            // ここではなくexecuteSingleTap()側の加算方式(bonusPercent)でのみ適用する。
            // 以前はここでも掛け算していたため、実際のタップ時に二重にブーストがかかってしまっていた。
            return Math.floor(power);
        }

        function getMps() {
            let mps = getPrestigeStartingBonus(); 
            stages.forEach((stage, idx) => {
                const lv = purchasedItems[idx] || 0;
                if (lv > 0) {
                    let bonus = stage.mpsBonus * lv;
                    if (getPrefTrophy(idx) === 'gold') bonus *= 1.1; // 🥇金トロフィー：その県の効果+10%
                    mps += bonus;
                }
            });
            const activeClothe = clothesData.find(c => c.id === equippedClotheId);
            if (activeClothe) mps += activeClothe.mpsBonus;
            mps *= 1.5; // 🔧 自動増加の恩恵を全体的に強化（プレイヤーからの要望を受けて底上げ）
            mps *= getPrestigeBonusMultiplier(); // 転生ボーナス（控えめ・線形）
            if (Date.now() < feedBuffActiveUntil) mps *= 2; // もちすけにお土産をあげた効果（一時的）
            return mps;
        }

        function getComboBonusPercent() {
            return Math.floor(comboCount / 10) * 2;
        }

        // 🎉 応援セリフ（コンボ中、タップしても消えない専用のセリフ。段階ごとに複数用意し、確率でランダムに選ぶ）
        function getCheerTier(count) {
            if (count >= 1000) return 1000;
            if (count >= 500) return 500;
            if (count >= 100) return 100;
            if (count >= 50) return 50;
            return 0;
        }
        let lastCheerTier = -1;
        let lastCheerChangeTime = 0;
        const CHEER_MIN_DISPLAY_MS = 1800; // これより短い間隔では、セリフを切り替えない（読めないほど頻繁に変わるのを防ぐ）
        function updateCheerBalloon(count) {
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
                balloonAutoHideTimer = setTimeout(() => { balloon.classList.remove('balloon-show'); }, 4000);
            }
        }

        // 節目ちょうどの瞬間だけ、スロットリングを無視して即座に専用セリフへ切り替える
        function forceCheerLine(text, tierMarker) {
            lastCheerTier = tierMarker;
            lastCheerChangeTime = Date.now();
            const balloon = document.getElementById('mochi-balloon');
            clearTimeout(balloonAutoHideTimer);
            balloon.innerText = text;
            balloon.classList.add('balloon-show');
            balloonAutoHideTimer = setTimeout(() => { balloon.classList.remove('balloon-show'); }, 4000);
        }

        let hasComboTitle1000 = false; // 1000コンボ到達の称号を、初回だけお祝いするためのフラグ
        function handleCombo(times = 1) {
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
            if (nowCombo - lastComboReflowTime > 150) {
                lastComboReflowTime = nowCombo;
                comboEl.classList.remove('combo-bounce', 'combo-tier-50', 'combo-tier-100', 'combo-tier-500', 'combo-tier-1000');
                void comboEl.offsetWidth;
                comboEl.classList.add('combo-bounce');
            } else {
                comboEl.classList.add('combo-bounce'); // 既に表示中なら、reflow無しでそのまま維持
            }
            if (comboCount >= 1000) comboEl.classList.add('combo-tier-1000');
            else if (comboCount >= 500) comboEl.classList.add('combo-tier-500');
            else if (comboCount >= 100) comboEl.classList.add('combo-tier-100');
            else if (comboCount >= 50) comboEl.classList.add('combo-tier-50');

            // 節目のコンボ数で、画面にも一段大きなご褒美演出を出す（大きな節目ほど豪華に）
            const namedMilestones = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
            const bigMilestone = namedMilestones.find(m => prevCount < m && comboCount >= m);
            if (comboCount === 10 || comboCount === 25 || bigMilestone || (comboCount > 1000 && comboCount % 50 === 0)) {
                comboEl.classList.remove('combo-milestone-pop');
                void comboEl.offsetWidth;
                comboEl.classList.add('combo-milestone-pop');

                if (bigMilestone === 1000) {
                    screenShake('big'); screenFlash('#ffd700', 0.45);
                    for (let i = 0; i < 30; i++) createParticle(window.innerWidth / 2 + (Math.random() - 0.5) * 200, window.innerHeight / 2 + (Math.random() - 0.5) * 300, true);
                    if (!hasComboTitle1000) {
                        hasComboTitle1000 = true;
                        saveGame();
                        setTimeout(() => alert('🏆 称号「もちマスター」を獲得しました！\n1000コンボ、本当にお疲れさまでした！'), 300);
                    }
                } else if (bigMilestone >= 500) {
                    screenShake('big'); screenFlash('#e0e0e0', 0.35);
                } else if (bigMilestone >= 100) {
                    screenShake('small'); screenFlash('#ff5252', 0.28);
                } else if (bigMilestone === 50) {
                    screenShake('small'); screenFlash('#fff176', 0.25);
                } else {
                    screenShake('small'); screenFlash('#ffab00', 0.2);
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
                if (finishedCombo >= 5 && !isTutorialActive) {
                    showMochiComment(pickRandom(comboEndLines));
                    // 通常のセリフと同様、しばらく経ってもタップされなければ自然に引っ込める
                    const myEndCommentId = ++comboEndCommentId;
                    setTimeout(() => {
                        if (myEndCommentId === comboEndCommentId) hideMochiComment();
                    }, 4000);
                }
            }, 1200);
        }

        // 単一タップの計算と個別エフェクト処理の分離
        // 🗣️ 叫び演出（覚醒・お腹すいた、共通）：どちらから呼ばれても、タイマーを1本化して競合を防ぐ
        let screamRevertTimeout = null;
        function startScreamFace() {
            isScreamActive = true;
            mochiBreatheWrapEl.classList.remove('breathe-idle');
            mochiDeformWrap.classList.remove('mochi-scream');
            void mochiDeformWrap.offsetWidth;
            mochiDeformWrap.classList.add('mochi-scream'); // 拡大・シェイクは、帽子・顔パーツも道連れの入れ物にかける
            mochiBtnElement.src = 'ui_images/image_scream.webp';
            flyOffKisekaeOverlays(); // 🎩💨 叫びの勢いで、帽子・顔パーツが吹っ飛ぶ
            updateMouthPatchVisibility();

            clearTimeout(screamRevertTimeout);
            screamRevertTimeout = setTimeout(revertScreamFace, 2600); // 連打中でも「叫んでいる」とちゃんと分かるよう、数秒間キープする
        }
        // タイマー経過でも、給餌などによる途中中断でも、必ずこの1箇所を通して確実に元へ戻す
        function revertScreamFace() {
            clearTimeout(screamRevertTimeout);
            isScreamActive = false;
            mochiBtnElement.src = getMochisukeBaseImg();
            mochiDeformWrap.classList.remove('mochi-scream');
            flyBackKisekaeOverlays(); // 🎩 通常に戻ったら、飛んでいった帽子・顔パーツをまた着け直す
            if (!isMochiPressed) mochiBreatheWrapEl.classList.add('breathe-idle');
            updateMouthPatchVisibility();
        }

        // 🌟 覚醒：ごく低確率でもちすけが覚醒して叫び、そのタップだけ10倍のもちを吐き出す
        // （おみやげをあげないときの「我慢の限界」の叫びとは完全に別の仕組み。見た目・音は使い回すが、もちの量には影響しない）
        function triggerAwakeningScream() {
            playAudioFile('audio/mochi_scream.mp3');
            vibrate([60, 40, 60, 40, 80, 40, 100]);
            screenShake('big');
            screenFlash('#ffd700', 0.35);

            startScreamFace();

            spawnScreamKanaBurst();
            showMochiComment('もちもちパワー全開やああああ！！');
        }

        function executeSingleTap(clientX, clientY) {
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
                bonusPercent += 100 + (skills.skill1.lv - 1) * 50;
            }

            // スキル4：黄金のもち福の判定（会心と重ねて乗ってOK）
            if (skills.skill4.activeTimer > 0) {
                const goldChance = 0.10 + (skills.skill4.lv - 1) * 0.02;
                if (Math.random() < goldChance) {
                    isGold = true;
                    bonusPercent += 100;
                }
            }

            // スキル2：会心のもち肌の判定（黄金と重複してOK）
            if (skills.skill2.activeTimer > 0) {
                const critChance = 0.20 + (skills.skill2.lv - 1) * 0.05;
                if (Math.random() < critChance) {
                    isCrit = true;
                    bonusPercent += 100;
                }
            }

            // スキル3：分身発動中は打撃力そのものにもボーナスが乗る。
            // Lv8未満は固定+200%(×3相当)、Lv8以降はそこからさらに緩やかに伸びる
            const SKILL3_SCALING_LV = 8;
            if (skills.skill3.activeTimer > 0) {
                const skill3Bonus = skills.skill3.lv < SKILL3_SCALING_LV
                    ? 200
                    : 200 + (skills.skill3.lv - SKILL3_SCALING_LV) * 25;
                bonusPercent += skill3Bonus;
            }

            power = Math.floor(power * (1 + bonusPercent / 100));

            // 🌟 覚醒判定：1/100の確率で、このタップだけもちが10倍になる
            let isAwakening = false;
            if (!isTutorialActive && Math.random() < 0.01) {
                isAwakening = true;
                power *= 10;
            }

            // パーティクルの色設定（スキル4の確率判定(isGold)に当たった時だけ金色にする）
            let isGoldParticle = isGold;

            // スキル1：もちもちクリック発動時は弾ける量をさらに追加
            let pCount = skills.skill1.activeTimer > 0 ? 3 : 1;
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
                score += power; currentStageProgress += power; checkStageProgress();
            } else {
                score += power;
            }

            // 新SE視覚演出（音を先に鳴らしてから見た目の処理をする＝DOM生成が音の発火を遅らせないようにする）
            if (isAwakening) {
                triggerAwakeningScream();
                createFloatingText(clientX, clientY, `😱覚醒！×10 +${formatMochi(power)}`, "#ff1744", "2rem");
            } else if (isCrit) {
                playAudioFile('audio/critical.mp3');
                vibrate(30);
                screenShake('small');
                screenFlash('#ff5722', 0.22);
                createFloatingText(clientX, clientY, `🔥会心! +${formatMochi(power)}`, "#ff3d00", "1.65rem");
                mochiBtnElement.style.filter = "contrast(2.5) brightness(1.1) grayscale(0.2)";
                clearTimeout(critFilterTimeout); // 連続で会心が出た時に前のタイマーが後から発火して消し合うのを防ぐ
                const myCritId = ++critTapId;
                critFilterTimeout = setTimeout(() => {
                    if (myCritId === critTapId) resetMochiFilter(); // 自分より後の会心が発生していなければリセット
                }, 180);
            } else if (isGold) {
                playAudioFile('audio/gold_mochi.mp3');
                vibrate([20, 30, 20]);
                screenShake('big');
                screenFlash('#ffd700', 0.3);
                createFloatingText(clientX, clientY, `✨黄金! +${formatMochi(power)}`, "#ffd700", "1.65rem");
            } else {
                createFloatingText(clientX, clientY, `+${formatMochi(power)} もち`);
            }
        }

        const mochiBtnElement = document.getElementById('mochisuke-btn');
        const mochiDeformWrap = document.getElementById('mochisuke-deform-wrap'); // タップ・スクイーズの見た目の変形は、もちすけ本体ではなくこちらにかける（帽子・顔パーツ・口も道連れで一緒に動くように）
        const mochiBreatheWrapEl = document.getElementById('mochisuke-breathe-wrap'); // 呼吸アニメーションは、もちすけ画像と口パーツをまとめて包むこちらにかける
        mochiBtnElement.addEventListener('contextmenu', (e) => e.preventDefault());

        // メインのもちすけタップ処理
        mochiBtnElement.addEventListener('pointerdown', (e) => {
            if (isMinigameActive) return;
            e.preventDefault();
            try { mochiBtnElement.setPointerCapture(e.pointerId); } catch (err) {}
            initAndPlayBGM();
            playAudioFile('audio/tap.mp3'); 
            totalTapsCount++;
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
                mochiDeformWrap.style.transform = 'scale(1.25, 0.72)';
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1.25, 0.72)');
                // 🫧 スクイーズ：ここから指の動きを追いかけて、引っ張った方向に伸縮させる
                squeezeStartX = e.clientX; squeezeStartY = e.clientY;
                isDraggingSqueeze = true;
                updateMouthPatchVisibility();
                startStretchSound();
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
        function squeezeTransformFor(dx, dy, d) {
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
        function applySqueezeTransform(dx, dy) {
            const dist = Math.min(Math.sqrt(dx * dx + dy * dy), SQUEEZE_MAX_DRAG);
            const ratio = dist / SQUEEZE_MAX_DRAG;
            mochiDeformWrap.style.transformOrigin = 'center center';
            mochiDeformWrap.style.transform = squeezeTransformFor(dx, dy, ratio);
            updateStretchSound(ratio);
            return ratio;
        }

        // 🔊 伸ばしている間だけ鳴る、ループ再生＋伸びに応じてピッチが変わる効果音
        function startStretchSound() {
            if (stretchSoundSource) return;
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const buffer = audioBuffers['audio/mochi_stretch.mp3'];
            if (!buffer) return;
            stretchSoundSource = ctx.createBufferSource();
            stretchSoundSource.buffer = buffer;
            stretchSoundSource.loop = true;
            stretchSoundGain = ctx.createGain();
            stretchSoundGain.gain.value = 0;
            stretchSoundSource.connect(stretchSoundGain).connect(ctx.destination);
            stretchSoundSource.start(0);
        }
        function updateStretchSound(ratio) {
            if (!stretchSoundSource) return;
            stretchSoundSource.playbackRate.value = 0.85 + ratio * 0.5; // 伸びるほど音が高くなる
            stretchSoundGain.gain.value = ratio * 0.35 * sfxVolumeMult; // 伸びるほど音が大きくなる
        }
        function stopStretchSound() {
            if (!stretchSoundSource) return;
            try { stretchSoundSource.stop(); } catch (e) {}
            stretchSoundSource = null;
            stretchSoundGain = null;
        }

        // 指を離した時、伸ばして/つぶしていた分だけ大きく「ぷるん」と揺れ戻ってから通常に収束する
        function releaseSqueezeWithOvershoot(dx, dy) {
            const dist = Math.min(Math.sqrt(dx * dx + dy * dy), SQUEEZE_MAX_DRAG);
            const ratio = dist / SQUEEZE_MAX_DRAG;
            const overshoot = ratio * 0.55; // 伸ばした/つぶした分だけ、戻る時のプルンも大きくなる

            mochiDeformWrap.animate([
                { transform: squeezeTransformFor(dx, dy, ratio) },
                { transform: squeezeTransformFor(dx, dy, -overshoot * 0.65), offset: 0.32 },
                { transform: squeezeTransformFor(dx, dy, overshoot * 0.32), offset: 0.58 },
                { transform: squeezeTransformFor(dx, dy, -overshoot * 0.12), offset: 0.8 },
                { transform: 'scale(1, 1)' },
            ], { duration: 420 + ratio * 280, easing: 'ease-out' });
            mochiDeformWrap.style.transform = 'scale(1, 1)';
        }

        function releaseMochiSucre() {
            if (!isMochiPressed) return;
            isMochiPressed = false;
            clearTimeout(mochiLongPressTimer);
            stopStretchSound();

            const clones = bunshinCloneEls;

            if (skills.hissatsu.activeTimer > 0) {
                mochiDeformWrap.style.transform = 'scale(1.5)';
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1.5)');
            } else if (isDraggingSqueeze && Math.sqrt(squeezeLastDx * squeezeLastDx + squeezeLastDy * squeezeLastDy) >= SQUEEZE_MIN_DRAG) {
                // 🫧 スクイーズ：一定以上引っ張られていた時だけ、伸ばして/つぶしていた分だけ大きく「ぷるん」と揺れ戻る
                releaseSqueezeWithOvershoot(squeezeLastDx, squeezeLastDy);
                setTimeout(() => { mochiDeformWrap.style.transformOrigin = ''; }, 720);
                clones.forEach(c => {
                    c.animate([
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.25, 0.72)' },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(0.86, 1.14)', offset: 0.4 },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.04, 0.96)', offset: 0.75 },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)' }
                    ], { duration: 240, easing: 'ease-out' });
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
                ], { duration: 240, easing: 'ease-out' });
                mochiDeformWrap.style.transform = 'scale(1, 1)';
                
                clones.forEach(c => {
                    c.animate([
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.25, 0.72)' },
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(0.86, 1.14)', offset: 0.4 }, 
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1.04, 0.96)', offset: 0.75 }, 
                        { transform: 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)' }
                    ], { duration: 240, easing: 'ease-out' });
                    c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1, 1)';
                });
            }
            isDraggingSqueeze = false;
            isSqueezeSettling = true; // 揺れ戻りアニメーションが収まるまで、口パーツは出さない
            updateMouthPatchVisibility();
            squeezeLastDx = 0; squeezeLastDy = 0;

            breatheTimer = setTimeout(() => {
                if (!isMochiPressed && skills.hissatsu.activeTimer <= 0) {
                    mochiBreatheWrapEl.classList.add('breathe-idle');
                }
                isSqueezeSettling = false;
                updateMouthPatchVisibility();
            }, 1200);
        }

        mochiBtnElement.addEventListener('pointerup', releaseMochiSucre);
        mochiBtnElement.addEventListener('pointerleave', releaseMochiSucre);
        mochiBtnElement.addEventListener('pointercancel', releaseMochiSucre);

        // 🫧 スクイーズ：押している間、指の動きを追いかけて伸縮を更新する（要素の外に出ても追従させたいのでdocument側で監視）
        document.addEventListener('pointermove', (e) => {
            if (!isDraggingSqueeze || !isMochiPressed) return;
            squeezeLastDx = e.clientX - squeezeStartX;
            squeezeLastDy = e.clientY - squeezeStartY;
            applySqueezeTransform(squeezeLastDx, squeezeLastDy);
        });

        /* 🔮 スキル発動＆タイマー管理システムロジック */
        // 必殺技だけはクールタイムが「時間経過」ではなく「一定回数タップ」で回復する特別仕様
        function getHissatsuTapsRequired(lv) {
            return Math.max(150, 400 - (lv - 1) * 20);
        }

        // 各スキルの実際のクールタイムを計算する共通関数（レベルによる短縮＋転生ポイントショップの恒久短縮を反映）
        function getSkillCalculatedCd(key, s) {
            const reduce = getPrestigeCdReductionSec();
            if (key === 'skill1') return Math.max(6, s.cd - (s.lv - 1) - reduce);
            if (key === 'skill2') return Math.max(10, s.cd - (s.lv - 1) - reduce);
            if (key === 'skill3') return Math.max(14, s.cd - (s.lv - 1) - reduce);
            if (key === 'skill4') return Math.max(18, s.cd - (s.lv - 1) * 2 - reduce);
            if (key === 'hissatsu') return getHissatsuTapsRequired(s.lv); // タップ数なので短縮対象外
            return s.cd;
        }

        function useSkill(key) {
            const s = skills[key];
            if (s.lv === 0) {
                alert("このスキルはまだ獲得していません！\nショップの「✨スキル」タブから獲得できます。");
                return;
            }
            if (s.currentCd > 0 || s.activeTimer > 0) return; 

            playAudioFile('audio/skill_tap.mp3');
            if (key === 'hissatsu') {
                screenShake('big');
                screenFlash('#ff9800', 0.4);
            } else {
                screenFlash('#fff59d', 0.18);
            }

            // 効果持続時間セット
            s.activeTimer = s.duration;
            
            // クールタイム計算 (Lvアップに応じて段階的に短縮)
            let calculatedCd = getSkillCalculatedCd(key, s);
            s.currentCd = calculatedCd;

            // スキル個別発動ビジュアル演出の開始
            startSkillVisualEffect(key);
            updateSkillUI();
            updateDisplay();
        }

        function startSkillVisualEffect(key) {
            const btn = document.getElementById('btn-' + key);
            if (btn) btn.classList.remove('ready');

            if (key === 'skill3') {
                // 分身の術：中央のもちすけ＋左右に1匹ずつ、計3人体制に
                const container = document.getElementById('bunshin-container');
                container.innerHTML = '';
                
                // 左右に1匹ずつ配置するためのX軸オフセット値
                const xOffsets = [-130, 130];
                for (let i = 0; i < 2; i++) {
                    const img = document.createElement('img');
                    img.src = 'ui_images/image_0.webp';
                    img.className = 'bunshin-clone-img';
                    img.style.position = 'absolute'; 
                    img.style.width = '190px'; 
                    img.style.height = 'auto';
                    img.style.opacity = '0.55'; 
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
                playBgmLoop('audio/hissatsu_bgm.mp3');

                // 親方化して巨大に固定
                mochiBreatheWrapEl.classList.remove('breathe-idle');
                mochiDeformWrap.style.transform = 'scale(1.5)';
                const clones = document.querySelectorAll('.bunshin-clone-img');
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1.5)');
                mochiBtnElement.style.filter = mochiBtnElement.style.filter + " contrast(1.4) brightness(1.05)";
                refreshBunshinCloneRects();
            }
        }

        function endSkillVisualEffect(key) {
            if (key === 'skill3') { document.getElementById('bunshin-container').innerHTML = ''; bunshinCloneRects = []; bunshinCloneEls = []; }
            if (key === 'hissatsu') {
                // 必殺技BGMを終了し通常BGMを再開
                if (isBgmInitialized) playBgmLoop('audio/bgm.mp3');

                mochiDeformWrap.style.transform = 'scale(1)';
                const clones = document.querySelectorAll('.bunshin-clone-img');
                clones.forEach(c => c.style.transform = 'translate(-50%, -50%) translateX(var(--tx)) scale(1)');
                resetMochiFilter();
                if (!isMochiPressed) mochiBreatheWrapEl.classList.add('breathe-idle');
            }
        }

        let critFilterTimeout = null;
        let critTapId = 0;
        let isScreamActive = false; // 叫び演出中は、会心などの他の演出が画像を上書きしないようにするためのフラグ
        // 🐛修正：以前はここが古い衣装システム(clothesData)だけを見ていたため、タップのたびに
        // 着せ替え部屋で選んだ服が初期状態に戻ってしまっていた。今は着せ替え部屋の選択を優先する。
        function getMochisukeBaseImg() {
            const clothesItem = (typeof KISEKAE_ITEMS !== 'undefined' && typeof equippedKisekae !== 'undefined')
                ? KISEKAE_ITEMS.clothes.find(i => i.id === equippedKisekae.clothes)
                : null;
            if (clothesItem) return clothesItem.img;
            const target = clothesData.find(c => c.id === equippedClotheId);
            return (target && target.img) ? target.img : 'ui_images/image_0.webp';
        }
        function resetMochiFilter() {
            if (!isScreamActive) {
                mochiBtnElement.src = getMochisukeBaseImg();
            }
            const target2 = clothesData.find(c => c.id === equippedClotheId);
            let baseFilter = target2 ? (target2.filter || "drop-shadow(0 10px 10px rgba(0,0,0,0.15))") : "drop-shadow(0 10px 10px rgba(0,0,0,0.15))";
            // 必殺技が発動中なら、そちらの見た目(コントラスト強化)を消さずに保つ
            if (skills.hissatsu.activeTimer > 0) baseFilter += " contrast(1.4) brightness(1.05)";
            mochiBtnElement.style.filter = baseFilter;
        }

        function updateSkillTimers(dt) {
            Object.keys(skills).forEach(key => {
                const s = skills[key];
                // 持続終了の判定
                if (s.activeTimer > 0) {
                    s.activeTimer -= dt;
                    if (s.activeTimer <= 0) { s.activeTimer = 0; endSkillVisualEffect(key); }
                }
                // クールタイム完了の判定（必殺技はタップ数で回復するのでここでは時間経過させない）
                else if (s.currentCd > 0 && key !== 'hissatsu') {
                    s.currentCd -= dt;
                    if (s.currentCd <= 0) {
                        s.currentCd = 0;
                        if (s.lv > 0) {
                            playAudioFile('audio/ready.mp3', 0.4);
                        }
                    }
                }
            });
            updateSkillUI();
        }

        // 必殺技のクールタイムをタップ数で回復させる（実際のタップの度に呼ぶ）
        function chargeHissatsuByTap() {
            const s = skills.hissatsu;
            if (s.lv > 0 && s.activeTimer <= 0 && s.currentCd > 0) {
                s.currentCd -= 1;
                if (s.currentCd <= 0) {
                    s.currentCd = 0;
                    playAudioFile('audio/ready.mp3', 0.4);
                }
                updateSkillUI();
            }
        }

        function updateSkillUI() {
            updateMouthPatchVisibility();
            Object.keys(skills).forEach(key => {
                const s = skills[key];
                const btn = document.getElementById('btn-' + key);
                if (!btn) return;

                // 各種Lv表示の同期
                const lvText = document.getElementById('lv-' + key);
                if (lvText) lvText.innerText = `Lv.${s.lv}`;

                // 解放ロック状態のデザイン分岐
                if (s.lv === 0) {
                    btn.classList.add('locked');
                } else {
                    btn.classList.remove('locked');
                }

                // クールタイム目標計算
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
        function buySkillLevel(key) {
            const s = skills[key];
            if (!s || currentStageIndex < s.unlockStage) return;
            const price = s.lv === 0 ? s.unlockPrice : Math.floor(s.unlockPrice * Math.pow(s.lvPriceMult, s.lv));
            if (score < price) return;
            score -= price;
            s.lv += 1;
            playAudioFile('audio/levelup.mp3');
            showMochiComment(pickRandom(dialogueData.eventComments.levelUp));
            saveGame(); renderShopList(); updateSkillUI(); updateDisplay(); updateShopTabHighlight();
        }

        // 🎁 おみやげ屋さんの棚UI（イラスト上に座標指定で商品を配置する）
        // 棚イラスト内の各枠の位置（%）。row=段、col=列。イラスト自体を差し替えない限りここは固定でOK。
        function resetFeedCountIfNewDay() {
            const today = getLocalDateString(new Date());
            if (feedLastResetDate !== today) {
                feedLastResetDate = today;
                feedPlaysUsedToday = 0;
                saveGame();
            }
        }

        let feedDragState = null;

        // じらすとだんだん機嫌が悪くなっていくセリフ（最終段階で叫ぶ）
        const FEED_TEASE_TIME_MS = 10000; // これだけ経つと、ドロップに失敗しなくても自動で機嫌が悪くなる
        let feedTeaseLevel = 0;
        let feedTeaseTimer = null;

        function scheduleFeedTeaseEscalation() {
            clearTimeout(feedTeaseTimer);
            if (feedTeaseLevel >= FEED_TEASE_MAX_LEVEL) return; // 最大まで達したら、時間経過では増やさない（外した時だけ増える）
            feedTeaseTimer = setTimeout(() => {
                feedTeaseLevel++;
                showFeedTeaseComment();
                scheduleFeedTeaseEscalation();
            }, FEED_TEASE_TIME_MS);
        }

        function showFeedTeaseComment() {
            if (isTutorialActive) return;
            if (feedTeaseLevel >= FEED_TEASE_MAX_LEVEL) {
                // 我慢の限界：専用の叫び効果音＋専用イラスト＋周りに散る「あ゛」で叫んでる感を強化
                playAudioFile('audio/mochi_scream.mp3');
                vibrate([60, 40, 60, 40, 80, 40, 100]);
                screenShake('big');
                screenFlash('#ff1744', 0.28);

                startScreamFace();

                spawnScreamKanaBurst();
                showMochiComment('あ\u3099'.repeat(10) + '！！');
            } else {
                showMochiComment(feedTeaseComments[feedTeaseLevel]);
            }
        }

        // もちすけの周りに「あ゛」を何個も時間差で飛び散らせる（叫んでいる迫力を強化）
        function spawnScreamKanaBurst() {
            const rect = mochiBtnElement.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 35 + Math.random() * 75;
                    const x = cx + Math.cos(angle) * dist;
                    const y = cy + Math.sin(angle) * dist - 20;
                    createFloatingText(x, y, 'あ\u3099', '#e91e63', (1.1 + Math.random() * 0.9) + 'rem');
                }, i * 55);
            }
        }

        function placeFeedIconNearMochisuke(idx) {
            const stage = stages[idx];
            closeModal('omiyage-feed-confirm-modal');
            closeModal('warehouse-modal'); // もちすけが見える画面まで戻す

            // 既に置きっぱなしのアイコンが残っていたら片付ける
            const old = document.getElementById('feed-placed-icon');
            if (old) old.remove();

            setTimeout(() => {
                const mochiRect = mochiBtnElement.getBoundingClientRect();
                const startX = mochiRect.left + mochiRect.width / 2;
                const startY = mochiRect.bottom + 68; // もちすけの足元より、アイコン1個分ほど下

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
            }, 150); // 倉庫のモーダルが閉じるアニメーションと被らないよう少し待つ
        }

        function startFeedDrag(idx, icon, e) {
            e.preventDefault();
            icon.classList.remove('feed-icon-drop-in');
            icon.style.cursor = 'grabbing';
            icon.style.transition = 'none';
            feedDragState = { idx, icon };

            document.addEventListener('pointermove', onFeedDragMove);
            document.addEventListener('pointerup', onFeedDragEnd);
            document.addEventListener('pointercancel', onFeedDragEnd);
        }

        function onFeedDragMove(e) {
            if (!feedDragState) return;
            feedDragState.icon.style.left = e.clientX + 'px';
            feedDragState.icon.style.top = e.clientY + 'px';
        }

        function onFeedDragEnd(e) {
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
                icon.style.top = (mochiRectNow.bottom + 68) + 'px';
                icon.style.cursor = 'grab';
                setTimeout(() => { icon.style.transition = 'none'; }, 320);
                feedTeaseLevel++;
                showFeedTeaseComment();
            }
        }

        let feedBuffIndicatorTimer = null;
        function startFeedBuffIndicator() {
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
            }, 250);
        }

        // 「×」ボタン用：選択も解除する
        function startFeverSpawningLoop() {
            setInterval(() => { if (!isTutorialActive && !isFever && !document.getElementById('fever-pop') && Math.random() < 0.08) spawnGoldMochi(); }, 25000);
        }

        function triggerFeverTime() {
            isFever = true; feverTimeLeft = 10;
            document.getElementById('mochi-balloon').classList.remove('balloon-show');
            document.getElementById('header-container').classList.add('fever-active');
            screenShake('big');
            screenFlash('#ff3d81', 0.4);
            updateDisplay();
            if (feverInterval) clearInterval(feverInterval);
            feverInterval = setInterval(() => {
                feverTimeLeft--;
                if (feverTimeLeft <= 0) { clearInterval(feverInterval); isFever = false; document.getElementById('header-container').classList.remove('fever-active'); }
                updateDisplay();
            }, 1000);
        }

        // 🎉 日本全国制覇の演出
        let hissatsuAutoChargeAccum = 0;
        setInterval(() => {
            let mps = getMps();
            if (mps > 0) {
                let gain = mps / 10; score += gain;
                if (selectedStageIndex === currentStageIndex && currentStageIndex < stages.length) { currentStageProgress += gain; checkStageProgress(); }
                updateDisplay();
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
                    if (wasCharging && hs.currentCd <= 0) playAudioFile('audio/ready.mp3', 0.4);
                    updateSkillUI();
                }
            }
        }, 100);

