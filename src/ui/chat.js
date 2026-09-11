        // ui.js を機能ごとに分割したファイルの1つ（マイルーム1対1ライブチャット（招待/参加・メッセージ送受信・年齢ゲート））。ui.js 自身は7ファイルをre-exportする窓口。

        import { escapeHtml, playAudioFile } from '../../main.js?v=2026-09-11-002';
        import { equippedKisekae, equippedMyroom } from '../../progress.js?v=2026-09-11-002';
        import { closeModal, openModal } from './core.js?v=2026-09-11-002';
        import { applyRemoteRoomAction, applyVisitOutfit, applyVisitWalkTarget, closeVisitMyroom, lastAppliedOtherWalkTs, lastAppliedRoomActionTs, renderVisitMyroomLayout, setLastAppliedOtherWalkTs, setLastAppliedRoomActionTs, setVisitingUid, startVisitMochisukeWalk } from './social.js?v=2026-09-11-002';

        // 🔧 このファイル内で使う調整可能な数値をまとめたもの（値は変更せず、既存のリテラルを名前付きに置き換えただけ）
        const CONFIG = {
            CHAT_ELIGIBLE_AGE_THRESHOLD: 13,   // この年齢以上なら自由入力チャットが利用可能
            ROOM_HEARTBEAT_INTERVAL_MS: 15000, // 部屋セッションの生存確認ハートビートを送る間隔
            CHAT_INPUT_FOCUS_DELAY_MS: 50,     // 入力バーを開いた直後、入力欄にフォーカスするまでの遅延
            BIRTHDATE_YEAR_RANGE_BACK: 100,    // 生年月日プルダウンで「今年」から何年前まで選べるようにするか
        };

        // ===================================================================
        // 💬🏠 マイルーム 1対1ライブチャット
        // 招待する/されるフローの間だけ、Firestoreの roomSessions/{roomId} をonSnapshotで監視し、
        // 相手の入退室・チャットメッセージをリアルタイムに反映する。
        // ===================================================================
        export let activeChatRoomId = null;      // 今参加している部屋セッションのID（未参加ならnull）
        /**
         * activeChatRoomId（今参加している部屋セッションのID）を更新する。
         * @param {string|null} v - 新しい部屋セッションID（未参加ならnull）
         * @returns {void}
         */
        export function setActiveChatRoomId(v) { activeChatRoomId = v; }
        export let activeChatOtherUid = null;    // 一緒にいる相手のuid
        /**
         * activeChatOtherUid（一緒にいる相手のuid）を更新する。
         * @param {string|null} v - 新しい相手のuid
         * @returns {void}
         */
        export function setActiveChatOtherUid(v) { activeChatOtherUid = v; }
        export let activeChatIsHost = false;     // 自分が部屋の主(ホスト)かどうか
        /**
         * activeChatIsHost（自分が部屋の主かどうか）を更新する。
         * @param {boolean} v - ホストならtrue、ゲストならfalse
         * @returns {void}
         */
        export function setActiveChatIsHost(v) { activeChatIsHost = v; }
        export let myAvatarPrefix = null;        // 自分の見た目が表示されているDOM要素のprefix（ホストなら主役枠、ゲストなら訪問者枠）
        /**
         * myAvatarPrefix（自分の見た目が表示されているDOM要素のprefix）を更新する。
         * @param {string|null} v - 新しいDOM要素のprefix
         * @returns {void}
         */
        export function setMyAvatarPrefix(v) { myAvatarPrefix = v; }
        export let otherAvatarPrefix = null;     // 相手の見た目が表示されているDOM要素のprefix
        /**
         * otherAvatarPrefix（相手の見た目が表示されているDOM要素のprefix）を更新する。
         * @param {string|null} v - 新しいDOM要素のprefix
         * @returns {void}
         */
        export function setOtherAvatarPrefix(v) { otherAvatarPrefix = v; }
        export let unsubRoomSession = null;      // セッション監視の解除関数
        export let unsubRoomMessages = null;     // チャット監視の解除関数
        export let roomHeartbeatTimer = null;
        export let lastChatSendAt = 0;
        /**
         * lastChatSendAt（前回チャットを送信した時刻）を更新する。
         * @param {number} v - 新しい送信時刻（Date.now()のミリ秒値）
         * @returns {void}
         */
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
        /**
         * 指定したテキストにNGワードが含まれているかを判定する。
         * @param {string} text - 判定対象のテキスト
         * @returns {boolean} NGワードが1つでも含まれていればtrue
         */
        export function containsNgWord(text) {
            return CHAT_NG_WORDS.some(w => text.includes(w));
        }

        // 🎂 チャット年齢ゲート：招待する/されるとき、まだ回答していなければ生年月日を聞く（初回のみ）
        /**
         * 生年月日から現在の満年齢を計算する。
         * @param {number} y - 生年（西暦）
         * @param {number} m - 生月（1〜12）
         * @param {number} d - 生日（1〜31）
         * @returns {number} 現在の満年齢
         */
        export function calcAgeFromBirthdate(y, m, d) {
            const today = new Date();
            let age = today.getFullYear() - y;
            const hadBirthdayThisYear = (today.getMonth() + 1 > m) || (today.getMonth() + 1 === m && today.getDate() >= d);
            if (!hadBirthdayThisYear) age--;
            return age;
        }
        export let birthdateGateResolver = null;
        /**
         * 生年月日ゲートのモーダルにある年・月・日のプルダウンに選択肢を作る（初回のみ実行される）。
         * @returns {void}
         */
        export function populateBirthdateGateSelects() {
            const yearSel = document.getElementById('birthdate-gate-year');
            if (!yearSel || yearSel.options.length > 0) return; // 初回だけ作る
            const nowY = new Date().getFullYear();
            for (let y = nowY; y >= nowY - CONFIG.BIRTHDATE_YEAR_RANGE_BACK; y--) {
                const opt = document.createElement('option'); opt.value = y; opt.textContent = y + '年'; yearSel.appendChild(opt);
            }
            const monthSel = document.getElementById('birthdate-gate-month');
            for (let m = 1; m <= 12; m++) { const opt = document.createElement('option'); opt.value = m; opt.textContent = m + '月'; monthSel.appendChild(opt); }
            const daySel = document.getElementById('birthdate-gate-day');
            for (let d = 1; d <= 31; d++) { const opt = document.createElement('option'); opt.value = d; opt.textContent = d + '日'; daySel.appendChild(opt); }
        }
        /**
         * 生年月日ゲートのモーダルを開き、ユーザーが確定するまで待つ。
         * @returns {Promise<boolean>} 13歳以上と判定されればtrueで解決するPromise
         */
        export function openBirthdateGateModal() {
            return new Promise((resolve) => {
                birthdateGateResolver = resolve;
                populateBirthdateGateSelects();
                openModal('birthdate-gate-modal');
            });
        }
        /**
         * 生年月日ゲートモーダルの「確定」操作を処理する。入力値から年齢を計算し、
         * チャット利用資格を保存してモーダルを閉じ、待機中のPromiseを解決する。
         * @returns {Promise<void>}
         */
        export async function onConfirmBirthdateGate() {
            const y = parseInt(document.getElementById('birthdate-gate-year').value, 10);
            const m = parseInt(document.getElementById('birthdate-gate-month').value, 10);
            const d = parseInt(document.getElementById('birthdate-gate-day').value, 10);
            if (!y || !m || !d) { alert('生年月日を選んでください'); return; }
            const eligible = calcAgeFromBirthdate(y, m, d) >= CONFIG.CHAT_ELIGIBLE_AGE_THRESHOLD;
            if (window.setMyChatEligibility) await window.setMyChatEligibility(eligible);
            closeModal('birthdate-gate-modal');
            const resolver = birthdateGateResolver;
            birthdateGateResolver = null;
            if (!eligible) alert('13歳未満の方は、安全のため自由入力のチャットはご利用いただけません。定型スタンプでお相手とやり取りできます。');
            if (resolver) resolver(eligible);
        }
        // 既に回答済みならすぐ戻り、未回答ならモーダルで聞いてから戻る（何度招待しても2回目以降は聞かない）
        /**
         * チャット利用資格（年齢確認）が未回答なら、生年月日ゲートモーダルで確認する。
         * @returns {Promise<void>}
         */
        export async function ensureChatEligibilityAnswered() {
            if (!window.getMyChatEligibility || !window.isRankingReady || !window.isRankingReady()) return;
            const known = await window.getMyChatEligibility();
            if (known === null) await openBirthdateGateModal();
        }

        // 🕐 招待を送った側(ホスト)：ゲストを待つ部屋を開く
        /**
         * ホストとして部屋セッションを開始し、ゲストを待つ画面を表示する。
         * @param {string} guestUid - 招待するゲストのuid
         * @param {string} guestName - 招待するゲストの表示名
         * @returns {Promise<void>}
         */
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
        /**
         * ゲストとしてホストの部屋セッションに参加し、一緒に過ごす画面を表示する。
         * @param {string} hostUid - 参加先ホストのuid
         * @param {string} hostNameFallback - ホスト名が取得できなかった場合に使う表示名
         * @returns {Promise<void>}
         */
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
        /**
         * 部屋セッションの監視、チャットメッセージの監視、生存確認ハートビートをまとめて開始する。
         * @param {string} roomId - 監視対象の部屋セッションID
         * @param {string} otherName - 相手の表示名
         * @returns {void}
         */
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
            }, CONFIG.ROOM_HEARTBEAT_INTERVAL_MS);
        }

        /**
         * セッション監視・チャット監視・ハートビートをすべて停止し、関連する状態をリセットする。
         * @returns {void}
         */
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
        /**
         * ホスト側で、待っていたゲストが部屋に到着した瞬間の演出（表示切替・効果音・見た目反映）を行う。
         * @param {string} guestName - 到着したゲストの表示名
         * @returns {Promise<void>}
         */
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
        /**
         * 相手が退出した、またはセッションが切れたときの後処理を行う（状態リセット・監視停止・通知）。
         * @param {string} otherName - 退出した相手の表示名
         * @returns {void}
         */
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
        /**
         * チャット用フローティングボタン（メッセージ・履歴）の表示・非表示を切り替える。
         * @param {boolean} visible - チャット機能を表示するかどうか
         * @returns {void}
         */
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
        /**
         * 自分の部屋をホスト中かどうかに応じて、他人の部屋でしか意味のないボタン（スタンプ行）の表示を切り替える。
         * @param {boolean} isHosting - 自分が部屋をホスト中ならtrue
         * @returns {void}
         */
        export function setVisitActionButtonsForHosting(isHosting) {
            const stampRow = document.getElementById('visit-stamp-buttons-row');
            if (stampRow) stampRow.style.display = isHosting ? 'none' : 'flex';
        }

        // 💬 入力バーの開閉（💬ボタンを押した時）。開く時は入力欄にフォーカスしてキーボードを呼び出す
        /**
         * チャット入力バーの表示を開閉する。開く時は入力欄にフォーカスしてキーボードを呼び出す。
         * @returns {void}
         */
        export function toggleChatInputBar() {
            const bar = document.getElementById('visit-chat-input-bar');
            if (!bar) return;
            const showing = bar.style.display === 'flex';
            bar.style.display = showing ? 'none' : 'flex';
            if (!showing) {
                setTimeout(() => {
                    const input = document.getElementById('visit-chat-input');
                    if (input) input.focus();
                }, CONFIG.CHAT_INPUT_FOCUS_DELAY_MS);
            }
        }

        // 💭 指定したアバターの頭上に、セリフとしてメッセージを表示する
        /**
         * 指定したアバターの頭上に、セリフ吹き出しとしてメッセージを一定時間表示する。
         * @param {string} prefix - 対象アバターのDOM要素prefix
         * @param {string} text - 吹き出しに表示するテキスト
         * @returns {void}
         */
        export function showChatBubble(prefix, text) {
            const bubble = document.getElementById(prefix + '-chat-bubble');
            if (!bubble) return;
            clearTimeout(bubble._hideTimer);
            bubble.textContent = text;
            bubble.classList.add('chat-bubble-show');
            bubble._hideTimer = setTimeout(() => bubble.classList.remove('chat-bubble-show'), CHAT_BUBBLE_DURATION_MS);
        }
        /**
         * 指定したアバターのセリフ吹き出しを非表示にする。
         * @param {string} prefix - 対象アバターのDOM要素prefix
         * @returns {void}
         */
        export function hideChatBubble(prefix) {
            const bubble = document.getElementById(prefix + '-chat-bubble');
            if (!bubble) return;
            clearTimeout(bubble._hideTimer);
            bubble.classList.remove('chat-bubble-show');
        }

        // 👂 新着メッセージが来るたびに呼ばれる：最新の1件をセリフ吹き出しで表示し、履歴も更新する
        // （activeChatSessionStartedAt以降だけに絞る理由は、その変数の宣言部を参照）
        /**
         * 受信したメッセージ一覧を今回のセッション開始時刻以降に絞り込み、最新の1件をセリフ吹き出しで表示し、
         * 履歴も更新する。
         * @param {Array} rawMsgs - messagesサブコレクションから届いた生のメッセージ配列
         * @returns {void}
         */
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
        /**
         * チャット履歴モーダルの中身を「プレイヤー名：内容」の形式で描画する。
         * @returns {void}
         */
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
        /**
         * チャット履歴モーダルの中身を描画してから、モーダルを開く。
         * @returns {void}
         */
        export function openChatHistoryModal() {
            renderChatHistoryModalContent();
            openModal('visit-chat-history-modal');
        }

        /**
         * 入力欄の自由入力メッセージを検証（連投防止・NGワード・文字数）した上で送信する。
         * @returns {Promise<void>}
         */
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
        /**
         * チャット入力欄でEnterキーを押した時にメッセージを送信できるようにイベントを登録する（起動時に1回だけ実行）。
         * @returns {void}
         */
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
