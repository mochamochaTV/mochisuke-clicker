        // ui.js を機能ごとに分割したファイルの1つ（フレンド・他人の部屋への訪問（フレンドリスト・招待・訪問中の演出・移動メニュー・ものおき））。ui.js 自身は7ファイルをre-exportする窓口。

        import { KISEKAE_ITEMS, MOVE_MENU_PARTS, MYROOM_ITEMS, WAREHOUSE_ITEM_PARTS, stages } from '../../data.js?v=2026-09-08-006';
        import { escapeHtml, playAudioFile, playBgmLoop, spawnModalFloatingText, spawnModalParticleBurst, vibrate } from '../../main.js?v=2026-09-08-006';
        import { equippedKisekae, gachaCoins, setGachaCoins } from '../../progress.js?v=2026-09-08-006';
        import { blockedUserIds, favoriteFriendIds, purchasedItems, updateGachaCoinDisplay } from '../../shop.js?v=2026-09-08-006';
        import { saveGame } from '../../state.js?v=2026-09-08-006';
        import { closeModal, openModal, openTrophyRoom } from './core.js?v=2026-09-08-006';
        import { CHAT_SEND_COOLDOWN_MS, activeChatIsHost, activeChatOtherUid, activeChatRoomId, ensureChatEligibilityAnswered, joinFriendRoomAndChat, lastChatSendAt, myAvatarPrefix, openHostWaitingRoom, otherAvatarPrefix, setActiveChatIsHost, setActiveChatOtherUid, setActiveChatRoomId, setChatUiVisible, setLastChatSendAt, setMyAvatarPrefix, setOtherAvatarPrefix, setVisitActionButtonsForHosting, stopRoomSessionWatch } from './chat.js?v=2026-09-08-006';
        import { MYROOM_WALK_SPEED_PCT_PER_SEC, openTicketInventory } from './myroom.js?v=2026-09-08-006';
        import { openOmiyageCollection, updateDisplay } from './hud.js?v=2026-09-08-006';
        import { openDiary, renderRankOutfitPreviewHtml } from './ranking.js?v=2026-09-08-006';


        // 🤝 フレンド機能
        export async function openFriendPlaceholder() {
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
            switchFriendTab('list');
        }
        // 🏠 誰でも、フレンドコード・ランキングを問わず、他の人の部屋を見に行ける（読み取り専用）
        export let visitingUid = null;
        export function setVisitingUid(v) { visitingUid = v; }
        export async function visitMyroomOf(uid, showBoth) {
            if (!window.fetchMyroomData) return;
            const data = await window.fetchMyroomData(uid);
            if (!data || !data.myroom) {
                alert('🏠 まだお部屋が公開されていません');
                return;
            }
            setVisitingUid(uid);
            document.getElementById('visit-myroom-name-label').textContent = showBoth ? `🏠 ${data.name}さんの部屋にお邪魔中` : `🏠 ${data.name}さんの部屋`;
            renderVisitMyroomLayout(data.myroom);
            applyVisitOutfit(data.outfit, 'visit-myroom-mochisuke');
            const myselfWrap = document.getElementById('visit-myroom-myself-breathe-wrap');
            if (showBoth) {
                // 🚶 フレンド訪問時は、自分（今の着せ替え）も一緒に部屋に立って歩き回る
                myselfWrap.style.display = 'block';
                applyVisitOutfit(equippedKisekae, 'visit-myroom-myself');
            } else {
                myselfWrap.style.display = 'none';
            }
            openModal('visit-myroom-modal');
            // 🎭 ここはライブ接続のない一方通行の閲覧（相手はその場にいない）なので、
            // 同期のしようがないアクションボタンは表示しない
            document.getElementById('visit-myroom-action-btn').style.display = 'none';
            startVisitMochisukeWalk('visit-myroom-mochisuke-breathe-wrap', 'visitHost');
            if (showBoth) startVisitMochisukeWalk('visit-myroom-myself-breathe-wrap', 'visitSelf');
            // ❤️ 既にいいね済みかどうか確認して、ボタンの状態を反映する
            const likeBtn = document.getElementById('visit-like-btn');
            likeBtn.disabled = false;
            likeBtn.textContent = '❤️ いいね';
            likeBtn.style.background = '#e91e63';
            // いいね連打対策(likeRoomの atomic batch化)の動作確認が取れたので、コメントアウトしていた
            // 「いいね済み」判定を復活。再訪問時に、既にいいね済みならボタンをその表示にする
            if (window.checkRoomLiked) {
                const alreadyLiked = await window.checkRoomLiked(uid);
                if (alreadyLiked) {
                    likeBtn.disabled = true;
                    likeBtn.textContent = '❤️ いいね済み';
                    likeBtn.style.background = '#ccc';
                }
            }
        }
        window.visitMyroomOf = visitMyroomOf; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        export async function onLikeRoomTap() {
            if (!visitingUid || !window.likeRoom) return;
            const likeBtn = document.getElementById('visit-like-btn');
            likeBtn.disabled = true;
            const res = await window.likeRoom(visitingUid);
            if (res.success) {
                likeBtn.textContent = '❤️ いいね済み';
                likeBtn.style.background = '#ccc';
                playAudioFile('audio/levelup.mp3');
                setGachaCoins(gachaCoins + (1)); // 🪙 いいねを送った自分も、ガチャコインを1枚もらう
                saveGame();
                updateGachaCoinDisplay();
                showLikeCoinPopup(likeBtn);
            } else if (res.reason === 'already') {
                likeBtn.textContent = '❤️ いいね済み';
                likeBtn.style.background = '#ccc';
            } else {
                likeBtn.disabled = false;
                if (res.reason !== 'self') alert(`いいねできませんでした。\n${res.errorMessage ? '詳細: ' + res.errorMessage : '時間を置いて試してください'}`);
            }
        }
        // 🪙 いいねを送った瞬間、ボタンの近くに「+1」がふわっと浮かんで消える演出
        export function showLikeCoinPopup(anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            const popup = document.createElement('div');
            popup.textContent = '🪙 +1';
            popup.style.cssText = `position:fixed; left:${rect.left + rect.width / 2}px; top:${rect.top}px; transform:translateX(-50%); font-size:1.15rem; font-weight:900; color:#ff9800; z-index:9999; pointer-events:none; animation: likeCoinPopupFloat 1.2s ease-out forwards;`;
            document.body.appendChild(popup);
            setTimeout(() => popup.remove(), 1300);
        }
        export function closeVisitMyroom() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            if (activeChatRoomId) {
                window.leaveRoomSession(activeChatRoomId);
                stopRoomSessionWatch();
                setActiveChatRoomId(null); setActiveChatOtherUid(null); setActiveChatIsHost(false);
                setMyAvatarPrefix(null); setOtherAvatarPrefix(null);
            }
            setChatUiVisible(false);
            document.getElementById('visit-waiting-indicator').style.display = 'none';
            setVisitActionButtonsForHosting(false);
            closeMyroomActionMenu('visit');
            closeMyroomFeedPicker();
            const placedIcon = document.getElementById('myroom-feed-placed-icon');
            if (placedIcon) placedIcon.remove();
            setTimeout(() => {
                closeModal('visit-myroom-modal');
                setVisitingUid(null);
                stopVisitMochisukeWalk('visitHost');
                stopVisitMochisukeWalk('visitSelf');
                // 🐛修正：下に隠れているランキング・フレンド画面がまだ開いたままなら、modal-openクラスを維持する
                const rankingModal = document.getElementById('ranking-modal');
                const friendModal = document.getElementById('friend-modal');
                if ((rankingModal && rankingModal.style.display === 'flex') || (friendModal && friendModal.style.display === 'flex')) {
                    document.body.classList.add('modal-open');
                }
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        // 🚶🐛修正：以前はホスト・ゲスト双方の見た目を、host側とguest側それぞれの画面が独立して
        // ランダムに歩かせていたため、2人の画面でもちすけの位置がバラバラになっていた。
        // これ以降は「自分のアバター」だけをこのタイマーでランダムに歩かせ、選んだ目的地を
        // roomSessionsドキュメントに書き込む。相手側は自分で歩かせず、届いた目的地をそのまま
        // 再生する（=applyVisitWalkTarget）ことで、2人の画面の動きを一致させる
        export const visitWalkTimers = { visitHost: null, visitSelf: null };
        export function startVisitMochisukeWalk(wrapId, key) {
            stopVisitMochisukeWalk(key);
            scheduleNextVisitWalk(wrapId, key);
        }
        export function stopVisitMochisukeWalk(key) {
            clearTimeout(visitWalkTimers[key]);
            visitWalkTimers[key] = null;
        }
        export function scheduleNextVisitWalk(wrapId, key) {
            const pauseDuration = 3000 + Math.random() * 4000; // 3〜7秒くらい、その場に立ち止まる
            visitWalkTimers[key] = setTimeout(() => walkVisitMochisukeToRandomSpot(wrapId, key), pauseDuration);
        }
        export function walkVisitMochisukeToRandomSpot(wrapId, key) {
            const wrap = document.getElementById(wrapId);
            if (!wrap || wrap.style.display === 'none') { scheduleNextVisitWalk(wrapId, key); return; }
            const newLeftPct = 12 + Math.random() * 76;
            const newBottomPct = 1 + Math.random() * 8;
            applyVisitWalkTarget(wrapId, newLeftPct, newBottomPct);
            // 🐛修正：ライブセッション中なら、自分が選んだ目的地を相手にも伝える（コストを抑えるため
            // 目的地が変わった時だけ書き込む。1回の訪問セッションで数秒に1回程度の頻度）
            if (activeChatRoomId && window.sendRoomWalkTarget) {
                window.sendRoomWalkTarget(activeChatRoomId, activeChatIsHost, { leftPct: newLeftPct, bottomPct: newBottomPct, ts: Date.now() });
            }
            scheduleNextVisitWalk(wrapId, key);
        }
        // 👄🐛修正：以前は「歩く」と「叫ぶ」がそれぞれ独立して口閉じパーツ(mouth-anchor)の
        // display を直接 'none'/'block' で上書きしていたため、叫んでいる最中に歩行が止まる
        // （＝歩行側のsetTimeoutが「止まったから口を閉じよう」と割り込む）と、まだ叫んでいる
        // 途中なのに口閉じパーツが復活してしまう不具合があった。
        // 「歩行中」「叫び中」など複数の理由(reason)をSetで管理し、どれか1つでも理由が残っていれば
        // 非表示のままにする方式に変更。全ての理由が消えた時だけ表示を戻すので、
        // 歩行と叫びが重なっても正しい状態に保たれる
        export const myroomMouthHideReasons = {};
        export function isMyroomPrefixFullbody(prefix) {
            // 「マイルーム（一人用/もようがえ）」画面のもちすけだけは applyVisitOutfit を使わず
            // dataset.fullbody を持たないため、グローバルなequippedKisekaeを直接見る
            if (prefix === 'myroom-mochisuke') return !!(equippedKisekae && equippedKisekae.fullbody);
            const el = document.getElementById(prefix + '-mouth-anchor');
            return !!(el && el.dataset.fullbody === '1');
        }
        export function setMyroomMouthHidden(prefix, reason, hidden) {
            const mouthAnchor = document.getElementById(prefix + '-mouth-anchor');
            if (!mouthAnchor || isMyroomPrefixFullbody(prefix)) return; // 全身衣装中は触らない
            const reasons = myroomMouthHideReasons[prefix] || (myroomMouthHideReasons[prefix] = new Set());
            if (hidden) reasons.add(reason); else reasons.delete(reason);
            mouthAnchor.style.display = reasons.size > 0 ? 'none' : 'block';
        }
        // 🚶 実際にDOMへ反映する部分（自分の意思による移動でも、相手から届いた移動でも同じ関数を使うことで、
        // 見た目・速度の計算方法を完全に一致させる）
        export function applyVisitWalkTarget(wrapId, newLeftPct, newBottomPct) {
            const wrap = document.getElementById(wrapId);
            if (!wrap || wrap.style.display === 'none') return;
            const currentLeft = parseFloat(wrap.style.left) || 50;
            const distance = Math.abs(newLeftPct - currentLeft);
            const moveDuration = Math.max(0.5, distance / MYROOM_WALK_SPEED_PCT_PER_SEC).toFixed(2); // 一定速度になるよう距離から逆算
            wrap.style.transition = `left ${moveDuration}s linear, bottom ${moveDuration}s linear`;
            wrap.style.left = newLeftPct + '%';
            wrap.style.bottom = newBottomPct + '%';
            const inner = document.getElementById(wrapId.replace('-breathe-wrap', '-inner'));
            if (inner) inner.classList.add('myroom-walking');
            playAudioFile('audio/move_small.mp3', 0.12);
            const prefix = wrapId.replace('-breathe-wrap', '');
            setMyroomMouthHidden(prefix, 'walk', true); // 👄 歩いている間は口を開ける（叫び中なら叫び終わるまでは戻さない）
            setTimeout(() => {
                if (inner) inner.classList.remove('myroom-walking');
                setMyroomMouthHidden(prefix, 'walk', false); // 止まったら口を閉じる（他に理由が残っていなければ）
            }, moveDuration * 1000);
        }

        // ===================================================================
        // 🎭 マイルームのアクション（叫ぶ・ごはん・タップ）：一人で遊ぶ時も、二人で遊ぶ時も使える。
        // ライブセッション中は、自分が起こした演出をroomSessions.roomActionに書き込み、相手の画面にも
        // 同じ演出を再生させることで、2人の見え方をなるべく揃える（報酬・スコアには一切影響しない）
        // ===================================================================
        export let myroomFeedDragState = null;
        export let myroomFeedPickerContext = 'visit';
        export let lastMyroomTapSentAt = 0;
        export let lastAppliedRoomActionTs = 0; // 相手発の演出イベントの二重再生防止
        export function setLastAppliedRoomActionTs(v) { lastAppliedRoomActionTs = v; }
        export let lastAppliedOtherWalkTs = 0;  // 相手発の歩行イベントの二重再生防止
        export function setLastAppliedOtherWalkTs(v) { lastAppliedOtherWalkTs = v; }

        // 今の画面文脈（'visit'=訪問/招待中の部屋、'edit'=自分の部屋のプレビュー画面）における
        // 「自分のアバターのprefix」「（いれば）相手のアバターのprefix」を返す
        export function getMyroomActionContext(context) {
            if (context === 'edit') return { selfPrefix: 'myroom-mochisuke', otherPrefix: null };
            if (activeChatRoomId && myAvatarPrefix) return { selfPrefix: myAvatarPrefix, otherPrefix: otherAvatarPrefix };
            return { selfPrefix: 'visit-myroom-mochisuke', otherPrefix: null };
        }
        export function toggleMyroomActionMenu(context) {
            const menu = document.getElementById(context + '-myroom-action-submenu');
            if (menu) menu.classList.toggle('show');
        }
        export function closeMyroomActionMenu(context) {
            const menu = document.getElementById(context + '-myroom-action-submenu');
            if (menu) menu.classList.remove('show');
        }

        // 👉 もちすけをタップ：自分・相手どちらのもちすけをタップしても遊べる、報酬なしの触れ合い演出
        export function onMyroomAvatarTap(prefix) {
            playMyroomTapEffect(prefix);
            const now = Date.now();
            // 🐛連打対策：タップは瞬間的に大量発生しうるので、見た目の反映は毎回でも、
            // Firestoreへの同期だけは間引く（300msに1回まで）。通信コストを抑えるため
            if (activeChatRoomId && window.sendRoomAction && now - lastMyroomTapSentAt > 300) {
                lastMyroomTapSentAt = now;
                window.sendRoomAction(activeChatRoomId, { type: 'tap', targetPrefix: prefix, byUid: window.getMyUid && window.getMyUid(), ts: now });
            }
        }

        // 🗣️ 叫ぶ：自分のもちすけだけが対象（タップ画面の「じらされ過ぎて叫ぶ」演出の使い回し）
        export function onMyroomScreamTap(context) {
            closeMyroomActionMenu(context);
            const { selfPrefix } = getMyroomActionContext(context);
            playMyroomScreamEffect(selfPrefix);
            if (activeChatRoomId && window.sendRoomAction) {
                window.sendRoomAction(activeChatRoomId, { type: 'scream', targetPrefix: selfPrefix, byUid: window.getMyUid && window.getMyUid(), ts: Date.now() });
            }
        }

        // 🍙 ごはん：倉庫で持っているおみやげから選ばせる（タップ画面と違い、無制限・タップ力バフなし）
        export function onMyroomFeedTap(context) {
            closeMyroomActionMenu(context);
            myroomFeedPickerContext = context;
            renderMyroomFeedPicker();
            document.getElementById('myroom-feed-picker-panel').classList.add('show');
        }
        export function closeMyroomFeedPicker() {
            document.getElementById('myroom-feed-picker-panel').classList.remove('show');
        }
        export function renderMyroomFeedPicker() {
            const grid = document.getElementById('myroom-feed-picker-grid');
            if (!grid) return;
            grid.innerHTML = '';
            const owned = stages.map((s, i) => ({ s, i, lv: purchasedItems[i] || 0 })).filter(o => o.lv > 0);
            if (owned.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#fff; font-size:0.8rem; padding:20px;">まだ持っているおみやげがありません</div>`;
                return;
            }
            owned.forEach(({ s, i }) => {
                const cell = document.createElement('div');
                cell.style.cssText = 'text-align:center; cursor:pointer; padding:6px; border-radius:10px; background:#fff8ec;';
                cell.innerHTML = `<img src="${s.itemImg}" alt="${escapeHtml(s.item)}" style="width:100%; aspect-ratio:1; object-fit:contain;">
                    <div style="font-size:0.6rem; font-weight:bold; color:#5d4037; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(s.item)}</div>`;
                cell.onclick = () => { closeMyroomFeedPicker(); placeMyroomFeedIcon(i); };
                grid.appendChild(cell);
            });
        }
        // 選んだおみやげのアイコンを自分のもちすけの近くに置く。タップ画面と同じく、これをドラッグして
        // どちらかのもちすけの上まで運んで離すと食べてくれる（離した場所で対象が自動的に決まる）
        export function placeMyroomFeedIcon(idx) {
            const stage = stages[idx];
            const { selfPrefix } = getMyroomActionContext(myroomFeedPickerContext);
            const selfWrap = document.getElementById(selfPrefix + '-breathe-wrap');
            if (!stage || !selfWrap) return;
            const old = document.getElementById('myroom-feed-placed-icon');
            if (old) old.remove();
            const rect = selfWrap.getBoundingClientRect();
            const icon = document.createElement('img');
            icon.id = 'myroom-feed-placed-icon';
            icon.src = stage.itemImg;
            icon.alt = stage.item;
            icon.className = 'myroom-feed-icon-drop-in';
            icon.style.cssText = `position:fixed; width:64px; height:64px; object-fit:contain; z-index:99999;
                left:${rect.left + rect.width / 2}px; top:${rect.bottom + 20}px; transform:translate(-50%,-50%);
                filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4)); touch-action:none; cursor:grab;`;
            document.body.appendChild(icon);
            icon.addEventListener('pointerdown', (e) => startMyroomFeedDrag(idx, icon, e));
        }
        export function startMyroomFeedDrag(idx, icon, e) {
            e.preventDefault();
            icon.classList.remove('myroom-feed-icon-drop-in');
            icon.style.cursor = 'grabbing';
            icon.style.transition = 'none';
            myroomFeedDragState = { idx, icon };
            document.addEventListener('pointermove', onMyroomFeedDragMove);
            document.addEventListener('pointerup', onMyroomFeedDragEnd);
            document.addEventListener('pointercancel', onMyroomFeedDragEnd);
        }
        export function onMyroomFeedDragMove(e) {
            if (!myroomFeedDragState) return;
            myroomFeedDragState.icon.style.left = e.clientX + 'px';
            myroomFeedDragState.icon.style.top = e.clientY + 'px';
        }
        export function onMyroomFeedDragEnd(e) {
            if (!myroomFeedDragState) return;
            const { idx, icon } = myroomFeedDragState;
            document.removeEventListener('pointermove', onMyroomFeedDragMove);
            document.removeEventListener('pointerup', onMyroomFeedDragEnd);
            document.removeEventListener('pointercancel', onMyroomFeedDragEnd);
            myroomFeedDragState = null;
            const { selfPrefix, otherPrefix } = getMyroomActionContext(myroomFeedPickerContext);
            const x = e.clientX, y = e.clientY;
            let targetPrefix = null;
            for (const p of [selfPrefix, otherPrefix]) {
                if (!p) continue;
                const wrap = document.getElementById(p + '-breathe-wrap');
                if (!wrap || wrap.style.display === 'none') continue;
                const r = wrap.getBoundingClientRect();
                if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { targetPrefix = p; break; }
            }
            if (targetPrefix) {
                icon.remove();
                playMyroomFeedEffect(targetPrefix, idx);
                if (activeChatRoomId && window.sendRoomAction) {
                    window.sendRoomAction(activeChatRoomId, { type: 'feed', targetPrefix, itemIdx: idx, byUid: window.getMyUid && window.getMyUid(), ts: Date.now() });
                }
            } else {
                // 的を外したら、自分のもちすけの足元に戻して、またやり直せるようにする
                const selfWrap = document.getElementById(selfPrefix + '-breathe-wrap');
                if (selfWrap) {
                    const r = selfWrap.getBoundingClientRect();
                    icon.style.transition = 'left 0.3s ease-out, top 0.3s ease-out';
                    icon.style.left = (r.left + r.width / 2) + 'px';
                    icon.style.top = (r.bottom + 20) + 'px';
                    icon.style.cursor = 'grab';
                    setTimeout(() => { icon.style.transition = 'none'; }, 320);
                }
            }
        }

        // ===== 実際の見た目の演出（自分の操作でも、相手から届いた同期でも、この共通関数を使う） =====
        export function playMyroomTapEffect(prefix) {
            const wrap = document.getElementById(prefix + '-breathe-wrap');
            const inner = document.getElementById(prefix + '-inner');
            if (!wrap || wrap.style.display === 'none' || !inner) return;
            playAudioFile('audio/tap.mp3');
            inner.animate([
                { transform: 'scale(1, 1)' },
                { transform: 'scale(1.15, 0.85)', offset: 0.4 },
                { transform: 'scale(1, 1)' }
            ], { duration: 220, easing: 'ease-out' });
            const rect = wrap.getBoundingClientRect();
            spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 6, '#ffcc80');
        }
        // 😱🐛修正：タップ画面と同じimage_scream.webpに差し替えるようにした。マイルームの体は
        // 「衣装(clothes)」「帽子/顔」「フルボディ衣装」に分かれた重ね着き構造なので、タップ画面の
        // 単一画像(mochiBtnElement.src)swapと同じ見た目にするため、叫んでいる間だけ帽子・顔・
        // フルボディ衣装を隠して衣装レイヤーだけをimage_scream.webpに差し替え、終わったら全て元に戻す
        export const myroomScreamState = {}; // prefixごとに、叫ぶ前の状態を覚えておいて正確に巻き戻す
        export function playMyroomScreamEffect(prefix) {
            const wrap = document.getElementById(prefix + '-breathe-wrap');
            const inner = document.getElementById(prefix + '-inner');
            const clothesEl = document.getElementById(prefix + '-clothes');
            if (!wrap || wrap.style.display === 'none' || !inner || !clothesEl) return;
            playAudioFile('audio/mochisuke/mochi_scream.mp3');
            vibrate([20, 30, 20]);
            const hatEl = document.getElementById(prefix + '-hat');
            const faceEl = document.getElementById(prefix + '-face');
            const fullbodyEl = document.getElementById(prefix + '-fullbody');
            let state = myroomScreamState[prefix];
            if (state) {
                clearTimeout(state.revertTimeout); // 連続で叫んだ場合、古いタイマーに巻き戻されないようにする
            } else {
                state = {
                    prevClothesSrc: clothesEl.src,
                    prevClothesOpacity: clothesEl.style.opacity,
                    prevHatDisplay: hatEl ? hatEl.style.display : '',
                    prevFaceDisplay: faceEl ? faceEl.style.display : '',
                    prevFullbodyDisplay: fullbodyEl ? fullbodyEl.style.display : ''
                };
                myroomScreamState[prefix] = state;
            }
            clothesEl.src = 'ui_images/mochisuke/image_scream.webp';
            clothesEl.style.opacity = '1'; // 🤖フルボディ衣装中は衣装レイヤーが隠れている(opacity:0)ので、叫ぶ間だけ見せる
            if (hatEl) hatEl.style.display = 'none';
            if (faceEl) faceEl.style.display = 'none';
            if (fullbodyEl) fullbodyEl.style.display = 'none';
            // 👄🐛修正：歩行中に叫んで、叫んでいる途中で歩行が止まっても口閉じパーツが復活しないよう、
            // 歩行と共通の理由ベースの管理(setMyroomMouthHidden)を使う（全身衣装中は自動で触らない）
            setMyroomMouthHidden(prefix, 'scream', true);
            // 🐛修正：タップ画面用の.mochi-screamはscale(1.5)固定で、部屋の中では小さいもちすけが
            // 急に大きくなりすぎて浮いて見える（他の一人と重なることもある）ため、拡大率を控えめにした
            // マイルーム専用クラスを使う（見た目の大きさへの配慮）
            inner.classList.remove('myroom-avatar-scream');
            void inner.offsetWidth;
            inner.classList.add('myroom-avatar-scream');
            state.revertTimeout = setTimeout(() => revertMyroomScreamEffect(prefix), 2600); // タップ画面と同じ長さキープ
            const rect = wrap.getBoundingClientRect();
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 30 + Math.random() * 50;
                    const x = rect.left + rect.width / 2 + Math.cos(angle) * dist;
                    const y = rect.top + rect.height / 3 + Math.sin(angle) * dist - 20;
                    spawnModalFloatingText(x, y, 'あ゛', '#e91e63', (1.1 + Math.random() * 0.7) + 'rem');
                }, i * 55);
            }
        }
        // 叫び終わったら、衣装・帽子・顔・フルボディ衣装の表示状態を叫ぶ前と完全に一致するよう戻す
        export function revertMyroomScreamEffect(prefix) {
            const state = myroomScreamState[prefix];
            if (!state) return;
            clearTimeout(state.revertTimeout);
            const inner = document.getElementById(prefix + '-inner');
            const clothesEl = document.getElementById(prefix + '-clothes');
            const hatEl = document.getElementById(prefix + '-hat');
            const faceEl = document.getElementById(prefix + '-face');
            const fullbodyEl = document.getElementById(prefix + '-fullbody');
            if (inner) inner.classList.remove('myroom-avatar-scream');
            if (clothesEl) { clothesEl.src = state.prevClothesSrc; clothesEl.style.opacity = state.prevClothesOpacity; }
            if (hatEl) hatEl.style.display = state.prevHatDisplay;
            if (faceEl) faceEl.style.display = state.prevFaceDisplay;
            if (fullbodyEl) fullbodyEl.style.display = state.prevFullbodyDisplay;
            setMyroomMouthHidden(prefix, 'scream', false); // 叫び終わり（他に理由が残っていなければ口閉じパーツを復活させる）
            delete myroomScreamState[prefix];
        }
        export function playMyroomFeedEffect(prefix, idx) {
            const wrap = document.getElementById(prefix + '-breathe-wrap');
            const inner = document.getElementById(prefix + '-inner');
            const stage = stages[idx];
            if (!wrap || wrap.style.display === 'none' || !inner || !stage) return;
            playAudioFile('audio/mochisuke/mochi_eat.mp3');
            vibrate([20, 40, 20]);
            inner.animate([
                { transform: 'scale(1, 1) rotate(0deg)' },
                { transform: 'scale(1.25, 0.8) rotate(-4deg)', offset: 0.25 },
                { transform: 'scale(0.85, 1.2) rotate(4deg)', offset: 0.5 },
                { transform: 'scale(1.1, 0.92) rotate(-2deg)', offset: 0.75 },
                { transform: 'scale(1, 1) rotate(0deg)' }
            ], { duration: 500, easing: 'ease-in-out' });
            const rect = wrap.getBoundingClientRect();
            spawnModalFloatingText(rect.left + rect.width / 2, rect.top + rect.height / 3, `${stage.item}おいしい〜！`, '#ff9800', '1rem');
            spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 10, '#ffd54f');
        }
        // 🎭 相手から届いた演出イベントを、自分の画面でも再生する（自分自身の書き込みは無視する）
        export function applyRemoteRoomAction(action) {
            if (!action || !action.targetPrefix) return;
            if (action.type === 'scream') playMyroomScreamEffect(action.targetPrefix);
            else if (action.type === 'feed') playMyroomFeedEffect(action.targetPrefix, action.itemIdx);
            else if (action.type === 'tap') playMyroomTapEffect(action.targetPrefix);
        }
        export function renderVisitMyroomLayout(myroomData) {
            const wallpaperItem = MYROOM_ITEMS.wallpaper.find(i => i.id === myroomData.wallpaper) || MYROOM_ITEMS.wallpaper[0];
            const flooringItem = MYROOM_ITEMS.flooring.find(i => i.id === myroomData.flooring) || MYROOM_ITEMS.flooring[0];
            document.getElementById('visit-myroom-wallpaper').src = wallpaperItem.img;
            document.getElementById('visit-myroom-flooring').src = flooringItem.img;
            const layer = document.getElementById('visit-myroom-furniture-layer');
            layer.innerHTML = '';
            ['wall_deco', 'big_furniture', 'table', 'small_deco'].forEach(cat => {
                (myroomData[cat] || []).forEach(inst => {
                    const item = MYROOM_ITEMS[cat] && MYROOM_ITEMS[cat].find(i => i.id === inst.itemId);
                    if (!item) return;
                    const el = document.createElement('img');
                    el.src = item.img;
                    el.style.cssText = `position:absolute; top:${inst.top}%; left:${inst.left}%; width:${item.width}%; height:${item.height}%; transform:${inst.flip ? 'scaleX(-1)' : 'none'}; z-index:${inst.zIndex || 10};`;
                    layer.appendChild(el);
                });
            });
        }
        export function applyVisitOutfit(outfit, prefix) {
            const fullbodyId = outfit && outfit.fullbody;
            const clothesEl = document.getElementById(`${prefix}-clothes`);
            const fullbodyEl = document.getElementById(`${prefix}-fullbody`);
            if (fullbodyId) {
                const fbItem = KISEKAE_ITEMS.fullbody.find(i => i.id === fullbodyId);
                if (fbItem) { fullbodyEl.src = fbItem.img; fullbodyEl.style.display = 'block'; }
                clothesEl.style.opacity = '0';
                ['hat', 'face'].forEach(cat => { document.getElementById(`${prefix}-${cat}`).style.display = 'none'; });
                const mouthAnchorEl = document.getElementById(`${prefix}-mouth-anchor`);
                if (mouthAnchorEl) { mouthAnchorEl.style.display = 'none'; mouthAnchorEl.dataset.fullbody = '1'; }
            } else {
                fullbodyEl.style.display = 'none';
                clothesEl.style.opacity = '1';
                const mouthAnchorEl2 = document.getElementById(`${prefix}-mouth-anchor`);
                if (mouthAnchorEl2) { mouthAnchorEl2.style.display = 'block'; mouthAnchorEl2.dataset.fullbody = '0'; }
                const clothesItem = (outfit && KISEKAE_ITEMS.clothes.find(i => i.id === outfit.clothes)) || KISEKAE_ITEMS.clothes[0];
                clothesEl.src = clothesItem.img;
                ['hat', 'face'].forEach(cat => {
                    const el = document.getElementById(`${prefix}-${cat}`);
                    const itemId = outfit && outfit[cat];
                    const item = itemId ? KISEKAE_ITEMS[cat].find(i => i.id === itemId) : null;
                    if (item) {
                        el.src = item.img;
                        el.style.display = 'block';
                        el.style.top = item.top + '%'; el.style.left = item.left + '%';
                        el.style.width = item.width + '%'; el.style.height = item.height + '%';
                        el.style.transform = `rotate(${item.rotation || 0}deg)`;
                    } else {
                        el.style.display = 'none';
                    }
                });
            }
            const backId = (outfit && !fullbodyId) ? outfit.back : null;
            const leftEl = document.getElementById(`${prefix}-wing-left`);
            const rightEl = document.getElementById(`${prefix}-wing-right`);
            const backItem = backId ? KISEKAE_ITEMS.back.find(i => i.id === backId) : null;
            if (backItem) {
                leftEl.style.display = 'block'; rightEl.style.display = 'block';
                leftEl.src = backItem.leftFrames[0]; rightEl.src = backItem.rightFrames[0];
                const lp = backItem.leftFramePos[0], rp = backItem.rightFramePos[0];
                leftEl.style.top = lp.top + '%'; leftEl.style.left = lp.left + '%';
                leftEl.style.width = backItem.width + '%'; leftEl.style.height = backItem.height + '%';
                rightEl.style.top = rp.top + '%'; rightEl.style.left = rp.left + '%';
                rightEl.style.width = backItem.width + '%'; rightEl.style.height = backItem.height + '%';
            } else {
                leftEl.style.display = 'none'; rightEl.style.display = 'none';
            }
        }
        // 🚫🚨 訪問中の相手をブロック・通報する
        export async function sendVisitStamp(text) {
            // 💬 ライブチャット中は、定型文もそのままチャットへ即送信する（相手にリアルタイムで届く）。
            // 🐛修正：isStamp=trueで送ることで、13歳未満が関わり自由文チャットが無効なペアでも
            // 定型スタンプだけは送れるようにする（Firestoreルール側もこのフラグを見て許可する）。
            // また送信結果を確認せず「送れたつもり」にしていたのも直し、失敗時は知らせる
            if (activeChatRoomId) {
                const now = Date.now();
                if (now - lastChatSendAt < CHAT_SEND_COOLDOWN_MS) return;
                setLastChatSendAt(now);
                const res = await window.sendRoomChatMessage(activeChatRoomId, text, true);
                if (!res || !res.success) {
                    alert('⚠️ 送信できませんでした。時間を置いて試してください');
                    console.error("スタンプ送信失敗の詳細:", res);
                }
                return;
            }
            if (!visitingUid || !window.sendVisitStampMsg) return;
            const res = await window.sendVisitStampMsg(visitingUid, text);
            if (res.success) {
                alert(`「${text}」を送りました！`);
            } else {
                alert('送信できませんでした。時間を置いて試してください');
            }
        }
        export function onBlockUserTap() {
            const targetUid = visitingUid || activeChatOtherUid;
            if (!targetUid) return;
            const label = document.getElementById('visit-myroom-name-label').textContent;
            if (!confirm(`${label}\n\nこの人をブロックしますか？\n今後、この人からの招待・スタンプ・チャットが届かなくなります。`)) return;
            if (!blockedUserIds.includes(targetUid)) blockedUserIds.push(targetUid);
            saveGame();
            alert('🚫 ブロックしました');
            closeVisitMyroom();
        }
        export async function onReportUserTap() {
            const targetUid = visitingUid || activeChatOtherUid;
            if (!targetUid) return;
            const reason = prompt('通報の理由を教えてください（任意）');
            if (reason === null) return; // キャンセル
            const label = document.getElementById('visit-myroom-name-label').textContent;
            if (window.reportUser) {
                const res = await window.reportUser(targetUid, label, reason);
                if (res.success) alert('🚨 通報しました。ご協力ありがとうございます。');
                else alert('通報を送信できませんでした。時間を置いて試してください');
            }
        }
        export function closeFriendScreen() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('friend-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        export let currentFriendTab = 'list';
        export function switchFriendTab(tab) {
            currentFriendTab = tab;
            ['list', 'favorite', 'add'].forEach(t => {
                document.getElementById(`friend-tab-${t}`).classList.toggle('active', t === tab);
            });
            document.getElementById('friend-list-view').style.display = (tab === 'add') ? 'none' : 'block';
            document.getElementById('friend-add-view').style.display = (tab === 'add') ? 'block' : 'none';
            if (tab === 'list' || tab === 'favorite') renderFriendList();
        }
        export async function copyMyFriendCode() {
            const code = document.getElementById('my-friend-code').innerText;
            if (!code || code.includes('（') || code.includes('読み込み')) return;
            const result = document.getElementById('friend-add-result');
            try {
                if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unsupported');
                await navigator.clipboard.writeText(code);
                result.style.color = '#4caf50';
                result.innerText = 'コピーしました！';
            } catch (e) {
                // 🐛修正：自動コピーが失敗しても気づけず「コピーしました」と表示していたため、
                // 古い内容のままペーストして「コードが見つからない」バグに繋がっていた。
                // 失敗時は、コードを選択状態にして、長押しで手動コピーできるようにする
                result.style.color = '#e57373';
                result.innerText = '自動コピーに失敗しました。コードを長押しして選択・コピーしてください';
                const codeEl = document.getElementById('my-friend-code');
                try {
                    const range = document.createRange();
                    range.selectNodeContents(codeEl);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch (err) {}
            }
        }
        export async function onAddFriendTap() {
            const input = document.getElementById('friend-code-input');
            const result = document.getElementById('friend-add-result');
            // 🐛保険：コピペ時に紛れ込む改行・空白などの見えない文字を除去してから照合する
            const code = input.value.trim().replace(/[^A-Za-z0-9]/g, '');
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
            } else if (res.reason === 'not_found') {
                result.style.color = '#e57373'; result.innerText = 'そのコードは見つかりませんでした';
            } else if (res.reason === 'self') {
                result.style.color = '#e57373'; result.innerText = '自分のコードは追加できません';
            } else {
                const errMsg = `通信エラーが発生しました${res.errorMessage ? '\n(' + res.errorMessage + ')' : ''}`;
                result.style.color = '#e57373'; result.innerText = errMsg;
                if (res.errorMessage) alert(`⚠️ フレンド追加エラーの詳細：\n${res.errorMessage}`); // 見逃さないよう、確実に表示する
            }
        }
        export function toggleFavoriteFriend(uid) {
            const idx = favoriteFriendIds.indexOf(uid);
            if (idx >= 0) favoriteFriendIds.splice(idx, 1);
            else favoriteFriendIds.push(uid);
            saveGame();
            renderFriendList();
        }
        window.toggleFavoriteFriend = toggleFavoriteFriend; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        export let lastGiftSentDateStr = null; // 🐛修正：1日1回までの送信制限。セーブデータにも保存し、リロードでリセットされないようにする
        export async function sendGachaCoinGift(uid, btnEl) {
            const todayStr = new Date().toISOString().slice(0, 10);
            if (lastGiftSentDateStr === todayStr) {
                alert('🪙 今日はもう送りました。また明日！');
                return;
            }
            if (!window.isRankingReady || !window.isRankingReady()) {
                alert('通信エラー：時間を置いて試してください');
                return;
            }
            btnEl.disabled = true;
            const res = await window.sendGiftCoin(uid);
            if (res.success) {
                lastGiftSentDateStr = todayStr;
                btnEl.innerHTML = '✅';
                playAudioFile('audio/levelup.mp3');
                saveGame();
            } else {
                btnEl.disabled = false;
                alert('送信できませんでした。時間を置いて試してください');
            }
        }
        window.sendGachaCoinGift = sendGachaCoinGift; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        export async function renderFriendList() {
            const listEl = document.getElementById('friend-list-view');
            listEl.innerHTML = `<div style="text-align:center; color:#aaa; padding:14px;">読み込み中...</div>`;
            if (!window.isRankingReady || !window.isRankingReady()) {
                listEl.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">通信エラーのため、フレンド一覧を表示できません</div>`;
                return;
            }
            let friends = await window.fetchFriendList();
            if (!friends) friends = [];
            if (currentFriendTab === 'favorite') friends = friends.filter(f => favoriteFriendIds.includes(f.uid));

            if (friends.length === 0) {
                listEl.innerHTML = currentFriendTab === 'favorite'
                    ? `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">まだお気に入りがいません。<br>フレンド一覧の⭐を押して登録してみましょう！</div>`
                    : `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:14px;">まだフレンドがいません。<br>「追加」タブから、コードを教え合って追加してみましょう！</div>`;
                return;
            }
            listEl.innerHTML = '';
            const todayStr = new Date().toISOString().slice(0, 10);
            const alreadySentToday = lastGiftSentDateStr === todayStr;
            friends.sort((a, b) => b.score - a.score);
            friends.forEach(f => {
                const isFav = favoriteFriendIds.includes(f.uid);
                const row = document.createElement('div');
                row.style.cssText = `display:flex; align-items:center; gap:8px; padding:9px 8px; margin-bottom:6px; border-radius:12px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.08);`;
                row.innerHTML = `
                    <div style="flex-shrink:0; position:relative; width:44px; height:44px;">${renderRankOutfitPreviewHtml(f.outfit)}</div>
                    <div style="flex-shrink:0; align-self:stretch; width:1px; background:#e0d5c5;"></div>
                    <div style="flex:1; min-width:0; padding-left:4px;">
                        <div style="font-size:0.88rem; color:#5d4037; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.name)}</div>
                        <div style="font-size:0.62rem; color:#aaa; margin-top:2px;">ID: ${f.friendCode}</div>
                    </div>
                    <button onclick="toggleFavoriteFriend('${f.uid}')" style="flex-shrink:0; background:none; border:none; font-size:1.2rem; padding:4px;">${isFav ? '⭐' : '☆'}</button>
                    <button onclick="visitMyroomOf('${f.uid}', true)" style="flex-shrink:0; background:#8d6e63; color:#fff; border:none; border-radius:50%; width:34px; height:34px; font-size:1rem;">🏠</button>
                    <button onclick="sendGachaCoinGift('${f.uid}', this)" ${alreadySentToday ? 'disabled' : ''} style="flex-shrink:0; background:${alreadySentToday ? '#ccc' : '#ff9800'}; color:#fff; border:none; border-radius:50%; width:38px; height:38px; font-size:1.2rem; font-weight:900;">🪙</button>
                `;
                listEl.appendChild(row);
            });
        }
        // 📜 招待する・される、その都度ごとに利用規約＆プライバシーポリシーへの同意を求める
        export let pendingRoomChatTermsAction = null;
        export function showRoomChatTermsModal(onAgree) {
            pendingRoomChatTermsAction = onAgree;
            openModal('room-chat-terms-modal');
        }
        export function onAgreeRoomChatTerms() {
            closeModal('room-chat-terms-modal');
            const action = pendingRoomChatTermsAction;
            pendingRoomChatTermsAction = null;
            if (action) action();
        }
        export function onCancelRoomChatTerms() {
            closeModal('room-chat-terms-modal');
            pendingRoomChatTermsAction = null;
        }
        // ✉️ フレンドをマイルームに招待する
        // 🐛修正：オンライン/オフラインの丸は開いた瞬間の一度きりの判定だったため、パネルを開いたまま
        // 待っていると、相手が後からオンラインになっても丸の色が変わらず「時間差がある」ように見えていた。
        // パネルを開いている間だけ、定期的に丸だけを再判定するタイマーを回す（リストの作り直しはしない）
        export let inviteFriendDotRefreshTimer = null;
        export function openMyroomInvitePanel() {
            document.getElementById('myroom-invite-panel').style.display = 'flex';
            renderMyroomInviteFriendList();
            clearInterval(inviteFriendDotRefreshTimer);
            inviteFriendDotRefreshTimer = setInterval(refreshMyroomInviteFriendDots, 10000);
        }
        export function closeMyroomInvitePanel() {
            document.getElementById('myroom-invite-panel').style.display = 'none';
            clearInterval(inviteFriendDotRefreshTimer);
            inviteFriendDotRefreshTimer = null;
        }
        export async function refreshMyroomInviteFriendDots() {
            if (!window.checkUserOnline) return;
            const dots = document.querySelectorAll('#myroom-invite-friend-list .friend-online-dot');
            for (const dot of dots) {
                const uid = dot.dataset.uid;
                if (!uid) continue;
                const online = await window.checkUserOnline(uid);
                dot.style.background = online ? '#4caf50' : '#e53935';
                dot.title = online ? 'オンライン' : 'オフライン';
            }
        }
        export async function renderMyroomInviteFriendList() {
            const listEl = document.getElementById('myroom-invite-friend-list');
            listEl.innerHTML = `<div style="text-align:center; color:#aaa; padding:10px;">読み込み中...</div>`;
            if (!window.isRankingReady || !window.isRankingReady()) {
                listEl.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:10px;">通信エラーです</div>`;
                return;
            }
            let friends = await window.fetchFriendList();
            friends = (friends || []).filter(f => !blockedUserIds.includes(f.uid)); // 🚫 ブロックした相手は一覧から除外
            if (!friends || friends.length === 0) {
                listEl.innerHTML = `<div style="text-align:center; color:#aaa; font-size:0.78rem; padding:10px;">まだフレンドがいません</div>`;
                return;
            }
            listEl.innerHTML = '';
            friends.forEach(f => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px; margin-bottom:6px; border-radius:10px; background:#fff;';
                row.innerHTML = `
                    <div style="flex-shrink:0; position:relative; width:36px; height:36px;">
                        ${renderRankOutfitPreviewHtml(f.outfit)}
                        <span class="friend-online-dot" data-uid="${f.uid}" style="position:absolute; right:-2px; bottom:-2px; width:12px; height:12px; border-radius:50%; background:#bbb; border:2px solid #fff; box-shadow:0 0 2px rgba(0,0,0,0.3);" title="確認中…"></span>
                    </div>
                    <div style="flex:1; min-width:0; font-size:0.8rem; color:#5d4037; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.name)}</div>
                    <button onclick="onSendRoomInviteTap('${f.uid}', this)" data-friend-name="${escapeHtml(f.name)}" style="flex-shrink:0; background:#42a5f5; color:#fff; border:none; border-radius:10px; padding:6px 12px; font-size:0.72rem; font-weight:900;">招待</button>
                `;
                listEl.appendChild(row);
            });
            // 🟢🔴 オンライン/オフラインは判明した端から非同期に丸の色を更新する（一覧の表示自体は待たせない）
            if (window.checkUserOnline) {
                friends.forEach(async (f) => {
                    const online = await window.checkUserOnline(f.uid);
                    const dot = listEl.querySelector(`.friend-online-dot[data-uid="${f.uid}"]`);
                    if (!dot) return;
                    dot.style.background = online ? '#4caf50' : '#e53935';
                    dot.title = online ? 'オンライン' : 'オフライン';
                });
            }
        }
        export async function onSendRoomInviteTap(uid, btnEl) {
            const guestName = btnEl.dataset.friendName || '名無しさん';
            await ensureChatEligibilityAnswered(); // 🎂 招待する側：初回だけ生年月日を確認する
            showRoomChatTermsModal(async () => {
                btnEl.disabled = true;
                btnEl.textContent = '...';
                const res = await window.sendRoomInvite(uid);
                if (res.success) {
                    btnEl.textContent = '✅送信済';
                    closeMyroomInvitePanel();
                    openHostWaitingRoom(uid, guestName);
                } else {
                    btnEl.disabled = false;
                    btnEl.textContent = '招待';
                    if (res.reason === 'offline_target') {
                        alert('🔴 相手は今オフラインのようです。オンラインの時にまた誘ってみてください');
                    } else {
                        alert('招待を送信できませんでした。時間を置いて試してください');
                    }
                }
            });
        }
        window.onSendRoomInviteTap = onSendRoomInviteTap; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        // 💌🐛修正：以前は45秒(招待)/20秒(スタンプ)おきにgetDocsで問い合わせる「ポーリング」方式だったため、
        // 実際に届くまで最大で数十秒の時間差があった。onSnapshotによるリアルタイム監視に切り替えることで、
        // Firestore側の書き込みとほぼ同時に検知できるようにする。
        export function startIncomingVisitStampWatch() {
            if (!window.isRankingReady || !window.isRankingReady()) { setTimeout(startIncomingVisitStampWatch, 500); return; }
            if (!window.listenIncomingVisitStamps) return; // 旧バージョンのindex.html併用時など、関数が無ければ何もしない
            window.listenIncomingVisitStamps((stamps) => {
                // 見つかった時点で（見るかどうかに関わらず）既読化するのは、ポーリング時代の挙動を踏襲
                stamps.forEach(s => { if (window.markVisitStampClaimed) window.markVisitStampClaimed(s.id); });
                const validStamps = stamps.filter(s => !blockedUserIds.includes(s.fromUid)); // 🚫 ブロックした相手からは無視する
                if (validStamps.length === 0) return;
                const latest = validStamps[validStamps.length - 1];
                setTimeout(() => {
                    alert(`💌 ${latest.fromName}さんから：「${latest.text}」`);
                }, 500);
            });
        }
        // ✉️ 自分宛の招待をリアルタイム監視する（起動時に一度だけ呼べば、以後は届いた瞬間に検知される）
        export function startIncomingRoomInviteWatch() {
            if (!window.isRankingReady || !window.isRankingReady()) { setTimeout(startIncomingRoomInviteWatch, 500); return; }
            if (!window.listenIncomingRoomInvites) return;
            window.listenIncomingRoomInvites((invites) => {
                invites.forEach(inv => { if (window.markRoomInviteClaimed) window.markRoomInviteClaimed(inv.id); });
                const validInvites = invites.filter(inv => !blockedUserIds.includes(inv.fromUid)); // 🚫 ブロックした相手からは無視する
                if (validInvites.length === 0) return;
                const latest = validInvites[validInvites.length - 1]; // 複数来ていても、直近1件だけ案内する
                setTimeout(() => {
                    if (confirm(`✉️ ${latest.fromName}さんが、あなたをお部屋に招待してくれたよ！\n見に行く？`)) {
                        (async () => {
                            await ensureChatEligibilityAnswered(); // 🎂 招待される側：初回だけ生年月日を確認する
                            showRoomChatTermsModal(() => {
                                joinFriendRoomAndChat(latest.fromUid, latest.fromName);
                            });
                        })();
                    }
                }, 400);
            });
        }
        export async function checkIncomingGiftsOnLaunch() {
            if (!window.isRankingReady || !window.isRankingReady()) return;
            const gifts = await window.checkIncomingGifts();
            if (!gifts || gifts.length === 0) return;
            const totalAmount = gifts.reduce((sum, g) => sum + (g.amount || 0), 0);
            setGachaCoins(gachaCoins + (totalAmount));
            saveGame(); updateDisplay();

            // 🏠❤️ 部屋のいいね由来と、フレンドからの直接送付を分けて、分かりやすく通知する
            const likeGifts = gifts.filter(g => g.reason === 'roomLike');
            const friendGifts = gifts.filter(g => g.reason !== 'roomLike');
            const messages = [];
            if (likeGifts.length > 0) {
                const likeAmount = likeGifts.reduce((sum, g) => sum + (g.amount || 0), 0);
                messages.push(`🏠 マイルームにいいね${likeGifts.length}個もらえた！ガチャコイン${likeAmount}枚ゲット！`);
            }
            if (friendGifts.length > 0) {
                const friendAmount = friendGifts.reduce((sum, g) => sum + (g.amount || 0), 0);
                const names = [...new Set(friendGifts.map(g => g.fromName))].join('、');
                messages.push(`🎁 ${names}さんから、ガチャコインを${friendAmount}枚もらいました！`);
            }
            setTimeout(() => {
                alert(messages.join('\n\n'));
            }, 800);
        }

        export function openMoveMenu() {
            openModal('move-menu-modal'); // 移動先を選ぶだけなので、ここではフェードしない（選んだ時にフェードする）
            renderMoveMenuParts();
            startMoveMochisukeLoop();
        }
        // 🐹 もちすけが、ものおき→ショップ→ゲーセン→マイルーム→戻る看板、の順に看板の右をワープして回る演出
        export const MOVE_MOCHISUKE_SIGN_ORDER = ['move-sign-warehouse', 'move-sign-shop', 'move-sign-arcade', 'move-sign-myroom', 'move-sign-return'];
        export let moveMochisukeLoopTimer = null;
        export let moveMochisukeLoopIndex = 0;
        export function startMoveMochisukeLoop() {
            stopMoveMochisukeLoop();
            moveMochisukeLoopIndex = 0;
            updateMoveMochisukePosition();
            moveMochisukeLoopTimer = setInterval(() => {
                moveMochisukeLoopIndex = (moveMochisukeLoopIndex + 1) % MOVE_MOCHISUKE_SIGN_ORDER.length;
                updateMoveMochisukePosition();
            }, 1500);
        }
        export function stopMoveMochisukeLoop() {
            if (moveMochisukeLoopTimer) clearInterval(moveMochisukeLoopTimer);
            moveMochisukeLoopTimer = null;
        }
        export function updateMoveMochisukePosition() {
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
        export function renderMoveMenuParts() {
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
        export function moveMenuGoTo(fn) {
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
        export function moveMenuGoHome() {
            moveMenuGoTo(() => {});
        }

        export function closeWarehouse() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('warehouse-modal');
                playBgmLoop('audio/bgm/bgm.mp3'); // 通常のBGMに戻す
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), 150);
            }, 300);
        }
        export function warehouseItemAction(action) {
            if (action === 'trophy') openTrophyRoom();
            else if (action === 'omiyage') openOmiyageCollection();
            else if (action === 'ticket') openTicketInventory();
            else if (action === 'diary') openDiary();
        }
        export function renderWarehouseItems() {
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
        export function setLastGiftSentDateStr(v) { lastGiftSentDateStr = v; }
        window.openFriendPlaceholder = openFriendPlaceholder;
        window.onLikeRoomTap = onLikeRoomTap;
        window.closeVisitMyroom = closeVisitMyroom;
        window.toggleMyroomActionMenu = toggleMyroomActionMenu;
        window.onMyroomAvatarTap = onMyroomAvatarTap;
        window.onMyroomScreamTap = onMyroomScreamTap;
        window.onMyroomFeedTap = onMyroomFeedTap;
        window.closeMyroomFeedPicker = closeMyroomFeedPicker;
        window.sendVisitStamp = sendVisitStamp;
        window.onBlockUserTap = onBlockUserTap;
        window.onReportUserTap = onReportUserTap;
        window.closeFriendScreen = closeFriendScreen;
        window.switchFriendTab = switchFriendTab;
        window.copyMyFriendCode = copyMyFriendCode;
        window.onAddFriendTap = onAddFriendTap;
        window.onAgreeRoomChatTerms = onAgreeRoomChatTerms;
        window.onCancelRoomChatTerms = onCancelRoomChatTerms;
        window.openMyroomInvitePanel = openMyroomInvitePanel;
        window.closeMyroomInvitePanel = closeMyroomInvitePanel;
        window.openMoveMenu = openMoveMenu;
        window.moveMenuGoTo = moveMenuGoTo;
        window.moveMenuGoHome = moveMenuGoHome;
        window.closeWarehouse = closeWarehouse;
