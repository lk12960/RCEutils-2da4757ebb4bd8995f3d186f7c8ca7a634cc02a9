const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the current weather for a location')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('City name or city,country code (e.g. London or London,UK)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const location = interaction.options.getString('location');
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return interaction.reply({ content: 'API key for OpenWeatherMap is not set.', ephemeral: true });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;

    try {
      const response = await axios.get(url);
      const weather = response.data;

      const embed = new EmbedBuilder()
        .setTitle(`Weather in ${weather.name}, ${weather.sys.country}`)
        .setDescription(weather.weather[0].description.replace(/\b\w/g, c => c.toUpperCase()))
        .setThumbnail(`http://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`)
        .addFields(
          { name: 'Temperature', value: `${weather.main.temp}°C`, inline: true },
          { name: 'Feels Like', value: `${weather.main.feels_like}°C`, inline: true },
          { name: 'Humidity', value: `${weather.main.humidity}%`, inline: true },
          { name: 'Wind Speed', value: `${weather.wind.speed} m/s`, inline: true },
          { name: 'Pressure', value: `${weather.main.pressure} hPa`, inline: true },
        )
        .setColor('#1E90FF')
        .setFooter({ text: 'Powered by OpenWeatherMap' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: 'Could not find weather data for that location.', ephemeral: true });
    }
  },
};
