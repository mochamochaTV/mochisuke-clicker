        function onBgmVolumeChange(val) {
            bgmVolumeMult = val / 100;
            document.getElementById('bgm-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_bgm_volume', bgmVolumeMult);
            applyBgmVolume();
        }

        function onSfxVolumeChange(val) {
            sfxVolumeMult = val / 100;
            document.getElementById('sfx-vol-label').innerText = val + '%';
            localStorage.setItem('punicker_sfx_volume', sfxVolumeMult);
        }

        function resetVolumeSettings() {
            onBgmVolumeChange(30);
            onSfxVolumeChange(100);
            document.getElementById('bgm-vol-slider').value = 30;
            document.getElementById('sfx-vol-slider').value = 100;
        }

        // 明らかにスパム/おかしな名前を弾く簡易チェック（記号だけ・同じ文字の連続など）
        function initVolumeSliders() {
            const bgmSlider = document.getElementById('bgm-vol-slider');
            const sfxSlider = document.getElementById('sfx-vol-slider');
            if (bgmSlider) { bgmSlider.value = Math.round(bgmVolumeMult * 100); document.getElementById('bgm-vol-label').innerText = bgmSlider.value + '%'; }
            if (sfxSlider) { sfxSlider.value = Math.round(sfxVolumeMult * 100); document.getElementById('sfx-vol-label').innerText = sfxSlider.value + '%'; }
            const nameInput = document.getElementById('player-name-input');
            if (nameInput) nameInput.value = playerName;
        }

        // ✏️ 意見・要望の送信（サーバーが無いので、メールアプリに下書きを渡す形にしています。
        // 実際に使う時は下のFEEDBACK_EMAILを自分の受け取りたいメールアドレスに書き換えてください）
        let uiDeclutterState = 0;
        function toggleUiDeclutter() {
            uiDeclutterState = (uiDeclutterState + 1) % 4;
            document.body.classList.remove('ui-mode-1', 'ui-mode-2', 'ui-mode-3');
            if (uiDeclutterState > 0) {
                document.body.classList.add('ui-mode-' + uiDeclutterState);
            }
            fixBottomGap(); // 表示するバーが変わって#game-screenの自然な高さが変わるので測り直す
        }

        // PWA: Service Workerを登録（対応ブラウザのみ、失敗しても通常プレイに影響なし）
        // 🐛修正：GitHub Pagesは自分でHTTPヘッダーを設定できないため、ブラウザがsw.js自体を
        // 予想より長くキャッシュしてしまい、通常モードだと更新が反映されないことがあった。
        // register()直後にupdate()を明示的に呼んで、sw.js自体の再チェックを強制する。
        // さらに、新しいSWが実際に有効になった瞬間を検知して、1回だけ自動でページを再読み込みする。
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').then((reg) => {
                    reg.update().catch(() => {});
                    setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000); // 開いたままの人のためのフォローアップ
                }).catch(() => {});

                let hasReloadedForUpdate = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (hasReloadedForUpdate) return; // 無限リロードを避ける
                    hasReloadedForUpdate = true;
                    location.reload();
                });
            });
        }

        // スマホ環境の2本指ズーム・ダブルタップズームを制限
        document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
        let hasSeenTutorial = false; // 初回チュートリアルを見せたかどうか

        // 🍴 もちすけにお土産をあげる機能（回数制限なし）
        let balloonAutoHideTimer = null;
        function showMochiComment(text) {
            const balloon = document.getElementById('mochi-balloon');
            if (!balloon) return;
            balloon.innerText = text;
            balloon.classList.add('balloon-show');
            lastTappedTime = Date.now(); // 表示直後にすぐ別のセリフへ切り替わらないようにリセット
            clearTimeout(balloonAutoHideTimer);
            if (!isTutorialActive) {
                balloonAutoHideTimer = setTimeout(() => { balloon.classList.remove('balloon-show'); }, 4000);
            }
        }

        // プレゼントや黄金もちが消えた時など、表示中のセリフを引っ込めるためのヘルパー
        function hideMochiComment() {
            const balloon = document.getElementById('mochi-balloon');
            if (balloon) balloon.classList.remove('balloon-show');
        }

        // 🎙️ セリフの表示/非表示を一元的に検知して、口パーツの切り替えと効果音をまとめて処理する
        // （showMochiComment/updateCheerBalloon/チュートリアルなど、色々な場所からセリフが更新されても、ここ1箇所で拾える）
        // 👄 口パーツは「通常の姿・話していない・叫んでいない・必殺技で巨大化していない」時だけ表示する。
        // 叫び顔・必殺技巨大化は、それぞれ専用のイラスト/拡大を使うため、口パーツを重ねると浮いて見えてしまう。
        function updateMouthPatchVisibility() {
            const mouthPatchEl = document.getElementById('mochisuke-mouth-patch');
            if (!mouthPatchEl) return;
            if (mouthAdjustMode) { mouthPatchEl.style.display = 'block'; return; } // 🐛修正：調整中は、セリフ等で見えなくなるとイライラするので常に表示する
            const balloonEl = document.getElementById('mochi-balloon');
            const isTalking = balloonEl && balloonEl.classList.contains('balloon-show');
            const isHissatsuActive = skills.hissatsu && skills.hissatsu.activeTimer > 0;
            // 伸ばしたり潰したりしている間・その後の揺れ戻りアニメーション中は、口パーツが元の位置に浮いて見えてしまうため非表示にする
            const shouldHide = isTalking || isScreamActive || isHissatsuActive || isDraggingSqueeze || isSqueezeSettling;
            mouthPatchEl.style.display = shouldHide ? 'none' : 'block';
        }

        (function setupBalloonObserver() {
            const balloonEl = document.getElementById('mochi-balloon');
            if (!balloonEl) return;
            let wasShowing = false;
            const observer = new MutationObserver(() => {
                const isShowing = balloonEl.classList.contains('balloon-show');
                if (isShowing === wasShowing) return;
                wasShowing = isShowing;
                updateMouthPatchVisibility();
                // 🤖 ロボもちすけ装備中は、通常の「パッ」ではなく専用の口（窓）アニメ＋「ウィーン」音にする
                if (equippedKisekae.fullbody === 'fullbody_robo') {
                    playRoboMouthAnimation(isShowing);
                } else if (isShowing) {
                    playAudioFile('audio/talk_pop.mp3');
                }
            });
            observer.observe(balloonEl, { attributes: true, attributeFilter: ['class'] });
        })();

        // 🤖 ロボもちすけの口（窓）アニメーション。open=trueで開くコマ送り、falseで閉じるコマ送り（開く時の逆再生）
        let roboMouthAnimTimer = null;
        function playRoboMouthAnimation(open) {
            const item = KISEKAE_ITEMS.fullbody.find(i => i.id === 'fullbody_robo');
            const mainImg = document.getElementById('mochisuke-fullbody');
            if (!item || !mainImg) return;
            const frames = item.mouthFrames;
            clearInterval(roboMouthAnimTimer);
            playAudioFile('audio/kisekae/robo_whir.mp3'); // ウィーン音（開閉どちらも同じ音）
            let i = open ? 0 : frames.length - 1;
            const step = open ? 1 : -1;
            roboMouthAnimTimer = setInterval(() => {
                mainImg.src = frames[i];
                i += step;
                if ((open && i >= frames.length) || (!open && i < 0)) {
                    clearInterval(roboMouthAnimTimer);
                    mainImg.src = open ? frames[frames.length - 1] : item.img; // 開き切ったら最終フレーム維持、閉じ切ったら口閉じ画像に戻る
                }
            }, 60); // 5コマを300msで再生
        }

        // 🫁 口パーツの呼吸は、もちすけ画像と共通の親要素(#mochisuke-breathe-wrap)にアニメーションをかけることで、
        // 追いかけて同期させるのではなく、そもそもズレようがない形で実現している（詳細はHTML側を参照）
        let mouthAdjustMode = false; // 調整モード中かどうか

        // 時間帯の並び順（インデックスは他の場所でも共通して使う）
        const TIME_BUCKETS = ['morning', 'noon', 'evening', 'lateNight'];
        function getTimeGreeting() {
            const bucket = TIME_BUCKETS[getTimeBucketIndex(new Date().getHours())];
            return pickRandom(dialogueData.timeGreetings[bucket]);
        }

        function getLocalDateString(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        // 画面を開いた直後の挨拶。その日その時間帯にまだ挨拶していなければ「おはよう」等、
        // 既に挨拶済みなら「おかえり」を出す。両方ともlocalStorageに記録して次回に引き継ぐ。
        const GREETING_STATE_KEY = 'punicker_last_greeting_bucket';
        let tutorialStepIndex = 0;
        let tutorialTimer = null;
        let isTutorialActive = false;

        function checkShowTutorial() {
            if (hasSeenTutorial) return;
            // 何かしら既にプレイした形跡があれば、初見扱いにしない
            if (score > 0 || totalTapsCount > 0) { hasSeenTutorial = true; saveGame(); return; }
            openTutorial();
        }

        function openTutorial() {
            tutorialStepIndex = 0;
            isTutorialActive = true;
            document.body.classList.add('tutorial-active');
            document.querySelectorAll('.recommended-glow').forEach(el => el.classList.remove('recommended-glow'));
            runTutorialStep();
        }

        function runTutorialStep() {
            document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));

            if (tutorialStepIndex >= TUTORIAL_STEPS.length) {
                endTutorial();
                return;
            }
            const step = TUTORIAL_STEPS[tutorialStepIndex];

            if (step.highlight) {
                const el = document.getElementById(step.highlight);
                if (el) el.classList.add('tutorial-glow');
            }

            const balloon = document.getElementById('mochi-balloon');
            clearTimeout(balloonAutoHideTimer);
            balloon.innerText = step.text;
            balloon.classList.add('balloon-show');

            clearTimeout(tutorialTimer);
            tutorialTimer = setTimeout(() => {
                tutorialStepIndex++;
                runTutorialStep();
            }, step.duration);
        }

        function endTutorial() {
            isTutorialActive = false;
            document.body.classList.remove('tutorial-active');
            document.querySelectorAll('.tutorial-glow').forEach(el => el.classList.remove('tutorial-glow'));
            hasSeenTutorial = true;
            saveGame();
            promptPlayerNameIfNeeded();
        }

        function confirmSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'flex';
        }
        function doSkipTutorial() {
            document.getElementById('tutorial-skip-confirm').style.display = 'none';
            clearTimeout(tutorialTimer);
            hideMochiComment();
            endTutorial(); // そのまま名前を決めるところまで進む
        }

        // 🍴 チュートリアルの最後に、まだ名前を決めていなければ聞いておく
        function promptPlayerNameIfNeeded() {
            if (localStorage.getItem('punicker_player_name')) return;
            const input = document.getElementById('tutorial-name-input');
            if (input) input.value = playerName;
            openModal('tutorial-name-modal');
        }
        function saveTutorialPlayerName() {
            const input = document.getElementById('tutorial-name-input');
            const result = sanitizePlayerName(input.value);
            if (!result.ok) { alert(result.reason); return; }
            playerName = result.name;
            localStorage.setItem('punicker_player_name', playerName);
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            closeModal('tutorial-name-modal');
        }

        // 💬 4つの丸ボタン、初めて押した時だけ軽くヒントを出す（チュートリアル終了後の、2周目以降のフォロー用）
        let seenButtonHints = { map: false, menu: false, ui: false, feed: false };
        function onMapButtonTap() {
            if (!seenButtonHints.map) { seenButtonHints.map = true; saveGame(); showMochiComment('地図で好きな県に飛べるで！'); }
            openMap();
        }
        function onMenuButtonTap() {
            if (!seenButtonHints.menu) { seenButtonHints.menu = true; saveGame(); showMochiComment('設定はここから触れるで！'); }
            openModal('menu-modal'); refreshCloudBackupStatus();
        }
        function onUiButtonTap() {
            if (!seenButtonHints.ui) { seenButtonHints.ui = true; saveGame(); showMochiComment('写真撮る時とかに使こてな！'); }
            toggleUiDeclutter();
        }
        function onFeedButtonTap() {
            if (!seenButtonHints.feed) { seenButtonHints.feed = true; saveGame(); showMochiComment('ここからお土産あげられるんやで！'); }
            openOmiyageCollection();
        }

        function showOpeningGreeting() {
            const now = new Date();
            const bucketIdx = getTimeBucketIndex(now.getHours());
            const bucketName = TIME_BUCKETS[bucketIdx];
            const todayKey = getLocalDateString(now) + '_' + bucketName;
            const lastKey = localStorage.getItem(GREETING_STATE_KEY);
            let text;
            if (lastKey === todayKey) {
                text = pickRandom(dialogueData.welcomeBack[bucketName]);
            } else {
                text = pickRandom(dialogueData.timeGreetings[bucketName]);
                localStorage.setItem(GREETING_STATE_KEY, todayKey);
            }
            lastGreetingHourBucket = bucketIdx; // アイドルループがすぐ二重に挨拶し直さないように
            showMochiComment(text);
        }

        let mouthDragState = null;
        function toggleMouthAdjustMode() {
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
        function setupMouthDrag(anchor) {
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
        function adjustMouthSize(delta) {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            if (!anchor) return;
            const cur = parseFloat(anchor.style.width) || 18;
            anchor.style.width = Math.max(3, cur + delta) + '%';
            updateMouthReadout();
        }
        function updateMouthReadout() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const el = document.getElementById('mouth-adjust-readout');
            if (!anchor || !el) return;
            el.textContent = `top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
        }
        function copyMouthCoords() {
            const anchor = document.getElementById('mochisuke-mouth-anchor');
            const text = `口パーツ: top:${anchor.style.top}; left:${anchor.style.left}; width:${anchor.style.width};`;
            const textarea = document.getElementById('mouth-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        // 🛠️ もちすけ本体の大きさ調整。着せ替え部屋も全く同じ大きさに揃える約束なので、
        // ここで変えた値は、着せ替え部屋のもちすけ本体にもその場で同期する
        function adjustMochisukeBodySize(deltaWidth, deltaMaxHeight) {
            const btn = document.getElementById('mochisuke-btn');
            const curWidth = parseFloat(btn.style.width) || 170;
            const curMaxH = parseFloat(btn.style.maxHeight) || 206;
            const newWidth = Math.max(60, curWidth + deltaWidth);
            const newMaxH = Math.max(60, curMaxH + deltaMaxHeight);
            btn.style.width = newWidth + 'px';
            btn.style.maxHeight = newMaxH + 'px';
            const roomWrap = document.getElementById('kisekae-mochisuke-wrap');
            if (roomWrap) { roomWrap.style.width = newWidth + 'px'; roomWrap.style.maxHeight = newMaxH + 'px'; }
            updateMochisukeBodyReadout();
        }
        function updateMochisukeBodyReadout() {
            const btn = document.getElementById('mochisuke-btn');
            const el = document.getElementById('mochisuke-body-readout');
            if (!btn || !el) return;
            el.textContent = `width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};（着せ替え部屋にも自動で同期済み）`;
        }
        function copyMochisukeBodyCoords() {
            const btn = document.getElementById('mochisuke-btn');
            const text = `もちすけ本体: width:${btn.style.width || '170px'}; max-height:${btn.style.maxHeight || '206px'};`;
            const textarea = document.getElementById('mochisuke-body-copy-textarea');
            textarea.value = text; textarea.style.display = 'block'; textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        function openModal(id, skipSound) {
            cancelFeedDragIfActive(); // 給餌中に他画面へ移動したら、置きっぱなしのおみやげを片付ける
            if (!skipSound) playAudioFile('audio/skill_tap.mp3');
            document.body.classList.add('modal-open');
            document.getElementById(id).style.display = "flex";
        }
        function closeModal(id) {
            document.body.classList.remove('modal-open'); document.getElementById(id).style.display = "none";
            // 🔴 スタンプを押さずに絵日記を閉じた場合、進捗エリアのボタンを再表示して操作不能にならないようにする
            if (id === 'diary-modal' && isPendingStampMoment) {
                const btn = document.getElementById('stamp-press-btn');
                if (btn) btn.style.display = 'flex';
            }
        }

        function openTrophyRoom() {
            const grid = document.getElementById('trophy-grid');
            grid.innerHTML = "";
            stages.forEach((stage, i) => {
                const cell = document.createElement('div');
                cell.style.cssText = "text-align:center; padding:6px 2px; border-radius:8px; background:#fff8ec; cursor:pointer;";
                if (i > currentStageIndex) {
                    cell.style.opacity = "0.4";
                    cell.innerHTML = `<div style="font-size:1.3rem;">❓</div><div style="font-size:0.55rem; color:#999;">???</div>`;
                    cell.onclick = () => alert("まだ訪れていない県じゃ！旅を進めよう。");
                } else {
                    const trophy = getPrefTrophy(i);
                    cell.innerHTML = `<div style="font-size:1.3rem;">${getPrefTrophyIcon(trophy)}</div><div style="font-size:0.55rem; color:#5d4037;">${stage.name}</div>`;
                    cell.onclick = () => showPrefTrophyDetail(i);
                }
                grid.appendChild(cell);
            });
            openModal('trophy-room-modal');
        }

        // 💼 おしごとミッション
        function closeOshigoto() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('mission-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function openOshigotoPlaceholder() {
            checkAndRotateMissions(); // 開くたびに、日付/週またぎを最新化する
            openModal('mission-modal');
            switchMissionTab(currentMissionTab);
        }
        let currentMissionTab = 'tutorial';
        function switchMissionTab(tab) {
            currentMissionTab = tab;
            ['tutorial', 'daily', 'weekly'].forEach(t => {
                document.getElementById(`mission-tab-${t}`).classList.toggle('active', t === tab);
            });
            renderMissionList();
        }
        function renderMissionRow(mission) {
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
            const isDone = claimed || complete; // 受取済み・受取可能、どちらも「クリア」扱いで水色にする
            return `
                <div class="mission-card ${isDone ? 'mission-card-done' : ''}">
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
        function renderMissionList() {
            const container = document.getElementById('mission-list-container');
            let html = '';

            if (currentMissionTab === 'tutorial') {
                if (tutorialMissionStep < TUTORIAL_MISSIONS.length) {
                    html += renderMissionRow(TUTORIAL_MISSIONS[tutorialMissionStep]);
                } else {
                    html += `<div style="text-align:center; color:#aaa; font-size:0.8rem; padding:24px;">はじめてのおしごとは、もう全部クリアしたで！</div>`;
                }
            } else if (currentMissionTab === 'daily') {
                missionDailySelected.forEach(id => {
                    const m = getMissionDef(id);
                    if (m) html += renderMissionRow(m);
                });
            } else if (currentMissionTab === 'weekly') {
                missionWeeklySelected.forEach(id => {
                    const m = getMissionDef(id);
                    if (m) html += renderMissionRow(m);
                });
            }

            container.innerHTML = html;
        }
        function onClaimMissionTap(id) {
            const success = claimMission(id);
            if (success) {
                playAudioFile('audio/levelup.mp3');
                updateDisplay();
                renderMissionList();
            }
        }

        // 🤝 フレンド機能
        async function openFriendPlaceholder() {
            openModal('friend-modal');
            document.getElementById('friend-add-result').innerText = '';
            document.getElementById('friend-code-input').value = '';

            const codeEl = document.getElementById('my-friend-code');
            codeEl.innerText = '読み込み中...';
            if (window.isRankingReady && window.isRankingReady()) {
                const code = await window.ensureMyFriendCode();
                codeEl.innerText = code || '（取得できませんでした）';
            } else {
                codeEl.innerText = '（オフラインです）';
            }
            renderFriendList();
        }
        function copyMyFriendCode() {
            const code = document.getElementById('my-friend-code').innerText;
            if (!code || code.includes('（') || code.includes('読み込み')) return;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).catch(() => {});
            const result = document.getElementById('friend-add-result');
            result.style.color = '#4caf50';
            result.innerText = 'コピーしました！';
        }
        async function onAddFriendTap() {
            const input = document.getElementById('friend-code-input');
            const result = document.getElementById('friend-add-result');
            const code = input.value.trim();
            if (!code) return;
            if (!window.isRankingReady || !window.isRankingReady()) {
                result.style.color = '#e57373'; result.innerText = '通信エラー：時間を置いて試してください'; return;
            }
            result.style.color = '#999'; result.innerText = '追加中...';
            const res = await window.addFriendByCode(code);
            if (res.success) {
                result.style.color = '#4caf50';
                result.innerText = `${res.name}さんとフレンドになりました！`;
                input.value = '';
                renderFriendList();
            } else if (res.reason === 'not_found') {
                result.style.color = '#e57373'; result.innerText = 'そのコードは見つかりませんでした';
            } else if (res.reason === 'self') {
                result.style.color = '#e57373'; result.innerText = '自分のコードは追加できません';
            } else {
                result.style.color = '#e57373'; result.innerText = '通信エラーが発生しました';
            }
        }
        async function renderFriendList() {
            const listEl = document.getElementById('friend-list');
            listEl.innerHTML = `<div style="text-align:center; color:#aaa; padding:14px;">読み込み中...</div>`;
            if (!window.isRankingReady || !window.isRankingReady()) {
                listEl.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">通信エラーのため、フレンド一覧を表示できません</div>`;
                return;
            }
            const friends = await window.fetchFriendList();
            if (!friends || friends.length === 0) {
                listEl.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">まだフレンドがいません。<br>コードを教え合って追加してみましょう！</div>`;
                return;
            }
            listEl.innerHTML = '';
            friends.sort((a, b) => b.score - a.score);
            friends.forEach(f => {
                const row = document.createElement('div');
                row.style.cssText = `display:flex; align-items:center; gap:10px; padding:9px 8px; margin-bottom:6px; border-radius:12px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.08);`;
                row.innerHTML = `
                    <div style="flex-shrink:0; position:relative; width:40px; height:40px;">${renderRankOutfitPreviewHtml(f.outfit)}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.8rem; color:#5d4037; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.name)}</div>
                        <div style="font-size:0.68rem; color:#e91e63; font-weight:900;">${formatMochi(f.score)} もち</div>
                    </div>
                `;
                listEl.appendChild(row);
            });
        }

        // 🚧「移動する」の最終的なUIはまだ未定。ひとまず一覧を出す形で仮実装しておく
        function openMoveMenu() {
            openModal('move-menu-modal'); // 移動先を選ぶだけなので、ここではフェードしない（選んだ時にフェードする）
            renderMoveMenuParts();
            startMoveMochisukeLoop();
        }
        // 🐹 もちすけが、ものおき→ショップ→ゲーセン→マイルーム→戻る看板、の順に看板の右をワープして回る演出
        const MOVE_MOCHISUKE_SIGN_ORDER = ['move-sign-warehouse', 'move-sign-shop', 'move-sign-arcade', 'move-sign-myroom', 'move-sign-return'];
        let moveMochisukeLoopTimer = null;
        let moveMochisukeLoopIndex = 0;
        function startMoveMochisukeLoop() {
            stopMoveMochisukeLoop();
            moveMochisukeLoopIndex = 0;
            updateMoveMochisukePosition();
            moveMochisukeLoopTimer = setInterval(() => {
                moveMochisukeLoopIndex = (moveMochisukeLoopIndex + 1) % MOVE_MOCHISUKE_SIGN_ORDER.length;
                updateMoveMochisukePosition();
            }, 1500);
        }
        function stopMoveMochisukeLoop() {
            if (moveMochisukeLoopTimer) clearInterval(moveMochisukeLoopTimer);
            moveMochisukeLoopTimer = null;
        }
        function updateMoveMochisukePosition() {
            const signId = MOVE_MOCHISUKE_SIGN_ORDER[moveMochisukeLoopIndex];
            const signPart = MOVE_MENU_PARTS.find(p => p.id === signId);
            const returnSignPart = MOVE_MENU_PARTS.find(p => p.id === 'move-sign-return');
            const mochi = document.getElementById('move-mochisuke-guide');
            if (!signPart || !mochi) return;
            // ちょこんと縮んでから、次の看板の位置へワープする（「とことこ」感を出す一瞬の縮み演出）
            mochi.animate([
                { transform: 'scale(1, 1)' },
                { transform: 'scale(0.6, 1.3)', offset: 0.4 },
                { transform: 'scale(1, 1)' },
            ], { duration: 260, easing: 'ease-in-out' });
            // 🐛修正：以前は看板ごとの幅を基準にしていたため、看板の大きさが違うともちすけの大きさも違って見えていた。
            // 「戻る看板」の幅を基準にした固定値にして、どの看板の横にいても同じ大きさに統一する
            const mochiWidth = returnSignPart.width * 0.55;
            mochi.style.width = mochiWidth + '%';
            mochi.style.top = (signPart.top + signPart.height * 0.15) + '%';
            mochi.style.left = (signPart.left + signPart.width + 1.5) + '%';
        }
        // MOVE_MENU_PARTSの座標を、実際の画像に反映する
        function renderMoveMenuParts() {
            MOVE_MENU_PARTS.forEach(p => {
                const el = document.getElementById(p.id);
                if (!el) return;
                el.style.top = p.top + '%';
                el.style.left = p.left + '%';
                el.style.width = p.width + '%';
                el.style.height = p.height + '%';
            });
        }
        // 移動先が決まった時だけ、ここでフェード＋移動音を鳴らしてから実際に画面を切り替える
        function moveMenuGoTo(fn) {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            stopMoveMochisukeLoop();
            setTimeout(() => {
                closeModal('move-menu-modal');
                fn();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function moveMenuGoHome() {
            moveMenuGoTo(() => {});
        }

        function closeWarehouse() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('warehouse-modal');
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function warehouseItemAction(action) {
            if (action === 'trophy') openTrophyRoom();
            else if (action === 'omiyage') openOmiyageCollection();
            else if (action === 'ticket') openTicketInventory();
            else if (action === 'diary') openDiary();
        }
        function renderWarehouseItems() {
            const stage = document.getElementById('warehouse-item-stage');
            stage.querySelectorAll('.warehouse-item-wrap').forEach(el => el.remove());
            WAREHOUSE_ITEM_PARTS.forEach(part => {
                const img = document.createElement('img');
                img.className = 'warehouse-item-wrap';
                img.id = part.id;
                img.src = part.img;
                img.alt = part.label;
                img.style.cssText = `top:${part.top}%; left:${part.left}%; width:${part.width}%; height:${part.height}%; object-fit:contain;`;
                img.onclick = () => warehouseItemAction(part.action);
                stage.appendChild(img);
            });
            // おみやげの進捗バッジを、おみやげイラストの右上に合わせる
            const omiyagePart = WAREHOUSE_ITEM_PARTS.find(p => p.action === 'omiyage');
            const badge = document.getElementById('warehouse-omiyage-badge');
            if (omiyagePart && badge) {
                badge.style.top = omiyagePart.top + '%';
                badge.style.left = (omiyagePart.left + omiyagePart.width - 12) + '%';
            }
        }
        // ===================================================================
        // 🛋️ マイルーム
        // ===================================================================
        // 🚧 マイルームは仕様検討中のため、いったん開発者モード限定にしておく
        function openMyRoomEntry() {
            if (!IS_DEV_MODE) {
                alert('🛋️ 「マイルーム」は準備中です！\nお楽しみに！');
                return;
            }
            moveMenuGoTo(openMyRoom);
        }
        let previewMyroom = {};
        function openMyRoom() {
            previewMyroom = { ...equippedMyroom };
            renderMyroomLayout();
            openMyroomCategory('wallpaper');
            openModal('myroom-modal');
        }
        function closeMyRoom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('myroom-modal');
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function renderMyroomLayout() {
            const wallpaperItem = MYROOM_ITEMS.wallpaper.find(i => i.id === previewMyroom.wallpaper) || MYROOM_ITEMS.wallpaper[0];
            const flooringItem = MYROOM_ITEMS.flooring.find(i => i.id === previewMyroom.flooring) || MYROOM_ITEMS.flooring[0];
            document.getElementById('myroom-wallpaper-layer').src = wallpaperItem.img;
            document.getElementById('myroom-flooring-layer').src = flooringItem.img;

            Object.keys(MYROOM_SLOT_POSITIONS).forEach(cat => {
                const el = document.getElementById(`myroom-slot-${cat}`);
                const itemId = previewMyroom[cat];
                const pos = MYROOM_SLOT_POSITIONS[cat];
                if (itemId) {
                    const item = MYROOM_ITEMS[cat].find(i => i.id === itemId);
                    if (item) {
                        el.src = item.img;
                        el.style.display = 'block';
                        el.style.top = pos.top + '%';
                        el.style.left = pos.left + '%';
                        el.style.width = pos.width + '%';
                        el.style.height = pos.height + '%';
                    }
                } else {
                    el.style.display = 'none';
                }
            });
        }
        const MYROOM_CATEGORY_ORDER = ['wallpaper', 'flooring', 'wall_deco', 'big_furniture', 'table', 'small_deco'];
        let myroomCurrentCategory = 'wallpaper';
        function openMyroomCategory(cat) {
            playAudioFile('audio/skill_tap.mp3');
            myroomCurrentCategory = cat;
            const sortedItems = [...MYROOM_ITEMS[cat]].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            // 壁紙・床は常に何か装着しているので「外す」ボタンは無し。家具4種は「外す」ボタンあり
            const canRemove = (cat !== 'wallpaper' && cat !== 'flooring');
            const items = canRemove ? [{ id: null, name: '外す', isRemoveButton: true }, ...sortedItems] : sortedItems;
            const owned = ownedMyroomItems[cat] || [];

            const leftList = document.getElementById('myroom-item-list-left');
            const rightList = document.getElementById('myroom-item-list-right');
            leftList.innerHTML = ''; rightList.innerHTML = '';

            items.forEach((item, i) => {
                const cell = document.createElement('div');
                if (item.isRemoveButton) {
                    const isEquipped = previewMyroom[cat] == null;
                    cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); cursor:pointer;`;
                    cell.innerHTML = `<div style="font-size:1.8rem; color:#e57373; font-weight:900;">✕</div>`;
                    cell.onclick = () => equipMyroomItem(cat, null);
                    (i % 2 === 0 ? leftList : rightList).appendChild(cell);
                    return;
                }
                const isOwned = owned.includes(item.id);
                const isEquipped = previewMyroom[cat] === item.id;
                cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); ${isOwned ? 'cursor:pointer;' : ''}`;
                cell.innerHTML = `<img src="${item.img}" alt="${item.name}" style="width:80%; height:80%; object-fit:contain; ${isOwned ? '' : 'filter:grayscale(1); opacity:0.5;'}">`;
                if (!isOwned) {
                    cell.insertAdjacentHTML('beforeend', `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🔒</div>`);
                } else {
                    cell.onclick = () => equipMyroomItem(cat, item.id);
                }
                (i % 2 === 0 ? leftList : rightList).appendChild(cell);
            });

            if (sortedItems.length === 0) {
                const emptyMsg = `<div style="text-align:center; color:#fff; font-size:0.68rem; padding:14px; text-shadow:0 1px 3px rgba(0,0,0,0.5); grid-column:1/-1;">まだアイテムがありません</div>`;
                leftList.insertAdjacentHTML('beforeend', emptyMsg);
            }

            document.querySelectorAll('.myroom-cat-btn').forEach((btn, idx) => {
                btn.style.boxShadow = (MYROOM_CATEGORY_ORDER[idx] === cat) ? '0 0 0 3px #ffd700, 0 3px 8px rgba(0,0,0,0.25)' : '0 3px 8px rgba(0,0,0,0.25)';
            });
        }
        let myroomNameLabelTimeout = null;
        function equipMyroomItem(cat, id) {
            previewMyroom[cat] = id;
            renderMyroomLayout();
            openMyroomCategory(cat);
            const item = id ? MYROOM_ITEMS[cat].find(i => i.id === id) : null;
            const label = document.getElementById('myroom-item-name-label');
            clearTimeout(myroomNameLabelTimeout);
            label.textContent = item ? item.name : '外す';
            label.style.display = 'block';
            myroomNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, 2200);
        }
        function confirmMyroomLayout() {
            equippedMyroom = { ...previewMyroom };
            saveGame();
            const btn = document.getElementById('myroom-confirm-btn');
            const original = btn.innerText;
            btn.innerText = '✅ 決定しました！';
            setTimeout(() => { btn.innerText = original; }, 1200);
        }

        function openWarehouse() {
            let boughtCount = 0;
            stages.forEach((s, idx) => { if((purchasedItems[idx] || 0) > 0) boughtCount++; });
            const badge = document.getElementById('warehouse-omiyage-badge');
            if (badge) badge.textContent = `${boughtCount}/${stages.length}`;
            renderWarehouseItems();
            openModal('warehouse-modal');
        }

        // 🎫 ガチャで手に入れたチケットの一覧。個数を確認しながら、好きなタイミングで使える
        function openTicketInventory() {
            const list = document.getElementById('ticket-inventory-list');
            list.innerHTML = '';
            NORMAL_CONSUMABLE_ITEMS.forEach(item => {
                const count = ticketInventory[item.id] || 0;
                const row = document.createElement('div');
                row.className = 'list-item';
                row.innerHTML = `<div class="item-info-row"><img class="item-thumb" src="${item.img}" alt="${item.name}"><div class="item-info"><span class="item-title">🎫 ${item.name}　<span style="color:#ff9800; font-weight:900;">×${count}</span></span><span class="item-desc">${item.desc}</span></div></div><button class="item-action-btn btn-shop" ${count > 0 ? '' : 'disabled'} onclick="useTicket('${item.id}')" style="background:#4caf50; color:white;">使う</button>`;
                list.appendChild(row);
            });
            openModal('ticket-inventory-modal');
        }

        // ===================================================================
        // 👗 着せ替え部屋
        // ===================================================================
        function openKisekaeRoom() {
            openModal('kisekae-room-modal'); // タップ音のみでOK、フェード・移動音は不要
            previewKisekae = { ...equippedKisekae }; // 確定済みの状態から、試着用のコピーを作る
            renderKisekaeMochisuke();
            openKisekaeCategory('clothes');
        }
        function closeKisekaeRoom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('kisekae-room-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }

        // 着せ替え部屋のもちすけと、通常のタップ画面のもちすけ、両方に今の装着状態を反映する
        function renderKisekaeMochisuke() {
            const roomClothes = document.getElementById('kisekae-mochisuke-clothes');
            const roomFullbody = document.getElementById('kisekae-mochisuke-fullbody');
            const fullbodyId = previewKisekae.fullbody;

            if (fullbodyId) {
                // 全身装備中は、帽子・顔パーツを隠し、全身イラストを服の上に重ねて覆う（服自体は隠さない：
                // 服の画像がこの箱の高さの土台になっているため、消すと箱ごと潰れて全身画像も見えなくなってしまう）
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                roomFullbody.src = fbItem.img;
                roomFullbody.style.display = 'block';
                ['hat', 'face'].forEach(cat => { document.getElementById(`kisekae-mochisuke-${cat}`).style.display = 'none'; });
            } else {
                roomFullbody.style.display = 'none';
                const clothesItem = KISEKAE_ITEMS.clothes.find(i => i.id === previewKisekae.clothes) || KISEKAE_ITEMS.clothes[0];
                roomClothes.src = clothesItem.img;

                ['hat', 'face'].forEach(cat => {
                    const roomImg = document.getElementById(`kisekae-mochisuke-${cat}`);
                    if (!roomImg) return;
                    const itemId = previewKisekae[cat];
                    if (itemId) {
                        const item = KISEKAE_ITEMS[cat].find(i => i.id === itemId);
                        roomImg.src = item.img;
                        roomImg.style.display = 'block';
                        roomImg.style.top = item.top + '%';
                        roomImg.style.left = item.left + '%';
                        roomImg.style.width = item.width + '%';
                        roomImg.style.height = item.height + '%';
                        roomImg.style.transform = `rotate(${item.rotation || 0}deg)`;
                        roomImg.style.zIndex = '6'; // 帽子・顔パーツは、常にもちすけの手前
                    } else {
                        roomImg.style.display = 'none';
                    }
                });
            }
            updateKisekaeWingDisplay('room', fullbodyId ? null : previewKisekae.back);
            // 🎯「決定」を押すまでは試着中なので、ここではタップ画面には反映しない（applyKisekaeToMainScreenはconfirmKisekaeOutfitからだけ呼ぶ）
        }

        // 🕊️ 背中(翼)の表示・羽ばたきアニメーションループ。target: 'room'（着せ替え部屋）か 'main'（タップ画面）
        let wingFlapTimers = { room: null, main: null };
        let wingFlapFrameIndex = { room: 0, main: 0 };
        const WING_FLAP_INTERVAL_MS = 90; // 8コマ ×90ms ≒ 720msで1周
        function updateKisekaeWingDisplay(target, backId) {
            const leftEl = document.getElementById(target === 'room' ? 'kisekae-mochisuke-wing-left' : 'mochisuke-wing-left');
            const rightEl = document.getElementById(target === 'room' ? 'kisekae-mochisuke-wing-right' : 'mochisuke-wing-right');
            if (!leftEl || !rightEl) return;
            if (backId) {
                const item = KISEKAE_ITEMS.back.find(i => i.id === backId);
                if (!item) { leftEl.style.display = 'none'; rightEl.style.display = 'none'; stopWingFlapLoop(target); return; }
                leftEl.style.display = 'block'; rightEl.style.display = 'block';
                leftEl.style.zIndex = '1'; rightEl.style.zIndex = '1'; // 調整モードで一時的に上げたz-indexを、通常表示時は必ず背面に戻す
                leftEl.style.width = item.width + '%'; leftEl.style.height = item.height + '%';
                rightEl.style.width = item.width + '%'; rightEl.style.height = item.height + '%';
                startWingFlapLoop(target, item);
            } else {
                leftEl.style.display = 'none'; rightEl.style.display = 'none';
                stopWingFlapLoop(target);
            }
        }
        function applyWingFrame(leftEl, rightEl, item, frameIdx) {
            leftEl.src = item.leftFrames[frameIdx];
            rightEl.src = item.rightFrames[frameIdx];
            const lp = item.leftFramePos[frameIdx], rp = item.rightFramePos[frameIdx];
            leftEl.style.top = lp.top + '%'; leftEl.style.left = lp.left + '%';
            rightEl.style.top = rp.top + '%'; rightEl.style.left = rp.left + '%';
        }
        function startWingFlapLoop(target, item) {
            stopWingFlapLoop(target);
            wingFlapFrameIndex[target] = 0;
            const leftEl = document.getElementById(target === 'room' ? 'kisekae-mochisuke-wing-left' : 'mochisuke-wing-left');
            const rightEl = document.getElementById(target === 'room' ? 'kisekae-mochisuke-wing-right' : 'mochisuke-wing-right');
            applyWingFrame(leftEl, rightEl, item, 0); // 最初のフレームを即座に反映
            wingFlapTimers[target] = setInterval(() => {
                wingFlapFrameIndex[target] = (wingFlapFrameIndex[target] + 1) % item.leftFrames.length;
                applyWingFrame(leftEl, rightEl, item, wingFlapFrameIndex[target]);
            }, WING_FLAP_INTERVAL_MS);
        }
        function stopWingFlapLoop(target) {
            if (wingFlapTimers[target]) clearInterval(wingFlapTimers[target]);
            wingFlapTimers[target] = null;
        }

        // 🚧 通常のタップ画面にも反映する。服については、既存の「衣装（きせかえタブ）」システムと
        // 見た目の適用先が重なるため、しばらくは「後から呼ばれた方が勝つ」形で共存させている
        // 🎩💨 叫んだ勢いで、帽子・顔パーツが吹っ飛んでいく（服だけは1枚絵の都合で諦めて、初期衣装に戻る）
        function flyOffKisekaeOverlays() {
            const dirs = { hat: { x: -70, y: -160, r: -150 }, face: { x: 80, y: -130, r: 170 } };
            ['hat', 'face'].forEach(cat => {
                const el = document.getElementById(`mochisuke-kisekae-${cat}`);
                if (!el || el.style.display === 'none') return;
                const d = dirs[cat];
                el.animate([
                    { transform: el.style.transform || 'none', opacity: 1, offset: 0 },
                    { transform: `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg)`, opacity: 0, offset: 1 },
                ], { duration: 950, easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)', fill: 'forwards' });
            });
        }
        // 通常に戻ったら、飛んでいった帽子・顔パーツを、ふわっと元の位置に着け直す
        function flyBackKisekaeOverlays() {
            const dirs = { hat: { x: -70, y: -160, r: -150 }, face: { x: 80, y: -130, r: 170 } };
            ['hat', 'face'].forEach(cat => {
                const el = document.getElementById(`mochisuke-kisekae-${cat}`);
                if (!el || el.style.display === 'none') return;
                const d = dirs[cat];
                const itemId = equippedKisekae[cat];
                const item = itemId ? KISEKAE_ITEMS[cat].find(i => i.id === itemId) : null;
                const restTransform = item ? `rotate(${item.rotation || 0}deg)` : 'none';
                el.animate([
                    { transform: `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg)`, opacity: 0, offset: 0 },
                    { transform: restTransform, opacity: 1, offset: 1 },
                ], { duration: 750, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)', fill: 'forwards' });
            });
        }

        function applyKisekaeToMainScreen() {
            const mainBtn = document.getElementById('mochisuke-btn');
            const mainFullbody = document.getElementById('mochisuke-fullbody');
            const mouthAnchor = document.getElementById('mochisuke-mouth-anchor');
            const fullbodyId = equippedKisekae.fullbody;

            if (fullbodyId) {
                // 全身装備中は、帽子・顔パーツ・通常の口パーツを隠し、全身イラストをもちすけの上に重ねて覆う
                // （もちすけ本体の画像がこの箱のサイズの土台になっているため、消すと箱ごと潰れてしまう）
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                mainFullbody.src = fbItem.img;
                mainFullbody.style.display = 'block';
                if (mouthAnchor) mouthAnchor.style.display = 'none';
                ['hat', 'face'].forEach(cat => { document.getElementById(`mochisuke-kisekae-${cat}`).style.display = 'none'; });
            } else {
                mainFullbody.style.display = 'none';
                if (mouthAnchor) mouthAnchor.style.display = 'block';
                const clothesItem = KISEKAE_ITEMS.clothes.find(i => i.id === equippedKisekae.clothes) || KISEKAE_ITEMS.clothes[0];
                mainBtn.src = clothesItem.img;

                // 🐛服のイラストによって、口の位置が微妙にずれるものがあるため、服ごとの指定（無ければ既定値）を反映する
                if (mouthAnchor) {
                    const mouthPos = clothesItem.mouthOverride || DEFAULT_MOUTH_POSITION;
                    mouthAnchor.style.top = mouthPos.top + '%';
                    mouthAnchor.style.left = mouthPos.left + '%';
                    mouthAnchor.style.width = mouthPos.width + '%';
                }

                ['hat', 'face'].forEach(cat => {
                    const mainImg = document.getElementById(`mochisuke-kisekae-${cat}`);
                    if (!mainImg) return;
                    const itemId = equippedKisekae[cat];
                    if (itemId) {
                        const item = KISEKAE_ITEMS[cat].find(i => i.id === itemId);
                        mainImg.src = item.img;
                        mainImg.style.display = 'block';
                        mainImg.style.top = item.top + '%';
                        mainImg.style.left = item.left + '%';
                        mainImg.style.width = item.width + '%';
                        mainImg.style.height = item.height + '%';
                        mainImg.style.transform = `rotate(${item.rotation || 0}deg)`;
                        if (cat === 'hat') mainImg.style.zIndex = '7'; // 帽子は、常にもちすけの手前
                    } else {
                        mainImg.style.display = 'none';
                    }
                });
            }
            updateKisekaeWingDisplay('main', fullbodyId ? null : equippedKisekae.back);
        }

        let kisekaeCurrentCategory = 'clothes';
        // カテゴリを開いて、名前順・Zの字並びで左右にアイテムを並べる
        function openKisekaeCategory(cat) {
            playAudioFile('audio/skill_tap.mp3');
            kisekaeCurrentCategory = cat;
            const sortedItems = [...KISEKAE_ITEMS[cat]].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            // 帽子・顔パーツは、一番左上に「外す」ボタンを置く（服は必ず何か着ている状態にするので対象外）
            const items = (cat === 'clothes') ? sortedItems : [{ id: null, name: '外す', isRemoveButton: true }, ...sortedItems];
            const owned = ownedKisekaeItems[cat] || [];

            const leftList = document.getElementById('kisekae-item-list-left');
            const rightList = document.getElementById('kisekae-item-list-right');
            leftList.innerHTML = ''; rightList.innerHTML = '';

            items.forEach((item, i) => {
                const cell = document.createElement('div');
                if (item.isRemoveButton) {
                    const isEquipped = previewKisekae[cat] == null;
                    cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); cursor:pointer;`;
                    cell.innerHTML = `<div style="font-size:1.8rem; color:#e57373; font-weight:900;">✕</div>`;
                    cell.onclick = () => equipKisekaeItem(cat, null);
                    (i % 2 === 0 ? leftList : rightList).appendChild(cell);
                    return;
                }
                const isOwned = owned.includes(item.id);
                const isEquipped = previewKisekae[cat] === item.id;
                cell.style.cssText = `width:100%; box-sizing:border-box; aspect-ratio:1; border-radius:12px; background:rgba(255,255,255,0.92); border:3px solid ${isEquipped ? '#e91e63' : 'transparent'}; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; box-shadow:0 2px 5px rgba(0,0,0,0.15); ${isOwned ? 'cursor:pointer;' : ''}`;
                const starStyle = item.star === 4
                    ? 'background:linear-gradient(90deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#9d4edd); -webkit-background-clip:text; background-clip:text; color:transparent;'
                    : 'color:#ffb300;';
                const starHtml = item.star ? `<div style="position:absolute; bottom:2px; left:0; right:0; text-align:center; font-size:0.62rem; letter-spacing:1px; text-shadow:0 1px 2px rgba(0,0,0,0.15); ${starStyle}">${'⭐'.repeat(item.star)}</div>` : '';
                const thumbImg = item.img || (item.leftFrames ? item.leftFrames[0] : '');
                cell.innerHTML = `<img src="${thumbImg}" alt="${item.name}" style="width:78%; height:78%; object-fit:contain; ${isOwned ? '' : 'filter:grayscale(1); opacity:0.5;'}">${starHtml}`;
                if (!isOwned) {
                    cell.insertAdjacentHTML('beforeend', `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🔒</div>`);
                } else {
                    cell.onclick = () => equipKisekaeItem(cat, item.id);
                }
                (i % 2 === 0 ? leftList : rightList).appendChild(cell);
            });

            ['hat', 'face', 'clothes', 'back', 'fullbody'].forEach(c => {
                document.getElementById(`kisekae-cat-btn-${c}`).style.boxShadow = (c === cat) ? '0 0 0 3px #ffd700, 0 3px 8px rgba(0,0,0,0.25)' : '0 3px 8px rgba(0,0,0,0.25)';
            });

            if (IS_DEV_MODE) renderKisekaeAdjustPanel(cat);
        }

        let kisekaeNameLabelTimeout = null;
        function showKisekaeItemNameLabel(name) {
            const label = document.getElementById('kisekae-item-name-label');
            if (!label) return;
            clearTimeout(kisekaeNameLabelTimeout);
            label.textContent = name;
            label.style.display = 'block';
            kisekaeNameLabelTimeout = setTimeout(() => { label.style.display = 'none'; }, 2200);
        }
        function equipKisekaeItem(cat, id) {
            if (cat === 'fullbody' && id) {
                // 全身を装着すると、帽子・顔パーツ・背中（翼）は自動的に外れる（服は保持したまま、全身解除時に元へ戻る）
                previewKisekae.hat = null;
                previewKisekae.face = null;
                previewKisekae.back = null;
            } else if ((cat === 'hat' || cat === 'face' || cat === 'back') && id && previewKisekae.fullbody) {
                // 全身装着中に帽子・顔パーツ・背中を選んだら、全身を自動的に外す
                previewKisekae.fullbody = null;
            }
            previewKisekae[cat] = id; // 「決定」を押すまでは、試着中の状態を更新するだけ
            renderKisekaeMochisuke();
            openKisekaeCategory(cat);
            const item = id ? KISEKAE_ITEMS[cat].find(i => i.id === id) : null;
            showKisekaeItemNameLabel(item ? item.name : '外す');
        }

        // 🎯「決定」ボタン：試着中の服装を、実際に確定して保存・タップ画面にも反映する
        function confirmKisekaeOutfit() {
            equippedKisekae = { ...previewKisekae };
            saveGame();
            applyKisekaeToMainScreen();
            const btn = document.getElementById('kisekae-confirm-btn');
            if (btn) {
                const original = btn.innerText;
                btn.innerText = '✅ 決定しました！';
                setTimeout(() => { btn.innerText = original; }, 1200);
            }
        }

        // 🛠️ 開発者用：帽子・顔パーツ・背中(翼)の位置・大きさ調整ツール（服・全身はフルボディ画像なので調整不要）
        let kisekaeAdjustMode = false;
        let kisekaeAdjustDragState = null;
        // 選択中の対象を解決する：通常のhat/faceか、backカテゴリの左右どちらの翼か
        function resolveKisekaeAdjustTarget() {
            const val = document.getElementById('kisekae-adjust-target').value;
            if (kisekaeCurrentCategory === 'back') {
                const [itemId, side, frameIdxStr] = val.split('__');
                const frameIdx = parseInt(frameIdxStr, 10);
                const item = KISEKAE_ITEMS.back.find(i => i.id === itemId);
                return {
                    item, side, frameIdx,
                    imgSrc: item ? (side === 'left' ? item.leftFrames[frameIdx] : item.rightFrames[frameIdx]) : '',
                    el: document.getElementById(side === 'left' ? 'kisekae-mochisuke-wing-left' : 'kisekae-mochisuke-wing-right'),
                };
            }
            const item = KISEKAE_ITEMS[kisekaeCurrentCategory].find(i => i.id === val);
            return {
                item, side: null, frameIdx: null,
                imgSrc: item ? item.img : '',
                el: document.getElementById(`kisekae-mochisuke-${kisekaeCurrentCategory}`),
            };
        }
        // 位置(top/left)の読み書き先と、大きさ(width/height)の読み書き先を返す。
        // backカテゴリだけ「位置はフレーム別・大きさは共通」なので、書き込み先オブジェクトが分かれる
        function getKisekaeAdjustRefs(resolved) {
            if (resolved.side) {
                const posArr = resolved.item[resolved.side + 'FramePos'];
                return { posObj: posArr[resolved.frameIdx], sizeObj: resolved.item };
            }
            return { posObj: resolved.item, sizeObj: resolved.item };
        }
        function getKisekaeAdjustTargetEl() {
            return resolveKisekaeAdjustTarget().el;
        }
        function renderKisekaeAdjustPanel(cat) {
            const panel = document.getElementById('kisekae-adjust-panel');
            if (cat === 'clothes' || cat === 'fullbody') { panel.style.display = 'none'; return; } // 服・全身は調整不要
            const select = document.getElementById('kisekae-adjust-target');
            if (cat === 'back') {
                const adjustableItems = KISEKAE_ITEMS.back.filter(i => i.locked);
                if (adjustableItems.length === 0) { panel.style.display = 'none'; return; }
                panel.style.display = 'block';
                const opts = [];
                adjustableItems.forEach(i => {
                    for (let f = 0; f < i.leftFrames.length; f++) opts.push(`<option value="${i.id}__left__${f}">${i.name}（左・${f + 1}枚目）</option>`);
                    for (let f = 0; f < i.rightFrames.length; f++) opts.push(`<option value="${i.id}__right__${f}">${i.name}（右・${f + 1}枚目）</option>`);
                });
                select.innerHTML = opts.join('');
                document.getElementById('kisekae-rotation-controls').style.display = 'none';
                updateKisekaeAdjustReadout();
                return;
            }
            const adjustableItems = KISEKAE_ITEMS[cat].filter(i => i.locked);
            if (adjustableItems.length === 0) { panel.style.display = 'none'; return; }
            panel.style.display = 'block';
            select.innerHTML = adjustableItems.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
            document.getElementById('kisekae-rotation-controls').style.display = (cat === 'face') ? 'block' : 'none';
            updateKisekaeAdjustReadout();
        }
        function toggleKisekaeAdjustMode() {
            kisekaeAdjustMode = !kisekaeAdjustMode;
            const btn = document.getElementById('kisekae-adjust-toggle-btn');
            const resolved = resolveKisekaeAdjustTarget();
            const target = resolved.el;
            if (kisekaeAdjustMode) {
                target.style.display = 'block'; // プレビューが無い状態でも調整できるよう、選択中のIDの画像を仮表示する
                if (resolved.item) {
                    const { posObj, sizeObj } = getKisekaeAdjustRefs(resolved);
                    target.src = resolved.imgSrc;
                    target.style.top = posObj.top + '%'; target.style.left = posObj.left + '%';
                    target.style.width = sizeObj.width + '%'; target.style.height = sizeObj.height + '%';
                    target.style.transform = `rotate(${posObj.rotation || 0}deg)`;
                }
                target.style.outline = '2px dashed #e91e63';
                target.style.zIndex = '50'; // 🐛修正：翼は普段もちすけより背面のため、調整モード中は一時的に最前面へ（操作できるように）
                btn.style.background = '#4caf50';
                setupKisekaeAdjustDrag();
                positionKisekaeHandles();
            } else {
                target.style.outline = '';
                ['kisekae-resize-handle-r', 'kisekae-resize-handle-b', 'kisekae-resize-handle-br'].forEach(id => document.getElementById(id).style.display = 'none');
                btn.style.background = '#e91e63';
                renderKisekaeMochisuke(); // 実際に装着中のものへ表示を戻す
            }
        }
        function onKisekaeAdjustTargetChange() {
            ['hat', 'face', 'clothes', 'fullbody'].forEach(c => { const el = document.getElementById(`kisekae-mochisuke-${c}`); if (el) el.style.outline = ''; });
            document.getElementById('kisekae-mochisuke-wing-left').style.outline = '';
            document.getElementById('kisekae-mochisuke-wing-right').style.outline = '';
            if (!kisekaeAdjustMode) { updateKisekaeAdjustReadout(); return; }
            const resolved = resolveKisekaeAdjustTarget();
            const target = resolved.el;
            if (resolved.item) {
                const { posObj, sizeObj } = getKisekaeAdjustRefs(resolved);
                target.src = resolved.imgSrc;
                target.style.top = posObj.top + '%'; target.style.left = posObj.left + '%';
                target.style.width = sizeObj.width + '%'; target.style.height = sizeObj.height + '%';
                target.style.transform = `rotate(${posObj.rotation || 0}deg)`;
            }
            target.style.outline = '2px dashed #e91e63';
            target.style.zIndex = '50';
            positionKisekaeHandles();
            updateKisekaeAdjustReadout();
        }
        function positionKisekaeHandles() {
            if (!kisekaeAdjustMode) return;
            const stage = document.getElementById('kisekae-stage');
            const target = getKisekaeAdjustTargetEl();
            const stageRect = stage.getBoundingClientRect();
            const tRect = target.getBoundingClientRect();
            const rightPct = ((tRect.right - stageRect.left) / stageRect.width) * 100;
            const bottomPct = ((tRect.bottom - stageRect.top) / stageRect.height) * 100;
            const midYPct = ((tRect.top + tRect.height / 2 - stageRect.top) / stageRect.height) * 100;
            const midXPct = ((tRect.left + tRect.width / 2 - stageRect.left) / stageRect.width) * 100;
            const hR = document.getElementById('kisekae-resize-handle-r'), hB = document.getElementById('kisekae-resize-handle-b'), hBr = document.getElementById('kisekae-resize-handle-br');
            [hR, hB, hBr].forEach(h => h.style.display = 'block');
            hR.style.left = rightPct + '%'; hR.style.top = midYPct + '%';
            hB.style.left = midXPct + '%'; hB.style.top = bottomPct + '%';
            hBr.style.left = rightPct + '%'; hBr.style.top = bottomPct + '%';
        }
        function setupKisekaeAdjustDrag() {
            const stage = document.getElementById('kisekae-stage');
            if (stage.dataset.dragSetup) return;
            stage.dataset.dragSetup = '1';
            const startDrag = (e, mode) => {
                if (!kisekaeAdjustMode) return;
                e.stopPropagation(); e.preventDefault();
                const target = getKisekaeAdjustTargetEl();
                try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
                kisekaeAdjustDragState = { startX: e.clientX, startY: e.clientY, target, mode };
            };
            stage.addEventListener('pointerdown', (e) => {
                if (!kisekaeAdjustMode) return;
                if (e.target.id === 'kisekae-resize-handle-r') return startDrag(e, 'width');
                if (e.target.id === 'kisekae-resize-handle-b') return startDrag(e, 'height');
                if (e.target.id === 'kisekae-resize-handle-br') return startDrag(e, 'both');
                const target = getKisekaeAdjustTargetEl();
                if (e.target !== target) return;
                startDrag(e, 'move');
            });
            stage.addEventListener('pointermove', (e) => {
                if (!kisekaeAdjustDragState || !kisekaeAdjustMode) return;
                e.stopPropagation();
                const refRect = document.getElementById('kisekae-mochisuke-wrap').getBoundingClientRect();
                const dxPct = ((e.clientX - kisekaeAdjustDragState.startX) / refRect.width) * 100;
                const dyPct = ((e.clientY - kisekaeAdjustDragState.startY) / refRect.height) * 100;
                const t = kisekaeAdjustDragState.target, mode = kisekaeAdjustDragState.mode;
                if (mode === 'move') {
                    t.style.top = (parseFloat(t.style.top) + dyPct) + '%';
                    t.style.left = (parseFloat(t.style.left) + dxPct) + '%';
                } else {
                    if (mode === 'width' || mode === 'both') t.style.width = Math.max(2, parseFloat(t.style.width) + dxPct) + '%';
                    if (mode === 'height' || mode === 'both') t.style.height = Math.max(2, parseFloat(t.style.height) + dyPct) + '%';
                }
                kisekaeAdjustDragState.startX = e.clientX; kisekaeAdjustDragState.startY = e.clientY;
                // ドラッグした内容を、元データにもその場で反映しておく（アイテムを切り替えても・コピーしても消えないように）
                const resolved = resolveKisekaeAdjustTarget();
                if (resolved.item) {
                    const { posObj, sizeObj } = getKisekaeAdjustRefs(resolved);
                    posObj.top = parseFloat(t.style.top);
                    posObj.left = parseFloat(t.style.left);
                    sizeObj.width = parseFloat(t.style.width);
                    sizeObj.height = parseFloat(t.style.height);
                }
                positionKisekaeHandles();
                updateKisekaeAdjustReadout();
            });
            stage.addEventListener('pointerup', () => { kisekaeAdjustDragState = null; });
            stage.addEventListener('pointercancel', () => { kisekaeAdjustDragState = null; });
        }
        // 🔄 顔パーツだけ、回転（傾き）も調整できる
        function adjustKisekaeFaceRotation(delta) {
            const val = document.getElementById('kisekae-adjust-target').value;
            const item = KISEKAE_ITEMS.face.find(i => i.id === val);
            if (!item) return;
            item.rotation = (item.rotation || 0) + delta;
            const target = getKisekaeAdjustTargetEl();
            target.style.transform = `rotate(${item.rotation}deg)`;
            updateKisekaeAdjustReadout();
        }
        function updateKisekaeAdjustReadout() {
            const resolved = resolveKisekaeAdjustTarget();
            const target = resolved.el;
            const el = document.getElementById('kisekae-adjust-readout');
            if (!target || !el) return;
            let text = `top:${target.style.top}; left:${target.style.left}; width:${target.style.width}; height:${target.style.height};`;
            if (kisekaeCurrentCategory === 'face') {
                const item = resolved.item;
                text += `\n回転:${item ? (item.rotation || 0) : 0}deg;`;
            }
            el.textContent = text;
        }
        function copyAllKisekaeCoords() {
            const lines = [];
            ['hat', 'face'].forEach(cat => {
                const adjustable = KISEKAE_ITEMS[cat].filter(i => i.locked);
                if (adjustable.length === 0) return;
                lines.push(`【${KISEKAE_CATEGORY_LABELS[cat]}】`);
                adjustable.forEach(item => {
                    let line = `${item.name}(${item.id}): top:${item.top}%; left:${item.left}%; width:${item.width}%; height:${item.height}%;`;
                    if (cat === 'face') line += ` rotation:${item.rotation || 0}deg;`;
                    lines.push(line);
                });
            });
            const backAdjustable = KISEKAE_ITEMS.back.filter(i => i.locked);
            if (backAdjustable.length > 0) {
                lines.push(`【背中】`);
                backAdjustable.forEach(item => {
                    lines.push(`${item.name} 共通の大きさ: width:${item.width}%; height:${item.height}%;`);
                    item.leftFramePos.forEach((pos, i) => lines.push(`${item.name}（左・${i + 1}枚目）: top:${pos.top}%; left:${pos.left}%;`));
                    item.rightFramePos.forEach((pos, i) => lines.push(`${item.name}（右・${i + 1}枚目）: top:${pos.top}%; left:${pos.left}%;`));
                });
            }
            const text = lines.join('\n');
            const textarea = document.getElementById('kisekae-copy-all-textarea');
            textarea.value = text;
            textarea.style.display = 'block';
            textarea.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        }

        function openOmiyageCollection() {
            const grid = document.getElementById('omiyage-collection-grid');
            grid.innerHTML = '';
            const owned = stages.map((s, i) => ({ s, i, lv: purchasedItems[i] || 0 })).filter(o => o.lv > 0 && o.s.itemImg);
            if (owned.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#999; font-size:0.8rem; padding:20px;">まだ持っているおみやげがありません</div>`;
            } else {
                owned.forEach(({ s, i, lv }) => {
                    const cell = document.createElement('div');
                    cell.style.cssText = 'text-align:center; cursor:pointer; padding:6px; border-radius:10px; background:#fff8ec; border:1px solid #f0d5b5; box-sizing:border-box; min-width:0;';
                    cell.innerHTML = `<img src="${s.itemImg}" alt="${s.item}" style="width:100%; aspect-ratio:1; object-fit:contain;">
                        <div style="font-size:0.62rem; font-weight:bold; color:#5d4037; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.item}</div>
                        <div style="font-size:0.58rem; color:#ff9800;">×${lv}</div>`;
                    cell.onclick = () => showOmiyageFeedConfirm(i);
                    grid.appendChild(cell);
                });
            }
            openModal('omiyage-collection-modal');
        }

        function showOmiyageFeedConfirm(idx) {
            resetFeedCountIfNewDay();
            const stage = stages[idx];
            const lv = purchasedItems[idx] || 0;
            const remaining = FEED_DAILY_LIMIT - feedPlaysUsedToday;
            document.getElementById('feed-confirm-img').src = stage.itemImg;
            document.getElementById('feed-confirm-name').innerText = `${stage.item}（${lv}個持っている）`;
            const btn = document.getElementById('feed-confirm-btn');
            if (remaining <= 0) {
                document.getElementById('feed-confirm-desc').innerText = `${stage.name}のお土産。もちすけはお腹いっぱいみたい…本日はもうあげられません（明日また！）`;
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.onclick = null;
            } else {
                document.getElementById('feed-confirm-desc').innerText = `${stage.name}のお土産。もちすけにあげると喜んで食べてくれる。（本日あと${remaining}回）`;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.onclick = () => placeFeedIconNearMochisuke(idx);
            }
            closeModal('omiyage-collection-modal');
            openModal('omiyage-feed-confirm-modal');
        }

        // 🍴 もちすけにあげる：おみやげを自由にドラッグして、もちすけの上で離すと食べてくれる
        function feedMochisuke(idx) {
            const stage = stages[idx];
            if (!stage) return;

            clearTimeout(feedTeaseTimer);
            if (isScreamActive) revertScreamFace(); // 叫び中に給餌で中断された場合も、確実に元の姿へ戻す
            feedTeaseLevel = 0;

            feedBuffActiveUntil = Date.now() + FEED_BUFF_DURATION_MS;
            feedPlaysUsedToday++;
            saveGame();
            startFeedBuffIndicator();

            const mochiRect = mochiBtnElement.getBoundingClientRect();
            playAudioFile('audio/mochisuke/mochi_eat.mp3');
            vibrate([20, 40, 20]);
            screenFlash('#ff9800', 0.3);
            screenShake('small');
            mochiBtnElement.animate([
                { transform: 'scale(1, 1) rotate(0deg)' },
                { transform: 'scale(1.25, 0.8) rotate(-4deg)', offset: 0.25 },
                { transform: 'scale(0.85, 1.2) rotate(4deg)', offset: 0.5 },
                { transform: 'scale(1.1, 0.92) rotate(-2deg)', offset: 0.75 },
                { transform: 'scale(1, 1) rotate(0deg)' }
            ], { duration: 500, easing: 'ease-in-out' });
            createFloatingText(mochiRect.left + mochiRect.width / 2, mochiRect.top + mochiRect.height / 3, `${stage.item}おいしい〜！`, "#ff9800", "1.1rem");
            setTimeout(() => {
                createFloatingText(mochiRect.left + mochiRect.width / 2, mochiRect.top + mochiRect.height / 2.2, `⚡タップ力2倍！`, "#e91e63", "1.3rem");
            }, 300);
            showMochiComment(pickRandom(dialogueData.feedComments).replace('○○', stage.item));
            for (let i = 0; i < 16; i++) {
                createParticle(mochiRect.left + mochiRect.width / 2 + (Math.random() - 0.5) * 90, mochiRect.top + mochiRect.height / 2 + (Math.random() - 0.5) * 90, true);
            }
        }

        // ⚡ タップ力2倍中のバフ表示を、残り秒数のカウントダウン付きで出す
        let mapZoom = 1;
        let mapPanX = 0, mapPanY = 0;
        let mapDragging = false, mapDragStartX = 0, mapDragStartY = 0, mapPanStartX = 0, mapPanStartY = 0;
        let mapPinchStartDist = 0, mapPinchStartZoom = 1;
        const MAP_ZOOM_MIN = 1, MAP_ZOOM_MAX = 4;

        function openMap() {
            lazyLoadImage('map-illustration-img');
            const pinsLayer = document.getElementById('map-pins-layer');
            pinsLayer.innerHTML = "";
            stages.forEach((stage, i) => {
                if (stage.pinX == null || stage.pinY == null) return; // 座標未設定の県は非表示（エラーにしない）
                const isCurrent = selectedStageIndex === i;
                const isLocked = i > currentStageIndex;
                const pin = document.createElement('div');
                pin.className = 'map-pin' + (isCurrent ? ' map-pin-current' : '') + (isLocked ? ' map-pin-locked' : '');
                pin.style.left = stage.pinX + '%';
                pin.style.top = stage.pinY + '%';
                // イラストに元々県名が書かれているので、ピンはアイコンのみ（文字ラベルは出さない）
                const icon = isLocked ? '❔' : (isCurrent ? '📍' : '🔸');
                pin.innerHTML = `<div class="map-pin-icon">${icon}</div>`;
                if (!isLocked) {
                    pin.addEventListener('click', (e) => { e.stopPropagation(); onMapPinTap(i); });
                }
                pinsLayer.appendChild(pin);
            });
            mapZoomReset();
            playAudioFile('audio/page_turn.mp3'); // 絵日記をめくる音を流用（ショップなどとは違う専用の音にする）
            openModal('map-modal', true);
        }

        function closeMapModal() {
            closeModal('map-modal');
        }

        function onMapPinTap(idx) {
            const stage = stages[idx];
            if (selectedStageIndex === idx) return; // すでに滞在中
            document.getElementById('map-confirm-text').innerText = `${stage.name}に移動しますか？`;
            const overlay = document.getElementById('map-confirm-overlay');
            overlay.style.display = 'flex';
            const yesBtn = document.getElementById('map-confirm-yes');
            const noBtn = document.getElementById('map-confirm-no');
            const cleanup = () => {
                overlay.style.display = 'none';
                yesBtn.onclick = null; noBtn.onclick = null;
            };
            yesBtn.onclick = () => { cleanup(); mapMoveTo(idx); };
            noBtn.onclick = () => { cleanup(); };
        }

        function mapMoveTo(idx) {
            closeModal('map-modal');
            triggerAreaTransition(stages[idx].bg, () => {
                selectedStageIndex = idx; updateDisplay(); saveGame();
                const name = stages[idx].name;
                const prefPool = dialogueData.prefectureComments[name];
                showMochiComment(prefPool ? `${name}到着！${pickRandom(prefPool)}` : `${name}到着！ここはどんな場所やろな？`);
            });
        }

        // --- 拡大縮小・ドラッグ操作 ---
        function applyMapTransform() {
            const canvas = document.getElementById('map-canvas');
            if (canvas) canvas.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
        }

        function clampMapPan() {
            const viewport = document.getElementById('map-viewport');
            const img = document.getElementById('map-illustration-img');
            if (!viewport || !img) return;
            const vw = viewport.clientWidth, vh = viewport.clientHeight;
            const cw = img.clientWidth * mapZoom, ch = img.clientHeight * mapZoom;
            const minX = Math.min(0, vw - cw), minY = Math.min(0, vh - ch);
            mapPanX = Math.max(minX, Math.min(0, mapPanX));
            mapPanY = Math.max(minY, Math.min(0, mapPanY));
        }

        // viewport要素基準のローカル座標（クライアント座標→viewport左上を原点とした座標）に変換
        function getMapFocalPoint(clientX, clientY) {
            const viewport = document.getElementById('map-viewport');
            const rect = viewport.getBoundingClientRect();
            return { x: clientX - rect.left, y: clientY - rect.top };
        }

        // (fx, fy)＝viewport基準の座標を中心に拡大縮小する（その地点の絵柄が画面上で動かないようにpanを調整）
        function zoomMapToward(newZoomRaw, fx, fy) {
            const newZoom = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, newZoomRaw));
            const localX = (fx - mapPanX) / mapZoom;
            const localY = (fy - mapPanY) / mapZoom;
            mapPanX = fx - localX * newZoom;
            mapPanY = fy - localY * newZoom;
            mapZoom = newZoom;
            clampMapPan();
            applyMapTransform();
        }

        // ＋／－ボタンは画面中央を基準に拡大縮小する
        function mapZoomBy(factor) {
            const viewport = document.getElementById('map-viewport');
            zoomMapToward(mapZoom * factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
        }

        function mapZoomReset() {
            mapZoom = 1; mapPanX = 0; mapPanY = 0;
            applyMapTransform();
        }

        function initMapInteractions() {
            const viewport = document.getElementById('map-viewport');
            if (!viewport || viewport.dataset.bound) return;
            viewport.dataset.bound = '1';

            viewport.addEventListener('pointerdown', (e) => {
                mapDragging = true;
                mapDragStartX = e.clientX; mapDragStartY = e.clientY;
                mapPanStartX = mapPanX; mapPanStartY = mapPanY;
            });
            viewport.addEventListener('pointermove', (e) => {
                if (!mapDragging) return;
                mapPanX = mapPanStartX + (e.clientX - mapDragStartX);
                mapPanY = mapPanStartY + (e.clientY - mapDragStartY);
                clampMapPan();
                applyMapTransform();
            });
            const endDrag = () => { mapDragging = false; };
            viewport.addEventListener('pointerup', endDrag);
            viewport.addEventListener('pointerleave', endDrag);
            viewport.addEventListener('pointercancel', endDrag);

            // ピンチズーム：指を置いた位置(2本指の中点)を中心に拡大縮小する
            let mapPinchFocalX = 0, mapPinchFocalY = 0;
            viewport.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    mapDragging = false;
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    mapPinchStartDist = Math.hypot(dx, dy);
                    mapPinchStartZoom = mapZoom;
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    const fp = getMapFocalPoint(midX, midY);
                    mapPinchFocalX = fp.x; mapPinchFocalY = fp.y;
                }
            }, { passive: true });
            viewport.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const dist = Math.hypot(dx, dy);
                    zoomMapToward(mapPinchStartZoom * (dist / mapPinchStartDist), mapPinchFocalX, mapPinchFocalY);
                }
            }, { passive: false });
        }

        function toggleStampDebug() {
            stampDebugMode = !stampDebugMode;
            if (stampDebugMode) {
                stampDebugInterval = setInterval(updateStampDebugReadout, 300);
                updateStampDebugReadout();
            } else {
                clearInterval(stampDebugInterval);
                document.getElementById('stamp-debug-readout').textContent = '';
            }
        }
        function updateStampDebugReadout() {
            const el = document.getElementById('stamp-debug-readout');
            if (!el) return;
            const stage = stages[currentStageIndex];
            const btn = document.getElementById('stamp-press-btn');
            el.textContent =
`currentStageIndex: ${currentStageIndex} (${stage ? stage.name : '?'})
selectedStageIndex: ${selectedStageIndex}
currentStageProgress: ${currentStageProgress}
distance(必要量): ${stage ? stage.distance : '?'}
判定(進捗>=必要量): ${stage ? (currentStageProgress >= stage.distance) : '?'}
stageArrivalTime経過: ${((Date.now() - stageArrivalTime) / 1000).toFixed(1)}秒
isPendingStampMoment: ${isPendingStampMoment}
diaryPageIndex: ${diaryPageIndex}
collectedStamps[現在]: ${!!collectedStamps[currentStageIndex]}
ボタンdisplay: ${btn ? btn.style.display : '?'}`;
        }

        let lastScoreFormatted = '';
        // もちの数表示を1文字ずつ<span>に分けて描画し、前回と値が違う文字だけポンっと弾ませる
        // （右詰めで比較するので、桁が増えて全体がズレても「実際に変わった桁」だけを正しく判定できる）
        function renderScoreDigits(container, newText, oldText) {
            // Array.from()でUnicodeのコードポイント単位に分割する。
            // 単純な文字列インデックス(newText[j])だと絵文字(🔥など)がサロゲートペアで
            // 2つに分断され、それぞれが壊れた文字(□□)として表示されてしまうため。
            const newChars = Array.from(newText);
            const oldChars = Array.from(oldText);
            const maxLen = Math.max(oldChars.length, newChars.length);
            const oldPadded = new Array(maxLen - oldChars.length).fill('\u0000').concat(oldChars);
            const newPadded = new Array(maxLen - newChars.length).fill('\u0000').concat(newChars);
            const offset = maxLen - newChars.length;
            let html = '';
            for (let j = 0; j < newChars.length; j++) {
                const ch = newChars[j] === ' ' ? '&nbsp;' : newChars[j];
                const changed = oldPadded[offset + j] !== newPadded[offset + j];
                html += changed ? `<span class="digit-pop">${ch}</span>` : `<span>${ch}</span>`;
            }
            container.innerHTML = html;
        }

        // 💡「次のおすすめアクション」判定：初心者が迷わないよう、状況に応じて1箇所だけハイライトする
        let lastRecommendCheckTime = 0;
        function getRecommendedActionTargetId() {
            // ① 今いる県のおみやげをまだ買っていない、かつ購入できる資金がある → ショップへ
            const stage = stages[selectedStageIndex];
            const curLv = purchasedItems[selectedStageIndex] || 0;
            if (curLv === 0 && stage && score >= getOmiyagePrice(stage, 0)) {
                return 'nav-btn-move';
            }
            // ② スキルを1つも取得していない、かつ一番安いスキルが買える資金がある → ショップへ
            const anySkillUnlocked = Object.values(skills).some(s => s.lv > 0);
            if (!anySkillUnlocked) {
                const cheapestUnlockPrice = Math.min(...Object.values(skills).map(s => s.unlockPrice || Infinity));
                if (score >= cheapestUnlockPrice) return 'nav-btn-move';
            }
            // ③ 使用可能（クールタイム明け）なスキルがある → そのスキルボタンへ
            const readyEntry = Object.entries(skills).find(([k, s]) => k !== 'hissatsu' && s.lv > 0 && s.currentCd <= 0 && s.activeTimer <= 0);
            if (readyEntry) return 'btn-' + readyEntry[0];
            // ④ 必殺技が使用可能 → 必殺技ボタンへ
            if (skills.hissatsu.lv > 0 && skills.hissatsu.currentCd <= 0 && skills.hissatsu.activeTimer <= 0) return 'btn-hissatsu';
            // ⑤ 新しく解放されて、まだ見ていない（遊んでいない）ミニゲームがある → ミニゲームへ
            if (hasNewlyUnlockedMinigame()) return 'nav-btn-move';
            // 特に無ければハイライトしない
            return null;
        }
        function updateRecommendedActionHighlight() {
            if (isTutorialActive) return; // チュートリアル中は、こちらの自動ハイライトは出さない（チュートリアル自身のハイライトとぶつかるため）
            const now = Date.now();
            if (now - lastRecommendCheckTime < 1000) return; // 連打のたびに毎回判定しなくていいよう、1秒に1回だけ再計算
            lastRecommendCheckTime = now;
            document.querySelectorAll('.recommended-glow').forEach(el => el.classList.remove('recommended-glow'));
            const targetId = getRecommendedActionTargetId();
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) el.classList.add('recommended-glow');
            }
        }

        // 新しく解放されて、まだ一度も遊んでいないミニゲームがあるか判定
        function hasNewlyPurchasableSkill() {
            return Object.values(skills).some(s => s.lv === 0 && currentStageIndex >= s.unlockStage && score >= s.unlockPrice);
        }
        // 未購入(lv===0)で、解放済み(訪問済み)かつ購入できるおみやげがあるか判定（レベルアップは対象外）
        function hasNewlyPurchasableOmiyage() {
            for (let i = 0; i <= currentStageIndex; i++) {
                const lv = purchasedItems[i] || 0;
                if (lv === 0 && score >= getOmiyagePrice(stages[i], 0)) return true;
            }
            return false;
        }
        function updateDisplay() {
            updateRecommendedActionHighlight();
            const prestigeBtn = document.getElementById('main-prestige-btn');
            if (prestigeBtn) prestigeBtn.style.display = canPrestige() ? 'block' : 'none';
            const scoreFormatted = formatMochi(score) + " もち";
            const scoreEl = document.getElementById('score-text');
            const fullText = isFever ? `🔥 5倍中 (${feverTimeLeft}s) ${scoreFormatted}` : scoreFormatted;
            // もちの数が実際に増えた瞬間だけ、変化した桁だけがポンっと弾む演出を出す（伸びていく実感を強化）
            if (fullText !== lastScoreFormatted) {
                renderScoreDigits(scoreEl, fullText, lastScoreFormatted);
                lastScoreFormatted = fullText;
            }
            document.getElementById('current-location-text').innerText = stages[selectedStageIndex].name;
            document.getElementById('mps-display').innerText = `↗ 自動増加: ${formatMochi(getMps())} もち/秒`;
            
            // 【修正】関数を正しく実行し、カンマ区切りで表示
            document.getElementById('tap-power-display').innerText = `👆 タップ力: +${formatMochi(getTapPower())}`;

            const distText = document.getElementById('distance-text');
            const progressBar = document.getElementById('progress-bar');
            const journeyText = document.getElementById('journey-progress-text');
            const isFullyCleared = currentStageIndex === stages.length - 1 && currentStageProgress >= stages[currentStageIndex].distance;
            if (journeyText) journeyText.innerHTML = `${isFullyCleared ? stages.length : currentStageIndex}/${stages.length}県<br>制覇`;
            if (selectedStageIndex < currentStageIndex) { distText.innerText = "このエリアは踏破済みです"; progressBar.style.width = "100%"; }
            else if (isFullyCleared) { distText.innerText = "🎉 祝・日本縦断すべてのエリアを制覇完了！！"; progressBar.style.width = "100%"; }
            else {
                const remaining = Math.ceil(stages[currentStageIndex].distance - currentStageProgress);
                distText.innerText = `次のエリアまで : ${formatMochi(remaining)} もちkcal`;
                let pct = Math.max(0, Math.min(100, (currentStageProgress / stages[currentStageIndex].distance) * 100));
                progressBar.style.width = pct + "%";
            }
        }

        // ===================================================================
        // 🎮 ミニゲームセンター：共通ロジック
        // ===================================================================
        let currentRankingTab = 'score';

        function closeRanking() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('ranking-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function toggleRankingHelpOverlay() {
            const overlay = document.getElementById('ranking-help-overlay');
            if (overlay) overlay.style.display = (overlay.style.display === 'block') ? 'none' : 'block';
        }

        function switchRankingTab(tab) {
            currentRankingTab = tab;
            document.getElementById('rank-tab-score').classList.toggle('active', tab === 'score');
            document.getElementById('rank-tab-taps').classList.toggle('active', tab === 'taps');
            document.getElementById('rank-tab-prestige').classList.toggle('active', tab === 'prestige');
            renderRankingList();
        }

        async function openRanking() {
            openModal('ranking-modal');
            await renderRankingList();
        }

        // 順位の見た目（1〜3位は特別扱い）
        function rankNumberStyle(rank) {
            if (rank === 1) return { bg: 'linear-gradient(135deg,#ffd700,#ffb300)', color: '#5d4037' };
            if (rank === 2) return { bg: 'linear-gradient(135deg,#e0e0e0,#b0bec5)', color: '#5d4037' };
            if (rank === 3) return { bg: 'linear-gradient(135deg,#d7a06e,#b5651d)', color: '#fff' };
            return { bg: '#fff', color: '#8d6e63' };
        }
        // そのプレイヤーの装着中の服・帽子・顔パーツを、小さいもちすけとして重ねて表示するHTMLを作る
        function renderRankOutfitPreviewHtml(outfit) {
            const clothesItem = (outfit && KISEKAE_ITEMS.clothes.find(i => i.id === outfit.clothes)) || KISEKAE_ITEMS.clothes[0];
            let html = `<img src="${clothesItem.img}" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain;">`;
            ['hat', 'face'].forEach(cat => {
                const itemId = outfit && outfit[cat];
                const item = itemId ? KISEKAE_ITEMS[cat].find(i => i.id === itemId) : null;
                if (!item) return;
                html += `<img src="${item.img}" alt="" style="position:absolute; top:${item.top}%; left:${item.left}%; width:${item.width}%; height:${item.height}%; transform:rotate(${item.rotation || 0}deg);">`;
            });
            return html;
        }
        async function renderRankingList() {
            const listContainer = document.getElementById('ranking-list');
            listContainer.innerHTML = `<div style="text-align:center; color:#aaa; padding:20px;">読み込み中...</div>`;

            const tab = currentRankingTab; // 'score' | 'taps' | 'prestige'
            const ready = window.isRankingReady && window.isRankingReady();
            const fetchFn = tab === 'taps' ? window.fetchTapRankingList : tab === 'prestige' ? window.fetchPrestigeRankingList : window.fetchRankingList;
            let realList = ready ? await fetchFn() : null;

            const unit = tab === 'taps' ? 'タップ' : tab === 'prestige' ? '回' : 'もち';
            const myValue = tab === 'taps' ? totalTapsCount : tab === 'prestige' ? prestigeCount : score;
            const formatValue = (v) => tab === 'score' ? formatMochi(v) : Math.floor(v).toLocaleString();
            const getValue = (p) => tab === 'taps' ? (p.totalTaps || 0) : tab === 'prestige' ? (p.prestigeCount || 0) : (p.score || 0);

            if (!realList) {
                listContainer.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.8rem; padding:10px;">ランキングサーバーに接続できませんでした。<br>あなたの現在の${unit}数だけ表示しています。</div>`;
                const item = document.createElement('div'); item.className = "list-item"; item.style.background = "#fff9c4";
                item.innerHTML = `<span>${escapeHtml(playerName)}（自分）</span><strong>${formatValue(myValue)} ${unit}</strong>`;
                listContainer.appendChild(item);
                return;
            }

            // 自分の記録がTOP20に無ければ末尾に追加表示する（uid一致で判定するので、
            // オートセーブ前後でスコアが少しズレていても二重表示にはならない）
            const alreadyIn = realList.some(p => p.isMe);
            const combined = realList.map(p => ({ ...p }));
            if (!alreadyIn) combined.push({ name: playerName, score: Math.floor(score), totalTaps: totalTapsCount, prestigeCount: prestigeCount, outfit: equippedKisekae, isMe: true });
            else {
                // 自分の分だけ表示値を最新のものに更新（サーバー側は最大10秒遅れているため）
                const mine = combined.find(p => p.isMe);
                if (mine) { mine.score = Math.floor(score); mine.totalTaps = totalTapsCount; mine.prestigeCount = prestigeCount; mine.outfit = equippedKisekae; }
            }
            combined.sort((a, b) => getValue(b) - getValue(a));

            listContainer.innerHTML = "";
            combined.forEach((player, index) => {
                const rank = index + 1;
                const rs = rankNumberStyle(rank);
                const row = document.createElement('div');
                row.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px 8px; margin-bottom:6px; border-radius:12px; background:${player.isMe ? '#fff9c4' : '#fff'}; box-shadow:0 1px 4px rgba(0,0,0,0.08);`;
                row.innerHTML = `
                    <div style="flex-shrink:0; width:34px; height:34px; border-radius:50%; background:${rs.bg}; color:${rs.color}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.85rem;">${rank}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.78rem; color:#5d4037; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(player.name)}${player.isMe ? '（自分）' : ''}</div>
                        <hr style="border:none; border-top:1px solid #e0d5c5; margin:3px 0;">
                        <div style="font-size:1.05rem; color:#e91e63; font-weight:900;">${formatValue(getValue(player))} ${unit}</div>
                    </div>
                    <div style="flex-shrink:0; position:relative; width:46px; height:46px;">${renderRankOutfitPreviewHtml(player.outfit)}</div>
                `;
                listContainer.appendChild(row);
            });
        }

        // 定期メインループ（100ms周期で自動加算＆スキル秒数減算を一元管理）
        let diaryPageIndex = 0;
        function openDiary() {
            diaryPageIndex = selectedStageIndex;
            diaryShowingBack = false;
            document.getElementById('diary-front-content').style.display = 'block';
            document.getElementById('diary-back-content').style.display = 'none';
            renderDiaryPage();
            openModal('diary-modal');
        }
        let diaryShowingBack = false;
        function renderDiaryPage() {
            const stage = stages[diaryPageIndex]; const paper = document.getElementById('diary-paper-element');
            paper.classList.remove('page-animate'); void paper.offsetWidth; paper.classList.add('page-animate');
            const isPurchased = (purchasedItems[diaryPageIndex] || 0) > 0;

            // 表面：メインの絵日記イラストと、旅の本文
            document.getElementById('diary-img-element').src = stage.diaryImg;
            document.getElementById('diary-title-element').innerText = `${stage.name}編`;
            document.getElementById('diary-text-element').innerText = stage.diary;

            // 裏面：スタンプと、おみやげイラスト＋名前
            const stampMark = document.getElementById('diary-stamp-mark');
            if (collectedStamps[diaryPageIndex]) {
                stampMark.innerText = `${stage.name}\n到達記念`;
                stampMark.style.opacity = '0.88';
                stampMark.style.borderStyle = 'solid';
            } else {
                stampMark.innerText = '未到達';
                stampMark.style.opacity = '0.35';
                stampMark.style.borderStyle = 'dashed';
            }
            const thumbBackEl = document.getElementById('diary-item-thumb-back');
            thumbBackEl.src = isPurchased && stage.itemImg ? stage.itemImg : 'ui_images/present.webp';
            thumbBackEl.style.opacity = isPurchased ? '1' : '0.35';
            document.getElementById('diary-item-name-back').innerText = isPurchased
                ? `🛍️ ${stage.item} (Lv.${purchasedItems[diaryPageIndex]})`
                : '🛍️ アイテム: 未購入';

            document.getElementById('diary-footer-element').innerText = `枚数: ${diaryPageIndex + 1} / ${currentStageIndex + 1}`;
            document.getElementById('prev-page-btn').disabled = (diaryPageIndex === 0);
            document.getElementById('next-page-btn').disabled = (diaryPageIndex === currentStageIndex || diaryPageIndex === stages.length - 1);
        }
        function flipDiaryPage(showBack) {
            diaryShowingBack = showBack;
            document.getElementById('diary-front-content').style.display = showBack ? 'none' : 'block';
            document.getElementById('diary-back-content').style.display = showBack ? 'block' : 'none';
            playAudioFile('audio/page_turn.mp3', 1.0);
        }
        function nextPage() { if (diaryPageIndex < currentStageIndex && diaryPageIndex < stages.length - 1) { diaryPageIndex++; flipDiaryPage(false); renderDiaryPage(); } }
        function prevPage() { if (diaryPageIndex > 0) { diaryPageIndex--; flipDiaryPage(false); renderDiaryPage(); } }
