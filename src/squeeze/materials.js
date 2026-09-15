// スクイーズの「素材」ごとの音・調整値をまとめたデータファイル。
// data.js（ゲーム全体のデータ）と同じ考え方で、ロジック（physics.js）とデータ（このファイル）を
// 分けている。新しい素材（砂もちすけ等）を増やす時は、このファイルにオブジェクトを1つ足すだけでよく、
// physics.js側のロジックには一切手を入れなくて済む設計にしている。
//
// 画像はこのファイルの管轄外：スクイーズ衣装は着せ替え(kisekae.js)の全身カテゴリの1着として
// KISEKAE_ITEMS.fullbody（data.js）に登録し、見た目（img）はそちら側だけが持つ。このファイルの
// 各キー（'default'/'slime'）は、KISEKAE_ITEMS.fullbodyの各アイテムが持つsqueezeMaterialフィールドの
// 値として参照される（詳しくは2-1参照）。「default」は衣装を何も着けていない時（＝通常のもちすけ）
// に対応するキーで、専用の衣装アイテムは存在しない。
//
// 各素材が持てるプロパティ：
//   label              : 開発者ツール等での表示名
//   stretchSoundFile   : 伸ばしている間ループする音
//   releasePopSoundFile: 離した瞬間に鳴る「弾け」音
//   pokeSoundFile      : 指を動かして（引っ張って）押した瞬間の強弱で変化する「ポヨン」音。nullなら、
//                        この素材ではこのギミック自体が発動しない（＝もちすけ本体は今まで通り無音のまま）
//   stillPokeSoundFile : 引っ張らずに長押し・タップした時（＝pokeSoundFile側が強さを測れない時）専用の音。
//                        pokeSoundFileとは別の音を鳴らしたいという要望を受けて追加（2-1参照）。nullなら、
//                        引っ張らなかった時は何も鳴らさない（pokeSoundFileへは自動フォールバックしない）
//   splashSoundFile    : 触れた瞬間に鳴る「ぴちゃ」という水っぽい音＋水色の波紋演出。nullなら、
//                        この素材ではこの演出自体が発動しない（2-1参照。今のところスライムもちすけ専用）
//
// 🆕 pokeSoundFileはもともと「スライムもちすけ専用・管理者限定」の試作ギミックだったが、
// 「スクイーズにかぎらず通常のタップ・長押しでも、押す強さで音が変わってほしい」という要望を受け、
// 通常のもちすけ（'default'）にも用意し、全プレイヤー向けの機能に昇格させた（2-1参照）。
// 新しい素材を追加する時も、ここにpokeSoundFile（・必要ならstillPokeSoundFile）を足すだけで同じギミックがそのまま使える。
export const SQUEEZE_MATERIALS = {
  default: {
    label: 'もちすけ（通常）',
    stretchSoundFile: 'audio/mochisuke/mochi_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/mochi_release_pop.mp3',
    pokeSoundFile: 'audio/mochisuke/mochi_poke.mp3',
    stillPokeSoundFile: 'audio/mochisuke/mochi_poke_still.mp3',
    splashSoundFile: null, // 通常のもちすけは水っぽくないので、この演出自体を出さない
  },
  slime: {
    label: 'スライムもちすけ',
    stretchSoundFile: 'audio/mochisuke/slime_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/slime_release_pop.mp3',
    pokeSoundFile: 'audio/mochisuke/slime_poke.mp3',
    stillPokeSoundFile: 'audio/mochisuke/slime_poke_still.mp3',
    splashSoundFile: 'audio/mochisuke/slime_splash.mp3',
  },
};

// 素材を指定せず起動した時・不正なキーが渡された時に使うフォールバック
export const DEFAULT_SQUEEZE_MATERIAL_KEY = 'default';
