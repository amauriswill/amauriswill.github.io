/**
 * theme.js — Interruptor de tema claro/oscuro.
 * -----------------------------------------------------------------------------
 * Sin dependencias. El sistema manda por defecto (prefers-color-scheme) y el
 * interruptor fija la preferencia, que se recuerda en localStorage.
 * Se carga de forma bloqueante en <head> para que no haya destello de tema.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'theme';
    const DEFAULT_THEME = 'light'; // el sitio nace claro, sin mirar el sistema
    const root = document.documentElement;

    const switches = function () {
        return document.querySelectorAll('[data-theme-switch]');
    };

    const readChoice = function () {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null; // modo privado o almacenamiento bloqueado
        }
    };

    const writeChoice = function (value) {
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch (error) {
            /* sin persistencia: el tema dura solo esta visita */
        }
    };

    const currentTheme = function () {
        const choice = readChoice();
        return (choice === 'dark' || choice === 'light') ? choice : DEFAULT_THEME;
    };

    const apply = function () {
        const theme = currentTheme();

        // Sin atributo, :root ya es claro: el atributo solo hace falta para el oscuro.
        if (theme === DEFAULT_THEME) {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', theme);
        }

        switches().forEach(function (button) {
            button.setAttribute('aria-checked', String(theme === 'dark'));
        });
    };

    const toggle = function (event) {
        const button = event.target.closest('[data-theme-switch]');
        if (!button) {
            return;
        }
        writeChoice(currentTheme() === 'dark' ? 'light' : 'dark');
        apply();
    };

    // Marca el documento para que el CSS muestre el interruptor, y solo él.
    root.classList.add('js');

    apply(); // antes de pintar el cuerpo: el script es bloqueante en <head>
    document.addEventListener('DOMContentLoaded', apply);
    document.addEventListener('click', toggle);
})();
