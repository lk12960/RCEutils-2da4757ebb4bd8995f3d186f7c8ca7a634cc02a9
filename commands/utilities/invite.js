const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generateinvite')
    .setDescription('Generate an invite link with options')
    .addIntegerOption(option =>
      option.setName('max_uses')
        .setDescription('Maximum number of uses (0 for unlimited)')
        .setMinValue(0)
        .setMaxValue(1000)
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('max_age')
        .setDescription('Invite expiration time in seconds (0 for never)')
        .setMinValue(0)
        .setMaxValue(604800) // max 7 days
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('temporary')
        .setDescription('Temporary membership?')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('unique')
        .setDescription('Create a unique invite? (true means no re-use)')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
      return interaction.reply({ content: 'You do not have permission to create invites.', ephemeral: true });
    }

    const maxUses = interaction.options.getInteger('max_uses') ?? 0;
    const maxAge = interaction.options.getInteger('max_age') ?? 0;
    const temporary = interaction.options.getBoolean('temporary') ?? false;
    const unique = interaction.options.getBoolean('unique') ?? true;

    try {
      const invite = await interaction.channel.createInvite({
        maxUses,
        maxAge,
        temporary,
        unique,
        reason: `Invite created by ${interaction.user.tag}`,
      });

      await interaction.reply({ content: `Invite created: ${invite.url}`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to create invite.', ephemeral: true });
    }
  },
};
