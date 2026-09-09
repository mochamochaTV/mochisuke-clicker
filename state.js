// 他ファイルへの依存はすべてこのimportに明示されている。書き換えが必要な値はsetXxx(...)という
// 関数呼び出しの形にしている（importした束縛には直接代入できないため。ESモジュールの仕様）。
import { MYROOM_SLOT_POSITIONS, stages } from './data.js?v=2026-09-09-002';
import {
  minigameBests, minigameCoins, minigameLastResetDate, minigamePlaysUsedToday,
  minigameSeenUnlocked, minigames, setMinigameBests, setMinigameCoins, setMinigameLastResetDate,
  setMinigamePlaysUsedToday, setMinigameSeenUnlocked, setSlotBonusZoneSpinsLeft,
  setSlotJackpotCount, setSlotLongestJackpotPulls, setSlotPlaysRemaining, setSlotPullsSinceJackpot,
  setSlotShortestJackpotPulls, setSlotTotalPulls, slotBonusZoneSpinsLeft, slotJackpotCount,
  slotLongestJackpotPulls, slotPlaysRemaining, slotPullsSinceJackpot, slotShortestJackpotPulls,
  slotTotalPulls
} from './minigames.js?v=2026-09-09-002';
import {
  collectedStamps, currentMyroomSlotIndex, currentStageIndex, currentStageProgress,
  equippedKisekae, equippedMyroom, gachaCoins, hasSeenJapanClear, missionClaimed, missionCounters,
  missionDailyDate, missionDailySelected, missionWeeklySelected, missionWeeklyWeekKey, myroomSlots,
  ownedKisekaeItems, ownedMyroomItems, prefTaps, prestigeCount, prestigePoints,
  prestigeScoreHistory, prestigeShopLv, selectedStageIndex, setCollectedStamps,
  setCurrentMyroomSlotIndex, setCurrentStageIndex, setCurrentStageProgress, setEquippedKisekae,
  setEquippedMyroom, setGachaCoins, setHasSeenJapanClear, setMissionClaimed, setMissionCounters,
  setMissionDailyDate, setMissionDailySelected, setMissionWeeklySelected, setMissionWeeklyWeekKey,
  setMyroomSlots, setOwnedKisekaeItems, setOwnedMyroomItems, setPrefTaps, setPrestigeCount,
  setPrestigePoints, setPrestigeScoreHistory, setPrestigeShopLv, setSelectedStageIndex,
  setTutorialMissionStep, tutorialMissionStep
} from './progress.js?v=2026-09-09-002';
import {
  activeSprayId, blockedUserIds, equippedClotheId, favoriteFriendIds, purchasedClothes,
  purchasedItems, setActiveSprayId, setBlockedUserIds, setEquippedClotheId, setFavoriteFriendIds,
  setPurchasedClothes, setPurchasedItems, setSprayBuffActiveUntil, setSprayInventory,
  setTicketInventory, sprayBuffActiveUntil, sprayInventory, ticketInventory
} from './shop.js?v=2026-09-09-002';
import {
  feedLastResetDate, feedPlaysUsedToday, hasComboTitle1000, setFeedLastResetDate,
  setFeedPlaysUsedToday, setHasComboTitle1000, skills
} from './tap.js?v=2026-09-09-002';
import {
  hasSeenTutorial, lastGiftSentDateStr, seenButtonHints, setHasSeenTutorial,
  setLastGiftSentDateStr, setSeenButtonHints
} from './ui.js?v=2026-09-09-002';

        // 🔧 このファイル内で使うチューニング用の数値をまとめたもの（挙動は変えず、名前を付けただけ）
        const CONFIG = {
            PLAYER_NAME_MAX_LENGTH: 20,           // プレイヤー名として受け付ける最大文字数
            PLAYER_NAME_RANDOM_SUFFIX_MAX: 10000, // 初期プレイヤー名の末尾に付けるランダム数字の範囲
            SAVE_GUARD_MIN_SCORE_FOR_PROGRESS: 100,   // セーブ安全装置：直前のscoreがこれを超えていたら「進行あり」と判定
            SAVE_GUARD_MIN_TAPS_FOR_PROGRESS: 20,     // セーブ安全装置：直前のtotalTapsCountがこれを超えていたら「進行あり」と判定
            PREFECTURE_COUNT: 47,                  // 都道府県の数（県別タップ数配列の初期サイズ）
            CLOUD_RESTORE_POLL_INTERVAL_MS: 500,   // クラウド復元チェックのポーリング間隔（ミリ秒）
            CLOUD_RESTORE_MAX_POLL_ATTEMPTS: 20,   // クラウド復元チェックを諦めるまでの最大ポーリング回数（約10秒分）
        };

        /**
         * ゲームを保存し、ランキング機能が利用可能ならスコアを送信した上で、セーブ完了のアラートを表示する。
         * @returns {void}
         */
        export function menuSaveGame() {
            saveGame();
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            alert("💾 セーブしました！");
        }

        /**
         * ゲームを保存した後、アプリを完全終了できないブラウザ環境の代替として「お別れ画面」を表示し、ウィンドウを閉じようと試みる。
         * @returns {void}
         */
        export function menuSaveAndQuit() {
            saveGame();
            // 【重要】ブラウザ/PWAの仕様上、Webページ側から「アプリを完全に終了させる」ことはできません
            // （window.close()は script が開いたウィンドウ以外では基本的に無視されます）。
            // なのでここでは「セーブ完了→もちすけとお別れ画面」を出す、という代替演出にしています。
            document.body.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%; background:#fcf8f2; text-align:center; padding:20px; box-sizing:border-box;">
                <div style="font-size:3rem; margin-bottom:12px;">🍡</div>
                <div style="font-size:1.2rem; font-weight:bold; color:#5d4037; margin-bottom:8px;">セーブしました！</div>
                <div style="font-size:0.9rem; color:#8d6e63;">またあそびにきてね</div>
            </div>`;
            try { window.close(); } catch (e) {}
        }

        // 🔄 セーブデータの書き出し/読み込み（別URL・別インスタンス間でもデータを確実に移せる）
        /**
         * ゲームを保存し、セーブデータをBase64文字列に変換してテキストエリアに表示、クリップボードへのコピーを試みる。
         * @returns {void}
         */
        export function exportSaveData() {
            saveGame();
            const raw = localStorage.getItem('mochisuke_save_data');
            const el = document.getElementById('save-export-text');
            if (!raw) { el.value = ''; alert('セーブデータが見つかりませんでした'); return; }
            el.value = btoa(unescape(encodeURIComponent(raw))); // 文字化け防止のためbase64化
            el.select();
            try { document.execCommand('copy'); alert('コピーしました！移動先の「読み込む」欄に貼り付けてください'); }
            catch (e) { alert('下のテキストを手動でコピーしてください'); }
        }

        /**
         * 貼り付けられたセーブデータ文字列（Base64または生JSON）を検証し、確認を得た上でlocalStorageへ上書き保存してページを再読み込みする。
         * @returns {void}
         */
        export function importSaveData() {
            const text = document.getElementById('save-import-text').value.trim();
            if (!text) { alert('貼り付け欄が空です'); return; }
            if (!confirm('今のセーブデータに上書きします。よろしいですか？（今のデータは失われます）')) return;

            let raw = null;
            // まずBase64形式（通常の「書き出し」機能の形式）として試す
            try {
                const decoded = decodeURIComponent(escape(atob(text)));
                JSON.parse(decoded);
                raw = decoded;
            } catch (e) {
                // Base64で読めなければ、Firestoreの生データ（素のJSON文字列）としてそのまま試す
                // （FirebaseコンソールのsaveBackups→dataの中身を直接コピペして復元する場合など）
                try {
                    JSON.parse(text);
                    raw = text;
                } catch (e2) {
                    alert('データの形式が正しくありません。コピーが途中で切れていないか確認してください');
                    return;
                }
            }

            localStorage.setItem('mochisuke_save_data', raw);
            alert('読み込みました！ページを再読み込みします');
            location.reload();
        }

        /**
         * クラウド上の最終バックアップ日時を取得し、画面上のステータス表示要素にその内容を反映する。
         * @returns {Promise<void>}
         */
        export async function refreshCloudBackupStatus() {
            const el = document.getElementById('cloud-backup-status');
            if (!el) return;
            el.innerText = '最終バックアップ: 確認中…';
            if (!window.restoreSaveData) { el.innerText = '最終バックアップ: 準備中（少し待ってから開き直してください）'; return; }
            const backup = await window.restoreSaveData();
            if (backup && backup.updatedAt) {
                el.innerText = `最終バックアップ: ${new Date(backup.updatedAt).toLocaleString('ja-JP')}`;
            } else {
                el.innerText = '最終バックアップ: まだありません（もう少しプレイすると作られます）';
            }
        }

        // ☁️ 今この瞬間の状態を、自分の意思で確実にクラウドへ残す（自動バックアップの安全装置を無視してでも上書きする）
        /**
         * ローカルのセーブ内容を最新化した上で、安全装置を無視して強制的にクラウドへ上書き保存する。
         * @returns {Promise<void>}
         */
        export async function manualCloudBackup() {
            if (!window.backupSaveData) { alert('クラウド機能の準備ができていません。少し待ってからもう一度試してください'); return; }
            saveGame(); // 念のため、まずローカルの保存内容を最新にしておく
            const raw = localStorage.getItem('mochisuke_save_data');
            if (!raw) { alert('保存するデータが見つかりませんでした'); return; }
            const el = document.getElementById('cloud-backup-status');
            if (el) el.innerText = '最終バックアップ: 保存中…';
            try {
                await window.backupSaveData(raw, true); // 手動保存は、自分の意思での上書きなので force で安全装置をスキップする
                alert('☁️ 今の状態をクラウドに保存しました！');
                refreshCloudBackupStatus();
            } catch (e) {
                alert('保存に失敗しました。通信環境を確認して、もう一度試してください');
            }
        }

        /**
         * クラウド上のバックアップデータを取得・検証し、確認を得た上でlocalStorageへ上書きしてページを再読み込みする。
         * @returns {Promise<void>}
         */
        export async function restoreFromCloud() {
            if (!window.restoreSaveData) { alert('クラウド機能の準備ができていません。少し待ってからもう一度試してください'); return; }
            const backup = await window.restoreSaveData();
            if (!backup || !backup.data) {
                alert('クラウド上にバックアップが見つかりませんでした。\n（10秒以上プレイ・セーブされたことがある端末でのみバックアップが作られます）');
                return;
            }
            try {
                JSON.parse(backup.data); // 壊れたデータでないか検証
            } catch (e) {
                alert('クラウド上のデータが壊れているようです。復元できませんでした');
                return;
            }
            const when = backup.updatedAt ? new Date(backup.updatedAt).toLocaleString('ja-JP') : '不明';
            if (!confirm(`クラウドに保存されたデータ（最終更新: ${when}）で、今のセーブデータを上書きします。よろしいですか？`)) return;
            localStorage.setItem('mochisuke_save_data', backup.data);
            alert('復元しました！ページを再読み込みします');
            location.reload();
        }

        // 明らかにスパム/おかしな名前を弾く簡易チェック（記号だけ・同じ文字の連続など）
        /**
         * プレイヤー名の文字列を検証し、記号だけの名前や同じ文字の連続などの不正な名前を弾く。
         * @param {string} rawName - 検証対象の名前文字列
         * @returns {Object} 検証結果（{ok:true, name} または {ok:false, reason}）
         */
        export function sanitizePlayerName(rawName) {
            let n = String(rawName || '').trim();
            if (!n) return { ok: false, reason: '名前を入力してください' };
            n = n.slice(0, CONFIG.PLAYER_NAME_MAX_LENGTH);
            if (/^(.)\1{2,}$/u.test(n)) return { ok: false, reason: '同じ文字の連続は使えません' };
            if (!/[^\s!-\/:-@\[-`{-~]/u.test(n)) return { ok: false, reason: '記号だけの名前は使えません' };
            return { ok: true, name: n };
        }

        /**
         * 入力欄のプレイヤー名を検証して保存し、ランキングへの送信とアラート表示を行う。
         * @returns {void}
         */
        export function savePlayerName() {
            const input = document.getElementById('player-name-input');
            const result = sanitizePlayerName(input.value);
            if (!result.ok) { alert(result.reason); return; }
            playerName = result.name;
            localStorage.setItem('punicker_player_name', playerName);
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            alert('保存しました！');
        }

        export let score = 0; 
        export let totalTapsCount = 0;       // 日本制覇演出の統計表示用
        export let firstPlayTimestamp = null; // 初回プレイ日時（統計表示用）
        export let lastActiveTimestamp = null; // 最後にセーブした時刻（オフライン収益の計算に使う）
        export const OFFLINE_EARNINGS_CAP_HOURS_BASE = 4; // オフライン収益として計算する時間の上限（これ以上離れていても4時間分だけ）
        export const OFFLINE_EARNINGS_MIN_SECONDS = 90; // これより短い離席では出さない（毎回のリロードで鬱陶しくならないように）

        export let playerName = localStorage.getItem('punicker_player_name') || ('もちすけファン' + Math.floor(Math.random() * CONFIG.PLAYER_NAME_RANDOM_SUFFIX_MAX));

        /**
         * ゲームの全状態を1つのオブジェクトにまとめ、不自然なデータ消失を検知する安全装置チェックを経てlocalStorageに保存する。
         * @returns {void}
         */
        export function saveGame() {
            lastActiveTimestamp = Date.now();
            const state = {
                score: score, currentStageIndex: currentStageIndex, selectedStageIndex: selectedStageIndex,
                currentStageProgress: currentStageProgress, purchasedItems: purchasedItems,
                purchasedClothes: purchasedClothes, equippedClotheId: equippedClotheId,
                skills: skills,
                totalTapsCount: totalTapsCount, firstPlayTimestamp: firstPlayTimestamp, hasSeenJapanClear: hasSeenJapanClear, hasSeenTutorial: hasSeenTutorial,
                hasComboTitle1000: hasComboTitle1000,
                seenButtonHints: seenButtonHints,
                collectedStamps: collectedStamps,
                minigameLastResetDate: minigameLastResetDate, minigamePlaysUsedToday: minigamePlaysUsedToday, minigameBests: minigameBests,
                feedLastResetDate: feedLastResetDate, feedPlaysUsedToday: feedPlaysUsedToday,
                minigameSeenUnlocked: minigameSeenUnlocked,
                prefTaps: prefTaps, lastActiveTimestamp: lastActiveTimestamp,
                prestigeCount: prestigeCount, prestigePoints: prestigePoints, prestigeScoreHistory: prestigeScoreHistory,
                prestigeShopLv: prestigeShopLv, gachaCoins: gachaCoins, minigameCoins: minigameCoins, ticketInventory: ticketInventory, slotPlaysRemaining: slotPlaysRemaining, slotBonusZoneSpinsLeft: slotBonusZoneSpinsLeft,
                sprayInventory: sprayInventory, activeSprayId: activeSprayId, sprayBuffActiveUntil: sprayBuffActiveUntil,
                favoriteFriendIds: favoriteFriendIds,
                blockedUserIds: blockedUserIds,
                lastGiftSentDateStr: lastGiftSentDateStr,
                slotTotalPulls: slotTotalPulls, slotPullsSinceJackpot: slotPullsSinceJackpot, slotJackpotCount: slotJackpotCount,
                slotShortestJackpotPulls: slotShortestJackpotPulls, slotLongestJackpotPulls: slotLongestJackpotPulls,
                ownedKisekaeItems: ownedKisekaeItems, equippedKisekae: equippedKisekae,
                missionCounters: missionCounters, missionDailyDate: missionDailyDate, missionWeeklyWeekKey: missionWeeklyWeekKey,
                missionDailySelected: missionDailySelected, missionWeeklySelected: missionWeeklySelected,
                missionClaimed: missionClaimed, tutorialMissionStep: tutorialMissionStep,
                ownedMyroomItems: ownedMyroomItems, equippedMyroom: equippedMyroom,
                myroomSlots: myroomSlots, currentMyroomSlotIndex: currentMyroomSlotIndex
            };

            // 🛡️ セーブ安全装置：バグ等で、意味のある所持数がまるごと0になった「壊れた状態」を
            // 気づかずそのまま上書き保存してしまう事故を防ぐ（実際にこの種のバグで、もち数・
            // ゲームセンターのコイン・累計タップ数が起動のたびに0に戻る問題が一度発生している）。
            // 「直前のセーブでは意味のある進行があったのに、今回は主要な数値が軒並み0になっている」
            // という、通常のプレイでは絶対に起きない不自然な変化を検知したら、保存そのものを中断して
            // 今ある（無事な）セーブデータを守る。転生（プレステージ）はscoreを意図的に0へ戻すが、
            // その際もガチャコイン・累計タップ数は必ず引き継がれる（0にならない）ため、この安全装置には
            // 引っかからない。
            try {
                const prevRaw = localStorage.getItem('mochisuke_save_data');
                if (prevRaw) {
                    const prev = JSON.parse(prevRaw);
                    const prevHadProgress = (prev.score > CONFIG.SAVE_GUARD_MIN_SCORE_FOR_PROGRESS) || (prev.totalTapsCount > CONFIG.SAVE_GUARD_MIN_TAPS_FOR_PROGRESS) || (prev.gachaCoins > 0) || (prev.minigameCoins > 0);
                    const nowLooksWiped = state.score === 0 && state.totalTapsCount === 0 && state.gachaCoins === 0 && state.minigameCoins === 0;
                    const prestigeWentBackwards = typeof prev.prestigeCount === 'number' && state.prestigeCount < prev.prestigeCount; // 転生回数が減ることは絶対に無い
                    if ((prevHadProgress && nowLooksWiped) || prestigeWentBackwards) {
                        localStorage.setItem('mochisuke_save_data_safety_backup', prevRaw); // 何かあった時に手動で復元できるよう、直前の状態を退避しておく
                        console.error('🛡️セーブ安全装置作動：直前のセーブに進行状況があったのに、今回まるごと0（または転生回数の逆行）になっていたため、保存を中断しました。', { prev, wouldBeSaved: state });
                        return; // 保存しない＝今localStorageにある無事なデータをそのまま残す
                    }
                }
            } catch (e) { /* 安全装置自体の不具合でゲームを止めないよう、失敗時は普通に保存へ進む */ }

            localStorage.setItem('mochisuke_save_data', JSON.stringify(state));
        }

        export let hadLocalSaveOnLoad = false;
        /**
         * localStorageからセーブデータを読み込み、各種グローバル変数へ復元する。旧セーブ形式からの自動修復もここで行う。
         * @returns {void}
         */
        export function loadGame() {
            const data = localStorage.getItem('mochisuke_save_data');
            hadLocalSaveOnLoad = !!data;
            if (data) {
                try {
                    const state = JSON.parse(data);
                    score = state.score ?? 0;
                    setCurrentStageIndex(state.currentStageIndex ?? 0);
                    setSelectedStageIndex(state.selectedStageIndex ?? 0);
                    setCurrentStageProgress(state.currentStageProgress ?? 0);
                    setPurchasedItems(state.purchasedItems ?? {});
                    setPurchasedClothes(state.purchasedClothes ?? { normal: true });
                    setEquippedClotheId(state.equippedClotheId ?? "normal");
                    totalTapsCount = state.totalTapsCount ?? 0;
                    firstPlayTimestamp = state.firstPlayTimestamp ?? null;
                    setHasSeenJapanClear(state.hasSeenJapanClear ?? false);
                    setHasComboTitle1000(state.hasComboTitle1000 ?? false);
                    setSeenButtonHints(state.seenButtonHints ?? { map: false, menu: false, ui: false, feed: false });
                    const hasAnyStamps = state.collectedStamps && Object.keys(state.collectedStamps).length > 0;
                    if (hasAnyStamps) {
                        setCollectedStamps(state.collectedStamps);
                    } else {
                        // 🩹 まだ一度もスタンプが記録されていない場合（この機能が無かった頃のセーブ、
                        // または移行処理を入れる前の版で空のまま保存されてしまったセーブ）、
                        // 既に通過済みの県ぶん、スタンプを遡って押しておく
                        setCollectedStamps({});
                        const passedIndex = state.currentStageIndex ?? 0;
                        const stampUpTo = (state.hasSeenJapanClear === true) ? stages.length : passedIndex; // 既に全制覇済みなら、最後の県ぶんも含める
                        for (let i = 0; i < stampUpTo; i++) collectedStamps[i] = true;
                    }
                    // 🩹 自動修復：以前のバグで「実際は制覇していないのにフラグだけtrueのまま」になっているセーブデータを、
                    // 読み込むたびに実際の進行状況と照らし合わせて自動で正しい状態に戻す
                    const actuallyCleared = (state.currentStageIndex === stages.length - 1) && (state.currentStageProgress >= stages[stages.length - 1].distance);
                    if (hasSeenJapanClear && !actuallyCleared) {
                        setHasSeenJapanClear(false);
                    }
                    setHasSeenTutorial(state.hasSeenTutorial ?? false);
                    setMinigameLastResetDate(state.minigameLastResetDate ?? null);
                    setMinigamePlaysUsedToday(state.minigamePlaysUsedToday ?? { quiz: 0, timeattack: 0, concentration: 0, mochitsuki: 0 });
                    setFeedLastResetDate(state.feedLastResetDate ?? '');
                    setFeedPlaysUsedToday(state.feedPlaysUsedToday ?? 0);
                    if (state.minigameSeenUnlocked) {
                        setMinigameSeenUnlocked(state.minigameSeenUnlocked);
                    } else {
                        // 旧セーブ(この機能が無かった頃)からの移行：既に解放済みのものは「既知」扱いにして、いきなり全部光らないようにする
                        setMinigameSeenUnlocked({});
                        Object.values(minigames).forEach(g => {
                            minigameSeenUnlocked[g.id] = (state.currentStageIndex ?? 0) >= g.unlockStage;
                        });
                    }
                    setMinigameBests(state.minigameBests ?? { timeattack: 0, concentration: null });
                    setPrefTaps(state.prefTaps ?? new Array(CONFIG.PREFECTURE_COUNT).fill(0));
                    lastActiveTimestamp = state.lastActiveTimestamp ?? null;
                    setPrestigeCount(state.prestigeCount ?? 0);
                    setPrestigeScoreHistory(state.prestigeScoreHistory ?? []);
                    setPrestigePoints(state.prestigePoints ?? 0);
                    setGachaCoins(state.gachaCoins ?? 0);
                    setMinigameCoins(state.minigameCoins ?? 0);
                    setTicketInventory(state.ticketInventory ?? { minigameTicket: 0, cooldownTicket: 0, mochi30minTicket: 0 });
                    setSprayInventory(state.sprayInventory ?? { spray_normalRare: 0, spray_rare: 0 });
                    setActiveSprayId(state.activeSprayId ?? null);
                    setSprayBuffActiveUntil(state.sprayBuffActiveUntil ?? 0);
                    setFavoriteFriendIds(state.favoriteFriendIds ?? []);
                    setBlockedUserIds(state.blockedUserIds ?? []);
                    setLastGiftSentDateStr(state.lastGiftSentDateStr ?? null);
                    setSlotPlaysRemaining(state.slotPlaysRemaining ?? 0);
                    setSlotBonusZoneSpinsLeft(state.slotBonusZoneSpinsLeft ?? 0);
                    setSlotTotalPulls(state.slotTotalPulls ?? 0);
                    setSlotPullsSinceJackpot(state.slotPullsSinceJackpot ?? 0);
                    setSlotJackpotCount(state.slotJackpotCount ?? 0);
                    setSlotShortestJackpotPulls(state.slotShortestJackpotPulls ?? null);
                    setSlotLongestJackpotPulls(state.slotLongestJackpotPulls ?? null);
                    setOwnedKisekaeItems({ hat: [], face: [], clothes: ['clothes_mochisuke_tshirt'], back: [], fullbody: [], ...(state.ownedKisekaeItems || {}) });
                    setEquippedKisekae({ hat: null, face: null, clothes: 'clothes_mochisuke_tshirt', back: null, fullbody: null, ...(state.equippedKisekae || {}) });
                    setMissionCounters({ ...missionCounters, ...(state.missionCounters || {}) });
                    setMissionDailyDate(state.missionDailyDate ?? '');
                    setMissionWeeklyWeekKey(state.missionWeeklyWeekKey ?? '');
                    setMissionDailySelected(state.missionDailySelected ?? []);
                    setMissionWeeklySelected(state.missionWeeklySelected ?? []);
                    setMissionClaimed(state.missionClaimed ?? {});
                    setTutorialMissionStep(state.tutorialMissionStep ?? 0);
                    setOwnedMyroomItems({ wallpaper: ['wallpaper_default'], flooring: ['flooring_default'], wall_deco: [], big_furniture: [], table: [], small_deco: [], ...(state.ownedMyroomItems || {}) });
                    setEquippedMyroom({
                        wallpaper: 'wallpaper_default', flooring: 'flooring_default',
                        wall_deco: [], big_furniture: [], table: [], small_deco: [],
                        ...(state.equippedMyroom || {}),
                    });
                    // 🐛互換性：旧セーブ（単一アイテムID形式）が残っていた場合は、配列形式に安全変換する
                    ['wall_deco', 'big_furniture', 'table', 'small_deco'].forEach(cat => {
                        if (!Array.isArray(equippedMyroom[cat])) {
                            const oldId = equippedMyroom[cat];
                            equippedMyroom[cat] = oldId ? [{ itemId: oldId, top: MYROOM_SLOT_POSITIONS[cat].top, left: MYROOM_SLOT_POSITIONS[cat].left, flip: false }] : [];
                        }
                    });
                    setMyroomSlots(state.myroomSlots ?? [null, null, null]);
                    setCurrentMyroomSlotIndex(state.currentMyroomSlotIndex ?? 0);
                    // 旧セーブ(offlineCapBonusHours/minigameDailyBonusPlays)からの引き継ぎに対応しつつ、新形式へ統合
                    setPrestigeShopLv(state.prestigeShopLv ?? {
                        offlineCap: state.offlineCapBonusHours ?? 0,
                        minigamePlays: state.minigameDailyBonusPlays ?? 0,
                        omiyagePriceDiscount: 0, omiyagePriceCurve: 0,
                        startingBonus: 0, skillCdReduction: 0, minigameReward: 0,
                    });
                    if (state.skills) {
                        Object.keys(state.skills).forEach(k => {
                            if (skills[k]) skills[k].lv = state.skills[k].lv ?? skills[k].lv;
                        });
                    }
                } catch(e) { console.error("データ読み込み失敗", e); }
            }
            if (!firstPlayTimestamp) firstPlayTimestamp = Date.now();
        }

        // 🛟 ローカルにセーブが全く無い状態で起動した時、クラウドにバックアップが残っていないか自動でチェックする
        // （「データが消えたことに気づかないまま最初からプレイしてしまう」事故を防ぐための保険）
        /**
         * ローカルにセーブが無い状態で起動した際、クラウド上に復元可能なバックアップがあるかポーリングで確認し、あれば復元を促す。
         * @returns {void}
         */
        export function checkForCloudRestoreOnLoad() {
            if (hadLocalSaveOnLoad) return;
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                if (window.isRankingReady && window.isRankingReady()) {
                    clearInterval(poll);
                    const backup = await window.restoreSaveData();
                    if (!backup || !backup.data) return;
                    try {
                        const parsed = JSON.parse(backup.data);
                        // 意味のある進行データがある場合だけ声をかける（真っさらな空バックアップは無視）
                        const hasProgress = (parsed.score && parsed.score > 0) || (parsed.currentStageIndex && parsed.currentStageIndex > 0);
                        if (!hasProgress) return;
                        const when = backup.updatedAt ? new Date(backup.updatedAt).toLocaleString('ja-JP') : '不明';
                        if (confirm(`このブラウザにはセーブデータが見当たりませんが、クラウドに以前のデータ（最終更新: ${when}）が見つかりました。復元しますか？`)) {
                            localStorage.setItem('mochisuke_save_data', backup.data);
                            location.reload();
                        }
                    } catch (e) { /* 壊れたバックアップは無視 */ }
                } else if (attempts > CONFIG.CLOUD_RESTORE_MAX_POLL_ATTEMPTS) { // 約10秒待っても繋がらなければ諦める（オフライン等）
                    clearInterval(poll);
                }
            }, CONFIG.CLOUD_RESTORE_POLL_INTERVAL_MS);
        }

        // 🎁 オフライン収益：離れている間の自動増加(mps)ぶんを、もちの数だけ増やす（進行度には一切影響させない）



        // ===================================================================
        // フェーズ3：他ファイルから書き換えるためのsetter関数
        // importした束縛には直接代入できない（ESモジュールの仕様）ため、他ファイルから
        // この値を書き換える必要があるものは、この関数を呼んでもらう形にしています。
        // ===================================================================
        /**
         * playerName変数を書き換えるsetter（importした束縛には直接代入できないための橋渡し）。
         * @param {string} v - 設定するプレイヤー名
         * @returns {void}
         */
        export function setPlayerName(v) { playerName = v; }
        /**
         * score変数を書き換えるsetter（importした束縛には直接代入できないための橋渡し）。
         * @param {number} v - 設定するスコア値
         * @returns {void}
         */
        export function setScore(v) { score = v; }
        /**
         * totalTapsCount変数を書き換えるsetter（importした束縛には直接代入できないための橋渡し）。
         * @param {number} v - 設定する累計タップ数
         * @returns {void}
         */
        export function setTotalTapsCount(v) { totalTapsCount = v; }


        // 🌉 橋渡し（migration bridge）— フェーズ2で「読み取り」はimportに置き換え済み
        // ・フェーズ1（ES Modules化）：このファイルの変数・関数すべてにexportを付けた。
        // ・フェーズ2（このブロック）：他ファイルがこのファイルの値を「読むだけ」で使っている
        //   箇所は、ファイル先頭の import文 に置き換えた（各ファイルの一番上を見れば、そのファイルが
        //   他のどのファイルの何を使っているかが一目で分かるようになった）。
        //   下に残っているのは、他ファイルがこの変数へ「代入」もしている（書き換える）ものだけ。
        //   ESモジュールのimportは読み取り専用の束縛なので、書き換えが必要な変数はまだ
        //   window経由の暗黙グローバルに頼っている。
        //
        // 🐛関連の重大バグの記録：以前ここを window.名前 = 名前 という「値の一回きりのコピー」に
        // していたところ、let で宣言された変数はコピーした瞬間の値のまま凍結され、後から
        // 値が変わってもwindow側に反映されない、というバグがあった（もち数が起動のたびに0に戻る
        // 原因になった。詳しくは解体新書 第4章）。そこで書き換わる可能性がある変数（let）は
        // Object.defineProperty で「get/setする度に必ずこのファイル本来の変数を読み書きする」
        // ようにしてある。書き換わらない値（const・関数・クラス）は単純コピーのままで問題ない。
        //
        // 🚧 フェーズ3の予定：下に残っている「代入もされている」変数を、setter関数
        // （例：addScore(n) のような関数）に置き換えていけば、この橋渡しブロックごと削除できる。
        // ===================================================================
        window.menuSaveGame = menuSaveGame;
        window.menuSaveAndQuit = menuSaveAndQuit;
        window.exportSaveData = exportSaveData;
        window.importSaveData = importSaveData;
        window.manualCloudBackup = manualCloudBackup;
        window.restoreFromCloud = restoreFromCloud;
        window.savePlayerName = savePlayerName;
