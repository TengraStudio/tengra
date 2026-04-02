/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: '',
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
                '3xl': '1800px',
            },
        },
        extend: {
            fontFamily: {
                sans: ['var(--font-sans)', 'Segoe UI', 'Segoe UI Variable', 'system-ui', 'sans-serif'],
                display: ['var(--font-display)', 'Segoe UI', 'Segoe UI Variable', 'system-ui', 'sans-serif'],
                mono: ['var(--font-mono)', 'Cascadia Mono', 'Cascadia Code', 'Consolas', 'Courier New', 'ui-monospace', 'monospace'],
            },
            fontSize: {
                xxxs: ['0.625rem', { lineHeight: '1.2' }],
                xxs: ['0.6875rem', { lineHeight: '1.2' }],
                xs: ['0.8125rem', { lineHeight: '1.35' }],
                sm: ['0.875rem', { lineHeight: '1.55' }],
                base: ['1rem', { lineHeight: '1.68' }],
                lg: ['1.0625rem', { lineHeight: '1.68' }],
                xl: ['1.25rem', { lineHeight: '1.35' }],
                '2xl': ['1.5rem', { lineHeight: '1.35' }],
                '3xl': ['1.875rem', { lineHeight: '1.2' }],
                '4xl': ['2.25rem', { lineHeight: '1.2' }],
                '5xl': ['2.75rem', { lineHeight: '1.1' }],
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                /* Semantic Colors */
                success: {
                    DEFAULT: 'hsl(var(--success))',
                    foreground: 'hsl(var(--success-foreground))',
                    light: 'hsl(var(--success-light))',
                },
                warning: {
                    DEFAULT: 'hsl(var(--warning))',
                    foreground: 'hsl(var(--warning-foreground))',
                    light: 'hsl(var(--warning-light))',
                },
                info: {
                    DEFAULT: 'hsl(var(--info))',
                    foreground: 'hsl(var(--info-foreground))',
                    light: 'hsl(var(--info-light))',
                },
                error: {
                    DEFAULT: 'hsl(var(--error))',
                    foreground: 'hsl(var(--error-foreground))',
                },
                neutral: {
                    DEFAULT: 'hsl(var(--neutral))',
                    light: 'hsl(var(--neutral-light))',
                    dark: 'hsl(var(--neutral-dark))',
                },
                indigo: 'hsl(var(--indigo))',
                purple: 'hsl(var(--purple))',
                cyan: 'hsl(var(--cyan))',
                orange: 'hsl(var(--orange))',
                fuchsia: 'hsl(var(--fuchsia))',
                /* Brand/Icon Colors */
                brand: {
                    typescript: '#3178C6',
                    javascript: '#F7DF1E',
                    react: '#61DAFB',
                    python: '#3776AB',
                    rust: '#F37626',
                    database: '#DEA584',
                    go: '#00ADD8',
                    ruby: '#CC342D',
                    php: '#777BB4',
                    java: '#ED8B00',
                    swift: '#7F52FF',
                    c: '#A8B9CC',
                    cpp: '#00599C',
                    csharp: '#512BD4',
                    git: '#F05138',
                    flutter: '#0175C2',
                    html: '#E34F26',
                    css: '#1572B6',
                    sass: '#CF649A',
                    vue: '#42B883',
                    svelte: '#FF3E00',
                    angular: '#DD0031',
                    docker: '#2496ED',
                    kubernetes: '#326CE5',
                    nodejs: '#339933',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
            },
            transitionTimingFunction: {
                smooth: 'cubic-bezier(0.2, 0, 0, 1)',
            },
            scale: {
                102: '1.02',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
};
