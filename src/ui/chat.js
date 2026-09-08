        // ===================================================================
        // ui.js から分割されたファイルです（マイルーム1対1ライブチャット（招待/参加・メッセージ送受信・年齢ゲート））。
        // 元々は1つの巨大な ui.js（4000行超）にすべて入っていましたが、見通しを良くするため
        // 機能ごとに src/ui/ 以下のファイルへ分割しました。ui.js 自身は今、この下の7ファイルを
        // まとめて re-export するだけの「窓口」になっています（他のファイルからの
        // import { X } from './ui.js' は今まで通りそのまま動きます）。
        // ===================================================================

        import { escapeHtml, playAudioFile } from '../../main.js?v=2026-09-08-004';
        import { equippedKisekae, equippedMyroom } from '../../progress.js?v=2026-09-08-004';
        import { closeModal, openModal } from './core.js?v=2026-09-08-004';
        import { applyRemoteRoomAction, applyVisitOutfit, applyVisitWalkTarget, closeVisitMyroom, lastAppliedOtherWalkTs, lastAppliedRoomActionTs, renderVisitMyroomLayout, setLastAppliedOtherWalkTs, setLastAppliedRoomActionTs, setVisitingUid, startVisitMochisukeWalk } from './social.js?v=2026-09-08-004';


        // ===================================================================
        // 💬🏠 マイルーム 1対1ライブチャット
        // 招待する/されるフローの間だけ、Firestoreの roomSessions/{roomId} をonSnapshotで監視し、
        // 相手の入退室・チャットメッセージをリアルタイムに反映する。
        // ===================================================================
        export let activeChatRoomId = null;      // 今参加している部屋セッションのID（未参加ならnull）
        export function setActiveChatRoomId(v) { activeChatRoomId = v; }
        export let activeChatOtherUid = null;    // 一緒にいる相手のuid
        export function setActiveChatOtherUid(v) { activeChatOtherUid = v; }
        export let activeChatIsHost = false;     // 自分が部屋の主(ホスト)かどうか
        export function setActiveChatIsHost(v) { activeChatIsHost = v; }
        export let myAvatarPrefix = null;        // 自分の見た目が表示されているDOM要素のprefix（ホストなら主役枠、ゲストなら訪問者枠）
        export function setMyAvatarPrefix(v) { myAvatarPrefix = v; }
        export let otherAvatarPrefix = null;     // 相手の見た目が表示されているDOM要素のprefix
        export function setOtherAvatarPrefix(v) { otherAvatarPrefix = v; }
        export let unsubRoomSession = null;      // セッション監視の解除関数
        export let unsubRoomMessages = null;     // チャット監視の解除関数
        export let roomHeartbeatTimer = null;
        export let lastChatSendAt = 0;
        export function setLastChatSendAt(v) { lastChatSendAt = v; }
        export let lastRenderedChatMsgId = null;
        export let chatMessageHistory = [];      // 履歴モーダル表示用に、今回のセッションの全メッセージを保持
        // 🐛修正：roomSessionsドキュメントは同じ2人の間で使い回されるため、messagesサブコレクションには
        // 過去すべての訪問回の会話が積み上がっている。表示だけをこの時刻(=今回の訪問開始時刻)以降に
        // 絞ることで「その回だけの履歴」に見せる（Firestore上のデータそのものは削除しない）
        export let activeChatSessionStartedAt = 0;
        export const CHAT_SEND_COOLDOWN_MS = 1200; // 連投防止（これより短い間隔では送信できない）
        export const CHAT_MAX_LEN = 200;
        export const CHAT_BUBBLE_DURATION_MS = 5000;
        // 🚫 簡易NGワードフィルタ（完全ではないが、うっかり系の暴言・個人情報っぽいワードを軽く抑止する）
        // 必要に応じてここに単語を追加してください。完璧な検閲ではなく、あくまで抑止目的です。
        export const CHAT_NG_WORDS = ['死ね', 'ころす', '殺す', 'きえろ', '消えろ'];
        export function containsNgWord(text) {
            return CHAT_NG_WORDS.some(w => text.includes(w));
        }

        // 🎂 チャット年齢ゲート：招待する/されるとき、まだ回答していなければ生年月日を聞く（初回のみ）
        export function calcAgeFromBirthdate(y, m, d) {
            const today = new Date();
            let age = today.getFullYear() - y;
            const hadBirthdayThisYear = (today.getMonth() + 1 > m) || (today.getMonth() + 1 === m && today.getDate() >= d);
            if (!hadBirthdayThisYear) age--;
            return age;
        }
        export let birthdateGateResolver = null;
        export function populateBirthdateGateSelects() {
            const yearSel = document.getElementById('birthdate-gate-year');
            if (!yearSel || yearSel.options.length > 0) return; // 初回だけ作る
            const nowY = new Date().getFullYear();
            for (let y = nowY; y >= nowY - 100; y--) {
                const opt = document.createElement('option'); opt.value = y; opt.textContent = y + '年'; yearSel.appendChild(opt);
            }
            const monthSel = document.getElementById('birthdate-gate-month');
            for (let m = 1; m <= 12; m++) { const opt = document.createElement('option'); opt.value = m; opt.textContent = m + '月'; monthSel.appendChild(opt); }
            const daySel = document.getElementById('birthdate-gate-day');
            for (let d = 1; d <= 31; d++) { const opt = document.createElement('option'); opt.value = d; opt.textContent = d + '日'; daySel.appendChild(opt); }
        }
        export function openBirthdateGateModal() {
            return new Promise((resolve) => {
                birthdateGateResolver = resolve;
                populateBirthdateGateSelects();
                openModal('birthdate-gate-modal');
            });
        }
        export async function onConfirmBirthdateGate() {
            const y = parseInt(document.getElementById('birthdate-gate-year').value, 10);
            const m = parseInt(document.getElementById('birthdate-gate-month').value, 10);
            const d = parseInt(document.getElementById('birthdate-gate-day').value, 10);
            if (!y || !m || !d) { alert('生年月日を選んでください'); return; }
            const eligible = calcAgeFromBirthdate(y, m, d) >= 13;
            if (window.setMyChatEligibility) await window.setMyChatEligibility(eligible);
            closeModal('birthdate-gate-modal');
            const resolver = birthdateGateResolver;
            birthdateGateResolver = null;
            if (!eligible) alert('13歳未満の方は、安全のため自由入力のチャットはご利用いただけません。定型スタンプでお相手とやり取りできます。');
            if (resolver) resolver(eligible);
        }
        // 既に回答済みならすぐ戻り、未回答ならモーダルで聞いてから戻る（何度招待しても2回目以降は聞かない）
        export async function ensureChatEligibilityAnswered() {
            if (!window.getMyChatEligibility || !window.isRankingReady || !window.isRankingReady()) return;
            const known = await window.getMyChatEligibility();
            if (known === null) await openBirthdateGateModal();
        }

        // 🕐 招待を送った側(ホスト)：ゲストを待つ部屋を開く
        export async function openHostWaitingRoom(guestUid, guestName) {
            if (!window.startRoomHostSession) { alert('通信環境を確認して、もう一度試してください'); return; }
            const roomId = await window.startRoomHostSession(guestUid);
            if (!roomId) { alert('招待の開始に失敗しました。時間を置いて試してください'); return; }
            setActiveChatRoomId(roomId);
            setActiveChatOtherUid(guestUid);
            setActiveChatIsHost(true);
            setMyAvatarPrefix('visit-myroom-mochisuke'); // ホストの自分＝部屋の主＝主役スロット
            setOtherAvatarPrefix('visit-myroom-myself');  // ゲストが来たら訪問者スロットに表示される
            setVisitingUid(null); // 自分の部屋なので「いいね」対象ではない

            document.getElementById('visit-myroom-name-label').textContent = `🏠 ${guestName}さんを招待中…`;
            renderVisitMyroomLayout(equippedMyroom); // 自分の部屋なのでローカルデータをそのまま使う（通信不要）
            applyVisitOutfit(equippedKisekae, 'visit-myroom-mochisuke');
            const myselfWrap = document.getElementById('visit-myroom-myself-breathe-wrap');
            myselfWrap.style.display = 'none';
            delete myselfWrap.dataset.shown;

            setVisitActionButtonsForHosting(true);
            setChatUiVisible(false);
            document.getElementById('visit-waiting-indicator').style.display = 'block';

            openModal('visit-myroom-modal');
            document.getElementById('visit-myroom-action-btn').style.display = 'flex'; // 🎭 一人で待っている間から使える
            startVisitMochisukeWalk('visit-myroom-mochisuke-breathe-wrap', 'visitHost');
            startRoomSessionWatch(roomId, guestName);
        }

        // 🚪 招待された側(ゲスト)：実際に部屋に入って、ホストと一緒に過ごす
        export async function joinFriendRoomAndChat(hostUid, hostNameFallback) {
            if (!window.fetchMyroomData || !window.joinRoomHostSession) return;
            const data = await window.fetchMyroomData(hostUid);
            if (!data || !data.myroom) { alert('🏠 まだお部屋が公開されていません'); return; }
            const roomId = await window.joinRoomHostSession(hostUid);
            if (!roomId) { alert('入室できませんでした。時間を置いて試してください'); return; }

            setActiveChatRoomId(roomId);
            setActiveChatOtherUid(hostUid);
            setActiveChatIsHost(false);
            setMyAvatarPrefix('visit-myroom-myself');     // ゲストの自分＝訪問者スロット
            setOtherAvatarPrefix('visit-myroom-mochisuke'); // 部屋の主(ホスト)＝主役スロット
            setVisitingUid(hostUid); // 既存の「いいね」機能もそのまま使えるようにする

            const hostName = data.name || hostNameFallback || '名無しさん';
            document.getElementById('visit-myroom-name-label').textContent = `🏠 ${hostName}さんと一緒にお部屋タイム`;
            renderVisitMyroomLayout(data.myroom);
            applyVisitOutfit(data.outfit, 'visit-myroom-mochisuke');
            const myselfWrap = document.getElementById('visit-myroom-myself-breathe-wrap');
            myselfWrap.style.display = 'block';
            myselfWrap.dataset.shown = '1';
            applyVisitOutfit(equippedKisekae, 'visit-myroom-myself');

            setVisitActionButtonsForHosting(false);
            // 🎂 チャットを表示してよいかは、セッションのchatEnabled（双方13歳以上か）に従う。
            // 実際の値はstartRoomSessionWatch()の監視コールバックが届き次第すぐ反映される
            setChatUiVisible(false);
            document.getElementById('visit-waiting-indicator').style.display = 'none';
            const likeBtn = document.getElementById('visit-like-btn');
            likeBtn.disabled = false;
            likeBtn.textContent = '❤️ いいね';
            likeBtn.style.background = '#e91e63';

            openModal('visit-myroom-modal');
            document.getElementById('visit-myroom-action-btn').style.display = 'flex'; // 🎭 ライブ訪問中はアクションボタンを表示する
            // 🚶🐛修正：ホスト側(相手)の見た目は自分ではランダムに歩かせず、相手から届く目的地(hostWalk)を
            // そのまま再生する。自分のアバターだけをここでランダムに歩かせ、目的地を相手にも伝える
            startVisitMochisukeWalk('visit-myroom-myself-breathe-wrap', 'visitSelf');
            startRoomSessionWatch(roomId, hostName);
        }

        export let lastRawChatMessages = []; // messagesサブコレクションの生データ（session開始時刻が後から判明した時の再フィルタ用）

        // 👀 セッション監視（相手の到着・退出を検知）＋チャット監視＋生存確認を、まとめて開始する
        export function startRoomSessionWatch(roomId, otherName) {
            stopRoomSessionWatch();
            // 🐛修正：本当のsessionStartedAtがFirestoreから届くまでの一瞬、フィルタが0のままだと
            // 過去の全履歴が一瞬だけ見えてしまう。届くまではInfinityにして「何も出さない」側に倒す
            activeChatSessionStartedAt = Infinity;
            unsubRoomSession = window.listenRoomSession(roomId, (data) => {
                if (!activeChatRoomId || roomId !== activeChatRoomId) return; // 既に退室済みなら無視
                if (!data || data.endedAt) {
                    handleRoomSessionEnded(otherName);
                    return;
                }
                // 🎂 chatEnabled（双方が13歳以上と確認できたペアかどうか）に応じて、
                // チャット用ボタン/入力欄の表示・非表示をここで一元的に切り替える
                setChatUiVisible(data.chatEnabled === true);
                // 🐛修正：今回の訪問セッションの開始時刻が判明/更新されたら、既に受信済みの
                // メッセージ一覧をこの時刻基準で再フィルタして表示し直す
                const newStart = typeof data.sessionStartedAt === 'number' ? data.sessionStartedAt : 0;
                if (newStart !== activeChatSessionStartedAt) {
                    activeChatSessionStartedAt = newStart;
                    renderChatMessages(lastRawChatMessages);
                }
                if (activeChatIsHost && data.guestPresentAt) {
                    const myselfWrap = document.getElementById('visit-myroom-myself-breathe-wrap');
                    if (!myselfWrap.dataset.shown) onGuestArrived(otherName);
                }
                // 🚶 相手側が選んだ歩行の目的地が届いたら、自分の画面でも同じ場所へ同じ速さで歩かせる
                // （自分でランダムに歩かせるのではなく、相手の選択をそのまま再生することで動きを揃える）
                const otherWalk = activeChatIsHost ? data.guestWalk : data.hostWalk;
                if (otherWalk && typeof otherWalk.ts === 'number' && otherWalk.ts !== lastAppliedOtherWalkTs && otherAvatarPrefix) {
                    setLastAppliedOtherWalkTs(otherWalk.ts);
                    applyVisitWalkTarget(otherAvatarPrefix + '-breathe-wrap', otherWalk.leftPct, otherWalk.bottomPct);
                }
                // 🎭 相手が起こした叫ぶ/ごはん/タップの演出イベントが届いたら、自分の画面でも同じ演出を再生する
                if (data.roomAction && typeof data.roomAction.ts === 'number' && data.roomAction.ts !== lastAppliedRoomActionTs) {
                    setLastAppliedRoomActionTs(data.roomAction.ts);
                    const myUid = window.getMyUid && window.getMyUid();
                    if (data.roomAction.byUid !== myUid) applyRemoteRoomAction(data.roomAction);
                }
            });
            unsubRoomMessages = window.listenRoomChatMessages(roomId, renderChatMessages);
            roomHeartbeatTimer = setInterval(() => {
                if (activeChatRoomId) window.sendRoomSessionHeartbeat(activeChatRoomId, activeChatIsHost);
            }, 15000);
        }

        export function stopRoomSessionWatch() {
            if (unsubRoomSession) { unsubRoomSession(); unsubRoomSession = null; }
            if (unsubRoomMessages) { unsubRoomMessages(); unsubRoomMessages = null; }
            if (roomHeartbeatTimer) { clearInterval(roomHeartbeatTimer); roomHeartbeatTimer = null; }
            lastRenderedChatMsgId = null;
            activeChatSessionStartedAt = 0;
            lastRawChatMessages = [];
            chatMessageHistory = [];
            setLastAppliedRoomActionTs(0);
            setLastAppliedOtherWalkTs(0);
            hideChatBubble('visit-myroom-mochisuke');
            hideChatBubble('visit-myroom-myself');
        }

        // 🎉 ホスト側：待っていたゲストが実際に部屋に来た瞬間の演出
        export async function onGuestArrived(guestName) {
            const myselfWrap = document.getElementById('visit-myroom-myself-breathe-wrap');
            myselfWrap.dataset.shown = '1';
            myselfWrap.style.display = 'block';
            document.getElementById('visit-waiting-indicator').style.display = 'none';
            document.getElementById('visit-myroom-name-label').textContent = `🏠 ${guestName}さんと一緒にお部屋タイム`;
            // 🎂 チャットの表示可否はstartRoomSessionWatch()の監視コールバック側(chatEnabled)に任せる
            playAudioFile('audio/levelup.mp3');
            if (activeChatOtherUid && window.fetchMyroomData) {
                const data = await window.fetchMyroomData(activeChatOtherUid);
                applyVisitOutfit(data && data.outfit, 'visit-myroom-myself');
            }
            // 🚶🐛修正：ゲスト(相手)の見た目は自分ではランダムに歩かせず、相手から届く目的地(guestWalk)を
            // そのまま再生する（=listenRoomSessionのコールバック側で処理）。ここでは何もしない
        }

        // 🚪🔴 相手が退出した／セッションが切れた時
        export function handleRoomSessionEnded(otherName) {
            if (!activeChatRoomId) return; // 既に自分から退室済み
            setActiveChatRoomId(null); setActiveChatOtherUid(null); setActiveChatIsHost(false);
            setMyAvatarPrefix(null); setOtherAvatarPrefix(null);
            stopRoomSessionWatch();
            if (document.getElementById('visit-myroom-modal').style.display === 'flex' || document.getElementById('visit-myroom-modal').classList.contains('modal-open')) {
                alert(`${otherName || 'お相手'}さんが部屋を後にしました`);
                closeVisitMyroom();
            }
        }

        // 💬📜 チャット用フローティングボタン（メッセージ・履歴）の表示切替。開くたびに入力バーは閉じた状態から始める
        export function setChatUiVisible(visible) {
            const toggleBtn = document.getElementById('visit-chat-toggle-btn');
            const historyBtn = document.getElementById('visit-chat-history-btn');
            const inputBar = document.getElementById('visit-chat-input-bar');
            if (toggleBtn) toggleBtn.style.display = visible ? 'flex' : 'none';
            if (historyBtn) historyBtn.style.display = visible ? 'flex' : 'none';
            // 🐛修正：ここが常に'none'を代入していたため、この関数が呼ばれるたび
            // （15秒ごとの生存確認ハートビートで相手のセッションが更新される度）に
            // 入力バーが強制的に閉じられ、入力中のキーボードまで閉じてしまっていた。
            // chatEnabled=falseの時だけ強制的に閉じ、trueの時は現在の開閉状態（💬ボタンでの
            // 開閉）に触れないようにする。
            if (inputBar && !visible) inputBar.style.display = 'none';
        }

        // 🏠 自分の部屋をホスト中は、他人の部屋にしか意味のないボタン（いいね・スタンプ行）を隠す
        export function setVisitActionButtonsForHosting(isHosting) {
            const stampRow = document.getElementById('visit-stamp-buttons-row');
            if (stampRow) stampRow.style.display = isHosting ? 'none' : 'flex';
        }

        // 💬 入力バーの開閉（💬ボタンを押した時）。開く時は入力欄にフォーカスしてキーボードを呼び出す
        export function toggleChatInputBar() {
            const bar = document.getElementById('visit-chat-input-bar');
            if (!bar) return;
            const showing = bar.style.display === 'flex';
            bar.style.display = showing ? 'none' : 'flex';
            if (!showing) {
                setTimeout(() => {
                    const input = document.getElementById('visit-chat-input');
                    if (input) input.focus();
                }, 50);
            }
        }

        // 💭 指定したアバターの頭上に、セリフとしてメッセージを表示する
        export function showChatBubble(prefix, text) {
            const bubble = document.getElementById(prefix + '-chat-bubble');
            if (!bubble) return;
            clearTimeout(bubble._hideTimer);
            bubble.textContent = text;
            bubble.classList.add('chat-bubble-show');
            bubble._hideTimer = setTimeout(() => bubble.classList.remove('chat-bubble-show'), CHAT_BUBBLE_DURATION_MS);
        }
        export function hideChatBubble(prefix) {
            const bubble = document.getElementById(prefix + '-chat-bubble');
            if (!bubble) return;
            clearTimeout(bubble._hideTimer);
            bubble.classList.remove('chat-bubble-show');
        }

        // 👂 新着メッセージが来るたびに呼ばれる：最新の1件をセリフ吹き出しで表示し、履歴も更新する
        // 🐛修正：roomSessionsのドキュメントは同じ2人の間で使い回され続けるため、messagesには
        // 過去すべての訪問回の会話が積み上がっている。ここでactiveChatSessionStartedAt以降の
        // メッセージだけに絞ることで、履歴には「今回の訪問分だけ」が表示されるようにする
        export function renderChatMessages(rawMsgs) {
            if (!activeChatRoomId) return;
            lastRawChatMessages = rawMsgs;
            const msgs = rawMsgs.filter(m => (m.createdAt || 0) >= activeChatSessionStartedAt);
            chatMessageHistory = msgs;
            if (msgs.length > 0) {
                const last = msgs[msgs.length - 1];
                if (last.id !== lastRenderedChatMsgId) {
                    lastRenderedChatMsgId = last.id;
                    const myUid = window.getMyUid && window.getMyUid();
                    const mine = last.fromUid === myUid;
                    showChatBubble(mine ? myAvatarPrefix : otherAvatarPrefix, last.text || '');
                }
            }
            renderChatHistoryModalContent();
        }

        // 📜 履歴モーダルの中身を「プレイヤー名：内容」の形式で描画する
        export function renderChatHistoryModalContent() {
            const el = document.getElementById('visit-chat-history-list');
            if (!el) return;
            if (chatMessageHistory.length === 0) {
                el.innerHTML = '<div style="text-align:center; color:#aaa; padding:20px 0;">まだメッセージがありません</div>';
                return;
            }
            el.innerHTML = chatMessageHistory.map(m =>
                `<div style="margin-bottom:8px;"><b>${escapeHtml(m.fromName || '???')}</b>：${escapeHtml(m.text || '')}</div>`
            ).join('');
            el.scrollTop = el.scrollHeight;
        }
        export function openChatHistoryModal() {
            renderChatHistoryModalContent();
            openModal('visit-chat-history-modal');
        }

        export async function sendFreeChatMessage() {
            if (!activeChatRoomId) return;
            const input = document.getElementById('visit-chat-input');
            const text = input.value.trim();
            if (!text) return;
            const now = Date.now();
            if (now - lastChatSendAt < CHAT_SEND_COOLDOWN_MS) return; // 連投防止
            if (containsNgWord(text)) { alert('⚠️ その言葉は送信できません'); return; }
            setLastChatSendAt(now);
            // 🐛修正：以前は送信結果を確認せず即座に入力欄を空にしていたため、送信に失敗しても
            // 見た目上は「送れたように」見えてしまっていた（実際には届いていなかった）。
            // 結果を確認し、失敗時は入力内容を残したまま理由を知らせる
            const res = await window.sendRoomChatMessage(activeChatRoomId, text.slice(0, CHAT_MAX_LEN));
            if (res && res.success) {
                input.value = '';
            } else {
                const codeText = res && res.code ? `（${res.code}）` : '';
                alert(`⚠️ メッセージを送信できませんでした${codeText}\nお手数ですが、この内容をスクリーンショットして開発者に伝えてください。`);
                console.error("チャット送信失敗の詳細:", res);
            }
        }

        // ⌨️ Enterキーで送信できるようにする（起動時に1回だけ登録）
        export function setupChatInputEnterKey() {
            const input = document.getElementById('visit-chat-input');
            if (!input) return;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); sendFreeChatMessage(); }
            });
        }
        window.onConfirmBirthdateGate = onConfirmBirthdateGate;
        window.toggleChatInputBar = toggleChatInputBar;
        window.openChatHistoryModal = openChatHistoryModal;
        window.sendFreeChatMessage = sendFreeChatMessage;
