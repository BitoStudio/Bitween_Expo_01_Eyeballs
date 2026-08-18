# Bitween Expo Eyeballs — 實作計畫

多台裝置同時開啟本網站放在使用者面前，每台各自用自己的鏡頭抓臉，
畫面上所有卡片的眼睛都轉向同一個人 → 「被很多雙眼睛盯著」。

---

## 0. 假設與待確認（會影響工時，先講）

| # | 項目 | 目前假設 | 需確認 |
|---|------|---------|--------|
| A | 裝置之間 | **各自獨立、不連線、無後端**。每台自己開前鏡頭抓臉，天然同步（看同一個人） | ✅ 已確認 |
| B | `girl` 素材 | `girl_eye.png` 已經把黑色瞳孔和粉色虹膜畫死了，`girl_ball.png` 只有一個 **白色反光點**（30×30） | ✅ 美術重切中：`eye` 只留眼白＋外框，`ball` 放粉色虹膜＋黑瞳。新素材丟回 `Assets/2_girl/` 後跑 `npm run prep` 即自動重新量測與驗證 |
| D | 卡片數量 | 5 種樣式 × 重複排列，桌機一屏約 12–20 張 | 是否要更多背景圖？目前只有 5 張 bg |
| E | 眼睛位置 | 每張卡片一雙眼睛，位置寫在設定檔（非亂數），避免蓋到文字 | 是否有指定版位，或由我先產一版再微調 |
| F | 部署 | 靜態站，Vercel / Netlify / GitHub Pages（**必須 HTTPS**，否則沒有鏡頭權限） | 展場網路環境？若無外網要準備區網 HTTPS（自簽憑證在 iOS 上會擋，建議走外網） |

**區網測試**：`npm run dev` 綁 `0.0.0.0:5273`，同網段裝置用 `http://<本機IP>:5273` 就看得到。
但 `getUserMedia` 只存在於 secure context，走 http 時相機會直接消失、降級成滑鼠模式。
要測相機用 `npm run dev:lan`（自簽憑證，`https://<本機IP>:5273`）：
Android Chrome 與桌機點過警告即可；**iOS Safari 需要到「設定 → 一般 → 關於本機 → 憑證信任設定」信任該憑證**，
不然點過警告仍然拿不到相機。實機驗收建議直接部署一版到外網 HTTPS。

---

## 1. 技術選型

| 需求 | 選擇 | 理由 |
|------|------|------|
| 框架 | **Vite + 原生 TS**，無 UI framework | 全站是一個捲動列表＋一堆 transform，React 只會多一層 diff 成本 |
| 臉部偵測 | **`@mediapipe/tasks-vision` → FaceDetector（BlazeFace short-range）** | 唯一穩定跨瀏覽器方案。只要 bbox，不需要 468 點 landmark。原生 `FaceDetector` API 只有 Chrome 實驗旗標，不能用 |
| 捲動 | **原生 CSS overflow / scroll-snap**，不用 Lenis / Swiper | 原生慣性在手機上手感最好，也最省。桌機四欄用 `columns: 4` 直接得到 masonry＋整排一起動 |
| 動畫 | `transform: translate3d()` + rAF | 只動合成層屬性 |
| 相依總數 | **2 個**（vite、tasks-vision） | |

**Bundle 預估**：JS < 60KB gzip，WASM + 偵測模型約 1.5MB（首載一次、可 cache）。

---

## 2. 檔案結構

```
/
├─ index.html
├─ vite.config.ts
├─ Assets/                    # 原始素材（不動）
├─ public/
│  ├─ styles/{bito,girl,cool,simpson,sponge}/{eye,ball,bg}.png
│  └─ models/blaze_face_short_range.tflite
├─ scripts/
│  └─ prep-assets.mjs         # Assets/ → public/styles/，順便量測幾何
├─ src/
│  ├─ main.ts                 # 啟動、權限閘門、組裝
│  ├─ data/
│  │  ├─ styles.ts            # 每種樣式的眼睛幾何（見 §3）
│  │  └─ cards.ts             # 卡片清單：用哪張 bg、眼睛擺哪
│  ├─ face/
│  │  ├─ camera.ts            # getUserMedia + 前鏡頭 + 鏡像
│  │  ├─ detector.ts          # MediaPipe 包裝，輸出 normalized 臉中心
│  │  └─ target.ts            # 平滑 + fallback（滑鼠 / 自動游移）
│  ├─ eyes/
│  │  ├─ Eye.ts               # 單顆眼睛：算方向、夾限、寫 transform
│  │  └─ registry.ts          # 全部眼睛的 rAF 更新迴圈 + 視窗內過濾
│  ├─ layout/
│  │  ├─ feed.ts              # 建卡片 DOM、無限循環
│  │  └─ layout.css           # 三種斷點版型
│  └─ styles/global.css
└─ PLAN.md
```

---

## 3. 資料模型：每種樣式的眼睛幾何

`eye.png` 與 `ball.png` 同尺寸、同座標系，**但 ball 的原始位置是美術隨手畫的注視姿勢，不是置中**，
所以不能用「相對原位移動」，必須用設定檔指定眼窩中心與可動半徑。

下表是我從素材量出來的初始值（百分比相對於 eye 畫布），**travel 是需要人工微調的旋鈕**：

```ts
// src/data/styles.ts
export const STYLES = {
  bito:    { size:[94,67],   socket:[49.5,50.0], travel:[26,9]  },
  girl:    { size:[96,119],  socket:[60.4,49.6], travel:[14,26] }, // ⚠ 見 §0-B
  cool:    { size:[117,84],  socket:[49.1,49.4], travel:[28,22] },
  simpson: { size:[130,130], socket:[49.6,49.6], travel:[31,31] },
  sponge:  { size:[155,186], socket:[49.7,57.8], travel:[20,17] },
} as const
// socket = 眼白區域中心；travel = 瞳孔可移動的半徑（已量測值 ×0.8 留安全邊）
```

DOM 每顆眼睛：

```html
<div class="eye" style="--w:94px">
  <img class="eye__sclera" src="/styles/bito/eye.png">
  <img class="eye__ball"   src="/styles/bito/ball.png">  <!-- position:absolute，靠 transform 定位 -->
</div>
```

`ball` 用 `transform: translate(-50%,-50%) translate3d(x,y,0)`，
起始點是 `socket`，不是圖檔原本的位置 → 需要在 CSS 裡把 ball 的定位錨點改成它自己 bbox 的中心
（`prep-assets.mjs` 會把 ball 裁切成緊貼 bbox 的小圖，這樣錨點就是圖片中心，最省事）。

---

## 4. 核心機制

### 4.1 相機與臉部偵測

```
getUserMedia({ video:{ facingMode:'user', width:640 } })
  → <video muted playsinline autoplay> 全螢幕 object-fit:cover 當背景
  → CSS transform: scaleX(-1) 鏡像（自拍視角）
  → FaceDetector.detectForVideo() 以 ~15Hz 執行（不必 60Hz）
  → 取最大的一張臉（多人時＝最靠近的人）
  → 輸出 normalized 臉中心 {nx, ny} ∈ [0,1]
```

偵測頻率與繪製頻率**解耦**：偵測 15Hz、繪製 60Hz，中間用 lerp 補間，
既省 CPU 又不會抖（`smoothed += (target - smoothed) * 0.15`）。

### 4.2 注視數學（含「瞳孔不出眼眶」）

臉的 normalized 座標 → 螢幕座標（要處理 `object-fit:cover` 的裁切比例）：

```ts
// video 以 cover 填滿螢幕時的實際縮放與偏移
const scale = Math.max(vw / video.videoWidth, vh / video.videoHeight)
const faceX = (1 - nx) * video.videoWidth * scale - offsetX  // (1-nx) = 鏡像
const faceY = ny * video.videoHeight * scale - offsetY
```

每顆眼睛：

```ts
const dx = faceX - eyeCenterX
const dy = faceY - eyeCenterY
const d  = Math.hypot(dx, dy) || 1
// 距離越近位移越小，超過 FALLOFF 就吃滿 → 遠處的臉不會讓瞳孔抖
const k  = Math.min(d / FALLOFF, 1)          // FALLOFF ≈ 400px
const px = (dx / d) * travelX * k             // travelX/Y 為橢圓半徑
const py = (dy / d) * travelY * k
```

**夾限保證**：位移量本身就是 `方向單位向量 × travel`，`|k| ≤ 1`，
所以位移永遠落在以 socket 為中心、`travelX × travelY` 的橢圓內 → 瞳孔數學上不可能超出。
travel 值只要調到「橢圓內切於眼白」即可，這是唯一要人工看畫面調的參數。

> 保險絲（若某個樣式眼白形狀太怪）：`.eye__ball { -webkit-mask-image: url(eye.png); mask-size: 100% 100%; }`
> 用眼白的 alpha 直接裁掉溢出部分，一行 CSS。預設不開。

### 4.3 三種版型與捲動

| 裝置 | 斷點 | 版型 | 捲動 |
|------|------|------|------|
| 手機 | `< 768px` | 一列橫向卡片 | `overflow-x:auto` + `scroll-snap-type: x mandatory` |
| 平板 | `768–1279px` | 單欄直向 | 原生垂直捲動 |
| 桌機 | `≥ 1280px` | `columns: 4` masonry | 原生垂直捲動 → **四欄天然一起上下移動** |

桌機四欄不需要任何 JS：`columns:4; column-gap:16px` + 卡片 `break-inside:avoid`，
瀏覽器自動排出參差不齊的 masonry（就是你設計圖 1 的樣子），整頁捲動時四欄一起動。

**無限循環**（展場長時間展示不能捲到底）：
`IntersectionObserver` 監看倒數第 3 張，觸發時把前 N 張 clone 到尾端。
手機橫向同理。不用 virtual list，卡片數量級太小（< 100）。

### 4.4 效能

- 只更新視窗內的眼睛：`IntersectionObserver` 標記 `isVisible`，registry 迴圈跳過不可見的。
- 眼睛座標用 `getBoundingClientRect()` 會很貴 → **捲動時不重算**，改用「卡片的 offsetTop + 眼睛在卡內的相對位置 − scrollTop」自己算，只在 resize 時重建快取。
- 所有位移走 `translate3d`，眼睛容器加 `will-change: transform`（僅可見者）。
- 目標：60fps @ 桌機 40 顆眼睛、iPhone 12 以上 60fps / 20 顆眼睛。

### 4.5 展場韌性（不能省）

| 情境 | 處理 |
|------|------|
| iOS 需要使用者手勢才能開鏡頭 | 開場一張全螢幕「點擊開始」封面，點了才 `getUserMedia()` |
| 鏡頭被拒絕 / 沒鏡頭 | 降級：桌機跟滑鼠，行動裝置改「緩慢自動游移」的假注視，畫面不能開天窗 |
| 偵測不到臉超過 2 秒 | 眼睛平滑回到正前方（socket 中心），而不是卡在最後位置 |
| 螢幕自動休眠 | Wake Lock API（`navigator.wakeLock.request('screen')`），visibilitychange 時重新取得 |
| 分頁被切走再回來 | 暫停偵測迴圈、回來時重啟；video 可能被暫停要 `play()` |
| 記憶體 / 長時間跑 | clone 卡片時同步移除頭部超出的節點，避免無限增長 |

---

## 5. 實作階段

> 每個 Phase 都可獨立驗收，順序即依賴順序。

### Phase 0 — 專案初始化 ✅ 已完成
- Vite + vanilla TS 手動建置（跳過 template 的範例檔），`.gitignore`
- `scripts/prep-assets.mjs`：`Assets/*/` → `public/styles/<slug>/{eye,ball,bg}.png`，
  ball 裁切成緊貼 bbox 的小圖 → 錨點即圖片中心
- **溢出檢查內建在 prep 裡**：沿 travel 橢圓取 72 個角度，逐像素比對
  「ball 不透明 且 eye 透明」的數量，非 0 就中斷建置。
  `--selftest` 用合成素材反向驗證這個檢查抓得到問題（放大 2 倍 travel 必須報錯）
- 幾何輸出改成 `src/data/styles.generated.ts`（`as const`），型別自動是 tuple，
  `src/data/styles.ts` 不需要任何 cast；Phase 2 的手調值也放這個檔
- ✅ 驗收結果：五種樣式溢出皆為 0；`tsc --noEmit` 與 `vite build` 通過；
  瀏覽器實測五組 eye/ball 圖片載入正常、ball 尺寸與裁切後 PNG 一致
- 備註：slug 由資料夾名自動推導（`1_BitoStyle` → `bitostyle`），新增樣式只要丟資料夾

### Phase 1 — 靜態版型 ✅ 已完成
- `Eye.ts`：`createEye()` / `createEyePair()`；眼睛尺寸只吃一個 `--eye-w`（單位 `cqw`），
  卡片是 container，所以眼睛跟著卡片縮放，不需要任何 JS 重算
- **鏡像只翻眼白**，同時把 socket 的 x 換成 `100 - x`；瞳孔精靈維持在螢幕座標系，
  Phase 2 就能對所有眼睛寫同一個位移值，不必為鏡像眼處理正負號
- `cards.ts`：16 張手排卡片。眼睛位置依各背景的留白區手動指定（避開文字），
  背景與眼睛樣式刻意交叉搭配以增加變化
- 捲動：手機由 `.feed` 橫向捲（scroll-snap x mandatory），平板與桌機交給整頁垂直捲動
  — multicol 一旦被限制高度就會往「橫向」溢位，所以桌機的捲動必須留在 page 上
- ✅ 驗收結果（實測 320 / 375 / 768 / 1024 / 1440 / 1920）：
  - 六個寬度皆無非預期溢出，捲動軸向正確（手機橫、平板直、桌機直）
  - 桌機四欄實測欄位左緣 `24 / 372 / 721 / 1069`，捲動時左緣完全不變 → 四欄同步上下
  - 32 顆眼睛的瞳孔皆位於眼睛框內；每一對眼睛的 socket 位置和為 100% → 鏡像正確
- 已知待調（Phase 5 打磨）：手機卡片高度約佔視窗 46%，其餘留白之後是相機畫面，
  實機看過再決定要不要放大

### Phase 2 — 眼睛引擎 ✅ 已完成
- `gaze.ts`：純函式 `gazeOffset()`，方向單位向量 × travel 橢圓半徑 × 距離衰減。
  `gaze.selftest.ts` 用 `node` 直接跑，證明任何角度、任何距離都不超出橢圓
- `registry.ts`：單一 rAF 迴圈驅動全部瞳孔
  - 位置快取在 **document 座標**，每幀只減去當下捲動量 → **捲動不觸發任何 layout 讀取**
  - 注視向量從 **socket** 出發（不是眼睛方框中心），girl 這種眼窩偏一邊的樣式才會對
  - `IntersectionObserver` 只更新畫面內的眼睛；`ResizeObserver` 在版型變動時才重建快取
  - 目標值做 lerp 平滑（0.15/幀）— Phase 3 的臉部偵測只有 15Hz，靠這個補成 60fps
- `?debug=1` 面板：即時調每個樣式的 travel、顯示夾限橢圓、FPS，
  按一下複製 `TRAVEL_OVERRIDES` 貼回 `styles.ts`。**動態 import，不進正式 bundle**
- 目前注視目標是滑鼠；Phase 3 只需改成餵臉部座標進 `registry.setTarget()`
- ✅ 驗收結果（1440×900，四個捲動位置 × 八個滑鼠方位 = 1024 次取樣）：
  - **1024 次取樣中，沒有任何一顆瞳孔的位移超出它的 travel 半徑**（x 或 y 皆然）
  - 五種樣式全部涵蓋並確實在動；瞳孔方向左/右/下皆正確跟隨
  - 60fps、無 console 錯誤；正式 bundle 6.71kB（gzip 2.85kB）
  - 殘差說明：CSS 變數寫到小數 5 位，橢圓比值最多超出 7.3e-5（約 0.0005px），
    純粹是字串量化，數學本身由 selftest 證明為精確
- `npm test` 現在會跑 prep-assets 與 gaze 兩個 selftest，且已接進 `npm run build`

### Phase 3 — 鏡頭與臉部偵測 ⚠️ 程式完成，待實機驗收
- `camera.ts`：前鏡頭 640×480，全螢幕 `object-fit: cover` + `scaleX(-1)` 當背景
- `detector.ts`：MediaPipe FaceDetector（BlazeFace short-range），
  GPU delegate 失敗自動退回 CPU；多人時取**面積最大**的臉（＝最靠近的人）
- `mapping.ts`：cover 座標換算 + 鏡像，純函式，`mapping.selftest.ts` 用四種
  裝置比例驗證「中心對中心、兩軸都覆蓋、鏡像只翻 x 不動 y」
- `track.ts`：15Hz 偵測 → `registry.setTarget()`，60fps 由 registry 補間
- **WASM 與模型都自架**（`public/wasm/` 由 prep 從 node_modules 複製，
  `.tflite` 直接進版控）→ 展場不依賴 CDN、不依賴 build 時有網路
- 失去臉超過 2 秒 → `releaseTarget()`，gain 平滑降到 0，瞳孔回正前方
- ✅ 已驗證（無相機環境下可測的部分）：
  - 三個 runtime 檔案都正確服務（模型 224KB / wasm 11.5MB / js 316KB）
  - 偵測器初始化 186ms；首次推論 1221ms（graph 暖機），之後 **4–7ms/幀**，
    15Hz 下約佔單核 10%
  - 相機被拒 → 記錄警告、保留滑鼠來源、面板顯示「無相機 · 跟隨滑鼠」，不會開天窗
  - `releaseTarget()` 後約 40 幀回到靜止（殘留 0.0005 眼框 ≈ 0.05px，
    是 EPSILON 跳寫門檻造成的，不累積）
- ❌ **尚未驗證，需要實機**：真人臉的偵測與「眼睛是否真的指向房間裡的人」。
  瀏覽器分頁擋鏡頭，這一條必須拿實體裝置跑過才算通過
- 待辦：wasm 未壓縮 11.5MB，正式主機務必開 gzip/brotli（實際傳輸約 3–4MB，只有首載）

### Phase 4 — 展場韌性 ✅ 已完成（FPS 待實機）
- **不做點擊開始封面**（依需求）：載入完直接開始。相機被拒仍降級為滑鼠來源
- `scroll.ts`：Lenis 接管垂直捲動，指數衰減的慣性曲線（`LERP = 0.075`）。
  手機橫向維持原生觸控慣性 + scroll-snap — 觸控本來就有物理，接管只會打架
- `infinite: true` 捲不到底；卡片序列重複 4 次（64 張）於啟動時一次建好，
  **執行中不 append**，避免 multicol 反覆重排
- 每個 repeat 旋轉序列，否則 multicol 會讓桌機四欄拿到一模一樣的卡片
- `kiosk.ts`：Wake Lock，分頁切回來時重新取得（瀏覽器在隱藏時會釋放）。
  失敗只警告一次，不洗版
- `track.ts`：分頁切回來時若 video 被暫停就重新播放
- **桌機四欄交錯方向**（需求修正）：欄 0/2 往一邊、欄 1/3 往另一邊。
  這種動法沒辦法掛在單一原生捲軸上，所以桌機改成：
  - `columns.ts` 用 JS 分四欄取代 CSS multicol（multicol 無法單獨位移某一欄）
  - 每欄拿卡片清單的不同起點切 8 張，各放兩份 → 每欄週期 = 8 張卡的高度
  - `wrap.ts` 是純數學（無相依，可直接跑 node）：`columnOffset()` 把累積位移
    摺回 `[0, period)`，繞回時因為內容週期性所以看不出接縫
  - `drift.ts` 一個輸入流 → 一個帶慣性的數值 → 每欄乘上自己的方向並取模
  - 同一份 DOM 給三種版型：1280px 以下用 `display: contents` 把欄框溶掉，
    卡片自動流回單一列表 → 換斷點不需要重建 DOM
  - registry 每幀讀取各欄的即時位移量修正快取位置（transform 的位移用
    快取的 rect 看不到）
- ✅ 已驗證：
  - `wrap.selftest.ts`：四欄方向交錯；位移永遠落在 `[0, period)`（含深度負值）；
    每過一個週期回到完全相同的位置；跨接縫連續，不會出現大於輸入量的跳動
  - 四欄卡片序列互不相同；每欄週期 2955px > 視窗 900px；每欄內容 5910px
    = 恰好兩個週期，繞滿一圈後底下還有 2055px → 接縫不可能露出空隙
  - 手機橫向 54 個畫面寬、snap 正常、未被接管
- ❌ **未驗證**：實際的動態表現與 FPS。開發用的瀏覽器窗格不合成畫面，
  rAF 被凍住，量到的位移永遠是 0。**這段必須在真的瀏覽器裡看過**

### Phase 5 — 打磨與多機驗證（1d）
- 眼睛位置版位微調、travel 逐一手調、卡片配色節奏
- 三台以上實機（手機 / 平板 / 桌機）同時放在人前，確認「同時盯著同一個人」的效果
- ✅ 驗收：拍一段實景影片作為交付

**總計約 5.5 人日**（不含美術重切 `girl` 素材）。

---

## 6. 最終驗收清單

- [ ] 瞳孔不出眼眶 —— **`cool` 除外**。美術指定瞳孔偏高且極限角度會超出眼白，
      已在 `eye-tuning.ts` 用 `allowOverflow: true` 明確標記。其餘四種必須為 0 溢出
- [ ] 手機左右滑、平板上下滑、桌機四欄同步上下滑
- [ ] 前鏡頭畫面為背景且左右鏡像正確（舉右手，畫面中的手也在右邊）
- [ ] 多台裝置同時對同一人，視線方向一致
- [ ] 拒絕鏡頭權限時仍有可展示的降級行為
- [ ] 連續執行 30 分鐘不掉幀、不休眠、不捲到底
- [ ] Lighthouse Performance ≥ 85（行動裝置）
