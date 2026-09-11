        // ===================================================================
        // ui.js は「窓口」ファイルです。実際のコードは src/ui/ 以下の7ファイルに機能ごとに
        // 分割されています（元々はこのファイル1つに4000行超すべて入っていました）。
        // 他のファイルからの import { X } from './ui.js?v=...' は今まで通りそのまま動きます
        // （export * from で、分割先の全部のexportをこのファイル経由でも見えるようにしています）。
        // ===================================================================

        export * from './src/ui/core.js?v=2026-09-11-001';
        export * from './src/ui/chat.js?v=2026-09-11-001';
        export * from './src/ui/social.js?v=2026-09-11-001';
        export * from './src/ui/myroom.js?v=2026-09-11-001';
        export * from './src/ui/kisekae.js?v=2026-09-11-001';
        export * from './src/ui/hud.js?v=2026-09-11-001';
        export * from './src/ui/ranking.js?v=2026-09-11-001';
