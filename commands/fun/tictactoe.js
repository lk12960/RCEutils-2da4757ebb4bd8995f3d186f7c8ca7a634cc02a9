const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require('discord.js');

const EMPTY = '⬜';
const PLAYER_X = '❌';
const PLAYER_O = '⭕';

function checkWin(board, symbol) {
  const wins = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  return wins.some(line => line.every(i => board[i] === symbol));
}

function isDraw(board) {
  return board.every(cell => cell !== EMPTY);
}

function createBoardComponents(board) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < 3; j++) {
      const idx = i * 3 + j;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(idx.toString())
          .setLabel(board[idx])
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(false)
      );
    }
    rows.push(row);
  }
  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Challenge a user to Tic Tac Toe')
    .addUserOption(option => 
      option.setName('opponent')
        .setDescription('The user to challenge')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('mode')
        .setDescription('Game mode: normal or endless')
        .addChoices(
          { name: 'normal', value: 'normal' },
          { name: 'endless', value: 'endless' }
        )
    ),

  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');
    const mode = interaction.options.getString('mode') || 'normal';

    // Fetch full user object to ensure availability in DMs
    const opponentUser = await interaction.client.users.fetch(opponent.id);

    if (opponentUser.bot) {
      return interaction.reply({ content: "You can't challenge bots!", ephemeral: true });
    }
    if (opponentUser.id === interaction.user.id) {
      return interaction.reply({ content: "You can't challenge yourself!", ephemeral: true });
    }

    let board = Array(9).fill(EMPTY);
    let currentPlayer = PLAYER_X;
    let players = {
      [PLAYER_X]: interaction.user.id,
      [PLAYER_O]: opponentUser.id,
    };
    let moveHistory = {
      [PLAYER_X]: [],
      [PLAYER_O]: []
    };

    const embed = new EmbedBuilder()
      .setTitle(`Tic Tac Toe: ${interaction.user.username} (❌) vs ${opponentUser.username} (⭕)`)
      .setDescription(`It's **${interaction.user.username}**'s (❌) turn`)
      .setColor('Blue')
      .setFooter({ text: `Mode: ${mode}` });

    const message = await interaction.reply({
      embeds: [embed],
      components: createBoardComponents(board),
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 * 5,
    });

    collector.on('collect', async i => {
      if (i.user.id !== players[currentPlayer]) {
        return i.reply({ content: "It's not your turn!", ephemeral: true });
      }

      const idx = parseInt(i.customId);
      if (board[idx] !== EMPTY) {
        return i.reply({ content: "That spot is already taken!", ephemeral: true });
      }

      board[idx] = currentPlayer;
      moveHistory[currentPlayer].push(idx);

      if (checkWin(board, currentPlayer)) {
        embed.setDescription(`Game over! **${i.user.username}** (${currentPlayer}) wins! 🎉`);
        collector.stop('win');
      } else if (mode === 'normal' && isDraw(board)) {
        embed.setDescription(`Game over! It's a draw! 🤝`);
        collector.stop('draw');
      } else {
        if (mode === 'endless' && moveHistory[currentPlayer].length > 3) {
          const oldest = moveHistory[currentPlayer].shift();
          board[oldest] = EMPTY;
        }
        currentPlayer = currentPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
        const nextUserId = players[currentPlayer];
        const nextUser = await interaction.client.users.fetch(nextUserId);
        embed.setDescription(`It's **${nextUser.username}**'s (${currentPlayer}) turn`);
      }

      await i.update({
        embeds: [embed],
        components: createBoardComponents(board),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'win' && reason !== 'draw') {
        embed.setDescription('Game ended due to timeout.');
      }
      interaction.editReply({ embeds: [embed], components: [] });
    });
  }
};
