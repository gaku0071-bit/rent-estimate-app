物件候補リスト作成システム 配布更新

Windows版: 2026.10.20.6
Mac版: 2026.09.24.1（変更なし）
配布先: GitHub property-list-updates ブランチ
更新通知URL:
https://raw.githubusercontent.com/gaku0071-bit/rent-estimate-app/property-list-updates/update-manifest.json

Windowsの更新はアプリ内の通知、または以下のEXEで上書きします。
https://raw.githubusercontent.com/gaku0071-bit/rent-estimate-app/property-list-updates/downloads/property-list-automation-windows-2026.10.20.6.exe

リアプロ詳細取得でタブ切断後の再接続と対象IDの再試行を改善しました。
途中停止時の再開ページ数と失敗内容の表示を改善しました。
旧版の自動更新からNSIS版インストーラーへ移行できるよう、旧起動引数との互換性を確認しました。
手動インストール時は完了画面で起動を選択できます。
取得データ・CSV・履歴・Chromeログイン情報は同梱せず、通常の上書き更新で保持します。
本PCで旧版の更新引数による実インストールと起動を確認済みです。
別PCでの実インストールとログイン後の実取得は未確認です。

詳細: windows-release-2026.10.20.6.md
整合性確認: checksums.txt
