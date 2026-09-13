// 🫧 スクイーズ（引っ張り伸縮）機能の物理・見た目・効果音まわりをまとめたファイル。
// tap.jsが110KB超まで肥大化してきたため、「もちすけ本体のタップ判定・コンボ・スキル」から
// 独立して完結する部分（伸縮の計算、追従ループ、伸び音、光演出、離した時の弾け演出）だけを
// 切り出した。tap.js側からはこのファイルの関数を呼ぶだけで、このファイルからtap.jsへの
// import（循環依存）は一切発生しないように設計している：
//   ・DOM要素はこのファイル自身でdocument.getElementByIdして持つ（tap.jsからは受け取らない）
//   ・「今スクイーズ中かどうか」はこのファイル内部の状態(currentMode)だけで管理する
//     （tap.js側のisMochiPressed/isDraggingSqueeze/twoFingerStretchActiveは読みに行かない）
//   ・コンボ段階はtriggerSqueezeReleaseBurstの引数として数値を渡してもらう
//     （getCheerTUer等tap.js内部のコンボロジックをこちらからimportしない）
// 将来、スライムもちすけ等の新モード用にグリッドワープや素材パラメータのファイルを追加する時も
// この src/squeeze/ ディレクトリにまとめていく予定。
import {
  audioBuffers, createBurstParticle, getAudioContext, playAudioFilePitched, sfxVolumeMult, vibrate
} from '../../main.js?v=2026-09-13-007';

// 🔧 スクイーズ関連の調整用マジックナンバー（値はtap.jsに元々あったものと完全に同じ）
const CONFIG = {
  STRETCH_SOUND_BASE_PITCH: 0.85,
  STRETCH_SOUND_PITCH_RANGE: 0.5,
  STRETCH_SOUND_MAX_GAIN: 0.35,
  // 🆕 同じ伸び具合でも毎回まったく同じ音にならないよう、指を触れた瞬間だけランダムに
  // ピッチをずらす幅（±この割合）。
  STRETCH_SOUND_PITCH_VARIANCE: 0.04,
  SQUEEZE_OVERSHOOT_RATIO: 0.55, // 離した時の揺れ戻りの大きさ
  SQUEEZE_OVERSHOOT_BASE_DURATION_MS: 420,
  SQUEEZE_OVERSHOOT_DURATION_RANGE_MS: 280,
  // --- 🆕 スクイーズ：離した瞬間の「弾ける」演出 ---
  SQUEEZE_RELEASE_BURST_MIN_RATIO: 0.5, // これ以上伸ばして離した時だけ、パーティクル＋ポン音を出す（軽いタップでは出さない）
  SQUEEZE_RELEASE_BURST_COUNT_BASE: 6,  // 弾けるパーティクルの最低数
  SQUEEZE_RELEASE_BURST_COUNT_RANGE: 8, // 伸び率に応じて上乗せされる最大数
  SQUEEZE_RELEASE_POP_VOLUME: 0.55,
  SQUEEZE_RELEASE_POP_PITCH_BASE: 0.95,       // ポン音の基本ピッチ
  SQUEEZE_RELEASE_POP_PITCH_PER_TIER: 0.06,   // コンボtierが1段上がるごとに足すピッチ（見た目のコンボ演出と音を連動させる）
  SQUEEZE_RELEASE_STRONG_VIBRATE_MIN_RATIO: 0.85, // かなり大きく伸ばして離した時だけ、軽いバイブで区切りを付ける
  SQUEEZE_RELEASE_STRONG_VIBRATE_PATTERN: [12, 25, 12],
  // --- 🆕 スクイーズ：指が触れている場所が優しく光る演出 ---
  SQUEEZE_GLOW_MAX_SCALE: 1.35, // 伸び率が最大の時、光がどれだけ大きく広がるか
  SQUEEZE_GLOW_FADE_OUT_MS: 260,
};

// 🆕 「もっと伸ばせるようにしたい」というフィードバックを受けて、1本指スクイーズの限界を底上げ
// （70px/+38%→100px/+55%。伸びをより長い距離まで追従させつつ、伸び率そのものも大きくしている）
export const SQUEEZE_MAX_DRAG = 100; // これ以上引っ張っても伸びが頭打ちになる距離(px)。tap.js側の離した時の判定計算でも同じ値が必要なためexportしている
const SQUEEZE_MAX_STRETCH = 0.55; // 最大でどれだけ伸びるか（+55%）
const SQUEEZE_MAX_SQUASH = 0.3; // 伸びる方向と垂直に、最大どれだけ縮むか（-30%）
const SQUEEZE_ELEMENT_RADIUS = 95; // もちすけの見た目上の半径の目安(px)。伸びを引っ張った側だけに見せるためのオフセット計算に使う
// 🆕「重み・粘り気・弾力」を出すための3つの仕掛け。①抵抗カーブ：伸ばすほど、同じ指の移動量でも
// 伸びが増えにくくなる（弾力の限界に近づく感覚）。②追従の遅れ：見た目は指の位置に一気に追従せず、
// 毎フレーム少しずつ近づく（重くて粘り気のある物体を引っ張っている感覚）。③追従の遅れ自体も、
// 既にどれだけ伸びているかに応じてさらに遅くなる（伸びるほど重みが増して、後半になるほどゆっくり
// にしか伸びなくなる）。全部数値を変えるだけで感触を調整できる
// 🆕 以前はSQUEEZE_STRETCH_EASE_POWERを2.0にしていたが、これだと序盤だけ指の動きより速く伸びる
// （1-(1-x)^pの傾きはx=0でpになるため、pが1より大きいほど触れた瞬間の反応が良くなりすぎる）。
// 「触れた瞬間から重い」を優先し、1に近い値（ほぼ線形）に変更。伸びるほど重くなる効果は
// SQUEEZE_FOLLOW_HEAVY_END_FACTOR側（追従速度そのものの低下）に任せている
const SQUEEZE_STRETCH_EASE_POWER = 1.15; // 1より大きいほど、伸ばすほど追加の伸びに必要な指の移動量が増える（抵抗が強くなる）。1に近いほど序盤の伸びが指の動きに対して素直（速くならない）
const SQUEEZE_FOLLOW_LERP = 0.045; // 毎フレーム、目標値との差にこの割合だけ近づく基本値。小さいほど追従が遅れて「重く・粘っこく」感じる（触れた瞬間からの重さはこの値が支配する）
const SQUEEZE_FOLLOW_HEAVY_END_FACTOR = 0.35; // 🆕 伸び切った時点で追従速度が基本値の何倍まで落ちるか。小さいほど「伸ばすほど重くなる」度合いが強い

// 🫧🫧 2本指ストレッチ用。1本指スクイーズ（片側だけ固定して反対側だけ伸ばす）とは見た目の計算式が
// 異なるため、状態・関数ともに分けている。
const TWO_FINGER_MAX_STRETCH = 0.85; // 2本指の最大伸び率（+85%。1本指の+55%より大きい）
const TWO_FINGER_MAX_SQUASH = 0.42; // 2本指で伸びる方向と垂直に、最大どれだけ縮むか（-42%。1本指の-30%より大きい）

const mochiBtnElement = document.getElementById('mochisuke-btn');
const mochiDeformWrap = document.getElementById('mochisuke-deform-wrap'); // タップ・スクイーズの見た目の変形は、もちすけ本体ではなくこちらにかける（帽子・顔パーツ・口も道連れで一緒に動くように）

// 🆕 指で触れている場所が優しく光って見える演出。衣装(kisekae)の絵とは別レイヤーに、
// mix-blend-mode:screenで光を重ねるだけなので、どんな衣装を着せていても崩れずに使える
// （帽子・顔パーツはこの上のz-indexなので隠れない）
const squeezeGlowLayerEl = document.getElementById('squeeze-glow-layer');
const squeezeGlowPointerMap = new Map(); // pointerId -> { el, fadeTimer }

/**
 * 指が触れた瞬間、その位置に「光」演出用の要素を新しく作って表示する。
 * @param {number} pointerId - ポインタID
 * @param {number} clientX - 触れた位置のX座標（画面基準）
 * @param {number} clientY - 触れた位置のY座標（画面基準）
 * @returns {void}
 */
export function assignSqueezeGlow(pointerId, clientX, clientY) {
    const existing = squeezeGlowPointerMap.get(pointerId);
    if (existing) { clearTimeout(existing.fadeTimer); existing.el.remove(); }
    const el = document.createElement('div');
    el.className = 'squeeze-glow';
    squeezeGlowLayerEl.appendChild(el);
    squeezeGlowPointerMap.set(pointerId, { el, fadeTimer: null });
    updateSqueezeGlow(pointerId, clientX, clientY, 0);
    requestAnimationFrame(() => el.classList.add('is-active'));
}

/**
 * 指の現在位置と伸縮比率に応じて、光演出の位置・濃さ・大きさを更新する。
 * @param {number} pointerId - ポインタID
 * @param {number} clientX - 現在位置のX座標（画面基準）
 * @param {number} clientY - 現在位置のY座標（画面基準）
 * @param {number} ratio - 0〜1の伸縮比率（強く引っ張っているほど光も大きく見せる）
 * @returns {void}
 */
export function updateSqueezeGlow(pointerId, clientX, clientY, ratio) {
    const entry = squeezeGlowPointerMap.get(pointerId);
    if (!entry) return;
    const rect = mochiBtnElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const py = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    entry.el.style.left = px + '%';
    entry.el.style.top = py + '%';
    entry.el.style.opacity = String(0.55 + ratio * 0.45);
    entry.el.style.setProperty('--s', String(0.6 + ratio * (CONFIG.SQUEEZE_GLOW_MAX_SCALE - 0.6)));
}

/**
 * 指を離した時、その指の光演出をフェードアウトさせてから要素を削除する。
 * @param {number} pointerId - ポインタID
 * @returns {void}
 */
export function releaseSqueezeGlow(pointerId) {
    const entry = squeezeGlowPointerMap.get(pointerId);
    if (!entry) return;
    entry.el.classList.remove('is-active');
    entry.el.style.opacity = '0';
    entry.el.style.setProperty('--s', '0.6');
    entry.fadeTimer = setTimeout(() => {
        entry.el.remove();
        squeezeGlowPointerMap.delete(pointerId);
    }, CONFIG.SQUEEZE_GLOW_FADE_OUT_MS);
}

/**
 * 押していた指がすべて離れた時などに、残っている光演出をまとめてフェードアウトさせる。
 * @returns {void}
 */
export function releaseAllSqueezeGlows() {
    [...squeezeGlowPointerMap.keys()].forEach(releaseSqueezeGlow);
}

// 引っ張った方向・つぶれ量dから変形のtransform文字列を作る。
// d が正＝引っ張り/つぶし方向、負＝その逆方向（オーバーシュート用）に使える共通関数。
// 下向き成分の方が大きい場合は「伸ばす」のではなく「つぶす」動きにする（体積保存的に横へ少し膨らむ）。
// 横・斜め方向は、引っ張った側だけに伸びるよう、反対側を起点に固定して見せる（transformOriginではなくtranslateで実現）。
/**
 * 引っ張り/つぶし量dと方向(dx,dy)から、伸縮とオフセットを含むCSS transform文字列を組み立てる。
 * @param {number} dx - 引っ張り方向のX成分
 * @param {number} dy - 引っ張り方向のY成分
 * @param {number} d - 伸縮量（正=伸び/つぶし方向、負=逆方向のオーバーシュート）
 * @returns {string} CSSのtransformプロパティ用文字列
 */
function squeezeTransformFor(dx, dy, d) {
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * (180 / Math.PI);

    const along = 1 + d * SQUEEZE_MAX_STRETCH;
    const perp = 1 - d * SQUEEZE_MAX_SQUASH;
    const growthPx = SQUEEZE_ELEMENT_RADIUS * 2 * (along - 1);
    const offsetPx = growthPx / 2;
    const offsetX = Math.cos(angleRad) * offsetPx;
    const offsetY = Math.sin(angleRad) * offsetPx;
    return `translate(${offsetX}px, ${offsetY}px) rotate(${angleDeg}deg) scale(${along}, ${perp}) rotate(${-angleDeg}deg)`;
}

// 🆕 生の伸び比率(0〜1)に「伸ばすほど抵抗が強くなる」カーブをかける。序盤は指の動きに対して素直に
// 伸び（柔らかい餅が素直に伸びる感じ）、終盤は指を動かしてもなかなか伸びなくなる（弾力の限界）。
/**
 * @param {number} rawRatio - 0〜1の生の伸び比率
 * @returns {number} 抵抗カーブ適用後の比率(0〜1)
 */
function easeSqueezeRatio(rawRatio) {
    const r = Math.min(1, Math.max(0, rawRatio));
    return 1 - Math.pow(1 - r, SQUEEZE_STRETCH_EASE_POWER);
}

// 🫧🫧 2本指ストレッチ用のtransform。1本指版(squeezeTransformFor)は「片側だけ固定して反対側を伸ばす」ため
// translateでオフセットを付けているが、2本指は両端が均等に伸びて中心が動かないので、offsetは不要でscaleだけでよい。
/**
 * 2本の指を結ぶ軸の角度と伸縮量dから、中心固定・左右対称なCSS transform文字列を組み立てる。
 * @param {number} angleDeg - 2点を結ぶ軸の角度（度）
 * @param {number} d - 伸縮量（正=伸び方向、負=揺れ戻りのオーバーシュート用）
 * @returns {string} CSSのtransformプロパティ用文字列
 */
function twoFingerSqueezeTransformFor(angleDeg, d) {
    const along = 1 + d * TWO_FINGER_MAX_STRETCH;
    const perp = 1 - d * TWO_FINGER_MAX_SQUASH;
    return `rotate(${angleDeg}deg) scale(${along}, ${perp}) rotate(${-angleDeg}deg)`;
}

// 🆕 追従ループが今どちらのモードで動いているか（'one'=1本指スクイーズ, 'two'=2本指ストレッチ,
// null=非アクティブ）。tap.js側のisMochiPressed等を読みに行かず、このファイル内で完結させるための状態。
let currentMode = null;
let oneFingerRawRatio = 0, oneFingerDx = 0, oneFingerDy = 0;
let twoFingerRawRatio = 0, twoFingerAngleDeg = 0;
// 🆕 実際の見た目・音に使う比率。stepSqueezeFollowが毎フレーム目標値へ近づける（追従の遅れ＝重み・粘り気）
let squeezeVisualRatio = 0;
let squeezeFollowRafId = null;

// 引っ張った方向・距離から、今の生の伸縮比率を記録し、追従ループの目標値を更新する（1本指ドラッグ中に毎回呼ばれる）
/**
 * 1本指スクイーズの目標（生の伸縮比率・方向）を更新し、追従ループを開始する。
 * 実際の見た目・伸び音への反映は、重み・粘り気の演出のためstepSqueezeFollow（毎フレームの
 * 追従ループ）側でまとめて行う。
 * @param {number} dx - 開始位置からのX移動量
 * @param {number} dy - 開始位置からのY移動量
 * @returns {number} 0〜1の生の伸縮比率（光演出の濃さ計算にそのまま使えるよう返す）
 */
export function updateOneFingerSqueezeTarget(dx, dy) {
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), SQUEEZE_MAX_DRAG);
    oneFingerRawRatio = dist / SQUEEZE_MAX_DRAG;
    oneFingerDx = dx; oneFingerDy = dy;
    currentMode = 'one';
    startSqueezeFollowLoop();
    return oneFingerRawRatio;
}

// 2本の指が離れていく方向・距離から、追従ループの目標値を更新する（2本指ドラッグ中に毎回呼ばれる）
/**
 * 2本指ストレッチの目標（生の伸縮比率・軸の角度）を更新し、追従ループを開始する。
 * @param {number} angleDeg - 2点を結ぶ軸の角度（度）
 * @param {number} ratio - 0〜1の生の伸縮比率
 * @returns {void}
 */
export function updateTwoFingerSqueezeTarget(angleDeg, ratio) {
    twoFingerRawRatio = ratio;
    twoFingerAngleDeg = angleDeg;
    currentMode = 'two';
    startSqueezeFollowLoop();
}

// 🆕 押している間、squeezeVisualRatioを目標値（抵抗カーブ適用後の生の比率）へ毎フレーム少しずつ
// 近づけながら実際の見た目・伸び音に反映する追従ループ。目標に一気に到達させず「遅れて追いつく」
// ことで、指の動きに対してもちすけ自体に重み・粘り気があるように感じさせる（指を止めて保持していても、
// 追いつくまでの「もにゅっ」とした動きがわずかに残り続ける）。
/**
 * 追従ループの1フレーム分の更新。endSqueeze()が呼ばれてcurrentModeがnullになったら自動的に止まる。
 * @returns {void}
 */
function stepSqueezeFollow() {
    if (currentMode === null) { squeezeFollowRafId = null; return; }
    // 🆕 既にどれだけ伸びているか(squeezeVisualRatio)が大きいほど、追従速度そのものを落とす。
    // 「すぐ伸ばそうとしても伸びない」「一気に伸ばそうとしても後半になるほどゆっくりになる」を
    // 両方まとめて表現する：伸びていない序盤は基本値通り、伸び切るにつれてSQUEEZE_FOLLOW_HEAVY_END_FACTOR倍まで遅くなる
    const heaviness = 1 - squeezeVisualRatio * (1 - SQUEEZE_FOLLOW_HEAVY_END_FACTOR);
    const effectiveLerp = SQUEEZE_FOLLOW_LERP * heaviness;
    if (currentMode === 'two') {
        const target = easeSqueezeRatio(twoFingerRawRatio);
        squeezeVisualRatio += (target - squeezeVisualRatio) * effectiveLerp;
        mochiDeformWrap.style.transformOrigin = 'center center';
        mochiDeformWrap.style.transform = twoFingerSqueezeTransformFor(twoFingerAngleDeg, squeezeVisualRatio);
        updateStretchSound(squeezeVisualRatio);
    } else {
        const target = easeSqueezeRatio(oneFingerRawRatio);
        squeezeVisualRatio += (target - squeezeVisualRatio) * effectiveLerp;
        mochiDeformWrap.style.transformOrigin = 'center center';
        mochiDeformWrap.style.transform = squeezeTransformFor(oneFingerDx, oneFingerDy, squeezeVisualRatio);
        updateStretchSound(squeezeVisualRatio);
    }
    squeezeFollowRafId = requestAnimationFrame(stepSqueezeFollow);
}

/**
 * squeezeVisualRatioの追従ループを開始する（すでに動いていれば何もしない）。
 * @returns {void}
 */
function startSqueezeFollowLoop() {
    if (squeezeFollowRafId !== null) return;
    squeezeFollowRafId = requestAnimationFrame(stepSqueezeFollow);
}

/**
 * 指が離れた時に呼ぶ。追従ループを止め、その時点で実際に描画されていた最終的な伸縮比率
 * （squeezeVisualRatio。指の生の移動量ではなく追従の遅れ込みの値）を返してから内部状態をリセットする。
 * 呼び出し側（tap.js）はこの戻り値を、揺れ戻りアニメーションや弾け演出の見た目にそのまま使うことで、
 * 離した瞬間に見た目が急にジャンプしないようにする。
 * @returns {number} 離した瞬間の最終的な伸縮比率(0〜1)
 */
export function endSqueeze() {
    currentMode = null;
    if (squeezeFollowRafId !== null) { cancelAnimationFrame(squeezeFollowRafId); squeezeFollowRafId = null; }
    const finalRatio = squeezeVisualRatio;
    squeezeVisualRatio = 0;
    oneFingerRawRatio = 0; oneFingerDx = 0; oneFingerDy = 0;
    twoFingerRawRatio = 0; twoFingerAngleDeg = 0;
    return finalRatio;
}

// 🆕 「指を触れた瞬間だけ」ランダムに決めて、伸びている間ずっと乗せておくピッチのオフセット。
// 伸び率に応じたリアルタイムの音程変化はそのまま保ちつつ、セッション（一回の指の触れ始めから
// 離すまで）ごとに微妙に違う声にすることで、何百回聞いても同じ音、という単調さを減らす。
let stretchSoundPitchOffset = 0;
let stretchSoundSource = null, stretchSoundGain = null;

// 🔊 伸ばしている間だけ鳴る、ループ再生＋伸びに応じてピッチが変わる効果音
/**
 * 伸ばしている間だけ鳴らす、ループ再生の伸び音を音量0の状態で再生開始する。
 * あわせて、その回だけのランダムなピッチオフセットを決め直す。
 * @returns {void}
 */
export function startStretchSound() {
    if (stretchSoundSource) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const buffer = audioBuffers['audio/mochisuke/mochi_stretch.mp3'];
    if (!buffer) return;
    stretchSoundPitchOffset = (Math.random() * 2 - 1) * CONFIG.STRETCH_SOUND_PITCH_VARIANCE;
    stretchSoundSource = ctx.createBufferSource();
    stretchSoundSource.buffer = buffer;
    stretchSoundSource.loop = true;
    stretchSoundGain = ctx.createGain();
    stretchSoundGain.gain.value = 0;
    stretchSoundSource.connect(stretchSoundGain).connect(ctx.destination);
    stretchSoundSource.start(0);
}
/**
 * 伸縮比率に応じて、再生中の伸び音のピッチと音量を更新する。
 * @param {number} ratio - 0〜1の伸縮比率
 * @returns {void}
 */
function updateStretchSound(ratio) {
    if (!stretchSoundSource) return;
    // 伸びるほど音が高くなる基本カーブに、触れた瞬間だけ決めたstretchSoundPitchOffsetを常時上乗せする
    stretchSoundSource.playbackRate.value = CONFIG.STRETCH_SOUND_BASE_PITCH + ratio * CONFIG.STRETCH_SOUND_PITCH_RANGE + stretchSoundPitchOffset;
    stretchSoundGain.gain.value = ratio * CONFIG.STRETCH_SOUND_MAX_GAIN * sfxVolumeMult; // 伸びるほど音が大きくなる
}
/**
 * 再生中の伸び音を停止し、参照をクリアする。
 * @returns {void}
 */
export function stopStretchSound() {
    if (!stretchSoundSource) return;
    try { stretchSoundSource.stop(); } catch (e) {}
    stretchSoundSource = null;
    stretchSoundGain = null;
}

// 指を離した時、伸ばして/つぶしていた分だけ大きく「ぷるん」と揺れ戻ってから通常に収束する
/**
 * 指を離した瞬間、伸ばして/つぶしていた分だけオーバーシュートする揺れ戻りアニメーションを再生する。
 * @param {number} dx - 引っ張り方向のX成分
 * @param {number} dy - 引っ張り方向のY成分
 * @param {number} ratio - 揺れ戻り開始時点の伸縮比率。指の生の移動量ではなくendSqueeze()の戻り値
 *   （追従ループが実際に描画していた値）を渡すことで、離した瞬間に見た目が急にジャンプしないようにする
 * @returns {void}
 */
export function releaseSqueezeWithOvershoot(dx, dy, ratio) {
    const overshoot = ratio * CONFIG.SQUEEZE_OVERSHOOT_RATIO; // 伸ばした/つぶした分だけ、戻る時のプルンも大きくなる

    mochiDeformWrap.animate([
        { transform: squeezeTransformFor(dx, dy, ratio) },
        { transform: squeezeTransformFor(dx, dy, -overshoot * 0.65), offset: 0.32 },
        { transform: squeezeTransformFor(dx, dy, overshoot * 0.32), offset: 0.58 },
        { transform: squeezeTransformFor(dx, dy, -overshoot * 0.12), offset: 0.8 },
        { transform: 'scale(1, 1)' },
    ], { duration: CONFIG.SQUEEZE_OVERSHOOT_BASE_DURATION_MS + ratio * CONFIG.SQUEEZE_OVERSHOOT_DURATION_RANGE_MS, easing: 'ease-out' });
    mochiDeformWrap.style.transform = 'scale(1, 1)';
}

// 2本指版の揺れ戻り。1本指版と違い中心固定・左右対称なので、twoFingerSqueezeTransformForを使う。
/**
 * 2本指ストレッチを離した瞬間、伸ばしていた分だけオーバーシュートする揺れ戻りアニメーションを再生する。
 * @param {number} angleDeg - 伸ばしていた軸の角度（度）
 * @param {number} ratio - 揺れ戻り開始時点の伸縮比率。指の生の移動量ではなくendSqueeze()の戻り値
 *   （追従ループが実際に描画していた値）を渡すことで、離した瞬間に見た目が急にジャンプしないようにする
 * @returns {void}
 */
export function releaseTwoFingerSqueezeWithOvershoot(angleDeg, ratio) {
    const overshoot = ratio * CONFIG.SQUEEZE_OVERSHOOT_RATIO;

    mochiDeformWrap.animate([
        { transform: twoFingerSqueezeTransformFor(angleDeg, ratio) },
        { transform: twoFingerSqueezeTransformFor(angleDeg, -overshoot * 0.65), offset: 0.32 },
        { transform: twoFingerSqueezeTransformFor(angleDeg, overshoot * 0.32), offset: 0.58 },
        { transform: twoFingerSqueezeTransformFor(angleDeg, -overshoot * 0.12), offset: 0.8 },
        { transform: 'scale(1, 1)' },
    ], { duration: CONFIG.SQUEEZE_OVERSHOOT_BASE_DURATION_MS + ratio * CONFIG.SQUEEZE_OVERSHOOT_DURATION_RANGE_MS, easing: 'ease-out' });
    mochiDeformWrap.style.transform = 'scale(1, 1)';
}

// 🆕 スクイーズを一定以上伸ばして離した瞬間の「弾ける」演出。パーティクル＋ポン音（＋大きく伸ばした時だけ振動）。
// gatingRatio（「弾けを出して良いか」の判定に使う、指の生の移動量ベースの比率）がしきい値未満なら
// 何もしない、という判定をこの関数の内部に持たせることで、呼び出し側(tap.js)がコンボ内部のtierIndex
// だけ渡せば済むようにしている（tap.jsのコンボロジックをこのファイルへimportさせないための設計）。
/**
 * 指を離した瞬間、伸ばしていた比率に応じて弾けるパーティクルとポン音を再生する。
 * ポン音のピッチはその時点のコンボ段階に応じて少し上がっていき、コンボが盛り上がるほど
 * 弾ける音も華やかになる。
 * @param {number} gatingRatio - 「弾け演出を出して良いか」の判定に使う伸縮比率（指の生の移動量ベース）
 * @param {number} visualRatio - 実際の見た目（パーティクル数）に使う伸縮比率（追従の遅れ込みの値）
 * @param {number} comboTierIndex - 現在のコンボ段階のインデックス（tap.js側で計算して渡す。見つからない場合は負数でも可）
 * @returns {void}
 */
export function triggerSqueezeReleaseBurst(gatingRatio, visualRatio, comboTierIndex) {
    if (gatingRatio < CONFIG.SQUEEZE_RELEASE_BURST_MIN_RATIO) return;

    const rect = mochiBtnElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = Math.round(CONFIG.SQUEEZE_RELEASE_BURST_COUNT_BASE + visualRatio * CONFIG.SQUEEZE_RELEASE_BURST_COUNT_RANGE);
    for (let i = 0; i < count; i++) createBurstParticle(cx, cy);

    const pitch = CONFIG.SQUEEZE_RELEASE_POP_PITCH_BASE + Math.max(0, comboTierIndex) * CONFIG.SQUEEZE_RELEASE_POP_PITCH_PER_TIER;
    playAudioFilePitched('audio/mochisuke/mochi_release_pop.mp3', CONFIG.SQUEEZE_RELEASE_POP_VOLUME * sfxVolumeMult, pitch);

    if (visualRatio >= CONFIG.SQUEEZE_RELEASE_STRONG_VIBRATE_MIN_RATIO) {
        vibrate(CONFIG.SQUEEZE_RELEASE_STRONG_VIBRATE_PATTERN);
    }
}
