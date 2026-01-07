const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  ComponentType,
} = require('discord.js');
const {
  getCaseById,
  voidCase,
  unvoidCase,
  updateCaseReason,
  updateCaseUser,
  updateCaseAction,
  updateCaseModerator,
} = require('../../utils/caseManager');
const { isManagement } = require('../../utils/permissions');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('editcase')
    .setDescription('View and edit a moderation case')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('The case ID')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const caseId = interaction.options.getInteger('id');
    let modCase = await getCaseById(caseId);

    if (!modCase) {
      return interaction.reply({ content: `❌ Case ID ${caseId} not found.`, ephemeral: true });
    }

    // Helper to build embed
    const buildCaseEmbed = (modCase) => {
      return new EmbedBuilder()
        .setColor(modCase.voided ? 0x95a5a6 : 0x3498db) // gray if voided else blue
        .setTitle(`Case #${modCase.id} ${modCase.voided ? '(Voided)' : ''}`)
        .addFields(
          { name: 'User ID', value: modCase.user_id, inline: true },
          { name: 'Moderator ID', value: modCase.moderator_id, inline: true },
          { name: 'Action', value: modCase.action, inline: true },
          { name: 'Reason', value: modCase.reason || 'No reason provided', inline: false },
          { name: 'Date', value: new Date(modCase.timestamp).toUTCString(), inline: false },
        );
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`editcase_select_${caseId}`)
      .setPlaceholder('Select an action to perform')
      .addOptions([
        { label: 'Void Case', value: 'void' },
        { label: 'Unvoid Case', value: 'unvoid' },
        { label: 'Edit Reason', value: 'edit_reason' },
        { label: 'Edit User', value: 'edit_user' },
        { label: 'Edit Action', value: 'edit_action' },
        { label: 'Edit Moderator', value: 'edit_moderator' },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [buildCaseEmbed(modCase)], components: [row], ephemeral: true });

    const filter = i => i.user.id === interaction.user.id && i.customId === `editcase_select_${caseId}`;

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 5 * 60 * 1000, componentType: ComponentType.StringSelect });

    collector.on('collect', async (selectInteraction) => {
      await selectInteraction.deferUpdate();

      const selected = selectInteraction.values[0];

      if (selected === 'void') {
        await voidCase(caseId);
        modCase = await getCaseById(caseId);
        await selectInteraction.editReply({ embeds: [buildCaseEmbed(modCase)] });
      } else if (selected === 'unvoid') {
        await unvoidCase(caseId);
        modCase = await getCaseById(caseId);
        await selectInteraction.editReply({ embeds: [buildCaseEmbed(modCase)] });
      } else {
        // Show modal for edit actions
        let modalTitle = '';
        let inputLabel = '';
        let inputCustomId = '';

        switch (selected) {
          case 'edit_reason':
            modalTitle = 'Edit Reason';
            inputLabel = 'New Reason';
            inputCustomId = 'new_reason';
            break;
          case 'edit_user':
            modalTitle = 'Edit User ID';
            inputLabel = 'New User ID';
            inputCustomId = 'new_user';
            break;
          case 'edit_action':
            modalTitle = 'Edit Action';
            inputLabel = 'New Action';
            inputCustomId = 'new_action';
            break;
          case 'edit_moderator':
            modalTitle = 'Edit Moderator ID';
            inputLabel = 'New Moderator ID';
            inputCustomId = 'new_moderator';
            break;
          default:
            return;
        }

        const modal = new ModalBuilder()
          .setCustomId(`editcase_modal_${caseId}_${selected}`)
          .setTitle(modalTitle);

        const textInput = new TextInputBuilder()
          .setCustomId(inputCustomId)
          .setLabel(inputLabel)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const modalRow = new ActionRowBuilder().addComponents(textInput);
        modal.addComponents(modalRow);

        await interaction.client.users.cache.get(interaction.user.id).send('Opening modal...'); // workaround if needed

        await selectInteraction.showModal(modal);
      }
    });

    const modalFilter = i => i.user.id === interaction.user.id && i.type === InteractionType.ModalSubmit && i.customId.startsWith(`editcase_modal_${caseId}_`);

    const modalCollector = interaction.channel.createMessageComponentCollector({ filter: modalFilter, time: 5 * 60 * 1000, componentType: ComponentType.ModalSubmit });

    modalCollector.on('collect', async (modalInteraction) => {
      await modalInteraction.deferReply({ ephemeral: true });

      const [_, __, ____, actionType] = modalInteraction.customId.split('_'); // extract action type

      try {
        switch (actionType) {
          case 'edit_reason':
            const newReason = modalInteraction.fields.getTextInputValue('new_reason');
            await updateCaseReason(caseId, newReason);
            break;
          case 'edit_user':
            const newUser = modalInteraction.fields.getTextInputValue('new_user');
            await updateCaseUser(caseId, newUser);
            break;
          case 'edit_action':
            const newAction = modalInteraction.fields.getTextInputValue('new_action');
            await updateCaseAction(caseId, newAction);
            break;
          case 'edit_moderator':
            const newMod = modalInteraction.fields.getTextInputValue('new_moderator');
            await updateCaseModerator(caseId, newMod);
            break;
          default:
            return modalInteraction.editReply({ content: 'Unknown edit action.', ephemeral: true });
        }

        modCase = await getCaseById(caseId);

        // Update the original reply with new embed
        await interaction.editReply({ embeds: [buildCaseEmbed(modCase)] });

        await modalInteraction.editReply({ content: 'Case updated successfully!', ephemeral: true });
      } catch (error) {
        console.error(error);
        await modalInteraction.editReply({ content: 'Failed to update case.', ephemeral: true });
      }
    });

    collector.on('end', () => {
      // Disable the select menu after timeout
      interaction.editReply({ components: [] }).catch(() => {});
      modalCollector.stop();
    });
  },
};