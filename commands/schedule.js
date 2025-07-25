const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { models } = require('../database');
const aiService = require('../services/aiService');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('일정을 관리합니다')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('새로운 일정을 추가합니다')
        .addStringOption(option =>
          option.setName('content')
            .setDescription('일정 내용 (자연어로 입력하세요)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('category')
            .setDescription('일정 카테고리')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('일정 목록을 보여줍니다')
        .addStringOption(option =>
          option.setName('period')
            .setDescription('조회할 기간')
            .addChoices(
              { name: '오늘', value: 'today' },
              { name: '이번 주', value: 'week' },
              { name: '이번 달', value: 'month' },
              { name: '전체', value: 'all' }
            ))
        .addStringOption(option =>
          option.setName('status')
            .setDescription('일정 상태 필터')
            .addChoices(
              { name: '예정됨', value: 'planned' },
              { name: '진행중', value: 'in_progress' },
              { name: '완료됨', value: 'completed' },
              { name: '취소됨', value: 'cancelled' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('일정을 수정합니다')
        .addStringOption(option =>
          option.setName('schedule_id')
            .setDescription('수정할 일정의 ID')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('edit_content')
            .setDescription('수정할 내용 (자연어로 입력)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('일정을 삭제합니다')
        .addStringOption(option =>
          option.setName('schedule_id')
            .setDescription('삭제할 일정의 ID')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    // 사용자 확인/생성
    const user = await this.getOrCreateUser(interaction.user);
    
    switch (subcommand) {
      case 'add':
        await this.addSchedule(interaction, user);
        break;
      case 'list':
        await this.listSchedules(interaction, user);
        break;
      case 'edit':
        await this.editSchedule(interaction, user);
        break;
      case 'delete':
        await this.deleteSchedule(interaction, user);
        break;
    }
  },

  async getOrCreateUser(discordUser) {
    const [user] = await models.User.findOrCreate({
      where: { discordId: discordUser.id },
      defaults: {
        username: discordUser.username,
        displayName: discordUser.displayName || discordUser.globalName || discordUser.username,
        avatar: discordUser.displayAvatarURL()
      }
    });

    // 사용자 정보 업데이트
    if (user.username !== discordUser.username) {
      await user.update({
        username: discordUser.username,
        displayName: discordUser.displayName || discordUser.globalName || discordUser.username,
        avatar: discordUser.displayAvatarURL(),
        lastActivity: new Date()
      });
    }

    return user;
  },

  async addSchedule(interaction, user) {
    const content = interaction.options.getString('content');
    const categoryName = interaction.options.getString('category');
    
    await interaction.deferReply();

    try {
      // AI로 일정 정보 파싱
      console.log('🤖 AI로 일정 파싱 중:', content);
      const aiResult = await aiService.parseScheduleFromText(content);
      
      if (!aiResult.success) {
        await interaction.editReply({
          content: `❌ 일정 정보를 파싱할 수 없습니다: ${aiResult.error}\n\n` +
                   `💡 예시: "내일 오후 3시에 팀 회의", "다음주 월요일 종일 워크샵"`
        });
        return;
      }

      const scheduleData = aiResult.data;
      
      // 신뢰도 체크
      if (scheduleData.confidence < 0.5) {
        const embed = new EmbedBuilder()
          .setColor('#f39c12')
          .setTitle('⚠️ 일정 정보 확인 필요')
          .setDescription(`AI가 파싱한 정보의 신뢰도가 낮습니다 (${Math.round(scheduleData.confidence * 100)}%)`)
          .addFields(
            { name: '원본 텍스트', value: content, inline: false },
            { name: '파싱된 제목', value: scheduleData.title || '없음', inline: true },
            { name: '시작 시간', value: scheduleData.startDate || '없음', inline: true },
            { name: '종료 시간', value: scheduleData.endDate || '없음', inline: true }
          )
          .setFooter({ text: '정확한 정보로 다시 입력해주세요' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 카테고리 처리
      let category = null;
      if (categoryName) {
        [category] = await models.Category.findOrCreate({
          where: { 
            userId: user.id, 
            name: categoryName 
          },
          defaults: {
            description: `${categoryName} 관련 일정들`
          }
        });
      }

      // 일정 생성
      const schedule = await models.Schedule.create({
        userId: user.id,
        categoryId: category?.id || null,
        title: scheduleData.title,
        description: scheduleData.description,
        startDate: scheduleData.startDate ? new Date(scheduleData.startDate) : null,
        endDate: scheduleData.endDate ? new Date(scheduleData.endDate) : null,
        isAllDay: scheduleData.isAllDay || false,
        location: scheduleData.location,
        priority: scheduleData.priority || 'normal',
        aiExtracted: true,
        extractionData: {
          originalText: content,
          confidence: scheduleData.confidence,
          rawResponse: aiResult.rawResponse
        }
      });

      // 성공 응답
      const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('✅ 일정이 추가되었습니다!')
        .addFields(
          { name: '📋 제목', value: schedule.title, inline: false },
          { name: '📅 시작', value: schedule.startDate ? schedule.startDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미정', inline: true },
          { name: '⏰ 종료', value: schedule.endDate ? schedule.endDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미정', inline: true },
          { name: '📍 장소', value: schedule.location || '없음', inline: true },
          { name: '🔥 우선순위', value: this.getPriorityEmoji(schedule.priority), inline: true },
          { name: '📁 카테고리', value: category?.name || '없음', inline: true },
          { name: '🤖 AI 신뢰도', value: `${Math.round(scheduleData.confidence * 100)}%`, inline: true }
        )
        .setFooter({ text: `일정 ID: ${schedule.id.substr(0, 8)}...` })
        .setTimestamp();

      // 알림 설정 버튼
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`schedule_reminder_${schedule.id}`)
            .setLabel('알림 설정')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔔'),
          new ButtonBuilder()
            .setCustomId(`schedule_edit_${schedule.id}`)
            .setLabel('수정')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️')
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('일정 추가 오류:', error);
      await interaction.editReply({
        content: '❌ 일정 추가 중 오류가 발생했습니다. 다시 시도해주세요.'
      });
    }
  },

  async listSchedules(interaction, user) {
    const period = interaction.options.getString('period') || 'week';
    const status = interaction.options.getString('status');
    
    await interaction.deferReply();

    try {
      // 날짜 범위 계산
      const now = new Date();
      const dateFilter = this.getDateFilter(period, now);
      
      // 쿼리 조건 설정
      const whereCondition = {
        userId: user.id,
        ...dateFilter
      };
      
      if (status) {
        whereCondition.status = status;
      }

      // 일정 조회
      const schedules = await models.Schedule.findAll({
        where: whereCondition,
        include: [
          {
            model: models.Category,
            as: 'category',
            required: false
          }
        ],
        order: [['startDate', 'ASC']]
      });

      if (schedules.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('📅 일정이 없습니다')
          .setDescription(`${this.getPeriodText(period)}에 일정이 없습니다.`)
          .setFooter({ text: '/schedule add 명령어로 일정을 추가해보세요!' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 페이지네이션을 위한 설정
      const itemsPerPage = 5;
      const totalPages = Math.ceil(schedules.length / itemsPerPage);
      const currentPage = 1;
      
      const embed = this.createScheduleListEmbed(schedules.slice(0, itemsPerPage), currentPage, totalPages, period);
      
      // 페이지네이션 버튼
      const row = new ActionRowBuilder();
      if (totalPages > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('schedule_list_prev')
            .setLabel('이전')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
            .setDisabled(currentPage === 1),
          new ButtonBuilder()
            .setCustomId('schedule_list_next')
            .setLabel('다음')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️')
            .setDisabled(currentPage === totalPages)
        );
      }
      
      const components = row.components.length > 0 ? [row] : [];
      await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
      console.error('일정 목록 조회 오류:', error);
      await interaction.editReply({
        content: '❌ 일정 목록을 불러오는 중 오류가 발생했습니다.'
      });
    }
  },

  async editSchedule(interaction, user) {
    const scheduleId = interaction.options.getString('schedule_id');
    const editContent = interaction.options.getString('edit_content');
    
    await interaction.deferReply();

    try {
      // 일정 찾기
      const schedule = await models.Schedule.findOne({
        where: { 
          id: { [Op.like]: `${scheduleId}%` },
          userId: user.id 
        }
      });

      if (!schedule) {
        await interaction.editReply({
          content: `❌ 일정을 찾을 수 없습니다. ID를 확인해주세요: ${scheduleId}`
        });
        return;
      }

      // AI로 수정 내용 파싱
      const aiResult = await aiService.parseScheduleFromText(editContent);
      
      if (!aiResult.success) {
        await interaction.editReply({
          content: `❌ 수정 내용을 파싱할 수 없습니다: ${aiResult.error}`
        });
        return;
      }

      const updateData = {};
      const scheduleData = aiResult.data;
      
      // 변경된 항목만 업데이트
      if (scheduleData.title) updateData.title = scheduleData.title;
      if (scheduleData.description) updateData.description = scheduleData.description;
      if (scheduleData.startDate) updateData.startDate = new Date(scheduleData.startDate);
      if (scheduleData.endDate) updateData.endDate = new Date(scheduleData.endDate);
      if (scheduleData.location) updateData.location = scheduleData.location;
      if (scheduleData.priority) updateData.priority = scheduleData.priority;
      if (scheduleData.isAllDay !== undefined) updateData.isAllDay = scheduleData.isAllDay;

      await schedule.update(updateData);

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('✅ 일정이 수정되었습니다!')
        .addFields(
          { name: '📋 제목', value: schedule.title, inline: false },
          { name: '📅 시작', value: schedule.startDate ? schedule.startDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미정', inline: true },
          { name: '⏰ 종료', value: schedule.endDate ? schedule.endDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미정', inline: true },
          { name: '📍 장소', value: schedule.location || '없음', inline: true }
        )
        .setFooter({ text: `일정 ID: ${schedule.id.substr(0, 8)}...` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('일정 수정 오류:', error);
      await interaction.editReply({
        content: '❌ 일정 수정 중 오류가 발생했습니다.'
      });
    }
  },

  async deleteSchedule(interaction, user) {
    const scheduleId = interaction.options.getString('schedule_id');
    
    await interaction.deferReply();

    try {
      const schedule = await models.Schedule.findOne({
        where: { 
          id: { [Op.like]: `${scheduleId}%` },
          userId: user.id 
        }
      });

      if (!schedule) {
        await interaction.editReply({
          content: `❌ 일정을 찾을 수 없습니다. ID를 확인해주세요: ${scheduleId}`
        });
        return;
      }

      await schedule.destroy();

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🗑️ 일정이 삭제되었습니다')
        .addFields(
          { name: '삭제된 일정', value: schedule.title, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('일정 삭제 오류:', error);
      await interaction.editReply({
        content: '❌ 일정 삭제 중 오류가 발생했습니다.'
      });
    }
  },

  // 유틸리티 함수들
  getPriorityEmoji(priority) {
    const emojis = {
      low: '🟢 낮음',
      normal: '🟡 보통',
      high: '🟠 높음',
      urgent: '🔴 긴급'
    };
    return emojis[priority] || '🟡 보통';
  },

  getPeriodText(period) {
    const texts = {
      today: '오늘',
      week: '이번 주',
      month: '이번 달',
      all: '전체 기간'
    };
    return texts[period] || '이번 주';
  },

  getDateFilter(period, now) {
    const filter = {};
    
    switch (period) {
      case 'today':
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        
        filter.startDate = {
          [Op.between]: [startOfToday, endOfToday]
        };
        break;
        
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        filter.startDate = {
          [Op.between]: [startOfWeek, endOfWeek]
        };
        break;
        
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        filter.startDate = {
          [Op.between]: [startOfMonth, endOfMonth]
        };
        break;
        
      case 'all':
      default:
        // 전체 조회 (필터 없음)
        break;
    }
    
    return filter;
  },

  createScheduleListEmbed(schedules, currentPage, totalPages, period) {
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle(`📅 ${this.getPeriodText(period)} 일정 목록`)
      .setDescription(`총 ${schedules.length}개의 일정 (${currentPage}/${totalPages} 페이지)`)
      .setTimestamp();

    schedules.forEach((schedule, index) => {
      const status = this.getStatusEmoji(schedule.status);
      const priority = this.getPriorityEmoji(schedule.priority);
      const startDate = schedule.startDate ? 
        schedule.startDate.toLocaleString('ko-KR', { 
          timeZone: 'Asia/Seoul',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '미정';
      
      embed.addFields({
        name: `${status} ${schedule.title}`,
        value: `📅 ${startDate} | ${priority} | 📁 ${schedule.category?.name || '없음'}\n` +
               `ID: \`${schedule.id.substr(0, 8)}...\``,
        inline: false
      });
    });

    return embed;
  },

  getStatusEmoji(status) {
    const emojis = {
      planned: '📋',
      in_progress: '🔄',
      completed: '✅',
      cancelled: '❌'
    };
    return emojis[status] || '📋';
  }
}; 