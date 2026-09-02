        const stages = [
            { name: "鹿児島", pinX: 17.1, pinY: 76.5, distance: 500, item: "スイートポテト", itemImg: "omiyage_images/kyushu_okinawa/kagoshima_item.webp", price: 12, diary: "旅の始まりは鹿児島から！桜島がとっても雄大で、パワーをもらった気分やで。ここから日本中をもちでいっぱいにしに行くで！", bg: "bg_images/kyushu_okinawa/kagoshima.webp", diaryImg: "diary_images/kyushu_okinawa/kagoshima_d.webp", effectDesc: "タップ力 +1", tapBonus: 1, mpsBonus: 0 },
            { name: "宮崎", pinX: 21.0, pinY: 73.3, distance: 900, item: "完熟マンゴー", itemImg: "omiyage_images/kyushu_okinawa/miyazaki_item.webp", price: 25, diary: "宮崎にやってきたで！ヤシの木が並んで南国気分満点やなあ。お日様を浴びたマンゴーは甘くて最高や！", bg: "bg_images/kyushu_okinawa/miyazaki.webp", diaryImg: "diary_images/kyushu_okinawa/miyazaki_d.webp", effectDesc: "自動増加 +1もち/秒", tapBonus: 0, mpsBonus: 1 },
            { name: "大分", pinX: 21.5, pinY: 69.4, distance: 1600, item: "ジャズ羊羹", itemImg: "omiyage_images/kyushu_okinawa/oita_item.webp", price: 50, diary: "大分といえば温泉やで！至る所から湯気がもくもく。足湯に入ったら、旅の疲れが一気に吹き飛んだわ。", bg: "bg_images/kyushu_okinawa/oita.webp", diaryImg: "diary_images/kyushu_okinawa/oita_d.webp", effectDesc: "タップ力 +1", tapBonus: 1, mpsBonus: 0 },
            { name: "熊本", pinX: 16.2, pinY: 71.8, distance: 3000, item: "陣太鼓", itemImg: "omiyage_images/kyushu_okinawa/kumamoto_item.webp", price: 100, diary: "熊本城を見に行ったで！石垣がすごく高くて圧倒されちゃったわ。からし蓮根はツーンと大人の味や！", bg: "bg_images/kyushu_okinawa/kumamoto.webp", diaryImg: "diary_images/kyushu_okinawa/kumamoto_d.webp", effectDesc: "自動増加 +1もち/秒", tapBonus: 0, mpsBonus: 1 },
            { name: "長崎", pinX: 10.6, pinY: 71.6, distance: 5500, item: "長崎カステラ", itemImg: "omiyage_images/kyushu_okinawa/nagasaki_item.webp", price: 200, diary: "長崎は坂の街やなあ！のぼり坂がいっぱいでいい運動になったで。カステラもザラメがシャリシャリで美味しいわ！", bg: "bg_images/kyushu_okinawa/nagasaki.webp", diaryImg: "diary_images/kyushu_okinawa/nagasaki_d.webp", effectDesc: "タップ力 +1", tapBonus: 1, mpsBonus: 0 },
            { name: "佐賀", pinX: 11.3, pinY: 69.1, distance: 10000, item: "佐賀のモナカ", itemImg: "omiyage_images/kyushu_okinawa/saga_item.webp", price: 375, diary: "佐賀の呼子で透明なイカを食べたで！コリコリしていて甘くて、今まで食べたイカと全然違うんや！", bg: "bg_images/kyushu_okinawa/saga.webp", diaryImg: "diary_images/kyushu_okinawa/saga_d.webp", effectDesc: "自動増加 +1もち/秒", tapBonus: 0, mpsBonus: 1 },
            { name: "福岡", pinX: 17.2, pinY: 67.0, distance: 18000, item: "博多通りもん", itemImg: "omiyage_images/kyushu_okinawa/fukuoka_item.webp", price: 750, diary: "中洲の屋台街はとっても賑やかでワクワクしたで。美味しいとんこつラーメンをバッチリ替玉まで完食や！", bg: "bg_images/kyushu_okinawa/fukuoka.webp", diaryImg: "diary_images/kyushu_okinawa/fukuoka_d.webp", effectDesc: "タップ力 +1", tapBonus: 1, mpsBonus: 0 },
            { name: "山口", pinX: 19.0, pinY: 61.8, distance: 32000, item: "夏蜜柑丸漬", itemImg: "omiyage_images/chugoku_shikoku/yamaguchi_item.webp", price: 1500, diary: "本州に突入、最初は山口県やで！下関のフグはお皿が透けるくらい綺麗で、ぷにぷに歯ごたえが最高やったわ。", bg: "bg_images/chugoku_shikoku/yamaguchi.webp", diaryImg: "diary_images/chugoku_shikoku/yamaguchi_d.webp", effectDesc: "自動増加 +1もち/秒", tapBonus: 0, mpsBonus: 1 },
            { name: "広島", pinX: 25.7, pinY: 61.6, distance: 58000, item: "もみじ饅頭", itemImg: "omiyage_images/chugoku_shikoku/hiroshima_item.webp", price: 3000, diary: "広島県にきたで！厳島神社の大きな鳥居が海に浮かんでいて神秘的やったわ。アツアツの焼き牡蠣は海の旨味がたっぷりや！", bg: "bg_images/chugoku_shikoku/hiroshima.webp", diaryImg: "diary_images/chugoku_shikoku/hiroshima_d.webp", effectDesc: "タップ力 +1", tapBonus: 1, mpsBonus: 0 },
            { name: "島根", pinX: 23.6, pinY: 57.9, distance: 100000, item: "ねこの人形焼", itemImg: "omiyage_images/chugoku_shikoku/shimane_item.webp", price: 6250, diary: "出雲大社にお参りしてきたで！良いご縁がありますように。割子で食べる出雲そばは香りがすごく良かったなあ。", bg: "bg_images/chugoku_shikoku/shimane.webp", diaryImg: "diary_images/chugoku_shikoku/shimane_d.webp", effectDesc: "自動増加 +1もち/秒", tapBonus: 0, mpsBonus: 1 },
            { name: "鳥取", pinX: 30.9, pinY: 56.2, distance: 180000, item: "白うさぎ", itemImg: "omiyage_images/chugoku_shikoku/tottori_item.webp", price: 12500, diary: "鳥取砂丘はまるで砂の砂漠みたいで広かったなあ！たくさん歩いた後の大山ミルクソフトは濃厚で染みたわ。", bg: "bg_images/chugoku_shikoku/tottori.webp", diaryImg: "diary_images/chugoku_shikoku/tottori_d.webp", effectDesc: "タップ力 +2", tapBonus: 2, mpsBonus: 0 },
            { name: "岡山", pinX: 31.1, pinY: 59.7, distance: 320000, item: "きびだんご", itemImg: "omiyage_images/chugoku_shikoku/okayama_item.webp", price: 25000, diary: "桃太郎の故郷、岡山県やで！美味しいきびだんごを貰ったから、もちすけも今日から桃太郎の仲間入りかな？", bg: "bg_images/chugoku_shikoku/okayama.webp", diaryImg: "diary_images/chugoku_shikoku/okayama_d.webp", effectDesc: "自動増加 +5もち/秒", tapBonus: 0, mpsBonus: 5 },
            { name: "香川", pinX: 35.6, pinY: 63.8, distance: 580000, item: "讃岐モナカ", itemImg: "omiyage_images/chugoku_shikoku/kagawa_item.webp", price: 50000, diary: "瀬戸大橋を渡って四国へ！本場の讃岐うどんはコシが強くてツルツルや。お出しも美味しくて一気に完食したで！", bg: "bg_images/chugoku_shikoku/kagawa.webp", diaryImg: "diary_images/chugoku_shikoku/kagawa_d.webp", effectDesc: "タップ力 +10", tapBonus: 10, mpsBonus: 0 },
            { name: "徳島", pinX: 38.1, pinY: 65.8, distance: 1000000, item: "金のしずく", itemImg: "omiyage_images/chugoku_shikoku/tokushima_item.webp", price: 100000, diary: "徳島県にやってきたで！阿波踊りのリズムにワクワクしたわ。名物のすだちを絞ったおもちはさっぱり美味しいや！", bg: "bg_images/chugoku_shikoku/tokushima.webp", diaryImg: "diary_images/chugoku_shikoku/tokushima_d.webp", effectDesc: "自動増加 +21もち/秒", tapBonus: 0, mpsBonus: 21 },
            { name: "高知", pinX: 34.5, pinY: 68.9, distance: 1800000, item: "都まんじゅう", itemImg: "omiyage_images/chugoku_shikoku/kochi_item.webp", price: 200000, diary: "桂浜から見る太平洋はすっごく広くて感動したで！藁焼きの香ばしいカツオのたたきを食べてスタミナ満点や。", bg: "bg_images/chugoku_shikoku/kochi.webp", diaryImg: "diary_images/chugoku_shikoku/kochi_d.webp", effectDesc: "タップ力 +44", tapBonus: 44, mpsBonus: 0 },
            { name: "愛媛", pinX: 29.5, pinY: 67.2, distance: 3200000, item: "坊っちゃん団子", itemImg: "omiyage_images/chugoku_shikoku/ehime_item.webp", price: 375000, diary: "愛媛県はみかんの王国やで！ジューシーなみかんが丸ごと入った大福は、甘酸っぱくてモチモチで最高や。", bg: "bg_images/chugoku_shikoku/ehime.webp", diaryImg: "diary_images/chugoku_shikoku/ehime_d.webp", effectDesc: "自動増加 +89もち/秒", tapBonus: 0, mpsBonus: 89 },
            { name: "兵庫", pinX: 37.4, pinY: 58.9, distance: 5800000, item: "お城やき", itemImg: "omiyage_images/kinki/hyogo_item.webp", price: 750000, diary: "再び本州へ戻って兵庫県やで！神戸のオシャレな港町を散策したわ。贅沢な神戸牛ステーキはお口でとろけたで。", bg: "bg_images/kinki/hyogo.webp", diaryImg: "diary_images/kinki/hyogo_d.webp", effectDesc: "タップ力 +194", tapBonus: 194, mpsBonus: 0 },
            { name: "大阪", pinX: 45.3, pinY: 60.3, distance: 10000000, item: "絶品豚まん", itemImg: "omiyage_images/kinki/osaka_item.webp", price: 1500000, diary: "笑いの街、大阪やで！通天閣を見上げて、道頓堀でアツアツのたこ焼きを食べたんや。ハフハフして美味しかったわ！", bg: "bg_images/kinki/osaka.webp", diaryImg: "diary_images/kinki/osaka_d.webp", effectDesc: "自動増加 +417もち/秒", tapBonus: 0, mpsBonus: 417 },
            { name: "和歌山", pinX: 46.8, pinY: 64.4, distance: 18000000, item: "かげろう", itemImg: "omiyage_images/kinki/wakayama_item.webp", price: 3000000, diary: "和歌山でパンダを見てきたで！すっごく可愛かったなあ。すっぱい紀州梅干しを食べてシャキッと元気復活や！", bg: "bg_images/kinki/wakayama.webp", diaryImg: "diary_images/kinki/wakayama_d.webp", effectDesc: "タップ力 +889", tapBonus: 889, mpsBonus: 0 },
            { name: "奈良", pinX: 49.3, pinY: 62.2, distance: 32000000, item: "かのこ饅頭", itemImg: "omiyage_images/kinki/nara_item.webp", price: 6250000, diary: "奈良公園でたくさんの鹿さんに囲まれたで！東大寺の大仏様はものすごく大きくて圧倒されちゃったわ。", bg: "bg_images/kinki/nara.webp", diaryImg: "diary_images/kinki/nara_d.webp", effectDesc: "自動増加 +1944もち/秒", tapBonus: 0, mpsBonus: 1944 },
            { name: "三重", pinX: 56.7, pinY: 61.4, distance: 58000000, item: "赤福", itemImg: "omiyage_images/kinki/mie_item.webp", price: 12500000, diary: "伊勢神宮にお参りして心がスッキリしたで。お昼に食べた豪華な伊勢エビは、身がぷりっぷりで甘くて感動したわ！", bg: "bg_images/kinki/mie.webp", diaryImg: "diary_images/kinki/mie_d.webp", effectDesc: "タップ力 +4167", tapBonus: 4167, mpsBonus: 0 },
            { name: "滋賀", pinX: 49.9, pinY: 57.9, distance: 100000000, item: "力餅", itemImg: "omiyage_images/kinki/shiga_item.webp", price: 25000000, diary: "日本最大の湖、琵琶湖にきたで！まるで海みたいに広くてびっくりしたわ。サクサクの近江牛メンチカツは肉汁たっぷりや！", bg: "bg_images/kinki/shiga.webp", diaryImg: "diary_images/kinki/shiga_d.webp", effectDesc: "自動増加 +8889もち/秒", tapBonus: 0, mpsBonus: 8889 },
            { name: "京都", pinX: 43.5, pinY: 57.4, distance: 180000000, item: "生八ツ橋", itemImg: "omiyage_images/kinki/kyoto_item.webp", price: 50000000, diary: "金閣寺がピカピカ輝いていて綺麗やったなあ。上品な宇治抹茶パフェを食べて、はんなり京都を満喫したで。", bg: "bg_images/kinki/kyoto.webp", diaryImg: "diary_images/kinki/kyoto_d.webp", effectDesc: "タップ力 +19444", tapBonus: 19444, mpsBonus: 0 },
            { name: "福井", pinX: 47.2, pinY: 55.2, distance: 320000000, item: "生チョコサンド", itemImg: "omiyage_images/chubu/fukui_item.webp", price: 100000000, diary: "中部地方の福井県やで！恐竜博物館で大きな骨を見てワクワクしたわ。冬の味覚、越前ガニは身がぎっしりで最高や！", bg: "bg_images/chubu/fukui.webp", diaryImg: "diary_images/chubu/fukui_d.webp", effectDesc: "自動増加 +41667もち/秒", tapBonus: 0, mpsBonus: 41667 },
            { name: "石川", pinX: 48.1, pinY: 51.0, distance: 580000000, item: "のどぐろ寿司", itemImg: "omiyage_images/chubu/ishikawa_item.webp", price: 200000000, diary: "金沢の兼六園をお散歩したで。綺麗に整えられたお庭やったわ。濃厚なルーの金沢カレーはカツオがのってて大満足や！", bg: "bg_images/chubu/ishikawa.webp", diaryImg: "diary_images/chubu/ishikawa_d.webp", effectDesc: "タップ力 +88889", tapBonus: 88889, mpsBonus: 0 },
            { name: "富山", pinX: 52.1, pinY: 50.0, distance: 1000000000, item: "ますの寿司", itemImg: "omiyage_images/chubu/toyama_item.webp", price: 375000000, diary: "立山連峰の雪景色がとっても美しかったで。富山ブラックラーメンは見た目が真っ黒だけど、コクがあってウマいわ！", bg: "bg_images/chubu/toyama.webp", diaryImg: "diary_images/chubu/toyama_d.webp", effectDesc: "自動増加 +194444もち/秒", tapBonus: 0, mpsBonus: 194444 },
            { name: "新潟", pinX: 59.5, pinY: 46.3, distance: 1800000000, item: "笹だんごパン", itemImg: "omiyage_images/chubu/niigata_item.webp", price: 750000000, diary: "お米どころ新潟県やで！一面の田んぼが綺麗やったなあ。笹の香りがふんわり香る笹だんごは、もちもちで餡子たっぷりや。", bg: "bg_images/chubu/niigata.webp", diaryImg: "diary_images/chubu/niigata_d.webp", effectDesc: "タップ力 +444444", tapBonus: 444444, mpsBonus: 0 },
            { name: "長野", pinX: 58.7, pinY: 51.0, distance: 3200000000, item: "信州リンゴパイ", itemImg: "omiyage_images/chubu/nagano_item.webp", price: 1500000000, diary: "信州の山々がすごく高くて空気がおいしいで！戸隠で食べた打ち立ての信州そばは、喉ごしが抜群やったわ。", bg: "bg_images/chubu/nagano.webp", diaryImg: "diary_images/chubu/nagano_d.webp", effectDesc: "自動増加 +888889もち/秒", tapBonus: 0, mpsBonus: 888889 },
            { name: "岐阜", pinX: 53.0, pinY: 53.8, distance: 5800000000, item: "フルーツ大福", itemImg: "omiyage_images/chubu/gifu_item.webp", price: 3000000000, diary: "白川郷の合掌造り集落へ行ったで。昔話の世界みたいで感動したわ。ジューシーな飛騨牛串焼きを食べてエネルギー満タンや！", bg: "bg_images/chubu/gifu.webp", diaryImg: "diary_images/chubu/gifu_d.webp", effectDesc: "タップ力 +1944444", tapBonus: 1944444, mpsBonus: 0 },
            { name: "愛知", pinX: 57.2, pinY: 58.3, distance: 10000000000, item: "ぴよりん", itemImg: "omiyage_images/chubu/aichi_item.webp", price: 3535533906, diary: "名古屋城の金のシャチホコが輝いていたで！スパイシーで甘辛い手羽先の唐揚げは、何本でも食べられちゃう味や！", bg: "bg_images/chubu/aichi.webp", diaryImg: "diary_images/chubu/aichi_d.webp", effectDesc: "自動増加 +1119930もち/秒", tapBonus: 0, mpsBonus: 1119930 },
            { name: "静岡", pinX: 61.4, pinY: 56.0, distance: 18000000000, item: "うなぎパイ", itemImg: "omiyage_images/chubu/shizuoka_item.webp", price: 4166666667, diary: "静岡からは富士山がとっても大きく見えたで！コシのある麺に削り粉がかかった富士宮やきそばは最高にウマいわ！", bg: "bg_images/chubu/shizuoka.webp", diaryImg: "diary_images/chubu/shizuoka_d.webp", effectDesc: "タップ力 +2449846", tapBonus: 2449846, mpsBonus: 0 },
            { name: "山梨", pinX: 60.8, pinY: 54.0, distance: 32000000000, item: "信玄餅", itemImg: "omiyage_images/chubu/yamanashi_item.webp", price: 8333333333, diary: "富士五湖の周りをのんびりお散歩したで。お夕飯に食べた具だくさんの熱々ほうとうは、お味噌の味が体に染みたわ。", bg: "bg_images/chubu/yamanashi.webp", diaryImg: "diary_images/chubu/yamanashi_d.webp", effectDesc: "自動増加 +1411023もち/秒", tapBonus: 0, mpsBonus: 1411023 },
            { name: "神奈川", pinX: 72.6, pinY: 57.2, distance: 58000000000, item: "アーモンドクッキー", itemImg: "omiyage_images/kanto/kanagawa_item.webp", price: 16666666667, diary: "関東地方に突入、神奈川県やで！横浜中華街の活気ある雰囲気にワクワクしたわ。肉汁たっぷりの特製シュウマイを食べたで。", bg: "bg_images/kanto/kanagawa.webp", diaryImg: "diary_images/kanto/kanagawa_d.webp", effectDesc: "タップ力 +3086613", tapBonus: 3086613, mpsBonus: 0 },
            { name: "東京", pinX: 70.9, pinY: 54.7, distance: 100000000000, item: "東京ばな奈", itemImg: "omiyage_images/kanto/tokyo_item.webp", price: 33333333333, diary: "日本の中心、大都会東京やで！東京タワーの展望台からの景色にびっくりしたわ。新鮮なネタの江戸前寿司を贅沢に味わったで。", bg: "bg_images/kanto/tokyo.webp", diaryImg: "diary_images/kanto/tokyo_d.webp", effectDesc: "自動増加 +1777778もち/秒", tapBonus: 0, mpsBonus: 1777778 },
            { name: "千葉", pinX: 77.1, pinY: 55.0, distance: 180000000000, item: "ピーナッツモナカ", itemImg: "omiyage_images/kanto/chiba_item.webp", price: 66666666667, diary: "千葉の九十九里浜で波の音を聞いたで。名産の落花生を使った可愛い最中は、香ばしくて優しい甘さやったわ。", bg: "bg_images/kanto/chiba.webp", diaryImg: "diary_images/kanto/chiba_d.webp", effectDesc: "タップ力 +3888889", tapBonus: 3888889, mpsBonus: 0 },
            { name: "埼玉", pinX: 67.9, pinY: 52.8, distance: 320000000000, item: "十万石まんじゅう", itemImg: "omiyage_images/kanto/saitama_item.webp", price: 125000000000, diary: "川越の小江戸の街並みをお散歩したで。お土産に買ったパリパリの草加せんべいは、お醤油の香りが香ばしいや！", bg: "bg_images/kanto/saitama.webp", diaryImg: "diary_images/kanto/saitama_d.webp", effectDesc: "自動増加 +8333333もち/秒", tapBonus: 0, mpsBonus: 8333333 },
            { name: "群馬", pinX: 64.5, pinY: 49.5, distance: 580000000000, item: "シュガーラスク", itemImg: "omiyage_images/kanto/gunma_item.webp", price: 250000000000, diary: "草津温泉の湯畑はすごい迫力やったで！濃厚な甘辛タレをつけて炭火で焼いた大きな焼きまんじゅう、フカフカで美味しいや！", bg: "bg_images/kanto/gunma.webp", diaryImg: "diary_images/kanto/gunma_d.webp", effectDesc: "タップ力 +17777778", tapBonus: 17777778, mpsBonus: 0 },
            { name: "栃木", pinX: 71.0, pinY: 50.0, distance: 1000000000000, item: "宇都宮餃子", itemImg: "omiyage_images/kanto/tochigi_item.webp", price: 500000000000, diary: "日光東照宮の「見ざる聞かざる言わざる」を見てきたで。宇都宮で食べた餃子は、皮がパリッと中はジューシーや！", bg: "bg_images/kanto/tochigi.webp", diaryImg: "diary_images/kanto/tochigi_d.webp", effectDesc: "自動増加 +38888889もち/秒", tapBonus: 0, mpsBonus: 38888889 },
            { name: "茨城", pinX: 74.8, pinY: 52.5, distance: 1800000000000, item: "メロンバウム", itemImg: "omiyage_images/kanto/ibaraki_item.webp", price: 1000000000000, diary: "ひたち海浜公園の一面のネモフィラ畑が綺麗やったなあ。ちょっと珍しい納豆わらび餅はネバもち不思議な食感や！", bg: "bg_images/kanto/ibaraki.webp", diaryImg: "diary_images/kanto/ibaraki_d.webp", effectDesc: "タップ力 +88888889", tapBonus: 88888889, mpsBonus: 0 },
            { name: "福島", pinX: 69.5, pinY: 45.5, distance: 3200000000000, item: "ままどおる", itemImg: "omiyage_images/tohoku_hokkaido/fushima_item.webp", price: 2083333333333, diary: "東北地方に突入、福島県やで！鶴ヶ城がどっしり格好よかったなあ。ちぢれ麺の喜多方ラーメンはスープがすっきりウマいや！", bg: "bg_images/tohoku_hokkaido/fushima.webp", diaryImg: "diary_images/tohoku_hokkaido/fushima_d.webp", effectDesc: "自動増加 +177777778もち/秒", tapBonus: 0, mpsBonus: 177777778 },
            { name: "宮城", pinX: 70.9, pinY: 40.1, distance: 5800000000000, item: "ずんだ喜久福", itemImg: "omiyage_images/tohoku_hokkaido/miyagi_item.webp", price: 4166666666667, diary: "仙台の伊達政宗公の像に挨拶してきたで。綺麗な緑色のずんだ餅は、枝豆の粒々と優しい甘さが最高や！", bg: "bg_images/tohoku_hokkaido/miyagi.webp", diaryImg: "diary_images/tohoku_hokkaido/miyagi_d.webp", effectDesc: "タップ力 +388888889", tapBonus: 388888889, mpsBonus: 0 },
            { name: "山形", pinX: 63.7, pinY: 41.5, distance: 10000000000000, item: "かりんとう饅頭", itemImg: "omiyage_images/tohoku_hokkaido/yamagata_item.webp", price: 8333333333333, diary: "蔵王のお釜のエメラルドグリーンの水面に感動したで。真っ赤に実った瑞々しいさくらんぼ、甘くてとっても贅沢や！", bg: "bg_images/tohoku_hokkaido/yamagata.webp", diaryImg: "diary_images/tohoku_hokkaido/yamagata_d.webp", effectDesc: "自動増加 +833333333もち/秒", tapBonus: 0, mpsBonus: 833333333 },
            { name: "秋田", pinX: 64.8, pinY: 37.0, distance: 18000000000000, item: "あんごま餅", itemImg: "omiyage_images/tohoku_hokkaido/akita_item.webp", price: 16666666666667, diary: "なまはげさんに遭遇してちょっとびっくりしちゃったで！熱々のきりたんぽ鍋は、お出しを吸ったお米が最高や！", bg: "bg_images/tohoku_hokkaido/akita.webp", diaryImg: "diary_images/tohoku_hokkaido/akita_d.webp", effectDesc: "タップ力 +1777777778", tapBonus: 1777777778, mpsBonus: 0 },
            { name: "岩手", pinX: 71.2, pinY: 34.7, distance: 32000000000000, item: "盛岡冷麺", itemImg: "omiyage_images/tohoku_hokkaido/iwate_item.webp", price: 33333333333333, diary: "中尊寺金色堂がキラキラでとっても厳かやったなあ。コシがものすごく強い盛岡冷麺は、ピリ辛スープでツルッと完食したで！", bg: "bg_images/tohoku_hokkaido/iwate.webp", diaryImg: "diary_images/tohoku_hokkaido/iwate_d.webp", effectDesc: "自動増加 +3888888889もち/秒", tapBonus: 0, mpsBonus: 3888888889 },
            { name: "青森", pinX: 67.0, pinY: 31.1, distance: 58000000000000, item: "気になるリンゴ", itemImg: "omiyage_images/tohoku_hokkaido/aomori_item.webp", price: 66666666666667, diary: "ねぶた祭りの迫力ある灯籠に大興奮したで！青森名物のリンゴがたっぷり入った焼き立てパイは、サクサクで甘酸っぱくて最高や！", bg: "bg_images/tohoku_hokkaido/aomori.webp", diaryImg: "diary_images/tohoku_hokkaido/aomori_d.webp", effectDesc: "タップ力 +17777777778", tapBonus: 17777777778, mpsBonus: 0 },
            { name: "北海道", pinX: 75.1, pinY: 19.6, distance: 100000000000000, item: "白い恋人", itemImg: "omiyage_images/tohoku_hokkaido/hokkaido_item.webp", price: 125000000000000, diary: "広大な北の大地、北海道やで！どこまでも真っ直ぐな道が続いてたなあ。特大のタラバガニは身がぷりぷりで美味しすぎてほっぺが落ちたわ！", bg: "bg_images/tohoku_hokkaido/hokkaido.webp", diaryImg: "diary_images/tohoku_hokkaido/hokkaido_d.webp", effectDesc: "自動増加 +16666666667もち/秒", tapBonus: 0, mpsBonus: 16666666667 },
            { name: "沖縄", pinX: 27.5, pinY: 87.7, distance: 250000000000000, item: "サーターアンダギー", itemImg: "omiyage_images/kyushu_okinawa/okinawa_item.webp", price: 333333333333333, diary: "感動のゴール沖縄やで！北の大地から南の楽園へワープや！青い海を見ながら最高の日本縦断旅を締めくくったで！", bg: "bg_images/kyushu_okinawa/okinawa.webp", diaryImg: "diary_images/kyushu_okinawa/okinawa_d.webp", effectDesc: "タップ力 +111111111111", tapBonus: 111111111111, mpsBonus: 0 }
        ];

        // ===================================================================
        // 👕 きせかえ（衣装）データ ― ここに1行足すだけで新しい衣装を追加できます
        // ===================================================================
        // id       : 半角英数字で他と被らないユニークな名前（保存データの管理に使われます）
        // name     : 倉庫・ショップに表示される衣装名
        // price    : ショップでの購入価格（もち）。0にすると最初から所持済み扱いになります
        // desc     : 倉庫・ショップに表示される説明文（能力の説明もここに書いてください）
        // img      : 【新規追加時はここに画像ファイル名を書くだけでOK】
        //            例: "img: 'ui_images/costume_ninja.webp'" のように書くと、その画像に着せ替わります。
        //            画像を用意しない場合はこの行を省略すれば、filterで色味だけ変える従来方式になります。
        // filter   : imgを指定しない場合の色味加工（CSSのfilter）。imgがある場合は無視されます。
        // tapBonus : 装備中、タップ力に加算される値
        // mpsBonus : 装備中、自動増加(もち/秒)に加算される値
        // ===================================================================
        const clothesData = [
            { id: "normal", name: "いつもの姿", price: 0, desc: "標準のもちすけスタイル", filter: "drop-shadow(0 10px 10px rgba(0,0,0,0.15))", tapBonus: 0, mpsBonus: 0 },
            { id: "happi", name: "お祭りはっぴ", price: 500, desc: "モチベーション全開！タップ力 +3", filter: "drop-shadow(0 10px 10px rgba(0,0,0,0.15)) hue-rotate(130deg) saturate(1.8)", tapBonus: 3, mpsBonus: 0 },
            { id: "crown", name: "王様の冠", price: 3000, desc: "気品溢れる姿。自動増加 +12もち/秒", filter: "drop-shadow(0 10px 10px rgba(0,0,0,0.15)) brightness(1.2) sepia(0.5) saturate(2.5)", tapBonus: 0, mpsBonus: 12 },
            { id: "ninja", name: "忍びの服", price: 15000, desc: "影からもち増産。タップ力+10 / 自動+40", filter: "drop-shadow(0 10px 10px rgba(0,0,0,0.15)) brightness(0.4) contrast(1.5)", tapBonus: 10, mpsBonus: 40 }
            // 👇 追加する時はこんな感じでコピペして書き換えてください（画像ありパターンの例）
            // , { id: "yukata", name: "浴衣すがた", price: 30000, img: "ui_images/costume_yukata.webp", desc: "夏祭り気分。タップ力+20 / 自動+80", tapBonus: 20, mpsBonus: 80 }
        ];

        // スキル総合コアシステムデータ
        // unlockStage: このステージ(0=鹿児島)に到達するとショップで購入できるようになる
        // unlockPrice: 初回獲得(Lv0→1)の価格 / lvPriceMult: Lvアップごとの価格倍率
        const PRESTIGE_SHOP_ITEMS = {
            offlineCap: { name: 'オフライン収益 上限+1時間', cost: 3, max: 8, step: 1, unit: '時間' },
            minigamePlays: { name: 'ミニゲーム 1日プレイ回数+1', cost: 5, max: 3, step: 1, unit: '回' },
            omiyagePriceDiscount: { name: 'おみやげ価格 -2%', cost: 4, max: 10, step: 2, unit: '%引き' },
            omiyagePriceCurve: { name: 'おみやげ値上がり率 -0.01', cost: 6, max: 5, step: 1, unit: '', desc: '（1.5倍→最大1.45倍まで緩やかに）' },
            startingBonus: { name: '初期タップ力・自動増加 +1', cost: 4, max: 10, step: 1, unit: '' },
            skillCdReduction: { name: 'スキル基本クールタイム -1秒', cost: 5, max: 5, step: 1, unit: '秒' },
            minigameReward: { name: 'ミニゲーム報酬 +5%', cost: 4, max: 10, step: 5, unit: '%' },
        };
        const dialogueData = {
            timeGreetings: {
                morning: [ // 5:00〜10:59
                    "おはよう！今日も一日頑張ろうな！",
                    "おはよう！朝ごはんもう食べたか？",
                    "んー、よう寝たわ！おはようさん！",
                    "おなかすいたなあ…朝ごはん食べようや！"
                ],
                noon: [ // 11:00〜16:59
                    "こんちゃ！お昼ごはん何食べた？",
                    "今日もええ天気やな！",
                    "お昼はもち食べてひと休みするで！",
                    "眠くなってきたわ…お昼寝したいなあ"
                ],
                evening: [ // 17:00〜21:59
                    "こんばんは！今日も一日お疲れさん！",
                    "そろそろ夕ごはんの時間ちゃう？",
                    "今日もいっぱいもち集めたで！"
                ],
                lateNight: [ // 22:00〜4:59
                    "こんな時間まで一緒におってくれるんか…嬉しいなあ！",
                    "夜更かしはほどほどにな！",
                    "もちすけは眠ないで…ふわぁ…"
                ]
            },

            // 同じ時間帯にすでに挨拶済みで、また戻ってきた時に喋る「おかえり」セリフ
            welcomeBack: {
                morning: ["おかえり！まだ朝やな！", "おかえりー！引き続き頑張ろうな！"],
                noon: ["おかえり！お昼からも頑張るで！", "おかえりー！"],
                evening: ["おかえり！夜も一緒に頑張ろうな！", "おかえりー！"],
                lateNight: ["おかえり…こんな時間まで一緒におってくれるんか…", "おかえりー！夜更かしはほどほどにな！"]
            },

            idleComments: [
                "画面をタップして もち集めような！",
                "もちすけと一緒に日本を旅しような！",
                "次はどこ行こうか？",
                "スキルも育てると効率アップするで！",
                "もちもち？",
                "おーい！",
                "旅を続けるで！",
                "寝てしまいそうや…"
            ],

            longPressComments: [
                "つぶれるぅ〜！",
                "ちょ、そんなに押さんといて〜！",
                "むぎゅーってなってもうた〜",
                "もちもち、伸びるやろ〜？",
                "そんなに押したら形変わってまうで〜"
            ],

            feedComments: [
                "○○うまい〜！パワー出てきたで！",
                "おおきに！○○、最高やな！",
                "もぐもぐ…○○ってこんな美味かったんか！",
                "○○食べたら元気百倍や！",
                "ん〜幸せの味やなあ、○○！"
            ],

            eventComments: {
                presentSpawn: ["プレゼント飛んでるで！はよキャッチや！", "何か飛んできたで！取ってみいや！"],
                goldMochiSpawn: ["黄金のもちが出たで！見逃すなよ！", "キラキラしたもちや！急げー！"],
                levelUp: ["レベルアップしたで！やったー！", "力がみなぎってきたわ！"],
                feverStart: ["フィーバータイムやー！！", "今がチャンスや、連打するで！"]
            },

            // 都道府県ごとのご当地限定セリフ（エリア到着時と、滞在中のつぶやきの両方で使われます）
            prefectureComments: {
                "鹿児島": ["桜島は今も噴煙を上げる活火山なんやで！", "スイートポテトはねっとり甘くて最高や！"],
                "宮崎": ["宮崎はマンゴーの生産量が有名なんや！", "南国ムード満点で気分ええなあ！"],
                "大分": ["大分は温泉の源泉数が日本一なんやで！", "地獄めぐりの温泉、迫力あったわ！"],
                "熊本": ["熊本城の石垣は『武者返し』って呼ばれとるんや！", "くまモンの故郷やなあ！"],
                "長崎": ["長崎は坂の街で、階段だらけなんや！", "夜景がとっても綺麗な街やで！"],
                "佐賀": ["佐賀の呼子は透明な活イカが名物なんや！", "有田焼という綺麗な焼き物も有名やで！"],
                "福岡": ["博多の屋台文化は日本でも珍しいんやで！", "とんこつラーメン発祥の地やで！"],
                "山口": ["山口は本州の一番西側にあるんや！", "下関のフグ料理は絶品やったなあ！"],
                "広島": ["厳島神社の鳥居は満潮時に海に浮かぶんやで！", "お好み焼きは広島風が本場やで！"],
                "島根": ["出雲大社は縁結びの神様として有名やで！", "神在月には全国の神様が集まるんや！"],
                "鳥取": ["鳥取砂丘は日本最大級の砂丘なんやで！", "スイカの名産地でもあるで！"],
                "岡山": ["岡山は『桃太郎伝説』発祥の地なんや！", "晴れの日が多い『晴れの国』やで！"],
                "香川": ["香川はうどん屋さんの数が日本一なんやで！", "面積は日本で一番小さい県やで！"],
                "徳島": ["阿波踊りは400年以上の歴史があるんやで！", "すだちの生産量、日本一やで！"],
                "高知": ["高知の桂浜は坂本龍馬の銅像があるんや！", "カツオのたたきは藁焼きが本場やで！"],
                "愛媛": ["愛媛はみかんの生産量トップクラスなんやで！", "道後温泉は日本最古の温泉の一つやで！"],
                "兵庫": ["神戸港はおしゃれな港町なんやで！", "姫路城は白鷺城とも呼ばれとるんや！"],
                "大阪": ["通天閣のビリケンさんは幸運の神様なんやで！", "『儲かりまっか』が挨拶らしいで！"],
                "和歌山": ["和歌山にはパンダがおる動物園があるんや！", "紀州梅の生産量、日本一やで！"],
                "奈良": ["奈良公園の鹿は約1000頭もおるんやで！", "東大寺の大仏は約15mもあるんや！"],
                "三重": ["伊勢神宮は日本人の心のふるさとなんやで！", "伊勢エビの水揚げ量トップクラスや！"],
                "滋賀": ["琵琶湖は日本一大きい湖なんやで！", "面積の約6分の1が琵琶湖なんや！"],
                "京都": ["金閣寺は金箔でピカピカなんやで！", "千年以上、都だった歴史ある街やで！"],
                "福井": ["福井は恐竜の化石がたくさん見つかるんやで！", "越前ガニは冬の味覚の王様やで！"],
                "石川": ["兼六園は日本三名園のひとつなんやで！", "金沢は金箔の生産量ほぼ100%やで！"],
                "富山": ["立山連峰の雪景色は絶景なんやで！", "ホタルイカが名物なんや！"],
                "新潟": ["新潟はお米の生産量トップクラスなんやで！", "日本酒の蔵元がとっても多い県やで！"],
                "長野": ["長野は標高の高い山がたくさんあるんやで！", "信州そばはのど越し抜群やで！"],
                "岐阜": ["白川郷の合掌造りは世界遺産なんやで！", "飛騨牛はとろけるほど美味いんや！"],
                "愛知": ["名古屋城の金のシャチホコは有名なんやで！", "手羽先発祥の地とも言われとるで！"],
                "静岡": ["富士山の景色は静岡側からも綺麗なんやで！", "お茶の生産量、日本一やで！"],
                "山梨": ["富士五湖でのんびり過ごせるんやで！", "ぶどうと桃の生産量が有名なんや！"],
                "神奈川": ["横浜中華街は日本最大の中華街なんやで！", "みなとみらいの夜景は綺麗やで！"],
                "東京": ["東京スカイツリーの高さは634mもあるんやで！", "東京タワーは333mもあるんや！"],
                "千葉": ["九十九里浜は総延長66kmもあるんやで！", "落花生の生産量、日本一やで！"],
                "埼玉": ["川越は『小江戸』と呼ばれとるんや！", "草加せんべいは香ばしくて美味いんやで！"],
                "群馬": ["草津温泉の湯畑は迫力満点なんやで！", "だるまの生産量、日本一やで！"],
                "栃木": ["日光東照宮には『三猿』の彫刻があるんやで！", "餃子の消費量が有名な街やで！"],
                "茨城": ["納豆の生産で有名な県なんや！", "偕楽園は日本三名園のひとつやで！"],
                "福島": ["福島は果物の宝庫なんやで！", "会津の街並みは歴史を感じるなあ！"],
                "宮城": ["仙台は『杜の都』と呼ばれとるんや！", "牛タンが名物料理やで！"],
                "山形": ["さくらんぼの生産量、日本一なんやで！", "蔵王の樹氷は幻想的やなあ！"],
                "秋田": ["秋田美人という言葉があるくらいなんや！", "なまはげは有名な伝統行事やで！"],
                "岩手": ["岩手は面積が北海道の次に広いんやで！", "わんこそばに挑戦してみたいなあ！"],
                "青森": ["青森はりんごの生産量、日本一なんやで！", "ねぶた祭りは迫力満点らしいで！"],
                "北海道": ["北海道は日本で一番広い都道府県なんやで！", "冬はとっても雪が積もるらしいで！"],
                "沖縄": ["沖縄の海は透明度がとっても高いんやで！", "旅もいよいよ最終地点や！"]
            }
        };

        // ランダムに配列から1つ取り出すヘルパー
        const TUTORIAL_STEPS = [
            { text: 'ワイと一緒に、日本を鹿児島から沖縄まで縦断する旅に出よう！', highlight: null, duration: 4000 },
            { text: '画面のワイをタップすると、もちが増えていくで。', highlight: null, duration: 3800 },
            { text: '連打するとコンボも伸びていくで！', highlight: null, duration: 3500 },
            { text: '「移動する」ボタンで、ものおき・ショップ・絵日記・ゲーセンなどに行けるで。', highlight: 'nav-btn-move', duration: 4600 },
            { text: 'ショップで、おみやげを買おう。「タップ力アップ」と「自動増加」の2種類があるで！', highlight: 'nav-btn-move', duration: 4600 },
            { text: '「きせかえ」ボタンから、ワイの服や帽子を着せ替えられるで！', highlight: 'nav-btn-kisekae', duration: 4200 },
            { text: 'ランキングで、みんなの記録と競い合えるで！', highlight: 'nav-btn-ranking', duration: 4000 },
            { text: 'ここから地図を開いて、好きな都道府県に飛べるで。', highlight: 'map-toggle-btn', duration: 4500 },
            { text: 'ここから設定やメニューを触れるで。', highlight: 'menu-toggle-btn', duration: 4000 },
            { text: 'ここを押すと、写真を撮る時とかにすっきり表示できるで。', highlight: 'ui-toggle-btn', duration: 4200 },
            { text: 'ここから、ワイにお土産をあげられるで！', highlight: 'feed-toggle-btn', duration: 4500 },
            { text: 'さあ、日本一周の旅に出発や！応援してるで！', highlight: null, duration: 3500 },
        ];
        const SFX_FILES = ['audio/tap.mp3', 'audio/move.mp3', 'audio/critical.mp3', 'audio/gold_mochi.mp3', 'audio/skill_tap.mp3', 'audio/ready.mp3', 'audio/levelup.mp3', 'audio/page_turn.mp3', 'audio/balloon_pop.mp3', 'audio/mochi_eat.mp3', 'audio/mochi_scream.mp3', 'audio/mochi_stretch.mp3', 'audio/japan_clear.mp3', 'audio/stamp.mp3', 'audio/talk_pop.mp3', 'audio/gacha_crank.mp3', 'audio/gacha_drop.mp3', 'audio/gacha_open.mp3'];
        const cheerLines = {
            0: ["もちもちやろ？", "その調子や！", "ええ感じやで！", "もちすけ嬉しいわ！", "いいペースやな！", "もっともっと！", "楽しなってきたな！"],
            50: ["50コンボ突破や！", "頑張れ！", "やるやないか！", "その勢いええで！", "もっといけるやろ！", "ノリノリやな！", "ええ調子やで！"],
            100: ["100コンボ達成や！", "目指せ500コンボ！", "もちすけ興奮してきたで！", "まだまだいけるで！", "止まるな、そのままや！", "すごい勢いやな！"],
            500: [
                "500コンボや、すごいで！", "1000コンボで称号もらえるで！", "あと少しで伝説やな！", "もちすけ叫びそうや！",
                "限界突破していこか！", "ここまで来たら行くしかない！", "指、大丈夫か！？", "もう職人の域やで！",
                "もちすけもついていくのやっとや！", "この勢い、誰にも止められへん！", "伝説まであと一歩やで！",
                "もちすけの記録更新中や！", "腕、疲れてへんか！？", "見てるこっちも興奮するで！",
                "もう化け物やん！", "もちすけびっくりしすぎて言葉出えへん！", "殿堂入り確定やな！"
            ],
            1000: [
                "1000コンボや！！伝説やで！！", "もちすけ、感動しとるで！", "君はもちマスターや！", "ここまでよう頑張ったな！",
                "もう人間の域超えてるやろ！", "もちすけ、一生ついていきます！", "これ以上の景色、見たことないで！",
                "殿堂入りどころか神やで！", "もちすけ、涙出てきたわ…！", "この記録、誰にも破れへんやろ！",
                "もちすけ界の伝説になったな！", "ありがとう、ここまで一緒に来てくれて！"
            ]
        };
        const comboEndLines = ["ナイスタップ！", "おつかれやで！", "ええコンボやったな！", "また続けような！", "もちもち楽しかったわ！", "ようやったで！"];

        // 🎁 ノーマル（灰）で出る消耗品アイテム一覧
        const NORMAL_CONSUMABLE_ITEMS = [
            { id: 'minigameTicket', name: 'ミニゲーム追加券', img: 'ui_images/item_minigame_ticket.webp', desc: '4種すべての今日の残り回数+1' },
            { id: 'cooldownTicket', name: 'スキルクールタイム短縮チケット', img: 'ui_images/item_cooldown_ticket.webp', desc: '全スキルのクールタイムを即リセット' },
            { id: 'mochi30minTicket', name: 'もち30分ぶんチケット', img: 'ui_images/item_mochi30min_ticket.webp', desc: '今の自動増加×30分ぶんのもちを獲得' },
        ];

        const GACHA_RARITIES = [
            { id: 'normal',      label: 'ノーマル',     weight: 90,  filter: 'grayscale(0.7) brightness(0.95)',                              color: '#9e9e9e', desc: '消耗品（ミニゲーム追加券・スキルクールタイム短縮チケット・もち30分ぶんチケット）',
              flair: { flash: 0.2, glow: 0, vibrate: [10, 15], nameScale: 1.0, rays: false } }, // 灰
            { id: 'normalRare',  label: 'ノーマルレア',  weight: 5.9, filter: 'sepia(0.4) saturate(2.5) hue-rotate(60deg) brightness(1.05)',   color: '#4caf50', desc: '上位の消耗品、または一時的な見た目エフェクト',
              flair: { flash: 0.3, glow: 25, vibrate: [10, 15, 10, 15], nameScale: 1.1, rays: false } }, // 緑
            { id: 'rare',        label: 'レア',        weight: 3,   filter: 'sepia(0.4) saturate(3) hue-rotate(170deg) brightness(1.05)',    color: '#2196f3', desc: 'シンプルな服・帽子・アクセサリー',
              flair: { flash: 0.4, glow: 40, vibrate: [15, 20, 15, 20], nameScale: 1.2, rays: true } }, // 青
            { id: 'sr',          label: 'スーパーレア',  weight: 1,   filter: 'sepia(0.6) saturate(3) hue-rotate(230deg) brightness(1.05)',    color: '#9c27b0', desc: '良い感じの服・帽子・アクセサリー',
              flair: { flash: 0.55, glow: 60, vibrate: [20, 25, 20, 25, 20], nameScale: 1.35, rays: true } }, // 紫
            { id: 'ur',          label: 'ウルトラレア',  weight: 0.1, filter: 'saturate(3) hue-rotate(0deg)',                                  color: '#ff6ec7', desc: '最上位ランクの服・帽子・アクセサリー',
              flair: { flash: 0.7, glow: 90, vibrate: [25, 30, 25, 30, 25, 40], nameScale: 1.55, rays: true } }, // 虹（後でグラデ演出に差し替え予定）
        ];
        const OMIYAGE_ROWS = [
            { itemTop: 20.2, itemBottom: 34.0, plateTop: 34.5, plateBottom: 37.7 },
            { itemTop: 38.1, itemBottom: 50.9, plateTop: 51.2, plateBottom: 54.1 },
            { itemTop: 54.8, itemBottom: 67.6, plateTop: 68.0, plateBottom: 71.2 }
        ];
        const OMIYAGE_COLS = [
            { left: 9.2,  right: 35.2 },
            { left: 36.6, right: 61.9 },
            { left: 63.7, right: 89.7 }
        ];
        const feedTeaseComments = ["ちょうだい！", "まだ〜？", "はやくよこせ！"];
        const FEED_TEASE_MAX_LEVEL = feedTeaseComments.length; // これ以上は毎回叫ぶだけになる

        // ===================================================================
        // 👗 着せ替え部屋：帽子・顔パーツ・服の3カテゴリ（あつまれどうぶつの森を参考にした一覧選択式）
        // 帽子・顔パーツは、もちすけの上に重ねる「単体パーツ」画像で、位置・大きさを個別に調整する。
        // 服だけは、もちすけ全身を着せ替えた状態の完成イラストをそのまま使う（座標調整は不要）。
        // ===================================================================
        const KISEKAE_ITEMS = {
            hat: [
                { id: 'hat_crown_red',      name: '王冠（赤）',        star: 3, img: 'ui_images/kisekae_hat_crown_red.webp',      top: -29.732141, left: 19.459458, width: 53.513519, height: 41.339299, locked: true },
                { id: 'hat_crown_blue',     name: '王冠（青）',        star: 3, img: 'ui_images/kisekae_hat_crown_blue.webp',     top: -29.732141, left: 19.459458, width: 53.513519, height: 41.339299, locked: true },
                { id: 'hat_pirate',         name: '海賊の帽子',        star: 2, img: 'ui_images/kisekae_hat_pirate.webp',        top: -20.35714,  left: 12.43243,  width: 69.189207, height: 29.732147, locked: true },
                { id: 'hat_kabuto',         name: 'カブト',            star: 2, img: 'ui_images/kisekae_hat_kabuto.webp',        top: -30.291262, left: -6.470588,  width: 111.176476, height: 81.504865,  locked: true },
                { id: 'hat_wizard',         name: '魔法使いの帽子',    star: 2, img: 'ui_images/kisekae_hat_wizard.webp',        top: -28.839283, left: 16.216211, width: 59.459471, height: 39.107151, locked: true },
                { id: 'hat_baby',           name: '赤ん帽',            star: 2, img: 'ui_images/kisekae_hat_baby.webp',          top: -30.291263, left: -42.941172, width: 181.17647,  height: 135.873805, locked: true },
                { id: 'hat_santa',          name: 'サンタの帽子',      star: 2, img: 'ui_images/kisekae_hat_santa.webp',         top: -23.928569, left: 26.486484, width: 41.081091, height: 31.517859, locked: true },
                { id: 'hat_chef',           name: 'コック帽',          star: 1, img: 'ui_images/kisekae_hat_chef.webp',          top: -22.142849, left: 24.864866, width: 42.162169, height: 29.285719, locked: true },
                { id: 'hat_tophat_black',   name: 'シルクハット（黒）', star: 1, img: 'ui_images/kisekae_hat_tophat_black.webp',  top: -17.67857,  left: 23.243241, width: 44.324333, height: 26.607146, locked: true },
                { id: 'hat_ribbon',         name: 'リボン',            star: 1, img: 'ui_images/kisekae_hat_ribbon.webp',        top: -11.875006, left: 25.945935, width: 41.621629, height: 22.58929,  locked: true },
                { id: 'hat_graduate',       name: '学士の帽子',        star: 1, img: 'ui_images/kisekae_hat_graduate.webp',      top: -17.232144, left: 21.621614, width: 49.729738, height: 35.982146, locked: true },
            ],
            face: [
                { id: 'face_sunglasses',    name: 'サングラス',        star: 1, img: 'ui_images/kisekae_face_sunglasses.webp',   top: -3.392867, left: -14.972971, width: 124.000039, height: 41.464299, rotation: -5, locked: true },
                { id: 'face_glasses_black', name: '黒縁メガネ',        star: 1, img: 'ui_images/kisekae_face_glasses_black.webp', top: -0.267859,  left: -23.081076, width: 141.837891, height: 35.2143,   rotation: -5, locked: true },
                { id: 'face_3dglasses',     name: '3Dメガネ',          star: 1, img: 'ui_images/kisekae_face_3dglasses.webp',    top: -6.07144,   left: -15.513525, width: 124.000023, height: 48.160733, rotation: -5, locked: true },
            ],
            clothes: [
                { id: 'clothes_mochisuke_tshirt', name: 'もちすけTシャツ', star: 1, img: 'ui_images/image_0.webp' },
                { id: 'clothes_king_red',    name: 'おうさまの服（赤）', star: 3, img: 'ui_images/kisekae_clothes_king_red.webp', mouthOverride: { top: 36.986245, left: 49.623821, width: 17 } },
                { id: 'clothes_king_blue',   name: 'おうさまの服（青）', star: 3, img: 'ui_images/kisekae_clothes_king_blue.webp' },
                { id: 'clothes_tshirt_red',   name: 'Tシャツ（赤）',    star: 1, img: 'ui_images/kisekae_clothes_tshirt_red.webp' },
                { id: 'clothes_tshirt_white', name: 'Tシャツ（白）',    star: 1, img: 'ui_images/kisekae_clothes_tshirt_white.webp' },
                { id: 'clothes_tshirt_blue',  name: 'Tシャツ（青）',    star: 1, img: 'ui_images/kisekae_clothes_tshirt_blue.webp' },
                { id: 'clothes_tshirt_green', name: 'Tシャツ（緑）',    star: 1, img: 'ui_images/kisekae_clothes_tshirt_green.webp' },
                { id: 'clothes_apron',        name: 'エプロン',         star: 1, img: 'ui_images/kisekae_clothes_apron.webp', mouthOverride: { top: 36.986245, left: 49.623821, width: 17 } },
            ],
        };
        const KISEKAE_CATEGORY_LABELS = { hat: '帽子', face: '顔パーツ', clothes: '服' };
        const DEFAULT_MOUTH_POSITION = { top: 36.986245, left: 48.44735, width: 17 }; // 服の指定が無い時（初期衣装含む）はこちら

        // ===================================================================
        // 💼 おしごとミッション：序盤の1本道チュートリアル → デイリー → ウィークリー、の3段階
        // 進捗は trackKey に対応するカウンター(missionCounters)を見て判定する
        // ===================================================================
        const TUTORIAL_MISSIONS = [
            { id: 'tut_tap10', text: '10回タップしよう！', trackKey: 'totalTaps', target: 10, reward: 5 },
            { id: 'tut_buy_omiyage', text: 'ショップでおみやげを買おう！', trackKey: 'omiyageBoughtTotal', target: 1, reward: 5 },
            { id: 'tut_minigame', text: 'ミニゲームを1回遊ぼう！', trackKey: 'minigamesPlayedTotal', target: 1, reward: 10 },
        ];
        const DAILY_MISSION_POOL = [
            { id: 'daily_login', text: 'ログインする', trackKey: 'loginToday', target: 1, reward: 3 },
            { id: 'daily_tap100', text: '100回タップする', trackKey: 'tapsToday', target: 100, reward: 5 },
            { id: 'daily_minigame1', text: 'ミニゲームを1回遊ぶ', trackKey: 'minigamesToday', target: 1, reward: 5 },
            { id: 'daily_buy1', text: 'おみやげを1つ買う', trackKey: 'omiyageBoughtToday', target: 1, reward: 5 },
            { id: 'daily_gacha1', text: 'ガチャ・スロットを1回まわす', trackKey: 'gachaSpinsToday', target: 1, reward: 5 },
        ];
        const WEEKLY_MISSION_POOL = [
            { id: 'weekly_login3', text: '3日ログインする', trackKey: 'loginDaysThisWeek', target: 3, reward: 15 },
            { id: 'weekly_stamp3', text: '都道府県を3つ制覇する', trackKey: 'stampsThisWeek', target: 3, reward: 20 },
            { id: 'weekly_jackpot', text: 'スロットで大当たりを出す', trackKey: 'jackpotsThisWeek', target: 1, reward: 25 },
            { id: 'weekly_tap500', text: '合計500回タップする', trackKey: 'tapsThisWeek', target: 500, reward: 15 },
        ];
        const DAILY_MISSION_COUNT = 3; // 毎日、プールの中からこの数だけランダムに選ばれる
        const WEEKLY_MISSION_COUNT = 2;

        // ===================================================================
        // 🚶 移動画面：家4つ・看板4つ・戻る看板1つの座標（すべて#move-menu-stage基準の%指定）
        // ===================================================================
        const MOVE_MENU_PARTS = [
            { id: 'move-house-warehouse', label: '家（ものおき）',     top: 52, left: 8,  width: 38, height: 26 },
            { id: 'move-sign-warehouse',  label: '看板（ものおき）',   top: 46, left: 16, width: 20, height: 10 },
            { id: 'move-house-shop',      label: '家（ショップ）',     top: 36, left: 55, width: 38, height: 26 },
            { id: 'move-sign-shop',       label: '看板（ショップ）',   top: 30, left: 63, width: 20, height: 10 },
            { id: 'move-house-arcade',    label: '家（ゲーセン）',     top: 18, left: 8,  width: 38, height: 26 },
            { id: 'move-sign-arcade',     label: '看板（ゲーセン）',   top: 12, left: 16, width: 20, height: 10 },
            { id: 'move-house-myroom',    label: '家（マイルーム）',   top: 2,  left: 55, width: 38, height: 26 },
            { id: 'move-sign-myroom',     label: '看板（マイルーム）', top: -4, left: 63, width: 20, height: 10 },
            { id: 'move-sign-return',     label: '戻る看板',           top: 74, left: 34, width: 24, height: 12 },
        ];

        // ===================================================================
        // 🎮 ゲーセン：5つの筐体イラストの座標（#minigame-tile-view基準の%指定）
        // ===================================================================
        const ARCADE_CABINET_PARTS = [
            { id: 'arcade-cabinet-quiz',          gameId: 'quiz',          img: 'ui_images/arcade_quiz.webp',          top: 8,  left: 4,  width: 44, height: 38 },
            { id: 'arcade-cabinet-timeattack',    gameId: 'timeattack',    img: 'ui_images/arcade_timeattack.webp',    top: 8,  left: 52, width: 44, height: 38 },
            { id: 'arcade-cabinet-concentration', gameId: 'concentration', img: 'ui_images/arcade_concentration.webp', top: 50, left: 4,  width: 44, height: 38 },
            { id: 'arcade-cabinet-mochitsuki',    gameId: 'mochitsuki',    img: 'ui_images/arcade_mochitsuki.webp',    top: 50, left: 52, width: 44, height: 38 },
            { id: 'arcade-cabinet-slot',          gameId: 'slot',          img: 'ui_images/arcade_slot.webp',          top: 30, left: 28, width: 44, height: 38 },
        ];

        // ===================================================================
        // 📦 ものおき：4つの小物イラストの座標（#warehouse-item-stage基準の%指定）
        // ===================================================================
        const WAREHOUSE_ITEM_PARTS = [
            { id: 'warehouse-item-trophy',  label: 'トロフィー',   action: 'trophy',  img: 'ui_images/warehouse_trophy.webp',  top: 8,  left: 6,  width: 40, height: 34 },
            { id: 'warehouse-item-omiyage', label: 'おみやげ',     action: 'omiyage', img: 'ui_images/warehouse_omiyage.webp', top: 8,  left: 54, width: 40, height: 34 },
            { id: 'warehouse-item-ticket',  label: 'アイテム一覧', action: 'ticket',  img: 'ui_images/warehouse_ticket.webp',  top: 52, left: 6,  width: 40, height: 34 },
            { id: 'warehouse-item-diary',   label: '絵日記',       action: 'diary',   img: 'ui_images/warehouse_diary.webp',   top: 52, left: 54, width: 40, height: 34 },
        ];
