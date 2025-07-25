const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('봇의 응답 시간을 확인합니다'),
  
  async execute(interaction) {
    const sent = await interaction.reply({ 
      content: '🏓 핑 측정 중...', 
      fetchReply: true 
    });
    
    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const websocketHeartbeat = Math.round(interaction.client.ws.ping);
    
    await interaction.editReply({
      content: `🏓 퐁!\n` +
               `📡 **응답 시간**: ${roundtripLatency}ms\n` +
               `💓 **WebSocket 핑**: ${websocketHeartbeat}ms`
    });
  },
}; 