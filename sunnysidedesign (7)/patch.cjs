const fs = require('fs');
let lines = fs.readFileSync('src/pages/Home.tsx', 'utf8').split('\n');

const replacement = `                  const details = portfolioDetails[item.title];
                  const isActive = activePortfolio === index;
                  return (
                  <div 
                    key={index} 
                    className={\`relative group shrink-0 snap-center z-10 hover:z-50 \${item.category === 'web' ? 'w-[300px] sm:w-[480px] lg:w-[600px]' : 'w-[280px] sm:w-[320px] lg:w-[380px]'}\`}
                    onClick={() => {
                      if (!isDragging) setActivePortfolio(isActive ? null : index);
                    }}
                    onMouseLeave={() => setActivePortfolio(null)}
                  >
                  {/* Image Card */}
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className={\`overflow-hidden rounded-2xl bg-gray-50 shadow-sm relative z-10 flex items-center justify-center \${item.category === 'web' ? 'aspect-video' : 'aspect-[4/3]'}\`}
                  >
                    <img 
                      src={item.url} 
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/600x400?text=Image+Not+Found';
                      }}
                      className={\`w-full h-full transition-transform duration-700 md:group-hover:scale-105 \${item.category === 'web' ? 'object-contain p-4' : 'object-cover'}\`}
                    />
                    <div className={\`absolute inset-0 bg-black/10 transition-opacity duration-300 \${isActive ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}\`}></div>
                  </motion.div>

                  {/* 吹き出し (Speech Bubble) */}
                  <div className={\`absolute z-50 left-1/2 -translate-x-1/2 bottom-6 \${item.category === 'web' ? 'w-[320px] sm:w-[440px] lg:w-[500px]' : 'w-[280px] sm:w-[320px] lg:w-[360px]'} bg-white rounded-2xl shadow-2xl transition-all duration-300 border border-gray-100 flex flex-col \${isActive ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-4 md:group-hover:opacity-100 md:group-hover:visible md:group-hover:translate-y-0'}\`}>
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
                  );`;

let beforeLines = lines.slice(0, 292);
let afterLines = lines.slice(396);
let newLines = [...beforeLines, replacement, ...afterLines];

fs.writeFileSync('src/pages/Home.tsx', newLines.join('\n'));
