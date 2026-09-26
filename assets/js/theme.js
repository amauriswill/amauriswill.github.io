(function () {
    'use strict';

    const STORAGE_KEY = 'theme';
    const DEFAULT_THEME = 'light';
    const root = document.documentElement;

    const switches = function () {
        return document.querySelectorAll('[data-theme-switch]');
    };

    const readChoice = function () {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch (error) {
return null;
        }
    };

    const writeChoice = function (value) {
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch (error) {
        }
    };

    const currentTheme = function () {
        const choice = readChoice();
        return (choice === 'dark' || choice === 'light') ? choice : DEFAULT_THEME;
    };

    const apply = function () {
        const theme = currentTheme();

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

    root.classList.add('js');

apply();
    document.addEventListener('DOMContentLoaded', apply);
    document.addEventListener('click', toggle);
})();
