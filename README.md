# インテリアコーディネーター過去問道場

インテリアコーディネーター試験の過去問を、一問一答形式で学べる静的サイトです。

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

## 問題データの更新

1. 元データを更新

```bash
python3 scripts/run_ocr_batches.py data/raw/all-pages-ocr.json tmp/pdfs/full/upper/*.jpg tmp/pdfs/full/lower/*.jpg
```

2. 問題JSONを生成

```bash
python3 scripts/build_questions.py data/raw/all-pages-ocr.json data/questions.json
```

3. 文面を整形

```bash
python3 scripts/clean_questions.py
```

## 公開

GitHub Pages向けの静的ファイル構成です。`main` ブランチのルートを Pages 配信元に設定すると公開できます。
