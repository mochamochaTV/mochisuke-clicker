// 🧪 管理者限定・試作中：スクイーズの「素材」ごとの音・調整値をまとめたデータファイル。
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
//   pokeSoundFile      : 押した瞬間の強弱で変化する「ポヨン」音。nullなら、この素材では
//                        このギミック自体が発動しない（＝もちすけ本体は今まで通り無音のまま）
export const SQUEEZE_MATERIALS = {
  default: {
    label: 'もちすけ（通常）',
    stretchSoundFile: 'audio/mochisuke/mochi_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/mochi_release_pop.mp3',
    pokeSoundFile: null,
  },
  slime: {
    label: 'スライムもちすけ',
    stretchSoundFile: 'audio/mochisuke/slime_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/slime_release_pop.mp3',
    pokeSoundFile: 'audio/mochisuke/slime_poke.mp3',
  },
};

// 素材を指定せず起動した時・不正なキーが渡された時に使うフォールバック
export const DEFAULT_SQUEEZE_MATERIAL_KEY = 'default';
