import { SettingsModal } from './SettingsModal.js';

export function Header(navigate) {
    const header = document.createElement('header');
    header.className = 'w-full flex flex-col z-50 sticky top-0';

    const NAV_ITEMS = [
        { label: 'Image',        page: 'image' },
        { label: 'Video',        page: 'video' },
        { label: 'Lip Sync',     page: 'lipsync' },
        { label: 'Cinema Studio',page: 'cinema' },
        { label: 'Workflows',    page: 'workflows' },
        { label: 'Agents',       page: 'agents' },
        { label: 'MCP & CLI',    page: 'mcp-cli' },
    ];

    let activeItem = NAV_ITEMS[0];
    let mobileMenuOpen = false;

    // ── Main Navigation Bar ───────────────────────────────────────────────────
    const navBar = document.createElement('div');
    navBar.className = 'w-full h-16 bg-black flex items-center justify-between px-4 md:px-6 border-b border-white/5 backdrop-blur-md bg-opacity-95';

    const leftPart = document.createElement('div');
    leftPart.className = 'flex items-center gap-8';

    // Logo
    const logoContainer = document.createElement('div');
    logoContainer.className = 'cursor-pointer hover:scale-110 transition-transform';
    logoContainer.innerHTML = `
        <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1.5 shadow-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="black"/>
                <path d="M2 17L12 22L22 17" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `;

    // Desktop nav
    const menu = document.createElement('nav');
    menu.className = 'hidden lg:flex items-center gap-6 text-[13px] font-bold text-secondary';

    const desktopLinks = [];
    NAV_ITEMS.forEach(item => {
        const link = document.createElement('a');
        link.textContent = item.label;
        link.className = `hover:text-white transition-all cursor-pointer relative group ${item === activeItem ? 'text-white' : ''}`;

        if (item === activeItem) {
            const dot = document.createElement('div');
            dot.className = 'absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full';
            link.appendChild(dot);
        }

        link.onclick = () => {
            setActive(item);
            navigate(item.page);
        };

        desktopLinks.push(link);
        menu.appendChild(link);
    });

    leftPart.appendChild(logoContainer);
    leftPart.appendChild(menu);

    // ── Right side: hamburger (mobile) + settings ─────────────────────────────
    const rightPart = document.createElement('div');
    rightPart.className = 'flex items-center gap-3';

    // Hamburger button — only visible below lg
    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'lg:hidden flex items-center justify-center w-9 h-9 rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors';
    hamburgerBtn.setAttribute('aria-label', 'Toggle navigation');
    hamburgerBtn.innerHTML = `
        <svg id="hb-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        <svg id="hb-close" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:none">
            <line x1="4" y1="4" x2="20" y2="20"/>
            <line x1="20" y1="4" x2="4" y2="20"/>
        </svg>
    `;

    hamburgerBtn.onclick = () => {
        mobileMenuOpen = !mobileMenuOpen;
        mobileMenu.style.display = mobileMenuOpen ? 'flex' : 'none';
        hamburgerBtn.querySelector('#hb-open').style.display  = mobileMenuOpen ? 'none'  : '';
        hamburgerBtn.querySelector('#hb-close').style.display = mobileMenuOpen ? ''      : 'none';
    };

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-[13px] font-bold text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors';
    settingsBtn.title = 'Settings — API key, local models, preferences';
    settingsBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span class="hidden sm:inline">Settings</span>
    `;
    settingsBtn.onclick = () => {
        document.body.appendChild(SettingsModal());
    };

    rightPart.appendChild(hamburgerBtn);
    rightPart.appendChild(settingsBtn);

    navBar.appendChild(leftPart);
    navBar.appendChild(rightPart);
    header.appendChild(navBar);

    // ── Mobile dropdown menu ──────────────────────────────────────────────────
    const mobileMenu = document.createElement('nav');
    mobileMenu.className = 'lg:hidden flex-col bg-black border-b border-white/5';
    mobileMenu.style.display = 'none';

    const mobileLinks = [];
    NAV_ITEMS.forEach(item => {
        const link = document.createElement('a');
        link.textContent = item.label;
        link.className = `px-5 py-3.5 text-[13px] font-bold cursor-pointer border-b border-white/5 last:border-b-0 transition-colors ${item === activeItem ? 'text-white bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`;

        link.onclick = () => {
            setActive(item);
            navigate(item.page);
            mobileMenuOpen = false;
            mobileMenu.style.display = 'none';
            hamburgerBtn.querySelector('#hb-open').style.display  = '';
            hamburgerBtn.querySelector('#hb-close').style.display = 'none';
        };

        mobileLinks.push(link);
        mobileMenu.appendChild(link);
    });

    header.appendChild(mobileMenu);

    // ── Active state helper ───────────────────────────────────────────────────
    function setActive(item) {
        activeItem = item;

        desktopLinks.forEach((link, i) => {
            const isActive = NAV_ITEMS[i] === item;
            link.classList.toggle('text-white', isActive);
            link.classList.toggle('text-secondary', !isActive);
            const existingDot = link.querySelector('.bg-primary');
            if (isActive && !existingDot) {
                const dot = document.createElement('div');
                dot.className = 'absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full';
                link.appendChild(dot);
            } else if (!isActive && existingDot) {
                existingDot.remove();
            }
        });

        mobileLinks.forEach((link, i) => {
            const isActive = NAV_ITEMS[i] === item;
            link.className = `px-5 py-3.5 text-[13px] font-bold cursor-pointer border-b border-white/5 last:border-b-0 transition-colors ${isActive ? 'text-white bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`;
        });
    }

    return header;
}
