import { motion } from "motion/react";
import { Menu, X, Instagram, Linkedin } from "lucide-react";
import React, { useState } from "react";
import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import GraphicDesign from "./pages/GraphicDesign";
import AISolutions from "./pages/AISolutions";

const Logo = () => {
  return (
    <Link to="/" className="flex items-center h-12">
      <img 
        src="./logo.png" 
        alt="Sunny Side Design" 
        className="h-full w-auto object-contain"
        referrerPolicy="no-referrer"
      />
    </Link>
  );
};

const NavItem = ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => {
  const isExternal = href.startsWith('http');
  const isHash = href.startsWith('#');
  const location = useLocation();

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-accent transition-colors font-medium whitespace-nowrap text-sm lg:text-base" onClick={onClick}>
        {children}
      </a>
    );
  }

  if (isHash) {
    // If we are not on the home page, link to home page first
    const target = location.pathname === '/' ? href : `/${href}`;
    return (
      <Link to={target} className="text-gray-600 hover:text-accent transition-colors font-medium whitespace-nowrap text-sm lg:text-base" onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <Link to={href} className="text-gray-600 hover:text-accent transition-colors font-medium whitespace-nowrap text-sm lg:text-base" onClick={onClick}>
      {children}
    </Link>
  );
};

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  React.useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}

function AppContent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-accent/20">
      <ScrollToTop />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Logo />
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-8">
            <NavItem href="#home">ホーム</NavItem>
            <NavItem href="#services">サービス</NavItem>
            <NavItem href="#portfolio">制作実績</NavItem>
            <NavItem href="#company">会社情報</NavItem>
            <NavItem href="https://docs.google.com/forms/d/e/1FAIpQLSerISfXpWJv6htob3dv3P65R947qsNlSwvWNYDb-bqdWh6Prw/viewform">お問い合わせ</NavItem>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-gray-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white border-b border-gray-100 px-4 py-6 flex flex-col gap-4"
          >
            <NavItem href="#home" onClick={closeMenu}>ホーム</NavItem>
            <NavItem href="#services" onClick={closeMenu}>サービス</NavItem>
            <NavItem href="#portfolio" onClick={closeMenu}>制作実績</NavItem>
            <NavItem href="#company" onClick={closeMenu}>会社情報</NavItem>
            <NavItem href="https://docs.google.com/forms/d/e/1FAIpQLSerISfXpWJv6htob3dv3P65R947qsNlSwvWNYDb-bqdWh6Prw/viewform" onClick={closeMenu}>お問い合わせ</NavItem>
          </motion.div>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/graphic-design" element={<GraphicDesign />} />
        <Route path="/ai-solutions" element={<AISolutions />} />
      </Routes>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            <div className="col-span-2">
              <div className="mb-6 brightness-0 invert opacity-80 h-12">
                <img 
                  src="./logo.png" 
                  alt="Sunny Side Design" 
                  className="h-full w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-gray-400 max-w-sm">
                SunnySideDesignは、デザインとAIの力で、クライアントのビジネスに新しい光を当てるクリエイティブ・エージェンシーです。
              </p>
            </div>
            <div>
              <h5 className="font-bold mb-6">メニュー</h5>
              <ul className="space-y-4 text-gray-400">
                <li><Link to="/#home" className="hover:text-white transition-colors">ホーム</Link></li>
                <li><Link to="/#services" className="hover:text-white transition-colors">サービス</Link></li>
                <li><Link to="/#portfolio" className="hover:text-white transition-colors">制作実績</Link></li>
                <li><Link to="/#company" className="hover:text-white transition-colors">会社情報</Link></li>
                <li><a href="https://docs.google.com/forms/d/e/1FAIpQLSerISfXpWJv6htob3dv3P65R947qsNlSwvWNYDb-bqdWh6Prw/viewform" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">お問い合わせ</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-6">関連サイト・ツール</h5>
              <ul className="space-y-4 text-gray-400">
                <li><a href="https://katoken1211-sunnysidedesign.github.io/Sunny-Side-library/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Sunny library</a></li>
                <li><a href="https://sunnylife-simulator.online/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">SUNNY Life simulator</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-6">SNS</h5>
              <div className="flex gap-4">
                <a 
                  href="https://www.instagram.com/sunny_side_design_kk/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Instagram size={20} />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent transition-colors">
                  <Linkedin size={20} />
                </a>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 text-center text-gray-500 text-sm">
            &copy; 2026 SunnySideDesign All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
