/* ============================================================
   Quiet Motion — SOTA animation engine
   1. Reading progress bar
   2. Drifting pixel field + cursor reactivity
   3. Dual cursor (dot + ring)
   4. Magnetic buttons
   5. Sticky nav: scroll state + active section + monogram swap
   6. Portrait parallax / mouse-follow
   7. Letter-stagger delays for name reveal
   8. Scroll-reveal observer
   9. Smooth scroll for anchor links
   ============================================================ */

(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;

  /* ---------------- Year ---------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- Name letter-stagger ---------------- */
  document.querySelectorAll('.name__word').forEach((word, wi) => {
    const letters = word.querySelectorAll('.name__letter');
    letters.forEach((letter, i) => {
      const delay = (wi * 0.25) + (i * 0.045);
      letter.style.animationDelay = `${delay}s`;
    });
  });
  // Asterisk delay
  const total = document.querySelectorAll('.name__letter').length;
  const ast = document.querySelector('.name__ast');
  if (ast) {
    ast.style.animationDelay = `${(total * 0.045) + 0.5}s`;
    // Restart animation
    ast.style.animation = 'none';
    void ast.offsetWidth;
    ast.style.animation = '';
  }

  /* ---------------- Reading progress ---------------- */
  const progress = document.getElementById('reading-progress');
  function updateProgress() {
    if (!progress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    progress.style.width = `${ratio * 100}%`;
  }

  /* ---------------- Pixel field ---------------- */
  const canvas = document.getElementById('pixel-field');
  const ctx = canvas?.getContext('2d');
  let particles = [];
  let mouse = { x: -9999, y: -9999, active: false };
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const palette = [
    '#b85029', '#5d7a5f', '#4a6b8a', '#c89738',
    '#8e5d6f', '#2a2a2a', '#a8967a',
  ];

  function sizeCanvas() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  class Pixel {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x = Math.random() * window.innerWidth;
      this.y = Math.random() * window.innerHeight;
      this.size = 3 + Math.random() * 11;
      this.color = palette[Math.floor(Math.random() * palette.length)];
      this.baseOpacity = 0.18 + Math.random() * 0.45;
      this.opacity = initial ? this.baseOpacity : 0;
      this.targetOpacity = this.baseOpacity;
      this.vx = (Math.random() - 0.5) * 0.18;
      this.vy = (Math.random() - 0.5) * 0.18;
      this.phase = Math.random() * Math.PI * 2;
      this.phaseSpeed = 0.003 + Math.random() * 0.005;
      this.swayX = 0.4 + Math.random() * 0.8;
      this.swayY = 0.3 + Math.random() * 0.6;
      this.rotation = Math.random() * Math.PI;
      this.rotationSpeed = (Math.random() - 0.5) * 0.004;
      this.pushX = 0;
      this.pushY = 0;
    }
    update() {
      this.phase += this.phaseSpeed;
      this.x += this.vx + Math.cos(this.phase) * 0.06 * this.swayX;
      this.y += this.vy + Math.sin(this.phase * 0.8) * 0.06 * this.swayY;
      if (mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = 140;
        if (dist < radius && dist > 0.1) {
          const force = (1 - dist / radius) * 1.4;
          this.pushX += (dx / dist) * force;
          this.pushY += (dy / dist) * force;
        }
      }
      this.pushX *= 0.88;
      this.pushY *= 0.88;
      this.rotation += this.rotationSpeed;
      const m = 30;
      if (this.x < -m) this.x = window.innerWidth + m;
      if (this.x > window.innerWidth + m) this.x = -m;
      if (this.y < -m) this.y = window.innerHeight + m;
      if (this.y > window.innerHeight + m) this.y = -m;
      this.opacity += (this.targetOpacity - this.opacity) * 0.04;
    }
    draw() {
      const drawX = this.x + this.pushX;
      const drawY = this.y + this.pushY;
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      const r = Math.min(1.5, this.size * 0.18);
      const s = this.size;
      ctx.beginPath();
      ctx.moveTo(-s/2 + r, -s/2);
      ctx.lineTo( s/2 - r, -s/2);
      ctx.quadraticCurveTo(s/2, -s/2, s/2, -s/2 + r);
      ctx.lineTo( s/2,  s/2 - r);
      ctx.quadraticCurveTo(s/2, s/2, s/2 - r, s/2);
      ctx.lineTo(-s/2 + r, s/2);
      ctx.quadraticCurveTo(-s/2, s/2, -s/2, s/2 - r);
      ctx.lineTo(-s/2, -s/2 + r);
      ctx.quadraticCurveTo(-s/2, -s/2, -s/2 + r, -s/2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function initParticles() {
    if (!canvas) return;
    particles = [];
    const area = window.innerWidth * window.innerHeight;
    const count = Math.min(56, Math.max(24, Math.floor(area / 28000)));
    for (let i = 0; i < count; i++) particles.push(new Pixel());
  }

  function loop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) { p.update(); p.draw(); }
    requestAnimationFrame(loop);
  }

  if (canvas && ctx && !reducedMotion) {
    sizeCanvas();
    initParticles();
    loop();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { sizeCanvas(); initParticles(); }, 180);
    });
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    });
    window.addEventListener('mouseleave', () => { mouse.active = false; });
  }

  /* ---------------- Dual cursor (dot + ring) ---------------- */
  const cursorDot = document.getElementById('cursor-dot');
  const cursorRing = document.getElementById('cursor-ring');
  if (cursorDot && cursorRing && !isCoarse && !reducedMotion) {
    let dx = 0, dy = 0, rx = 0, ry = 0, tx = 0, ty = 0;
    let firstMove = false;

    window.addEventListener('mousemove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!firstMove) {
        firstMove = true;
        cursorDot.classList.add('is-visible');
        cursorRing.classList.add('is-visible');
        dx = tx; dy = ty;
        rx = tx; ry = ty;
      }
    });

    function tickCursor() {
      dx += (tx - dx) * 0.32;
      dy += (ty - dy) * 0.32;
      rx += (tx - rx) * 0.14;
      ry += (ty - ry) * 0.14;
      cursorDot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
      cursorRing.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(tickCursor);
    }
    tickCursor();

    document.querySelectorAll('a, button, tr.paper, .thumb, .portrait, .news-item p, .beyond__hero').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        cursorDot.classList.add('is-hover');
        cursorRing.classList.add('is-hover');
      });
      el.addEventListener('mouseleave', () => {
        cursorDot.classList.remove('is-hover');
        cursorRing.classList.remove('is-hover');
      });
    });

    document.addEventListener('mouseleave', () => {
      cursorDot.classList.remove('is-visible');
      cursorRing.classList.remove('is-visible');
    });
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (!isCoarse && !reducedMotion) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      const strength = 0.32;
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) * strength;
        const dy = (e.clientY - cy) * strength;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ---------------- Portrait parallax ---------------- */
  const portrait = document.getElementById('portrait');
  if (portrait && !isCoarse && !reducedMotion) {
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    window.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = ((e.clientX - cx) / cx) * 6;
      targetY = ((e.clientY - cy) / cy) * 6;
    });
    function tickPortrait() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      portrait.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      requestAnimationFrame(tickPortrait);
    }
    tickPortrait();
  }

  /* ---------------- Nav: scroll state + progress + active section ---------------- */
  const nav = document.getElementById('site-nav');
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 32);
        updateProgress();
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Active section highlight
  const navLinks = document.querySelectorAll('.nav-links a[data-nav]');
  const sections = [...navLinks].map((a) => {
    const id = a.getAttribute('href').slice(1);
    return document.getElementById(id);
  }).filter(Boolean);

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((a) => {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => sectionObserver.observe(s));

  /* ---------------- Scroll reveal ---------------- */
  const revealTargets = [
    '.meta-line',
    '.name',
    '.hero__role',
    '.hero__lead',
    '.hero__text p:not(.hero__lead)',
    '.hero__links',
    '.hero__portrait',
    '.section-h-row',
    '.section-hint',
    '.news-item p',
    'tr.paper',
    '.beyond__hero',
    '.beyond__text',
    '.contact__lead',
    '.contact__email',
    '.contact__links',
  ];

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  let delayCounter = 0;
  document.querySelectorAll(revealTargets.join(',')).forEach((el) => {
    el.classList.add('reveal');
    const delay = ((delayCounter++ % 4) + 1);
    el.setAttribute('data-delay', String(delay));
    observer.observe(el);
  });

  /* ---------------- Smooth scroll ---------------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });
})();
