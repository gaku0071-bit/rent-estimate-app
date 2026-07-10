物件候補リスト作成システム サーバー公開用フォルダ

バージョン: 2026.07.05.1
作成日: 2026-07-10T09:28:56.823Z
公開準備: OK
想定URL: https://raw.githubusercontent.com/gaku0071-bit/rent-estimate-app/property-list-updates
導入ページ: https://gaku0071-bit.github.io/rent-estimate-app/
manifest: update-manifest.json

アップロード方法:

1. このフォルダ内のファイルをサーバーの公開ディレクトリへアップロードします。
2. downloads フォルダもそのままアップロードします。
3. 公開後、次のURLをブラウザで確認します。
   https://gaku0071-bit.github.io/rent-estimate-app/
4. 更新通知用URLを確認します。
   https://raw.githubusercontent.com/gaku0071-bit/rent-estimate-app/property-list-updates/update-manifest.json
5. 各PCで更新サーバーURLを設定します。
   npm run update:set-url -- --url=https://raw.githubusercontent.com/gaku0071-bit/rent-estimate-app/property-list-updates/update-manifest.json

注意:

- update-manifest.json があるため、アップデート通知用として公開できます。
- 実務データ、CSV、バックアップ、Chromeログイン情報は含めていません。
