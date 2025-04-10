const { SlashCommandBuilder } = require('discord.js');
const GuildModel = require('../models/guildModel');
const AdModel = require('../models/adModel');
const BumpModel = require('../models/bumpModel');
const { isGuildSetup } = require('../utils/validation');
const { successEmbed, errorEmbed, bumpEmbed } = require('../utils/embeds');
const ms = require('ms');

module.exports = {
  cooldown: 0, // We'll handle the cooldown manually
  data: new SlashCommandBuilder()
    .setName('bump')
    .setDescription('Bump your server advertisement to keep it active'),
    
  async execute(interaction) {
    await interaction.deferReply();
    const { guild, user } = interaction;
    
    try {
      // Check if the guild is set up
      const isSetup = await isGuildSetup(guild.id);
      if (!isSetup) {
        return interaction.editReply({
          embeds: [errorEmbed('Setup Required', 'Please set up the bot first using the `/setup` command.')],
        });
      }
      
      // Get guild data
      const guildData = await GuildModel.findOne({ guildId: guild.id });
      
      // Check if advertisement exists
      const ad = await AdModel.findOne({ guildId: guild.id });
      if (!ad) {
        return interaction.editReply({
          embeds: [errorEmbed('No Advertisement', 'Your server does not have an advertisement yet. Use `/ad create` to make one.')]
        });
      }
      
      // Check for active bump and cooldown
      const activeBump = await BumpModel.findOne({ 
        guildId: guild.id,
        active: true
      });
      
      const bumpCooldown = parseInt(process.env.BUMP_COOLDOWN) || 14400000; // 4 hours default
      
      if (activeBump) {
        const timeLeft = activeBump.expiresAt - Date.now();
        
        if (timeLeft > 0) {
          return interaction.editReply({
            embeds: [errorEmbed(
              'Bump on Cooldown', 
              `Your server can be bumped again in ${ms(timeLeft, { long: true })}.`
            )]
          });
        }
        
        // Deactivate old bump if expired
        activeBump.active = false;
        await activeBump.save();
      }
      
      // Create new bump
      const expiresAt = Date.now() + bumpCooldown;
      
      const newBump = new BumpModel({
        guildId: guild.id,
        userId: user.id,
        advertisementId: ad._id,
        active: true,
        bumpedAt: Date.now(),
        expiresAt
      });
      
      await newBump.save();
      
      // Update guild stats
      await GuildModel.findOneAndUpdate(
        { guildId: guild.id },
        { $inc: { bumpCount: 1 } }
      );
      
      // Get bump channel
      const bumpChannel = await guild.channels.fetch(guildData.bumpChannelId);
      
      if (bumpChannel) {
        const bumpMessage = await bumpChannel.send({
          embeds: [bumpEmbed(ad, guild, user)]
        });
        
        // Save the message ID
        newBump.messageId = bumpMessage.id;
        await newBump.save();
      }
      
      return interaction.editReply({
        embeds: [
          successEmbed(
            'Server Bumped', 
            `Your server has been bumped successfully! You can bump again in ${ms(bumpCooldown, { long: true })}.`
          )
        ]
      });
    } catch (error) {
      console.error('Bump error:', error);
      return interaction.editReply({
        embeds: [errorEmbed('Bump Failed', 'There was an error bumping your server. Please try again.')]
      });
    }
  },
};