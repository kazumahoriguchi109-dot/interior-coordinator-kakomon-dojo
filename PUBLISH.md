# GitHub公開手順

このプロジェクトは静的サイトなので、GitHub Pages でそのまま公開できます。

## 1. リポジトリを作成して push

```bash
cd 15_Personal_Projects/interior-coordinator-dojo
gh repo create kazumahoriguchi109-dot/interior-coordinator-kakomon-dojo \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Static one-question-at-a-time study site for interior coordinator past questions"
```

## 2. GitHub Pages を main ブランチのルートで有効化

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/kazumahoriguchi109-dot/interior-coordinator-kakomon-dojo/pages \
  -f source[branch]=main \
  -f source[path]=/
```

## 3. 公開URLを確認

通常は以下のURLになります。

```text
https://kazumahoriguchi109-dot.github.io/interior-coordinator-kakomon-dojo/
```

## 注意

- GitHub Pages は「URLを知っていれば見られる公開サイト」です。
- 真のアクセス制御はありません。リンク共有ベースの運用はできますが、非公開配布ではありません。
- 公開前に、PDF由来コンテンツの利用許諾と公開可否を必ず確認してください。
