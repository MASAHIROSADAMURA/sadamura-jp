/**
 * /zh/guide — 中文記事ハブのメタデータ定義。
 *
 * title / description / keywords / headline はここが唯一の定義箇所。ハブ一覧の
 * カード・各記事の SEO・Article JSON-LD が同じ配列を参照するため、三者が構造上
 * つねに一致する。
 *
 * - `title`    … `<title>` に使う（記事タイトル ＋ ブランド接尾辞
 *                「 | 贞村真宏」。サイト内の他ページと同形式）
 * - `headline` … 記事の H1／カード見出し／Article.headline／パンくず末尾
 * - `keywords` … 旧来の中国系検索エンジン向け（SEO.astro のコメント参照）
 *
 * ja / en 版は存在しないため、i18n の `routeLocales` では zh 単独ルートとして
 * 登録する（存在しない言語へ hreflang を出さない）。
 */

export interface GuideArticle {
  /** `/zh/guide/<slug>` */
  slug: string;
  /** `<title>` — ドラフト frontmatter の逐語 */
  title: string;
  /** 記事 H1・カード見出し・Article.headline */
  headline: string;
  description: string;
  /** カンマ区切り（SEO.astro の keywords prop 形式） */
  keywords: string;
}

/** 公開日＝更新日。Article の datePublished / dateModified と本文末尾の日付に使う。 */
export const GUIDE_DATE = '2026-07-31';

export const guideArticles: GuideArticle[] = [
  {
    slug: 'japan-graduate-admissions-routes',
    title: '日本读研全流程：研究生、修士直考、SGU三条路线的区别与时间线 | 贞村真宏',
    headline: '日本读研全流程：研究生、修士直考、SGU三条路线的区别与时间线',
    description:
      '系统梳理赴日读研的三条路线——研究生（非正规生）、修士直考、SGU英语项目——在制度上的区别，给出以4月与10月入学为终点的倒推时间线、联系教授的基本作法、出愿的实际花费，以及常见误区与自主申请检查清单。',
    keywords:
      '日本读研,日本读研流程,日本大学院申请,研究生 修士 区别,日本读研时间线,修士直考,SGU 英语项目,研究计划书,教授内诺,出愿费用'
  },
  {
    slug: 'research-proposal-guide',
    title: '研究计划书怎么写：日本教授真正在看的是什么 | 贞村真宏',
    headline: '研究计划书怎么写：日本教授真正在看的是什么',
    description:
      '日本大学院出愿的核心是研究计划书。本文依据JASSO官方指南列出的审查要点，说明教授实际在评估的四件事、六段式结构与字数分配、日语先行研究的检索路径（CiNii Research／J-STAGE／国立国会图书馆／KAKEN／researchmap），以及“教授内诺”的正确做法与常见失败。不发模板，讲清过程。',
    keywords:
      '研究计划书 怎么写,日本 研究计划书,日本读研 研究计划书,教授内诺,日本大学院 出愿,先行研究 检索,CiNii Research,J-STAGE'
  },
  {
    slug: 'ai-research-proposal',
    title: '用AI写研究计划书会被看穿吗——AI幻觉、日文文献与“原典核实”的方法 | 贞村真宏',
    headline: '用AI写研究计划书会被看穿吗——AI幻觉、日文文献与“原典核实”的方法',
    description:
      '用AI起草研究计划书本身不是问题，问题在于引用。日本大量判例与纸质学术期刊未在公开互联网上提供全文，AI因而会结构性地生成看似合规、实则不存在的日文引用。本文讲清风险所在、教授如何核实，以及把每一条引用回到原典逐条核实的工作流与自查清单（CiNii、J-STAGE、裁判所、国立国会图书馆）。',
    keywords:
      'AI 研究计划书,ChatGPT 留学文书,AI 幻觉 文献,AI写的会被发现吗,日本读研 研究计划书,日文文献 检索,CiNii,J-STAGE,引用 核实,贞村真宏'
  },
  {
    slug: 'japan-boarding-junior-high-schools',
    title: '日本的寄宿制名门初中：制度、费用与报考资格 | 贞村真宏',
    headline: '日本的寄宿制名门初中：制度、费用与报考资格',
    description:
      '日本入管法上的一条省令，要求不随行家长的初中生在日本有监护人、学校配有外国学生生活指导的专职职员，并确保有常驻职员的宿舍或其他适当住宿设施——实务上以设宿舍的学校为主。本文依据入管基准省令原文与六所寄宿学校的官方募集要项，整理学费、宿舍费、报考资格与考场。',
    keywords: '日本初中留学,寄宿制学校,拉萨尔,海阳中等教育学校,在留资格,日本私立中学'
  },
  {
    slug: 'baolu-shibie-zhinan',
    title: '“保录取”识别指南：法律、判例与真实价格 | 贞村真宏',
    headline: '“保录取”识别指南：法律、判例与真实价格',
    description:
      '中国《广告法》第二十四条明文禁止教育培训广告作出保证性承诺，“保过”二字本身已有行政处罚先例。本文梳理法条原文、监管部门公布的处罚案例、法院对“保录取”协议的判决，以及正规服务与灰色市场之间的价格差，并附危险信号自查清单。',
    keywords: '保录取 骗局,日本留学 保录取,留学中介 靠谱吗,保过班 退费,保过协议 有效吗'
  }
];

/** slug から記事メタを引く。未登録 slug はビルドを失敗させる。 */
export function guideArticle(slug: string): GuideArticle {
  const found = guideArticles.find((a) => a.slug === slug);
  if (!found) throw new Error(`Unknown /zh/guide article: ${slug}`);
  return found;
}

/**
 * Article 構造化データ。author / publisher は既存の Person（`#person`）を、
 * isPartOf は既存の WebSite（`#website`）を参照するだけで、SEO.astro が出す
 * Person / WebSite / BreadcrumbList には手を触れない。
 */
export function articleJsonLd(article: GuideArticle, siteOrigin: string, pageUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    url: pageUrl,
    headline: article.headline,
    description: article.description,
    keywords: article.keywords,
    inLanguage: 'zh-CN',
    datePublished: GUIDE_DATE,
    dateModified: GUIDE_DATE,
    author: { '@id': `${siteOrigin}/#person` },
    publisher: { '@id': `${siteOrigin}/#person` },
    isPartOf: { '@id': `${siteOrigin}/#website` },
    image: `${siteOrigin}/og.png`
  };
}
