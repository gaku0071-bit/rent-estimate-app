物件候補リスト作成システム サーバー公開用フォルダ

バージョン: 2026.09.24.1
作成日: 2026-09-24T03:17:01.779Z
公開準備: OK
想定URL: https://example.com
導入ページ: https://example.com/index.html
manifest: update-manifest.json

アップロード方法:

1. このフォルダ内のファイルをサーバーの公開ディレクトリへアップロードします。
2. downloads フォルダもそのままアップロードします。
3. 公開後、次のURLをブラウザで確認します。
   https://example.com/index.html
4. 更新通知用URLを確認します。
   https://example.com/update-manifest.json
5. 各PCで更新サーバーURLを設定します。
   npm run update:set-url -- --url=https://example.com/update-manifest.json

注意:

- update-manifest.json があるため、アップデート通知用として公開できます。
- 実務データ、CSV、バックアップ、Chromeログイン情報は含めていません。
