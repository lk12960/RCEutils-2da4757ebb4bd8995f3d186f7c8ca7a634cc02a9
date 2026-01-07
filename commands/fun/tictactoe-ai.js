const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const EMPTY = '⬜';
const PLAYER_X = '❌';
const PLAYER_O = '⭕';

function checkWin(board, symbol) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return wins.some(line => line.every(i => board[i] === symbol));
}

function isDraw(board) {
  return board.every(cell => cell !== EMPTY);
}

function getAvailableMoves(board) {
  return board.map((v, i) => v === EMPTY ? i : null).filter(i => i !== null);
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
          .setDisabled(board[idx] !== EMPTY)
      );
    }
    rows.push(row);
  }
  return rows;
}

// AI Difficulty Behaviors
function aiMove(board, difficulty, symbol, opponentSymbol) {
  switch (difficulty) {
    case 'easy':
      return randomMove(board);
    case 'medium':
      return mediumAIMove(board, symbol, opponentSymbol);
    case 'hard':
      return minimaxMove(board, symbol, opponentSymbol);
    default:
      return randomMove(board);
  }
}

function randomMove(board) {
  const choices = getAvailableMoves(board);
  return choices[Math.floor(Math.random() * choices.length)];
}

function mediumAIMove(board, ai, player) {
  // Block win
  for (const i of getAvailableMoves(board)) {
    const newBoard = [...board];
    newBoard[i] = player;
    if (checkWin(newBoard, player)) return i;
  }
  return randomMove(board);
}

function minimaxMove(board, ai, player) {
  let bestScore = -Infinity;
  let move;

  for (const i of getAvailableMoves(board)) {
    board[i] = ai;
    let score = minimax(board, false, ai, player);
    board[i] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      move = i;
    }
  }

  return move;
}

function minimax(board, isMaximizing, ai, player) {
  if (checkWin(board, ai)) return 10;
  if (checkWin(board, player)) return -10;
  if (isDraw(board)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const i of getAvailableMoves(board)) {
      board[i] = ai;
      best = Math.max(best, minimax(board, false, ai, player));
      board[i] = EMPTY;
    }
    return best;
  } else {
    let best = Infinity;
    for (const i of getAvailableMoves(board)) {
      board[i] = player;
      best = Math.min(best, minimax(board, true, ai, player));
      board[i] = EMPTY;
    }
    return best;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoe-ai')
    .setDescription('Play Tic Tac Toe against an AI')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Game mode')
        .addChoices(
          { name: 'normal', value: 'normal' },
          { name: 'endless', value: 'endless' }
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('difficulty')
        .setDescription('AI difficulty')
        .addChoices(
          { name: 'easy', value: 'easy' },
          { name: 'medium', value: 'medium' },
          { name: 'hard', value: 'hard' }
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    const mode = interaction.options.getString('mode');
    const difficulty = interaction.options.getString('difficulty');

    let board = Array(9).fill(EMPTY);
    let currentPlayer = PLAYER_X;
    const userId = interaction.user.id;
    const AI = PLAYER_O;
    const HUMAN = PLAYER_X;

    let moveHistory = {
      [PLAYER_X]: [],
      [PLAYER_O]: []
    };

    const embed = new EmbedBuilder()
      .setTitle(`Tic Tac Toe vs AI`)
      .setDescription(`You are ❌. It's your turn!`)
      .setColor('Green')
      .setFooter({ text: `Mode: ${mode} | Difficulty: ${difficulty}` });

    const message = await interaction.reply({
      embeds: [embed],
      components: createBoardComponents(board),
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 * 5,
    });

    async function makeAIMove() {
      const idx = aiMove(board, difficulty, AI, HUMAN);
      if (idx === undefined) return;

      board[idx] = AI;
      moveHistory[AI].push(idx);

      if (checkWin(board, AI)) {
        embed.setDescription(`Game over! The AI (⭕) wins! 🤖`);
        collector.stop('win');
      } else {
        if (mode === 'endless' && moveHistory[AI].length > 3) {
          const oldest = moveHistory[AI].shift();
          board[oldest] = EMPTY;
        }

        if (mode === 'normal' && isDraw(board)) {
          embed.setDescription(`It's a draw! 🤝`);
          collector.stop('draw');
        } else {
          embed.setDescription(`Your turn! ❌`);
        }
      }

      await interaction.editReply({
        embeds: [embed],
        components: createBoardComponents(board),
      });
    }

    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: "You're not in this game!", ephemeral: true });
      }

      const idx = parseInt(i.customId);
      if (board[idx] !== EMPTY) {
        return i.reply({ content: "That spot is already taken!", ephemeral: true });
      }

      board[idx] = HUMAN;
      moveHistory[HUMAN].push(idx);

      if (checkWin(board, HUMAN)) {
        embed.setDescription(`You win! 🎉`);
        collector.stop('win');
      } else {
        if (mode === 'endless' && moveHistory[HUMAN].length > 3) {
          const oldest = moveHistory[HUMAN].shift();
          board[oldest] = EMPTY;
        }

        if (mode === 'normal' && isDraw(board)) {
          embed.setDescription(`It's a draw! 🤝`);
          collector.stop('draw');
        } else {
          embed.setDescription(`AI's turn... 🤖`);
          await i.update({ embeds: [embed], components: createBoardComponents(board) });
          setTimeout(makeAIMove, 500);
          return;
        }
      }

      await i.update({
        embeds: [embed],
        components: createBoardComponents(board),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'win' && reason !== 'draw') {
        embed.setDescription(`Game ended due to timeout.`);
      }
      interaction.editReply({ embeds: [embed], components: [] });
    });
  }
};
