        function menuSaveGame() {
            saveGame();
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            alert("💾 セーブしました！");
        }

        function menuSaveAndQuit() {
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
        function exportSaveData() {
            saveGame();
            const raw = localStorage.getItem('mochisuke_save_data');
            const el = document.getElementById('save-export-text');
            if (!raw) { el.value = ''; alert('セーブデータが見つかりませんでした'); return; }
            el.value = btoa(unescape(encodeURIComponent(raw))); // 文字化け防止のためbase64化
            el.select();
            try { document.execCommand('copy'); alert('コピーしました！移動先の「読み込む」欄に貼り付けてください'); }
            catch (e) { alert('下のテキストを手動でコピーしてください'); }
        }

        function importSaveData() {
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

        async function refreshCloudBackupStatus() {
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
        async function manualCloudBackup() {
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

        async function restoreFromCloud() {
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

        function sanitizePlayerName(rawName) {
            let n = String(rawName || '').trim();
            if (!n) return { ok: false, reason: '名前を入力してください' };
            n = n.slice(0, 20);
            if (/^(.)\1{2,}$/u.test(n)) return { ok: false, reason: '同じ文字の連続は使えません' };
            if (!/[^\s!-\/:-@\[-`{-~]/u.test(n)) return { ok: false, reason: '記号だけの名前は使えません' };
            return { ok: true, name: n };
        }

        function savePlayerName() {
            const input = document.getElementById('player-name-input');
            const result = sanitizePlayerName(input.value);
            if (!result.ok) { alert(result.reason); return; }
            playerName = result.name;
            localStorage.setItem('punicker_player_name', playerName);
            if (window.submitRankingScore) window.submitRankingScore(playerName, score, totalTapsCount, prestigeCount, equippedKisekae);
            alert('保存しました！');
        }

        let score = 0; 
        let totalTapsCount = 0;       // 日本制覇演出の統計表示用
        let firstPlayTimestamp = null; // 初回プレイ日時（統計表示用）
        let lastActiveTimestamp = null; // 最後にセーブした時刻（オフライン収益の計算に使う）
        const OFFLINE_EARNINGS_CAP_HOURS_BASE = 4; // オフライン収益として計算する時間の上限（これ以上離れていても4時間分だけ）
        const OFFLINE_EARNINGS_MIN_SECONDS = 90; // これより短い離席では出さない（毎回のリロードで鬱陶しくならないように）

        // 🔄 転生システム
        let playerName = localStorage.getItem('punicker_player_name') || ('もちすけファン' + Math.floor(Math.random() * 10000));

        // ===================================================================
        // 🎮 ミニゲームセンター
        // ===================================================================
        function saveGame() {
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
                slotTotalPulls: slotTotalPulls, slotPullsSinceJackpot: slotPullsSinceJackpot, slotJackpotCount: slotJackpotCount,
                slotShortestJackpotPulls: slotShortestJackpotPulls, slotLongestJackpotPulls: slotLongestJackpotPulls,
                ownedKisekaeItems: ownedKisekaeItems, equippedKisekae: equippedKisekae,
                missionCounters: missionCounters, missionDailyDate: missionDailyDate, missionWeeklyWeekKey: missionWeeklyWeekKey,
                missionDailySelected: missionDailySelected, missionWeeklySelected: missionWeeklySelected,
                missionClaimed: missionClaimed, tutorialMissionStep: tutorialMissionStep,
                ownedMyroomItems: ownedMyroomItems, equippedMyroom: equippedMyroom
            };
            localStorage.setItem('mochisuke_save_data', JSON.stringify(state));
        }

        let hadLocalSaveOnLoad = false;
        function loadGame() {
            const data = localStorage.getItem('mochisuke_save_data');
            hadLocalSaveOnLoad = !!data;
            if (data) {
                try {
                    const state = JSON.parse(data);
                    score = state.score ?? 0;
                    currentStageIndex = state.currentStageIndex ?? 0;
                    selectedStageIndex = state.selectedStageIndex ?? 0;
                    currentStageProgress = state.currentStageProgress ?? 0;
                    purchasedItems = state.purchasedItems ?? {};
                    purchasedClothes = state.purchasedClothes ?? { normal: true };
                    equippedClotheId = state.equippedClotheId ?? "normal";
                    totalTapsCount = state.totalTapsCount ?? 0;
                    firstPlayTimestamp = state.firstPlayTimestamp ?? null;
                    hasSeenJapanClear = state.hasSeenJapanClear ?? false;
                    hasComboTitle1000 = state.hasComboTitle1000 ?? false;
                    seenButtonHints = state.seenButtonHints ?? { map: false, menu: false, ui: false, feed: false };
                    const hasAnyStamps = state.collectedStamps && Object.keys(state.collectedStamps).length > 0;
                    if (hasAnyStamps) {
                        collectedStamps = state.collectedStamps;
                    } else {
                        // 🩹 まだ一度もスタンプが記録されていない場合（この機能が無かった頃のセーブ、
                        // または移行処理を入れる前の版で空のまま保存されてしまったセーブ）、
                        // 既に通過済みの県ぶん、スタンプを遡って押しておく
                        collectedStamps = {};
                        const passedIndex = state.currentStageIndex ?? 0;
                        const stampUpTo = (state.hasSeenJapanClear === true) ? stages.length : passedIndex; // 既に全制覇済みなら、最後の県ぶんも含める
                        for (let i = 0; i < stampUpTo; i++) collectedStamps[i] = true;
                    }
                    // 🩹 自動修復：以前のバグで「実際は制覇していないのにフラグだけtrueのまま」になっているセーブデータを、
                    // 読み込むたびに実際の進行状況と照らし合わせて自動で正しい状態に戻す
                    const actuallyCleared = (state.currentStageIndex === stages.length - 1) && (state.currentStageProgress >= stages[stages.length - 1].distance);
                    if (hasSeenJapanClear && !actuallyCleared) {
                        hasSeenJapanClear = false;
                    }
                    hasSeenTutorial = state.hasSeenTutorial ?? false;
                    minigameLastResetDate = state.minigameLastResetDate ?? null;
                    minigamePlaysUsedToday = state.minigamePlaysUsedToday ?? { quiz: 0, timeattack: 0, concentration: 0, mochitsuki: 0 };
                    feedLastResetDate = state.feedLastResetDate ?? '';
                    feedPlaysUsedToday = state.feedPlaysUsedToday ?? 0;
                    if (state.minigameSeenUnlocked) {
                        minigameSeenUnlocked = state.minigameSeenUnlocked;
                    } else {
                        // 旧セーブ(この機能が無かった頃)からの移行：既に解放済みのものは「既知」扱いにして、いきなり全部光らないようにする
                        minigameSeenUnlocked = {};
                        Object.values(minigames).forEach(g => {
                            minigameSeenUnlocked[g.id] = (state.currentStageIndex ?? 0) >= g.unlockStage;
                        });
                    }
                    minigameBests = state.minigameBests ?? { timeattack: 0, concentration: null };
                    prefTaps = state.prefTaps ?? new Array(47).fill(0);
                    lastActiveTimestamp = state.lastActiveTimestamp ?? null;
                    prestigeCount = state.prestigeCount ?? 0;
                    prestigeScoreHistory = state.prestigeScoreHistory ?? [];
                    prestigePoints = state.prestigePoints ?? 0;
                    gachaCoins = state.gachaCoins ?? 0;
                    minigameCoins = state.minigameCoins ?? 0;
                    ticketInventory = state.ticketInventory ?? { minigameTicket: 0, cooldownTicket: 0, mochi30minTicket: 0 };
                    slotPlaysRemaining = state.slotPlaysRemaining ?? 0;
                    slotBonusZoneSpinsLeft = state.slotBonusZoneSpinsLeft ?? 0;
                    slotTotalPulls = state.slotTotalPulls ?? 0;
                    slotPullsSinceJackpot = state.slotPullsSinceJackpot ?? 0;
                    slotJackpotCount = state.slotJackpotCount ?? 0;
                    slotShortestJackpotPulls = state.slotShortestJackpotPulls ?? null;
                    slotLongestJackpotPulls = state.slotLongestJackpotPulls ?? null;
                    ownedKisekaeItems = { hat: [], face: [], clothes: ['clothes_mochisuke_tshirt'], back: [], fullbody: [], ...(state.ownedKisekaeItems || {}) };
                    equippedKisekae = { hat: null, face: null, clothes: 'clothes_mochisuke_tshirt', back: null, fullbody: null, ...(state.equippedKisekae || {}) };
                    missionCounters = { ...missionCounters, ...(state.missionCounters || {}) };
                    missionDailyDate = state.missionDailyDate ?? '';
                    missionWeeklyWeekKey = state.missionWeeklyWeekKey ?? '';
                    missionDailySelected = state.missionDailySelected ?? [];
                    missionWeeklySelected = state.missionWeeklySelected ?? [];
                    missionClaimed = state.missionClaimed ?? {};
                    tutorialMissionStep = state.tutorialMissionStep ?? 0;
                    ownedMyroomItems = state.ownedMyroomItems ?? { wallpaper: ['wallpaper_default'], flooring: ['flooring_default'], wall_deco: [], big_furniture: [], table: [], small_deco: [] };
                    equippedMyroom = state.equippedMyroom ?? { wallpaper: 'wallpaper_default', flooring: 'flooring_default', wall_deco: null, big_furniture: null, table: null, small_deco: null };
                    // 旧セーブ(offlineCapBonusHours/minigameDailyBonusPlays)からの引き継ぎに対応しつつ、新形式へ統合
                    prestigeShopLv = state.prestigeShopLv ?? {
                        offlineCap: state.offlineCapBonusHours ?? 0,
                        minigamePlays: state.minigameDailyBonusPlays ?? 0,
                        omiyagePriceDiscount: 0, omiyagePriceCurve: 0,
                        startingBonus: 0, skillCdReduction: 0, minigameReward: 0,
                    };
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
        function checkForCloudRestoreOnLoad() {
            if (hadLocalSaveOnLoad) return; // ローカルにセーブがあれば何もしない
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
                } else if (attempts > 20) { // 約10秒待っても繋がらなければ諦める（オフライン等）
                    clearInterval(poll);
                }
            }, 500);
        }

        // 🎁 オフライン収益：離れている間の自動増加(mps)ぶんを、もちの数だけ増やす（進行度には一切影響させない）
