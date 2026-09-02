        function getOmiyagePriceMultiplier() { return 1 - prestigeShopLv.omiyagePriceDiscount * 0.02; } // 価格そのものを割引
        function getOmiyagePriceCurveBase() { return 1.5 - prestigeShopLv.omiyagePriceCurve * 0.01; }   // レベルごとの値上がり倍率
        function getOmiyagePrice(stage, currentLv) {
            return Math.floor(stage.price * Math.pow(getOmiyagePriceCurveBase(), currentLv) * getOmiyagePriceMultiplier());
        }
        let purchasedItems = {};      
        let purchasedClothes = { normal: true };
        let equippedClotheId = "normal";
        let currentShopTab = "omiyage"; 

        function equipClothe(id) {
            equippedClotheId = id;
            resetMochiFilter();
            saveGame(); updateDisplay();
        }

        // 起動時に読み込まなくていい大きな画像（マップ・おみやげ屋の背景）は、実際に開いた時だけ読み込む
        function openShop() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3'); // 県移動の時と同じ、移動音
            overlay.classList.add('fade-black');
            setTimeout(() => {
                lazyLoadImage('omiyage-shelf-img');
                openModal('shop-modal');
                switchShopTab(currentShopTab);
                updateShopTabHighlight();
                playBgmLoop('audio/bgm_shop.mp3'); // ショップ専用BGMに切り替え
                if (IS_DEV_MODE) document.getElementById('backbtn-adjust-panel').style.display = 'block';
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        function closeShop() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('shop-modal');
                playBgmLoop('audio/bgm.mp3'); // 通常のBGMに戻す
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }

        // ✖ボタンを廃止した代わりに、棚の背景(商品以外の場所)をタップすると詳細パネルを閉じるようにする
        document.addEventListener('DOMContentLoaded', () => {
            const shelfImg = document.getElementById('omiyage-shelf-img');
            if (shelfImg) shelfImg.addEventListener('click', () => { if (omiyageSelectedIdx != null) closeOmiyageDetail(); });
        });
        // お土産イラスト（stage.itemImg）表示用ヘルパー。未整備の県は🎁の絵文字にフォールバックする
        function getItemThumbHtml(stage, size) {
            size = size || 48;
            if (stage.itemImg) {
                return `<img class="item-thumb" src="${stage.itemImg}" style="width:${size}px; height:${size}px;" alt="${stage.item}">`;
            }
            return `<div class="item-thumb" style="width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; font-size:${Math.floor(size * 0.5)}px; background:#fff8ec;">🎁</div>`;
        }

        function switchShopTab(tab) {
            currentShopTab = tab;
            updateShopTabHighlight();
            document.getElementById('shop-tab-omiyage').classList.toggle('tab-active', tab === 'omiyage');
            document.getElementById('shop-tab-kisekae').classList.toggle('tab-active', tab === 'kisekae');
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

        // 🎰 ガチャタブ：管理者用URL(?dev=...)からでないと、まだ「近日公開」の案内だけ表示する
        // 🎰 ガチャの演出本体：①3段階の回転（だんだん速く・揺れも強く）→②カプセル排出→③パカッと開いて中身が出る
        // 🎨 レア度ごとのカプセルの色（実際のイラストが無くても、同じ画像に色フィルターをかけて表現する）
        let currentGachaRarity = null; // この回のレア度（色分けに使う）
        function pickGachaRarity() {
            const total = GACHA_RARITIES.reduce((s, r) => s + r.weight, 0);
            let roll = Math.random() * total;
            for (const r of GACHA_RARITIES) {
                if (roll < r.weight) return r;
                roll -= r.weight;
            }
            return GACHA_RARITIES[0];
        }

        // 🎰 3段階の回転演出（1連・10連で共通）：Promiseを返し、終わったら呼び出し側が次の処理に進める
        function playGachaCrankSequence() {
            const crank = document.getElementById('gacha-crank');
            playAudioFile('audio/gacha_crank.mp3');

            // ステージ①：ゆっくり1回転
            return crank.animate(
                [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
                { duration: 700, easing: 'ease-in' }
            ).finished.then(() => {
                // ステージ②：少し速く2回転、軽い振動
                screenShake('small');
                vibrate([15, 15, 15]);
                return crank.animate(
                    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(720deg)' }],
                    { duration: 500, easing: 'linear' }
                ).finished;
            }).then(() => {
                // ステージ③：一番速く3回転、本体ごと揺れる
                playAudioFile('audio/gacha_crank.mp3');
                screenShake('big');
                vibrate([20, 20, 20, 20, 40]);
                // 本体・レバー・カプセルをまとめている枠ごと揺らす（枠自体はtop/leftで位置決めしているため、
                // transformで揺らしても中央寄せなどとぶつからず安全）
                document.getElementById('gacha-illustration-wrap').animate(
                    [
                        { transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
                        { transform: 'translateX(4px)' }, { transform: 'translateX(-3px)' },
                        { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
                    ],
                    { duration: 200, iterations: 3 }
                );
                // レバーも本体と一緒に揺れる（回転アニメーションとぶつからないよう、加算合成で重ねる）
                crank.animate(
                    [
                        { transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
                        { transform: 'translateX(4px)' }, { transform: 'translateX(-3px)' },
                        { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
                    ],
                    { duration: 200, iterations: 3, composite: 'add' }
                );
                return crank.animate(
                    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(1080deg)' }],
                    { duration: 450, easing: 'linear' }
                ).finished;
            });
        }

        function setGachaButtonsDisabled(disabled) {
            ['gacha-spin-btn', 'gacha-spin10-btn'].forEach(id => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.disabled = disabled;
                btn.style.opacity = disabled ? '0.5' : '1';
            });
        }

        // 🎁 ノーマル（灰）が出た時：3種類の消耗品からランダムに1つ選んで、その場で効果を発動する
        let ticketInventory = { minigameTicket: 0, cooldownTicket: 0, mochi30minTicket: 0 }; // 🎫 ガチャで手に入れたチケットの所持数（すぐ使わず倉庫にためておける）

        function grantRandomNormalConsumable() {
            const item = pickRandom(NORMAL_CONSUMABLE_ITEMS);
            ticketInventory[item.id] = (ticketInventory[item.id] || 0) + 1;
            saveGame(); updateDisplay();
            return item;
        }

        // 🎫 倉庫にためたチケットを、好きなタイミングで実際に使う
        function useTicket(itemId) {
            if ((ticketInventory[itemId] || 0) <= 0) return;
            if (itemId === 'minigameTicket') {
                Object.keys(minigamePlaysUsedToday).forEach(k => {
                    minigamePlaysUsedToday[k] = Math.max(0, (minigamePlaysUsedToday[k] || 0) - 1);
                });
            } else if (itemId === 'cooldownTicket') {
                Object.keys(skills).forEach(k => { skills[k].currentCd = 0; });
            } else if (itemId === 'mochi30minTicket') {
                score += getMps() * 1800; // 30分ぶんの自動増加を即座に付与
            }
            ticketInventory[itemId]--;
            saveGame(); updateDisplay();
            openTicketInventory(); // 一覧を開いている場合、個数表示を更新する
        }

        function updateGachaCoinDisplay() {
            const el = document.getElementById('gacha-coin-value');
            if (el) el.innerText = IS_DEV_MODE ? '∞' : formatMochi(gachaCoins);
        }

        function toggleGachaRatesOverlay() {
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
            overlay.style.display = 'block';
        }

        // ===== 1連：カプセルが落ちてきて、タップすると開く =====
        const GACHA_COST_SINGLE = 10;
        const GACHA_COST_TEN = 90; // 1回x10より少しお得な価格設定

        function startGachaSpin() {
            const spinBtn = document.getElementById('gacha-spin-btn');
            if (spinBtn.disabled) return;
            if (!IS_DEV_MODE && gachaCoins < GACHA_COST_SINGLE) {
                alert(`🎰 ガチャコインが足りません（あと${GACHA_COST_SINGLE - gachaCoins}枚必要です）\n\nスタンプを押したり、日本制覇・転生をすると手に入ります！`);
                return;
            }
            if (!IS_DEV_MODE) gachaCoins -= GACHA_COST_SINGLE;
            trackMissionEvent('gachaSpinsToday', 1);
            saveGame();
            updateGachaCoinDisplay();
            setGachaButtonsDisabled(true);

            const capsuleWrap = document.getElementById('gacha-capsule-wrap');
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            const capsuleTop = document.getElementById('gacha-capsule-top');
            const capsuleBottom = document.getElementById('gacha-capsule-bottom');
            const prizeReveal = document.getElementById('gacha-prize-reveal');

            currentGachaRarity = pickGachaRarity(); // 🎨 この回で出るレア度を先に決めておく（カプセルの色に反映する）

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

        function dropGachaCapsule() {
            const capsuleWrap = document.getElementById('gacha-capsule-wrap');
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            const capsuleTop = document.getElementById('gacha-capsule-top');
            const capsuleBottom = document.getElementById('gacha-capsule-bottom');
            capsuleWhole.style.filter = currentGachaRarity.filter;
            capsuleTop.style.filter = currentGachaRarity.filter;
            capsuleBottom.style.filter = currentGachaRarity.filter;

            playAudioFile('audio/gacha_drop.mp3');
            vibrate([15, 30, 60]);
            capsuleWrap.animate(
                [
                    { transform: 'translate(-50%, calc(-50% - 60px)) scale(0)', offset: 0 },
                    { transform: 'translate(-50%, calc(-50% + 16px)) scale(1.1)', offset: 0.6 },
                    { transform: 'translate(-50%, calc(-50% - 8px)) scale(0.95)', offset: 0.82 },
                    { transform: 'translate(-50%, -50%) scale(1)', offset: 1 },
                ],
                { duration: 500, easing: 'ease-out', fill: 'forwards' }
            ).finished.then(() => {
                capsuleWrap.style.transform = 'translate(-50%, -50%) scale(1)';
                enableGachaCapsuleTapToOpen();
            });
        }

        // 🫳 落ちたカプセルは自動で開かず、プレイヤーがタップした時に開く
        function enableGachaCapsuleTapToOpen() {
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            capsuleWhole.style.pointerEvents = 'auto';
            capsuleWhole.style.cursor = 'pointer';
            const pulse = capsuleWhole.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
                { duration: 800, iterations: Infinity }
            );
            capsuleWhole.onclick = () => {
                capsuleWhole.onclick = null;
                capsuleWhole.style.pointerEvents = 'none';
                pulse.cancel();
                openGachaCapsule();
            };
        }

        function openGachaCapsule() {
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            const capsuleTop = document.getElementById('gacha-capsule-top');
            const capsuleBottom = document.getElementById('gacha-capsule-bottom');
            playAudioFile('audio/gacha_open.mp3');
            vibrate([10, 20, 10]);
            screenFlash('#ffffff', 0.25);

            capsuleWhole.style.display = 'none';
            capsuleTop.style.display = 'block';
            capsuleBottom.style.display = 'block';

            capsuleTop.animate(
                [{ transform: 'translateY(-10px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(-140px) rotate(-35deg)', opacity: 0 }],
                { duration: 500, easing: 'ease-out', fill: 'forwards' }
            );
            capsuleBottom.animate(
                [{ transform: 'translateY(10px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(110px) rotate(28deg)', opacity: 0 }],
                { duration: 500, easing: 'ease-out', fill: 'forwards' }
            );

            setTimeout(revealGachaPrize, 320);
        }

        function revealGachaPrize() {
            const prizeReveal = document.getElementById('gacha-prize-reveal');
            const prizeImg = document.getElementById('gacha-prize-img');
            const prizeName = document.getElementById('gacha-prize-name');
            const flair = currentGachaRarity.flair;
            const sparkle = flair.rays ? '✨ ' : '';
            const rarityTag = `<span style="color:${currentGachaRarity.color}; text-shadow:0 1px 2px rgba(0,0,0,0.4);">【${sparkle}${currentGachaRarity.label}${sparkle}】</span><br>`;

            if (currentGachaRarity.id === 'normal') {
                const item = grantRandomNormalConsumable();
                prizeImg.src = item.img;
                prizeImg.style.display = 'block';
                prizeName.innerHTML = `${rarityTag}${item.name}`;
            } else {
                // 🚧 このレア度の景品はまだ未確定。決まるまでの仮の中身（ランダムにもちを付与）
                const gain = Math.floor(Math.random() * 500) + 50;
                score += gain;
                updateDisplay(); saveGame();
                prizeImg.style.display = 'none';
                prizeName.innerHTML = `${rarityTag}（仮の景品）もち +${formatMochi(gain)}`;
            }

            // 🌟 レア度が高いほど、グロー・フラッシュ・振動・文字の大きさが豪華になる
            prizeImg.style.filter = `drop-shadow(0 4px 10px rgba(0,0,0,0.4)) drop-shadow(0 0 ${flair.glow}px ${currentGachaRarity.color})`;
            prizeName.style.fontSize = `${(1.15 * flair.nameScale).toFixed(2)}rem`;
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
                { duration: 420, easing: 'ease-out', fill: 'forwards' }
            );

            setGachaButtonsDisabled(false);

            // タップで結果画面を閉じて、通常のガチャ画面に戻る
            const fullscreen = document.getElementById('gacha-reveal-fullscreen');
            const closeOnTap = () => {
                fullscreen.removeEventListener('click', closeOnTap);
                fullscreen.style.display = 'none';
                document.getElementById('gacha-reveal-single').style.display = 'none';
            };
            setTimeout(() => fullscreen.addEventListener('click', closeOnTap), 400); // 出た瞬間の誤タップで即閉じないよう少し待つ
        }

        // ===== 10連：レバーは1回、カプセル10個が続けて出て、全部落ちてから順番にパカパカ開いていく =====
        function startGachaSpin10() {
            const spin10Btn = document.getElementById('gacha-spin10-btn');
            if (spin10Btn.disabled) return;
            if (!IS_DEV_MODE && gachaCoins < GACHA_COST_TEN) {
                alert(`🎰 ガチャコインが足りません（あと${GACHA_COST_TEN - gachaCoins}枚必要です）\n\nスタンプを押したり、日本制覇・転生をすると手に入ります！`);
                return;
            }
            if (!IS_DEV_MODE) gachaCoins -= GACHA_COST_TEN;
            trackMissionEvent('gachaSpinsToday', 1);
            saveGame();
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
                const rarities = [];
                for (let i = 0; i < 10; i++) rarities.push(pickGachaRarity());
                dropGachaCapsuleOneByOne(rarities, 0);
            });
        }

        // 🔴 10連のカプセルは、まず機体の小さな絵の上（1連と同じ場所）に1個ずつ出す。前のカプセルが残っていると
        // 次と重なって邪魔になるため、バウンドして着地した後、少し間を置いてフェードアウトしてから次に道を譲る。
        // 全部出し終わってから、初めて全画面の演出に切り替える。
        function dropGachaCapsuleOneByOne(rarities, index) {
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

            playAudioFile('audio/gacha_drop.mp3');
            vibrate([12]);
            capsuleWrap.animate(
                [
                    { transform: 'translate(-50%, -40px) scale(0)', opacity: 1, offset: 0 },
                    { transform: 'translate(-50%, 12px) scale(1.1)', opacity: 1, offset: 0.6 },
                    { transform: 'translate(-50%, -6px) scale(0.95)', opacity: 1, offset: 0.82 },
                    { transform: 'translate(-50%, 0px) scale(1)', opacity: 1, offset: 1 },
                ],
                { duration: 420, easing: 'ease-out', fill: 'forwards' }
            ).finished.then(() => {
                // 少し見せてから、次のカプセルに道を譲るためフェードアウト
                setTimeout(() => {
                    capsuleWrap.animate(
                        [
                            { transform: 'translate(-50%, 0px) scale(1)', opacity: 1 },
                            { transform: 'translate(-50%, -14px) scale(0.7)', opacity: 0 },
                        ],
                        { duration: 260, easing: 'ease-in', fill: 'forwards' }
                    ).finished.then(() => {
                        dropGachaCapsuleOneByOne(rarities, index + 1);
                    });
                }, 220);
            });
        }

        // 🔴 10個出し終わったら、まとめて表示。画面をタップすると、1個ずつ自動で開いていく
        function showGacha10SummaryGrid(rarities) {
            document.getElementById('gacha-capsule-wrap-mini').getAnimations().forEach(a => a.cancel());
            document.getElementById('gacha-capsule-wrap-mini').style.display = 'none';

            const panel = document.getElementById('gacha-multi-panel');
            const grid = document.getElementById('gacha-multi-grid');
            grid.innerHTML = '';
            panel.style.display = 'block';

            const CAPSULE_PX = 130;
            const capsuleSets = [], iconEls = [];
            rarities.forEach((r) => {
                const cell = document.createElement('div');
                cell.style.cssText = `position:relative; width:${CAPSULE_PX}px; height:${CAPSULE_PX}px; display:flex; align-items:center; justify-content:center;`;

                const whole = document.createElement('img');
                whole.src = 'ui_images/gacha_capsule.webp';
                whole.style.cssText = `position:absolute; width:100%; display:block; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35)) ${r.filter};`;

                const top = document.createElement('img');
                top.src = 'ui_images/gacha_capsule_top.webp';
                top.style.cssText = `position:absolute; width:100%; display:none; filter:${r.filter};`;

                const bottom = document.createElement('img');
                bottom.src = 'ui_images/gacha_capsule_bottom.webp';
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

        function openGacha10CapsulesSequentially(capsuleSets, iconEls, rarities, index) {
            if (index >= capsuleSets.length) {
                finishGachaSpin10();
                return;
            }
            const { whole, top, bottom, cell } = capsuleSets[index];
            const icon = iconEls[index];
            const flair = rarities[index].flair;
            cell.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 入りきらない分は、開く場所に合わせて自動でスクロール
            playAudioFile('audio/gacha_open.mp3');
            vibrate(flair.vibrate);
            if (flair.glow > 0) screenFlash(rarities[index].color, flair.flash * 0.6); // 10連は連続で光ると煩わしいので、1連より控えめに

            if (rarities[index].id === 'normal') {
                const item = grantRandomNormalConsumable();
                icon.innerHTML = `<img src="${item.img}" style="width:60%; display:block; margin:0 auto 4px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)) drop-shadow(0 0 ${flair.glow}px ${rarities[index].color});"><div style="display:inline-block; font-size:0.68rem; font-weight:900; color:#fff; background:${rarities[index].color}; padding:2px 8px; border-radius:10px; line-height:1.3; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${item.name}</div>`;
            } else {
                // 🚧 このレア度の景品はまだ未確定。決まるまでの仮の中身（ランダムにもちを付与）
                const gain = Math.floor(Math.random() * 500) + 50;
                score += gain; updateDisplay();
                icon.querySelector('div:last-child').innerText = `+${formatMochi(gain)}`;
            }

            // 1連と同じ「上下にパカッと割れて開く」演出
            whole.style.display = 'none';
            top.style.display = 'block';
            bottom.style.display = 'block';
            top.animate(
                [{ transform: 'translateY(-6px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(-75px) rotate(-32deg)', opacity: 0 }],
                { duration: 400, easing: 'ease-out', fill: 'forwards' }
            );
            bottom.animate(
                [{ transform: 'translateY(6px) rotate(0deg)', opacity: 1 }, { transform: 'translateY(58px) rotate(25deg)', opacity: 0 }],
                { duration: 400, easing: 'ease-out', fill: 'forwards' }
            );
            icon.animate(
                [{ transform: 'scale(0.5)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
                { duration: 400, easing: 'ease-out', fill: 'forwards', delay: 120 }
            ).finished.then(() => {
                setTimeout(() => openGacha10CapsulesSequentially(capsuleSets, iconEls, rarities, index + 1), 180);
            });
        }

        // 🔴 全部開き終わったら、結果のUIをそのまま残さず、「もう10連／やめる」の選択だけ出す
        function finishGachaSpin10() {
            saveGame();
            playAudioFile('audio/levelup.mp3');
            screenFlash('#ffd700', 0.25);

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
        function closeGacha10ResultsAnd(spinAgain) {
            const panel = document.getElementById('gacha-multi-panel');
            panel.style.display = 'none';
            document.getElementById('gacha-multi-grid').innerHTML = '';
            document.getElementById('gacha-reveal-fullscreen').style.display = 'none';
            const prompt = document.getElementById('gacha10-finish-prompt');
            if (prompt) prompt.remove();
            setGachaButtonsDisabled(false);
            if (spinAgain) startGachaSpin10();
        }

        function onGachaTabTap() {
            if (!IS_DEV_MODE) {
                alert('🎰 ガチャは近日公開予定です！\nお楽しみに！');
                return;
            }
            switchShopTab('gacha');
        }

        function renderShopList() {
            if (currentShopTab === 'omiyage') {
                renderOmiyageShelf();
                return;
            }

            const listContainer = document.getElementById('shop-overlay-list');
            listContainer.innerHTML = "";

            if (currentShopTab === 'gacha') {
                listContainer.innerHTML = `
                    <div id="gacha-stage" style="position:relative; width:100%; height:360px;">
                        <div id="gacha-illustration-wrap" style="position:absolute; top:24px; left:0; width:100%; height:340px;">
                            <img id="gacha-machine-body" src="ui_images/gacha_machine_body.webp" alt="ガチャガチャ" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:70%; max-width:230px; z-index:2;">
                            <img id="gacha-crank" src="ui_images/gacha_crank.webp" alt="" style="position:absolute; width:18%; top:62.402035%; left:40.544265%; transform-origin:50% 50%; z-index:3; pointer-events:none;">

                            <div id="gacha-capsule-wrap-mini" style="position:absolute; top:77.967692%; left:49.573535%; transform:translate(-50%, 0) scale(0); width:22%; z-index:4;">
                                <img src="ui_images/gacha_capsule.webp" alt="" style="width:100%; display:block;">
                            </div>
                        </div>

                        <button onclick="toggleGachaRatesOverlay()" style="position:absolute; top:4px; right:4px; z-index:9; width:26px; height:26px; border-radius:50%; border:none; background:rgba(93,64,55,0.75); color:#fff; font-weight:900; font-size:0.8rem;">？</button>

                        <div id="gacha-rates-overlay" style="display:none; position:fixed; inset:0; z-index:2000; background:rgba(255,248,236,0.98); padding:20px; overflow-y:auto; box-sizing:border-box;">
                            <button onclick="toggleGachaRatesOverlay()" style="position:absolute; top:8px; right:8px; width:26px; height:26px; border-radius:50%; border:none; background:#5d4037; color:#fff; font-weight:900;">×</button>
                            <h3 style="margin:0 0 10px; color:#5d4037;">🎰 排出率</h3>
                            <div id="gacha-rates-list"></div>
                        </div>
                    </div>
                    <p style="font-size:0.7rem; color:#5d4037; margin:2px 0 10px;">🚧 ただいま準備中：景品の内容は近日調整予定です</p>
                    <div id="gacha-coin-display" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg,#fff8ec,#ffe9c2); border:2px solid #e8c88a; border-radius:20px; padding:6px 16px; font-weight:900; color:#8d6e63; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.08);">🪙 <span id="gacha-coin-value">0</span> コイン</div>
                    <button id="gacha-spin-btn" class="item-action-btn btn-shop" style="width:80%; background:linear-gradient(135deg,#ff6fa5,#e91e63); color:#fff; border-radius:24px; box-shadow:0 3px 0 #b0184a, 0 4px 8px rgba(0,0,0,0.15); font-weight:900; letter-spacing:0.5px;" onclick="startGachaSpin()">🎰 1回まわす（${GACHA_COST_SINGLE}枚）</button>
                    <button id="gacha-spin10-btn" class="item-action-btn btn-shop" style="width:80%; background:linear-gradient(135deg,#c162e8,#9c27b0); color:#fff; margin-top:10px; border-radius:24px; box-shadow:0 3px 0 #6a1b7a, 0 4px 8px rgba(0,0,0,0.15); font-weight:900; letter-spacing:0.5px;" onclick="startGachaSpin10()">🎰 10連まとめて（${GACHA_COST_TEN}枚）</button>

                    <div id="gacha-reveal-fullscreen" style="display:none; position:fixed; inset:0; max-width:480px; margin:0 auto; z-index:1500; background:radial-gradient(ellipse at center, #5a4330 0%, #1a0f08 100%); align-items:center; justify-content:center;">
                        <div id="gacha-reveal-single" style="display:none; position:relative; width:100%; height:100%; align-items:center; justify-content:center;">
                            <div id="gacha-capsule-wrap" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) scale(0); width:45%; max-width:220px; z-index:4;">
                                <img id="gacha-capsule-whole" src="ui_images/gacha_capsule.webp" alt="" style="width:100%; display:block;">
                                <img id="gacha-capsule-top" src="ui_images/gacha_capsule_top.webp" alt="" style="width:100%; display:none; position:absolute; top:0; left:0;">
                                <img id="gacha-capsule-bottom" src="ui_images/gacha_capsule_bottom.webp" alt="" style="width:100%; display:none; position:absolute; top:0; left:0;">
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
                return;
            }

            if (currentShopTab === 'kisekae') {
                clothesData.forEach(c => {
                    if (c.id === 'normal') return; 
                    const isBought = purchasedClothes[c.id];
                    let btnHtml = "";
                    if (isBought) { btnHtml = `<button class="item-action-btn" disabled>購入済</button>`; }
                    else {
                        const canBuy = score >= c.price;
                        btnHtml = `<button class="item-action-btn btn-shop" ${canBuy ? '' : 'disabled'} onclick="buyKisekae('${c.id}')" style="background:#ff9800; color:white;">${formatMochi(c.price)}もち</button>`;
                    }
                    const row = document.createElement('div');
                    row.className = "list-item";
                    const thumbSrc = c.img || 'ui_images/image_0.webp';
                    const thumbFilter = c.img ? 'none' : (c.filter || 'none');
                    row.innerHTML = `<div class="item-info-row"><img class="item-thumb" src="${thumbSrc}" style="filter:${thumbFilter};" alt="${c.name}"><div class="item-info"><span class="item-title">👕 ${c.name}</span><span class="item-desc">${c.desc}</span></div></div>${btnHtml}`;
                    listContainer.appendChild(row);
                });
            } else {
                // ✨ スキルタブ：ステージ進行に応じて段階的に解放される
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
        }

        const OMIYAGE_PAGE_SIZE = 9;
        let omiyagePage = 0;
        let omiyageSelectedIdx = null;
        const OMIYAGE_IMG_NATURAL_RATIO = 851 / 1847; // 棚イラストの実寸比率（幅/高さ）

        // #omiyage-image-frameを、コンテナ内で棚イラストが実際に表示される範囲(レターボックス考慮済み)に
        // ピッタリ合わせる。これにより、中の%指定（スロット位置・名札・詳細パネルなど）が常に画像基準で正確になる。
        function syncOmiyageImageFrame() {
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
                const MAX_SAFE_CROP_RATIO = 0.16; // 看板部分など、削っても実害が無い上部の目安（下のタブ等には絶対届かせない）
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

        function renderOmiyageShelf(shake) {
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
                    itemDiv.style.animation = `omiyageShelfShake 0.4s ease-in-out ${slot * 0.03}s`;
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

        function omiyagePageBy(dir) {
            const maxPage = Math.ceil(stages.length / OMIYAGE_PAGE_SIZE) - 1;
            omiyagePage = (omiyagePage + dir + maxPage + 1) % (maxPage + 1); // 最初で←→最後、最後で→→最初
            omiyageSelectedIdx = null;
            playAudioFile('audio/shelf_switch.mp3'); // 棚を切り替える専用の効果音
            renderOmiyageShelf(true); // trueで、切り替え時の揺れ演出を出す
        }

        function onOmiyageSlotTap(idx, el) {
            playAudioFile('audio/tap.mp3');
            el.classList.remove('mochitto'); void el.offsetWidth; el.classList.add('mochitto'); // もちっと演出
            omiyageSelectedIdx = idx;
            showOmiyageDetail(idx);
        }

        function showOmiyageDetail(idx) {
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
                const myValue = currentLv * (stage.tapBonus || stage.mpsBonus) * (isGoldTrophyHere ? 1.1 : 1);
                const totalValue = stage.tapBonus ? getTapPower() : getMps();
                const percent = totalValue > 0 ? (myValue / totalValue * 100) : 0;
                contributionText = ` ／ 全体の${percent < 0.1 ? '<0.1' : percent.toFixed(1)}%`;
            }
            document.getElementById('omiyage-detail-effect').innerText = `${baseEffectText}（現在+${formatMochi(currentLv * (stage.tapBonus || stage.mpsBonus))}${contributionText}）`;

            const buyBtn = document.getElementById('omiyage-detail-buy-btn');
            buyBtn.innerText = `${formatMochi(nextPrice)}もちで購入`;
            buyBtn.disabled = !canBuy;
            buyBtn.onclick = () => buyOmiyageFromShelf(idx, nextPrice);

            document.getElementById('omiyage-detail-panel').classList.add('show');
        }

        // 見た目だけ隠す（選択状態は保持しない呼び出し元でクリアする）
        function closeOmiyageDetailUI() {
            document.getElementById('omiyage-detail-panel').classList.remove('show');
        }

        // 🍡 お土産一覧（倉庫）：持っているおみやげを並べて、タップで「もちすけにあげる」を選べる
        function closeOmiyageDetail() {
            omiyageSelectedIdx = null;
            closeOmiyageDetailUI();
        }

        function buyOmiyageFromShelf(idx, price) {
            if (score < price) return;
            buyOmiyage(idx); // 既存の購入ロジックを流用（効果音・セリフ・セーブ・再描画まで全部やってくれる）
            flashOmiyageMoneySpent(price);
        }

        function flashOmiyageMoneySpent(price) {
            const el = document.getElementById('omiyage-money-flash');
            const valueEl = document.getElementById('omiyage-money-value');
            const container = document.getElementById('omiyage-shelf-container'); // #omiyage-money-displayと同じ絶対配置の基準
            el.innerText = `-${formatMochi(price)}もち`;

            // 所持もち数の桁数によって表示幅が変わるため、その時点での右上位置を実測して合わせる
            const valueRect = valueEl.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            el.style.left = (valueRect.right - containerRect.left + 4) + 'px';
            el.style.top = (valueRect.top - containerRect.top - 14) + 'px';

            el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 1600);
        }

        function buyOmiyage(idx) {
            const stage = stages[idx]; const currentLv = purchasedItems[idx] || 0;
            const nextPrice = getOmiyagePrice(stage, currentLv);
            if (score >= nextPrice) {
                score -= nextPrice; purchasedItems[idx] = currentLv + 1;
                trackMissionEvent('omiyageBoughtTotal', 1); trackMissionEvent('omiyageBoughtToday', 1);
                playAudioFile('audio/levelup.mp3');
                showMochiComment(pickRandom(dialogueData.eventComments.levelUp));
                saveGame(); renderShopList(); updateDisplay(); updateShopTabHighlight();
            }
        }

        function buyKisekae(id) {
            const target = clothesData.find(c => c.id === id);
            if (score >= target.price && !purchasedClothes[id]) {
                score -= target.price; purchasedClothes[id] = true;
                equipClothe(id); // 🐛修正：装備専用のUIを廃止したので、買ったらその場で自動装備する（能力ボーナスが有効になるように）
                saveGame(); renderShopList(); updateDisplay();
            }
        }

        // 🗺️ 地図の拡大縮小・ドラッグ操作の状態
        function updateShopTabHighlight() {
            const skillTab = document.getElementById('shop-tab-skills');
            if (skillTab) skillTab.classList.toggle('shop-recommend-glow', hasNewlyPurchasableSkill());
            const omiyageTab = document.getElementById('shop-tab-omiyage');
            if (omiyageTab) omiyageTab.classList.toggle('shop-recommend-glow', hasNewlyPurchasableOmiyage());
        }

