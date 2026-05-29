import { motion } from "motion/react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function GraphicDesign() {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden bg-gradient-to-b from-orange-50 to-white">
        <div className="absolute inset-0 -z-10">
          <motion.div 
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-accent/20 to-yellow-300/20 rounded-full blur-3xl"
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-gray-900">
              想いを「<span className="text-accent">陽の当たる場所</span>」へ。<br className="hidden md:block" />
              伝わるデザイン、もっと身近に。
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              名刺1枚からブランド構築まで。SunnySideDesignは、あなたのビジネスに明るい光を当てるパートナーです。
            </p>
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">制作カテゴリー</h2>
            <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Promotion", desc: "名刺、バナー、チラシ、パンフレット" },
              { title: "Identity", desc: "ロゴデザイン、ブランド構築" },
              { title: "Business Support", desc: "プレゼン資料（スライド）、SNS運用（Instagram）" }
            ].map((cat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center"
              >
                <h3 className="text-2xl font-bold text-accent mb-4">{cat.title}</h3>
                <p className="text-gray-600">{cat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">制作の流れ</h2>
            <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
          </div>
          <div className="space-y-8">
            {[
              { step: "01", title: "ヒアリング", desc: "あなたの想いや課題を丁寧にお伺いします。" },
              { step: "02", title: "プランニング", desc: "ターゲットに響く最適な構成をご提案。" },
              { step: "03", title: "デザイン制作", desc: "視覚的魅力と使いやすさを両立させた形に。" },
              { step: "04", title: "フィードバック", desc: "お客様のご要望に合わせて細部を調整。" },
              { step: "05", title: "納品・運用", desc: "活用方法のアドバイスと共にデータをお渡しします。" }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-50"
              >
                <div className="text-3xl font-bold text-accent/30">{item.step}</div>
                <div>
                  <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">料金プラン</h2>
            <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-6 font-bold text-gray-900 border-b-2 border-accent/20 rounded-tl-2xl">プラン名</th>
                  <th className="p-6 font-bold text-gray-900 border-b-2 border-accent/20">料金 (税込)</th>
                  <th className="p-6 font-bold text-gray-900 border-b-2 border-accent/20 rounded-tr-2xl">主な内容</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-6 font-bold text-lg">ライトプラン</td>
                  <td className="p-6 font-bold text-accent text-xl">11,000円〜</td>
                  <td className="p-6 text-gray-600">名刺、バナー、チラシなど。まず形にしたい方へ。</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-6 font-bold text-lg">スタンダードプラン</td>
                  <td className="p-6 font-bold text-accent text-xl">33,000円〜</td>
                  <td className="p-6 text-gray-600">スライド作成、3折りパンフ、ロゴデザインなど。本格的な発信に。</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-6 font-bold text-lg">プレミアムプラン</td>
                  <td className="p-6 font-bold text-accent text-xl">110,000円〜</td>
                  <td className="p-6 text-gray-600">トータルデザイン、インスタ運用サポートなど。ブランドを確立したい方へ。</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-8 text-center">
            <p className="text-gray-600 font-medium">電子マネーやオンラインクレジット決済に対応しています</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-accent overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            「何から頼めばいいかわからない」<br className="hidden sm:block" />
            というご相談も大歓迎です。
          </h2>
          <p className="text-white/90 mb-10 text-lg">
            まずはお気軽にお問い合わせください。最適なプランをご提案いたします。
          </p>
          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLSerISfXpWJv6htob3dv3P65R947qsNlSwvWNYDb-bqdWh6Prw/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-accent px-12 py-4 rounded-full font-bold text-lg hover:bg-gray-50 transition-all hover:scale-105 shadow-xl"
          >
            無料で相談してみる
            <ArrowRight size={20} />
          </a>
        </div>
      </section>
    </div>
  );
}
