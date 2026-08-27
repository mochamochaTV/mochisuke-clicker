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
            saveGame(); openWarehouse(); updateDisplay();
        }

        // 起動時に読み込まなくていい大きな画像（マップ・おみやげ屋の背景）は、実際に開いた時だけ読み込む
        function openShop() { lazyLoadImage('omiyage-shelf-img'); openModal('shop-modal'); switchShopTab(currentShopTab); updateShopTabHighlight(); }

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
                document.getElementById('gacha-machine-body').animate(
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

        // ===== 1連：カプセルが落ちてきて、タップすると開く =====
        function startGachaSpin() {
            const spinBtn = document.getElementById('gacha-spin-btn');
            if (spinBtn.disabled) return;
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
            capsuleWrap.style.transform = 'translate(-50%, 0) scale(0)';
            capsuleWhole.style.display = 'block';
            capsuleWhole.style.filter = 'none';
            capsuleTop.style.display = 'none';
            capsuleBottom.style.display = 'none';
            capsuleTop.style.opacity = '1'; capsuleBottom.style.opacity = '1';
            prizeReveal.style.opacity = '0';
            prizeReveal.style.transform = 'translate(-50%,-50%) scale(0)';

            playGachaCrankSequence().then(() => {
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
                    { transform: 'translate(-50%, -40px) scale(0)', offset: 0 },
                    { transform: 'translate(-50%, 12px) scale(1.1)', offset: 0.6 },
                    { transform: 'translate(-50%, -6px) scale(0.95)', offset: 0.82 },
                    { transform: 'translate(-50%, 0px) scale(1)', offset: 1 },
                ],
                { duration: 500, easing: 'ease-out', fill: 'forwards' }
            ).finished.then(() => {
                capsuleWrap.style.transform = 'translate(-50%, 0) scale(1)';
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
                [{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: 'translateY(-42px) rotate(-30deg)', opacity: 0 }],
                { duration: 450, easing: 'ease-out', fill: 'forwards' }
            );
            capsuleBottom.animate(
                [{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: 'translateY(32px) rotate(24deg)', opacity: 0 }],
                { duration: 450, easing: 'ease-out', fill: 'forwards' }
            );

            setTimeout(revealGachaPrize, 320);
        }

        function revealGachaPrize() {
            // 🚧 景品テーブルはまだ未確定。決まるまでの仮の中身（ランダムにもちを付与）
            const gain = Math.floor(Math.random() * 500) + 50;
            score += gain;
            updateDisplay(); saveGame();

            const prizeReveal = document.getElementById('gacha-prize-reveal');
            const prizeName = document.getElementById('gacha-prize-name');
            prizeName.innerHTML = `<span style="color:${currentGachaRarity.color}; text-shadow:0 1px 2px rgba(0,0,0,0.4);">【${currentGachaRarity.label}】</span><br>（仮の景品）もち +${formatMochi(gain)}`;

            playAudioFile('audio/levelup.mp3');
            screenFlash('#ffd700', 0.3);

            prizeReveal.animate(
                [
                    { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
                    { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 1, offset: 0.7 },
                    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                ],
                { duration: 420, easing: 'ease-out', fill: 'forwards' }
            );

            setGachaButtonsDisabled(false);
        }

        // ===== 10連：レバーは1回、カプセル10個が続けて出て、全部落ちてから順番にパカパカ開いていく =====
        function startGachaSpin10() {
            const spin10Btn = document.getElementById('gacha-spin10-btn');
            if (spin10Btn.disabled) return;
            setGachaButtonsDisabled(true);

            document.getElementById('gacha-prize-reveal').getAnimations().forEach(a => a.cancel());
            document.getElementById('gacha-prize-reveal').style.opacity = '0';
            document.getElementById('gacha-multi-grid').innerHTML = '';
            document.getElementById('gacha-multi-panel').style.display = 'none';
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

        // 🔴 10連のカプセルは、1連と同じ場所に1個ずつ出す。前のカプセルが残っていると次と重なって邪魔になるため、
        // バウンドして着地した後、少し間を置いてフェードアウトしてから次のカプセルに道を譲る。
        function dropGachaCapsuleOneByOne(rarities, index) {
            if (index >= rarities.length) {
                showGacha10SummaryGrid(rarities);
                return;
            }
            const capsuleWrap = document.getElementById('gacha-capsule-wrap');
            const capsuleWhole = document.getElementById('gacha-capsule-whole');
            capsuleWrap.getAnimations().forEach(a => a.cancel());
            capsuleWhole.style.display = 'block';
            capsuleWhole.style.pointerEvents = 'none';
            capsuleWhole.style.filter = rarities[index].filter;
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
            document.getElementById('gacha-capsule-wrap').getAnimations().forEach(a => a.cancel());
            document.getElementById('gacha-capsule-wrap').style.display = 'none';

            const panel = document.getElementById('gacha-multi-panel');
            const grid = document.getElementById('gacha-multi-grid');
            grid.innerHTML = '';
            panel.style.display = 'block';

            const CAPSULE_PX = 56;
            const capsuleEls = [], iconEls = [];
            rarities.forEach((r) => {
                const cell = document.createElement('div');
                cell.style.cssText = `position:relative; width:${CAPSULE_PX}px; height:${CAPSULE_PX}px; display:flex; align-items:center; justify-content:center;`;
                const img = document.createElement('img');
                img.src = 'ui_images/gacha_capsule.webp';
                img.style.cssText = `position:absolute; width:100%; display:block; filter:${r.filter};`;
                const icon = document.createElement('div');
                icon.style.cssText = 'position:absolute; width:100%; text-align:center; opacity:0; transform:scale(0.5);';
                icon.innerHTML = `<div style="font-size:1.4rem;">🍡</div><div style="font-size:0.5rem; font-weight:bold; color:${r.color}; text-shadow:0 1px 2px #fff;"></div>`;
                cell.appendChild(img); cell.appendChild(icon);
                grid.appendChild(cell);
                capsuleEls.push(img); iconEls.push(icon);
            });

            const tapHint = document.createElement('p');
            tapHint.id = 'gacha-tap-hint';
            tapHint.style.cssText = 'text-align:center; font-size:0.75rem; color:#e91e63; font-weight:bold; margin:2px 0 8px; animation: gachaTapHintPulse 1s ease-in-out infinite;';
            tapHint.innerText = '👆 画面をタップして開封！';
            panel.insertBefore(tapHint, grid);

            const openHandler = () => {
                panel.removeEventListener('click', openHandler);
                tapHint.remove();
                openGacha10CapsulesSequentially(capsuleEls, iconEls, rarities, 0);
            };
            panel.addEventListener('click', openHandler);
        }

        function openGacha10CapsulesSequentially(capsuleEls, iconEls, rarities, index) {
            if (index >= capsuleEls.length) {
                finishGachaSpin10();
                return;
            }
            const img = capsuleEls[index];
            const icon = iconEls[index];
            playAudioFile('audio/gacha_open.mp3');
            vibrate([10, 15]);

            // 🚧 景品テーブルはまだ未確定。決まるまでの仮の中身（ランダムにもちを付与）
            const gain = Math.floor(Math.random() * 500) + 50;
            score += gain; updateDisplay();
            icon.querySelector('div:last-child').innerText = `+${formatMochi(gain)}`;

            // カプセルが弾けて縮み、中身が浮かび上がる
            img.animate(
                [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.35 }, { transform: 'scale(0.2)', opacity: 0 }],
                { duration: 350, easing: 'ease-in', fill: 'forwards' }
            );
            icon.animate(
                [{ transform: 'scale(0.5)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
                { duration: 400, easing: 'ease-out', fill: 'forwards', delay: 120 }
            ).finished.then(() => {
                setTimeout(() => openGacha10CapsulesSequentially(capsuleEls, iconEls, rarities, index + 1), 180);
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
            promptDiv.style.cssText = 'position:absolute; bottom:10px; left:8px; right:8px; display:flex; gap:8px;';
            promptDiv.innerHTML = `
                <button class="item-action-btn btn-shop" style="flex:1; background:#9c27b0; color:#fff;" onclick="event.stopPropagation(); closeGacha10ResultsAnd(true);">🎰 もう10連</button>
                <button class="item-action-btn" style="flex:1; background:#eee; color:#4a3622;" onclick="event.stopPropagation(); closeGacha10ResultsAnd(false);">やめる</button>
            `;
            panel.appendChild(promptDiv);
        }

        // 🔴 「もう10連」「やめる」どちらを押しても、結果表示はいったんすべて消してから次に進む
        function closeGacha10ResultsAnd(spinAgain) {
            const panel = document.getElementById('gacha-multi-panel');
            panel.style.display = 'none';
            document.getElementById('gacha-multi-grid').innerHTML = '';
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
                    <div id="gacha-stage" style="position:relative; width:100%; height:340px; display:flex; align-items:center; justify-content:center;">
                        <img id="gacha-machine-body" src="ui_images/gacha_machine_body.webp" alt="ガチャガチャ" style="width:70%; max-width:230px; position:relative; z-index:2;">
                        <img id="gacha-crank" src="ui_images/gacha_crank.webp" alt="" style="position:absolute; width:18%; top:62.402035%; left:40.544265%; transform-origin:50% 50%; z-index:3; pointer-events:none;">

                        <div id="gacha-capsule-wrap" style="position:absolute; top:77.967692%; left:49.573535%; transform:translate(-50%, 0) scale(0); width:22%; z-index:4;">
                            <img id="gacha-capsule-whole" src="ui_images/gacha_capsule.webp" alt="" style="width:100%; display:block;">
                            <img id="gacha-capsule-top" src="ui_images/gacha_capsule_top.webp" alt="" style="width:100%; display:none; position:absolute; top:0; left:0;">
                            <img id="gacha-capsule-bottom" src="ui_images/gacha_capsule_bottom.webp" alt="" style="width:100%; display:none; position:absolute; top:0; left:0;">
                        </div>

                        <div id="gacha-prize-reveal" style="position:absolute; top:20%; left:50%; transform:translate(-50%,-50%) scale(0); text-align:center; z-index:5; opacity:0;">
                            <img id="gacha-prize-img" src="" alt="" style="width:90px; height:90px; object-fit:contain;">
                            <p id="gacha-prize-name" style="font-size:0.85rem; font-weight:bold; color:#e91e63; margin:4px 0 0; text-shadow:0 1px 3px #fff;"></p>
                        </div>

                        <div id="gacha-multi-panel" style="display:none; position:absolute; inset:2% 4%; background:rgba(255,248,236,0.94); border:2px solid #e8dcc0; border-radius:16px; z-index:6; overflow-y:auto;">
                            <div id="gacha-multi-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px 10px; padding:12px; justify-items:center;"></div>
                        </div>
                    </div>
                    <p style="font-size:0.7rem; color:#5d4037; margin:2px 0 10px;">🚧 開発者テスト用（景品の中身は未確定です）</p>
                    <button id="gacha-spin-btn" class="item-action-btn btn-shop" style="width:80%; background:#e91e63; color:#fff;" onclick="startGachaSpin()">🎰 1回まわす</button>
                    <button id="gacha-spin10-btn" class="item-action-btn btn-shop" style="width:80%; background:#9c27b0; color:#fff; margin-top:8px;" onclick="startGachaSpin10()">🎰 10連まとめて</button>

                `;
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

        function renderOmiyageShelf() {
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
            renderOmiyageShelf();
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
                playAudioFile('audio/levelup.mp3');
                showMochiComment(pickRandom(dialogueData.eventComments.levelUp));
                saveGame(); renderShopList(); updateDisplay(); updateShopTabHighlight();
            }
        }

        function buyKisekae(id) {
            const target = clothesData.find(c => c.id === id);
            if (score >= target.price && !purchasedClothes[id]) {
                score -= target.price; purchasedClothes[id] = true;
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

