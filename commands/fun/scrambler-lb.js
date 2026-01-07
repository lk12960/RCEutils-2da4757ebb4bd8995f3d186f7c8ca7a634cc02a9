const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db.js'); // Adjust path

// Helper to get user's rank
function getUserRank(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT high_score FROM scrambler_leaderboard WHERE user_id = ?',
      [userId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        const score = row.high_score;
        db.get(
          'SELECT COUNT(*) AS rank FROM scrambler_leaderboard WHERE high_score > ?',
          [score],
          (err2, rankRow) => {
            if (err2) return reject(err2);
            resolve(rankRow.rank + 1);
          }
        );
      }
    );
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrambler-leaderboard')
    .setDescription('View the top 10 players in Scrambler!'),

  async execute(interaction) {
    db.all(
      'SELECT username, high_score FROM scrambler_leaderboard ORDER BY high_score DESC LIMIT 10',
      [],
      async (err, rows) => {
        if (err) {
          console.error('DB error:', err);
          return interaction.reply({ content: '⚠️ Failed to fetch leaderboard.', ephemeral: true });
        }

        if (rows.length === 0) {
          return interaction.reply({ content: 'No scores yet!', ephemeral: true });
        }

        // Get user rank
        let userRank = null;
        try {
          userRank = await getUserRank(interaction.user.id);
        } catch (e) {
          console.error('Error fetching user rank:', e);
        }

        // Check if user is in top 10
        const userInTop10 = rows.some(row => row.username === interaction.user.username);

        const embed = new EmbedBuilder()
          .setTitle('🏆 Scrambler Leaderboard')
          .setColor('Gold')
          .setDescription(
            rows
              .map((row, i) => `**${i + 1}.** ${row.username} - ${row.high_score} points`)
              .join('\n')
          );

        if (!userInTop10 && userRank !== null) {
          embed.setFooter({ text: `Your Rank: #${userRank}` });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    );
  },
};
