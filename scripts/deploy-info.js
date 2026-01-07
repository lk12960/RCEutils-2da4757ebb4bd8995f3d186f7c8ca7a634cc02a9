// Quick info about deployment system
console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Advanced Discord Deployment System - Info           ║
╚══════════════════════════════════════════════════════════════╝

📦 Commands Found:
   - Guild: Run script to see count
   - Global: Run script to see count

🚀 Quick Commands:
   npm run deploy              # Deploy all commands
   npm run deploy:force        # Force full redeploy (ignore cache)
   npm run deploy:guild        # Deploy only guild commands
   npm run deploy:global       # Deploy only global commands
   npm run deploy:debug        # Deploy with debug output

✨ Features:
   ✓ Smart diffing - only updates changed commands
   ✓ Intelligent deletion - only removes deleted files
   ✓ Parallel operations for speed
   ✓ Automatic validation
   ✓ State caching

📖 Documentation:
   See scripts/README.md for full details

🔧 Environment Variables:
   CLIENT_ID=required
   TOKEN=required
   GUILD_ID=optional (for guild commands)
   FORCE_DEPLOY=optional (true/false)
   SKIP_GUILD=optional (true/false)
   SKIP_GLOBAL=optional (true/false)
   DEBUG=optional (true/false)

╔══════════════════════════════════════════════════════════════╗
║  Note: This system NEVER clears all commands automatically  ║
║  Commands are only deleted if their file was removed!        ║
╚══════════════════════════════════════════════════════════════╝
`);
