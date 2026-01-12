const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatTimestamp, findExecutor, formatExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'guildMemberAdd',

  async execute(member) {
    // Welcome message system
    const WELCOME_CHANNEL_ID = '1411101159342473399';
    const WELCOME_ROLE_ID = '1419329244118384814';
    
    try {
      // Add welcome role
      const welcomeRole = member.guild.roles.cache.get(WELCOME_ROLE_ID);
      if (welcomeRole) {
        await member.roles.add(welcomeRole);
        console.log(`✅ Added welcome role to ${member.user.tag}`);
      }
      
      // Send welcome message
      const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (welcomeChannel) {
        const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
        
        const memberCount = member.guild.memberCount;
        
        const orderButton = new ButtonBuilder()
          .setLabel('Order Here')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com/channels/1297697183503745066/1457494227566067895');
        
        const memberCountButton = new ButtonBuilder()
          .setLabel(`${memberCount}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({ id: '1361379290977140796', name: 'Person1', animated: false })
          .setDisabled(true)
          .setCustomId('member_count_display');
        
        const row = new ActionRowBuilder().addComponents(orderButton, memberCountButton);
        
        await welcomeChannel.send({
          content: `<:KCoutlined:1460101719852843018> Welcome to **King's Customs**, ${member.user}. Please visit our <#1304893788388593664> for more information.`,
          components: [row]
        });
        
        console.log(`✅ Sent welcome message for ${member.user.tag}`);
      }
    } catch (error) {
      console.error('Error in welcome system:', error);
    }
    
    // Continue with existing audit log code
    try { await (require('../utils/stats').track)('member_join', 1, member.guild.id); } catch {}

    const welcomeChannelId = '1389342280695156840';
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    const autoRoleId = '1383111760751366244'; // ✅ Role to assign

    // ✅ Attempt to assign the role
    let assignedRole = null;
    try {
      const role = member.guild.roles.cache.get(autoRoleId);
      if (role) {
        await member.roles.add(role);
        assignedRole = role;
        console.log(`✅ Assigned role ${role.name} to ${member.user.tag}`);
      } else {
        console.warn(`⚠️ Role ID ${autoRoleId} not found in guild.`);
      }
    } catch (err) {
      console.error(`❌ Failed to assign role to ${member.user.tag}:`, err);
    }

    // Check if this might be an invite join
    let inviter = null;
    try {
      const entry = await findExecutor(member.guild, AuditLogEvent.InviteCreate, (e) => {
        return Date.now() - e.createdTimestamp < 10000; // Within 10 seconds
      });
      if (entry) {
        inviter = entry.executor;
      }
    } catch {}

    // Calculate account age
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const isNewAccount = accountAgeDays < 7; // Less than 7 days old

    // Build the audit log embed
    const embed = createBaseEmbed({
      title: 'Member Joined',
      emoji: LogEmojis.MEMBER_JOIN,
      color: isNewAccount ? LogColors.WARNING : LogColors.MEMBER_JOIN,
    });

    embed.addFields(
      { name: '👤 Member', value: `${member.user.tag} (${member.id})`, inline: true },
      { name: '📅 Account Created', value: formatTimestamp(member.user.createdTimestamp, 'R'), inline: true },
      { name: '👥 Member Count', value: `${member.guild.memberCount}`, inline: true }
    );

    if (isNewAccount) {
      embed.addFields({ 
        name: '⚠️ New Account Warning', 
        value: `Account is only **${accountAgeDays}** day(s) old`, 
        inline: false 
      });
    }

    if (assignedRole) {
      embed.addFields({ 
        name: '🎭 Auto-Role Assigned', 
        value: `${assignedRole.name}`, 
        inline: true 
      });
    }

    if (inviter) {
      embed.addFields({ 
        name: '🎟️ Possible Inviter', 
        value: formatExecutor(inviter), 
        inline: true 
      });
    }

    // Check if user was previously a member
    const bans = await member.guild.bans.fetch().catch(() => null);
    const wasBanned = bans ? bans.has(member.id) : false;

    if (wasBanned) {
      embed.addFields({ 
        name: '⚠️ Previously Banned', 
        value: 'This user was previously banned from this server', 
        inline: false 
      });
    }

    embed.addFields({ name: '⏰ Joined', value: formatTimestamp(Date.now()), inline: false });

    if (member.user.avatarURL()) {
      embed.setThumbnail(member.user.avatarURL());
    }

    embed.setFooter({ text: `User ID: ${member.id}` });

    // Send audit log
    await sendAuditLog(member.guild, {
      category: LogCategories.MEMBERS,
      embed,
    });

    // Build the welcome message components
    const memberCountButton = new ButtonBuilder()
      .setCustomId('member_count')
      .setLabel(`${member.guild.memberCount}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const row = new ActionRowBuilder().addComponents(memberCountButton);

    // Send styled welcome message
    try {
      if (welcomeChannel?.isTextBased()) {
        await welcomeChannel.send({
          content: `👋 Welcome <@${member.id}> to @boostERLC, we hope you enjoy your stay!`,
          files: ['https://cdn.discordapp.com/attachments/1389345649493020702/1389635268373647460/Welcome_1.png?ex=68675072&is=6865fef2&hm=f65d72b1ce1016c4faa71c8a7cd08c6f1153c94b4cd1b04e5b97093f4773b079&'],
          components: [row],
        });
      }
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  },
};