// ===========================
// LANÇA.DEV — SCRIPTS
// ===========================

// Mobile menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('open');
});

document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('open');
    });
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
});

// Nav scroll class
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
});

// Mobile sticky CTA — esconde quando hero CTA está visível
const mobileCta = document.getElementById('mobileCta');
const heroCtas = document.querySelector('.hero-ctas');

if (mobileCta && heroCtas) {
    const obs = new IntersectionObserver(entries => {
        mobileCta.style.opacity = entries[0].isIntersecting ? '0' : '1';
        mobileCta.style.pointerEvents = entries[0].isIntersecting ? 'none' : 'auto';
    }, { threshold: 0.5 });
    obs.observe(heroCtas);
}

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.parentElement;
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
    });
});

// Fade-in on scroll
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.08 });

document.querySelectorAll(
    '.service-card, .diferencial-card, .step, .portfolio-card, .testimonial-card, .faq-item'
).forEach((el, i) => {
    el.classList.add('fade-in');
    el.style.transitionDelay = `${(i % 3) * 80}ms`;
    observer.observe(el);
});
