const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} = require('discord.js');

const GRID_SIZE = 5;
const MINES_COUNT = 5;
const UNREVEALED = '⬜';
const MINE = '💣';

// Generate minefield
function generateField() {
  // Create empty grid
  const field = Array(GRID_SIZE * GRID_SIZE).fill(0);

  // Place mines randomly
  let minesPlaced = 0;
  while (minesPlaced < MINES_COUNT) {
    const pos = Math.floor(Math.random() * GRID_SIZE * GRID_SIZE);
    if (field[pos] === MINE) continue;
    field[pos] = MINE;
    minesPlaced++;
  }

  // Calculate numbers for cells adjacent to mines
  for (let i = 0; i < field.length; i++) {
    if (field[i] === MINE) continue;
    let count = 0;
    const x = i % GRID_SIZE;
    const y = Math.floor(i / GRID_SIZE);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          if (field[ny * GRID_SIZE + nx] === MINE) count++;
        }
      }
    }

    field[i] = count;
  }

  return field;
}

// Create button rows for the board display
function createBoardComponents(revealed, board) {
  const rows = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = new ActionRowBuilder();
    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = y * GRID_SIZE + x;
      let label = UNREVEALED;
      let style = ButtonStyle.Secondary;
      let disabled = false;

      if (revealed[idx]) {
        disabled = true;
        if (board[idx] === MINE) {
          label = MINE;
          style = ButtonStyle.Danger;
        } else if (board[idx] === 0) {
          label = '▫️';
          style = ButtonStyle.Secondary;
        } else {
          label = board[idx].toString();
          style = ButtonStyle.Primary;
        }
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(idx.toString())
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }
    rows.push(row);
  }
  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minesweeper')
    .setDescription('Play a Minesweeper game'),

  async execute(interaction) {
    const board = generateField();
    const revealed = Array(GRID_SIZE * GRID_SIZE).fill(false);

    const embed = new EmbedBuilder()
      .setTitle('Minesweeper')
      .setDescription('Click a cell to reveal it. Avoid the mines! 💣')
      .setColor('Green');

    const message = await interaction.reply({
      embeds: [embed],
      components: createBoardComponents(revealed, board),
      fetchReply: true,
      ephemeral: false,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 * 5,
    });

    collector.on('collect', async i => {
      const idx = parseInt(i.customId);
      if (revealed[idx]) {
        return i.reply({ content: "This cell is already revealed!", ephemeral: true });
      }

      revealed[idx] = true;

      if (board[idx] === MINE) {
        // Reveal all mines
        for (let k = 0; k < board.length; k++) {
          if (board[k] === MINE) revealed[k] = true;
        }
        embed.setDescription(`💥 Boom! You hit a mine. Game Over!`);
        collector.stop('lost');
      } else {
        // Check win: all non-mines revealed
        const revealedCount = revealed.filter((v, idx) => v && board[idx] !== MINE).length;
        if (revealedCount === GRID_SIZE * GRID_SIZE - MINES_COUNT) {
          embed.setDescription(`🎉 Congratulations! You cleared the minefield!`);
          collector.stop('won');
        } else {
          embed.setDescription('Click a cell to reveal it. Avoid the mines! 💣');
        }
      }

      await i.update({
        embeds: [embed],
        components: createBoardComponents(revealed, board),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'lost' && reason !== 'won') {
        embed.setDescription('Game ended due to timeout.');
      }
      interaction.editReply({ embeds: [embed], components: [] });
    });
  }
};
