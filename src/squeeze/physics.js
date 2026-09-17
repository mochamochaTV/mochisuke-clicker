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
// 通常のもちすけ・スライムもちすけなど、素材ごとの音の設定はmaterials.jsへ分離してある
// （setSqueezeMaterial参照。見た目の画像はkisekae.js側のKISEKAE_ITEMS.fullbodyが持つため、
// このファイルは一切関知しない）。将来グリッドワープ等を追加する時も、この
// src/squeeze/ ディレクトリにまとめていく予定。
import {
  audioBuffers, createBurstParticle, createRippleEffect, getAudioContext, playAudioFile,
  playAudioFilePitched, sfxVolumeMult, vibrate
} from '../../main.js?v=2026-09-17-022';
// 素材ごとの音の設定はデータとしてmaterials.jsに分離してある
// （data.jsと同じ考え方。詳しくはそのファイルとこの下のsetSqueezeMaterial参照）。
import { DEFAULT_SQUEEZE_MATERIAL_KEY, SQUEEZE_MATERIALS } from './materials.js?v=2026-09-17-022';

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
  SQUEEZE_RELEASE_BURST_MIN_RATIO: 0.5, // これ以上伸ばして離した時だけ、パーティクル＋強振動を出す（軽いタップでは出さない）
  SQUEEZE_RELEASE_BURST_COUNT_BASE: 6,  // 弾けるパーティクルの最低数
  SQUEEZE_RELEASE_BURST_COUNT_RANGE: 8, // 伸び率に応じて上乗せされる最大数
  // 🆕 以前はここ（triggerSqueezeReleaseBurst）でreleasePopSoundFileを引っ張った長さに応じた音量で
  // 鳴らしていたが、「もちが出る時にひとつずつmochi_release_popを鳴らそう（３つ出るなら３回）」という
  // まもすいの要望を受けて、ポン音はtap.js側のgrantSqueezeReleaseMochiPop（もちぽんぽん報酬）が
  // もちを1個出すたびにplaySqueezeReleasePopSound()を呼ぶ方式に一本化した。このためこの関数
  // (triggerSqueezeReleaseBurst)自体はもう音を鳴らさず、パーティクル＋強振動の演出だけを担当する
  // （SQUEEZE_RELEASE_BURST_MIN_RATIO以上伸ばした時限定なのは変わらず）。ポン音自体のピッチ計算には
  // 下のSQUEEZE_RELEASE_POP_PITCH_BASE/PITCH_PER_TIERを引き続き使う（playSqueezeReleasePopSound参照）。
  SQUEEZE_RELEASE_POP_PITCH_BASE: 0.95,       // ポン音の基本ピッチ
  SQUEEZE_RELEASE_POP_PITCH_PER_TIER: 0.06,   // コンボtierが1段上がるごとに足すピッチ（見た目のコンボ演出と音を連動させる）
  // 🆕 もちぽんぽん報酬（tap.js側のgrantSqueezeReleaseMochiPop）で、もちが1個出るたびに鳴らすポン音の
  // 音量。以前のように引っ張った長さで音量を連続的に変えるのではなく、「同じ音量のポンが1〜3回鳴る」
  // というシンプルな設計にしたので、固定値1つで十分（playSqueezeReleasePopSound参照）
  SQUEEZE_RELEASE_MOCHI_POP_SOUND_VOLUME: 0.5,
  SQUEEZE_RELEASE_STRONG_VIBRATE_MIN_RATIO: 0.85, // かなり大きく伸ばして離した時だけ、軽いバイブで区切りを付ける
  SQUEEZE_RELEASE_STRONG_VIBRATE_PATTERN: [12, 25, 12],
  // --- 🆕 スクイーズ：指が触れている場所が優しく光る演出 ---
  SQUEEZE_GLOW_MAX_SCALE: 1.35, // 伸び率が最大の時、光がどれだけ大きく広がるか
  SQUEEZE_GLOW_FADE_OUT_MS: 260,
  // --- 🆕 押した瞬間の強弱で音が変わる「つつき」ギミック ---
  // もともとはスライムもちすけ専用・管理者限定の試作だったが、「スクイーズにかぎらず通常のタップ・
  // 長押しでも効果音がほしい」という要望を受け、通常のもちすけ（'default'素材）にもpokeSoundFileを
  // 用意し、全プレイヤー向けの機能に昇格させた（2-1参照）。素材ごとの音の違いはmaterials.js側の
  // pokeSoundFileだけが担い、このファイルの計算ロジックはどの素材でも共通で使う。
  // 「強さ」は本物の圧力センサーが無いため、pointerdown直後の最初の指の移動量÷経過時間（px/ms）を
  // 疑似的な「押し込み速度」として使い、これを0〜1の強度にマッピングしている。
  POKE_IMPACT_MAX_SPEED_PX_MS: 1.5, // これ以上速い押し込みは強度1.0（頭打ち）として扱う
  POKE_MIN_VOLUME: 0.25, // 弱く押した時の音量
  POKE_MAX_VOLUME: 0.7,  // 強く押した時の音量
  POKE_MIN_PITCH: 0.7,   // 強く押した時のピッチ（強いほど低く・重い音にする）
  POKE_MAX_PITCH: 1.15,  // 弱く押した時のピッチ（弱いほど高く・軽い音にする）
  // 🆕 つつき音(firePokeImpact)は「実際に指を動かして押し込んだ速さ」を表す演出なので、
  // ドラッグ扱いになる前（tap.js側のSQUEEZE_MIN_DRAG未満）は鳴らさない。ただのタップ・長押しでは
  // tap.mp3（またはsplashSoundFile）だけが鳴り、つつき音は本格的にドラッグが始まった時だけ鳴る
  // （まもすいの要望：ただのタップの時は1音だけにしたい。2-1参照）。
  // 🆕 2本指ストレッチも同じ考え方：2点間の距離がこれだけ開いて初めて「本格的なドラッグ」とみなし、
  // つつき音を1回だけ鳴らす（tap.js側のSQUEEZE_MIN_DRAGと役割は同じだが、1本指と2本指で座標の
  // 取り方が全く別物なので、値だけ揃えた専用の定数を別途持たせている。まもすいの指摘：2本指で
  // 引っ張った時にslime_pokeが鳴っていなかった不具合の修正。2-1参照）。
  TWO_FINGER_POKE_MIN_GROWTH_PX: 9,
  // --- 🆕 タップした瞬間の「ぴちゃ」という水っぽい音＋水色の波紋（materials.jsのsplashSoundFile） ---
  SPLASH_VOLUME: 0.6,
  SPLASH_RIPPLE_COLOR: '79, 195, 247', // このアプリの「水色」アクセント(#4fc3f7)と同じ色。squeeze-accum-hud等でも使用
  // --- 🆕 長押し（引っ張らずに押し続ける）専用の「じわじわ潰れる」演出＋離した時の反動 ---
  // ドラッグ用スクイーズ(squeezeTransformFor)とは別に、単純な軸に沿ったscale()の直線補間だけで
  // 実装している。tap.js側の固定の初期押し込みポーズ(scale(1.25,0.72))から始まり、ドラッグが
  // 始まらない限り、時間経過だけでじわじわ最終ポーズへ近づく（まもすいの要望：長押しでだんだん
  // 潰れるようにしたい。最終的には今より潰す）。
  LONGPRESS_SQUISH_START_SCALE_X: 1.25, // 開始スケール（tap.js側の初期押し込みポーズと同じ値にしておくこと）
  LONGPRESS_SQUISH_START_SCALE_Y: 0.72,
  // 🆕 長押しを続けた末にたどり着く、最終的な潰れポーズ。「もう少し潰したい」というまもすいの
  // 要望を受けて1.42/0.52から強めた。この2つの数値がそのまま「最大どれだけ潰れるか」を決めるので、
  // 感触を自分で調整したい時はここを直接書き換えるだけでよい（他のロジックには一切影響しない）。
  // 目安：X（横方向の伸び）を大きく・Y（縦方向のつぶれ）を小さくするほど、ぺしゃんこな見た目になる。
  // ちょうど良い見た目になったら、下のLONGPRESS_RELEASE_OVERSHOOT_RATIO（離した時の反動の大きさ）も
  // 一緒に見比べて調整すると、潰れ量と反動のバランスが取りやすい。
  LONGPRESS_SQUISH_END_SCALE_X: 1.55,
  LONGPRESS_SQUISH_END_SCALE_Y: 0.40,
  // 🆕「私がその長さ決めたい」＝どれだけ潰れるか(大きさ)ではなく、潰れきるまでにかかる"時間"を
  // 自分で調整したい、というまもすいの要望はこの数値のこと。開始ポーズ(LONGPRESS_SQUISH_START_SCALE_X/Y)
  // から最終ポーズ(LONGPRESS_SQUISH_END_SCALE_X/Y)まで、ここで指定したミリ秒をかけて直線的に潰れていく。
  // 短くするほどすぐに潰れきり、長くするほどじわじわゆっくり潰れる。ここだけを書き換えれば良く、
  // 他の見た目・音のロジックには影響しない（長押し音のループもこの時間に合わせて自動的に追従する）。
  LONGPRESS_SQUISH_DURATION_MS: 1400, // 🆕 実機での確認を経てまもすいが1200→1400msに調整
  LONGPRESS_RELEASE_OVERSHOOT_RATIO: 0.5, // 長押しから離した時、反動でどれだけ逆方向(伸びる方向)へ弾むか。潰れの進み具合(0〜1)に比例する
  LONGPRESS_RELEASE_DURATION_MS: 480,     // 反動アニメーションの長さ
  // 🆕 longPressSquishLastRatio（時間経過にそのまま比例する潰れ具合、0〜1）は、rAFが1回でも回れば
  // ほんの数十msの軽いタップでもわずかに0より大きくなってしまう。これをそのまま「長押しした」と
  // 判定してしまうと、ただの軽いタップのたびに反動アニメ・もちぽんぽん報酬が発生してしまう
  // （まもすいの指摘：「軽いタップの時はそのまま」と言ったのに鳴ってしまっている、の原因）。
  // この値未満の間はreleaseLongPressSquishがrebounded:falseを返し、tap.js側は反動アニメも
  // もちぽんぽん報酬も出さない（通常もちすけ・スライムもちすけ共通のルール。2-1参照）。
  LONGPRESS_MIN_RATIO_FOR_RELEASE_EFFECTS: 0.15,
  // 🆕 長押し中だけループする専用音（materials.jsのlongPressLoopSoundFile）の最大音量。
  // 潰れの進み具合(0〜1)に比例して0からこの値まで音量を上げていき、最大まで潰れきったら
  // （t>=1）ぴたりと止める（まもすいの要望：もちすけが最大まで縮まったらその効果音は止まる。2-1参照）。
  LONGPRESS_LOOP_SOUND_MAX_GAIN: 0.4,
  // --- 🆕 スクイーズ：伸びる「方向」の追従（2-1-b22で追加、2-1-b23で調整） ---
  // 最初は大きさ(SQUEEZE_FOLLOW_LERP)とまったく同じ追従係数・同じ「伸びるほど重くなる」heaviness補正を
  // 方向にもかけていたが、「重みのせいでもちすけを暴れさせる楽しさが無くなった」というまもすいからの
  // フィードバックを受け、方向は伸び具合に関わらず常に一定の軽さで追従するよう分離した（heaviness補正なし）。
  SQUEEZE_DIRECTION_FOLLOW_LERP: 0.22, // 方向の追従係数。SQUEEZE_FOLLOW_LERP(0.045)よりずっと大きく＝軽く速い
  // 急に正反対の方向へ引っ張った時だけ、指の生の方向へ直接向きを変えるのではなく、一度伸びを縮めてから
  // 新しい方向へ伸ばし直す（「もちすけの中心付近を一度通ってから反対側へ伸びる」感触にするため）。
  // 他の方向を経由してじわじわ反対方向に持っていった場合は、見た目の方向(squeezeVisualDx/Dy)が生の方向に
  // 毎フレームほぼ追従できているため、内積の変化が緩やかで、この閾値を割り込まない＝この特別処理には入らない。
  // 🆕 -0.5（およそ120度）だと「急な反転」判定の対象が狭すぎ、それより少し浅い角度（100度台前半など）で
  // 急に引っ張った時に、この特別処理に入らずそのまま方向をlerpしてしまい、ぐるんと回って見えることがある
  // というまもすいの指摘を受けて、-0.3（およそ107度）まで緩めた。判定範囲が広がるほど「反転」寄りに倒れ、
  // 素早い斜め方向転換まで一瞬中心に戻る動きに巻き込みやすくなるトレードオフがあるため、様子を見ながら
  // 微調整する前提の値（2-1-b23参照）。
  SQUEEZE_REVERSAL_DOT_THRESHOLD: -0.3, // 見た目の方向と新しい生の方向、正規化した内積がこれ未満＝なす角がおよそ107度を超えたら「急な反転」とみなす
  SQUEEZE_REVERSAL_RETRACT_LERP: 0.3, // 急な反転を検出した時、伸び率だけをこの速さで0へ戻す（大きさの重みheavinessの影響を受けない、常に一定の軽快さ）
  SQUEEZE_REVERSAL_RATIO_EPSILON: 0.04, // 伸び率がここまで縮んだら「中心に戻った」とみなし、方向を新しい向きへ切り替えて伸ばし直す

  // --- 🆕 スクイーズ「専用モード」（まもすいが最初から考えていた本来の姿。2-1参照） ---
  // 通常のタップ生産とは完全に別枠の遊び方：スクイーズ衣装を装備している間だけ、触るたびに変形が
  // 完全には戻らず少しずつ永続的に蓄積していく（＝好きなだけ変形させ続けられる）。tap.js側の
  // 「戻す」ボタンを押した時だけ、その時点までの蓄積量に応じてまとめてもちを獲得し、もちすけは
  // 弾けるように元の形へ戻る。1本指スクイーズのみ対象（2本指ストレッチは今まで通り常に完全に戻る）。
  SQUEEZE_ACCUM_MAX_D: 2.2, // 永続変形(d値)の実質的な上限。squeezeTransformForのperpが0を割らない安全な範囲に収めている（このd値自体は無制限に狙えるが、後述のdiminishing returnsでここへ漸近するだけになる）
  SQUEEZE_ACCUM_GROWTH_RATE: 0.35, // 1回離すごとに、その時の伸び率(0〜1)がどれだけ永続変形へ上乗せされるかの基本倍率。既に貯まっているほど上乗せ分が小さくなる（下のgrowAccum参照）
  SQUEEZE_ACCUM_IDLE_SETTLE_LERP: 0.1, // 指を離した瞬間の見た目（伸ばした分だけ底上げされた状態）から、新しい永続形へ「もにゅっ」と収まっていく速さ
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

// 🧪 管理者限定・試作中：現在有効なスクイーズ素材（'default'/'slime'。materials.js参照）。音（伸び音・
// 弾け音・つつき音）だけを担当し、見た目（画像）はここでは一切触らない。スクイーズ衣装は着せ替え
// （kisekae.js）の全身カテゴリの1アイテムとして装備するようになっており、画像の表示・切り戻しは
// kisekae.jsのapplyKisekaeToMainScreen()が一元的に担当している。もしここで画像にも触ってしまうと、
// タップのたびに再描画されるapplyKisekaeToMainScreen()の結果と競合し、タップした瞬間に画像だけ
// 通常のもちすけへ戻ってしまう、という不具合を過去に起こした（経緯は2-1参照）。
let currentSqueezeMaterialKey = DEFAULT_SQUEEZE_MATERIAL_KEY;

/**
 * スクイーズの素材（音）を切り替える。装備している衣装が変わるたびに、kisekae.jsの
 * applyKisekaeToMainScreen()から呼ばれる想定で、開発者ツール等から直接呼ぶことは想定していない
 * （見た目の切り替えは一切行わないため、直接呼んでも画像は変わらない）。
 * @param {string} key - materials.jsのSQUEEZE_MATERIALSに定義されているキー（'default'/'slime'）
 * @returns {void}
 */
export function setSqueezeMaterial(key) {
    const material = SQUEEZE_MATERIALS[key];
    if (!material) {
        console.warn(`[squeeze] 未知の素材キー: ${key}`);
        return;
    }
    currentSqueezeMaterialKey = key;
}

// 🆕 指で触れている場所が優しく光って見える演出。衣装(kisekae)の絵とは別レイヤーに、
// mix-blend-mode:screenで光を重ねるだけなので、どんな衣装を着せていても崩れずに使える
// （帽子・顔パーツはこの上のz-indexなので隠れない）
const squeezeGlowLayerEl = document.getElementById('squeeze-glow-layer');
const squeezeGlowPointerMap = new Map(); // pointerId -> { el, dentEl, fadeTimer }
// 🆕 専用モード中だけ使う「へこみ」レイヤーと「みずみずしい」光沢レイヤー（まもすいが最初から
// 考えていた質感演出。2-1参照）。どちらも通常のスクイーズの見た目には一切影響しない別レイヤー。
const squeezeDentLayerEl = document.getElementById('squeeze-dent-layer');
const squeezeJuicySheenEl = document.getElementById('squeeze-juicy-sheen');

/**
 * 指が触れた瞬間、その位置に「光」演出用の要素を新しく作って表示する。専用モード中は同じ位置に
 * 「へこみ」演出用の要素もあわせて作る（通常のスクイーズでは作らない＝見た目を変えないため）。
 * @param {number} pointerId - ポインタID
 * @param {number} clientX - 触れた位置のX座標（画面基準）
 * @param {number} clientY - 触れた位置のY座標（画面基準）
 * @returns {void}
 */
export function assignSqueezeGlow(pointerId, clientX, clientY) {
    const existing = squeezeGlowPointerMap.get(pointerId);
    if (existing) { clearTimeout(existing.fadeTimer); existing.el.remove(); if (existing.dentEl) existing.dentEl.remove(); }
    const el = document.createElement('div');
    el.className = 'squeeze-glow';
    squeezeGlowLayerEl.appendChild(el);
    let dentEl = null;
    if (accumulateModeActive && squeezeDentLayerEl) {
        dentEl = document.createElement('div');
        dentEl.className = 'squeeze-dent';
        squeezeDentLayerEl.appendChild(dentEl);
    }
    squeezeGlowPointerMap.set(pointerId, { el, dentEl, fadeTimer: null });
    // 🆕 まもすいの指摘（タップしたこと自体で反動アニメも呼吸アニメも一瞬止まって見える）の調査で発見：
    // ここのupdateSqueezeGlow()はmochiBtnElement.getBoundingClientRect()を呼ぶため、以前は
    // pointerdownの同期処理の中（＝呼吸アイドルのクラスを外した直後、押し込みポーズを描く前）で
    // 毎タップ強制的にレイアウト計算を発生させてしまっていた（=forced synchronous layout。
    // grantSqueezeReleaseMochiPop/triggerSqueezeReleaseBurstで見つけたのと同じ問題のクラス）。
    // 光の初期位置合わせは1フレーム遅れても見た目に違いが出ないので、元々is-active付与に使っていた
    // 次のrequestAnimationFrameに統合し、pointerdownの同期処理からレイアウト計測を追い出した（2-1参照）
    requestAnimationFrame(() => {
        updateSqueezeGlow(pointerId, clientX, clientY, 0);
        el.classList.add('is-active'); if (dentEl) dentEl.classList.add('is-active');
    });
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
    if (entry.dentEl) {
        entry.dentEl.style.left = px + '%';
        entry.dentEl.style.top = py + '%';
        entry.dentEl.style.opacity = String(0.4 + ratio * 0.4);
        entry.dentEl.style.setProperty('--s', String(0.55 + ratio * 0.5));
    }
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
    if (entry.dentEl) {
        entry.dentEl.classList.remove('is-active');
        entry.dentEl.style.opacity = '0';
        entry.dentEl.style.setProperty('--s', '0.55');
    }
    entry.fadeTimer = setTimeout(() => {
        entry.el.remove();
        if (entry.dentEl) entry.dentEl.remove();
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
    // 🆕 通常のスクイーズはd(伸縮量)が0〜1の範囲にしか来ないため元々問題にならなかったが、
    // 専用モードの永続変形はdが1を大きく超えることがあり（SQUEEZE_ACCUM_MAX_D参照）、
    // 何もしないとperpが0を割り込んで見た目が反転・破綻する。他の呼び出し元には影響しない
    // 安全な下限（0.12）でクランプしておく。
    const perp = Math.max(0.12, 1 - d * SQUEEZE_MAX_SQUASH);
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
// 🆕 押した瞬間の強弱で音が変わる「つつき」ギミック用の状態（全素材共通）。
// armPokeImpact()でpointerdownの瞬間の時刻を記録し、その後tap.js側で本格的なドラッグ
// （SQUEEZE_MIN_DRAG以上の移動）と判定された最初のupdateOneFingerSqueezeTarget呼び出し1回分だけで
// 強度を判定して音を鳴らし、以降は何もしない（1タップにつき1回だけ。ドラッグにならなければ鳴らない）。
let pokeArmed = false;
let pokeFired = false;
let pokeStartTime = 0;
// 🆕 実際の見た目・音に使う比率。stepSqueezeFollowが毎フレーム目標値へ近づける（追従の遅れ＝重み・粘り気）
let squeezeVisualRatio = 0;
// 🆕 1本指スクイーズの「見た目の伸び方向」。指の生の方向(oneFingerDx/Dy)へ毎フレーム少しずつ近づける
// （追従の遅れ）ことで、方向にも瞬時ではない軽い追従感を持たせている。以前は伸び率とまったく同じ
// heaviness込みの重い追従係数を使っていたが、「重みのせいでもちすけを暴れさせる楽しさが無くなった」
// というまもすいの指摘を受け、方向はSQUEEZE_DIRECTION_FOLLOW_LERPという専用の軽い係数（heaviness補正なし）
// で追従するよう分離した。急な正反対方向への反転だけは、これとは別にsqueezeReversalActiveで特別扱いする
// （下記参照・2-1-b23）。
let squeezeVisualDx = 0, squeezeVisualDy = 0;
// 🆕 「急な反転」を検出して処理中かどうか。trueの間は方向(squeezeVisualDx/Dy)を凍結し、伸び率だけを
// SQUEEZE_REVERSAL_RETRACT_LERPで0へ縮める。伸び率がSQUEEZE_REVERSAL_RATIO_EPSILON未満まで縮んだら、
// その時点でほぼ見えなくなっている方向を新しい生の方向へ切り替えてfalseに戻す（2-1-b23参照）。
let squeezeReversalActive = false;
let squeezeFollowRafId = null;

// --- 🆕 スクイーズ「専用モード」の状態（2-1参照）。tap.js側のisSqueezeCostumeActiveが変わるたびに
// setAccumulateModeActive()経由で教えてもらう（このファイルからtap.jsへは相変わらず一切importしない）。
let accumulateModeActive = false;
let accumD = 0; // 現在の「永続変形」量（d値）。0で通常の丸い形、離すたびに少しずつ増えていく。戻すボタンで0に戻る
let accumVisualD = 0; // 実際に描画しているd値。accumDへ毎フレーム少しずつ近づける（アイドル中の「もにゅっ」とした収まり）
let accumDx = 1, accumDy = 0; // 永続変形の方向（最後に指を離した時の伸び方向をそのまま引き継ぐ）
let accumIdleRafId = null;

/**
 * 現在装備している衣装がスクイーズ専用モードの対象かどうかを切り替える。kisekae.jsの
 * applyKisekaeToMainScreen()から、衣装が変わるたびに呼ばれる想定（保険としてtap.js側の
 * pointerdownからも毎回同じ値で呼ばれるが、値が変わらなければ即returnするので無害）。
 * @param {boolean} active - スクイーズ専用モード対象の衣装を装備しているか
 * @returns {void}
 */
export function setAccumulateModeActive(active) {
    if (accumulateModeActive === active) return;
    accumulateModeActive = active;
    if (!active) {
        // 🆕 衣装を外した/切り替えた時点で、精算していなかった蓄積分は破棄する（見た目もすぐ元に戻す）。
        // 装備を変えた瞬間はどのみち見た目の画像自体が別衣装に切り替わるため、中途半端に変形した
        // transformを残さないことが重要
        accumD = 0; accumVisualD = 0; accumDx = 1; accumDy = 0;
        if (accumIdleRafId !== null) { cancelAnimationFrame(accumIdleRafId); accumIdleRafId = null; }
        if (currentMode === null) {
            mochiDeformWrap.style.transform = 'scale(1, 1)';
            updateJuicySheen(0);
        }
    }
}

/**
 * 現在スクイーズ専用モードが有効かどうかを返す（tap.js側のHUD表示・報酬計算用）。
 * @returns {boolean}
 */
export function isAccumulateModeActive() { return accumulateModeActive; }

/**
 * 現在蓄積されている永続変形量(d値)を返す（tap.js側の「戻す」ボタンのプレビュー・報酬計算用）。
 * @returns {number}
 */
export function getAccumD() { return accumD; }

// 🆕 1回分の指の伸び(liveRatio, 0〜1)を永続変形へ上乗せする。既に貯まっているほど上乗せ分が
// 小さくなる（SQUEEZE_ACCUM_MAX_DへのDiminishing returns）ことで、「無制限に触り続けられる」ようにしつつ、
// squeezeTransformForの計算が破綻しない範囲に自然と収まるようにしている。
/**
 * @param {number} liveRatio - 今回離した瞬間の生の伸び率(0〜1、easeSqueezeRatio適用後)
 * @param {number} dx - 今回の伸び方向のX成分
 * @param {number} dy - 今回の伸び方向のY成分
 * @returns {void}
 */
function growAccum(liveRatio, dx, dy) {
    if (liveRatio <= 0) return;
    const remaining = Math.max(0, CONFIG.SQUEEZE_ACCUM_MAX_D - accumD);
    const growth = liveRatio * CONFIG.SQUEEZE_ACCUM_GROWTH_RATE * (remaining / CONFIG.SQUEEZE_ACCUM_MAX_D);
    accumD = Math.min(CONFIG.SQUEEZE_ACCUM_MAX_D, accumD + growth);
    accumDx = dx; accumDy = dy;
}

/**
 * 「戻す」ボタンが押された時に呼ぶ。蓄積されていた変形量を返しつつ内部状態を0に戻し、
 * 既存の揺れ戻り演出(releaseSqueezeWithOvershoot)をそのまま流用して、弾けるように元の形へ戻す
 * （蓄積が大きいほど、戻る時のプルンも大きくなる）。もち報酬の計算はtap.js側の責務。
 * @returns {number} 精算前に蓄積されていた変形量(d値)。0以下だった場合は何もせず0を返す
 */
export function resetSqueezeAccum() {
    const energy = accumD;
    if (energy <= 0) return 0;
    accumD = 0; accumVisualD = 0;
    if (accumIdleRafId !== null) { cancelAnimationFrame(accumIdleRafId); accumIdleRafId = null; }
    releaseSqueezeWithOvershoot(accumDx, accumDy, energy);
    updateJuicySheen(0);
    return energy;
}

/**
 * 専用モード中、蓄積された変形量に応じて「みずみずしい」光沢オーバーレイの強さを更新する。
 * 通常のスクイーズ（専用モード対象外の衣装）では一切使わないレイヤーなので、見た目に影響しない。
 * @param {number} d - 現在描画している変形量(d値)
 * @returns {void}
 */
function updateJuicySheen(d) {
    if (!squeezeJuicySheenEl) return;
    squeezeJuicySheenEl.style.opacity = String(Math.max(0, Math.min(1, d / CONFIG.SQUEEZE_ACCUM_MAX_D)));
}

// 🆕 指を触れていない間（currentMode===null）、永続変形の見た目(accumVisualD)をaccumDへ
// 少しずつ近づけ続けるループ。endSqueeze()で指を離した直後は、離した瞬間の見た目からスタートして
// 新しい（一部だけが残った、より小さい）永続量へ「もにゅっ」と収まっていく見た目になる。
/**
 * アイドル中の永続変形の追従ループを1フレーム分進める。専用モードが無効化されたか、
 * 指で触れ始めたら自動的に止まる。
 * @returns {void}
 */
function stepAccumIdle() {
    if (!accumulateModeActive || currentMode !== null) { accumIdleRafId = null; return; }
    accumVisualD += (accumD - accumVisualD) * CONFIG.SQUEEZE_ACCUM_IDLE_SETTLE_LERP;
    mochiDeformWrap.style.transformOrigin = 'center center';
    mochiDeformWrap.style.transform = squeezeTransformFor(accumDx, accumDy, accumVisualD);
    updateJuicySheen(accumVisualD);
    if (Math.abs(accumD - accumVisualD) > 0.002) {
        accumIdleRafId = requestAnimationFrame(stepAccumIdle);
    } else {
        accumVisualD = accumD;
        accumIdleRafId = null;
    }
}

/**
 * アイドル中の永続変形の追従ループを開始する（すでに動いていれば何もしない）。
 * @returns {void}
 */
function startAccumIdleLoop() {
    if (accumIdleRafId !== null) return;
    accumIdleRafId = requestAnimationFrame(stepAccumIdle);
}

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
    if (pokeArmed && !pokeFired) firePokeImpact(dx, dy); // 最初の1回だけ強度判定
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), SQUEEZE_MAX_DRAG);
    oneFingerRawRatio = dist / SQUEEZE_MAX_DRAG;
    oneFingerDx = dx; oneFingerDy = dy;
    currentMode = 'one';
    startSqueezeFollowLoop();
    return oneFingerRawRatio;
}

// 🆕 pointerdownの瞬間に呼んでおく「腕付け」関数。実際の音判定・再生は、tap.js側で本格的な
// ドラッグ（SQUEEZE_MIN_DRAG以上の移動）と判定された最初のupdateOneFingerSqueezeTarget呼び出しで
// 行う（ドラッグにならなければ一生呼ばれず、つつき音も鳴らない＝ただのタップ・長押しはtap.mp3や
// splashSoundFileだけになる。まもすいの要望：ただのタップの時は1音だけにしたい。2-1参照）。
// 今の素材にpokeSoundFileが設定されている時だけ有効（materials.js参照）。
/**
 * 押した瞬間の強弱で音を変えるギミックを「待機」状態にする。実際の判定・再生は、本格的な
 * ドラッグが始まった時に呼ばれる最初のupdateOneFingerSqueezeTargetで行われる。
 * 現在の素材(materials.js)にpokeSoundFileが設定されている時のみ有効。
 * @returns {void}
 */
export function armPokeImpact() {
    if (!SQUEEZE_MATERIALS[currentSqueezeMaterialKey].pokeSoundFile) return;
    pokeArmed = true;
    pokeFired = false;
    pokeStartTime = performance.now();
}

/**
 * pointerdownから、本格的なドラッグと判定された最初の移動までの移動量と経過時間から押し込み
 * 速度を推定し、0〜1の強度にマッピングして、強いほど低く・大きく、弱いほど高く・小さい音を
 * 1回だけ鳴らす。
 * @param {number} dx - pointerdown位置からのX移動量
 * @param {number} dy - pointerdown位置からのY移動量
 * @returns {void}
 */
function firePokeImpact(dx, dy) {
    pokeArmed = false;
    pokeFired = true;
    const pokeSoundFile = SQUEEZE_MATERIALS[currentSqueezeMaterialKey].pokeSoundFile;
    if (!pokeSoundFile) return; // armPokeImpact()後に素材が切り替わった場合の保険
    const elapsedMs = Math.max(1, performance.now() - pokeStartTime);
    const speed = Math.hypot(dx, dy) / elapsedMs; // px/ms。本物の圧力の代わりに使う疑似的な「押し込み速度」
    const intensity = Math.min(1, speed / CONFIG.POKE_IMPACT_MAX_SPEED_PX_MS);
    const volume = CONFIG.POKE_MIN_VOLUME + intensity * (CONFIG.POKE_MAX_VOLUME - CONFIG.POKE_MIN_VOLUME);
    const pitch = CONFIG.POKE_MAX_PITCH - intensity * (CONFIG.POKE_MAX_PITCH - CONFIG.POKE_MIN_PITCH); // 強いほど低いピッチ
    playAudioFilePitched(pokeSoundFile, volume * sfxVolumeMult, pitch);
}

// 🆕 触れた瞬間に鳴る「ぴちゃ」という水っぽい音＋水色の波紋演出（現状はスライムもちすけ専用）。
// pokeSoundFileと同じく、対応可否は素材ごとのデータ(materials.jsのsplashSoundFile)だけで決まるため、
// この関数自体はどの素材で呼んでも安全（splashSoundFileがnullの素材では何もしない）。
/**
 * pointerdownの瞬間にtap.js側から呼ぶ。現在の素材にsplashSoundFileが設定されている時だけ、
 * 「ぴちゃ」という水っぽい効果音と、その位置を中心にした水色の波紋を1回鳴らす／表示する。
 * @param {number} clientX - 触れた位置のX座標（画面基準）
 * @param {number} clientY - 触れた位置のY座標（画面基準）
 * @returns {void}
 */
export function triggerSqueezeTouchSplash(clientX, clientY) {
    const splashSoundFile = SQUEEZE_MATERIALS[currentSqueezeMaterialKey].splashSoundFile;
    if (!splashSoundFile) return; // splashSoundFileを持たない素材（通常のもちすけ等）ではこの演出自体を出さない
    playAudioFile(splashSoundFile, CONFIG.SPLASH_VOLUME * sfxVolumeMult);
    createRippleEffect(clientX, clientY, false, CONFIG.SPLASH_RIPPLE_COLOR);
}

// --- 🆕 長押し（引っ張らずに押し続ける）専用の「じわじわ潰れる」演出＋離した時の反動 ---
// ドラッグ用スクイーズ(squeezeTransformFor、指の方向に応じた非対称な変形)とは別に、こちらは
// 単純に軸に沿ったscale()を直線補間するだけの、もっと素朴な実装にしている。tap.js側の固定の
// 初期押し込みポーズ(scale(1.25,0.72)。CONFIG.LONGPRESS_SQUISH_START_SCALE_X/Yと同じ値)から始まり、
// ドラッグ（tap.js側でSQUEEZE_MIN_DRAG以上の移動と判定される）が始まらない限り、時間経過だけで
// じわじわ最終ポーズへ近づく。ドラッグが始まったらstopLongPressSquish()で即座に止め、以後は
// stepSqueezeFollow側にmochiDeformWrap.style.transformの制御を譲る（同時に動かすと描画が競合するため）。
let longPressSquishRafId = null;
let longPressSquishStartTime = 0;
let longPressSquishActive = false;
let longPressSquishLastRatio = 0; // 離した瞬間の反動の大きさ計算に使う、直近の潰れ具合(0〜1)

// 🆕 長押し中だけループする専用音（materials.jsのlongPressLoopSoundFile）用の状態。
// startStretchSound/updateStretchSound/stopStretchSoundと全く同じWeb Audio APIのバッファ＋ゲイン方式。
let longPressLoopSoundSource = null, longPressLoopSoundGain = null;

/**
 * 長押し用の「じわじわ潰れる」ループ音を音量0の状態で再生開始する。現在の素材に
 * longPressLoopSoundFileが設定されていない場合は何もしない（＝この演出音自体を鳴らさない素材もOK）。
 * @returns {void}
 */
function startLongPressLoopSound() {
    if (longPressLoopSoundSource) return;
    const longPressLoopSoundFile = SQUEEZE_MATERIALS[currentSqueezeMaterialKey].longPressLoopSoundFile;
    if (!longPressLoopSoundFile) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const buffer = audioBuffers[longPressLoopSoundFile];
    if (!buffer) return;
    longPressLoopSoundSource = ctx.createBufferSource();
    longPressLoopSoundSource.buffer = buffer;
    longPressLoopSoundSource.loop = true;
    longPressLoopSoundGain = ctx.createGain();
    longPressLoopSoundGain.gain.value = 0;
    longPressLoopSoundSource.connect(longPressLoopSoundGain).connect(ctx.destination);
    longPressLoopSoundSource.start(0);
}

/**
 * 潰れの進み具合(0〜1)に比例して、長押しループ音の音量を更新する。t=1（最大まで潰れきった）に
 * 到達したら、まもすいの要望（もちすけが最大まで縮まったらその効果音は止まる）通り、
 * ここでは鳴らし続けず、呼び出し元(stepLongPressSquish)側でstopLongPressLoopSound()を呼んで止める。
 * @param {number} t - 0〜1の潰れの進み具合
 * @returns {void}
 */
function updateLongPressLoopSound(t) {
    if (!longPressLoopSoundGain) return;
    longPressLoopSoundGain.gain.value = t * CONFIG.LONGPRESS_LOOP_SOUND_MAX_GAIN * sfxVolumeMult;
}

/**
 * 長押しループ音を停止し、参照をクリアする。最大まで潰れきった時（stepLongPressSquish）・
 * ドラッグに切り替わった時（stopLongPressSquish）・指を離した時（releaseLongPressSquish）の
 * いずれからも呼ばれる。
 * @returns {void}
 */
function stopLongPressLoopSound() {
    if (!longPressLoopSoundSource) return;
    try { longPressLoopSoundSource.stop(); } catch (e) {}
    longPressLoopSoundSource = null;
    longPressLoopSoundGain = null;
}

/**
 * 長押し用の「じわじわ潰れる」演出を開始する。指を離すかドラッグが始まるまで、時間経過に応じて
 * 徐々に最終ポーズ（CONFIG.LONGPRESS_SQUISH_END_SCALE_X/Y）へ近づき続ける。
 * @returns {void}
 */
export function startLongPressSquish() {
    longPressSquishActive = true;
    longPressSquishStartTime = performance.now();
    longPressSquishLastRatio = 0;
    startLongPressLoopSound(); // 🆕 見た目と同時に、長押し専用のループ音も鳴らし始める
    if (longPressSquishRafId === null) longPressSquishRafId = requestAnimationFrame(stepLongPressSquish);
}

/**
 * 長押し用の潰れ演出の1フレーム分の更新。最終ポーズに到達したら、その見た目を維持したままループを止める。
 * @returns {void}
 */
function stepLongPressSquish() {
    if (!longPressSquishActive) { longPressSquishRafId = null; return; }
    const t = Math.min(1, (performance.now() - longPressSquishStartTime) / CONFIG.LONGPRESS_SQUISH_DURATION_MS);
    longPressSquishLastRatio = t;
    const scaleX = CONFIG.LONGPRESS_SQUISH_START_SCALE_X + (CONFIG.LONGPRESS_SQUISH_END_SCALE_X - CONFIG.LONGPRESS_SQUISH_START_SCALE_X) * t;
    const scaleY = CONFIG.LONGPRESS_SQUISH_START_SCALE_Y + (CONFIG.LONGPRESS_SQUISH_END_SCALE_Y - CONFIG.LONGPRESS_SQUISH_START_SCALE_Y) * t;
    mochiDeformWrap.style.transform = `scale(${scaleX}, ${scaleY})`;
    if (t >= 1) {
        // 🆕 最大まで潰れきった＝もう変化が無いので、まもすいの要望通りループ音をここで止める
        // （見た目のrAFループ自体は今まで通りここで停止し、以後は静止したポーズを維持する）
        stopLongPressLoopSound();
        longPressSquishRafId = null;
    } else {
        updateLongPressLoopSound(t);
        longPressSquishRafId = requestAnimationFrame(stepLongPressSquish);
    }
}

/**
 * ドラッグ（SQUEEZE_MIN_DRAG以上の移動）に切り替わった時にtap.js側から呼ぶ。以後は
 * stepSqueezeFollow側がmochiDeformWrap.style.transformを制御するため、じわじわ潰れ演出は
 * ここで止める（transformには触れず、ループを止めるだけ）。あわせて長押し専用のループ音も止める
 * （本格的なドラッグに切り替わった以上、これ以降はfirePokeImpact等の通常の音に処理を譲るため）。
 * @returns {void}
 */
export function stopLongPressSquish() {
    longPressSquishActive = false;
    if (longPressSquishRafId !== null) { cancelAnimationFrame(longPressSquishRafId); longPressSquishRafId = null; }
    stopLongPressLoopSound();
}

/**
 * 指を離した時にtap.js側から呼ぶ。「本当に長押しと呼べる域まで潰れが進んでいたか」だけを判定して
 * 返す（LONGPRESS_MIN_RATIO_FOR_RELEASE_EFFECTS未満はrebounded:falseになる。上のCONFIGコメント参照）。
 *
 * 🆕 以前はここで反動アニメーション自体も（生のratioに比例した連続的な強さで）再生していたが、
 * 「もちぽんぽん報酬と同じ5段階の反動にしてほしい」というまもすいの要望を受け、アニメーション自体は
 * 呼び出し側（tap.js）がこの戻り値のratioからtierを計算した後、playLongPressReboundAnimation(tier, maxTier)
 * を呼んで再生する形に分離した。この関数自体はもう見た目に触れず、状態のクリーンアップと
 * 「反動・もちぽんぽん報酬の対象にして良いか」の判定だけを行う（通常もちすけ・スライムもちすけ共通のルール。2-1参照）。
 * @returns {{rebounded: boolean, ratio: number}} rebounded: trueなら反動アニメーション・もちぽんぽん
 *   報酬の対象（呼び出し側はfalseの場合、代わりに従来通りの固定の押し込みアニメーションを再生する）。
 *   ratio: 離した瞬間の潰れ具合(0〜1、しきい値による0扱いなし)。呼び出し側（tap.js）がスクイーズ
 *   衣装の「離した時のもち報酬」段階を計算する時に使う（2-1参照）
 */
export function releaseLongPressSquish() {
    const ratio = longPressSquishLastRatio;
    longPressSquishActive = false;
    if (longPressSquishRafId !== null) { cancelAnimationFrame(longPressSquishRafId); longPressSquishRafId = null; }
    stopLongPressLoopSound(); // 🆕 途中で離した場合（t<1でまだループ音が鳴っている場合）はここで止める
    longPressSquishLastRatio = 0;

    // 🆕 「本当に長押しと呼べる域まで進んでいたか」は、生のratioではなくLONGPRESS_MIN_RATIO_FOR_RELEASE_EFFECTS
    // 未満を切り捨てたものだけで判定する（上のCONFIG.LONGPRESS_MIN_RATIO_FOR_RELEASE_EFFECTSのコメント参照）。
    const isGenuineLongPress = ratio >= CONFIG.LONGPRESS_MIN_RATIO_FOR_RELEASE_EFFECTS;
    return { rebounded: isGenuineLongPress, ratio };
}

/**
 * releaseLongPressSquishがrebounded:trueを返した時にtap.js側から呼ぶ、長押しの反動アニメーション本体。
 * 潰れた状態から、行き過ぎて逆方向（伸びる方向）へ弾んでから、通常の形に収まる「反動」モーション
 * （releaseSqueezeWithOvershootと似た考え方だが、squeezeTransformForの伸縮曲線とは値の対応が異なる
 * （初期押し込みポーズが独自の固定値のため）ので、こちらは単純なscale()の直接指定にしている）。
 * 🆕 以前は生のratio(0〜1)をそのまま使い、潰れ具合に比例して連続的に強さが変わっていたが、
 * 「もちぽんぽん報酬（1〜5段階）と同じ5段階の反動にしてほしい」というまもすいの要望を受け、
 * tap.js側が計算済みのtier（もちぽんぽん報酬と全く同じcomputeSqueezeReleaseMochiTierの結果）を
 * そのまま受け取り、tier/maxTierを実効的な潰れ具合として使うことで、5段階のいずれかにスナップされた
 * 強さの反動になるようにした。段階の閾値自体はtap.js側のCONFIG.SQUEEZE_RELEASE_MOCHI_TIER_RATIOSが
 * 唯一の管理場所のままなので、こちら側はmaxTierを渡してもらうだけで常に段階数の変更に追従できる
 * （2-1参照。もちぽんぽん報酬側の実装はtap.js側のgrantSqueezeReleaseMochiPop参照）。
 * @param {number} tier - 1〜maxTierの段階（tap.js側のcomputeSqueezeReleaseMochiTierの戻り値をそのまま渡す）
 * @param {number} maxTier - 現在の最大段階数（tap.js側のCONFIG.SQUEEZE_RELEASE_MOCHI_TIER_RATIOS.length + 1）
 * @returns {void}
 */
/**
 * 長押し反動アニメーション(playLongPressReboundAnimation)の再生時間(ms)を返す。
 * 🆕 tap.js側が「反動アニメが終わってから呼吸アイドルを再開するまでの待ち時間」を計算する時に、
 * ここの値を勝手に別の数値で重複管理してズレる（例：build-watermarkのバージョン文字列のように
 * 更新し忘れる）事故を防ぐため、CONFIG.LONGPRESS_RELEASE_DURATION_MSをそのまま返すだけの
 * 薄いgetterとして用意した（2-1参照）。
 * @returns {number} 長押し反動アニメーションの再生時間(ms)
 */
export function getLongPressReleaseDurationMs() {
    return CONFIG.LONGPRESS_RELEASE_DURATION_MS;
}

/**
 * releaseSqueezeWithOvershoot/releaseTwoFingerSqueezeWithOvershoot（引っ張り/2本指ストレッチを
 * 離した時の揺れ戻り）の再生時間(ms)を返す。両関数とも実際のduration計算式
 * （CONFIG.SQUEEZE_OVERSHOOT_BASE_DURATION_MS + ratio×CONFIG.SQUEEZE_OVERSHOOT_DURATION_RANGE_MS）と
 * 完全に同じ式をここでも使うことで、tap.js側が呼吸アイドル再開までの待ち時間を計算する時に
 * 数値がズレないようにする（上のgetLongPressReleaseDurationMsと同じ狙い。2-1参照）。
 * @param {number} ratio - 揺れ戻り開始時点の伸縮比率（releaseSqueezeWithOvershoot等に渡すのと同じ値）
 * @returns {number} 揺れ戻りアニメーションの再生時間(ms)
 */
export function getSqueezeOvershootDurationMs(ratio) {
    return CONFIG.SQUEEZE_OVERSHOOT_BASE_DURATION_MS + ratio * CONFIG.SQUEEZE_OVERSHOOT_DURATION_RANGE_MS;
}

export function playLongPressReboundAnimation(tier, maxTier) {
    const tierRatio = Math.max(0, Math.min(1, tier / maxTier));
    const scaleX = CONFIG.LONGPRESS_SQUISH_START_SCALE_X + (CONFIG.LONGPRESS_SQUISH_END_SCALE_X - CONFIG.LONGPRESS_SQUISH_START_SCALE_X) * tierRatio;
    const scaleY = CONFIG.LONGPRESS_SQUISH_START_SCALE_Y + (CONFIG.LONGPRESS_SQUISH_END_SCALE_Y - CONFIG.LONGPRESS_SQUISH_START_SCALE_Y) * tierRatio;
    const overshoot = tierRatio * CONFIG.LONGPRESS_RELEASE_OVERSHOOT_RATIO;
    mochiDeformWrap.animate([
        { transform: `scale(${scaleX}, ${scaleY})` },
        { transform: `scale(${1 - overshoot * 0.65}, ${1 + overshoot * 0.65})`, offset: 0.35 },
        { transform: `scale(${1 + overshoot * 0.28}, ${1 - overshoot * 0.28})`, offset: 0.62 },
        { transform: `scale(${1 - overshoot * 0.1}, ${1 + overshoot * 0.1})`, offset: 0.82 },
        { transform: 'scale(1, 1)' },
    ], { duration: CONFIG.LONGPRESS_RELEASE_DURATION_MS, easing: 'ease-out' });
    mochiDeformWrap.style.transform = 'scale(1, 1)';
}

// 2本の指が離れていく方向・距離から、追従ループの目標値を更新する（2本指ドラッグ中に毎回呼ばれる）
/**
 * 2本指ストレッチの目標（生の伸縮比率・軸の角度）を更新し、追従ループを開始する。
 * 🆕 rawGrowthPx（2点間の距離が触れた瞬間からどれだけ開いたか、生のpx値）がTWO_FINGER_POKE_MIN_GROWTH_PX
 * 以上になった最初の1回だけ、1本指スクイーズと同じ「つつき」ギミックを発火させる（まもすいの指摘：
 * 2本指で引っ張った時にslime_pokeが鳴っていなかった不具合の修正。2-1参照）。1本指版
 * (updateOneFingerSqueezeTarget)と違い、速度計算に使うdx/dyの代わりにrawGrowthPxをそのまま渡す
 * （2本指の「強さ」は方向を持たない、両指が開く速さそのものなので、Math.hypot(dx,0)と等価になる）。
 * @param {number} angleDeg - 2点を結ぶ軸の角度（度）
 * @param {number} ratio - 0〜1の生の伸縮比率
 * @param {number} [rawGrowthPx=0] - 触れた瞬間からの2点間距離の伸び（px、生の値）
 * @returns {void}
 */
export function updateTwoFingerSqueezeTarget(angleDeg, ratio, rawGrowthPx = 0) {
    if (pokeArmed && !pokeFired && rawGrowthPx >= CONFIG.TWO_FINGER_POKE_MIN_GROWTH_PX) firePokeImpact(rawGrowthPx, 0);
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
        const rawDist = Math.sqrt(oneFingerDx * oneFingerDx + oneFingerDy * oneFingerDy);
        const visualDirLen = Math.sqrt(squeezeVisualDx * squeezeVisualDx + squeezeVisualDy * squeezeVisualDy);
        // 🆕 急な反転検出：今表示している伸び方向(squeezeVisualDx/Dy)と、今の生の指方向(oneFingerDx/Dy)の
        // なす角がおよそ120度を超えていたら「急な反転」とみなし、いきなり向きだけ変えるのではなく、
        // 一度もちすけの中心付近まで縮めてから新しい方向へ伸ばし直す（2-1-b23参照）。他の方向を経由して
        // じわじわ持っていった場合はこの内積が毎フレーム緩やかにしか変わらず、閾値を割り込まないので発動しない。
        if (!squeezeReversalActive && rawDist > 0.5 && visualDirLen > 0.5 && squeezeVisualRatio > CONFIG.SQUEEZE_REVERSAL_RATIO_EPSILON) {
            const dot = (oneFingerDx * squeezeVisualDx + oneFingerDy * squeezeVisualDy) / (rawDist * visualDirLen);
            if (dot < CONFIG.SQUEEZE_REVERSAL_DOT_THRESHOLD) squeezeReversalActive = true;
        }

        if (squeezeReversalActive) {
            // 方向は凍結したまま、伸び率だけを常に一定の速さ（重みheavinessの影響を受けない）で0へ縮める
            squeezeVisualRatio += (0 - squeezeVisualRatio) * CONFIG.SQUEEZE_REVERSAL_RETRACT_LERP;
            if (squeezeVisualRatio < CONFIG.SQUEEZE_REVERSAL_RATIO_EPSILON) {
                // 中心付近まで戻った＝見た目上ほぼ伸びていないので、ここで方向を新しい生の方向へ
                // 切り替えても違和感が出ない。以後は通常通りの追従に戻る
                squeezeReversalActive = false;
                squeezeVisualDx = oneFingerDx;
                squeezeVisualDy = oneFingerDy;
            }
        } else {
            const target = easeSqueezeRatio(oneFingerRawRatio);
            squeezeVisualRatio += (target - squeezeVisualRatio) * effectiveLerp;
            // 🆕 方向の追従は、大きさ(effectiveLerp)とは別の専用係数SQUEEZE_DIRECTION_FOLLOW_LERPを使う。
            // 「暴れさせる」操作感を大きさほど鈍らせないよう、伸びるほど遅くなるheaviness補正はかけていない
            // （2-1-b23参照）。指の移動量がほぼ無い(dist≈0)瞬間は方向そのものが定まらない（atan2の入力が
            // (0,0)付近で不安定）ため、その間は直前の方向を維持し、ノイズで方向が暴れるのを防ぐ。
            if (rawDist > 0.5) {
                squeezeVisualDx += (oneFingerDx - squeezeVisualDx) * CONFIG.SQUEEZE_DIRECTION_FOLLOW_LERP;
                squeezeVisualDy += (oneFingerDy - squeezeVisualDy) * CONFIG.SQUEEZE_DIRECTION_FOLLOW_LERP;
            }
        }
        // 🆕 専用モード中は、永続変形(accumVisualD)を土台にして、その上に今回の生の伸びを重ねて描画する。
        // こうすることで「触れた瞬間に一度中央へ戻ってから伸びる」ような不自然なジャンプが起きず、
        // 前回までの蓄積分から連続的に伸びていくように見える（実際に蓄積へ反映するのはendSqueeze()側）。
        const effectiveD = accumulateModeActive ? (accumVisualD + squeezeVisualRatio) : squeezeVisualRatio;
        mochiDeformWrap.style.transformOrigin = 'center center';
        mochiDeformWrap.style.transform = squeezeTransformFor(squeezeVisualDx, squeezeVisualDy, effectiveD);
        updateStretchSound(squeezeVisualRatio);
        if (accumulateModeActive) updateJuicySheen(effectiveD);
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
 * （squeezeVisualRatio）と伸び方向（squeezeVisualDx/Dy。どちらも指の生の値ではなく追従の
 * 遅れ込みの値）をまとめて返してから内部状態をリセットする。
 * 呼び出し側（tap.js）はこの戻り値を、揺れ戻りアニメーションや弾け演出の見た目にそのまま使うことで、
 * 離した瞬間に見た目が急にジャンプ（大きさだけでなく向きも）しないようにする
 * （🆕 以前はratioの数値だけを返しており、揺れ戻りの向きは呼び出し側が持つ生のdx/dyを使っていたため、
 * 急に逆方向へ引っ張って離した直後だけ向きが一瞬で反転して見える違和感があった）。
 * @returns {{ratio: number, dx: number, dy: number}} 離した瞬間の最終的な伸縮比率(0〜1)と伸び方向
 */
export function endSqueeze() {
    // 🆕 専用モードの蓄積は1本指スクイーズのみ対象（2本指ストレッチは今まで通り常に完全に戻る）。
    // currentModeをnullにする前に判定しておく必要がある
    const wasOneFinger = currentMode === 'one';
    currentMode = null;
    if (squeezeFollowRafId !== null) { cancelAnimationFrame(squeezeFollowRafId); squeezeFollowRafId = null; }
    const finalRatio = squeezeVisualRatio;
    const finalDx = squeezeVisualDx, finalDy = squeezeVisualDy;
    if (accumulateModeActive && wasOneFinger && finalRatio > 0) {
        // 🆕 専用モード：離した瞬間の見た目（永続変形＋今回の伸び）をそのままaccumVisualDに引き継いでから、
        // 今回の伸びの一部だけを新しい永続量として蓄積する。アイドルループが、この底上げされた見た目から
        // 新しい（より小さい）永続量へ「もにゅっ」と収まっていく様子を描画する（バキッと縮まない）
        accumVisualD = accumVisualD + finalRatio;
        growAccum(finalRatio, finalDx, finalDy);
        startAccumIdleLoop();
    }
    squeezeVisualRatio = 0;
    squeezeVisualDx = 0; squeezeVisualDy = 0;
    squeezeReversalActive = false; // 🆕 次にスクイーズを始めた時に反転検出の状態を持ち越さないようにする
    oneFingerRawRatio = 0; oneFingerDx = 0; oneFingerDy = 0;
    twoFingerRawRatio = 0; twoFingerAngleDeg = 0;
    return { ratio: finalRatio, dx: finalDx, dy: finalDy };
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
    const buffer = audioBuffers[SQUEEZE_MATERIALS[currentSqueezeMaterialKey].stretchSoundFile];
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

// 🆕 スクイーズを離した瞬間の演出。ポン音は常に鳴らし、gatingRatio（「弾けを出して良いか」の判定に使う、
// 指の生の移動量ベースの比率）が一定以上の時だけ、追加でパーティクル＋強振動を出す。この判定を
// 関数の内部に持たせることで、呼び出し側(tap.js)がコンボ内部のtierIndexだけ渡せば済むようにしている
// （tap.jsのコンボロジックをこのファイルへimportさせないための設計）。
/**
 * 指を離した瞬間、一定以上伸ばしていた時だけ弾けるパーティクル・強振動を追加する。
 * 🆕 以前はここでreleasePopSoundFileも鳴らしていた（引っ張った長さに応じて音量を変える方式）が、
 * 「もちが出る時にひとつずつmochi_release_popを鳴らそう（３つ出るなら３回）」という要望を受けて、
 * ポン音はtap.js側のgrantSqueezeReleaseMochiPop（もちぽんぽん報酬）がもちを1個出すたびに
 * playSqueezeReleasePopSound()を呼ぶ方式に一本化した。そのためこの関数はもう音を鳴らさず、
 * パーティクル・強振動の演出だけを担当する（SQUEEZE_RELEASE_BURST_MIN_RATIO以上伸ばした時限定なのは変わらず）。
 * 🆕 呼び出し元(tap.js releaseMochiSucre)は、この関数の直前にreleaseSqueezeWithOvershoot/
 * releaseTwoFingerSqueezeWithOvershoot（mochiDeformWrap.animate()による反動アニメーション）を同期的に
 * 呼んでいる。この関数の中のmochiBtnElement.getBoundingClientRect()は、ブラウザに強制的にレイアウト
 * 計算を即座にやらせる（forced synchronous layout）呼び出しで、これが.animate()呼び出しと同じ同期実行の
 * 中で走ると、実機のような非力な端末ではメインスレッドが詰まり、反動アニメーションのクロックだけ
 * 進んでしまい「反動が起きなかったように見える」フリーズの原因になり得る（まもすいの報告により、
 * 長押し版のgrantSqueezeReleaseMochiPopで判明した現象と全く同じ原因。2-1参照）。そのため、
 * getBoundingClientRect()を含む処理全体をsetTimeoutで次のタスクに追い出し、.animate()呼び出しとは
 * 絶対に同じ同期実行の中で衝突しないようにした。
 * @param {number} gatingRatio - 「パーティクル・強振動を出して良いか」の判定に使う伸縮比率（指の生の移動量ベース。0〜1）
 * @param {number} visualRatio - 実際の見た目（パーティクル数・強振動の閾値判定）に使う伸縮比率（追従の遅れ込みの値）
 * @returns {void}
 */
export function triggerSqueezeReleaseBurst(gatingRatio, visualRatio) {
    if (gatingRatio < CONFIG.SQUEEZE_RELEASE_BURST_MIN_RATIO) return; // パーティクル・強振動はこれ以上伸ばした時だけ

    setTimeout(() => {
        const rect = mochiBtnElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const count = Math.round(CONFIG.SQUEEZE_RELEASE_BURST_COUNT_BASE + visualRatio * CONFIG.SQUEEZE_RELEASE_BURST_COUNT_RANGE);
        for (let i = 0; i < count; i++) createBurstParticle(cx, cy);

        if (visualRatio >= CONFIG.SQUEEZE_RELEASE_STRONG_VIBRATE_MIN_RATIO) {
            vibrate(CONFIG.SQUEEZE_RELEASE_STRONG_VIBRATE_PATTERN);
        }
    }, 0);
}

/**
 * 🆕 もちぽんぽん報酬（tap.js側のgrantSqueezeReleaseMochiPop）で、もちが1個出るたびに鳴らす
 * 「弾け」音。releaseLongPressSquish/triggerSqueezeReleaseBurstとは切り離し、もちがtier個出る場合は
 * tap.js側がこの関数をtier回、少し間隔を空けて呼ぶ想定（2-1参照。まもすいの要望：もちが出る時も
 * ひとつずつmochi_release_popを鳴らそう＝３つ出るなら３回鳴らす）。通常もちすけ・スライムもちすけ
 * 共通で、その時点のcurrentSqueezeMaterialKeyのreleasePopSoundFileを使う。
 * @param {number} [comboTierIndex=0] - ポン音のピッチ計算に使うコンボ段階（見つからない場合は省略可）
 * @returns {void}
 */
export function playSqueezeReleasePopSound(comboTierIndex = 0) {
    const releasePopSoundFile = SQUEEZE_MATERIALS[currentSqueezeMaterialKey].releasePopSoundFile;
    if (!releasePopSoundFile) return;
    const pitch = CONFIG.SQUEEZE_RELEASE_POP_PITCH_BASE + Math.max(0, comboTierIndex) * CONFIG.SQUEEZE_RELEASE_POP_PITCH_PER_TIER;
    playAudioFilePitched(releasePopSoundFile, CONFIG.SQUEEZE_RELEASE_MOCHI_POP_SOUND_VOLUME * sfxVolumeMult, pitch);
}

/**
 * 🆕【まもすいの指摘で復活】もちぽんぽん報酬が出ないほど短い、ただの軽いタップ（releaseLongPressSquish
 * がrebounded:falseを返すケース）で離した時にtap.js側から呼ぶ。以前はreleasePopSoundFileが離す度に
 * 無条件で1回鳴っていたが、もちぽんぽん報酬の実装時に「報酬が出た時だけ」playSqueezeReleasePopSound
 * を呼ぶ方式へ絞り込んでしまい、通常もちすけの普通のタップで離す音が消えていた。この関数は素材ごとの
 * materials.jsのplayReleasePopOnPlainTapフラグを見て、trueの素材（通常もちすけ）だけ
 * playSqueezeReleasePopSoundを1回呼ぶ。falseの素材（スライムもちすけ。まもすいの元々の設計で
 * 「タップの時は離す音いらない」）では何もしない。長押し・引っ張りで報酬が出る場合は、今まで通り
 * grantSqueezeReleaseMochiPop側がplaySqueezeReleasePopSoundを直接呼ぶので、この関数の対象外（2-1参照）。
 * @param {number} [comboTierIndex=0] - ポン音のピッチ計算に使うコンボ段階（playSqueezeReleasePopSoundにそのまま渡す）
 * @returns {void}
 */
export function playPlainTapReleaseSoundIfEnabled(comboTierIndex = 0) {
    if (!SQUEEZE_MATERIALS[currentSqueezeMaterialKey].playReleasePopOnPlainTap) return;
    playSqueezeReleasePopSound(comboTierIndex);
}
