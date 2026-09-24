// Random nicknames: "{title} {noun}", e.g. "DJ Pancake". Fun, local and short:
// the generator keeps only the combinations that fit 16 characters.
import type { Catalog } from '../../catalog'

export default {
  pattern: '{title} {noun}',
  titles: [
    'DJ', 'MC', 'Lil', 'Big', 'Sir', 'Lady', 'Captain', 'Dr.', 'Mr.', 'Miss', 'King', 'Queen',
    'Duke', 'Duchess', 'Count', 'Lord', 'Prof', 'Coach', 'Chef', 'Agent', 'Auntie', 'Uncle',
    'Granny', 'Baby', 'Mega', 'Turbo', 'Maestro',
  ],
  nouns: [
    'Pancake', 'Waffle', 'Nugget', 'Pretzel', 'Taco', 'Burrito', 'Noodle', 'Crouton', 'Cupcake',
    'Donut', 'Bagel', 'Gumdrop', 'Nacho', 'Biscuit', 'Meatball', 'Pudding', 'Popcorn', 'Cookie',
    'Brownie', 'Churro', 'Dumpling', 'Tater Tot', 'Jellybean', 'Avocado', 'Cheddar', 'Milkshake',
    'Peanut', 'Sprinkles', 'Corn Dog', 'Marshmallow',
    'Llama', 'Alpaca', 'Sloth', 'Penguin', 'Otter', 'Walrus', 'Panda', 'Koala', 'Hamster',
    'Raccoon', 'Platypus', 'Narwhal', 'Flamingo', 'Gecko', 'Toucan', 'Capybara', 'Axolotl',
    'Hedgehog', 'Goose', 'Moose', 'Badger', 'Lobster', 'Puffin', 'Corgi', 'Wombat', 'Octopus',
    'Pelican',
    'Kazoo', 'Falsetto', 'Subwoofer', 'Banjo', 'Ukulele', 'Bongo', 'Maraca', 'Tuba', 'Cowbell',
    'Theremin', 'Tambourine', 'Triangle', 'Vinyl', 'Cassette', 'Mixtape', 'Jukebox', 'Karaoke',
    'Encore', 'Remix', 'Bassline', 'Harmonica', 'Piccolo', 'Metronome', 'Boombox', 'Vocoder',
    'Trombone', 'Xylophone', 'Disco Ball', 'Air Guitar', 'Glitter',
  ],
} satisfies Catalog['names']
