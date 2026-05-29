import { motion } from "motion/react";
import { ArrowLeft, Cpu, MessageSquare, Sparkles, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function AISolutions() {
  return (
    <div className="pt-20 min-h-screen flex flex-col bg-gray-50">
      {/* Hero Section */}
      <section className="relative py-24 bg-white overflow-hidden border-b border-gray-100">
        <div className="absolute inset-0 -z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-sub/20 to-blue-300/20 rounded-full blur-3xl"
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-gray-900">
              AI Solutions
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              最新のAI技術を活用し、業務効率化とクリエイティブの質を同時に高めるソリューションを提供します。
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col"
            >
              <div className="w-14 h-14 bg-sub/10 text-sub rounded-2xl flex items-center justify-center mb-6">
                <Cpu size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-gray-900">AI導入・ワークフロー自動化</h3>
              <p className="text-gray-600 leading-relaxed">
                GeminiやMicrosoft Copilotを活用し、ドキュメント作成やデザイン制作のワークフローを根本から効率化。日々のルーティンワークを削減し、コア業務に集中できる環境を構築します。
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col"
            >
              <div className="w-14 h-14 bg-sub/10 text-sub rounded-2xl flex items-center justify-center mb-6">
                <Sparkles size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-gray-900">カスタムAI・Gems構築</h3>
              <p className="text-gray-600 leading-relaxed">
                Google AI Studioを活用した高度なプロンプト設計や、特定業務に特化したカスタムAI（Gems）の構築をサポート。精度の高い要約や自動化の仕組みを提供します。
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col"
            >
              <div className="w-14 h-14 bg-sub/10 text-sub rounded-2xl flex items-center justify-center mb-6">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-gray-900">プロンプトエンジニアリング</h3>
              <p className="text-gray-600 leading-relaxed">
                AIのポテンシャルを最大限に引き出すための言語化をサポート。目的に合わせた最適な指示文（プロンプト）を設計し、誰でも高品質なアウトプットを出せるようにします。
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-20 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-gray-900">開発事例：カスタムWebモジュール制作</h2>
              <div className="w-12 h-1 bg-sub rounded-full mb-8"></div>
              <p className="text-gray-600 leading-relaxed mb-8 text-lg">
                AIを活用した効率的な開発手法により、独自の計算ツールやシミュレーターなどの「カスタムWebモジュール」の制作も承っております。自社開発の「SUNNY Life simulator」は、複雑なお金の計算を分かりやすく可視化した一例です。業務課題を解決するオリジナルツールの開発もご相談ください。
              </p>
              <a 
                href="https://sunnylife-simulator.online/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-4 rounded-xl font-bold transition-colors shadow-sm hover:shadow-md"
              >
                <span>モジュールの実例を見る（SUNNY Life simulator）</span>
                <ExternalLink size={20} />
              </a>
            </div>
            <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-gray-50 flex items-center justify-center p-8 aspect-video">
              {/* Optional image placeholder if you have an image, otherwise a stylized representation */}
              <div className="text-center">
                <div className="w-20 h-20 bg-sub/10 text-sub rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Cpu size={40} />
                </div>
                <h4 className="text-xl font-bold text-gray-900">SUNNY Life simulator</h4>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Section */}
      <section className="py-24 bg-sub/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sub/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-sub/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900">
            自社開発のAIプロンプト集を無料公開中
          </h2>
          <p className="text-gray-600 mb-10 text-lg leading-relaxed">
            デザイン制作や日常業務に今すぐ使えるプロンプトをまとめています。
          </p>
          <a 
            href="https://katoken1211-sunnysidedesign.github.io/Sunny-Side-library/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-sub hover:bg-sub/90 text-white px-10 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-sub/20"
          >
            <span>Sunny library を見る</span>
            <ExternalLink size={20} />
          </a>
        </div>
      </section>

      {/* Back Link */}
      <div className="py-12 text-center bg-gray-50">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
