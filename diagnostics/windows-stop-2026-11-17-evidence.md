# Windows停止・修正用証拠（2026-11-17）

関連: [停止診断メモ](windows-stop-2026-11-17.md)

この資料は公開ブランチに置くため、物件一覧JSON、ログインCookie、PCユーザー名、アカウントID、Chromeプロファイル、検索条件を含めていません。診断時に読み取った情報であり、再開やリセットは行っていません。

## 実行環境と同定
- `app-version.json`: `2026.11.05.1` / `stable`
- 同梱ランタイムのQA記録: Node.js `24.18.0`、Python `3.14.6`
- ローカルサーバー `127.0.0.1:8765`、専用Chrome CDP `127.0.0.1:9222`、ブリッジ `127.0.0.1:9223`。調査時は3ポートとも待ち受け中。
- Chromeタブ: システム、リアプロ検索結果、いい生活物件一覧が残っていた。これだけでは個々のタブが応答可能だった証明にはならない。

## 停止時の進行状態（`GET /api/capture-progress`）
```json
{
  "status": "error",
  "phase": "error",
  "label": "取得に失敗",
  "startedAt": "2026-11-16T23:08:49.853Z",
  "updatedAt": "2026-11-16T23:09:53.782Z",
  "startPage": 1,
  "currentPage": 18,
  "totalPages": 20,
  "rooms": 423,
  "realproRooms": 423,
  "eSeikatsuRows": 0,
  "currentDetails": 0,
  "totalDetails": 0,
  "judged": 0,
  "candidates": 0,
  "message": "専用Chromeの評価に失敗しました: Chrome CDP request timed out: Runtime.evaluate (response)"
}
```

UTC日時はJSTで開始08:08:49、最終更新08:09:53。423戸は**進行表示の値**であり、当日ファイルへの保存確認ではない。

## ブリッジのエラーログ（機微情報なし・原文）
```jsonl
{"time":"2026-11-16T22:21:22.415Z","stage":"command-response","outcome":"evaluation-error","method":"Runtime.evaluate"}
{"time":"2026-11-16T22:22:33.298Z","stage":"command-response","outcome":"timeout","method":"Runtime.evaluate"}
{"time":"2026-11-16T22:31:26.733Z","stage":"command-response","outcome":"timeout","method":"Runtime.evaluate"}
{"time":"2026-11-16T22:43:16.460Z","stage":"command-response","outcome":"timeout","method":"Runtime.evaluate"}
{"time":"2026-11-16T22:58:37.967Z","stage":"command-response","outcome":"evaluation-error","method":"Runtime.evaluate"}
{"time":"2026-11-16T22:59:58.666Z","stage":"command-response","outcome":"timeout","method":"Runtime.evaluate"}
{"time":"2026-11-16T23:08:48.322Z","stage":"command-response","outcome":"evaluation-error","method":"Runtime.evaluate"}
{"time":"2026-11-16T23:09:53.723Z","stage":"command-response","outcome":"timeout","method":"Runtime.evaluate"}
```
ログには対象タブID、ホスト、操作名、処理時間がないため、応答しなかった根本理由の特定は不可。

## ファイル状態
- `data/chrome_capture.json`: 最終更新 2026-11-16 08:12:39 JST
- `data/realpro_chunk_cache.json`: 最終更新 2026-11-16 08:01:38 JST
- `data/eseikatsu_full_cache.json`: 最終更新 2026-11-16 07:55:02 JST
- したがって2026-11-17の一覧423戸と18ページ目が永続保存されたとは確認できない。前日データを当日完了として扱わないこと。

## インストール済みコードの照合情報
開発元で同一版か確認するためのSHA-256（ソース全文は公開していない）:
- `automation/chrome_bridge.mjs`: `E7161DB2EDE03D380DF06D83F249D99D440525497EA26CD4AE57CDDFA127E629`
- `automation/capture_chrome_mac.py`: `F4536AE4EF539EEA52F9C787FB4A90FA9E98D9CB0925880543F14120F6806713`
- `automation/server.mjs`: `49930094593BD19791A15292341BBA6C168F52764179FF92B5CFEA258902E775`

関係する実装位置:
- `chrome_bridge.mjs:37-66` `cdpRequest`: WebSocketでCDP要求を送り、既定30,000msで応答タイムアウト。`(response)` はWebSocket接続後にCDP応答が来なかったことを意味する。
- `chrome_bridge.mjs:235-264` `evaluate`: 対象タブを選び、`Runtime.evaluate` を `awaitPromise: true` で実行。
- `chrome_bridge.mjs:268-287` `evaluateWithReadRetry`: 読み取り専用で対象タブIDと期待ホストがある場合のみ、`document.readyState` を3秒で確認して1回再試行。
- `capture_chrome_mac.py:669` `capture_realpro_parallel_pages`: リアプロ一覧の最大2ページ並列取得。
- `capture_chrome_mac.py:926-945` `capture_realpro_dom_rooms`: 並列取得失敗時の扱い。`capture_details=false` では例外を上げ、同関数内の逐次方式へは切り替えない。
- `server.mjs:2799-2860` `runRealproChunkCapture`: 未取得ページの選択。`server.mjs:2930-2970` はチャンク結果の検証・マージ。失敗時に進行表示だけが残っていないか要確認。

## 調査・修正の焦点
1. 次回のタイムアウト時、タブIDを秘密情報を含まない短縮値で、ホスト・操作名・ページ番号・CDP送信から応答までの時間と一緒に記録する。
2. `Runtime.evaluate` 内の `awaitPromise` が完了しないのか、Chrome rendererが応答しないのか、ブリッジのWebSocket受信が止まるのか切り分ける。画面タブが存在するだけでは健全性を判定しない。
3. `capture_details=false` の一覧取得でタイムアウト後にどの範囲が保存済みか確認し、再開時は未保存ページを再取得する。進行表示423戸を保存済みと決めつけない。
4. 修正版のWindows実機で20ページ取得から詳細・いい生活照合・CSVまで通し、データ欠落や重複がないことを検証する。
