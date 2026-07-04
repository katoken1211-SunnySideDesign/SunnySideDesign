// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const primaryNav = document.getElementById('primaryNav');

if(navToggle){
  navToggle.addEventListener('click', ()=>{
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    primaryNav.classList.toggle('open');
  });
}

// Close nav when clicking links (for mobile)
document.querySelectorAll('.site-nav a').forEach(a=>{
  a.addEventListener('click', ()=>{
    if(primaryNav.classList.contains('open')){
      primaryNav.classList.remove('open');
      navToggle && navToggle.setAttribute('aria-expanded','false');
    }
  })
});

// Smooth scroll for internal links (extra safety if CSS not supported)
document.querySelectorAll('a[href^="#"]').forEach(link=>{
  link.addEventListener('click', (e)=>{
    const href = link.getAttribute('href');
    if(href.length>1){
      const el = document.querySelector(href);
      if(el){
        e.preventDefault();
        el.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }
  })
});

// Intersection Observer for reveal animations
const io = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('in-view');
      // optional: unobserve to keep performance
      io.unobserve(entry.target);
    }
  });
},{threshold:0.12});

document.querySelectorAll('.work-card, .service-card, .step, .about-copy, .hero-copy').forEach(el=>io.observe(el));

// Add fallback: if IntersectionObserver not available, reveal all
if(!('IntersectionObserver' in window)){
  document.querySelectorAll('.work-card, .service-card, .step, .about-copy, .hero-copy').forEach(el=>el.classList.add('in-view'));
}
