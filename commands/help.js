const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('봇 사용법을 안내합니다')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('특정 카테고리의 도움말을 확인합니다')
        .addChoices(
          { name: '일정 관리', value: 'schedule' },
          { name: '할일 관리', value: 'task' },
          { name: '메모 관리', value: 'memo' },
          { name: '검색 기능', value: 'search' },
          { name: '설정', value: 'settings' }
        )),
  
  async execute(interaction) {
    const category = interaction.options.getString('category');
    
    if (!category) {
      // 전체 도움말
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🤖 Discord Secretary Bot 도움말')
        .setDescription('AI 기반 개인 비서 봇입니다. 일정, 할일, 메모를 스마트하게 관리해드립니다!')
        .addFields(
          {
            name: '📅 일정 관리',
            value: '`/schedule` - 일정 추가, 조회, 수정, 삭제\n`/schedule add` - 새 일정 추가\n`/schedule list` - 일정 목록 보기',
            inline: true
          },
          {
            name: '✅ 할일 관리', 
            value: '`/task` - 할일 추가, 조회, 수정, 완료\n`/task add` - 새 할일 추가\n`/task list` - 할일 목록 보기',
            inline: true
          },
          {
            name: '📝 메모 관리',
            value: '`/memo` - 메모 추가, 조회, 수정, 삭제\n`/memo add` - 새 메모 추가\n`/memo search` - 메모 검색',
            inline: true
          },
          {
            name: '🔍 검색 기능',
            value: '`/search` - 전체 데이터에서 검색\n키워드, 날짜, 카테고리별 검색 지원',
            inline: true
          },
          {
            name: '⚙️ 기타 기능',
            value: '`/settings` - 개인 설정 관리\n`/ping` - 봇 응답 시간 확인\n`/help` - 도움말 보기',
            inline: true
          },
          {
            name: '🤖 AI 기능',
            value: '• 자연어로 일정/할일 추가 가능\n• 이미지에서 텍스트 추출 (OCR)\n• 스마트 알림 및 추천',
            inline: false
          }
        )
        .setFooter({ 
          text: '/help [카테고리]로 상세 도움말을 확인하세요',
          iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();
        
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // 카테고리별 상세 도움말
    const categoryEmbeds = {
      schedule: new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('📅 일정 관리 도움말')
        .addFields(
          { name: '/schedule add', value: '새로운 일정을 추가합니다', inline: false },
          { name: '/schedule list', value: '일정 목록을 보여줍니다', inline: false },
          { name: '/schedule edit', value: '기존 일정을 수정합니다', inline: false },
          { name: '/schedule delete', value: '일정을 삭제합니다', inline: false },
          { name: '💡 팁', value: '자연어로 "내일 오후 3시에 회의"라고 말하면 AI가 자동으로 파싱합니다!', inline: false }
        ),
      
      task: new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('✅ 할일 관리 도움말')
        .addFields(
          { name: '/task add', value: '새로운 할일을 추가합니다', inline: false },
          { name: '/task list', value: '할일 목록을 보여줍니다', inline: false },
          { name: '/task complete', value: '할일을 완료 처리합니다', inline: false },
          { name: '/task edit', value: '할일을 수정합니다', inline: false },
          { name: '💡 팁', value: '우선순위와 마감일을 설정하면 스마트 알림을 받을 수 있습니다!', inline: false }
        ),
      
      memo: new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('📝 메모 관리 도움말')
        .addFields(
          { name: '/memo add', value: '새로운 메모를 추가합니다', inline: false },
          { name: '/memo list', value: '메모 목록을 보여줍니다', inline: false },
          { name: '/memo search', value: '메모에서 키워드를 검색합니다', inline: false },
          { name: '/memo pin', value: '중요한 메모를 고정합니다', inline: false },
          { name: '💡 팁', value: '이미지를 첨부하면 AI가 자동으로 텍스트를 추출하여 메모로 저장합니다!', inline: false }
        ),
      
      search: new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🔍 검색 기능 도움말')
        .addFields(
          { name: '/search', value: '모든 데이터에서 키워드를 검색합니다', inline: false },
          { name: '검색 옵션', value: '• 키워드: 제목, 내용에서 검색\n• 날짜: 특정 기간 설정\n• 카테고리: 분류별 검색\n• 타입: 일정/할일/메모 구분', inline: false },
          { name: '💡 팁', value: 'AI가 의미적 검색을 지원하여 정확한 키워드가 아니어도 관련 내용을 찾아줍니다!', inline: false }
        ),
      
      settings: new EmbedBuilder()
        .setColor('#34495e')
        .setTitle('⚙️ 설정 도움말')
        .addFields(
          { name: '/settings view', value: '현재 설정을 확인합니다', inline: false },
          { name: '/settings notifications', value: '알림 설정을 변경합니다', inline: false },
          { name: '/settings timezone', value: '시간대를 설정합니다', inline: false },
          { name: '/settings reminders', value: '기본 알림 시간을 설정합니다', inline: false },
          { name: '💡 팁', value: '능동적 알림을 켜두면 봇이 적절한 시점에 할일을 권유해드립니다!', inline: false }
        )
    };
    
    await interaction.reply({ embeds: [categoryEmbeds[category]] });
  },
}; 