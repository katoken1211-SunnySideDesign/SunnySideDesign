// ===== Google Analytics 4 =====
// Loading the Google tag and calling config sends the default page_view event.
const GA4_MEASUREMENT_ID = 'G-TG4L7GKQLL';
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
gtag('js', new Date());
gtag('config', GA4_MEASUREMENT_ID);

const googleTag = document.createElement('script');
googleTag.async = true;
googleTag.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
document.head.appendChild(googleTag);

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

// ===== Smooth Scroll for Anchor Links (offset for fixed header) =====
const headerEl = document.querySelector('.site-header');
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href && href.length > 1) {
      const el = document.querySelector(href);
      if (el) {
        e.preventDefault();
        const headerHeight = headerEl ? headerEl.offsetHeight : 0;
        const top = el.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        window.scrollTo({ top, behavior: 'smooth' });

        // Close mobile menu if open
        if (siteNav && siteNav.classList.contains('open')) {
          siteNav.classList.remove('open');
          if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
        }
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

// ===== Work Image Lightbox =====
const imageModal = document.querySelector('#image-modal');
const imageModalImg = imageModal?.querySelector('img');
const workImageButtons = document.querySelectorAll('.work-image');

const openImageModal = (button) => {
  const img = button.querySelector('img');
  if (!imageModal || !imageModalImg || !img) return;

  imageModalImg.src = img.src;
  imageModalImg.alt = img.alt;
  imageModal.classList.add('is-open');
  imageModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
};

const closeImageModal = () => {
  if (!imageModal) return;

  imageModal.classList.remove('is-open');
  imageModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
};

workImageButtons.forEach((button) => {
  button.addEventListener('click', () => openImageModal(button));
});

document.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeImageModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && imageModal?.classList.contains('is-open')) {
    closeImageModal();
  }
});

// ===== Journal category filter (progressive enhancement) =====
const journalGrid = document.querySelector('#latest-title')?.closest('.journal-section')?.querySelector('.journal-grid');
if (journalGrid) {
  const categoryAliases = {
    ai: 'AI活用',
    design: 'デザイン',
    web: 'Web制作',
    work: '働き方・思考',
    life: '暮らし'
  };
  const requested = new URLSearchParams(window.location.search).get('category');
  const category = categoryAliases[requested] || requested;

  if (category) {
    let visibleCount = 0;
    journalGrid.querySelectorAll('.journal-card').forEach((card) => {
      const visible = card.dataset.category === category;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    const status = document.createElement('p');
    status.className = 'journal-filter-status';
    status.setAttribute('role', 'status');
    status.textContent = visibleCount
      ? `「${category}」の記事を${visibleCount}件表示しています。`
      : `「${category}」の記事はまだありません。`;
    journalGrid.before(status);
  }
}
