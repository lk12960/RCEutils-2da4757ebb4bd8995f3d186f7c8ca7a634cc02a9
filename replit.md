# RCE Utilities Discord Bot

## Overview
A Discord bot built with discord.js for server moderation, utilities, and fun commands. It includes features like moderation logging, infractions management, ticket systems, and various fun commands.

## Project Structure
- `index.js` - Main entry point, sets up Discord client and Express server
- `commands/` - Slash commands organized by category:
  - `fun/` - Entertainment commands (8ball, trivia, games, etc.)
  - `moderation/` - Moderation tools (ban, kick, mute, infractions, etc.)
  - `utilities/` - Utility commands (tickets, roles, settings, etc.)
- `commandsT/` - Text-based prefix commands
- `events/` - Discord event handlers
- `database/` - SQLite database setup and storage
- `utils/` - Utility modules and managers
- `scripts/` - Deployment scripts for Discord commands

## Required Environment Variables
- `TOKEN` - Discord bot token
- `CLIENT_ID` - Discord application client ID
- `GUILD_ID` - Discord server (guild) ID for command deployment

## Running the Bot
The bot runs on port 5000 with both:
1. Discord bot client
2. Express web server (health check endpoint)

Use `npm start` to run the bot. This first deploys commands then starts the bot.

## Database
Uses SQLite for data persistence (modlogs.db), storing:
- Moderation cases and infractions
- User notes
- Bot settings and prices
- Statistics and payouts
