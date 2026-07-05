// ===== Mobile Menu Toggle =====
const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    siteNav.classList.toggle('open');
  });
}

// Close menu when clicking on links
document.querySelectorAll('.site-nav a').forEach(link => {
  link.addEventListener('click', () => {
    if (siteNav && siteNav.classList.contains('open')) {
      siteNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
});

// ===== Smooth Scroll for Anchor Links =====
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href.length > 1) {
      const el = document.querySelector(href);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

// ===== Intersection Observer for Animations =====
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  // Observe elements
  document.querySelectorAll('.work-card, .service-card, .flow-card, .about-content, .hero-content').forEach(el => {
    observer.observe(el);
  });
} else {
  // Fallback: show all elements immediately if IntersectionObserver not supported
  document.querySelectorAll('.work-card, .service-card, .flow-card, .about-content, .hero-content').forEach(el => {
    el.classList.add('in-view');
  });
}

// ===== Close Mobile Menu on Scroll =====
let lastScrollTop = 0;
window.addEventListener('scroll', () => {
  if (siteNav && siteNav.classList.contains('open')) {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop + 50) {
      siteNav.classList.remove('open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    }
  }
  lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
});

