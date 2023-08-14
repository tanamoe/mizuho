import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from "discord.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import vi from "dayjs/locale/vi.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

import type { Command } from "@customTypes/command.js";
import {
  type BookDetailedResponse,
  Collections,
  PublisherResponse,
} from "@customTypes/pb.js";
import pb from "@lib/pb.js";
import { EmbedBuilder } from "@discordjs/builders";
import { emote } from "@utils/emote.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.locale(vi);
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");

const dateFormats = ["DD-MM-YYYY", "DD/MM/YYYY", "DD.MM.YYYY"];

function groupBy<T>(arr: T[], fn: (item: T) => any) {
  return arr.reduce<Record<string, T[]>>((prev, curr) => {
    const groupKey = fn(curr);
    const group = prev[groupKey] || [];
    group.push(curr);
    return { ...prev, [groupKey]: group };
  }, {});
}

function parseVolume(volume: number) {
  return Math.floor(volume / 10000) + (volume % 10) * 0.1;
}

export default {
  data: new SlashCommandBuilder()
    .setName("releases")
    .setDescription("Xem lịch phát hành")
    .addStringOption((option) =>
      option.setName("date").setDescription("Ngày/tháng/năm")
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (
      interaction.options.getString("date") &&
      !dayjs(interaction.options.getString("date"), dateFormats).isValid()
    ) {
      return await interaction.editReply("Ngày không hợp lệ.");
    }

    const date = interaction.options.getString("date")
      ? dayjs(interaction.options.getString("date"), dateFormats).startOf("day")
      : dayjs.tz().startOf("day");

    const data = await pb.collection(Collections.BookDetailed).getFullList<
      BookDetailedResponse<{
        publisher: PublisherResponse;
      }>
    >({
      expand: "publisher",
      sort: "+publishDate,+name,-edition",
      filter: `publishDate >= '${date.format(
        "YYYY-MM-DD"
      )}' && publishDate < '${date.add(1, "day").format("YYYY-MM-DD")}'`,
    });

    if (data.length === 0)
      return await interaction.reply("Không có truyện phát hành ngày này.");

    const releases = groupBy<
      BookDetailedResponse<{
        publisher: PublisherResponse;
      }>
    >(
      data.map((release) => ({
        ...release,
        volume: parseVolume(release.volume),
      })),
      (p) => p.publisher
    );

    const attachment = new AttachmentBuilder(
      `https://og.tana.moe/calendar/today?date=${date.format("YYYY-MM-DD")}`,
      {
        name: "releases.png",
      }
    );

    const embed = new EmbedBuilder()
      .setColor(0x89c4f4)
      .setAuthor({
        name: "Tana.moe",
        iconURL: "https://tana.moe/apple-touch-icon.png",
        url: "https://tana.moe",
      })
      .setTitle("Lịch phát hành")
      .setDescription(
        Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(
          date.toDate()
        )
      )
      .setURL("https://tana.moe/calendar");

    for (const publisher in releases) {
      const emoji = emote.find(
        (e) => e.id === releases[publisher][0].expand?.publisher.slug
      )?.value;

      embed.addFields({
        name: `${emoji || ""} ${
          releases[publisher][0].expand!.publisher.name
        }`.trim(),
        value: releases[publisher]
          .map((release) => {
            if (release.edition) return `${release.name} (${release.edition})`;
            return release.name;
          })
          .join("\n"),
      });
    }

    embed.setFooter({
      text:
        "Tổng số tiền: " +
        Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(data.reduce((prev, curr) => prev + curr.price, 0)),
    });

    return await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  },
} as Command;
