# Render Deployment Guide

This guide will help you deploy the RCE Utilities Discord bot to Render.

## Prerequisites

- A Render account (sign up at https://render.com)
- Your Discord bot token and application credentials
- All API keys (Roblox, OpenWeather, Bloxlink, etc.)

## Step 1: Create a New Web Service

1. Go to your Render Dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub/GitLab repository or use "Public Git repository"
4. Enter your repository URL

## Step 2: Configure Build Settings

### Basic Settings:
- **Name**: `rce-utilities-bot` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave blank (unless bot is in a subdirectory)
- **Runtime**: `Node`

### Build & Deploy Settings:
- **Build Command**: 
  ```bash
  npm install
  ```

- **Start Command**: 
  ```bash
  npm start
  ```

### Advanced Settings:
- **Node Version**: The bot requires Node.js 18.x - 22.x
  - Add environment variable: `NODE_VERSION` = `18` (Render will use the latest 18.x)
  - Or specify in package.json engines (already configured)

- **Auto-Deploy**: Yes (recommended for automatic updates)

## Step 3: Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add all of the following:

### ⚠️ IMPORTANT: Discord OAuth Setup (Required for Web Dashboard)

Before adding environment variables, configure Discord OAuth:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (Client ID: `1385634318419886162`)
3. Go to **OAuth2** → **General**
4. Under **Redirects**, add: `https://kcutils.onrender.com/auth/discord/callback`
   - ⚠️ Replace `kcutils.onrender.com` with your actual Render service URL
5. **Save Changes**
6. Copy your **Client Secret** from this page (you'll need it below)

### Required Discord Configuration:
| Variable Name | Description | Example |
|--------------|-------------|---------|
| `TOKEN` | Discord bot token | `MTM4NTYzNDMxODQxOTg4NjE2Mg...` |
| `CLIENT_ID` | Discord application client ID | `1385634318419886162` |
| `CLIENT_SECRET` | Discord OAuth client secret | `abcd1234efgh5678...` |
| `GUILD_ID` | Your Discord server ID | `1297697183503745066` |

### Web Dashboard Configuration:
| Variable Name | Description | Example |
|--------------|-------------|---------|
| `APPEAL_BASE_URL` | Your Render service URL | `https://kcutils.onrender.com` |
| `PORT` | Port for web server (auto-set by Render) | `3000` |

### Role IDs:
| Variable Name | Description |
|--------------|-------------|
| `STAFF_ROLE_ID` | Staff role ID |
| `MODERATOR_ROLE_ID` | Moderator role ID |
| `MANAGEMENT_ROLE_1_ID` | Management role 1 ID |
| `MANAGEMENT_ROLE_2_ID` | Management role 2 ID |
| `VERIFIED_ROLE_ID` | Verified role ID |

### Channel IDs:
| Variable Name | Description |
|--------------|-------------|
| `AUDIT_LOG_CHANNEL_ID` | Channel for audit logs |
| `MOD_LOG_CHANNEL_ID` | Channel for moderation logs |
| `INFRACTIONS_CHANNEL_ID` | Channel for infractions |
| `INFRACTION_CHANNEL_IDS` | Comma-separated infraction channels |
| `FEEDBACK_CHANNEL_ID` | Channel for feedback |

### Roblox Integration:
| Variable Name | Description |
|--------------|-------------|
| `ROBLOSECURITY` | Roblox security cookie (starts with `_\|WARNING:...`) |
| `ROBLOX_API_KEY` | Roblox Open Cloud API key |
| `ROBLOX_UNIVERSE_ID` | Your Roblox game universe ID |
| `BLOXLINK_API_KEY` | Bloxlink API key for Discord-Roblox linking |

### Web Server & Authentication:
| Variable Name | Description | Default |
|--------------|-------------|---------|
| `PORT` | Web server port | `3000` (Render will override this) |
| `EMBED_AUTH_USER` | Username for embed authentication | - |
| `EMBED_AUTH_PASSWORD` | Password for embed authentication | - |

### External APIs:
| Variable Name | Description |
|--------------|-------------|
| `OPENWEATHER_API_KEY` | OpenWeather API key for weather command |

### Deployment Configuration:
| Variable Name | Description | Recommended Value |
|--------------|-------------|-------------------|
| `RUN_DEPLOY` | Run command deployment on startup | `1` |
| `SKIP_GLOBAL` | Skip global command deployment | `true` |
| `SKIP_GUILD` | Skip guild command deployment | `` (leave empty) |
| `DELETE_OLD` | Delete old commands on redeploy | `true` |

### Optional Settings:
| Variable Name | Description |
|--------------|-------------|
| `CLEAR_ALL` | Clear all commands (use cautiously) |
| `SAFE_GUILD` | Safe guild ID to prevent accidental clears |

## Step 4: Important Notes

### Port Configuration
- Render automatically assigns a port and sets the `PORT` environment variable
- The bot is already configured to use `process.env.PORT || 3000`
- **You don't need to manually set PORT** - Render handles this

### Database
- The bot uses SQLite (`database/modlogs.db`)
- Render's ephemeral filesystem means **database will reset on deploys**
- **Recommended**: Migrate to a persistent database (PostgreSQL) for production
- **Alternative**: Use Render Disks to persist the database directory

### Session Storage
- Sessions are stored in files (using `session-file-store`)
- These will also reset on redeploy
- Consider using a database-backed session store for production

### Build Process
- The `prestart` script automatically runs `deploy-commands.js`
- This registers your slash commands with Discord on startup
- Controlled by the `RUN_DEPLOY` environment variable

## Step 5: Deploy

1. Review all settings
2. Click **"Create Web Service"**
3. Render will:
   - Clone your repository
   - Run `npm install`
   - Run `npm start` (which triggers `prestart` → deploys commands)
   - Start your bot and web server

## Step 6: Verify Deployment

### Check Logs:
1. Go to your service in Render Dashboard
2. Click **"Logs"** tab
3. Look for:
   ```
   ✅ Bot is ready!
   🌐 Web server running on port 3000
   ```

### Test the Bot:
1. Visit your web service URL (e.g., `https://your-service.onrender.com`)
2. You should see the home portal with Appeals, Applications, and Admin Panel
3. Test a slash command in your Discord server

### Test Web Features:
- **Appeals Portal**: `https://your-service.onrender.com/appeals`
- **Applications Portal**: `https://your-service.onrender.com/applications`
- **Admin Panel**: `https://your-service.onrender.com/admin`

## Troubleshooting

### Bot Not Responding to Commands
- Check that `CLIENT_ID` and `GUILD_ID` are correct
- Verify the bot token is valid
- Check logs for command deployment errors

### Web Server Not Accessible
- Render requires a web server to keep the service alive
- Check that the Express server is running (check logs)
- Verify the PORT is being read from environment

### Commands Not Deploying
- Set `RUN_DEPLOY=1` in environment variables
- Check deployment logs in the console output
- Manually run: `npm run deploy` via Render Shell

### Database Data Loss
- SQLite database is ephemeral on Render's free tier
- **Solution 1**: Use Render Disks (paid feature)
- **Solution 2**: Migrate to PostgreSQL (Render offers free PostgreSQL)
- **Solution 3**: Accept data loss and use for testing only

### Native Dependencies Issues (sqlite3)
- Render should compile native dependencies automatically
- If issues occur, ensure `node_modules` is not in your repo
- Let Render's build process install fresh dependencies

## Upgrading & Redeployment

### Automatic Deploys:
- Push to your connected branch → Render auto-deploys

### Manual Deploy:
- Go to your service → Click **"Manual Deploy"** → **"Deploy latest commit"**

### Clearing Commands:
If you need to clear all commands:
1. Set environment variable: `CLEAR_ALL=true`
2. Redeploy
3. **Important**: Remove `CLEAR_ALL` and redeploy again

## Cost Considerations

### Free Tier:
- **Pros**: Free to start, good for testing
- **Cons**: 
  - Service spins down after 15 minutes of inactivity
  - 750 hours/month free (enough for 1 service)
  - Ephemeral storage (database resets)

### Paid Tier ($7/month):
- **Pros**:
  - Always online (no spin down)
  - Better performance
  - Can add persistent disks
- **Cons**: Monthly cost

### Keeping Free Tier Alive:
- Use an uptime monitor (UptimeRobot, Betterstack, etc.)
- Ping your web server every 10 minutes
- URL to ping: `https://your-service.onrender.com`

## Security Best Practices

1. **Never commit `.env` file** (already in `.gitignore`)
2. **Rotate sensitive tokens** if accidentally exposed
3. **Use environment variables** for all secrets
4. **Restrict admin routes** with proper authentication
5. **Keep dependencies updated**: `npm outdated` → `npm update`

## Additional Resources

- [Render Node.js Docs](https://render.com/docs/deploy-node-express-app)
- [Discord.js Guide](https://discordjs.guide/)
- [Render Environment Variables](https://render.com/docs/environment-variables)

## Support

If you encounter issues:
1. Check Render logs for errors
2. Verify all environment variables are set correctly
3. Test locally with the same environment variables
4. Check Render status page for service issues

---

**Quick Reference:**
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: 18.x - 22.x
- **Port**: Automatically assigned by Render
- **Health Check URL**: `/` (root returns home portal)
