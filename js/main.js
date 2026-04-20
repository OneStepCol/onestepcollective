/* One Step Collective — main.js */

// Nav scroll state
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open);
  document.body.style.overflow = open ? 'hidden' : '';
});

navLinks.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', false);
    document.body.style.overflow = '';
  });
});

// Scroll reveal
const observer = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  }),
  { threshold: 0.12 }
);

document.querySelectorAll(
  '.story__text, .story__card, .book__cover-wrap, .book__info, ' +
  '.merch__card, .contact__text, .contact__form, ' +
  '.section-label, .section-title'
).forEach((el, i) => {
  el.classList.add('reveal');
  el.style.transitionDelay = `${(i % 3) * 80}ms`;
  observer.observe(el);
});

// Contact form (front-end only — no backend)
document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const note = document.getElementById('formNote');
  note.textContent = 'Message received. We'll be in touch. 🌹';
  this.reset();
  setTimeout(() => { note.textContent = ''; }, 5000);
});
