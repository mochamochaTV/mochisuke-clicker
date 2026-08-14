"""
punicker 画像一括圧縮スクリプト
=================================
使い方：
  1. Pythonがインストールされていない場合は https://www.python.org/ からインストール
  2. ターミナル(コマンドプロンプト)で以下を実行して、必要なライブラリを入れる
       pip install Pillow
  3. このファイルを、index.htmlがあるフォルダ（bg_images等のフォルダと同じ階層）に置く
  4. ターミナルでそのフォルダに移動して、以下を実行する

       # PNGのまま、ファイルサイズだけ軽くしたい場合（安全・画質完全に同じ）
       python compress_images.py --mode optimize

       # WebPに変換して、大きく圧縮したい場合（画質はほぼ変わらないが、コード側の.png参照も
       # .webpに書き換える必要あり。書き換えたい場合はClaudeに聞いてください）
       python compress_images.py --mode webp

  実行前に、必ず元のフォルダをバックアップ（コピー）しておくことをおすすめします。
"""

import os
import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillowがインストールされていません。次のコマンドを実行してください：")
    print("  pip install Pillow")
    sys.exit(1)

# 対象にするフォルダ・ファイル（プロジェクトの構成に合わせて調整してください）
TARGET_DIRS = ["bg_images", "omiyage_images", "diary_images", "ui_images"]
TARGET_FILES = []


def find_all_pngs():
    files = []
    for d in TARGET_DIRS:
        if os.path.isdir(d):
            for path in Path(d).rglob("*.png"):
                files.append(str(path))
    for f in TARGET_FILES:
        if os.path.isfile(f):
            files.append(f)
    return files


def compress_optimize(files):
    total_before, total_after = 0, 0
    for f in files:
        before = os.path.getsize(f)
        img = Image.open(f)
        img.save(f, optimize=True)
        after = os.path.getsize(f)
        total_before += before
        total_after += after
        print(f"  {f}: {before//1024}KB → {after//1024}KB")
    return total_before, total_after


def compress_webp(files):
    total_before, total_after = 0, 0
    for f in files:
        before = os.path.getsize(f)
        img = Image.open(f)
        webp_path = os.path.splitext(f)[0] + ".webp"
        img.save(webp_path, "WEBP", quality=85)
        after = os.path.getsize(webp_path)
        total_before += before
        total_after += after
        print(f"  {f} → {webp_path}: {before//1024}KB → {after//1024}KB")
    print("\n※ 元の.pngファイルはそのまま残っています。動作確認できたら手動で削除してください。")
    print("※ index.html側の画像パスを .png → .webp に書き換える必要があります。")
    return total_before, total_after


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["optimize", "webp"], default="optimize")
    args = parser.parse_args()

    files = find_all_pngs()
    if not files:
        print("対象のPNGファイルが見つかりませんでした。このスクリプトをindex.htmlと同じ場所に置いているか確認してください。")
        return

    print(f"{len(files)}個のファイルが見つかりました。圧縮を開始します（モード: {args.mode}）...\n")

    if args.mode == "optimize":
        before, after = compress_optimize(files)
    else:
        before, after = compress_webp(files)

    print(f"\n合計: {before/1024/1024:.1f}MB → {after/1024/1024:.1f}MB "
          f"（{(1 - after/before)*100:.0f}%削減）")


if __name__ == "__main__":
    main()
