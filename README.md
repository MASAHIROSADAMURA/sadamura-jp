# sadamura.jp — Personal Academic Website

Astro implementation of Masahiro Sadamura's personal research website.
Designed to honor [Tomoya Mukai's site](https://mukait.fool.jp/) (4 pillars +
top, black/white typography) while quietly strengthening responsive layout,
SEO, accessibility, i18n (ja / en / zh-CN), and CI.

- **Build source (papers)**: `data/papers.bib` がビルド正本（`npm run bib` で `src/data/papers.json` を生成）。
- 設計資料・原稿・運用メモは公開リポジトリの外で管理している。

## Quick start

```bash
npm install
npm run bib        # data/papers.bib → src/data/papers.json
npm run dev        # http://localhost:4321
npm run build      # outputs to ./dist
npm run preview    # serve ./dist locally
npm run check      # astro check (TypeScript + Astro)
npm run preflight  # bib + check + build sanity check before push
```

Node 22 LTS or newer（`package.json` の `engines.node` は `>=22`、CI も Node 22）.

## Folder layout

```
03_実装/
├── astro.config.mjs          ← Astro 5.x, i18n (ja default, /en prefix), sitemap (404 除外)
├── package.json              ← scripts: dev / build / preview / bib / check / preflight
├── tsconfig.json             ← strict + path aliases (@components, @layouts, ...)
├── .github/workflows/deploy.yml ← GitHub Pages 自動デプロイ (Node 22)
├── data/
│   └── papers.bib            ← BibTeX ビルド正本（38 entries）※04 はミラー
├── public/
│   ├── CNAME                 ← sadamura.jp (custom domain)
│   ├── favicon.svg / favicon.ico       ← MS モノグラム（svg + 16/32/48 ico）
│   ├── apple-touch-icon.svg / .png     ← 180×180
│   ├── og.svg / og.png                 ← 1200×630 OGP 画像
│   ├── manifest.webmanifest            ← PWA マニフェスト
│   ├── robots.txt            ← opt out of AI training crawlers
│   └── files/                ← 添付 PDF 等（受賞ページ資料）
├── scripts/
│   ├── bib2json.mjs          ← data/papers.bib → src/data/papers.json
│   ├── preflight.mjs         ← push 前ローカル検証（bib / check / build）
│   ├── setup_github.ps1      ← gh でリポジトリ作成 + Pages 設定（半自動）
│   ├── setup_uptimerobot.ps1 ← 死活監視モニタ登録（半自動）
│   └── check_dns.ps1         ← 公開前 DNS 伝播チェック
└── src/
    ├── content/config.ts     ← `papers` collection (file loader, zod schema)
    ├── data/papers.json      ← generated; .gitignored
    ├── i18n/                 ← ja.json / en.json / index.ts
    ├── styles/global.css     ← 独自デザイン（藍アクセント + UDフォント）+ ダーク + a11y
    ├── layouts/BaseLayout.astro
    ├── components/
    │   ├── Header.astro      ← brand + Nav + LangSwitch
    │   ├── Nav.astro         ← 4 柱 (profile / publications / resources / contact)
    │   ├── LangSwitch.astro  ← JA ⇄ EN
    │   ├── Footer.astro      ← CC BY-NC-SA + RSS + about
    │   ├── SEO.astro         ← OGP / Twitter / JSON-LD (Person / WebSite / Breadcrumb)
    │   └── PaperEntry.astro  ← 1 引用エントリ（フィルタ用 data-attr 込）
    ├── data/zh-guide.ts      ← /zh/guide 記事メタの正本（title/headline/description/keywords）
    └── pages/                ← 全 29 ページ（JA / EN / ZH-CN）
        ├── index.astro       ← 日本語デフォルト
        ├── profile.astro
        ├── publications.astro    ← 3 軸フィルタ（type/year/topic）
        ├── resources.astro
        ├── contact.astro
        ├── about.astro
        ├── services.astro    ← 有償サービス（Service JSON-LD 付き）
        ├── legal.astro       ← 特定商取引法に基づく表記・プライバシーポリシー（JA のみ）
        ├── lab/r8-tanto.astro
        ├── 404.astro
        ├── rss.xml.ts        ← RSS フィード（JA のみ）
        ├── en/               ← 英語版（index / profile / publications / resources / contact / about / services / lab / 404）
        └── zh/               ← 簡体字版（index / profile / services / contact + guide ハブ + 記事 5 本）
```

> `/legal` は JA のみ。EN / ZH のフッタからも同ページへリンクし、ZH の `/zh/services`
> には取引条件の要点を中国語で併記している（2026-08-01 裁定）。

## How content flows

```
researchmap (source of truth)
    │
    ▼ manual export
03_実装/data/papers.bib                          ← BibTeX ビルド正本, 38 entries
    │                                              (04_コンテンツ原稿/_共通/papers.bib は同期ミラー)
    ▼ npm run bib  (scripts/bib2json.mjs)
03_実装/src/data/papers.json                     ← Astro Content Layer fixture（生成物・.gitignored）
    │
    ▼ getCollection('papers')  (src/content/config.ts)
publications.astro / en/publications.astro       ← rendered 3-axis filter list
```

業績を増やしたいときは `data/papers.bib` に entry を 1 つ足して `git commit && push`
するだけで、GitHub Actions が `bib → json → build → Pages` を回します。

## Design rules (2026-07-23 独自アイデンティティへ移行)

当初は向井 HP（黒白 2 色・ヒラギノ優先・黒地白文字 h2）を踏襲していたが、**2026-07-23
に独自デザインへ移行**した。移行後の規律は以下。

- **Pages**: 4 柱 (profile / publications / resources / contact) + top を核に、about・404・services・legal・lab を加えた構成。JA / EN / ZH-CN の 3 言語で **計 29 ページ**。むやみに増設しない方針は維持
- **Colors**: 白黒基調 + **アクセント 1 色＝藍 `#165e83`**（light。dark は `#7fb3d3`）。藍はリンク・見出しアクセント（h1 縦棒 / h2 下線）・現在地/選択状態・focus リング・検証ラボのチップのみ。多色化はしない
- **Fonts**: 本文＝**UD デジタル教科書体**優先（無ければ **BIZ UDPGothic** に自動フォールバック）。見出し・ナビ・表＝**BIZ UDPGothic** のゴシック固定。Web フォントは **BIZ UDPGothic 400/700 のみ Google Fonts から読込**（`display=swap` + preconnect。旧「Web フォント読込ゼロ」方針を変更）
- **Headings**: h1 左寄せ + 藍の左縦棒（中央太下線は廃止）/ h2 藍の下線（黒地白文字は廃止）/ h3 太字のみ（左縦棒は廃止）。※ いずれも旧・向井シグネチャの廃止
- **Links / focus**: リンク＝藍・hover で下線強調（黒反転 hover は廃止）・visited も藍系 / focus-visible＝藍のリング
- **No**: パララックス・カルーセル・大型顔写真・ロゴ・派手なアニメーション（画像最小・4 柱構成の規律は維持）

## Quietly stronger (added on top of 向井 HP)

- レスポンシブ（mobile / tablet / desktop）
- ダークモード（`prefers-color-scheme`）
- `prefers-reduced-motion` 対応
- OGP + Twitter Card + JSON-LD Person schema
- hreflang ja/en + canonical
- Sitemap + RSS
- Print stylesheet
- WCAG 2.1 AA を目標（skip link / focus-visible / keyboard nav）

## Deployment

1. リポジトリを GitHub に push（`main` ブランチ）
2. Settings → Pages → Source = "GitHub Actions"
3. `.github/workflows/deploy.yml` が自動実行 → Pages 公開
4. お名前.com 側で DNS:
   - `A @ → 185.199.108.153` (and 109/110/111)
   - `AAAA @ → 2606:50c0:8000::153` (and 8001 / 8002 / 8003)
   - `CNAME www → <username>.github.io`
5. GitHub Pages の "Enforce HTTPS" を ON に

## Maintenance

| 操作 | コマンド |
|---|---|
| 業績追加 | `data/papers.bib` に `@article{...}` を 1 つ足して push |
| プロフィール変更 | 該当 `.astro` を編集して push |
| 言語切替テスト | `npm run dev` → `/` / `/en/` を行き来 |
| Lighthouse 監査 | `npm run build && npm run preview` → DevTools |
| 依存更新 | `npm outdated` → `npm update` → `npm run check` で確認 |

## License

- Source code: MIT
- Site content (text, images): [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
