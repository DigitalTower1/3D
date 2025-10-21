const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const AUTO_ROTATE_INTERVAL = 10000;

function renderTags(tags) {
    if (!Array.isArray(tags) || !tags.length) return '';
    return `<ul class="portal-card__tags" aria-label="Parole chiave">${tags
        .map((tag) => `<li>${tag}</li>`)
        .join('')}</ul>`;
}

function renderHighlights(highlights) {
    if (!Array.isArray(highlights) || !highlights.length) return '';
    return `<ul class="portal-card__highlights">${highlights
        .map((item) => `<li><span class="portal-card__bullet" aria-hidden="true"></span>${item}</li>`)
        .join('')}</ul>`;
}

function renderForm(form) {
    if (!form || !Array.isArray(form.fields)) return '';
    const groups = Array.isArray(form.groups) ? form.groups : [];
    const groupMap = new Map(groups.map((group) => [group.key, group]));

    const fieldsMarkup = form.fields
        .map((field, index) => {
            const id = `${field.name || `field-${index}`}`;
            const group = groupMap.get(field.group);
            const spanClass = group?.span === 'full' ? ' portal-form__field--full' : '';
            const common = `id="${id}" name="${field.name || id}"${field.required ? ' required' : ''}`;

            if (field.type === 'textarea') {
                return `<label class="portal-form__field${spanClass}">
    <span>${field.label ?? ''}</span>
    <textarea ${common} placeholder="${field.placeholder ?? ''}" rows="4"></textarea>
</label>`;
            }

            if (field.type === 'select') {
                const options = Array.isArray(field.options) ? field.options : [];
                return `<label class="portal-form__field${spanClass}">
    <span>${field.label ?? ''}</span>
    <select ${common}>
        ${options.map((option) => `<option value="${option}">${option}</option>`).join('')}
    </select>
</label>`;
            }

            return `<label class="portal-form__field${spanClass}">
    <span>${field.label ?? ''}</span>
    <input type="${field.type || 'text'}" ${common} placeholder="${field.placeholder ?? ''}" />
</label>`;
        })
        .join('');

    const groupLegend = groups
        .map((group) => {
            const accent = group.accent ? ` style="--accent:${group.accent}"` : '';
            return `<div class="portal-form__group"${accent}>
    <span class="portal-form__group-indicator" aria-hidden="true"></span>
    <div>
        <p class="portal-form__group-title">${group.title ?? ''}</p>
        <p class="portal-form__group-description">${group.description ?? ''}</p>
    </div>
</div>`;
        })
        .join('');

    return `<form class="portal-form" novalidate>
    <div class="portal-form__groups" aria-hidden="true">${groupLegend}</div>
    <div class="portal-form__fields">${fieldsMarkup}</div>
    <button type="submit" class="portal-form__submit">${form.submitLabel ?? 'Invia'}</button>
</form>`;
}

function renderContact(contact) {
    if (!contact || !Array.isArray(contact.items)) return '';
    const items = contact.items
        .map((item) => {
            if (item.link) {
                return `<li><a href="${item.link}">${item.label ?? ''}<span>${item.value ?? ''}</span></a></li>`;
            }
            return `<li><span class="portal-contact__label">${item.label ?? ''}</span><span>${item.value ?? ''}</span></li>`;
        })
        .join('');
    const cta = contact.cta
        ? `<a class="portal-contact__cta" href="${contact.cta.link}" target="_blank" rel="noopener">${contact.cta.label}</a>`
        : '';
    return `<div class="portal-contact">
    <ul>${items}</ul>
    ${cta}
</div>`;
}

function createCardElement(card) {
    const cardEl = document.createElement('li');
    cardEl.className = 'portal-card';
    cardEl.dataset.key = card.key || '';
    cardEl.setAttribute('role', 'listitem');
    cardEl.innerHTML = `
        <div class="portal-card__inner">
            <div class="portal-card__face portal-card__face--front">
                <div class="portal-card__copy">
                    ${card.subtitle ? `<p class="portal-card__eyebrow">${card.subtitle}</p>` : ''}
                    <h3 class="portal-card__title">${card.title ?? ''}</h3>
                    ${card.summary ? `<p class="portal-card__summary">${card.summary}</p>` : ''}
                </div>
                ${renderTags(card.tags)}
                <button type="button" class="portal-card__toggle" data-card-toggle aria-expanded="false">
                    <span>Apri dettagli</span>
                </button>
            </div>
            <div class="portal-card__face portal-card__face--back">
                <div class="portal-card__back-scroll">
                    ${card.detail ? `<p class="portal-card__detail">${card.detail}</p>` : ''}
                    ${renderHighlights(card.highlights)}
                    ${card.form ? renderForm(card.form) : ''}
                    ${card.contact ? renderContact(card.contact) : ''}
                </div>
                <button type="button" class="portal-card__toggle portal-card__toggle--close" data-card-toggle aria-expanded="false">
                    <span>Chiudi dettagli</span>
                </button>
            </div>
        </div>`;
    return cardEl;
}

function computePosition(index, activeIndex, total) {
    if (total === 1) return 'center';
    if (index === activeIndex) return 'center';
    const prev = (activeIndex - 1 + total) % total;
    const next = (activeIndex + 1) % total;
    if (index === prev) return 'left';
    if (index === next) return 'right';
    return 'hidden';
}

function focusFirstElement(container) {
    const focusable = container.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length) {
        const first = focusable[0];
        first.focus({ preventScroll: true });
    }
}

export function launchPortalCarousel({ name, title, description, cards = [], onClose }) {
    if (!Array.isArray(cards) || cards.length === 0) {
        console.warn('[PortalCarousel] Nessuna card disponibile per il portale', name);
        return null;
    }

    const titleId = `portal-overlay-title-${Math.random().toString(36).slice(2, 8)}`;
    const descriptionId = description ? `${titleId}-desc` : null;

    const overlay = document.createElement('div');
    overlay.className = 'portal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', titleId);
    if (descriptionId) {
        overlay.setAttribute('aria-describedby', descriptionId);
    }
    overlay.innerHTML = `
        <div class="portal-overlay__backdrop" data-close-overlay></div>
        <div class="portal-overlay__shell">
            <header class="portal-overlay__header">
                <div class="portal-overlay__heading">
                    ${name ? `<p class="portal-overlay__label">${name}</p>` : ''}
                    <h2 class="portal-overlay__title" id="${titleId}">${title ?? ''}</h2>
                    ${description ? `<p class="portal-overlay__description" id="${descriptionId}">${description}</p>` : ''}
                </div>
                <button type="button" class="portal-overlay__close" data-close-overlay aria-label="Chiudi portale">
                    <span aria-hidden="true">×</span>
                </button>
            </header>
            <div class="portal-overlay__stage" data-stage>
                <ul class="portal-deck" role="list"></ul>
                <div class="portal-overlay__nav">
                    <button type="button" class="portal-overlay__nav-btn" data-nav="prev" aria-label="Carta precedente">‹</button>
                    <div class="portal-overlay__dots" role="tablist" aria-label="Scorri carte"></div>
                    <button type="button" class="portal-overlay__nav-btn" data-nav="next" aria-label="Carta successiva">›</button>
                </div>
            </div>
        </div>`;

    const deckEl = overlay.querySelector('.portal-deck');
    const dotsEl = overlay.querySelector('.portal-overlay__dots');
    const stageEl = overlay.querySelector('[data-stage]');

    const cardElements = cards.map((card) => {
        const cardEl = createCardElement(card);
        deckEl.appendChild(cardEl);
        return cardEl;
    });

    cards.forEach((card, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'portal-overlay__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Vai alla card ${index + 1}`);
        dot.dataset.index = String(index);
        dotsEl.appendChild(dot);
    });

    let activeIndex = 0;
    let autoRotateTimer = null;
    let pointerDown = false;

    function setCardState(cardEl, position, index) {
        cardEl.classList.toggle('portal-card--center', position === 'center');
        cardEl.classList.toggle('portal-card--left', position === 'left');
        cardEl.classList.toggle('portal-card--right', position === 'right');
        cardEl.classList.toggle('portal-card--hidden', position === 'hidden');
        cardEl.classList.remove('portal-card--flipped');
        cardEl.setAttribute('tabindex', position === 'center' ? '0' : '-1');
        cardEl.setAttribute('aria-hidden', position === 'hidden' ? 'true' : 'false');
        cardEl.dataset.position = position;
        cardEl.dataset.index = String(index);
        if (position !== 'center') {
            cardEl.style.removeProperty('--tilt-x');
            cardEl.style.removeProperty('--tilt-y');
            cardEl.style.removeProperty('--tilt-z');
            cardEl.style.removeProperty('--raise');
            cardEl.style.removeProperty('--press');
        }
    }

    function updateDeck(fromUser = false) {
        cardElements.forEach((cardEl, index) => {
            const position = computePosition(index, activeIndex, cardElements.length);
            setCardState(cardEl, position, index);
        });

        const dots = dotsEl.querySelectorAll('.portal-overlay__dot');
        dots.forEach((dot) => {
            const index = Number(dot.dataset.index);
            const isActive = index === activeIndex;
            dot.classList.toggle('is-active', isActive);
            dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
            dot.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        if (fromUser) {
            resetAutoRotate();
        }
    }

    function rotate(step, fromUser = false) {
        const total = cardElements.length;
        activeIndex = (activeIndex + step + total) % total;
        updateDeck(fromUser);
    }

    function resetAutoRotate() {
        if (autoRotateTimer) {
            clearInterval(autoRotateTimer);
            autoRotateTimer = null;
        }
        if (cardElements.length <= 1) return;
        autoRotateTimer = setInterval(() => rotate(1, false), AUTO_ROTATE_INTERVAL);
    }

    function stopAutoRotate() {
        if (autoRotateTimer) {
            clearInterval(autoRotateTimer);
            autoRotateTimer = null;
        }
    }

    function handleDotClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement) || !target.dataset.index) return;
        const index = Number(target.dataset.index);
        if (!Number.isFinite(index)) return;
        activeIndex = index;
        updateDeck(true);
    }

    function getCenterCard() {
        return cardElements.find((card) => card.dataset.position === 'center') || null;
    }

    function toggleCard(cardEl) {
        if (!cardEl.classList.contains('portal-card--center')) return;
        const isFlipped = cardEl.classList.toggle('portal-card--flipped');
        const toggleButtons = cardEl.querySelectorAll('[data-card-toggle]');
        toggleButtons.forEach((btn) => btn.setAttribute('aria-expanded', isFlipped ? 'true' : 'false'));
        if (isFlipped) {
            const back = cardEl.querySelector('.portal-card__face--back');
            if (back) {
                const focusable = back.querySelector(FOCUSABLE_SELECTOR);
                if (focusable instanceof HTMLElement) {
                    focusable.focus({ preventScroll: true });
                }
            }
        } else {
            cardEl.focus({ preventScroll: true });
        }
    }

    function handleCardClick(event) {
        const cardEl = event.target.closest('.portal-card');
        if (!cardEl) return;
        if (!cardEl.classList.contains('portal-card--center')) {
            activeIndex = Number(cardEl.dataset.index || 0);
            updateDeck(true);
            return;
        }
        const toggle = event.target.closest('[data-card-toggle]');
        if (toggle) {
            toggleCard(cardEl);
        }
    }

    function handleCardKeydown(event) {
        const cardEl = event.target.closest('.portal-card');
        if (!cardEl || !cardEl.classList.contains('portal-card--center')) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleCard(cardEl);
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            rotate(-1, true);
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            rotate(1, true);
        }
    }

    function updateTilt(event) {
        const centerCard = getCenterCard();
        if (!centerCard) return;
        const rect = stageEl.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        centerCard.style.setProperty('--tilt-x', `${(-y * 10).toFixed(2)}deg`);
        centerCard.style.setProperty('--tilt-y', `${(x * 14).toFixed(2)}deg`);
        centerCard.style.setProperty('--tilt-z', `${(x * -2).toFixed(2)}deg`);
        const depth = 26 - Math.min(22, (Math.abs(x) + Math.abs(y)) * 28);
        centerCard.style.setProperty('--raise', `${depth}px`);
    }

    function resetTilt() {
        const centerCard = getCenterCard();
        if (!centerCard) return;
        centerCard.style.setProperty('--tilt-x', '0deg');
        centerCard.style.setProperty('--tilt-y', '0deg');
        centerCard.style.setProperty('--tilt-z', '0deg');
        centerCard.style.setProperty('--raise', '0px');
        centerCard.style.setProperty('--press', pointerDown ? '18px' : '0px');
    }

    function handlePointerDown(event) {
        if (!getCenterCard()) return;
        pointerDown = true;
        const centerCard = getCenterCard();
        centerCard?.style.setProperty('--press', '18px');
        if (event.pointerType !== 'touch') {
            updateTilt(event);
        }
    }

    function handlePointerMove(event) {
        if (event.pointerType === 'touch') return;
        updateTilt(event);
    }

    function handlePointerUp() {
        pointerDown = false;
        const centerCard = getCenterCard();
        centerCard?.style.setProperty('--press', '0px');
        resetTilt();
    }

    function closeOverlay() {
        stopAutoRotate();
        window.removeEventListener('keydown', handleKeydown);
        stageEl.removeEventListener('pointerdown', handlePointerDown);
        stageEl.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        stageEl.removeEventListener('pointerleave', resetTilt);
        deckEl.removeEventListener('click', handleCardClick);
        deckEl.removeEventListener('keydown', handleCardKeydown, true);
        dotsEl.removeEventListener('click', handleDotClick);
        overlay.removeEventListener('keydown', trapFocus);

        overlay.classList.remove('is-visible');
        overlay.addEventListener(
            'transitionend',
            () => {
                overlay.remove();
            },
            { once: true }
        );

        if (typeof onClose === 'function') {
            onClose();
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeOverlay();
            return;
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            rotate(-1, true);
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            rotate(1, true);
        }
    }

    function handleNavClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement) || !target.dataset.nav) return;
        rotate(target.dataset.nav === 'next' ? 1 : -1, true);
    }

    overlay.addEventListener('click', (event) => {
        const closeTarget = event.target.closest('[data-close-overlay]');
        if (closeTarget) {
            event.preventDefault();
            closeOverlay();
        }
    });

    overlay.querySelectorAll('[data-nav]').forEach((btn) => {
        btn.addEventListener('click', handleNavClick);
    });

    overlay.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        event.preventDefault();
        const status = document.createElement('p');
        status.className = 'portal-form__status';
        status.textContent = 'Richiesta inviata! Ti ricontatteremo entro 24 ore.';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        const submit = form.querySelector('.portal-form__submit');
        if (submit instanceof HTMLButtonElement) {
            submit.disabled = true;
            submit.textContent = 'Inviato';
        }
        if (!form.querySelector('.portal-form__status')) {
            form.appendChild(status);
        }
    });

    function trapFocus(event) {
        if (event.key !== 'Tab') return;
        const focusable = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => !el.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
            if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    overlay.addEventListener('keydown', trapFocus);

    dotsEl.addEventListener('click', handleDotClick);
    deckEl.addEventListener('click', handleCardClick);
    deckEl.addEventListener('keydown', handleCardKeydown, true);

    stageEl.addEventListener('pointerdown', handlePointerDown);
    stageEl.addEventListener('pointermove', handlePointerMove);
    stageEl.addEventListener('pointerleave', resetTilt);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeydown);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    updateDeck(false);
    resetAutoRotate();
    focusFirstElement(overlay);

    overlay.dataset.portalName = name ?? '';

    return {
        element: overlay,
        destroy: closeOverlay
    };
}

