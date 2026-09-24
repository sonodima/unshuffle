// Random nicknames: "{title} {noun}", e.g. "DJ Capivara". Fun, local and short:
// most combinations fit 16 characters (longer ones are skipped by the generator).
import type { Catalog } from '../../catalog'

export default {
  pattern: '{title} {noun}',
  titles: [
    'DJ', 'MC', 'Lady', 'Miss', 'Mister', 'Capitão', 'Doutor', 'Mestre', 'Tio', 'Tia',
    'Vovó', 'Vovô', 'Dona', 'Seu', 'Baby', 'Lil', 'Big', 'Mega', 'Super', 'Prof',
    'Barão', 'Conde', 'Rei', 'Rainha', 'Madame', 'Chefe', 'Mano', 'Dom',
  ],
  nouns: [
    'Brigadeiro', 'Coxinha', 'Pastel', 'Pão de Queijo', 'Beijinho', 'Quindim', 'Cocada',
    'Paçoca', 'Pamonha', 'Pudim', 'Esfiha', 'Empada', 'Açaí', 'Tapioca', 'Farofa',
    'Feijoada', 'Acarajé', 'Cuscuz', 'Pipoca', 'Canjica', 'Goiabada', 'Rapadura', 'Guaraná',
    'Caju', 'Jabuticaba', 'Maracujá', 'Pitanga', 'Picolé', 'Bombom', 'Churros', 'Mandioca',
    'Torresmo', 'Moqueca', 'Pequi', 'Biscoito', 'Bolacha', 'Sonho', 'Chimarrão',
    'Tucano', 'Capivara', 'Tatu', 'Jacaré', 'Quati', 'Arara', 'Papagaio', 'Preguiça',
    'Tamanduá', 'Boto', 'Jabuti', 'Pinguim', 'Coruja', 'Beija-flor', 'Sabiá', 'Bem-te-vi',
    'Calango', 'Siri', 'Tartaruga', 'Lobo-guará', 'Onça', 'Periquito', 'Guaxinim', 'Ouriço',
    'Polvo', 'Flamingo', 'Coala', 'Lhama',
    'Pandeiro', 'Cuíca', 'Cavaquinho', 'Berimbau', 'Agogô', 'Tamborim', 'Zabumba', 'Sanfona',
    'Triângulo', 'Chocalho', 'Reco-reco', 'Vinil', 'Vitrola', 'Radinho', 'Fita K7', 'Karaokê',
    'Jukebox', 'Batidão', 'Refrão', 'Falsete', 'Solinho', 'Bemol', 'Metrônomo', 'Remix',
    'Sambinha', 'Forró', 'Frevo', 'Baião', 'Maracatu', 'Chorinho', 'Batuque', 'Purpurina',
    'Paetê', 'Microfone',
  ],
} satisfies Catalog['names']
