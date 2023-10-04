import {
  BookDetailedResponse,
  Collections,
  PublisherResponse,
} from "@customTypes/pb.js";
import { EmbedBuilder } from "@discordjs/builders";
import pb from "@lib/pb.js";
import { emote } from "@utils/emote.js";
import { Dayjs } from "dayjs";
import { AttachmentBuilder } from "discord.js";

export function groupBy<T>(arr: T[], fn: (item: T) => any) {
  return arr.reduce<Record<string, T[]>>((prev, curr) => {
    const groupKey = fn(curr);
    const group = prev[groupKey] || [];
    group.push(curr);
    return { ...prev, [groupKey]: group };
  }, {});
}

export function parseVolume(volume: number) {
  return Math.floor(volume / 10000) + (volume % 10) * 0.1;
}

export async function getReleases(date: Dayjs) {
  const data = await pb.collection(Collections.BookDetailed).getFullList<
    BookDetailedResponse<{
      publisher: PublisherResponse;
    }>
  >({
    expand: "publisher",
    sort: "+publishDate,+name,-edition",
    filter: `publishDate >= '${date.format(
      "YYYY-MM-DD",
    )}' && publishDate < '${date.add(1, "day").format("YYYY-MM-DD")}'`,
  });

  if (data.length === 0) return null;

  return {
    data: groupBy<
      BookDetailedResponse<{
        publisher: PublisherResponse;
      }>
    >(
      data.map((release) => ({
        ...release,
        volume: parseVolume(release.volume),
      })),
      (p) => p.publisher,
    ),
    totalPrice: data.reduce((prev, curr) => prev + curr.price, 0),
  };
}

export async function buildReleases(date: Dayjs) {
  const releases = await getReleases(date);
  if (!releases) return null;

  const { data, totalPrice } = releases;

  const attachment = new AttachmentBuilder(
    `https://og.tana.moe/calendar/today?date=${date.format("YYYY-MM-DD")}`,
    {
      name: "releases.png",
    },
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
      Intl.DateTimeFormat("vi-VN", {
        dateStyle: "full",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date.toDate()),
    )
    .setURL("https://tana.moe/calendar");

  for (const publisher in data) {
    const emoji = emote.find(
      (e) => e.id === data[publisher][0].expand?.publisher.slug,
    )?.value;

    embed.addFields({
      name: `${emoji || ""} ${
        data[publisher][0].expand!.publisher.name
      }`.trim(),
      value: data[publisher]
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
      }).format(totalPrice),
  });

  return { embed, attachment };
}
