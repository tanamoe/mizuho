import type { Command } from "@customTypes/command.js";

import { logger } from "@lib/logger.js";
import { register } from "@lib/register.js";

import { Client, Events, GatewayIntentBits, TextChannel } from "discord.js";
import { Cron } from "croner";
import dayjs from "dayjs";

import releaseCommand from "@commands/release.js";
import { buildReleases } from "@lib/release.js";

if (!process.env.DISCORD_TOKEN)
  throw new Error("Discord token is not defined.");

if (!process.env.RELEASES_CHANNEL)
  throw new Error("Releases channel is not defined.");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const RELEASES_CHANNEL = process.env.RELEASES_CHANNEL;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
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
      logger.error(`Không tìm thấy lệnh ${interaction.commandName}`);
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

// Schedule to run releases on every 6am
Cron(
  "0 */6 * * *",
  {
    timezone: "Asia/Ho_Chi_Minh",
  },
  async () => {
    const date = dayjs.tz().startOf("day");
    const response = await buildReleases(date);

    if (!response) return;

    const { embed, attachment } = response;

    const channel = client.channels.cache.get(RELEASES_CHANNEL) as TextChannel;
    if (channel) channel.send({ embeds: [embed], files: [attachment] });
  }
);
