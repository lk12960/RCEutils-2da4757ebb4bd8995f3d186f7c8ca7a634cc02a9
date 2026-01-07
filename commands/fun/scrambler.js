const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const db = require('../../database/db.js'); // Adjust path if needed

// Word pools by difficulty
const WORD_POOLS = {
  'very-easy': [
    'tiger', 'monkey', 'dolphin', 'rabbit', 'zebra',
    'cactus', 'river', 'flower', 'ocean', 'panda',
    'pizza', 'cookie', 'bread', 'carrot', 'lemon',
    'spoon', 'chair', 'table', 'bottle', 'blanket',
    'doctor', 'farmer', 'pirate', 'clown', 'baby',
    'hero', 'singer', 'robot', 'queen', 'chef',
    'school', 'park', 'beach', 'farm', 'zoo',
    'house', 'city', 'cave', 'shop', 'tower',
    'cloud', 'mountain', 'rain', 'sunny', 'snow',
    'apple', 'melon', 'plum', 'peach', 'berry',
    'train', 'truck', 'boat', 'plane', 'bus',
    'sock', 'shoe', 'hat', 'glove', 'scarf',
    'clock', 'bell', 'lamp', 'phone', 'brush',
    'book', 'pen', 'paper', 'bag', 'box'
],
    'easy': [
    'tiger', 'monkey', 'dolphin', 'rabbit', 'zebra',
    'cactus', 'river', 'flower', 'ocean', 'panda',
    'pizza', 'cookie', 'bread', 'carrot', 'lemon',
    'spoon', 'chair', 'table', 'bottle', 'blanket',
    'doctor', 'farmer', 'pirate', 'clown', 'baby',
    'hero', 'singer', 'robot', 'queen', 'chef',
    'school', 'park', 'beach', 'farm', 'zoo',
    'house', 'city', 'cave', 'shop', 'tower',
    'cloud', 'mountain', 'rain', 'sunny', 'snow',
    'apple', 'melon', 'plum', 'peach', 'berry',
    'train', 'truck', 'boat', 'plane', 'bus',
    'sock', 'shoe', 'hat', 'glove', 'scarf',
    'clock', 'bell', 'lamp', 'phone', 'brush',
    'book', 'pen', 'paper', 'bag', 'box'
],
    'normal': [
    'tiger', 'monkey', 'dolphin', 'rabbit', 'zebra',
    'cactus', 'river', 'flower', 'ocean', 'panda',
    'pizza', 'cookie', 'bread', 'carrot', 'lemon',
    'spoon', 'chair', 'table', 'bottle', 'blanket',
    'doctor', 'farmer', 'pirate', 'clown', 'baby',
    'hero', 'singer', 'robot', 'queen', 'chef',
    'school', 'park', 'beach', 'farm', 'zoo',
    'house', 'city', 'cave', 'shop', 'tower',
    'cloud', 'mountain', 'rain', 'sunny', 'snow',
    'apple', 'melon', 'plum', 'peach', 'berry',
    'train', 'truck', 'boat', 'plane', 'bus',
    'sock', 'shoe', 'hat', 'glove', 'scarf',
    'clock', 'bell', 'lamp', 'phone', 'brush',
    'book', 'pen', 'paper', 'bag', 'box'
],
'very-easy': [
    'tiger', 'monkey', 'dolphin', 'rabbit', 'zebra',
    'cactus', 'river', 'flower', 'ocean', 'panda',
    'pizza', 'cookie', 'bread', 'carrot', 'lemon',
    'spoon', 'chair', 'table', 'bottle', 'blanket',
    'doctor', 'farmer', 'pirate', 'clown', 'baby',
    'hero', 'singer', 'robot', 'queen', 'chef',
    'school', 'park', 'beach', 'farm', 'zoo',
    'house', 'city', 'cave', 'shop', 'tower',
    'cloud', 'mountain', 'rain', 'sunny', 'snow',
    'apple', 'melon', 'plum', 'peach', 'berry',
    'train', 'truck', 'boat', 'plane', 'bus',
    'sock', 'shoe', 'hat', 'glove', 'scarf',
    'clock', 'bell', 'lamp', 'phone', 'brush',
    'book', 'pen', 'paper', 'bag', 'box',
    'nest', 'leaf', 'rock', 'mud', 'wind',
    'cat', 'dog', 'bat', 'frog', 'duck',
    'star', 'moon', 'sun', 'sky', 'tree',
    'jump', 'run', 'swim', 'climb', 'sleep',
    'blue', 'red', 'green', 'black', 'white',
    'happy', 'sad', 'funny', 'kind', 'nice',
    'king', 'ring', 'song', 'fish', 'game'
],
  'hard': [
    'labyrinth', 'astronomy', 'microscope', 'university', 'xylophone',
    'television', 'philosophy', 'psychology', 'electricity', 'algorithm',
    'satellite', 'chemistry', 'technology', 'equation', 'architecture',
    'literature', 'environment', 'mathematics', 'experiment', 'instrument',
    'civilization', 'population', 'continent', 'geography', 'bacterium',
    'planetarium', 'magnetism', 'biologist', 'photonics', 'theologian',
    'hydrology', 'economics', 'pharmacist', 'translation', 'archeology',
    'jurisprudence', 'neurology', 'engineering', 'aeronautics', 'conservation',
    'hypothesis', 'simulation', 'transmitter', 'calibration', 'migration',
    'invention', 'compression', 'classification', 'metaphysics', 'linguistics', 
    'biodiversity', 'constitution', 'cybernetic', 'diagnostics', 'formulation',
    'geothermal', 'hemisphere', 'illustration', 'legislation', 'navigation',
    'observatory', 'oscillation', 'parliament', 'perspective', 'probability',
    'projection', 'revolution', 'subculture', 'sustainability', 'taxonomy',
    'thermometer', 'transfusion', 'volatility', 'biomedical', 'cartography',
    'convection', 'experimenter', 'hyperspace', 'justification', 'refraction',
    'sociology', 'specialist', 'spectrum', 'unification', 'vocabulary' 
],
  'very-hard': [
    'encyclopedia', 'metamorphosis', 'infrastructure', 'responsibility', 'transformation',
    'bioluminescence', 'interdependence', 'photosynthesis', 'anthropologist', 'incomprehensible',
    'miscommunication', 'decontamination', 'thermodynamics', 'disproportionate', 'electromagnetic',
    'interdisciplinary', 'conglomeration', 'incompatibility', 'microarchitecture', 'conceptualization',
    'reconceptualization', 'neurotransmitter', 'institutionalization', 'counterproductive', 'unpredictability',
    'constitutionalism', 'hyperresponsiveness', 'internationalization', 'circumnavigation', 'micropaleontology',
    'reindustrialization', 'pharmacogenomics', 'biotechnological', 'counterintelligence', 'ethnopharmacology'
]
};

// Time limits (ms) by difficulty
const TIME_LIMITS = {
  'very-easy': 120_000,
  'easy': 60_000,
  'normal': 30_000,
  'medium': 30_000,
  'hard': 20_000,
  'very-hard': 15_000
};

// Scoring by difficulty
const SCORE_BY_DIFFICULTY = {
  'very-easy': 0,
  'easy': 0,
  'normal': 1,
  'medium': 2,
  'hard': 3,
  'very-hard': 4
};

// Scramble letters
function scrambleWord(word) {
  const letters = word.split('');
  let scrambled;
  do {
    scrambled = letters.sort(() => Math.random() - 0.5).join('');
  } while (scrambled === word);
  return scrambled;
}

// Get rank after updating leaderboard
function updateLeaderboard(userId, username, score) {
  return new Promise((resolve, reject) => {
    db.get('SELECT high_score FROM scrambler_leaderboard WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);

      const newHigh = !row || score > row.high_score;

      const update = () => {
        db.run(
          row
            ? 'UPDATE scrambler_leaderboard SET high_score = ?, username = ? WHERE user_id = ?'
            : 'INSERT INTO scrambler_leaderboard (high_score, username, user_id) VALUES (?, ?, ?)',
          [score, username, userId],
          err => {
            if (err) return reject(err);
            computeRank(score).then(resolve).catch(reject);
          }
        );
      };

      if (!row) {
        update();
      } else if (newHigh) {
        update();
      } else {
        computeRank(row.high_score).then(resolve).catch(reject);
      }
    });
  });
}

// Compute rank by number of users with higher score
function computeRank(score) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS rank FROM scrambler_leaderboard WHERE high_score > ?', [score], (err, row) => {
      if (err) return reject(err);
      resolve(row.rank + 1);
    });
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrambler')
    .setDescription('Play the word scrambler game with difficulty selection')
    .addStringOption(option =>
      option
        .setName('difficulty')
        .setDescription('Choose your difficulty')
        .setRequired(false)
        .addChoices(
          { name: 'Very Easy (2 mins)', value: 'very-easy' },
          { name: 'Easy (1 min)', value: 'easy' },
          { name: 'Normal (30 sec)', value: 'normal' },
          { name: 'Medium (30 sec)', value: 'medium' },
          { name: 'Hard (20 sec)', value: 'hard' },
          { name: 'Very Hard (15 sec)', value: 'very-hard' }
        )
    ),

  async execute(interaction) {
    const difficulty = interaction.options.getString('difficulty') || 'normal';
    const words = WORD_POOLS[difficulty];
    const timeLimit = TIME_LIMITS[difficulty];
    const pointValue = SCORE_BY_DIFFICULTY[difficulty];

    let score = 0;
    let gameOver = false;

    await interaction.reply({
      content: `🕹️ Starting Scrambler (${difficulty.replace('-', ' ')})`,
      ephemeral: true,
    });

    const nextRound = async () => {
      const word = words[Math.floor(Math.random() * words.length)];
      const scrambled = scrambleWord(word);

      const embed = new EmbedBuilder()
        .setTitle('🧠 Word Scrambler')
        .setDescription(`Unscramble this word:\n\`\`\`${scrambled}\`\`\`\n(You have ${timeLimit / 1000} seconds)`)
        .setColor('Random')
        .setFooter({ text: `Score: ${score} | Difficulty: ${difficulty.replace('-', ' ')}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('end').setLabel('End Game').setStyle(ButtonStyle.Danger)
      );

      await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });

      const filter = m => m.author.id === interaction.user.id;
      const messageCollector = interaction.channel.createMessageCollector({ filter, time: timeLimit, max: 1 });

      const buttonCollector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: timeLimit,
      });

      let guessedCorrectly = false;

      messageCollector.on('collect', m => {
        if (m.content.toLowerCase() === word.toLowerCase()) {
          score += pointValue;
          guessedCorrectly = true;
          m.reply({ content: `✅ Correct! +${pointValue} point(s). Total: **${score}**`, ephemeral: true });
        } else {
          m.reply({ content: `❌ Wrong! The correct word was **${word}**. Final Score: ${score}`, ephemeral: true });
          gameOver = true;
        }
        messageCollector.stop();
        buttonCollector.stop();
      });

      buttonCollector.on('collect', async btn => {
        if (btn.user.id !== interaction.user.id) return;
        await btn.reply({ content: `👋 Game ended. Final Score: ${score}`, ephemeral: true });
        gameOver = true;
        messageCollector.stop();
        buttonCollector.stop();
      });

      messageCollector.on('end', () => {
        if (!guessedCorrectly && !gameOver) {
          interaction.followUp({
            content: `⏰ Time's up! The word was **${word}**. Final Score: ${score}`,
            ephemeral: true,
          });
          gameOver = true;
        }

        if (gameOver) {
          updateLeaderboard(interaction.user.id, interaction.user.username, score)
            .then(rank => {
              interaction.followUp({
                content: `🏅 Your rank: **#${rank}**`,
                ephemeral: true,
              });
            })
            .catch(err => {
              console.error('Leaderboard error:', err);
            });
        } else {
          nextRound();
        }
      });
    };

    nextRound();
  },
};
