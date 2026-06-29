# インテリアコーディネーター過去問道場

提供されたPDFをOCRで抽出し、一問一答形式で学べる静的サイトです。

## ローカル確認

```bash
cd 15_Personal_Projects/interior-coordinator-dojo
./start_local.sh
```

`http://localhost:8000` を開くと確認できます。

ポートを変える場合:

```bash
./start_local.sh 8123
```

## データ再生成

1. `tmp/pdfs/full/upper` と `tmp/pdfs/full/lower` にレンダリング済み画像を配置
2. OCRを実行

```bash
python3 scripts/run_ocr_batches.py data/raw/all-pages-ocr.json tmp/pdfs/full/upper/*.jpg tmp/pdfs/full/lower/*.jpg
```

3. 問題JSONを生成

```bash
python3 scripts/build_questions.py data/raw/all-pages-ocr.json data/questions.json
```

## 公開

GitHub Pages向けの静的ファイル構成です。`main` ブランチのルートを Pages 配信元に設定すると公開できます。

注意:
GitHub Pages は公開URLを知っていれば誰でも閲覧できる静的公開に向いています。真のアクセス制限や「招待された人だけ」の制御が必要な場合は、別ホスティングや認証付き配信を使ってください。
