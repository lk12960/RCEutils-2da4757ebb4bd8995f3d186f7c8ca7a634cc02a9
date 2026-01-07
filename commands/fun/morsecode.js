const { SlashCommandBuilder } = require('discord.js');

const morseMap = {
  A: '.-',     B: '-...',   C: '-.-.',   D: '-..',
  E: '.',      F: '..-.',   G: '--.',    H: '....',
  I: '..',     J: '.---',   K: '-.-',    L: '.-..',
  M: '--',     N: '-.',     O: '---',    P: '.--.',
  Q: '--.-',   R: '.-.',    S: '...',    T: '-',
  U: '..-',    V: '...-',   W: '.--',    X: '-..-',
  Y: '-.--',   Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--',
  4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.',
  ' ': '/',
  '.': '.-.-.-', ',': '--..--', '?': '..--..',
  "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};

const inverseMorseMap = Object.fromEntries(
  Object.entries(morseMap).map(([k, v]) => [v, k])
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('morse')
    .setDescription('Encode or decode Morse code.')
    .addSubcommand(sub =>
      sub.setName('encode')
        .setDescription('Convert text to Morse code.')
        .addStringOption(opt =>
          opt.setName('text')
            .setDescription('The text to encode')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('decode')
        .setDescription('Convert Morse code to text.')
        .addStringOption(opt =>
          opt.setName('code')
            .setDescription('Morse code (use space between letters, / between words)')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'encode') {
      const text = interaction.options.getString('text');
      const encoded = text.toUpperCase().split('').map(char => {
        return morseMap[char] || '';
      }).join(' ');

      return interaction.reply({
        content: `🔤 **Encoded to Morse:**\n\`\`\`\n${encoded}\n\`\`\``,
        ephemeral: true
      });
    }

    if (subcommand === 'decode') {
      const code = interaction.options.getString('code');
      const decoded = code.split(' ').map(part => {
        return inverseMorseMap[part] || '';
      }).join('');

      return interaction.reply({
        content: `📻 **Decoded from Morse:**\n\`\`\`\n${decoded}\n\`\`\``,
        ephemeral: true
      });
    }
  }
};
