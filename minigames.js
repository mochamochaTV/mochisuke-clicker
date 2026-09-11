/**
 * minigames.js
 * ミニゲームセンター機能全体の「窓口」ファイル。
 *
 * 以前はこのファイル1つ（2000行超）に、センター共通のインフラと5つのミニゲーム
 * （クイズ・タイムアタック・神経衰弱・もちつき・スロット）が全部同居していた。
 * ゲームごとに境界がはっきり分かれていたため、src/minigames/ 配下へ役割単位で
 * ファイル分割し、このファイルは src/ui/ui.js と同じ「export * from ...」パターンの
 * 再エクスポート専用ファイルにした。
 *
 * これにより、他ファイル（state.js・shop.js・main.js・tap.js）やindex.htmlは
 * これまで通り import ... from './minigames.js' と書けば全ての関数・定数に
 * アクセスできる（インポート元のパスを変更する必要がない）。
 *
 * ロジック・処理内容・数値は一切変更していない（ファイル分割とコードの再配置のみ）。
 * 分割の詳しい経緯・設計判断は、ぷにっかー指南書 4-6・4-6a を参照。
 */
export * from './src/minigames/core.js?v=2026-09-11-003';
export * from './src/minigames/quiz.js?v=2026-09-11-003';
export * from './src/minigames/timeAttack.js?v=2026-09-11-003';
export * from './src/minigames/concentration.js?v=2026-09-11-003';
export * from './src/minigames/mochitsuki.js?v=2026-09-11-003';
export * from './src/minigames/slotMachine.js?v=2026-09-11-003';
