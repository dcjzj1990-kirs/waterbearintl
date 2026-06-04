/**
 * WaterbearIntl - 主交互脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize i18n
  if (typeof i18n !== 'undefined') i18n.init();

  // Initialize geo-detection (auto-detect country & language)
  if (typeof geoDetect !== 'undefined') geoDetect.init();

  // === Scroll Progress Bar ===
  initScrollProgress();

  // === Hero Canvas Particles ===
  initHeroCanvas();

  // === Counter Animation ===
  let countersAnimated = false;

  function animateCounters() {
    const statNums = document.querySelectorAll('.hero-stats .stat-num');
    if (statNums.length === 0) return;

    statNums.forEach(el => {
      const target = parseInt(el.getAttribute('data-target')) || 0;
      if (target === 0) return;
      const duration = 2000;
      const startTime = performance.now();

      function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target);
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = target;
        }
      }
      requestAnimationFrame(update);
    });
    countersAnimated = true;
  }

  // === Scroll Effects ===
  const header = document.querySelector('.header');
  const backToTop = document.getElementById('backToTop');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Header shadow
    if (header) header.classList.toggle('scrolled', scrollY > 50);

    // Back to top
    if (backToTop) backToTop.classList.toggle('visible', scrollY > 500);

    // Scroll progress bar
    updateScrollProgress();

    // Hero parallax
    updateHeroParallax(scrollY);

    // Fade-in animations with stagger
    document.querySelectorAll('.fade-in:not(.visible)').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 100) {
        el.classList.add('visible');
        if (el.classList.contains('hero-stats') && !countersAnimated) {
          setTimeout(animateCounters, 300);
        }
      }
    });

  });

  // 页面加载后自动触发计数动画，不依赖滚动
  setTimeout(() => {
    if (!countersAnimated) animateCounters();
  }, 1200);

  window.dispatchEvent(new Event('scroll'));

  // === Back to Top ===
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // === Mobile Menu Toggle ===
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // === Product Filter ===
  const filterBtns = document.querySelectorAll('.filter-btn');
  const productCards = document.querySelectorAll('.product-card');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.getAttribute('data-filter');
      productCards.forEach(card => {
        const cardCat = card.getAttribute('data-category');
        if (category === 'all' || cardCat === category) {
          card.style.display = '';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          setTimeout(() => { card.style.display = 'none'; }, 300);
        }
      });
    });
  });

  // === Contact Form ===
  const contactForm = document.getElementById('inquiryForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('inqName')?.value.trim();
      const email = document.getElementById('inqEmail')?.value.trim();
      const company = document.getElementById('inqCompany')?.value.trim();
      const phone = document.getElementById('inqPhone')?.value.trim();
      const country = document.getElementById('inqCountry')?.value.trim();
      const subject = document.getElementById('inqSubject')?.value;
      const msg = document.getElementById('inqMsg')?.value.trim();

      if (!name || !email || !msg) {
        showNotification(typeof i18n !== 'undefined' && i18n.currentLang === 'zh' ? '请填写必填字段' : 'Please fill in required fields', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification(typeof i18n !== 'undefined' && i18n.currentLang === 'zh' ? '请输入有效的邮箱地址' : 'Please enter a valid email address', 'error');
        return;
      }

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      const sendingText = typeof i18n !== 'undefined' ? i18n.t('form_sending') : 'Submitting...';
      submitBtn.textContent = sendingText;
      submitBtn.disabled = true;

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, company, phone, country, subject, message: msg })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Server error');
        }

        const result = await response.json();
        showNotification(typeof i18n !== 'undefined' ? i18n.t('form_success') : 'Submission received!', 'success');
        contactForm.reset();
      } catch (err) {
        showNotification(
          typeof i18n !== 'undefined'
            ? (i18n.currentLang === 'zh' ? '提交失败，请稍后重试：' + err.message : 'Submission failed, please try again: ' + err.message)
            : 'Submission failed: ' + err.message,
          'error'
        );
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // === Smooth Scroll for anchor links ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerHeight = header ? header.offsetHeight : 68;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });
});

/* ============================================================
   SCROLL PROGRESS BAR
   ============================================================ */
function initScrollProgress() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.id = 'scrollProgress';
  document.body.prepend(bar);
}

function updateScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  bar.style.width = progress + '%';
}

/* ============================================================
   HERO PARALLAX
   ============================================================ */
function updateHeroParallax(scrollY) {
  const heroImg = document.querySelector('.hero-bg-img');
  if (!heroImg) return;
  const rate = 0.3;
  heroImg.style.transform = 'translateY(' + (scrollY * rate) + 'px)';
}

/* ============================================================
   HERO CANVAS PARTICLE NETWORK
   ============================================================ */
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let particles = [];
  let animationId;
  const PARTICLE_COUNT = 55;
  const CONNECTION_DIST = 130;
  const MOUSE_RADIUS = 180;

  let mouse = { x: -1000, y: -1000 };

  function resize() {
    const hero = canvas.closest('.hero');
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
  }

  function createParticles() {
    particles = [];
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.8,
        opacity: Math.random() * 0.4 + 0.15
      });
    }
  }

  function draw() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // Update & draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // Mouse interaction
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_RADIUS) {
        const force = (1 - dist / MOUSE_RADIUS) * 0.6;
        p.vx -= (dx / dist) * force * 0.1;
        p.vy -= (dy / dist) * force * 0.1;
        p.opacity = Math.min(0.7, p.opacity + 0.02);
      } else {
        p.opacity = Math.max(0.15, p.opacity - 0.005);
      }

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 140, 255, ' + p.opacity + ')';
      ctx.fill();

      // Connections
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx2 = p.x - p2.x;
        const dy2 = p.y - p2.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (dist2 < CONNECTION_DIST) {
          const alpha = (1 - dist2 / CONNECTION_DIST) * 0.15;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = 'rgba(0, 140, 255, ' + alpha + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    animationId = requestAnimationFrame(draw);
  }

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });
}

/** Show notification toast */
function showNotification(message, type = 'success') {
  document.querySelectorAll('.notification').forEach(n => n.remove());
  const el = document.createElement('div');
  el.className = 'notification ' + type;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}