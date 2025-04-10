const { SlashCommandBuilder } = require('discord.js');
const { helpEmbed } = require('../utils/embeds');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information'),
    
  async execute(interaction, client) {
    const commandsCollection = client.commands;
    
    // Create an array of command data for the help embed
    const commands = [];
    
    commandsCollection.forEach(cmd => {
      // Basic command info
      const commandInfo = {
        name: cmd.data.name,
        description: cmd.data.description
      };
      
      // Add subcommands if they exist
      if (cmd.data.options && cmd.data.options.some(opt => opt.type === 1)) {
        commandInfo.subcommands = cmd.data.options
          .filter(opt => opt.type === 1)
          .map(sub => ({
            name: `${cmd.data.name} ${sub.name}`,
            description: sub.description
          }));
      }
      
      commands.push(commandInfo);
    });
    
    // Flatten subcommands into the main commands array
    const flattenedCommands = commands.reduce((acc, cmd) => {
      if (cmd.subcommands) {
        // Add each subcommand as a separate entry
        cmd.subcommands.forEach(sub => {
          acc.push({
            name: sub.name,
            description: sub.description
          });
        });
        
        // Keep the main command if it's not just a container for subcommands
        if (cmd.name !== 'ad' && cmd.name !== 'partnership') {
          acc.push({
            name: cmd.name,
            description: cmd.description
          });
        }
      } else {
        // Add regular commands
        acc.push({
          name: cmd.name,
          description: cmd.description
        });
      }
      return acc;
    }, []);
    
    await interaction.reply({
      embeds: [helpEmbed(flattenedCommands)],
      ephemeral: true
    });
  },
};