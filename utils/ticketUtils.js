const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { BRAND_COLOR_HEX } = require('./branding');
const { listCategories } = require('./priceManager');
const { getCategoryStatus } = require('./categoryStatusManager');
const { getSetting } = require('./settingsManager');
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

async function resolveOrdersCategory(guild) {
  const id = await getSetting('orders_category_id');
  if (id) {
    const cat = guild.channels.cache.get(id);
    if (cat) return cat;
  }
  return null;
}

async function resolveSupportCategory(guild) {
  const id = await getSetting('support_category_id');
  if (id) {
    const cat = guild.channels.cache.get(id);
    if (cat) return cat;
  }
  return null;
}

async function resolveTicketLogChannel(client) {
  // Prefer dedicated tickets log channel if configured, else fallback to constant, else legacy orders log channel
  const ticketsId = await getSetting('tickets_log_channel_id');
  let id = ticketsId;
  if (!id) {
    // Default/fallback channel ID provided by user
    id = '1411101330558291978';
  }
  let ch = id ? client.channels.cache.get(id) : null;
  if (!ch) {
    const legacy = await getSetting('orders_log_channel_id');
    ch = legacy ? client.channels.cache.get(legacy) : null;
  }
  return ch || null;
}

function buildTicketButtons(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim:${channelId}`).setLabel('Claim').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_close:${channelId}`).setLabel('Close').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_close_reason:${channelId}`).setLabel('Close w/ Reason').setStyle(ButtonStyle.Danger),
  );
}

function buildWelcomeEmbed(user, category) {
  const { BRAND_NAME } = require('./branding');
  return new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — ${category} Order`)
    .setColor(BRAND_COLOR_HEX)
    .setDescription(
      `Hello ${user}, and welcome to ${BRAND_NAME}!\n\n` +
      `Please follow these rules while your ticket is open:\n` +
      `• Be respectful and patient.\n` +
      `• Do not ping staff unnecessarily.\n` +
      `• Provide as much detail as possible.\n\n` +
      `A designer will be with you shortly.`
    )
    .setFooter({ text: BRAND_NAME });
}

function buildUserInfoEmbed(memberOrUser) {
  const user = memberOrUser.user ?? memberOrUser;
  const createdAt = user.createdAt;
  const createdFmt = createdAt.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const agoYears = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24 * 365));
  const { BRAND_NAME } = require('./branding');
  return new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — User Information`)
    .setColor(BRAND_COLOR_HEX)
    .addFields(
      { name: 'Discord Username', value: `${user.tag}`, inline: true },
      { name: 'User ID', value: `${user.id}`, inline: true },
      { name: 'Account Created', value: `${createdFmt} (${agoYears} years ago)` }
    )
    .setFooter({ text: BRAND_NAME });
}

function buildFormEmbed(form) {
  const { BRAND_NAME } = require('./branding');
  const fields = [];
  
  // Only add Roblox Username field if it exists
  if (form.roblox) {
    fields.push({ name: 'Roblox Username', value: form.roblox, inline: true });
  }
  
  fields.push({ name: 'Needed By', value: form.deadline || 'N/A', inline: true });
  fields.push({ name: 'What is needed', value: form.details || 'N/A' });
  
  return new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — Order Details`)
    .setColor(BRAND_COLOR_HEX)
    .addFields(fields)
    .setFooter({ text: BRAND_NAME });
}

function buildSupportWelcomeEmbed(user, category) {
  const { BRAND_NAME } = require('./branding');
  return new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — ${category}`)
    .setColor(BRAND_COLOR_HEX)
    .setDescription(
      `Hello ${user}, and welcome to ${BRAND_NAME}!\n\n` +
      `Please follow these rules while your ticket is open:\n` +
      `• Be respectful and patient.\n` +
      `• Do not ping staff unnecessarily.\n` +
      `• Provide as much detail as possible.\n\n` +
      `A staff member will be with you shortly.`
    )
    .setFooter({ text: BRAND_NAME });
}

function buildSupportFormEmbed(form) {
  const { BRAND_NAME } = require('./branding');
  const fields = [];
  
  // Only add Roblox Username field if it exists
  if (form.roblox) {
    fields.push({ name: 'Roblox Username', value: form.roblox, inline: true });
  }
  
  fields.push({ name: 'Reason', value: form.details || 'N/A' });
  
  return new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — Support Details`)
    .setColor(BRAND_COLOR_HEX)
    .addFields(fields)
    .setFooter({ text: BRAND_NAME });
}

function buildOpenOrderModal(category) {
  const modal = new ModalBuilder().setCustomId(`ticket_open_modal:${category}`).setTitle(`Start ${category} Order`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('details').setLabel('What do you need?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('deadline').setLabel('When do you need it by?').setStyle(TextInputStyle.Short).setRequired(true)),
  );
  return modal;
}

async function createTicketChannel(guild, opener, category) {
  // Hardcoded Orders category ID
  const ORDERS_CATEGORY_ID = '1457527791602896947';
  const DESIGN_TEAM_ROLE_ID = '1419090298730184776';
  const QUALITY_CONTROL_ROLE_ID = '1457926662485442600';
  const MANAGEMENT_ROLE_1_ID = process.env.MANAGEMENT_ROLE_1_ID || '1411100904949682236';
  const MANAGEMENT_ROLE_2_ID = process.env.MANAGEMENT_ROLE_2_ID || '1419399437997834301';
  
  const base = `order-${category.toLowerCase().replace(/\s+/g, '-')}-${opener.user ? opener.user.username : opener.username}`
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
  const name = base.slice(0, 90);
  
  // Create channel with permissions
  const ch = await guild.channels.create({
    name,
    parent: ORDERS_CATEGORY_ID,
    reason: `Order ticket for ${opener.id} in category ${category}`,
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: opener.id, // Opener
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
    ]
  });
  
  const ticketId = await generateTicketId();
  const topic = JSON.stringify({ category, openerId: opener.id, openedAt: Date.now(), claimedBy: null, ticketId });
  try { await ch.setTopic(topic); } catch {}
  return ch;
}

async function createTicketChannelWithParent(guild, opener, category, parentId) {
  // Hardcoded Support category IDs
  const GENERAL_SUPPORT_CATEGORY_ID = '1458914807003742279';
  const HR_SUPPORT_CATEGORY_ID = '1458914764490277073';
  const GENERAL_SUPPORT_ROLE_ID = '1457921599322722449';
  const MANAGEMENT_ROLE_1_ID = process.env.MANAGEMENT_ROLE_1_ID || '1411100904949682236';
  const MANAGEMENT_ROLE_2_ID = process.env.MANAGEMENT_ROLE_2_ID || '1419399437997834301';
  
  const base = `support-${category.toLowerCase().replace(/\s+/g, '-')}-${opener.user ? opener.user.username : opener.username}`
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
  const name = base.slice(0, 90);
  
  // Determine which category and permissions based on ticket type
  let categoryId;
  let permissionOverwrites = [
    {
      id: guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: opener.id, // Opener
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
    // Add General Support role
    permissionOverwrites.push({
      id: GENERAL_SUPPORT_ROLE_ID,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  } else if (category === 'HR Support') {
    categoryId = HR_SUPPORT_CATEGORY_ID;
    // HR Support only has opener and management (no additional roles)
  }
  
  const ch = await guild.channels.create({
    name,
    parent: categoryId,
    reason: `Support Ticket for ${opener.id} in category ${category}`,
    permissionOverwrites
  });
  
  const ticketId = await generateTicketId();
  const topic = JSON.stringify({ category, openerId: opener.id, openedAt: Date.now(), claimedBy: null, ticketId });
  try { await ch.setTopic(topic); } catch {}
  return ch;
}

async function resolveOrdersLogChannel(client) {
  const id = await getSetting('orders_log_channel_id');
  return id ? (client.channels.cache.get(id) || null) : null;
}

async function logAndCloseTicket(channel, payload) {
  // Fetch all messages chronologically
  let lastId;
  const collected = [];
  while (true) {
    const msgs = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!msgs || msgs.size === 0) break;
    const arr = Array.from(msgs.values());
    arr.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
    collected.push(...arr);
    lastId = msgs.lastKey();
    if (msgs.size < 100) break;
  }

  // Build HTML transcript
  const he = require('he');
  const htmlParts = [];
  htmlParts.push(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Transcript ${channel.name}</title><style>
    body { background: #36393F; color: #DCDEE1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif; margin: 0; }
    .container { max-width: 900px; margin: 24px auto; padding: 0 16px; }
    .msg { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid #2F3136; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; flex: 0 0 40px; }
    .content { flex: 1; }
    .header { display: flex; align-items: baseline; gap: 8px; }
    .username { font-weight: 600; color: #fff; }
    .bot { background: #5865F2; color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 3px; }
    .ts { color: #A3A6AA; font-size: 12px; }
    .text { white-space: pre-wrap; word-wrap: break-word; }
    .embed { border-left: 4px solid #4f545c; background: #2F3136; padding: 8px 12px; border-radius: 4px; margin-top: 6px; }
    .embed .title { color: #fff; font-weight: 600; margin-bottom: 6px; }
    .embed .desc { color: #DCDEE1; }
    .embed .field { margin-top: 8px; }
    .attachments img { max-width: 480px; border-radius: 4px; display: block; margin-top: 6px; }
  </style></head><body><div class="container">`);

  for (const m of collected) {
    const authorTag = he.encode(m.author?.tag || m.author?.username || m.author?.id || 'Unknown');
    const avatar = m.author?.displayAvatarURL({ extension: 'png', size: 64 }) || '';
    const timestamp = new Date(m.createdTimestamp).toLocaleString();
    const content = he.encode(m.content || '');
    const isBot = !!m.author?.bot;

    htmlParts.push(`<div class="msg">
      <img class="avatar" src="${avatar}" alt=""/>
      <div class="content">
        <div class="header"><span class="username">${authorTag}</span>${isBot ? '<span class="bot">BOT</span>' : ''}<span class="ts">${timestamp}</span></div>
        ${content ? `<div class="text">${content}</div>` : ''}
    `);

    // Embeds
    if (m.embeds && m.embeds.length) {
      for (const e of m.embeds) {
        const title = he.encode(e.title || '');
        const desc = he.encode(e.description || '');
        const color = typeof e.color === 'number' ? `#${e.color.toString(16).padStart(6,'0')}` : '#4f545c';
        htmlParts.push(`<div class="embed" style="border-color:${color}">`);
        if (title) htmlParts.push(`<div class="title">${title}</div>`);
        if (desc) htmlParts.push(`<div class="desc">${desc}</div>`);
        if (Array.isArray(e.fields)) {
          for (const f of e.fields) {
            const fn = he.encode(f.name || '');
            const fv = he.encode(f.value || '');
            htmlParts.push(`<div class="field"><div class="title">${fn}</div><div class="desc">${fv}</div></div>`);
          }
        }
        if (e.image?.url) {
          const url = e.image.url;
          htmlParts.push(`<div class="attachments"><img src="${url}"/></div>`);
        }
        htmlParts.push(`</div>`);
      }
    }

    // Attachments
    if (m.attachments && m.attachments.size) {
      htmlParts.push(`<div class="attachments">`);
      for (const att of m.attachments.values()) {
        const url = att.url;
        if (att.contentType && att.contentType.startsWith('image/')) {
          htmlParts.push(`<img src="${url}" alt="attachment"/>`);
        } else {
          const name = he.encode(att.name || 'file');
          htmlParts.push(`<div><a href="${url}" target="_blank" rel="noreferrer noopener">${name}</a></div>`);
        }
      }
      htmlParts.push(`</div>`);
    }

    htmlParts.push(`</div></div>`); // close content + msg
  }

  htmlParts.push(`</div></body></html>`);
  const html = htmlParts.join('');
  const buf = Buffer.from(html, 'utf8');

  const { BRAND_NAME } = require('./branding');
  const embedFields = [
    { name: 'Opened By', value: `<@${payload.openerId}>`, inline: true },
    { name: 'Category', value: payload.category, inline: true },
    { name: 'Handler', value: payload.claimedBy ? `<@${payload.claimedBy}>` : 'Not Claimed', inline: true },
    { name: 'Closed By', value: `<@${payload.closedBy}>`, inline: true }
  ];
  
  if (payload.ticketId) {
    embedFields.push({ name: 'Ticket ID', value: `#${payload.ticketId}`, inline: true });
  }
  
  if (payload.reason) {
    embedFields.push({ name: 'Reason', value: payload.reason });
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`${BRAND_NAME} — Ticket Closed`)
    .setColor(BRAND_COLOR_HEX)
    .addFields(embedFields)
    .setFooter({ text: BRAND_NAME });

  // Build a gzip so Discord doesn't inline-preview the HTML; users get a clean download link
  const zlib = require('zlib');
  const gz = zlib.gzipSync(buf);

  // Always send to Tickets Log channel (dedicated) only
  const ticketsLogCh = await resolveTicketLogChannel(channel.client);
  if (ticketsLogCh && ticketsLogCh.isTextBased()) {
    await ticketsLogCh.send({ embeds: [embed], files: [{ attachment: gz, name: `transcript-${channel.id}.html.gz` }] });
  }

  // DM the opener with a closure summary
  try {
    const guild = channel.guild;
    const opener = await channel.client.users.fetch(payload.openerId).catch(() => null);
    if (opener) {
      const guildIcon = guild.iconURL({ size: 128, extension: 'png' }) || undefined;
      const dmFields = [
        { name: 'Opened By', value: `<@${payload.openerId}>`, inline: true },
        { name: 'Closed By', value: `<@${payload.closedBy}>`, inline: true },
        { name: 'Opened At', value: payload.openedAt ? new Date(payload.openedAt).toUTCString() : 'Unknown', inline: true },
        { name: 'Claimed By', value: payload.claimedBy ? `<@${payload.claimedBy}>` : 'Not Claimed', inline: true }
      ];
      
      if (payload.ticketId) {
        dmFields.push({ name: 'Ticket ID', value: `#${payload.ticketId}`, inline: true });
      }
      
      if (payload.reason) {
        dmFields.push({ name: 'Reason', value: payload.reason });
      }
      
      const dmEmbed = new (require('discord.js').EmbedBuilder)()
        .setAuthor({ name: guild.name, iconURL: guildIcon })
        .setTitle('Ticket Closed')
        .setColor(BRAND_COLOR_HEX)
        .addFields(dmFields)
        .setFooter({ text: new Date().toUTCString() });
      await opener.send({ embeds: [dmEmbed] }).catch(()=>{});
    }
  } catch {}

  // Do NOT send to orders log; orders log is manual via /logorder

  await channel.delete('Ticket closed');
}

async function getTicketMeta(channel) {
  try {
    const topic = await channel.fetch().then(c => c.topic || '');
    return JSON.parse(topic || '{}');
  } catch { return {}; }
}

module.exports = {
  buildTicketButtons,
  buildWelcomeEmbed,
  buildUserInfoEmbed,
  buildFormEmbed,
  buildSupportWelcomeEmbed,
  buildSupportFormEmbed,
  buildOpenOrderModal,
  createTicketChannel,
  logAndCloseTicket,
  getTicketMeta,
  getCategoryStatus,
  resolveSupportCategory,
  createTicketChannelWithParent,
  listCategories,
};
