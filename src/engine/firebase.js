/**
 * src/engine/firebase.js
 * ランキング・クラウドバックアップ・フレンド機能・マイルーム1対1ライブチャットなど、
 * Firebase(Firestore/Auth)を使うオンライン機能をまとめたモジュール。
 *
 * 元はindex.html内に直接書かれていた<script type="module">ブロックを、
 * 他の機能と同じくファイル単位で管理できるよう外出ししたもの。
 * ロジック・処理内容は一切変更していない（コードの移動のみ）。
 * ここで定義される関数は、type=moduleではない他のゲーム本体スクリプトから
 * 呼べるようにするため、これまで通りwindowへ橋渡ししている。
 *
 * firebaseConfigの中身は、自分のFirebaseプロジェクトの値に置き換えてください。
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocFromServer, addDoc, getDocs, getDocsFromServer, collection, query, orderBy, limit, where, updateDoc, increment, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 👇 ここをFirebaseコンソールで発行された自分の設定値に置き換えてください
const firebaseConfig = {
    apiKey: "AIzaSyBoFBeCGJ77jOIJlI5jGTudMWZisyOI5UY",
    authDomain: "punicker.firebaseapp.com",
    projectId: "punicker",
    storageBucket: "punicker.firebasestorage.app",
    messagingSenderId: "801464732427",
    appId: "1:801464732427:web:1ac677894304e13d1a700e"
};

let fbReady = false;
let currentUid = null;
let db = null;

try {
    const fbApp = initializeApp(firebaseConfig);
    const auth = getAuth(fbApp);
    db = getFirestore(fbApp);
    onAuthStateChanged(auth, (user) => {
        if (user) { currentUid = user.uid; fbReady = true; }
    });
    signInAnonymously(auth).catch((e) => console.error("Firebase匿名認証エラー:", e));
} catch (e) {
    console.error("Firebase初期化エラー（firebaseConfigが未設定の可能性があります）:", e);
}

// メインのゲームスクリプト（type=moduleではない）から呼べるようにwindowへ橋渡しする
window.submitRankingScore = async function (name, scoreVal, totalTapsVal, prestigeCountVal, outfitVal) {
    if (!fbReady || !db || !currentUid) return;
    if (window.IS_DEV_MODE) return; // 開発者モード中は、水増しした数値がランキングに反映されないよう送信自体を止める
    try {
        await setDoc(doc(db, "rankings", currentUid), {
            name: String(name).slice(0, 20),
            score: Math.floor(scoreVal),
            totalTaps: Math.floor(totalTapsVal || 0),
            prestigeCount: Math.floor(prestigeCountVal || 0),
            outfit: outfitVal || null,
            updatedAt: Date.now()
        }, { merge: true }); // 🐛修正：mergeが無いとドキュメント全体を上書きしてしまい、friendCodeなど他の場所で保存したフィールドが消えていた
    } catch (e) { console.error("ランキング送信エラー:", e); }
};

window.fetchTapRankingList = async function () {
    if (!db) return null;
    try {
        const q = query(collection(db, "rankings"), orderBy("totalTaps", "desc"), limit(20));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach((d) => list.push({ ...d.data(), uid: d.id, isMe: d.id === currentUid }));
        return list;
    } catch (e) { console.error("タップ数ランキング取得エラー:", e); return null; }
};

window.fetchPrestigeRankingList = async function () {
    if (!db) return null;
    try {
        const q = query(collection(db, "rankings"), orderBy("prestigeCount", "desc"), limit(20));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach((d) => list.push({ ...d.data(), uid: d.id, isMe: d.id === currentUid }));
        return list;
    } catch (e) { console.error("転生回数ランキング取得エラー:", e); return null; }
};

// 💾 セーブデータのクラウドバックアップ（localStorageが消えても復元できるようにする保険）
// 匿名ログインの状態（IndexedDB）がlocalStorageと別に保持されているケースが多いため、
// localStorageだけ消えてもこのバックアップから復元できる可能性が高い。
// バックアップが「進んでいる状態」を「進んでいない状態」で誤って上書きしてしまう事故を防ぐガード。
// 複数タブ/複数端末を行き来した際に、古い（進んでいない）方のタブが後からオートセーブして
// 大事な進行データを消してしまう、という事故が実際に起きたための対策。
// force=trueの時だけ（転生など、意図的なリセットの直後）このチェックをスキップする。
window.backupSaveData = async function (saveJsonString, force) {
    if (!fbReady || !db || !currentUid) return;
    try {
        if (!force) {
            try {
                const existing = await getDoc(doc(db, "saveBackups", currentUid));
                if (existing.exists() && existing.data().data) {
                    const oldParsed = JSON.parse(existing.data().data);
                    const newParsed = JSON.parse(saveJsonString);
                    const oldScore = oldParsed.score || 0;
                    const newScore = newParsed.score || 0;
                    // 既存バックアップの半分未満に急に落ち込んでいたら、上書きせず様子を見る
                    if (oldScore > 1000 && newScore < oldScore * 0.5) {
                        console.warn("クラウドバックアップの上書きをスキップしました（急激なスコア低下を検知）", { oldScore, newScore });
                        return;
                    }
                }
            } catch (e) { /* 既存バックアップの確認に失敗しても、念のため通常通り保存は続行する */ }
        }
        await setDoc(doc(db, "saveBackups", currentUid), {
            data: saveJsonString,
            updatedAt: Date.now()
        });
    } catch (e) { console.error("クラウドバックアップ送信エラー:", e); }
};

window.restoreSaveData = async function () {
    if (!fbReady || !db || !currentUid) return null;
    try {
        const snap = await getDoc(doc(db, "saveBackups", currentUid));
        if (snap.exists()) return snap.data();
        return null;
    } catch (e) { console.error("クラウド復元エラー:", e); return null; }
};

window.fetchRankingList = async function () {
    if (!db) return null;
    try {
        const q = query(collection(db, "rankings"), orderBy("score", "desc"), limit(20));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach((d) => list.push({ ...d.data(), uid: d.id, isMe: d.id === currentUid }));
        return list;
    } catch (e) { console.error("ランキング取得エラー:", e); return null; }
};

// 🏠❤️ 部屋にいいねする：押した側・押された側、両方にガチャコイン1枚。1部屋につき1回まで
window.likeRoom = async function (ownerUid) {
    if (!fbReady || !db || !currentUid) return { success: false, reason: 'offline' };
    if (ownerUid === currentUid) return { success: false, reason: 'self' };
    try {
        // 🐛修正：テスト用にID末尾へDate.now()を足して毎回別ドキュメント化＋重複チェックを
        // 無効化したままになっていたため、いいねボタン連打でroomLikeCountとガチャコインが
        // 無限に増やせてしまっていた。checkRoomLiked()が前提とする`${liker}_${owner}`という
        // 固定IDに戻し、重複チェックも復活させる（Firestoreルール側でも1組につき1回に制限する）
        const likeDocId = `${currentUid}_${ownerUid}`;
        const likeRef = doc(db, "roomLikes", likeDocId);
        const existing = await getDoc(likeRef);
        if (existing.exists()) return { success: false, reason: 'already' };
        // 🐛修正：いいねドキュメントの新規作成とroomLikeCountの+1を、別々の書き込みではなく
        // 1つのバッチにまとめる。Firestoreルール側でgetAfter()を使い「このバッチで
        // いいねドキュメントが新規作成された時だけ+1を許可する」ように連動させるための対応
        // （別々の書き込みのままだと、いいねドキュメント作成をすり抜けてカウントだけ連打できてしまう）
        const batch = writeBatch(db);
        batch.set(likeRef, { likerUid: currentUid, ownerUid, createdAt: Date.now() });
        batch.set(doc(db, "rankings", ownerUid), { roomLikeCount: increment(1) }, { merge: true });
        await batch.commit();
        // 🎁 相手にもガチャコインを1枚届ける（既存のgiftsの仕組みをそのまま使う）
        const myDoc = await getDoc(doc(db, "rankings", currentUid));
        const myName = myDoc.exists() ? (myDoc.data().name || '名無しさん') : '名無しさん';
        await addDoc(collection(db, "gifts"), {
            toUid: ownerUid, fromUid: currentUid, fromName: myName, amount: 1, createdAt: Date.now(), claimed: false, reason: 'roomLike'
        });
        return { success: true };
    } catch (e) { console.error("いいねエラー:", e); return { success: false, reason: 'error', errorMessage: (e && e.message) ? e.message : String(e) }; }
};
window.checkRoomLiked = async function (ownerUid) {
    if (!fbReady || !db || !currentUid) return false;
    try {
        const likeDocId = `${currentUid}_${ownerUid}`;
        const d = await getDoc(doc(db, "roomLikes", likeDocId));
        return d.exists();
    } catch (e) { return false; }
};
// 🏠 部屋ランキング：いいねが多い順に並べる
window.fetchRoomLikeRanking = async function () {
    if (!db) return { list: null, error: 'not_ready' };
    try {
        const q = query(collection(db, "rankings"), orderBy("roomLikeCount", "desc"), limit(20));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach((d) => list.push({ ...d.data(), uid: d.id, isMe: d.id === currentUid }));
        return { list, error: null };
    } catch (e) {
        console.error("部屋ランキング取得エラー:", e);
        return { list: null, error: (e && e.message) ? e.message : String(e) };
    }
};
window.isRankingReady = function () { return fbReady; };
// 🟢 オンライン状態の管理：定期的に自分の最終アクティブ時刻を送り、招待前に相手がオンラインか確認する
window.sendHeartbeat = async function () {
    if (!fbReady || !db || !currentUid) return;
    try {
        await setDoc(doc(db, "rankings", currentUid), { lastActiveAt: Date.now() }, { merge: true });
    } catch (e) { console.error("ハートビート送信エラー:", e); }
};
window.checkUserOnline = async function (uid) {
    if (!fbReady || !db) return false;
    try {
        const d = await getDoc(doc(db, "rankings", uid));
        if (!d.exists()) return false;
        const lastActive = d.data().lastActiveAt || 0;
        return (Date.now() - lastActive) < 3 * 60 * 1000; // 3分以内ならオンライン扱い
    } catch (e) { return false; }
};
// 🚨 ユーザーを通報する（開発者がコンソールから直接確認する）
window.reportUser = async function (targetUid, targetName, reasonText) {
    if (!fbReady || !db || !currentUid) return { success: false };
    try {
        await addDoc(collection(db, "userReports"), {
            reporterUid: currentUid, targetUid, targetName: targetName || '', reasonText: String(reasonText || '').slice(0, 500), createdAt: Date.now()
        });
        return { success: true };
    } catch (e) { console.error("通報送信エラー:", e); return { success: false }; }
};
// 💌 部屋訪問中のスタンプ送受信
window.sendVisitStampMsg = async function (toUid, text) {
    if (!fbReady || !db || !currentUid) return { success: false };
    try {
        const myDoc = await getDoc(doc(db, "rankings", currentUid));
        const myName = myDoc.exists() ? (myDoc.data().name || '名無しさん') : '名無しさん';
        await addDoc(collection(db, "visitStamps"), {
            toUid, fromUid: currentUid, fromName: myName, text: String(text).slice(0, 30), createdAt: Date.now(), claimed: false
        });
        return { success: true };
    } catch (e) { console.error("スタンプ送信エラー:", e); return { success: false }; }
};
window.checkIncomingVisitStamps = async function () {
    if (!fbReady || !db || !currentUid) return [];
    try {
        const q = await getDocs(query(collection(db, "visitStamps"), where("toUid", "==", currentUid), where("claimed", "==", false)));
        const stamps = q.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const d of q.docs) {
            await setDoc(doc(db, "visitStamps", d.id), { claimed: true }, { merge: true });
        }
        return stamps;
    } catch (e) { console.error("スタンプ確認エラー:", e); return []; }
};
// 🏠✉️ フレンドをマイルームに招待する
window.sendRoomInvite = async function (toUid) {
    if (!fbReady || !db || !currentUid) return { success: false };
    try {
        const isOnline = await window.checkUserOnline(toUid);
        if (!isOnline) return { success: false, reason: 'offline_target' };
        const myDoc = await getDoc(doc(db, "rankings", currentUid));
        const myName = myDoc.exists() ? (myDoc.data().name || '名無しさん') : '名無しさん';
        await addDoc(collection(db, "roomInvites"), {
            toUid, fromUid: currentUid, fromName: myName, createdAt: Date.now(), claimed: false
        });
        return { success: true };
    } catch (e) { console.error("招待送信エラー:", e); return { success: false }; }
};
// 🏠✉️ 自分宛の未確認の招待を確認する
window.checkIncomingRoomInvites = async function () {
    if (!fbReady || !db || !currentUid) return [];
    try {
        const q = await getDocs(query(collection(db, "roomInvites"), where("toUid", "==", currentUid), where("claimed", "==", false)));
        const invites = q.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const d of q.docs) {
            await setDoc(doc(db, "roomInvites", d.id), { claimed: true }, { merge: true });
        }
        return invites;
    } catch (e) { console.error("招待確認エラー:", e); return []; }
};
window.submitMyroomData = async function (myroomData) {
    if (!fbReady || !db || !currentUid) return false;
    try {
        await setDoc(doc(db, "rankings", currentUid), { myroom: myroomData }, { merge: true });
        return true;
    } catch (e) { console.error("マイルームデータ送信エラー:", e); return false; }
};
// 🏠 指定uidの人のマイルームデータを取得する（フレンドに限らず、誰の部屋でも見られる）
window.fetchMyroomData = async function (uid) {
    if (!fbReady || !db) return null;
    try {
        const d = await getDoc(doc(db, "rankings", uid));
        if (!d.exists()) return null;
        const data = d.data();
        return { myroom: data.myroom || null, name: data.name || '名無しさん', outfit: data.outfit || null };
    } catch (e) { console.error("マイルーム取得エラー:", e); return null; }
};

// 🆔 他のwindow関数からも自分のuidを参照できるようにする（部屋チャットのメッセージ描画で「自分の発言か」判定に使う）
window.getMyUid = function () { return currentUid; };

// ===================================================================
// 💬🏠 マイルーム 1対1ライブチャット
// 招待した側(ホスト)・された側(ゲスト)のペアごとに roomSessions/{roomId} を1つ持ち、
// onSnapshotでリアルタイム監視することで「相手が今部屋に来た/退出した」を即座に検知する。
// roomIdは2人のuidをソートして連結しただけの固定値なので、毎回同じ部屋に合流できる。
// ===================================================================
function getRoomSessionId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

// 🎂 チャット年齢ゲート：自分のchatEligible（13歳以上かどうか）をFirestoreから取得/保存する
window.getMyChatEligibility = async function () {
    if (!fbReady || !db || !currentUid) return null;
    try {
        const d = await getDoc(doc(db, "rankings", currentUid));
        if (d.exists() && typeof d.data().chatEligible === 'boolean') return d.data().chatEligible;
    } catch (e) { console.error("年齢確認の取得エラー:", e); }
    return null; // 未回答
};
window.setMyChatEligibility = async function (eligible) {
    if (!fbReady || !db || !currentUid) return false;
    try {
        await setDoc(doc(db, "rankings", currentUid), { chatEligible: !!eligible }, { merge: true });
        return true;
    } catch (e) { console.error("年齢確認の保存エラー:", e); return false; }
};
// 二人の現在のchatEligibleが両方trueかどうかを判定する（未回答/未成立はfalse扱い＝安全側）
async function computeChatEnabled(uidA, uidB) {
    try {
        const [a, b] = await Promise.all([getDoc(doc(db, "rankings", uidA)), getDoc(doc(db, "rankings", uidB))]);
        return !!(a.exists() && a.data().chatEligible === true && b.exists() && b.data().chatEligible === true);
    } catch (e) { return false; }
}

// 🚪🟢 招待を送った側(ホスト)が、ゲストを待つ部屋セッションを開始する
window.startRoomHostSession = async function (guestUid) {
    if (!fbReady || !db || !currentUid) return null;
    const roomId = getRoomSessionId(currentUid, guestUid);
    try {
        // 🎂 13歳未満が関わるペアでは自由文チャットを無効化する（スタンプのみ）。
        // 実際の可否はFirestoreルール側でも同じ条件をget()で再計算して検証するので、
        // ここで送る値を偽ってもチャット送信は許可されない
        const chatEnabled = await computeChatEnabled(currentUid, guestUid);
        // 🐛修正：roomSessionsのドキュメントは同じ2人の間で半永久的に使い回されるため、
        // 過去に何度訪問し合っても会話ログ(messagesサブコレクション)は同じ場所に積み上がり続けていた。
        // その結果「一度退室してまた通信し直しても、前回までの会話が見えてしまう」状態になっていた。
        // ここでホストが新しく部屋を開くたび(＝新しい訪問セッションの開始)に
        // sessionStartedAtを打ち直し、クライアント側の表示をこの時刻以降のメッセージだけに
        // 絞ることで「その回だけの履歴」に見せる。Firestore側にはメッセージ自体は削除せず
        // 全件残るので、過去分が必要な場合は開発者がFirebaseコンソール側から確認できる
        await setDoc(doc(db, "roomSessions", roomId), {
            hostUid: currentUid, guestUid,
            hostPresentAt: Date.now(), guestPresentAt: null, endedAt: null,
            chatEnabled, sessionStartedAt: Date.now(),
        }, { merge: true });
        return roomId;
    } catch (e) { console.error("ホストセッション開始エラー:", e); return null; }
};

// 🚪🟢 招待された側(ゲスト)が、実際に部屋に入る時に呼ぶ
window.joinRoomHostSession = async function (hostUid) {
    if (!fbReady || !db || !currentUid) return null;
    const roomId = getRoomSessionId(hostUid, currentUid);
    try {
        // 🎂 招待時点ではゲスト側がまだ年齢確認に答えていないことがあるため、入室時にも再計算して送り直す
        const chatEnabled = await computeChatEnabled(hostUid, currentUid);
        await setDoc(doc(db, "roomSessions", roomId), {
            hostUid, guestUid: currentUid,
            guestPresentAt: Date.now(), endedAt: null,
            chatEnabled,
        }, { merge: true });
        return roomId;
    } catch (e) { console.error("入室エラー:", e); return null; }
};

// 👀 部屋セッションの状態をリアルタイム監視する（相手の到着・退出を検知）。戻り値は監視解除用の関数
window.listenRoomSession = function (roomId, onChange) {
    if (!fbReady || !db || !roomId) return () => {};
    try {
        return onSnapshot(doc(db, "roomSessions", roomId), (snap) => {
            onChange(snap.exists() ? snap.data() : null);
        }, (e) => console.error("セッション監視エラー:", e));
    } catch (e) { console.error("セッション監視エラー:", e); return () => {}; }
};

// 💓 セッション中の生存確認（アプリが落ちる等で退出処理を挟めなかった場合の保険として、定期的に自分の在室時刻を更新する）
window.sendRoomSessionHeartbeat = async function (roomId, isHost) {
    if (!fbReady || !db || !roomId) return;
    try {
        await setDoc(doc(db, "roomSessions", roomId), isHost ? { hostLastSeenAt: Date.now() } : { guestLastSeenAt: Date.now() }, { merge: true });
    } catch (e) { /* 生存確認の失敗は致命的ではないので無視 */ }
};

// 🚶 マイルームの「歩き回る目的地」を、自分の役割(ホスト/ゲスト)側のフィールドにだけ書き込む。
// これを見た相手のクライアントは、自分でランダムな目的地を選ぶのではなく、この値に合わせて
// 同じアニメーションを再生することで、2人の画面で見た目の動きを揃える（Firestoreルール側でも
// hostWalkはホスト本人、guestWalkはゲスト本人しか書けないよう制限している）
window.sendRoomWalkTarget = async function (roomId, isHost, walkData) {
    if (!fbReady || !db || !roomId) return;
    try {
        await setDoc(doc(db, "roomSessions", roomId), isHost ? { hostWalk: walkData } : { guestWalk: walkData }, { merge: true });
    } catch (e) { /* 見た目だけの同期なので、失敗しても致命的ではない */ }
};
// 🎭🍙 叫ぶ・ごはん・タップなどの単発の演出イベントを、両者で共有する1つのフィールドに書き込む
window.sendRoomAction = async function (roomId, actionData) {
    if (!fbReady || !db || !roomId) return;
    try {
        await setDoc(doc(db, "roomSessions", roomId), { roomAction: actionData }, { merge: true });
    } catch (e) { /* 見た目だけの同期なので、失敗しても致命的ではない */ }
};

// 🚪🔴 部屋セッションを終了する（どちらかが退出ボタン/戻るボタンを押した時）
window.leaveRoomSession = async function (roomId) {
    if (!fbReady || !db || !roomId) return;
    try {
        await setDoc(doc(db, "roomSessions", roomId), { endedAt: Date.now() }, { merge: true });
    } catch (e) { console.error("退室エラー:", e); }
};

// 💬 チャットメッセージを送信する（isStamp=trueの時は定型スタンプ扱い。
// 13歳未満が関わる等でchatEnabledがfalseのペアでも、スタンプだけは送れるようにするための区別）
window.sendRoomChatMessage = async function (roomId, text, isStamp) {
    if (!fbReady || !db || !currentUid || !roomId) return { success: false };
    const clean = String(text || '').trim().slice(0, 200);
    if (!clean) return { success: false };
    try {
        const myDoc = await getDoc(doc(db, "rankings", currentUid));
        const myName = myDoc.exists() ? (myDoc.data().name || '名無しさん') : '名無しさん';
        await addDoc(collection(db, "roomSessions", roomId, "messages"), {
            fromUid: currentUid, fromName: myName, text: clean, createdAt: Date.now(), isStamp: !!isStamp
        });
        return { success: true };
    } catch (e) {
        // 🐛修正：以前は失敗してもコンソールに出すだけで、呼び出し側は結果を確認せず
        // 「送れたつもり」になっていた。理由(especially permission-denied＝Firestoreルールで
        // 弾かれた)を呼び出し側に返して、原因が分かるようにする
        console.error("チャット送信エラー:", e);
        return { success: false, reason: 'error', code: (e && e.code) || null, errorMessage: (e && e.message) ? e.message : String(e) };
    }
};

// 👂 チャットメッセージをリアルタイム監視する（新着が来るたびonMessagesに全件が渡される）。戻り値は監視解除用の関数
window.listenRoomChatMessages = function (roomId, onMessages) {
    if (!fbReady || !db || !roomId) return () => {};
    try {
        const q = query(collection(db, "roomSessions", roomId, "messages"), orderBy("createdAt", "asc"), limit(100));
        return onSnapshot(q, (snap) => {
            const msgs = [];
            snap.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
            onMessages(msgs);
        }, (e) => console.error("チャット監視エラー:", e));
    } catch (e) { console.error("チャット監視エラー:", e); return () => {}; }
};

// ✉️🐛修正：招待の検知は、以前は45秒おきにgetDocsで問い合わせる「ポーリング」方式だったため、
// 実際に届くまで最大で数十秒の時間差があった。onSnapshotでリアルタイム監視することで、
// Firestore側の書き込みとほぼ同時に検知できるようにする。戻り値は監視解除用の関数
window.listenIncomingRoomInvites = function (onInvites) {
    if (!fbReady || !db || !currentUid) return () => {};
    try {
        const q = query(collection(db, "roomInvites"), where("toUid", "==", currentUid), where("claimed", "==", false));
        return onSnapshot(q, (snap) => {
            const invites = [];
            snap.forEach((d) => invites.push({ id: d.id, ...d.data() }));
            if (invites.length > 0) onInvites(invites);
        }, (e) => console.error("招待監視エラー:", e));
    } catch (e) { console.error("招待監視エラー:", e); return () => {}; }
};
window.markRoomInviteClaimed = async function (inviteId) {
    if (!fbReady || !db || !inviteId) return;
    try { await setDoc(doc(db, "roomInvites", inviteId), { claimed: true }, { merge: true }); } catch (e) { /* 既読化の失敗は致命的ではない */ }
};
// 💌 部屋訪問中以外で受け取るスタンプも、同様にリアルタイム監視に切り替える
window.listenIncomingVisitStamps = function (onStamps) {
    if (!fbReady || !db || !currentUid) return () => {};
    try {
        const q = query(collection(db, "visitStamps"), where("toUid", "==", currentUid), where("claimed", "==", false));
        return onSnapshot(q, (snap) => {
            const stamps = [];
            snap.forEach((d) => stamps.push({ id: d.id, ...d.data() }));
            if (stamps.length > 0) onStamps(stamps);
        }, (e) => console.error("スタンプ監視エラー:", e));
    } catch (e) { console.error("スタンプ監視エラー:", e); return () => {}; }
};
window.markVisitStampClaimed = async function (stampId) {
    if (!fbReady || !db || !stampId) return;
    try { await setDoc(doc(db, "visitStamps", stampId), { claimed: true }, { merge: true }); } catch (e) { /* 既読化の失敗は致命的ではない */ }
};

// ===================================================================
// 🤝 フレンド機能：8桁のフレンドコードで、承認なしの即時相互フレンドになる方式
// 🚧注意：friendshipsコレクションへの書き込みを許可するFirestoreセキュリティルールが
// 別途必要です（このファイルからは設定できません。Firebaseコンソール側での設定が必要）
// ===================================================================
function generateFriendCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい0/O/1/Iは除外
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}
window.ensureMyFriendCode = async function () {
    if (!fbReady || !db || !currentUid) return null;
    try {
        const myDoc = await getDoc(doc(db, "rankings", currentUid));
        const existing = myDoc.exists() ? myDoc.data().friendCode : null;
        if (existing) return existing;

        // 衝突しないコードが出るまで、最大5回まで試す
        for (let i = 0; i < 5; i++) {
            const candidate = generateFriendCode();
            const dupCheck = await getDocs(query(collection(db, "rankings"), where("friendCode", "==", candidate)));
            if (dupCheck.empty) {
                await setDoc(doc(db, "rankings", currentUid), { friendCode: candidate }, { merge: true });
                // 🐛検証：setDoc自体はローカルキャッシュにより見かけ上成功することがあるため、
                // キャッシュを迂回してサーバーから直接読み直し、実際に反映されたか確認する
                try {
                    const verifyDoc = await getDocFromServer(doc(db, "rankings", currentUid));
                    if (!verifyDoc.exists() || verifyDoc.data().friendCode !== candidate) {
                        console.error("フレンドコードがサーバーに反映されていません。Firestoreのセキュリティルールで、rankingsコレクションへのfriendCodeフィールドの書き込みが許可されているか確認してください。");
                        return null;
                    }
                } catch (verifyErr) {
                    console.error("フレンドコードのサーバー確認に失敗:", verifyErr);
                    return null;
                }
                return candidate;
            }
        }
        return null;
    } catch (e) {
        console.error("フレンドコード発行エラー:", e);
        return null;
    }
};
window.addFriendByCode = async function (code) {
    if (!fbReady || !db || !currentUid) return { success: false, reason: 'offline' };
    try {
        const trimmed = String(code).trim().toUpperCase();
        const q = await getDocs(query(collection(db, "rankings"), where("friendCode", "==", trimmed)));
        if (q.empty) return { success: false, reason: 'not_found' };
        const targetDoc = q.docs[0];
        const targetUid = targetDoc.id;
        if (targetUid === currentUid) return { success: false, reason: 'self' };

        const pairId = [currentUid, targetUid].sort().join('_');
        // 🐛修正：以前はコードの一致確認がクライアント側だけだったため、ルール上は
        // 相手のフレンドコードを知らなくても uids に相手のuidを直接指定すれば
        // 一方的にフレンド関係を作成できてしまっていた。usedFriendCodeを一緒に送り、
        // ルール側で「相手の現在のfriendCodeと一致するか」をget()で検証できるようにする
        await setDoc(doc(db, "friendships", pairId), {
            uids: [currentUid, targetUid],
            createdAt: Date.now(),
            usedFriendCode: trimmed
        });
        return { success: true, name: targetDoc.data().name || '名無しさん' };
    } catch (e) {
        console.error("フレンド追加エラー:", e);
        return { success: false, reason: 'error', errorMessage: (e && e.message) ? e.message : String(e) };
        return { success: false, reason: 'error' };
    }
};
window.fetchFriendList = async function () {
    if (!fbReady || !db || !currentUid) return null;
    try {
        const q = await getDocs(query(collection(db, "friendships"), where("uids", "array-contains", currentUid)));
        const friendUids = q.docs.map(d => d.data().uids.find(u => u !== currentUid)).filter(Boolean);
        const friends = [];
        for (const uid of friendUids) {
            const fDoc = await getDoc(doc(db, "rankings", uid));
            if (fDoc.exists()) {
                const d = fDoc.data();
                friends.push({ uid, name: d.name || '名無しさん', score: d.score || 0, outfit: d.outfit || null, friendCode: d.friendCode || '--------' });
            }
        }
        return friends;
    } catch (e) {
        console.error("フレンド一覧取得エラー:", e);
        return null;
    }
};
// 🪙 フレンドに、無料のガチャコインを1枚送る
window.sendGiftCoin = async function (toUid) {
    if (!fbReady || !db || !currentUid) return { success: false };
    if (toUid === currentUid) return { success: false, reason: 'self' }; // 🐛修正：自分宛ギフトの量産防止（サーバー側のルールでも別途禁止済み）
    try {
        const myDoc = await getDoc(doc(db, "rankings", currentUid));
        const myName = myDoc.exists() ? (myDoc.data().name || '名無しさん') : '名無しさん';
        await addDoc(collection(db, "gifts"), {
            toUid, fromUid: currentUid, fromName: myName, amount: 1, createdAt: Date.now(), claimed: false
        });
        return { success: true };
    } catch (e) {
        console.error("ギフト送信エラー:", e);
        return { success: false };
    }
};
// 🎁 自分宛の未受領ギフトを確認し、その場で受領済みにする
window.checkIncomingGifts = async function () {
    if (!fbReady || !db || !currentUid) return [];
    try {
        const q = await getDocs(query(collection(db, "gifts"), where("toUid", "==", currentUid), where("claimed", "==", false)));
        const gifts = q.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const d of q.docs) {
            await setDoc(doc(db, "gifts", d.id), { claimed: true }, { merge: true });
        }
        return gifts;
    } catch (e) {
        console.error("ギフト受信確認エラー:", e);
        return [];
    }
};

// ✏️ ご意見・要望をFirestoreに直接送信（メールアプリを開く手間を無くすため）
window.submitFeedback = async function (text, name) {
    if (!fbReady || !db) return false;
    try {
        await addDoc(collection(db, "feedback"), {
            text: String(text).slice(0, 1000),
            name: String(name || '').slice(0, 20),
            uid: currentUid || null,
            createdAt: Date.now()
        });
        return true;
    } catch (e) { console.error("ご意見送信エラー:", e); return false; }
};
