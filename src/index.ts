import type { Command } from "./types/command.js";

import { logger } from "./lib/logger.js";
import { register } from "./lib/register.js";

import * as dotenv from "dotenv";
import { Client, Events, GatewayIntentBits } from "discord.js";

import releaseCommand from "./commands/release.js";

dotenv.config();

if (!process.env.DISCORD_TOKEN)
  throw new Error("Discord token is not defined.");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Registering commands
const commands: Command[] = [releaseCommand];

await register(commands);

// Handle interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (
    interaction.isChatInputCommand() ||
    interaction.isMessageContextMenuCommand()
  ) {
    const command = commands.find(
      (command) => command.data.name === interaction.commandName
    );

    if (!command) {
      logger.error(`Không tìm thấy lệnh ${interaction.commandName} nyaaaaa~`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (e) {
      logger.error(e);
    }
  }

  if (interaction.isButton()) {
    const action = commands.find(
      (action) => action.data.name === interaction.customId
    );

    if (!action) {
      logger.error(`Không thực thi được hành động ${interaction.customId}`);
      return;
    }

    try {
      await action.execute(interaction);
    } catch (e) {
      logger.error(e);
    }
  }
});

logger.info("Ready.");

// Start the bot
client.login(DISCORD_TOKEN);
