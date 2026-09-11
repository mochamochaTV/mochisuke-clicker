        // ui.js を機能ごとに分割したファイルの1つ（フレンド・他人の部屋への訪問（フレンドリスト・招待・訪問中の演出・移動メニュー・ものおき））。ui.js 自身は7ファイルをre-exportする窓口。

        import { KISEKAE_ITEMS, MOVE_MENU_PARTS, MYROOM_ITEMS, WAREHOUSE_ITEM_PARTS, stages } from '../../data.js?v=2026-09-11-003';
        import { escapeHtml, playAudioFile, playBgmLoop, spawnModalFloatingText, spawnModalParticleBurst, vibrate } from '../../main.js?v=2026-09-11-003';
        import { equippedKisekae, gachaCoins, setGachaCoins } from '../../progress.js?v=2026-09-11-003';
        import { blockedUserIds, favoriteFriendIds, purchasedItems, updateGachaCoinDisplay } from '../../shop.js?v=2026-09-11-003';
        import { saveGame } from '../../state.js?v=2026-09-11-003';
        import { closeModal, openModal, openTrophyRoom } from './core.js?v=2026-09-11-003';
        import { CHAT_SEND_COOLDOWN_MS, activeChatIsHost, activeChatOtherUid, activeChatRoomId, ensureChatEligibilityAnswered, joinFriendRoomAndChat, lastChatSendAt, myAvatarPrefix, openHostWaitingRoom, otherAvatarPrefix, setActiveChatIsHost, setActiveChatOtherUid, setActiveChatRoomId, setChatUiVisible, setLastChatSendAt, setMyAvatarPrefix, setOtherAvatarPrefix, setVisitActionButtonsForHosting, stopRoomSessionWatch } from './chat.js?v=2026-09-11-003';
        import { MYROOM_WALK_SPEED_PCT_PER_SEC, openTicketInventory } from './myroom.js?v=2026-09-11-003';
        import { openOmiyageCollection, updateDisplay } from './hud.js?v=2026-09-11-003';
        import { openDiary, renderRankOutfitPreviewHtml } from './ranking.js?v=2026-09-11-003';

        // 🔧 このファイル内で使う「調整可能な数値」をまとめた設定オブジェクト
        const CONFIG = {
            // === フェード演出（モーダルを閉じる時の共通タイミング） ===
            FADE_TRANSITION_MS: 300, // モーダルを閉じるフェードが完了するまでの待ち時間
            FADE_CLEAR_DELAY_MS: 150, // フェード用の黒いオーバーレイを消すまでの待ち時間

            // === いいね（部屋訪問） ===
            LIKE_REWARD_COINS: 1, // いいねを送った自分がもらえるガチャコイン枚数
            LIKE_COIN_POPUP_REMOVE_MS: 1300, // 「🪙 +1」ポップアップをDOMから削除するまでの時間

            // === 訪問中のもちすけのランダム歩行 ===
            VISIT_WALK_PAUSE_MIN_MS: 3000, // 次の歩行までの最短待機時間
            VISIT_WALK_PAUSE_RANDOM_RANGE_MS: 4000, // 待機時間に加えるランダム幅（合計で3〜7秒になる）
            VISIT_WALK_LEFT_MIN_PCT: 12, // 歩行先のleft%の最小値
            VISIT_WALK_LEFT_RANDOM_RANGE_PCT: 76, // 歩行先のleft%に加えるランダム幅
            VISIT_WALK_BOTTOM_MIN_PCT: 1, // 歩行先のbottom%の最小値
            VISIT_WALK_BOTTOM_RANDOM_RANGE_PCT: 8, // 歩行先のbottom%に加えるランダム幅
            VISIT_WALK_DEFAULT_LEFT_PCT: 50, // wrap.style.leftが未設定の時のフォールバック値
            VISIT_WALK_MIN_DURATION_SEC: 0.5, // 歩行にかける最短時間（近距離でも不自然に速くならないように）
            VISIT_WALK_SOUND_VOLUME: 0.12, // 歩行時の足音の音量

            // === マイルームのアクション同期（ライブ訪問時） ===
            TAP_SYNC_THROTTLE_MS: 300, // タップの同期送信を間引く間隔

            // === もちすけタップ演出 ===
            TAP_EFFECT_DURATION_MS: 220, // つぶれるアニメーションの長さ
            TAP_EFFECT_PARTICLE_COUNT: 6, // タップ時に散らすパーティクルの数

            // === もちすけの「叫ぶ」演出 ===
            SCREAM_VIBRATE_PATTERN_MS: [20, 30, 20], // 叫んだ時の振動パターン
            SCREAM_EFFECT_DURATION_MS: 2600, // 元の見た目に戻すまでの時間
            SCREAM_FLOAT_TEXT_COUNT: 5, // 浮かせる「あ゛」の数
            SCREAM_FLOAT_DIST_MIN_PX: 30, // 浮遊テキストの拡散距離の最小値
            SCREAM_FLOAT_DIST_RANDOM_RANGE_PX: 50, // 浮遊テキストの拡散距離に加えるランダム幅
            SCREAM_FLOAT_STAGGER_MS: 55, // 浮遊テキストを1つずつ出す間隔

            // === もちすけの「ごはん」演出 ===
            FEED_VIBRATE_PATTERN_MS: [20, 40, 20], // ごはんを食べた時の振動パターン
            FEED_EFFECT_DURATION_MS: 500, // 食べるアニメーションの長さ
            FEED_EFFECT_PARTICLE_COUNT: 10, // ごはん演出で散らすパーティクルの数
            FEED_ICON_RETURN_OFFSET_PX: 20, // 的を外した時、アイコンを戻す位置のY方向オフセット
            FEED_ICON_RETURN_TRANSITION_MS: 320, // アイコンが戻るtransitionを解除するまでの待ち時間

            // === マイルーム招待パネル ===
            INVITE_DOT_REFRESH_INTERVAL_MS: 10000, // オンライン/オフラインの丸表示を再判定する間隔

            // === オンライン機能の準備待ち・受信通知 ===
            RANKING_READY_RETRY_MS: 500, // オンライン機能の準備ができるまでのリトライ間隔
            INCOMING_STAMP_ALERT_DELAY_MS: 500, // 受信した訪問スタンプをalertで知らせるまでの遅延
            INCOMING_INVITE_CONFIRM_DELAY_MS: 400, // 受信した部屋招待の確認ダイアログを出すまでの遅延
            INCOMING_GIFTS_ALERT_DELAY_MS: 800, // 起動時の贈り物受け取り通知を出すまでの遅延

            // === 移動メニューのもちすけ巡回演出 ===
            MOVE_LOOP_INTERVAL_MS: 1500, // 看板を切り替える間隔
            MOVE_SHRINK_DURATION_MS: 260, // 看板を切り替える瞬間の縮みアニメーションの長さ
            MOVE_MOCHISUKE_WIDTH_RATIO: 0.55, // 「戻る看板」の幅を基準にしたもちすけの表示幅の比率
            MOVE_MOCHISUKE_TOP_OFFSET_RATIO: 0.15, // 看板の高さを基準にしたもちすけのtop位置の比率
            MOVE_MOCHISUKE_LEFT_OFFSET_PCT: 1.5, // 看板の右端からもちすけを離す距離

            // === ものおき ===
            OMIYAGE_BADGE_RIGHT_OFFSET_PCT: 12, // おみやげバッジをアイテム右端から左にずらす距離
        };

        // 🤝 フレンド機能
        /**
         * フレンド画面（friend-modal）を開き、入力欄をリセットしてから自分のフレンドコードを取得して表示し、フレンドタブを「一覧」に切り替える。window.openFriendPlaceholder としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {Promise<void>}
         */
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
        /**
         * モジュール内のexport let変数 visitingUid（訪問中の相手のuid）を更新するセッター。
         * @param {string|null} v - 新しいvisitingUidの値
         * @returns {void}
         */
        export function setVisitingUid(v) { visitingUid = v; }
        /**
         * 指定uidのマイルームを取得して訪問画面を開き、部屋レイアウト・服装を描画し、いいね状態も反映する。window.visitMyroomOf としてグローバル公開され、動的生成される🏠ボタンのonclick=""から呼ばれる橋渡し関数。
         * @param {string} uid - 訪問先ユーザーのuid
         * @param {boolean} showBoth - trueならフレンド訪問として自分のもちすけも一緒に表示する
         * @returns {Promise<void>}
         */
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
        /**
         * 訪問中の部屋に「いいね」を送る。成功時はボタン表示を変更し、送信者にガチャコインを1枚付与して演出を出す。window.onLikeRoomTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {Promise<void>}
         */
        export async function onLikeRoomTap() {
            if (!visitingUid || !window.likeRoom) return;
            const likeBtn = document.getElementById('visit-like-btn');
            likeBtn.disabled = true;
            const res = await window.likeRoom(visitingUid);
            if (res.success) {
                likeBtn.textContent = '❤️ いいね済み';
                likeBtn.style.background = '#ccc';
                playAudioFile('audio/levelup.mp3');
                setGachaCoins(gachaCoins + (CONFIG.LIKE_REWARD_COINS)); // 🪙 いいねを送った自分も、ガチャコインを1枚もらう
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
        /**
         * 指定要素の位置を基準に「🪙 +1」の文字を浮かせて自動的に消えるポップアップDOM要素を生成・表示する。
         * @param {HTMLElement} anchorEl - ポップアップの基準位置となる要素
         * @returns {void}
         */
        export function showLikeCoinPopup(anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            const popup = document.createElement('div');
            popup.textContent = '🪙 +1';
            popup.style.cssText = `position:fixed; left:${rect.left + rect.width / 2}px; top:${rect.top}px; transform:translateX(-50%); font-size:1.15rem; font-weight:900; color:#ff9800; z-index:9999; pointer-events:none; animation: likeCoinPopupFloat 1.2s ease-out forwards;`;
            document.body.appendChild(popup);
            setTimeout(() => popup.remove(), CONFIG.LIKE_COIN_POPUP_REMOVE_MS);
        }
        /**
         * 訪問中の部屋モーダルを閉じる。フェード演出、ライブチャット中ならセッション退出・状態リセット、アクションメニューやおみやげピッカーの後片付けを行う。window.closeVisitMyroom としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
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
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.FADE_CLEAR_DELAY_MS);
            }, CONFIG.FADE_TRANSITION_MS);
        }
        // 🚶🐛修正：以前はホスト・ゲスト双方の見た目を、host側とguest側それぞれの画面が独立して
        // ランダムに歩かせていたため、2人の画面でもちすけの位置がバラバラになっていた。
        // これ以降は「自分のアバター」だけをこのタイマーでランダムに歩かせ、選んだ目的地を
        // roomSessionsドキュメントに書き込む。相手側は自分で歩かせず、届いた目的地をそのまま
        // 再生する（=applyVisitWalkTarget）ことで、2人の画面の動きを一致させる
        export const visitWalkTimers = { visitHost: null, visitSelf: null };
        /**
         * 指定キー(visitHost/visitSelf)のもちすけのランダム歩行ループを開始する（既存タイマーを止めてから次の歩行をスケジュール）。
         * @param {string} wrapId - 歩かせる対象のDOM要素id
         * @param {string} key - visitWalkTimersのキー（'visitHost'または'visitSelf'）
         * @returns {void}
         */
        export function startVisitMochisukeWalk(wrapId, key) {
            stopVisitMochisukeWalk(key);
            scheduleNextVisitWalk(wrapId, key);
        }
        /**
         * 指定キーの歩行タイマーを止めてクリアする。
         * @param {string} key - visitWalkTimersのキー
         * @returns {void}
         */
        export function stopVisitMochisukeWalk(key) {
            clearTimeout(visitWalkTimers[key]);
            visitWalkTimers[key] = null;
        }
        /**
         * 3〜7秒程度のランダムな待機後に、次のランダム地点への歩行を実行するsetTimeoutを仕込む。
         * @param {string} wrapId - 歩かせる対象のDOM要素id
         * @param {string} key - visitWalkTimersのキー
         * @returns {void}
         */
        export function scheduleNextVisitWalk(wrapId, key) {
            const pauseDuration = CONFIG.VISIT_WALK_PAUSE_MIN_MS + Math.random() * CONFIG.VISIT_WALK_PAUSE_RANDOM_RANGE_MS; // 3〜7秒くらい、その場に立ち止まる
            visitWalkTimers[key] = setTimeout(() => walkVisitMochisukeToRandomSpot(wrapId, key), pauseDuration);
        }
        /**
         * ランダムな新しい位置を決めてapplyVisitWalkTargetで反映し、ライブセッション中なら相手にも目的地を送信、その後次の歩行を再スケジュールする。
         * @param {string} wrapId - 歩かせる対象のDOM要素id
         * @param {string} key - visitWalkTimersのキー
         * @returns {void}
         */
        export function walkVisitMochisukeToRandomSpot(wrapId, key) {
            const wrap = document.getElementById(wrapId);
            if (!wrap || wrap.style.display === 'none') { scheduleNextVisitWalk(wrapId, key); return; }
            const newLeftPct = CONFIG.VISIT_WALK_LEFT_MIN_PCT + Math.random() * CONFIG.VISIT_WALK_LEFT_RANDOM_RANGE_PCT;
            const newBottomPct = CONFIG.VISIT_WALK_BOTTOM_MIN_PCT + Math.random() * CONFIG.VISIT_WALK_BOTTOM_RANDOM_RANGE_PCT;
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
        /**
         * 指定prefixのもちすけが現在フルボディ衣装を着ているかどうかを判定する。
         * @param {string} prefix - もちすけDOM要素のprefix
         * @returns {boolean} フルボディ衣装中ならtrue
         */
        export function isMyroomPrefixFullbody(prefix) {
            // 「マイルーム（一人用/もようがえ）」画面のもちすけだけは applyVisitOutfit を使わず
            // dataset.fullbody を持たないため、グローバルなequippedKisekaeを直接見る
            if (prefix === 'myroom-mochisuke') return !!(equippedKisekae && equippedKisekae.fullbody);
            const el = document.getElementById(prefix + '-mouth-anchor');
            return !!(el && el.dataset.fullbody === '1');
        }
        /**
         * 「歩行中」「叫び中」など複数の理由をSetで管理し、いずれかの理由が残っている間は口パーツを非表示のままにする（全て解消した時だけ表示に戻す）。
         * @param {string} prefix - もちすけDOM要素のprefix
         * @param {string} reason - 非表示にする理由のキー（例: 'walk', 'scream'）
         * @param {boolean} hidden - trueなら理由を追加、falseなら解除
         * @returns {void}
         */
        export function setMyroomMouthHidden(prefix, reason, hidden) {
            const mouthAnchor = document.getElementById(prefix + '-mouth-anchor');
            if (!mouthAnchor || isMyroomPrefixFullbody(prefix)) return; // 全身衣装中は触らない
            const reasons = myroomMouthHideReasons[prefix] || (myroomMouthHideReasons[prefix] = new Set());
            if (hidden) reasons.add(reason); else reasons.delete(reason);
            mouthAnchor.style.display = reasons.size > 0 ? 'none' : 'block';
        }
        // 🚶 実際にDOMへ反映する部分（自分の意思による移動でも、相手から届いた移動でも同じ関数を使うことで、
        // 見た目・速度の計算方法を完全に一致させる）
        /**
         * 実際にDOMへ歩行移動を反映する共通関数。距離から一定速度になるよう移動時間を逆算してtransitionを設定し、歩行中クラス付与・効果音・口パーツ制御を行う。自分の意思による移動でも相手から届いた移動でも同じ関数を使う。
         * @param {string} wrapId - 歩かせる対象のDOM要素id
         * @param {number} newLeftPct - 移動先のleft(%)
         * @param {number} newBottomPct - 移動先のbottom(%)
         * @returns {void}
         */
        export function applyVisitWalkTarget(wrapId, newLeftPct, newBottomPct) {
            const wrap = document.getElementById(wrapId);
            if (!wrap || wrap.style.display === 'none') return;
            const currentLeft = parseFloat(wrap.style.left) || CONFIG.VISIT_WALK_DEFAULT_LEFT_PCT;
            const distance = Math.abs(newLeftPct - currentLeft);
            const moveDuration = Math.max(CONFIG.VISIT_WALK_MIN_DURATION_SEC, distance / MYROOM_WALK_SPEED_PCT_PER_SEC).toFixed(2); // 一定速度になるよう距離から逆算
            wrap.style.transition = `left ${moveDuration}s linear, bottom ${moveDuration}s linear`;
            wrap.style.left = newLeftPct + '%';
            wrap.style.bottom = newBottomPct + '%';
            const inner = document.getElementById(wrapId.replace('-breathe-wrap', '-inner'));
            if (inner) inner.classList.add('myroom-walking');
            playAudioFile('audio/move_small.mp3', CONFIG.VISIT_WALK_SOUND_VOLUME);
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
        /**
         * export let変数 lastAppliedRoomActionTs（相手発の演出イベントの二重再生防止用タイムスタンプ）を更新するセッター。
         * @param {number} v - 新しいタイムスタンプ
         * @returns {void}
         */
        export function setLastAppliedRoomActionTs(v) { lastAppliedRoomActionTs = v; }
        export let lastAppliedOtherWalkTs = 0;  // 相手発の歩行イベントの二重再生防止
        /**
         * export let変数 lastAppliedOtherWalkTs（相手発の歩行イベントの二重再生防止用タイムスタンプ）を更新するセッター。
         * @param {number} v - 新しいタイムスタンプ
         * @returns {void}
         */
        export function setLastAppliedOtherWalkTs(v) { lastAppliedOtherWalkTs = v; }

        // 今の画面文脈（'visit'=訪問/招待中の部屋、'edit'=自分の部屋のプレビュー画面）における
        // 「自分のアバターのprefix」「（いれば）相手のアバターのprefix」を返す
        /**
         * 画面文脈（'edit'=自分の部屋編集画面／それ以外=訪問中の部屋）に応じて、自分・相手のアバターprefixを返す。
         * @param {string} context - 画面文脈（'edit'または'visit'等）
         * @returns {Object} {selfPrefix: string, otherPrefix: (string|null)}
         */
        export function getMyroomActionContext(context) {
            if (context === 'edit') return { selfPrefix: 'myroom-mochisuke', otherPrefix: null };
            if (activeChatRoomId && myAvatarPrefix) return { selfPrefix: myAvatarPrefix, otherPrefix: otherAvatarPrefix };
            return { selfPrefix: 'visit-myroom-mochisuke', otherPrefix: null };
        }
        /**
         * 指定文脈のマイルームアクションサブメニュー（叫ぶ・ごはん等の選択肢）の表示/非表示をトグルする。window.toggleMyroomActionMenu としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} context - 画面文脈
         * @returns {void}
         */
        export function toggleMyroomActionMenu(context) {
            const menu = document.getElementById(context + '-myroom-action-submenu');
            if (menu) menu.classList.toggle('show');
        }
        /**
         * 指定文脈のマイルームアクションサブメニューを閉じる。
         * @param {string} context - 画面文脈
         * @returns {void}
         */
        export function closeMyroomActionMenu(context) {
            const menu = document.getElementById(context + '-myroom-action-submenu');
            if (menu) menu.classList.remove('show');
        }

        // 👉 もちすけをタップ：自分・相手どちらのもちすけをタップしても遊べる、報酬なしの触れ合い演出
        /**
         * もちすけタップ時のタップ演出を再生し、ライブセッション中は300msに1回まで間引いてタップイベントを相手側にも同期送信する。window.onMyroomAvatarTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} prefix - タップされたもちすけDOM要素のprefix
         * @returns {void}
         */
        export function onMyroomAvatarTap(prefix) {
            playMyroomTapEffect(prefix);
            const now = Date.now();
            // 🐛連打対策：タップは瞬間的に大量発生しうるので、見た目の反映は毎回でも、
            // Firestoreへの同期だけは間引く（300msに1回まで）。通信コストを抑えるため
            if (activeChatRoomId && window.sendRoomAction && now - lastMyroomTapSentAt > CONFIG.TAP_SYNC_THROTTLE_MS) {
                lastMyroomTapSentAt = now;
                window.sendRoomAction(activeChatRoomId, { type: 'tap', targetPrefix: prefix, byUid: window.getMyUid && window.getMyUid(), ts: now });
            }
        }

        // 🗣️ 叫ぶ：自分のもちすけだけが対象（タップ画面の「じらされ過ぎて叫ぶ」演出の使い回し）
        /**
         * 自分のもちすけに「叫ぶ」演出を再生し、ライブセッション中は相手側にも同期送信する。window.onMyroomScreamTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} context - 画面文脈
         * @returns {void}
         */
        export function onMyroomScreamTap(context) {
            closeMyroomActionMenu(context);
            const { selfPrefix } = getMyroomActionContext(context);
            playMyroomScreamEffect(selfPrefix);
            if (activeChatRoomId && window.sendRoomAction) {
                window.sendRoomAction(activeChatRoomId, { type: 'scream', targetPrefix: selfPrefix, byUid: window.getMyUid && window.getMyUid(), ts: Date.now() });
            }
        }

        // 🍙 ごはん：倉庫で持っているおみやげから選ばせる（タップ画面と違い、無制限・タップ力バフなし）
        /**
         * 「ごはん」メニューを選んだ際、持っているおみやげ選択パネルを開いて描画する。window.onMyroomFeedTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} context - 画面文脈
         * @returns {void}
         */
        export function onMyroomFeedTap(context) {
            closeMyroomActionMenu(context);
            myroomFeedPickerContext = context;
            renderMyroomFeedPicker();
            document.getElementById('myroom-feed-picker-panel').classList.add('show');
        }
        /**
         * おみやげ選択パネルを閉じる。window.closeMyroomFeedPicker としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function closeMyroomFeedPicker() {
            document.getElementById('myroom-feed-picker-panel').classList.remove('show');
        }
        /**
         * 所持数1以上のおみやげ一覧をグリッド表示する。各セルクリック時にピッカーを閉じておみやげアイコンを配置する処理をその場でバインドする。
         * @returns {void}
         */
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
        /**
         * 選んだおみやげの画像アイコンを自分のもちすけの近くに配置し、ドラッグ開始イベント(pointerdown)を仕込む。
         * @param {number} idx - stages配列内のおみやげのインデックス
         * @returns {void}
         */
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
        /**
         * おみやげアイコンのドラッグ開始処理。カーソル・スタイルを更新し、pointermove/pointerup/pointercancelのグローバルリスナーを登録する。
         * @param {number} idx - stages配列内のおみやげのインデックス
         * @param {HTMLElement} icon - ドラッグ対象のアイコン要素
         * @param {Event} e - pointerdownイベント
         * @returns {void}
         */
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
        /**
         * ドラッグ中、おみやげアイコンをポインタ位置に追従させる。
         * @param {Event} e - pointermoveイベント
         * @returns {void}
         */
        export function onMyroomFeedDragMove(e) {
            if (!myroomFeedDragState) return;
            myroomFeedDragState.icon.style.left = e.clientX + 'px';
            myroomFeedDragState.icon.style.top = e.clientY + 'px';
        }
        /**
         * ドラッグ終了処理。離した座標が自分/相手のもちすけの矩形内であれば給餌演出を再生してライブ同期し、外れていれば自分の足元へアイコンを戻す。イベントリスナーの解除も行う。
         * @param {Event} e - pointerup/pointercancelイベント
         * @returns {void}
         */
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
                    icon.style.top = (r.bottom + CONFIG.FEED_ICON_RETURN_OFFSET_PX) + 'px';
                    icon.style.cursor = 'grab';
                    setTimeout(() => { icon.style.transition = 'none'; }, CONFIG.FEED_ICON_RETURN_TRANSITION_MS);
                }
            }
        }

        // ===== 実際の見た目の演出（自分の操作でも、相手から届いた同期でも、この共通関数を使う） =====
        /**
         * 指定prefixのもちすけに、タップ時のぷにっと潰れる伸縮アニメーションと効果音・パーティクルを再生する共通演出関数。
         * @param {string} prefix - もちすけDOM要素のprefix
         * @returns {void}
         */
        export function playMyroomTapEffect(prefix) {
            const wrap = document.getElementById(prefix + '-breathe-wrap');
            const inner = document.getElementById(prefix + '-inner');
            if (!wrap || wrap.style.display === 'none' || !inner) return;
            playAudioFile('audio/tap.mp3');
            inner.animate([
                { transform: 'scale(1, 1)' },
                { transform: 'scale(1.15, 0.85)', offset: 0.4 },
                { transform: 'scale(1, 1)' }
            ], { duration: CONFIG.TAP_EFFECT_DURATION_MS, easing: 'ease-out' });
            const rect = wrap.getBoundingClientRect();
            spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, CONFIG.TAP_EFFECT_PARTICLE_COUNT, '#ffcc80');
        }
        // 😱🐛修正：タップ画面と同じimage_scream.webpに差し替えるようにした。マイルームの体は
        // 「衣装(clothes)」「帽子/顔」「フルボディ衣装」に分かれた重ね着き構造なので、タップ画面の
        // 単一画像(mochiBtnElement.src)swapと同じ見た目にするため、叫んでいる間だけ帽子・顔・
        // フルボディ衣装を隠して衣装レイヤーだけをimage_scream.webpに差し替え、終わったら全て元に戻す
        export const myroomScreamState = {}; // prefixごとに、叫ぶ前の状態を覚えておいて正確に巻き戻す
        /**
         * 指定prefixのもちすけに「叫ぶ」演出を再生する。衣装レイヤーをimage_scream.webpに一時差し替えし、帽子・顔・フルボディ衣装を隠して、一定時間後に自動で元に戻すタイマーを仕込む。連続で叫んだ場合は古い巻き戻しタイマーを破棄する。
         * @param {string} prefix - もちすけDOM要素のprefix
         * @returns {void}
         */
        export function playMyroomScreamEffect(prefix) {
            const wrap = document.getElementById(prefix + '-breathe-wrap');
            const inner = document.getElementById(prefix + '-inner');
            const clothesEl = document.getElementById(prefix + '-clothes');
            if (!wrap || wrap.style.display === 'none' || !inner || !clothesEl) return;
            playAudioFile('audio/mochisuke/mochi_scream.mp3');
            vibrate(CONFIG.SCREAM_VIBRATE_PATTERN_MS);
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
            state.revertTimeout = setTimeout(() => revertMyroomScreamEffect(prefix), CONFIG.SCREAM_EFFECT_DURATION_MS); // タップ画面と同じ長さキープ
            const rect = wrap.getBoundingClientRect();
            for (let i = 0; i < CONFIG.SCREAM_FLOAT_TEXT_COUNT; i++) {
                setTimeout(() => {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = CONFIG.SCREAM_FLOAT_DIST_MIN_PX + Math.random() * CONFIG.SCREAM_FLOAT_DIST_RANDOM_RANGE_PX;
                    const x = rect.left + rect.width / 2 + Math.cos(angle) * dist;
                    const y = rect.top + rect.height / 3 + Math.sin(angle) * dist - 20;
                    spawnModalFloatingText(x, y, 'あ゛', '#e91e63', (1.1 + Math.random() * 0.7) + 'rem');
                }, i * CONFIG.SCREAM_FLOAT_STAGGER_MS);
            }
        }
        // 叫び終わったら、衣装・帽子・顔・フルボディ衣装の表示状態を叫ぶ前と完全に一致するよう戻す
        /**
         * 叫び演出が終わった際、衣装・帽子・顔・フルボディ衣装・口パーツの表示状態を叫ぶ前の状態と完全に一致するよう戻す。
         * @param {string} prefix - もちすけDOM要素のprefix
         * @returns {void}
         */
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
        /**
         * 指定prefixのもちすけに給餌（ごはん）演出を再生する。伸縮・回転アニメーション、効果音、浮遊テキスト、パーティクルを表示する。
         * @param {string} prefix - もちすけDOM要素のprefix
         * @param {number} idx - stages配列内のおみやげのインデックス
         * @returns {void}
         */
        export function playMyroomFeedEffect(prefix, idx) {
            const wrap = document.getElementById(prefix + '-breathe-wrap');
            const inner = document.getElementById(prefix + '-inner');
            const stage = stages[idx];
            if (!wrap || wrap.style.display === 'none' || !inner || !stage) return;
            playAudioFile('audio/mochisuke/mochi_eat.mp3');
            vibrate(CONFIG.FEED_VIBRATE_PATTERN_MS);
            inner.animate([
                { transform: 'scale(1, 1) rotate(0deg)' },
                { transform: 'scale(1.25, 0.8) rotate(-4deg)', offset: 0.25 },
                { transform: 'scale(0.85, 1.2) rotate(4deg)', offset: 0.5 },
                { transform: 'scale(1.1, 0.92) rotate(-2deg)', offset: 0.75 },
                { transform: 'scale(1, 1) rotate(0deg)' }
            ], { duration: CONFIG.FEED_EFFECT_DURATION_MS, easing: 'ease-in-out' });
            const rect = wrap.getBoundingClientRect();
            spawnModalFloatingText(rect.left + rect.width / 2, rect.top + rect.height / 3, `${stage.item}おいしい〜！`, '#ff9800', '1rem');
            spawnModalParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, CONFIG.FEED_EFFECT_PARTICLE_COUNT, '#ffd54f');
        }
        // 🎭 相手から届いた演出イベントを、自分の画面でも再生する（自分自身の書き込みは無視する）
        /**
         * 相手から届いた演出イベント（scream/feed/tap）の種類に応じて、対応する演出再生関数を呼び出す振り分け関数。自分自身の書き込みは呼び出し元側で無視する想定。
         * @param {Object} action - 演出イベント（{type, targetPrefix, itemIdx}等）
         * @returns {void}
         */
        export function applyRemoteRoomAction(action) {
            if (!action || !action.targetPrefix) return;
            if (action.type === 'scream') playMyroomScreamEffect(action.targetPrefix);
            else if (action.type === 'feed') playMyroomFeedEffect(action.targetPrefix, action.itemIdx);
            else if (action.type === 'tap') playMyroomTapEffect(action.targetPrefix);
        }
        /**
         * 訪問先の部屋データから壁紙・床・家具レイヤーを描画する。カテゴリごとの家具インスタンスをMYROOM_ITEMS定義と突き合わせて画像要素を生成・配置する。
         * @param {Object} myroomData - 訪問先の部屋データ
         * @returns {void}
         */
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
        /**
         * 指定outfitデータ（着せ替え内容）を指定prefixのもちすけDOMに反映する。フルボディ衣装の有無で衣装レイヤー・帽子・顔・口パーツの表示を切り替え、背中装備(back)の左右羽根も反映する。
         * @param {Object} outfit - 着せ替えデータ
         * @param {string} prefix - もちすけDOM要素のprefix
         * @returns {void}
         */
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
        /**
         * 定型スタンプ（決まり文句）を、ライブチャット中ならチャットへ、そうでなければ訪問中の相手への通常のスタンプとして送信する。window.sendVisitStamp としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} text - 送信する定型文の内容
         * @returns {Promise<void>}
         */
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
        /**
         * 訪問中またはチャット中の相手を確認の上ブロックし、訪問先マイルームを閉じる。window.onBlockUserTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
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
        /**
         * 訪問中またはチャット中の相手について、理由を入力させた上で通報する。window.onReportUserTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {Promise<void>}
         */
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
        /**
         * フェード演出と効果音付きで、フレンド画面（friend-modal）を閉じる。window.closeFriendScreen としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function closeFriendScreen() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('friend-modal');
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.FADE_CLEAR_DELAY_MS);
            }, CONFIG.FADE_TRANSITION_MS);
        }
        export let currentFriendTab = 'list';
        /**
         * フレンド画面のタブ（一覧／お気に入り／追加）を切り替え、表示エリアを更新する。window.switchFriendTab としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} tab - 切り替え先のタブ名（'list' | 'favorite' | 'add'）
         * @returns {void}
         */
        export function switchFriendTab(tab) {
            currentFriendTab = tab;
            ['list', 'favorite', 'add'].forEach(t => {
                document.getElementById(`friend-tab-${t}`).classList.toggle('active', t === tab);
            });
            document.getElementById('friend-list-view').style.display = (tab === 'add') ? 'none' : 'block';
            document.getElementById('friend-add-view').style.display = (tab === 'add') ? 'block' : 'none';
            if (tab === 'list' || tab === 'favorite') renderFriendList();
        }
        /**
         * 自分のフレンドコードをクリップボードにコピーし、結果を画面に表示する。失敗時はコード欄を選択状態にして手動コピーを促す。window.copyMyFriendCode としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {Promise<void>}
         */
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
        /**
         * 入力されたフレンドコードで相手をフレンド追加し、結果に応じたメッセージを表示する。window.onAddFriendTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {Promise<void>}
         */
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
            } else if (res.reason === 'limit_reached') {
                const limit = window.FRIEND_LIMIT || 50;
                result.style.color = '#e57373'; result.innerText = `フレンドは${limit}人まで登録できます。これ以上は追加できません`;
            } else {
                const errMsg = `通信エラーが発生しました${res.errorMessage ? '\n(' + res.errorMessage + ')' : ''}`;
                result.style.color = '#e57373'; result.innerText = errMsg;
                if (res.errorMessage) alert(`⚠️ フレンド追加エラーの詳細：\n${res.errorMessage}`); // 見逃さないよう、確実に表示する
            }
        }
        /**
         * 指定したフレンドのお気に入り登録状態をトグルし、フレンド一覧を再描画する。window.toggleFavoriteFriend としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} uid - 対象フレンドのユーザーID
         * @returns {void}
         */
        export function toggleFavoriteFriend(uid) {
            const idx = favoriteFriendIds.indexOf(uid);
            if (idx >= 0) favoriteFriendIds.splice(idx, 1);
            else favoriteFriendIds.push(uid);
            saveGame();
            renderFriendList();
        }
        window.toggleFavoriteFriend = toggleFavoriteFriend; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        // 🐛修正：以前は日付を1つだけ覚える方式で「誰か1人に送ったら他の全員に送れない」状態だった。
        // フレンドごとに1日1回、という意図に合わせて { [フレンドのuid]: 送った日の文字列 } で管理する。
        // セーブデータにも保存し、リロードでリセットされないようにする
        export let lastGiftSentDates = {};
        /**
         * 指定したフレンドにガチャコインを1日1回だけ贈る（フレンドごとに独立してカウントする）。
         * 送信中はボタンを無効化し、成功時はチェックマーク表示に切り替える。window.sendGachaCoinGift としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} uid - 贈り先フレンドのユーザーID
         * @param {HTMLElement} btnEl - 押されたボタン要素（表示・活性状態の更新に使う）
         * @returns {Promise<void>}
         */
        export async function sendGachaCoinGift(uid, btnEl) {
            const todayStr = new Date().toISOString().slice(0, 10);
            if (lastGiftSentDates[uid] === todayStr) {
                alert('🪙 このフレンドには今日もう送りました。また明日！');
                return;
            }
            if (!window.isRankingReady || !window.isRankingReady()) {
                alert('通信エラー：時間を置いて試してください');
                return;
            }
            btnEl.disabled = true;
            const res = await window.sendGiftCoin(uid);
            if (res.success) {
                lastGiftSentDates[uid] = todayStr;
                btnEl.innerHTML = '✅';
                playAudioFile('audio/levelup.mp3');
                saveGame();
            } else {
                btnEl.disabled = false;
                alert('送信できませんでした。時間を置いて試してください');
            }
        }
        window.sendGachaCoinGift = sendGachaCoinGift; // 動的に生成されるonclick=""から呼ばれるため、橋渡しが必要
        /**
         * 現在のタブ（一覧／お気に入り）に応じたフレンド一覧を取得し、各行を生成してfriend-list-viewに描画する。
         * @returns {Promise<void>}
         */
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
            friends.sort((a, b) => b.score - a.score);
            friends.forEach(f => {
                const isFav = favoriteFriendIds.includes(f.uid);
                const alreadySentToday = lastGiftSentDates[f.uid] === todayStr; // フレンドごとに個別判定
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
        /**
         * 招待する側・される側どちらでも、部屋チャットを始める前に利用規約＆プライバシーポリシーへの同意を求めるモーダルを開く。
         * @param {Function} onAgree - 同意ボタンが押された時に実行するコールバック
         * @returns {void}
         */
        export function showRoomChatTermsModal(onAgree) {
            pendingRoomChatTermsAction = onAgree;
            openModal('room-chat-terms-modal');
        }
        /**
         * 利用規約モーダルを閉じ、保留していた同意後のコールバックを実行する。window.onAgreeRoomChatTerms としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function onAgreeRoomChatTerms() {
            closeModal('room-chat-terms-modal');
            const action = pendingRoomChatTermsAction;
            pendingRoomChatTermsAction = null;
            if (action) action();
        }
        /**
         * 利用規約モーダルを閉じ、保留していた同意後のコールバックを破棄する（不同意扱い）。window.onCancelRoomChatTerms としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function onCancelRoomChatTerms() {
            closeModal('room-chat-terms-modal');
            pendingRoomChatTermsAction = null;
        }
        // ✉️ フレンドをマイルームに招待する
        // 🐛修正：オンライン/オフラインの丸は開いた瞬間の一度きりの判定だったため、パネルを開いたまま
        // 待っていると、相手が後からオンラインになっても丸の色が変わらず「時間差がある」ように見えていた。
        // パネルを開いている間だけ、定期的に丸だけを再判定するタイマーを回す（リストの作り直しはしない）
        export let inviteFriendDotRefreshTimer = null;
        /**
         * マイルーム招待パネルを開き、フレンド一覧を描画した上で、オンライン状態の丸を定期的に再判定するタイマーを開始する。window.openMyroomInvitePanel としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function openMyroomInvitePanel() {
            document.getElementById('myroom-invite-panel').style.display = 'flex';
            renderMyroomInviteFriendList();
            clearInterval(inviteFriendDotRefreshTimer);
            inviteFriendDotRefreshTimer = setInterval(refreshMyroomInviteFriendDots, CONFIG.INVITE_DOT_REFRESH_INTERVAL_MS);
        }
        /**
         * マイルーム招待パネルを閉じ、オンライン状態再判定用のタイマーを停止する。window.closeMyroomInvitePanel としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function closeMyroomInvitePanel() {
            document.getElementById('myroom-invite-panel').style.display = 'none';
            clearInterval(inviteFriendDotRefreshTimer);
            inviteFriendDotRefreshTimer = null;
        }
        /**
         * 招待パネルに表示中の各フレンドについて、オンライン状態を再確認して丸表示の色とツールチップだけを更新する（一覧自体は作り直さない）。
         * @returns {Promise<void>}
         */
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
        /**
         * ブロック済みを除いたフレンド一覧を取得し、招待パネルに各フレンドの行（招待ボタン付き）を描画した上で、オンライン状態の丸を非同期に更新する。
         * @returns {Promise<void>}
         */
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
        /**
         * 指定したフレンドへ部屋招待を送る。年齢確認・利用規約同意を経てから送信し、成功時はホスト待機画面を開く。window.onSendRoomInviteTap としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {string} uid - 招待するフレンドのユーザーID
         * @param {HTMLElement} btnEl - 押された招待ボタン要素（表示・活性状態の更新やゲスト名の取得に使う）
         * @returns {Promise<void>}
         */
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
        /**
         * 自分宛の訪問スタンプをリアルタイム監視し、届いたスタンプを既読化した上で、ブロックしていない相手からの最新1件をalertで知らせる。オンライン機能の準備が済むまでは自動的にリトライする。
         * @returns {void}
         */
        export function startIncomingVisitStampWatch() {
            if (!window.isRankingReady || !window.isRankingReady()) { setTimeout(startIncomingVisitStampWatch, CONFIG.RANKING_READY_RETRY_MS); return; }
            if (!window.listenIncomingVisitStamps) return; // 旧バージョンのindex.html併用時など、関数が無ければ何もしない
            window.listenIncomingVisitStamps((stamps) => {
                // 見つかった時点で（見るかどうかに関わらず）既読化するのは、ポーリング時代の挙動を踏襲
                stamps.forEach(s => { if (window.markVisitStampClaimed) window.markVisitStampClaimed(s.id); });
                const validStamps = stamps.filter(s => !blockedUserIds.includes(s.fromUid)); // 🚫 ブロックした相手からは無視する
                if (validStamps.length === 0) return;
                const latest = validStamps[validStamps.length - 1];
                setTimeout(() => {
                    alert(`💌 ${latest.fromName}さんから：「${latest.text}」`);
                }, CONFIG.INCOMING_STAMP_ALERT_DELAY_MS);
            });
        }
        // ✉️ 自分宛の招待をリアルタイム監視する（起動時に一度だけ呼べば、以後は届いた瞬間に検知される）
        /**
         * 自分宛の部屋招待をリアルタイム監視し、届いた招待を既読化した上で、ブロックしていない相手からの最新1件について確認ダイアログを出し、応じれば年齢確認・利用規約同意を経て部屋へ参加する。オンライン機能の準備が済むまでは自動的にリトライする。
         * @returns {void}
         */
        export function startIncomingRoomInviteWatch() {
            if (!window.isRankingReady || !window.isRankingReady()) { setTimeout(startIncomingRoomInviteWatch, CONFIG.RANKING_READY_RETRY_MS); return; }
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
                }, CONFIG.INCOMING_INVITE_CONFIRM_DELAY_MS);
            });
        }
        /**
         * 起動時に、部屋のいいね由来やフレンドからの直接送付でもらったガチャコインをまとめて受け取り、加算・保存した上で内訳をalertで知らせる。
         * @returns {Promise<void>}
         */
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
            }, CONFIG.INCOMING_GIFTS_ALERT_DELAY_MS);
        }

        /**
         * 移動メニュー（move-menu-modal）を開き、看板パーツを描画してもちすけの巡回演出を開始する。window.openMoveMenu としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function openMoveMenu() {
            openModal('move-menu-modal'); // 移動先を選ぶだけなので、ここではフェードしない（選んだ時にフェードする）
            renderMoveMenuParts();
            startMoveMochisukeLoop();
        }
        // 🐹 もちすけが、ものおき→ショップ→ゲーセン→マイルーム→戻る看板、の順に看板の右をワープして回る演出
        export const MOVE_MOCHISUKE_SIGN_ORDER = ['move-sign-warehouse', 'move-sign-shop', 'move-sign-arcade', 'move-sign-myroom', 'move-sign-return'];
        export let moveMochisukeLoopTimer = null;
        export let moveMochisukeLoopIndex = 0;
        /**
         * 移動メニューのもちすけが看板を順番に巡回する演出を、最初の看板から開始する。
         * @returns {void}
         */
        export function startMoveMochisukeLoop() {
            stopMoveMochisukeLoop();
            moveMochisukeLoopIndex = 0;
            updateMoveMochisukePosition();
            moveMochisukeLoopTimer = setInterval(() => {
                moveMochisukeLoopIndex = (moveMochisukeLoopIndex + 1) % MOVE_MOCHISUKE_SIGN_ORDER.length;
                updateMoveMochisukePosition();
            }, CONFIG.MOVE_LOOP_INTERVAL_MS);
        }
        /**
         * もちすけの看板巡回演出タイマーを停止する。
         * @returns {void}
         */
        export function stopMoveMochisukeLoop() {
            if (moveMochisukeLoopTimer) clearInterval(moveMochisukeLoopTimer);
            moveMochisukeLoopTimer = null;
        }
        /**
         * 現在の巡回インデックスに対応する看板の横へ、縮みアニメーション付きでもちすけの表示位置・サイズを移動させる。
         * @returns {void}
         */
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
            ], { duration: CONFIG.MOVE_SHRINK_DURATION_MS, easing: 'ease-in-out' });
            // 🐛修正：以前は看板ごとの幅を基準にしていたため、看板の大きさが違うともちすけの大きさも違って見えていた。
            // 「戻る看板」の幅を基準にした固定値にして、どの看板の横にいても同じ大きさに統一する
            const mochiWidth = returnSignPart.width * CONFIG.MOVE_MOCHISUKE_WIDTH_RATIO;
            mochi.style.width = mochiWidth + '%';
            mochi.style.top = (signPart.top + signPart.height * CONFIG.MOVE_MOCHISUKE_TOP_OFFSET_RATIO) + '%';
            mochi.style.left = (signPart.left + signPart.width + CONFIG.MOVE_MOCHISUKE_LEFT_OFFSET_PCT) + '%';
        }
        /**
         * MOVE_MENU_PARTSの座標・サイズ情報に従って、移動メニュー内の各看板要素の位置とサイズを配置する。
         * @returns {void}
         */
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
        /**
         * フェード演出と移動音を再生しながらもちすけ巡回を止め、移動メニューを閉じてから指定の遷移処理を実行する。window.moveMenuGoTo としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @param {Function} fn - フェードが完了した後に実行する画面遷移処理
         * @returns {void}
         */
        export function moveMenuGoTo(fn) {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            stopMoveMochisukeLoop();
            setTimeout(() => {
                closeModal('move-menu-modal');
                fn();
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.FADE_CLEAR_DELAY_MS);
            }, CONFIG.FADE_TRANSITION_MS);
        }
        /**
         * 移動メニューを、何もしない遷移処理でフェードしながら閉じる（マイルームに戻る動作として使う）。window.moveMenuGoHome としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function moveMenuGoHome() {
            moveMenuGoTo(() => {});
        }

        /**
         * フェード演出と効果音付きでものおき（warehouse-modal）を閉じ、通常BGMに戻してから移動メニューを開く。window.closeWarehouse としてグローバル公開され、onclick=""から呼ばれる橋渡し関数。
         * @returns {void}
         */
        export function closeWarehouse() {
            const overlay = document.getElementById('fade-overlay');
            playAudioFile('audio/move.mp3');
            overlay.classList.add('fade-black');
            setTimeout(() => {
                closeModal('warehouse-modal');
                playBgmLoop('audio/bgm/bgm.mp3'); // 通常のBGMに戻す
                openMoveMenu();
                setTimeout(() => overlay.classList.remove('fade-black'), CONFIG.FADE_CLEAR_DELAY_MS);
            }, CONFIG.FADE_TRANSITION_MS);
        }
        /**
         * ものおき内のアイテムがタップされた時、種類に応じてトロフィールーム・おみやげコレクション・チケット一覧・日記のいずれかを開く。
         * @param {string} action - タップされたアイテムの種類（'trophy' | 'omiyage' | 'ticket' | 'diary'）
         * @returns {void}
         */
        export function warehouseItemAction(action) {
            if (action === 'trophy') openTrophyRoom();
            else if (action === 'omiyage') openOmiyageCollection();
            else if (action === 'ticket') openTicketInventory();
            else if (action === 'diary') openDiary();
        }
        /**
         * WAREHOUSE_ITEM_PARTSに従ってものおき内のアイテム画像を配置し直し、おみやげの進捗バッジをおみやげアイテムの右上に合わせる。
         * @returns {void}
         */
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
                badge.style.left = (omiyagePart.left + omiyagePart.width - CONFIG.OMIYAGE_BADGE_RIGHT_OFFSET_PCT) + '%';
            }
        }
        /**
         * フレンドごとにガチャコインを最後に贈った日付文字列（1日1回制限の判定に使う）を設定する。セーブデータからの復元時などに使う。
         * @param {Object} v - { [フレンドのuid]: 'YYYY-MM-DD'形式の日付文字列 }
         * @returns {void}
         */
        export function setLastGiftSentDates(v) { lastGiftSentDates = v; }
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
