const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { isManagement } = require('../utils/permissions');
const { getCategoryStatus } = require('../utils/categoryStatusManager');
const { listCategories } = require('../utils/priceManager');
const { buildTicketButtons, buildWelcomeEmbed, buildUserInfoEmbed, buildFormEmbed, buildSupportWelcomeEmbed, buildSupportFormEmbed } = require('../utils/ticketUtils');
const { getCategoryRole, getSupportRoles } = require('../utils/categoryRoleSync');
const { isBlacklisted } = require('../utils/ticketBlacklist');
const db = require('../database/db');

// Generate next ticket ID
function generateTicketId() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Initialize counter if it doesn't exist
      db.run(`INSERT OR IGNORE INTO ticket_counter (id, last_ticket_id) VALUES (1, 0)`, (err) => {
        if (err) return reject(err);
        
        // Increment and get new ticket ID
        db.run(`UPDATE ticket_counter SET last_ticket_id = last_ticket_id + 1 WHERE id = 1`, (err2) => {
          if (err2) return reject(err2);
          
          db.get(`SELECT last_ticket_id FROM ticket_counter WHERE id = 1`, (err3, row) => {
            if (err3) return reject(err3);
            resolve(row.last_ticket_id);
          });
        });
      });
    });
  });
}

module.exports = {
  name: 'convert-to-ticket',
  description: 'Convert the current channel into a ticket',
  usage: '<order|support> <category>',
  async execute(message, args) {
    // Permission check - only management can convert channels to tickets
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    // Show detailed help if no args or "help" requested
    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Convert to Ticket - Usage Guide')
        .setDescription('Convert an existing channel into a ticket with proper permissions and formatting.')
        .addFields(
          {
            name: '📝 Basic Syntax',
            value: '```>convert-to-ticket <order|support> <category>```',
            inline: false
          },
          {
            name: '🛍️ Order Tickets',
            value: '**Available Categories:**\n' +
                   '• `Livery` - Vehicle livery designs\n' +
                   '• `Uniform` - Uniform/clothing designs\n' +
                   '• `ELS` - Emergency Lighting System\n' +
                   '• `Graphics` - Logos, banners, etc.\n' +
                   '• `Discord Server` - Server setup/design\n' +
                   '• `Discord Bot` - Bot development\n\n' +
                   '**Examples:**\n' +
                   '```>convert-to-ticket order livery\n' +
                   '>convert-to-ticket order uniform\n' +
                   '>convert-to-ticket order els\n' +
                   '>convert-to-ticket order graphics\n' +
                   '>convert-to-ticket order discord server\n' +
                   '>convert-to-ticket order discord bot```',
            inline: false
          },
          {
            name: '🎫 Support Tickets',
            value: '**Available Categories:**\n' +
                   '• `General` - General support inquiries\n' +
                   '• `HR` - Human Resources support\n\n' +
                   '**Examples:**\n' +
                   '```>convert-to-ticket support general\n' +
                   '>convert-to-ticket support hr```',
            inline: false
          },
          {
            name: '💡 Tips',
            value: '• Category names are **case-insensitive**\n' +
                   '• **Partial matches** work (e.g., "liv" for "Livery")\n' +
                   '• Channel will be **moved** to the appropriate category\n' +
                   '• **Permissions** will be set automatically\n' +
                   '• **Ticket ID** and metadata will be generated\n' +
                   '• Only **Management** can use this command',
            inline: false
          },
          {
            name: '⚙️ What Happens',
            value: '1️⃣ Channel permissions are configured\n' +
                   '2️⃣ Channel is moved to ticket category\n' +
                   '3️⃣ Ticket ID is generated and set\n' +
                   '4️⃣ Welcome message with buttons is sent\n' +
                   '5️⃣ Relevant staff roles are pinged',
            inline: false
          }
        )
        .setFooter({ text: 'King\'s Customs Ticket System' })
        .setTimestamp();
      
      return message.reply({ embeds: [helpEmbed] });
    }

    if (args.length < 2) {
      return message.reply('❌ Not enough arguments. Use `>convert-to-ticket help` for detailed usage guide.');
    }

    const type = args[0].toLowerCase();
    const categoryArg = args.slice(1).join(' ').toLowerCase();

    // Determine if it's order or support ticket
    if (type === 'order') {
      // Get all available order categories
      const categories = await listCategories();
      
      // Find matching category (case-insensitive partial match)
      const category = categories.find(c => c.toLowerCase().includes(categoryArg) || categoryArg.includes(c.toLowerCase()));
      
      if (!category) {
        return message.reply(`❌ Invalid order category. Available categories: ${categories.join(', ')}`);
      }

      // Check if category is open
      const status = (await getCategoryStatus(message.guild.id, category)) || 'closed';
      if (status === 'closed') {
        return message.reply(`❌ The ${category} category is currently closed.`);
      }

      // Check blacklist
      const blocked = await isBlacklisted(message.author.id, 'order').catch(() => false);
      if (blocked) {
        return message.reply('❌ You are blacklisted from opening order tickets.');
      }

      try {
        // Convert channel to order ticket
        await convertToOrderTicket(message.channel, message.author, message.member, category);
        await message.reply(`✅ Successfully converted this channel to an **${category} Order** ticket.`);
      } catch (error) {
        console.error('Error converting to order ticket:', error);
        return message.reply('❌ Failed to convert channel to ticket. Check bot permissions.');
      }

    } else if (type === 'support') {
      // Determine support category
      let category;
      if (categoryArg.includes('hr')) {
        category = 'HR Support';
      } else if (categoryArg.includes('general')) {
        category = 'General Support';
      } else {
        return message.reply('❌ Invalid support category. Use: `hr` or `general`');
      }

      // Check blacklist
      const blocked = await isBlacklisted(message.author.id, 'support').catch(() => false);
      if (blocked) {
        return message.reply('❌ You are blacklisted from opening support tickets.');
      }

      try {
        // Convert channel to support ticket
        await convertToSupportTicket(message.channel, message.author, message.member, category);
        await message.reply(`✅ Successfully converted this channel to a **${category}** ticket.`);
      } catch (error) {
        console.error('Error converting to support ticket:', error);
        return message.reply('❌ Failed to convert channel to ticket. Check bot permissions.');
      }

    } else {
      return message.reply('❌ Invalid type. Use `order` or `support`.');
    }
  }
};

async function convertToOrderTicket(channel, user, member, category) {
  const ORDERS_CATEGORY_ID = '1457527791602896947';
  const DESIGN_TEAM_ROLE_ID = '1419090298730184776';
  const QUALITY_CONTROL_ROLE_ID = '1457926662485442600';
  const MANAGEMENT_ROLE_1_ID = process.env.MANAGEMENT_ROLE_1_ID || '1411100904949682236';
  const MANAGEMENT_ROLE_2_ID = process.env.MANAGEMENT_ROLE_2_ID || '1419399437997834301';

  // Set up permissions
  await channel.permissionOverwrites.set([
    {
      id: channel.guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id, // Opener
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: DESIGN_TEAM_ROLE_ID, // Design Team
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: QUALITY_CONTROL_ROLE_ID, // Quality Control
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: MANAGEMENT_ROLE_1_ID, // Management 1
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
    },
    {
      id: MANAGEMENT_ROLE_2_ID, // Management 2
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
    }
  ]);

  // Move to Orders category if not already there
  if (channel.parentId !== ORDERS_CATEGORY_ID) {
    await channel.setParent(ORDERS_CATEGORY_ID);
  }

  // Generate ticket ID and set topic with metadata
  const ticketId = await generateTicketId();
  const topic = JSON.stringify({ 
    category, 
    openerId: user.id, 
    openedAt: Date.now(), 
    claimedBy: null, 
    ticketId 
  });
  await channel.setTopic(topic);

  // Build and send embeds
  const roleId = getCategoryRole(category);
  const welcome = buildWelcomeEmbed(user, category);
  const info = buildUserInfoEmbed(member || user);
  const form = buildFormEmbed({ 
    roblox: 'N/A (converted channel)', 
    details: 'Channel converted to ticket', 
    deadline: 'N/A' 
  });
  const buttons = buildTicketButtons(channel.id);

  await channel.send({ 
    content: `${user}${roleId ? ` <@&${roleId}>` : ''}`, 
    embeds: [welcome, info, form], 
    components: [buttons] 
  });
}

async function convertToSupportTicket(channel, user, member, category) {
  const GENERAL_SUPPORT_CATEGORY_ID = '1458914807003742279';
  const HR_SUPPORT_CATEGORY_ID = '1458914764490277073';
  const GENERAL_SUPPORT_ROLE_ID = '1457921599322722449';
  const MANAGEMENT_ROLE_1_ID = process.env.MANAGEMENT_ROLE_1_ID || '1411100904949682236';
  const MANAGEMENT_ROLE_2_ID = process.env.MANAGEMENT_ROLE_2_ID || '1419399437997834301';

  // Determine category ID and permissions
  let categoryId;
  let permissionOverwrites = [
    {
      id: channel.guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id, // Opener
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: MANAGEMENT_ROLE_1_ID, // Management 1
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
    },
    {
      id: MANAGEMENT_ROLE_2_ID, // Management 2
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
    }
  ];

  if (category === 'General Support') {
    categoryId = GENERAL_SUPPORT_CATEGORY_ID;
    permissionOverwrites.push({
      id: GENERAL_SUPPORT_ROLE_ID,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  } else if (category === 'HR Support') {
    categoryId = HR_SUPPORT_CATEGORY_ID;
  }

  // Set up permissions
  await channel.permissionOverwrites.set(permissionOverwrites);

  // Move to appropriate Support category if not already there
  if (channel.parentId !== categoryId) {
    await channel.setParent(categoryId);
  }

  // Generate ticket ID and set topic with metadata
  const ticketId = await generateTicketId();
  const topic = JSON.stringify({ 
    category, 
    openerId: user.id, 
    openedAt: Date.now(), 
    claimedBy: null, 
    ticketId 
  });
  await channel.setTopic(topic);

  // Build and send embeds
  const supportRoles = getSupportRoles();
  const roleId = supportRoles[category];
  const welcome = buildSupportWelcomeEmbed(user, category);
  const info = buildUserInfoEmbed(member || user);
  const form = buildSupportFormEmbed({ 
    roblox: 'N/A (converted channel)', 
    details: 'Channel converted to ticket' 
  });
  const buttons = buildTicketButtons(channel.id);

  await channel.send({ 
    content: `${user}${roleId ? ` <@&${roleId}>` : ''}`, 
    embeds: [welcome, info, form], 
    components: [buttons] 
  });
}
