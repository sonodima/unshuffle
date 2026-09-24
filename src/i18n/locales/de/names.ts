// Random nicknames: "{title} {noun}", e.g. "DJ Pinguin". Every combination that
// fits 16 characters can be drawn.
import type { Catalog } from '../../catalog'

export default {
  pattern: '{title} {noun}',
  titles: [
    'DJ', 'MC', 'Lady', 'Mister', 'Miss', 'Käpt’n', 'Doktor', 'Onkel', 'Tante', 'Oma',
    'Opa', 'Baby', 'Lil', 'Big', 'King', 'Queen', 'Sir', 'Mega', 'Super', 'Prof',
    'Graf', 'Gräfin', 'Baron', 'Madame', 'Meister', 'Herr', 'Frau', 'Prinz', 'Boss',
  ],
  nouns: [
    'Brezel', 'Schnitzel', 'Strudel', 'Knödel', 'Spätzle', 'Bratwurst', 'Currywurst',
    'Kartoffel', 'Gurke', 'Radieschen', 'Sauerkraut', 'Lebkuchen', 'Krapfen', 'Obatzda',
    'Leberkäs', 'Rollmops', 'Zwiebel', 'Waffel', 'Nudel', 'Pommes', 'Frikadelle', 'Quark',
    'Zimtstern', 'Gummibär', 'Rösti', 'Fondue', 'Maultasche', 'Streusel', 'Marzipan',
    'Semmel', 'Kohlrabi', 'Spargel',
    'Pinguin', 'Dackel', 'Igel', 'Otter', 'Faultier', 'Koala', 'Hamster', 'Alpaka', 'Panda',
    'Tukan', 'Gecko', 'Biber', 'Waschbär', 'Delfin', 'Capybara', 'Teddy', 'Eule', 'Lama',
    'Kater', 'Uhu', 'Axolotl', 'Murmeltier', 'Maulwurf', 'Hummel', 'Dachs', 'Mops', 'Pudel',
    'Elch', 'Walross', 'Wombat', 'Schnecke',
    'Tuba', 'Jodler', 'Ohrwurm', 'Vinyl', 'Mandoline', 'Tamburin', 'Kassette', 'Subwoofer',
    'Ukulele', 'Triangel', 'Maracas', 'Theremin', 'Piccolo', 'Metronom', 'Kazoo', 'Bongo',
    'Falsett', 'Refrain', 'Remix', 'Karaoke', 'Jukebox', 'Kopfhörer', 'Vocoder', 'Glitzer',
    'Stereo', 'Akkordeon', 'Polka', 'Walzer', 'Posaune', 'Alphorn', 'Zither', 'Mixtape',
    'Discokugel', 'Groove', 'Tröte', 'Lederhose',
  ],
} satisfies Catalog['names']
