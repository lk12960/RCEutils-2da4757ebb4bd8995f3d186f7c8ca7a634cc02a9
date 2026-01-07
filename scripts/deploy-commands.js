require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// ADVANCED DEPLOYMENT SYSTEM
// ============================================================================
// Features:
// - Smart diffing: Only updates changed commands
// - Intelligent deletion: Only removes commands that were deleted from codebase
// - Parallel operations for speed
// - Command state caching
// - Detailed analytics and logging
// - Validation and error recovery
// ============================================================================

const CACHE_FILE = path.join(__dirname, '.deploy-cache.json');
const COMMANDS_PATH = path.join(__dirname, '..', 'commands');

// Color codes for pretty logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Logger with timestamps and colors
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
  debug: (msg) => process.env.DEBUG && console.log(`${colors.magenta}[DEBUG]${colors.reset} ${msg}`),
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a hash for a command to detect changes
 */
function hashCommand(commandJSON) {
  const normalized = JSON.stringify(commandJSON, Object.keys(commandJSON).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Load cached deployment state
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log.warning(`Failed to load cache: ${error.message}`);
  }
  return { guild: {}, global: {}, timestamp: null };
}

/**
 * Save deployment state to cache
 */
function saveCache(cache) {
  try {
    cache.timestamp = new Date().toISOString();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    log.debug('Cache saved successfully');
  } catch (error) {
    log.warning(`Failed to save cache: ${error.message}`);
  }
}

/**
 * Validate command structure
 */
function validateCommand(command, filePath) {
  const errors = [];
  
  if (!command?.data || typeof command.data.toJSON !== 'function') {
    errors.push('Missing data or toJSON method');
    return errors;
  }
  
  const json = command.data.toJSON();
  
  if (!json.name || typeof json.name !== 'string') {
    errors.push('Missing or invalid name');
  }
  
  if (!json.description || typeof json.description !== 'string') {
    errors.push('Missing or invalid description');
  }
  
  // Check options order (required before optional)
  if (json.options && Array.isArray(json.options)) {
    let foundOptional = false;
    for (const option of json.options) {
      if (option.required === false) {
        foundOptional = true;
      } else if (option.required === true && foundOptional) {
        errors.push(`Required option '${option.name}' comes after optional options`);
      }
    }
  }
  
  return errors;
}

/**
 * Load all commands from filesystem
 */
function loadCommands() {
  const guildCommands = [];
  const globalCommands = [];
  const commandNames = new Set();
  const validationErrors = [];
  
  const commandFolders = fs.readdirSync(COMMANDS_PATH);
  
  for (const folder of commandFolders) {
    const folderPath = path.join(COMMANDS_PATH, folder);
    
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      
      try {
        // Clear require cache to ensure fresh load
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        
        // Validate command
        const errors = validateCommand(command, filePath);
        if (errors.length > 0) {
          validationErrors.push({ file: filePath, errors });
          continue;
        }
        
        const commandJSON = command.data.toJSON();
        const name = commandJSON.name;
        
        // Check for duplicates
        if (commandNames.has(name)) {
          log.warning(`Duplicate command name detected: "${name}" in ${filePath}`);
          continue;
        }
        
        commandNames.add(name);
        
        // Add hash for change detection
        const hash = hashCommand(commandJSON);
        const commandWithMeta = {
          ...commandJSON,
          _meta: {
            hash,
            folder,
            file,
            path: filePath,
          },
        };
        
        // Route all commands to guild (no global commands)
        guildCommands.push(commandWithMeta);
        
      } catch (error) {
        validationErrors.push({ 
          file: filePath, 
          errors: [`Failed to load: ${error.message}`] 
        });
      }
    }
  }
  
  // Report validation errors
  if (validationErrors.length > 0) {
    log.error('Command validation errors found:');
    validationErrors.forEach(({ file, errors }) => {
      console.log(`  ${colors.red}✗${colors.reset} ${path.relative(process.cwd(), file)}`);
      errors.forEach(err => console.log(`    - ${err}`));
    });
  }
  
  return { guildCommands, globalCommands, validationErrors };
}

/**
 * Fetch existing commands from Discord with timeout
 */
async function fetchExistingCommands(rest, clientId, guildId = null) {
  try {
    const fetchPromise = guildId 
      ? rest.get(Routes.applicationGuildCommands(clientId, guildId))
      : rest.get(Routes.applicationCommands(clientId));
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Fetch timeout after 30 seconds')), 30000)
    );
    
    const commands = await Promise.race([fetchPromise, timeoutPromise]);
    return new Map(commands.map(cmd => [cmd.name, cmd]));
  } catch (error) {
    log.error(`Failed to fetch existing commands: ${error.message}`);
    return new Map();
  }
}

/**
 * Compare commands and determine actions needed
 */
function determineActions(localCommands, remoteCommands, cache, scope) {
  const actions = {
    create: [],
    update: [],
    delete: [],
    skip: [],
  };
  
  const localNames = new Set(localCommands.map(cmd => cmd.name));
  const remoteNames = new Set(remoteCommands.keys());
  
  // Check local commands
  for (const cmd of localCommands) {
    const remote = remoteCommands.get(cmd.name);
    const cachedHash = cache[scope]?.[cmd.name];
    
    if (!remote) {
      // Command doesn't exist remotely
      actions.create.push(cmd);
    } else if (cmd._meta.hash !== cachedHash) {
      // Command changed since last deploy
      actions.update.push({ ...cmd, id: remote.id });
    } else {
      // Command unchanged
      actions.skip.push(cmd);
    }
  }
  
  // Check for deleted commands (exist remotely but not locally)
  for (const [name, remote] of remoteCommands.entries()) {
    if (!localNames.has(name)) {
      // Only delete if it was in our cache (meaning we deployed it)
      if (cache[scope]?.[name]) {
        actions.delete.push({ name, id: remote.id });
      } else {
        log.debug(`Remote command "${name}" not in local files, but also not in cache - skipping deletion`);
      }
    }
  }
  
  return actions;
}

/**
 * Execute deployment actions with parallel processing
 */
async function executeActions(rest, clientId, guildId, actions, scope) {
  const stats = { created: 0, updated: 0, deleted: 0, skipped: 0, failed: 0 };
  const newCache = {};
  
  // Skip unchanged commands
  for (const cmd of actions.skip) {
    newCache[cmd.name] = cmd._meta.hash;
    stats.skipped++;
  }
  
  // Create new commands (parallel)
  if (actions.create.length > 0) {
    log.step(`Creating ${actions.create.length} new ${scope} command(s)...`);
    const route = guildId 
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    
    const createPromises = actions.create.map(async (cmd) => {
      try {
        const { _meta, ...cleanCmd } = cmd;
        await rest.post(route, { body: cleanCmd });
        newCache[cmd.name] = cmd._meta.hash;
        stats.created++;
        log.success(`Created: ${cmd.name}`);
      } catch (error) {
        stats.failed++;
        log.error(`Failed to create ${cmd.name}: ${error.message}`);
      }
    });
    
    await Promise.all(createPromises);
  }
  
  // Update existing commands (parallel)
  if (actions.update.length > 0) {
    log.step(`Updating ${actions.update.length} ${scope} command(s)...`);
    
    const updatePromises = actions.update.map(async (cmd) => {
      try {
        const { _meta, id, ...cleanCmd } = cmd;
        const route = guildId
          ? Routes.applicationGuildCommand(clientId, guildId, id)
          : Routes.applicationCommand(clientId, id);
        
        await rest.patch(route, { body: cleanCmd });
        newCache[cmd.name] = cmd._meta.hash;
        stats.updated++;
        log.success(`Updated: ${cmd.name}`);
      } catch (error) {
        stats.failed++;
        log.error(`Failed to update ${cmd.name}: ${error.message}`);
      }
    });
    
    await Promise.all(updatePromises);
  }
  
  // Delete removed commands (parallel)
  if (actions.delete.length > 0) {
    log.step(`Deleting ${actions.delete.length} ${scope} command(s)...`);
    
    const deletePromises = actions.delete.map(async (cmd) => {
      try {
        const route = guildId
          ? Routes.applicationGuildCommand(clientId, guildId, cmd.id)
          : Routes.applicationCommand(clientId, cmd.id);
        
        await rest.delete(route);
        stats.deleted++;
        log.success(`Deleted: ${cmd.name}`);
      } catch (error) {
        stats.failed++;
        log.error(`Failed to delete ${cmd.name}: ${error.message}`);
      }
    });
    
    await Promise.all(deletePromises);
  }
  
  return { stats, newCache };
}

// ============================================================================
// MAIN DEPLOYMENT FLOW
// ============================================================================

async function deploy() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}      ADVANCED DISCORD COMMAND DEPLOYMENT SYSTEM${colors.reset}`);
  console.log(`${colors.bright}════════════════════════════════════════════════════════════${colors.reset}\n`);
  
  // Load environment variables
  const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
  const GUILD_ID = (process.env.GUILD_ID || '').trim();
  const TOKEN = (process.env.TOKEN || '').trim();
  
  const snowflake = /^\d+$/;
  
  // Validate environment
  if (!CLIENT_ID || !snowflake.test(CLIENT_ID)) {
    log.error('Invalid or missing CLIENT_ID');
    log.warning('Skipping deployment - set CLIENT_ID environment variable');
    process.exit(0); // Exit gracefully
  }
  
  if (!TOKEN) {
    log.error('Missing TOKEN');
    log.warning('Skipping deployment - set TOKEN environment variable');
    process.exit(0); // Exit gracefully
  }
  
  // Configuration
  const SKIP_GUILD = /^(1|true|yes)$/i.test(process.env.SKIP_GUILD || '');
  const SKIP_GLOBAL = /^(1|true|yes)$/i.test(process.env.SKIP_GLOBAL || '');
  const FORCE_DEPLOY = /^(1|true|yes)$/i.test(process.env.FORCE_DEPLOY || '');
  
  log.info(`Client ID: ${CLIENT_ID}`);
  log.info(`Guild ID: ${GUILD_ID || 'Not set'}`);
  log.info(`Force Deploy: ${FORCE_DEPLOY ? 'Yes' : 'No'}`);
  
  // Initialize REST client
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  
  // Verify authentication with timeout
  log.step('Verifying authentication...');
  try {
    const authPromise = rest.get(Routes.currentApplication());
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Authentication timeout after 10 seconds')), 10000)
    );
    
    const app = await Promise.race([authPromise, timeoutPromise]);
    log.success(`Authenticated as: ${app.name} (${app.id})`);
  } catch (error) {
    log.error(`Authentication failed: ${error.message}`);
    if (error.message.includes('timeout')) {
      log.error('Check your TOKEN and internet connection');
    }
    process.exit(1);
  }
  
  // Load commands from filesystem
  log.step('Loading commands from filesystem...');
  const { guildCommands, globalCommands, validationErrors } = loadCommands();
  
  if (validationErrors.length > 0) {
    log.error(`${validationErrors.length} command(s) failed validation. Fix errors and try again.`);
    process.exit(1);
  }
  
  log.success(`Loaded ${guildCommands.length} guild command(s)`);
  log.success(`Loaded ${globalCommands.length} global command(s)`);
  
  // Load cache
  const cache = FORCE_DEPLOY ? { guild: {}, global: {} } : loadCache();
  if (FORCE_DEPLOY) {
    log.info('Force deploy enabled - ignoring cache');
  } else if (cache.timestamp) {
    log.info(`Using cache from: ${new Date(cache.timestamp).toLocaleString()}`);
  }
  
  const updatedCache = { guild: {}, global: {} };
  const totalStats = { created: 0, updated: 0, deleted: 0, skipped: 0, failed: 0 };
  
  // ========================================================================
  // DEPLOY GUILD COMMANDS
  // ========================================================================
  
  if (GUILD_ID && !SKIP_GUILD) {
    console.log(`\n${colors.bright}─── Guild Commands ───${colors.reset}\n`);
    
    // Verify guild access
    try {
      await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
      log.success(`Guild access verified: ${GUILD_ID}`);
    } catch (error) {
      log.error(`Cannot access guild ${GUILD_ID}: ${error.message}`);
      log.warning('Skipping guild command deployment');
      SKIP_GUILD = true;
    }
    
    if (!SKIP_GUILD) {
      // Fetch existing guild commands with retry
      log.step('Fetching existing guild commands...');
      let existingGuild = new Map();
      
      try {
        existingGuild = await fetchExistingCommands(rest, CLIENT_ID, GUILD_ID);
        log.info(`Found ${existingGuild.size} existing guild command(s)`);
      } catch (error) {
        log.warning(`Failed to fetch existing commands: ${error.message}`);
        log.warning('Assuming no existing commands (will create all)');
      }
      
      // Determine actions
      const guildActions = determineActions(guildCommands, existingGuild, cache, 'guild');
      
      log.info(`Actions: ${guildActions.create.length} create, ${guildActions.update.length} update, ${guildActions.delete.length} delete, ${guildActions.skip.length} skip`);
      
      // Execute actions
      const { stats: guildStats, newCache: guildCache } = await executeActions(
        rest, CLIENT_ID, GUILD_ID, guildActions, 'guild'
      );
      
      updatedCache.guild = guildCache;
      
      // Update totals
      Object.keys(guildStats).forEach(key => {
        totalStats[key] += guildStats[key];
      });
      
      log.success(`Guild deployment complete`);
    }
  } else if (SKIP_GUILD) {
    log.info('Skipping guild commands (SKIP_GUILD enabled)');
  } else {
    log.info('Skipping guild commands (GUILD_ID not set)');
  }
  
  // ========================================================================
  // DEPLOY GLOBAL COMMANDS
  // ========================================================================
  
  if (!SKIP_GLOBAL) {
    console.log(`\n${colors.bright}─── Global Commands ───${colors.reset}\n`);
    
    // Fetch existing global commands
    log.step('Fetching existing global commands...');
    const existingGlobal = await fetchExistingCommands(rest, CLIENT_ID);
    log.info(`Found ${existingGlobal.size} existing global command(s)`);
    
    // Determine actions
    const globalActions = determineActions(globalCommands, existingGlobal, cache, 'global');
    
    log.info(`Actions: ${globalActions.create.length} create, ${globalActions.update.length} update, ${globalActions.delete.length} delete, ${globalActions.skip.length} skip`);
    
    // Execute actions
    const { stats: globalStats, newCache: globalCache } = await executeActions(
      rest, CLIENT_ID, null, globalActions, 'global'
    );
    
    updatedCache.global = globalCache;
    
    // Update totals
    Object.keys(globalStats).forEach(key => {
      totalStats[key] += globalStats[key];
    });
    
    log.success(`Global deployment complete`);
  } else {
    log.info('Skipping global commands (SKIP_GLOBAL enabled)');
  }
  
  // ========================================================================
  // FINALIZE
  // ========================================================================
  
  // Save cache
  saveCache(updatedCache);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n${colors.bright}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                    DEPLOYMENT SUMMARY${colors.reset}`);
  console.log(`${colors.bright}════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  ${colors.green}Created:${colors.reset}  ${totalStats.created}`);
  console.log(`  ${colors.cyan}Updated:${colors.reset}  ${totalStats.updated}`);
  console.log(`  ${colors.red}Deleted:${colors.reset}  ${totalStats.deleted}`);
  console.log(`  ${colors.blue}Skipped:${colors.reset}  ${totalStats.skipped}`);
  console.log(`  ${colors.yellow}Failed:${colors.reset}   ${totalStats.failed}`);
  console.log(`${colors.bright}────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`  ${colors.magenta}Duration:${colors.reset} ${duration}s`);
  console.log(`${colors.bright}════════════════════════════════════════════════════════════${colors.reset}\n`);
  
  if (totalStats.failed > 0) {
    log.warning('Some operations failed. Check the logs above for details.');
    process.exit(1);
  }
  
  log.success('Deployment completed successfully!');
}

// ============================================================================
// EXECUTE
// ============================================================================

deploy().catch(error => {
  log.error(`Deployment failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
