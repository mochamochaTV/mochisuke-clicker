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
//   label                 : 開発者ツール等での表示名
//   stretchSoundFile      : 伸ばしている間ループする音
//   releasePopSoundFile   : 離した瞬間の「弾け」音。🆕 長押し・引っ張りで「もちぽんぽん」報酬が出る
//                           時は、tap.js側のgrantSqueezeReleaseMochiPopが、もちが1個出るたびに
//                           physics.jsのplaySqueezeReleasePopSound()を呼んで鳴らす（通常もちすけ・
//                           スライムもちすけ共通）。
//   playReleasePopOnPlainTap: 🆕 ただの軽いタップ（報酬が出ないほど短い、rebounded:falseの離し方）でも
//                           releasePopSoundFileを1回鳴らすかどうか。まもすいの指摘で判明：以前は
//                           離す度に無条件で1回鳴っていたのが、もちぽんぽん報酬の実装時に「報酬が
//                           出た時だけ」に絞られてしまい、通常もちすけの普通のタップで離す音が
//                           消えていた。通常もちすけはtrueにして音を復活させ、スライムもちすけは
//                           元々「タップの時は離す音いらない」という設計だったのでfalseのままにする
//                           （2-1参照。長押し・引っ張りの場合は両素材ともgrantSqueezeReleaseMochiPop
//                           経由でこれまで通り鳴る）
//   pokeSoundFile         : 指を動かして（本格的にドラッグして）押した瞬間の強弱で変化する「ポヨン」音。
//                           nullなら、この素材ではこのギミック自体が発動しない（＝もちすけ本体は今まで通り無音のまま）。
//                           🆕 ドラッグにならない、ただのタップ・長押しでは鳴らない（tap.mp3やsplashSoundFile
//                           だけにしたいという要望を受けて、2-1参照）
//   splashSoundFile       : 触れた瞬間に鳴る「ぴちゃ」という水っぽい音＋水色の波紋演出。nullなら、
//                           この素材ではこの演出自体が発動しない（2-1参照。今のところスライムもちすけ専用）
//   longPressLoopSoundFile: 🆕 引っ張らずに長押ししている間だけループ再生する「じわじわ潰れる」専用の音
//                           （src/squeeze/physics.jsのstartLongPressLoopSound等参照）。もちすけが最大まで
//                           潰れきったら自動的に止まる。nullなら、この素材ではこのループ音自体を鳴らさない
//                           （＝長押し中は無音のまま、見た目の潰れ演出だけが進む）。
//
// 🆕 pokeSoundFileはもともと「スライムもちすけ専用・管理者限定」の試作ギミックだったが、
// 「スクイーズにかぎらず通常のタップ・長押しでも、押す強さで音が変わってほしい」という要望を受け、
// 通常のもちすけ（'default'）にも用意し、全プレイヤー向けの機能に昇格させた（2-1参照）。
// 新しい素材を追加する時も、ここにpokeSoundFileを1つ足すだけで同じギミックがそのまま使える。
export const SQUEEZE_MATERIALS = {
  default: {
    label: 'もちすけ（通常）',
    stretchSoundFile: 'audio/mochisuke/mochi_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/mochi_release_pop.mp3',
    playReleasePopOnPlainTap: true, // 🆕 通常もちすけは、ただの軽いタップで離す時もこの音を1回鳴らす
    pokeSoundFile: 'audio/mochisuke/mochi_poke.mp3',
    splashSoundFile: null, // 通常のもちすけは水っぽくないので、この演出自体を出さない
    longPressLoopSoundFile: 'audio/mochisuke/mochi_squish_loop.mp3', // 🆕 まもすいが新規に用意した、長押し専用のループ音源
  },
  slime: {
    label: 'スライムもちすけ',
    stretchSoundFile: 'audio/mochisuke/slime_stretch.mp3',
    releasePopSoundFile: 'audio/mochisuke/slime_release_pop.mp3',
    playReleasePopOnPlainTap: false, // 🆕 スライムもちすけは、ただのタップで離す時はこの音を鳴らさない（まもすいの元々の設計）
    pokeSoundFile: 'audio/mochisuke/slime_poke.mp3',
    splashSoundFile: 'audio/mochisuke/slime_splash.mp3',
    longPressLoopSoundFile: 'audio/mochisuke/slime_poke_still.mp3', // 既存のslime_poke_stillをそのままループ音として使い回す
  },
};

// 素材を指定せず起動した時・不正なキーが渡された時に使うフォールバック
export const DEFAULT_SQUEEZE_MATERIAL_KEY = 'default';
