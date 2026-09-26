/**
 * reading-progress.js — Barra de progreso de lectura.
 * -----------------------------------------------------------------------------
 * Una línea del color de acento arriba que crece con el scroll, como la de
 * ivan.codes. Sin dependencias; el cálculo se agrupa por fotogramas para no
 * provocar reflows en cada evento de scroll.
 */
(function () {
    'use strict';

    const bar = document.querySelector('[data-reading-progress]');
    if (!bar) {
        return;
    }

    let pending = false;

    const update = function () {
        const root = document.documentElement;
        const scrollable = root.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
        bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, ratio)) + ')';
        pending = false;
    };

    const request = function () {
        if (!pending) {
            pending = true;
            window.requestAnimationFrame(update);
        }
    };

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    update();
})();
