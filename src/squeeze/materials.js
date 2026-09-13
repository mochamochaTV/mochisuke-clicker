// 🧪 管理者限定・試作中：スクイーズの「素材」ごとの見た目・音・調整値をまとめたデータファイル。
// data.js（ゲーム全体のデータ）と同じ考え方で、ロジック（physics.js）とデータ（このファイル）を
// 分けている。新しい素材（砂もちすけ等）を増やす時は、このファイルにオブジェクトを1つ足すだけでよく、
// physics.js側のロジックには一切手を入れなくて済む設計にしている。
//
// 現時点では「スクイーズ衣装」専用の別画面はまだ無く、既存のもちすけの1本指スクイーズに
// 開発者モード限定で素材を差し込んで試している段階（詳しくは2-1参照）。そのため各素材の
// キー（'default'/'slime'）は、将来スクイーズ衣装として選べるようになった時のIDにそのまま
// 転用できる名前にしてある。
//
// 各素材が持てるプロパティ：
//   label              : 開発者ツール等での表示名
//   imageFile          : もちすけ本体の画像パス。省略した場合は元の画像のまま変更しない
//                         （'default'は元のもちすけ自身なので指定不要）
//   stretchSoundFile   : 伸ばしている間ループする音
//   releasePopSoundFile: 離した瞬間に鳴る「弾け」音
//   pokeSoundFile      : 押した瞬間の強弱で変化する「ポヨン」音。nullなら、この素材では
//                        このギミック自体が発動しない（＝もちすけ本体は今まで通り無音のまま）
export const SQUEEZE_MATERIALS = {
  default: {
    label: 'もちすけ（通常）',
    // imageFileは指定しない：setSqueezeMaterial()側で「元々表示されていた画像」に戻す
    stretchSoundFile: 'audio/mochisuke/mochi_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/mochi_release_pop.mp3',
    pokeSoundFile: null,
  },
  slime: {
    label: 'スライムもちすけ',
    imageFile: 'ui_images/mochisuke/image_slime.webp',
    stretchSoundFile: 'audio/mochisuke/slime_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/slime_release_pop.mp3',
    pokeSoundFile: 'audio/mochisuke/slime_poke.mp3',
  },
};

// 素材を指定せず起動した時・不正なキーが渡された時に使うフォールバック
export const DEFAULT_SQUEEZE_MATERIAL_KEY = 'default';
