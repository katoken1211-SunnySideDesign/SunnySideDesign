import { motion } from "motion/react";
import { Palette, Cpu, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Monitor, Check } from "lucide-react";
import { Link } from "react-router-dom";
import React, { useState, useRef } from "react";

interface PortfolioItem {
  filename: string;
  title: string;
  url: string;
  category: 'graphic' | 'web';
  linkUrl?: string;
  buttonText?: string;
}

const hardcodedPortfolioItems: PortfolioItem[] = [
  { filename: "pharmacist-consent.png", title: "かかりつけ薬剤師同意書", url: "./portfolio/pharmacist-consent.png", category: 'graphic' },
  { filename: "wet-tissue-design.png", title: "ウェットティッシュデザイン", url: "./portfolio/wet-tissue-design.png", category: 'graphic' },
  { filename: "pamphlet-anonymous.png", title: "三つ折りパンフ（匿名）", url: "./portfolio/pamphlet-anonymous.png", category: 'graphic' },
  { filename: "business-card-teacher.png", title: "名刺作成（語学教師）", url: "./portfolio/business-card-teacher.png", category: 'graphic' },
  { filename: "logo.yakuken.png", title: "薬学系研修会 スケジューリングサイト（yakuken）", url: "./portfolio/logo.yakuken.png", category: 'web', linkUrl: "https://yakuken.fun" },
  { filename: "logo.sls.png", title: "SUNNY Life simulator（自社プロダクト）", url: "./portfolio/logo.sls.png", category: 'web', linkUrl: "https://sunnylife-simulator.online/", buttonText: "シミュレーターを使ってみる" },
];

const portfolioDetails: Record<string, { points?: { title: string, desc: string }[], result?: string, description?: string }> = {
  "名刺作成（語学教師）": {
    points: [
      { title: "タイポグラフィの強調", desc: "右側に配置した太字の縦ロゴ「GELB」がアイキャッチとなり、一目でブランド名を印象付ける構成。" },
      { title: "情報の整理と余白", desc: "必要な情報を左下に集約し、十分な余白（ホワイトスペース）を活かすことで、誠実さとプロフェッショナルな知性を表現。" },
      { title: "デジタルへの導線", desc: "視認性の高いQRコードを配置し、紙からWeb（サイト・SNS）へのスムーズなアクセスを設計。" }
    ],
    result: "第一印象でのブランド認知が向上し、交換後のWebサイト流入数やSNSフォロワー増に貢献。"
  },
  "ウェットティッシュデザイン": {
    points: [
      { title: "ブランドカラーの統一", desc: "薬局のイメージカラーであるブルーを基調とし、清潔感と安心感を直感的に想起させるデザイン。" },
      { title: "親しみやすいアイコン", desc: "「太陽」のロゴを中央に配し、医療機関特有の堅苦しさを払拭。" }
    ],
    result: "実用的なノベルティとして日常的に使用されることで、地域住民の生活導線におけるブランド露出が増加し、親近感を醸成。"
  },
  "かかりつけ薬剤師同意書": {
    points: [
      { title: "ビジュアルによる理解促進", desc: "文字中心になりがちな同意書にイラストやフローチャートを導入。複雑な制度を「視覚的に」理解できるよう工夫。" },
      { title: "心理的ハードルの低減", desc: "柔らかな色使いと親しみやすいキャラクターにより、署名時の不安感を軽減。" }
    ],
    result: "薬剤師の説明時間が短縮され、業務効率が向上。患者側の理解度が深まることで、同意率の向上と信頼関係の強化を実現。"
  },
  "三つ折りパンフ（匿名）": {
    points: [
      { title: "ベネフィットの明確化", desc: "「本来のケアに専念できる環境を」というキャッチコピーを大きく配し、施設側のメリットをダイレクトに訴求。" },
      { title: "情緒的価値の可視化", desc: "実際に笑顔で接するスタッフの写真を使用し、サービス導入後の明るい未来を具体的にイメージ。" },
      { title: "一貫したトーン＆マナー", desc: "ロゴ・カラー・フォントを他媒体と統一し、ブランドの信頼性を担保。" }
    ],
    result: "営業・紹介ツールとしての説得力が強まり、ケアマネジャーや施設担当者とのコミュニケーションが円滑化。新規契約獲得の成約率に寄与。"
  },
  "薬学系研修会 スケジューリングサイト（yakuken）": {
    points: [
      { title: "直感的なUI/UX設計", desc: "誰でも迷わず操作できるようにシンプルな導線を設計し、スムーズなスケジュール登録・確認を実現。" },
      { title: "インフラ構築から公開まで", desc: "独自ドメインの取得から、GitHub Pagesへのデプロイ、HTTPS化など、セキュアで高速な配信環境をフルスクラッチで構築。" }
    ],
    result: "紙やチャットで散在していたスケジュール管理がデジタルに集約され、関係者間の情報共有と業務効率が劇的に向上。"
  },
  "SUNNY Life simulator（自社プロダクト）": {
    description: "複雑なお金の流れを直感的に可視化するUI/UX設計。専門知識不要で、将来の資金ショートを防ぐ対策を話し合うきっかけを作ります。"
  }
};

export default function Home() {
  const [portfolioItems] = useState<PortfolioItem[]>(hardcodedPortfolioItems);
  const [activePortfolio, setActivePortfolio] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<'graphic' | 'web'>('graphic');

  // Drag-to-scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 400 : 300;
      scrollRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  return (
    <main>
      {/* Hero Section */}
      <section id="home" className="relative pt-32 pb-20 overflow-hidden min-h-[90vh] flex items-center">
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Sunrise Animation */}
          <motion.div 
            initial={{ y: 300, opacity: 0, scale: 0.5 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3 w-[800px] h-[800px] bg-gradient-to-t from-orange-400 via-amber-300 to-yellow-100 rounded-full blur-3xl opacity-40"
          />
          
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-accent/5 to-transparent rounded-full blur-3xl" />
          
          {/* Abstract Network Pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-8 pb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
              design for your <span className="text-accent italic">sunnydays</span>
            </h1>
            <p className="text-lg md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
              あなたの毎日を彩るデザインと、<br className="hidden sm:block" />
              未来を切り拓くAIソリューションを提案します。
            </p>
            <motion.a
              href="https://docs.google.com/forms/d/e/1FAIpQLSerISfXpWJv6htob3dv3P65R947qsNlSwvWNYDb-bqdWh6Prw/viewform"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-accent text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all flex items-center gap-2 mx-auto w-fit"
            >
              プロジェクトを相談する
              <ArrowRight size={20} />
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-gray-50 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center mb-16 px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">提供サービス</h2>
              <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center justify-center gap-4 md:gap-6 max-w-3xl mx-auto"
            >
              <div className="shrink-0 relative">
                <div className="absolute inset-0 bg-accent/10 blur-xl rounded-full scale-150"></div>
                <img 
                  src="./portfolio/peaceicon.png" 
                  alt="代表アイコン" 
                  className="w-20 h-20 md:w-28 md:h-28 object-contain relative z-10 drop-shadow-md" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 relative max-w-[480px]">
                {/* 吹き出しのしっぽ */}
                <div className="absolute -left-2 md:-left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-6 md:h-6 bg-white border-l border-b border-gray-100 transform rotate-45 rounded-sm"></div>
                <div className="absolute -left-1 md:-left-2 top-1/2 -translate-y-1/2 w-4 h-4 md:w-6 md:h-6 bg-white transform rotate-45 z-10"></div>
                <p className="text-[13px] md:text-base font-bold text-gray-800 leading-relaxed text-left relative z-20">
                  これまで培ってきた<span className="text-accent">営業スキル</span>を活かして、<br />
                  期待以上の<span className="text-accent underline decoration-accent/30 underline-offset-4">提案力</span>と想定以上の<span className="text-accent underline decoration-accent/30 underline-offset-4">スピード感</span>で<br className="hidden sm:block"/>
                  オリジナリティを実現します！
                </p>
              </div>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8">
            <div className="block group relative">
              <motion.div 
                whileHover={{ y: -10 }}
                className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 h-full transition-all group-hover:shadow-xl group-hover:border-accent/20 relative overflow-hidden flex flex-col"
              >
                <Link to="/graphic-design" className="absolute inset-0 z-0" aria-label="グラフィックデザインの詳細を開く"></Link>
                <div className="relative z-10 pointer-events-none">
                  <div className="absolute top-0 right-0 text-accent opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                    <ArrowRight size={24} />
                  </div>
                  <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Palette size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-accent transition-colors">グラフィックデザイン</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    ブランドの想いを視覚化し、価値を伝えるデザイン。ロゴ制作からWebサイト構築、販促物まで、一貫した世界観を構築します。
                  </p>
                </div>
                <div className="mt-auto relative z-10 flex flex-col items-start gap-4">
                  <Link to="/graphic-design" className="text-accent font-bold text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                    詳細を見る
                  </Link>
                </div>
              </motion.div>
            </div>

            <div className="block group relative">
              <motion.div 
                whileHover={{ y: -10 }}
                className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 h-full transition-all group-hover:shadow-xl group-hover:border-sub/20 relative overflow-hidden flex flex-col"
              >
                <Link to="/ai-solutions" className="absolute inset-0 z-0" aria-label="AIソリューションの詳細を開く"></Link>
                <div className="relative z-10 pointer-events-none">
                  <div className="absolute top-0 right-0 text-sub opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                    <ArrowRight size={24} />
                  </div>
                  <div className="w-16 h-16 bg-sub/10 text-sub rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Cpu size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-sub transition-colors">AIソリューション</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    最新のAI技術を活用し、ビジネスの効率化と創造性を加速。生成AIの導入支援や、AIを活用したクリエイティブワークフローを提案します。
                  </p>
                </div>
                <div className="mt-auto relative z-10 flex flex-col items-start gap-4">
                  {/* Sunny library へのリンク */}
                  <a 
                    href="https://katoken1211-sunnysidedesign.github.io/Sunny-Side-library/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-sub bg-sub/5 hover:bg-sub/10 px-4 py-2.5 rounded-lg transition-colors border border-sub/10"
                  >
                    <ExternalLink size={16} />
                    Sunny library<span className="font-normal text-xs ml-1 opacity-80">（自社開発AIプロンプト集）</span>
                  </a>
                  <Link to="/ai-solutions" className="text-sub font-bold text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    詳細を見る
                  </Link>
                </div>
              </motion.div>
            </div>

            <div className="block group relative">
              <motion.div 
                whileHover={{ y: -10 }}
                className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 h-full transition-all group-hover:shadow-xl group-hover:border-blue-500/20 relative overflow-hidden flex flex-col"
              >
                <div className="relative z-10 pointer-events-none">
                  {/* Badge */}
                  <div className="absolute top-0 right-0 bg-blue-50 text-blue-600 font-bold px-4 py-2 rounded-full text-sm">
                    ¥39,800 (税込)
                  </div>
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Monitor size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-blue-600 transition-colors">シンプルWeb制作プラン</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    「まずはWeb上に窓口が欲しい」という方に最適な、1ページ完結型のプランです。PC・スマホ対応の洗練されたサイトを、導入しやすい価格でスピーディにご提供します。個人事業主様やスモールビジネスの立ち上げに最適です。
                  </p>
                </div>
                <div className="mt-auto relative z-10 flex flex-col items-start gap-4 w-full">
                  <ul className="space-y-3 w-full">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-blue-100 text-blue-600 rounded-full p-0.5 shrink-0">
                        <Check size={14} />
                      </div>
                      <span className="text-sm text-gray-700 font-medium leading-relaxed">スマホ・PC両対応（レスポンシブ）</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-blue-100 text-blue-600 rounded-full p-0.5 shrink-0">
                        <Check size={14} />
                      </div>
                      <span className="text-sm text-gray-700 font-medium leading-relaxed">1ページ（ランディングページ形式）完結</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-blue-100 text-blue-600 rounded-full p-0.5 shrink-0">
                        <Check size={14} />
                      </div>
                      <span className="text-sm text-gray-700 font-medium leading-relaxed">お問い合わせフォーム標準設置</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      <section id="portfolio" className="py-24 relative z-10 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">制作実績</h2>
            <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
          </div>

          {/* Category Tabs */}
          <div className="flex justify-center gap-3 sm:gap-4 mb-8">
            <button
              onClick={() => { 
                setActiveCategory('graphic'); 
                setActivePortfolio(null);
                setTimeout(() => scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 50); 
              }}
              className={`px-5 sm:px-8 py-2.5 sm:py-3 rounded-full font-bold text-sm transition-all duration-300 ${activeCategory === 'graphic' ? 'bg-accent text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              Graphic Design
            </button>
            <button
              onClick={() => { 
                setActiveCategory('web'); 
                setActivePortfolio(null);
                setTimeout(() => scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 50); 
              }}
              className={`px-5 sm:px-8 py-2.5 sm:py-3 rounded-full font-bold text-sm transition-all duration-300 ${activeCategory === 'web' ? 'bg-accent text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              Web Creation
            </button>
          </div>

          <div className="relative group/slider">
            {/* Left Navigation Button */}
            <button 
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 md:-ml-6 z-20 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg backdrop-blur-sm opacity-0 group-hover/slider:opacity-100 transition-opacity hidden md:block border border-gray-100"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div 
              ref={scrollRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className={`flex overflow-x-auto gap-6 pt-24 sm:pt-32 pb-12 sm:pb-16 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 hide-scrollbar ${isDragging ? 'cursor-grabbing snap-none' : 'cursor-grab snap-x snap-mandatory'}`}
            >
              {portfolioItems.filter(item => item.category === activeCategory).length > 0 ? (
                portfolioItems.filter(item => item.category === activeCategory).map((item, index) => {
                  const details = portfolioDetails[item.title];
                  const isActive = activePortfolio === index;
                  return (
                  <div 
                    key={index} 
                    className={`relative group shrink-0 snap-center z-10 hover:z-50 ${item.category === 'web' ? 'w-[300px] sm:w-[480px] lg:w-[600px]' : 'w-[280px] sm:w-[320px] lg:w-[380px]'}`}
                    onClick={() => {
                      if (!isDragging) setActivePortfolio(isActive ? null : index);
                    }}
                    onMouseLeave={() => setActivePortfolio(null)}
                  >
                  {/* Image Card */}
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className={`overflow-hidden rounded-2xl bg-gray-50 shadow-sm relative z-10 flex items-center justify-center ${item.category === 'web' ? 'aspect-video' : 'aspect-[4/3]'}`}
                  >
                    <img 
                      src={item.url} 
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Not+Found';
                      }}
                      className={`w-full h-full transition-transform duration-700 md:group-hover:scale-105 ${item.category === 'web' ? 'object-contain p-4' : 'object-cover'}`}
                    />
                    <div className={`absolute inset-0 bg-black/10 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}></div>
                  </motion.div>

                  {/* 吹き出し (Speech Bubble) */}
                  <div className={`absolute z-50 left-1/2 -translate-x-1/2 bottom-6 ${item.category === 'web' ? 'w-[320px] sm:w-[440px] lg:w-[500px]' : 'w-[280px] sm:w-[320px] lg:w-[360px]'} bg-white rounded-2xl shadow-2xl transition-all duration-300 border border-gray-100 flex flex-col ${isActive ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-4 md:group-hover:opacity-100 md:group-hover:visible md:group-hover:translate-y-0'}`}>
                    {/* 吹き出しのしっぽ (Tail) */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[10px] border-transparent border-t-white"></div>
                    
                    {/* Scrollable Content */}
                    <div className="max-h-[280px] sm:max-h-[320px] overflow-y-auto hide-scrollbar rounded-2xl">
                      <div className="sticky top-0 bg-white z-10 px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-gray-100">
                        <h4 className="text-accent font-bold text-lg leading-tight">{item.title}</h4>
                      </div>
                      <div className="p-5 sm:p-6 pt-4 sm:pt-5">
                        {details && (
                          <div className="text-xs sm:text-sm text-gray-700 space-y-5">
                            {details.description ? (
                              <div className="leading-relaxed text-gray-600 bg-gray-50 p-5 rounded-xl border border-gray-100">
                                {details.description}
                              </div>
                            ) : (
                              <>
                                {details.points && (
                                  <div>
                                    <p className="text-accent font-bold mb-2.5 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                                      工夫点
                                    </p>
                                    <ul className="space-y-3">
                                      {details.points.map((point, i) => (
                                        <li key={i} className="leading-relaxed">
                                          <span className="font-bold text-gray-900 block mb-0.5">{point.title}</span>
                                          <span className="text-gray-600">{point.desc}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {details.result && (
                                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-accent font-bold mb-2 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                                      制作後の変化
                                    </p>
                                    <p className="leading-relaxed text-gray-600">{details.result}</p>
                                  </div>
                                )}
                              </>
                            )}
                            {item.linkUrl && (
                              <div className="pt-2">
                                <a 
                                  href={item.linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-all duration-300 shadow-sm hover:shadow-md"
                                >
                                  <span>{item.buttonText || "サイトを見る"}</span>
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                  );
                })
              ) : (
                <div className="w-full py-20 text-center text-gray-500">
                  <p>このカテゴリーの実績は現在準備中です。</p>
                </div>
              )}
            </div>

            {/* Right Navigation Button */}
            <button 
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 md:-mr-6 z-20 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg backdrop-blur-sm opacity-0 group-hover/slider:opacity-100 transition-opacity hidden md:block border border-gray-100"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Company Section */}
      <section id="company" className="py-24 bg-gray-50 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">会社情報</h2>
            <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center overflow-hidden border-2 border-accent/20 shadow-inner">
                  <img 
                    src="./profile.png" 
                    alt="KATOKEN Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <p className="text-accent font-bold text-sm tracking-widest mb-1 uppercase">Representative</p>
                  <h3 className="text-2xl font-bold text-gray-900">KATOKEN</h3>
                </div>
              </div>

              <div className="space-y-6 text-gray-700 leading-loose text-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-4">ご挨拶</h3>
                <p>
                  太陽の光が差し込む「Sunny Side（日向）」のように、関わるすべての人やビジネスを明るく照らしたい。そんな想いから、Sunny Side Designは誕生しました。
                </p>
                <p>
                  変化の激しい現代において、デザインやデジタル活用はもはや特別なものではなく、想いを届けるための大切な「言葉」です。私たちは、単に形を作るだけでなく、お客様の隣に寄り添い、まだ気づかれていない魅力や可能性を共に探し出し、整理し、光を当てる伴走者でありたいと考えています。
                </p>
                <p>
                  どんなに小さな悩みでも構いません。皆様のビジネスが、より晴れやかな場所へと進むためのお手伝いをさせていただければ幸いです。
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100"
            >
              <dl className="space-y-8">
                <div className="flex border-b border-gray-100 pb-6">
                  <dt className="w-32 font-bold text-gray-400 uppercase text-sm tracking-wider">代表</dt>
                  <dd className="text-gray-900 font-medium">KATOKEN</dd>
                </div>
                <div className="flex border-b border-gray-100 pb-6">
                  <dt className="w-32 font-bold text-gray-400 uppercase text-sm tracking-wider">創業</dt>
                  <dd className="text-gray-900 font-medium">2026年1月</dd>
                </div>
                <div className="flex border-b border-gray-100 pb-6">
                  <dt className="w-32 font-bold text-gray-400 uppercase text-sm tracking-wider">所在地</dt>
                  <dd className="text-gray-900 font-medium">群馬県高崎市</dd>
                </div>
                <div className="flex border-b border-gray-100 pb-6">
                  <dt className="w-32 font-bold text-gray-400 uppercase text-sm tracking-wider">お支払い</dt>
                  <dd className="text-gray-900 font-medium">クレジットカード、各種電子決済に対応</dd>
                </div>
              </dl>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-accent overflow-hidden relative z-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
            新しいプロジェクトを始めましょう
          </h2>
          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLSerISfXpWJv6htob3dv3P65R947qsNlSwvWNYDb-bqdWh6Prw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-accent px-12 py-4 rounded-full font-bold text-lg hover:bg-gray-50 transition-colors"
          >
            お問い合わせはこちら
          </a>
        </div>
      </section>
    </main>
  );
}
