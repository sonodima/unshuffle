// Random nicknames: "{title} {noun}", e.g. "DJ Churro". Fun, short and understood
// everywhere Spanish is spoken (food, animals, music). Combinations longer than
// 16 characters are skipped by the generator. Check new words for slang meanings
// in every Spanish-speaking country before adding them.
import type { Catalog } from '../../catalog'

export default {
  pattern: '{title} {noun}',
  titles: [
    'DJ', 'MC', 'Lady', 'Míster', 'Miss', 'Capitán', 'Doctor', 'Profe', 'Maestro', 'Tío',
    'Tía', 'Don', 'Doña', 'Baby', 'Lil', 'Big', 'King', 'Queen', 'Súper', 'Mega',
    'Chef', 'Conde', 'Duque', 'Sir', 'Abuela',
  ],
  nouns: [
    'Churro', 'Taco', 'Paella', 'Mango', 'Tamal', 'Burrito', 'Nacho', 'Arepa', 'Empanada',
    'Gazpacho', 'Aguacate', 'Guacamole', 'Croqueta', 'Flan', 'Turrón', 'Alfajor', 'Jalapeño',
    'Limón', 'Coco', 'Piña', 'Buñuelo', 'Polvorón', 'Mazapán', 'Ceviche', 'Horchata',
    'Quesadilla', 'Chocolate', 'Pimentón', 'Chipotle', 'Tequeño', 'Elote',
    'Llama', 'Alpaca', 'Tucán', 'Pingüino', 'Capibara', 'Ajolote', 'Perezoso', 'Mapache',
    'Koala', 'Panda', 'Flamenco', 'Pulpo', 'Erizo', 'Búho', 'Castor', 'Delfín', 'Iguana',
    'Colibrí', 'Tortuga', 'Hámster', 'Caracol', 'Cangrejo', 'Loro', 'Quetzal', 'Jaguar',
    'Chinchilla', 'Suricato', 'Nutria', 'Lémur',
    'Maraca', 'Bongó', 'Güiro', 'Cajón', 'Charango', 'Pandereta', 'Castañuela', 'Ukelele',
    'Marimba', 'Cencerro', 'Vinilo', 'Casete', 'Tocadiscos', 'Metrónomo', 'Theremín',
    'Kazoo', 'Triángulo', 'Acordeón', 'Trompeta', 'Timbal', 'Megáfono', 'Estribillo',
    'Falsete', 'Bemol', 'Remix', 'Karaoke', 'Subwoofer', 'Vocoder', 'Estéreo', 'Bolero',
    'Mambo', 'Cumbia', 'Salsa', 'Tango', 'Merengue',
  ],
} satisfies Catalog['names']
