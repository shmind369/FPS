# FPS

スマートフォンのブラウザで遊べるFPSプロトタイプです。Three.js製で、ビルド不要・単純なHTTPサーバーで動作します。

## プレイ用URL

https://shmind369.github.io/FPS/

## 遊び方

```sh
python3 -m http.server 8080
```

上記コマンドを実行し、スマホやPCのブラウザで `http://<ホストのIP>:8080` を開いてください。

- 画面左半分: 仮想スティックで移動
- 画面右半分: ドラッグで視点(カメラ)操作
- 右下の FIRE ボタン: 画面中央のクロスヘアに向けて発射し、赤いターゲットに当てるとスコア加算
- PCではキャンバスをクリックしてポインターロック後、WASD+マウスでも操作可能

## 構成

- `index.html`: エントリーポイント、HUD・タッチ操作UIのレイアウト
- `css/style.css`: HUD・仮想スティック等のスタイル
- `js/main.js`: Three.jsによるシーン構築、移動/視点/射撃ロジック
- `js/vendor/three.module.js`: three.js本体(CDN不要でオフラインでも動作するように同梱)

## 操作対策メモ

タッチ操作ボタン(FIREボタン等)は `touch-action: none` を指定し、iOS Safariの連続タップによるズーム表示を防いでいます。
