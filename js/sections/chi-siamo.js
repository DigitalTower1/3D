import { createCosmicCarousel } from '../cosmic-carousel.js';
import { getCosmicDeck } from '../decks.js';

export function showChiSiamo() {
    if (document.querySelector('.cosmic-carousel-overlay')) {
        return null;
    }

    const deck = getCosmicDeck('Chi Siamo');
    if (!deck) {
        return null;
    }

    return createCosmicCarousel({
        name: 'Chi Siamo',
        title: deck.title,
        description: deck.description,
        cards: deck.cards
    });
}
