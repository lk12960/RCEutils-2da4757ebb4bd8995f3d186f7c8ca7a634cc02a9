const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const bibleReferences = [
  "Genesis 4:7",
  "Genesis 12:1-3",
  "Genesis 15:6",
  "Genesis 28:12",
  "Exodus 15:2",
  "Exodus 34:6-7",
  "Leviticus 11:45",
  "Numbers 23:19",
  "Deuteronomy 7:9",
  "Deuteronomy 30:19",
  "Joshua 24:15",
  "Judges 21:25",
  "1 Samuel 2:2",
  "1 Samuel 24:12",
  "2 Samuel 7:16",
  "1 Kings 18:21",
  "2 Kings 2:11",
  "1 Chronicles 29:11",
  "2 Chronicles 20:15",
  "Ezra 10:4",
  "Nehemiah 4:14",
  "Esther 8:17",
  "Job 23:10",
  "Psalm 16:8",
  "Psalm 34:8",
  "Psalm 40:1-3",
  "Psalm 68:19",
  "Psalm 84:11",
  "Psalm 107:1",
  "Psalm 118:24",
  "Psalm 145:9",
  "Proverbs 1:7",
  "Proverbs 10:12",
  "Proverbs 13:20",
  "Proverbs 22:6",
  "Ecclesiastes 7:8",
  "Song of Solomon 8:7",
  "Isaiah 12:2",
  "Isaiah 25:8",
  "Isaiah 35:4",
  "Isaiah 54:17",
  "Jeremiah 33:3",
  "Lamentations 3:40",
  "Ezekiel 11:19",
  "Daniel 6:26",
  "Hosea 4:6",
  "Joel 3:10",
  "Amos 9:11",
  "Obadiah 1:21",
  "Jonah 4:2",
  "Micah 7:18",
  "Nahum 1:3",
  "Habakkuk 2:4",
  "Zephaniah 2:3",
  "Haggai 1:7",
  "Zechariah 9:9",
  "Malachi 4:2",
  "Matthew 4:19",
  "Matthew 5:44",
  "Matthew 6:14-15",
  "Matthew 19:26",
  "Matthew 25:40",
  "Mark 1:17",
  "Mark 12:30",
  "Luke 9:23",
  "Luke 19:10",
  "John 4:24",
  "John 11:25-26",
  "Acts 2:38",
  "Acts 16:31",
  "Romans 1:16",
  "Romans 8:38-39",
  "Romans 10:9",
  "1 Corinthians 6:19-20",
  "1 Corinthians 15:58",
  "2 Corinthians 12:9",
  "Galatians 6:9",
  "Ephesians 4:32",
  "Philippians 3:14",
  "Colossians 2:6-7",
  "1 Thessalonians 4:3",
  "2 Thessalonians 3:3",
  "1 Timothy 6:12",
  "2 Timothy 3:16",
  "Titus 2:11-12",
  "Philemon 1:6",
  "Hebrews 10:24-25",
  "Hebrews 13:8",
  "James 2:17",
  "1 Peter 1:8-9",
  "2 Peter 3:18",
  "1 John 5:14-15",
  "Jude 1:24",
  "Revelation 1:8",
  "Revelation 7:17",
  "Revelation 12:11",
  "Revelation 19:11"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bibleverse')
    .setDescription('Get a completely random Bible verse'),

  async execute(interaction) {
    // Pick random reference
    const randomRef = bibleReferences[Math.floor(Math.random() * bibleReferences.length)];

    try {
      const url = `https://bible-api.com/${encodeURIComponent(randomRef)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Could not fetch verse.');

      const data = await response.json();

      // Create embed with verse and reference
      const embed = new EmbedBuilder()
        .setTitle(`📖 Bible Verse: ${data.reference}`)
        .setDescription(data.text.trim())
        .setColor('#FFD700') // golden color
        .setFooter({ text: 'Source: bible-api.com' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to fetch a Bible verse. Try again later!', ephemeral: true });
    }
  },
};
