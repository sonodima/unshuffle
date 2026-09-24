// Random nicknames: "{title} {noun}", e.g. "DJ Croissant". Fun, local and short:
// the generator keeps the combinations that fit 16 characters. Titles are
// invariable (no adjective that would need to agree with the noun's gender).
import type { Catalog } from '../../catalog'

export default {
  pattern: '{title} {noun}',
  titles: [
    'DJ', 'MC', 'Lady', 'Mister', 'Miss', 'Capitaine', 'Docteur', 'Maître', 'Tonton', 'Tatie',
    'Mamie', 'Papy', 'Baby', 'Lil', 'Big', 'King', 'Queen', 'Sir', 'Méga', 'Super',
    'Prof', 'Comte', 'Duc', 'Baron', 'Madame', 'Monsieur', 'Chef', 'Mini',
  ],
  nouns: [
    'Croissant', 'Baguette', 'Camembert', 'Macaron', 'Escargot', 'Crêpe', 'Brioche', 'Éclair',
    'Madeleine', 'Quiche', 'Raclette', 'Fondue', 'Cassoulet', 'Cornichon', 'Chouquette',
    'Praline', 'Nougat', 'Clafoutis', 'Roquefort', 'Brie', 'Beignet', 'Gaufre', 'Chocolatine',
    'Canelé', 'Calisson', 'Radis', 'Artichaut', 'Poireau', 'Cacahuète', 'Pistache', 'Saucisson',
    'Pingouin', 'Hérisson', 'Castor', 'Hibou', 'Koala', 'Panda', 'Lama', 'Alpaga', 'Paresseux',
    'Flamant', 'Poulpe', 'Loutre', 'Marmotte', 'Écureuil', 'Hamster', 'Toucan', 'Gecko',
    'Dauphin', 'Capybara', 'Axolotl', 'Ouistiti', 'Canard', 'Homard', 'Lapin', 'Poussin',
    'Bourdon', 'Tortue', 'Zèbre', 'Morse', 'Suricate', 'Chinchilla',
    'Vinyle', 'Accordéon', 'Tambourin', 'Cassette', 'Platine', 'Ukulélé', 'Triangle', 'Maracas',
    'Thérémine', 'Piccolo', 'Métronome', 'Kazoo', 'Bongo', 'Refrain', 'Solo', 'Bémol', 'Dièse',
    'Remix', 'Karaoké', 'Juke-box', 'Vocodeur', 'Paillette', 'Stéréo', 'Biniou', 'Banjo',
    'Djembé', 'Tuba', 'Synthé', 'Disco', 'Mégaphone', 'Tube',
  ],
} satisfies Catalog['names']
