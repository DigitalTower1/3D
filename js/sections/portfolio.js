import { createCosmicCarousel } from '../cosmic-carousel.js';
import { getCosmicDeck } from '../decks.js';

export function showPortfolio() {
    if (document.querySelector('.cosmic-carousel-overlay')) {
        return null;
    }

    const deck = getCosmicDeck('Portfolio');
    if (!deck) {
        return null;
    }

    return createCosmicCarousel({
        name: 'Portfolio',
        title: deck.title,
        description: deck.description,
        cards: deck.cards
    });
}
