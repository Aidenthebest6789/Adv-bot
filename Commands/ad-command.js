const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildModel = require('../models/guildModel');
const AdModel = require('../models/adModel');
const { isGuildSetup, canManagePartnerships, validateInviteLink } = require('../utils/validation');
const { successEmbed, errorEmbed, adEmbed } = require('../utils/embeds');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ad')
    .setDescription('Manage server advertisements')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a server advertisement')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Title of your advertisement')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description of your server')
            .setRequired(true)
            .setMaxLength(1500)
        )
        .addStringOption(option =>
          option
            .setName('invite')
            .setDescription('Discord invite link')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('Hex color code for the embed (e.g., #5865F2)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('image')
            .setDescription('Image URL to display in the advertisement')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('tags')
            .setDescription('Tags for your server (comma-separated, max 5)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit your server advertisement')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('New title of your advertisement')
            .setRequired(false)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('New description of your server')
            .setRequired(false)
            .setMaxLength(1500)
        )
        .addStringOption(option =>
          option
            .setName('invite')
            .setDescription('New Discord invite link')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('New hex color code for the embed (e.g., #5865F2)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('image')
            .setDescription('New image URL to display in the advertisement')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('tags')
            .setDescription('New tags for your server (comma-separated, max 5)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Display your server advertisement')
    ),
    
  async execute(interaction) {
    const { guild, user } = interaction;
    const subcommand = interaction.options.getSubcommand();
    
    // Check if the guild is set up
    const isSetup = await isGuildSetup(guild.id);
    if (!isSetup) {
      return interaction.reply({
        embeds: [errorEmbed('Setup Required', 'Please set up the bot first using the `/setup` command.')],
        ephemeral: true
      });
    }
    
    // Check user permissions for create and edit
    if (subcommand === 'create' || subcommand === 'edit') {
      const hasPermission = await canManagePartnerships(interaction.member, guild.id);
      if (!hasPermission) {
        return interaction.reply({
          embeds: [errorEmbed('Permission Denied', 'You do not have permission to manage advertisements.')],
          ephemeral: true
        });
      }
    }
    
    switch (subcommand) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'edit':
        await handleEdit(interaction);
        break;
      case 'show':
        await handleShow(interaction);
        break;
    }
  },
};

async function handleCreate(interaction) {
  await interaction.deferReply();
  const { guild, user } = interaction;
  
  try {
    // Get guild data
    const guildData = await GuildModel.findOne({ guildId: guild.id });
    
    // Check if advertisement already exists
    const existingAd = await AdModel.findOne({ guildId: guild.id });
    if (existingAd) {
      return interaction.editReply({
        embeds: [errorEmbed('Advertisement Exists', 'Your server already has an advertisement. Use `/ad edit` to modify it.')]
      });
    }
    
    // Get options
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const inviteLink = interaction.options.getString('invite');
    const color = interaction.options.getString('color') || '#5865F2';
    const image = interaction.options.getString('image');
    const tagsString = interaction.options.getString('tags');
    
    // Validate invite link
    const inviteResult = await validateInviteLink(interaction.client, inviteLink);
    if (!inviteResult.valid) {
      return interaction.editReply({
        embeds: [errorEmbed('Invalid Invite', inviteResult.message)]
      });
    }
    
    // Parse tags
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).slice(0, 5) : [];
    
    // Create advertisement
    const newAd = new AdModel({
      guildId: guild.id,
      title,
      description,
      color,
      image,
      inviteLink,
      memberCount: guild.memberCount,
      tags
    });
    
    await newAd.save();
    
    // Send the advertisement to the advertisements channel
    const adChannel = await guild.channels.fetch(guildData.advertisementChannelId);
    if (adChannel) {
      await adChannel.send({
        embeds: [adEmbed(newAd, guild)]
      });
    }
    
    return interaction.editReply({
      embeds: [
        successEmbed(
          'Advertisement Created', 
          'Your server advertisement has been created successfully!'
        ),
        adEmbed(newAd, guild)
      ]
    });
  } catch (error) {
    console.error('Create advertisement error:', error);
    return interaction.editReply({
      embeds: [errorEmbed('Creation Failed', 'There was an error creating your advertisement. Please try again.')]
    });
  }
}

async function handleEdit(interaction) {
  await interaction.deferReply();
  const { guild } = interaction;
  
  try {
    // Get guild data
    const guildData = await GuildModel.findOne({ guildId: guild.id });
    
    // Check if advertisement exists
    const existingAd = await AdModel.findOne({ guildId: guild.id });
    if (!existingAd) {
      return interaction.editReply({
        embeds: [errorEmbed('No Advertisement', 'Your server does not have an advertisement yet. Use `/ad create` to make one.')]
      });
    }
    
    // Get options
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const inviteLink = interaction.options.getString('invite');
    const color = interaction.options.getString('color');
    const image = interaction.options.getString('image');
    const tagsString = interaction.options.getString('tags');
    
    // Check if at least one field is provided
    if (!title && !description && !inviteLink && !color && !image && !tagsString) {
      return interaction.editReply({
        embeds: [errorEmbed('No Changes', 'You need to provide at least one field to update.')]
      });
    }
    
    // Update fields
    if (title) existingAd.title = title;
    if (description) existingAd.description = description;
    if (color) existingAd.color = color;
    
    // Handle image (null to remove)
    if (image === '') {
      existingAd.image = null;
    } else if (image) {
      existingAd.image = image;
    }
    
    // Handle tags
    if (tagsString !== null) {
      existingAd.tags = tagsString ? tagsString.split(',').map(tag => tag.trim()).slice(0, 5) : [];
    }
    
    // Handle invite link
    if (inviteLink) {
      const inviteResult = await validateInviteLink(interaction.client, inviteLink);
      if (!inviteResult.valid) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Invite', inviteResult.message)]
        });
      }
      existingAd.inviteLink = inviteLink;
    }
    
    // Update member count
    existingAd.memberCount = guild.memberCount;
    
    await existingAd.save();
    
    return interaction.editReply({
      embeds: [
        successEmbed(
          'Advertisement Updated', 
          'Your server advertisement has been updated successfully!'
        ),
        adEmbed(existingAd, guild)
      ]
    });
  } catch (error) {
    console.error('Edit advertisement error:', error);
    return interaction.editReply({
      embeds: [errorEmbed('Update Failed', 'There was an error updating your advertisement. Please try again.')]
    });
  }
}

async function handleShow(interaction) {
  await interaction.deferReply();
  const { guild } = interaction;
  
  try {
    // Find the advertisement
    const ad = await AdModel.findOne({ guildId: guild.id });
    
    if (!ad) {
      return interaction.editReply({
        embeds: [errorEmbed('No Advertisement', 'Your server does not have an advertisement yet. Use `/ad create` to make one.')]
      });
    }
    
    return interaction.editReply({
      embeds: [adEmbed(ad, guild)]
    });
  } catch (error) {
    console.error('Show advertisement error:', error);
    return interaction.editReply({
      embeds: [errorEmbed('Error', 'There was an error retrieving your advertisement. Please try again.')]
    });
  }
}