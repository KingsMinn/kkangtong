const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { models } = require('../database');
const aiService = require('../services/aiService');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('할일을 관리합니다')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('새로운 할일을 추가합니다')
        .addStringOption(option =>
          option.setName('content')
            .setDescription('할일 내용 (자연어로 입력하세요)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('category')
            .setDescription('할일 카테고리')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('할일 목록을 보여줍니다')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('할일 상태 필터')
            .addChoices(
              { name: '할일', value: 'todo' },
              { name: '진행중', value: 'in_progress' },
              { name: '완료됨', value: 'completed' },
              { name: '취소됨', value: 'cancelled' }
            ))
        .addStringOption(option =>
          option.setName('priority')
            .setDescription('우선순위 필터')
            .addChoices(
              { name: '긴급', value: 'urgent' },
              { name: '높음', value: 'high' },
              { name: '보통', value: 'normal' },
              { name: '낮음', value: 'low' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('complete')
        .setDescription('할일을 완료 처리합니다')
        .addStringOption(option =>
          option.setName('task_id')
            .setDescription('완료할 할일의 ID')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('할일을 수정합니다')  
        .addStringOption(option =>
          option.setName('task_id')
            .setDescription('수정할 할일의 ID')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('edit_content')
            .setDescription('수정할 내용 (자연어로 입력)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('할일을 삭제합니다')
        .addStringOption(option =>
          option.setName('task_id')
            .setDescription('삭제할 할일의 ID')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('progress')
        .setDescription('할일 진행률을 설정합니다')
        .addStringOption(option =>
          option.setName('task_id')
            .setDescription('진행률을 설정할 할일의 ID')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('progress')
            .setDescription('진행률 (0-100%)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    // 사용자 확인/생성
    const user = await this.getOrCreateUser(interaction.user);
    
    switch (subcommand) {
      case 'add':
        await this.addTask(interaction, user);
        break;
      case 'list':
        await this.listTasks(interaction, user);
        break;
      case 'complete':
        await this.completeTask(interaction, user);
        break;
      case 'edit':
        await this.editTask(interaction, user);
        break;
      case 'delete':
        await this.deleteTask(interaction, user);
        break;
      case 'progress':
        await this.updateProgress(interaction, user);
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

  async addTask(interaction, user) {
    const content = interaction.options.getString('content');
    const categoryName = interaction.options.getString('category');
    
    await interaction.deferReply();

    try {
      // AI로 할일 정보 파싱
      console.log('🤖 AI로 할일 파싱 중:', content);
      const aiResult = await aiService.parseTaskFromText(content);
      
      if (!aiResult.success) {
        await interaction.editReply({
          content: `❌ 할일 정보를 파싱할 수 없습니다: ${aiResult.error}\n\n` +
                   `💡 예시: "내일까지 보고서 작성하기", "긴급히 회의 자료 준비 - 2시간 소요"`
        });
        return;
      }

      const taskData = aiResult.data;
      
      // 신뢰도 체크
      if (taskData.confidence < 0.5) {
        const embed = new EmbedBuilder()
          .setColor('#f39c12')
          .setTitle('⚠️ 할일 정보 확인 필요')
          .setDescription(`AI가 파싱한 정보의 신뢰도가 낮습니다 (${Math.round(taskData.confidence * 100)}%)`)
          .addFields(
            { name: '원본 텍스트', value: content, inline: false },
            { name: '파싱된 제목', value: taskData.title || '없음', inline: true },
            { name: '마감일', value: taskData.dueDate || '없음', inline: true },
            { name: '우선순위', value: taskData.priority || '보통', inline: true }
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
            description: `${categoryName} 관련 할일들`
          }
        });
      }

      // 하위 작업 처리
      const subtasks = taskData.subtasks || [];
      const subtaskObjects = subtasks.map(subtask => ({
        title: subtask,
        completed: false,
        createdAt: new Date()
      }));

      // 할일 생성
      const task = await models.Task.create({
        userId: user.id,
        categoryId: category?.id || null,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'normal',
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        estimatedDuration: taskData.estimatedDuration,
        tags: taskData.tags || [],
        subtasks: subtaskObjects,
        aiExtracted: true,
        extractionData: {
          originalText: content,
          confidence: taskData.confidence,
          rawResponse: aiResult.rawResponse
        }
      });

      // 성공 응답
      const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('✅ 할일이 추가되었습니다!')
        .addFields(
          { name: '📋 제목', value: task.title, inline: false },
          { name: '📅 마감일', value: task.dueDate ? task.dueDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '없음', inline: true },
          { name: '🔥 우선순위', value: this.getPriorityEmoji(task.priority), inline: true },
          { name: '⏱️ 예상 소요시간', value: task.estimatedDuration ? `${task.estimatedDuration}분` : '미정', inline: true },
          { name: '📁 카테고리', value: category?.name || '없음', inline: true },
          { name: '🏷️ 태그', value: task.tags.length > 0 ? task.tags.join(', ') : '없음', inline: true },
          { name: '🤖 AI 신뢰도', value: `${Math.round(taskData.confidence * 100)}%`, inline: true }
        )
        .setFooter({ text: `할일 ID: ${task.id.substr(0, 8)}...` })
        .setTimestamp();

      // 하위 작업이 있으면 추가 표시
      if (subtasks.length > 0) {
        embed.addFields({
          name: '📝 하위 작업',
          value: subtasks.map((subtask, index) => `${index + 1}. ${subtask}`).join('\n'),
          inline: false
        });
      }

      // 액션 버튼
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`task_start_${task.id}`)
            .setLabel('시작하기')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️'),
          new ButtonBuilder()
            .setCustomId(`task_reminder_${task.id}`)
            .setLabel('알림 설정')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔔'),
          new ButtonBuilder()
            .setCustomId(`task_edit_${task.id}`)
            .setLabel('수정')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️')
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('할일 추가 오류:', error);
      await interaction.editReply({
        content: '❌ 할일 추가 중 오류가 발생했습니다. 다시 시도해주세요.'
      });
    }
  },

  async listTasks(interaction, user) {
    const status = interaction.options.getString('status');
    const priority = interaction.options.getString('priority');
    
    await interaction.deferReply();

    try {
      // 쿼리 조건 설정
      const whereCondition = { userId: user.id };
      
      if (status) {
        whereCondition.status = status;
      }
      
      if (priority) {
        whereCondition.priority = priority;
      }

      // 할일 조회
      const tasks = await models.Task.findAll({
        where: whereCondition,
        include: [
          {
            model: models.Category,
            as: 'category',
            required: false
          }
        ],
        order: [
          ['priority', 'DESC'], // 우선순위 높은 순
          ['dueDate', 'ASC'],   // 마감일 빠른 순
          ['createdAt', 'DESC'] // 최근 생성 순
        ]
      });

      if (tasks.length === 0) {
        const statusText = status ? this.getStatusText(status) : '모든';
        const priorityText = priority ? this.getPriorityText(priority) : '';
        
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('✅ 할일이 없습니다')
          .setDescription(`${statusText} ${priorityText} 할일이 없습니다.`)
          .setFooter({ text: '/task add 명령어로 할일을 추가해보세요!' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 통계 계산
      const stats = this.calculateTaskStats(tasks);
      
      // 페이지네이션을 위한 설정
      const itemsPerPage = 5;
      const totalPages = Math.ceil(tasks.length / itemsPerPage);
      const currentPage = 1;
      
      const embed = this.createTaskListEmbed(
        tasks.slice(0, itemsPerPage), 
        currentPage, 
        totalPages, 
        stats,
        status,
        priority
      );
      
      // 페이지네이션 버튼
      const row = new ActionRowBuilder();
      if (totalPages > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('task_list_prev')
            .setLabel('이전')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
            .setDisabled(currentPage === 1),
          new ButtonBuilder()
            .setCustomId('task_list_next')
            .setLabel('다음')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️')
            .setDisabled(currentPage === totalPages)
        );
      }
      
      const components = row.components.length > 0 ? [row] : [];
      await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
      console.error('할일 목록 조회 오류:', error);
      await interaction.editReply({
        content: '❌ 할일 목록을 불러오는 중 오류가 발생했습니다.'
      });
    }
  },

  async completeTask(interaction, user) {
    const taskId = interaction.options.getString('task_id');
    
    await interaction.deferReply();

    try {
      const task = await models.Task.findOne({
        where: { 
          id: { [Op.like]: `${taskId}%` },
          userId: user.id 
        }
      });

      if (!task) {
        await interaction.editReply({
          content: `❌ 할일을 찾을 수 없습니다. ID를 확인해주세요: ${taskId}`
        });
        return;
      }

      if (task.status === 'completed') {
        await interaction.editReply({
          content: `✅ 이미 완료된 할일입니다: ${task.title}`
        });
        return;
      }

      // 실제 소요 시간 계산 (시작 시간이 기록되어 있다면)
      let actualDuration = null;
      if (task.status === 'in_progress' && task.updatedAt) {
        const startTime = new Date(task.updatedAt);
        const endTime = new Date();
        actualDuration = Math.round((endTime - startTime) / (1000 * 60)); // 분 단위
      }

      await task.update({
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        actualDuration: actualDuration || task.actualDuration
      });

      // 완료 축하 메시지
      const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('🎉 할일을 완료했습니다!')
        .addFields(
          { name: '📋 completed 제목', value: task.title, inline: false },
          { name: '⏱️ 예상 시간', value: task.estimatedDuration ? `${task.estimatedDuration}분` : '미정', inline: true },
          { name: '⏰ 실제 시간', value: actualDuration ? `${actualDuration}분` : '미기록', inline: true },
          { name: '📅 완료 시간', value: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), inline: true }
        )
        .setTimestamp();

      // 시간 효율성 피드백
      if (task.estimatedDuration && actualDuration) {
        const efficiency = (task.estimatedDuration / actualDuration) * 100;
        const efficiencyText = efficiency > 100 ? 
          `🚀 예상보다 ${Math.round(efficiency - 100)}% 빠르게 완료!` :
          efficiency < 80 ? 
          `🐌 예상보다 ${Math.round(100 - efficiency)}% 더 소요됨` :
          `👍 예상 시간과 비슷하게 완료!`;
        
        embed.addFields({
          name: '📊 시간 효율성',
          value: efficiencyText,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('할일 완료 처리 오류:', error);
      await interaction.editReply({
        content: '❌ 할일 완료 처리 중 오류가 발생했습니다.'
      });
    }
  },

  async editTask(interaction, user) {
    const taskId = interaction.options.getString('task_id');
    const editContent = interaction.options.getString('edit_content');
    
    await interaction.deferReply();

    try {
      const task = await models.Task.findOne({
        where: { 
          id: { [Op.like]: `${taskId}%` },
          userId: user.id 
        }
      });

      if (!task) {
        await interaction.editReply({
          content: `❌ 할일을 찾을 수 없습니다. ID를 확인해주세요: ${taskId}`
        });
        return;
      }

      // AI로 수정 내용 파싱
      const aiResult = await aiService.parseTaskFromText(editContent);
      
      if (!aiResult.success) {
        await interaction.editReply({
          content: `❌ 수정 내용을 파싱할 수 없습니다: ${aiResult.error}`
        });
        return;
      }

      const updateData = {};
      const taskData = aiResult.data;
      
      // 변경된 항목만 업데이트
      if (taskData.title) updateData.title = taskData.title;
      if (taskData.description) updateData.description = taskData.description;
      if (taskData.dueDate) updateData.dueDate = new Date(taskData.dueDate);
      if (taskData.priority) updateData.priority = taskData.priority;
      if (taskData.estimatedDuration) updateData.estimatedDuration = taskData.estimatedDuration;
      if (taskData.tags) updateData.tags = taskData.tags;

      await task.update(updateData);

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('✅ 할일이 수정되었습니다!')
        .addFields(
          { name: '📋 제목', value: task.title, inline: false },
          { name: '📅 마감일', value: task.dueDate ? task.dueDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '없음', inline: true },
          { name: '🔥 우선순위', value: this.getPriorityEmoji(task.priority), inline: true },
          { name: '⏱️ 예상시간', value: task.estimatedDuration ? `${task.estimatedDuration}분` : '미정', inline: true }
        )
        .setFooter({ text: `할일 ID: ${task.id.substr(0, 8)}...` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('할일 수정 오류:', error);
      await interaction.editReply({
        content: '❌ 할일 수정 중 오류가 발생했습니다.'
      });
    }
  },

  async deleteTask(interaction, user) {
    const taskId = interaction.options.getString('task_id');
    
    await interaction.deferReply();

    try {
      const task = await models.Task.findOne({
        where: { 
          id: { [Op.like]: `${taskId}%` },
          userId: user.id 
        }
      });

      if (!task) {
        await interaction.editReply({
          content: `❌ 할일을 찾을 수 없습니다. ID를 확인해주세요: ${taskId}`
        });
        return;
      }

      await task.destroy();

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🗑️ 할일이 삭제되었습니다')
        .addFields(
          { name: '삭제된 할일', value: task.title, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('할일 삭제 오류:', error);
      await interaction.editReply({
        content: '❌ 할일 삭제 중 오류가 발생했습니다.'
      });
    }
  },

  async updateProgress(interaction, user) {
    const taskId = interaction.options.getString('task_id');
    const progress = interaction.options.getInteger('progress');
    
    await interaction.deferReply();

    try {
      const task = await models.Task.findOne({
        where: { 
          id: { [Op.like]: `${taskId}%` },
          userId: user.id 
        }
      });

      if (!task) {
        await interaction.editReply({
          content: `❌ 할일을 찾을 수 없습니다. ID를 확인해주세요: ${taskId}`
        });
        return;
      }

      // 상태 자동 업데이트
      let newStatus = task.status;
      if (progress === 0) {
        newStatus = 'todo';
      } else if (progress === 100) {
        newStatus = 'completed';
      } else if (progress > 0 && task.status === 'todo') {
        newStatus = 'in_progress';
      }

      await task.update({
        progress,
        status: newStatus,
        completedAt: progress === 100 ? new Date() : null
      });

      const progressBar = this.createProgressBar(progress);
      
      const embed = new EmbedBuilder()
        .setColor(progress === 100 ? '#27ae60' : '#3498db')
        .setTitle(`${progress === 100 ? '🎉' : '📊'} 진행률이 업데이트되었습니다!`)
        .addFields(
          { name: '📋 할일', value: task.title, inline: false },
          { name: '📊 진행률', value: `${progressBar} ${progress}%`, inline: false },
          { name: '📋 상태', value: this.getStatusEmoji(newStatus) + ' ' + this.getStatusText(newStatus), inline: true }
        )
        .setFooter({ text: `할일 ID: ${task.id.substr(0, 8)}...` })
        .setTimestamp();

      if (progress === 100) {
        embed.addFields({
          name: '🎉 축하합니다!',
          value: '할일을 완료했습니다!',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('진행률 업데이트 오류:', error);
      await interaction.editReply({
        content: '❌ 진행률 업데이트 중 오류가 발생했습니다.'
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

  getPriorityText(priority) {
    const texts = {
      low: '낮음',
      normal: '보통', 
      high: '높음',
      urgent: '긴급'
    };
    return texts[priority] || '보통';
  },

  getStatusEmoji(status) {
    const emojis = {
      todo: '📋',
      in_progress: '🔄',
      completed: '✅',
      cancelled: '❌'
    };
    return emojis[status] || '📋';
  },

  getStatusText(status) {
    const texts = {
      todo: '할일',
      in_progress: '진행중',
      completed: '완료됨',
      cancelled: '취소됨'
    };
    return texts[status] || '할일';
  },

  calculateTaskStats(tasks) {
    const stats = {
      total: tasks.length,
      todo: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      urgent: 0,
      overdue: 0
    };

    const now = new Date();
    
    tasks.forEach(task => {
      stats[task.status]++;
      
      if (task.priority === 'urgent') {
        stats.urgent++;
      }
      
      if (task.dueDate && task.dueDate < now && task.status !== 'completed') {
        stats.overdue++;
      }
    });

    return stats;
  },

  createTaskListEmbed(tasks, currentPage, totalPages, stats, statusFilter, priorityFilter) {
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('✅ 할일 목록')
      .setDescription(
        `총 ${stats.total}개의 할일 (${currentPage}/${totalPages} 페이지)\n` +
        `📊 **통계**: 📋 ${stats.todo} | 🔄 ${stats.in_progress} | ✅ ${stats.completed} | ❌ ${stats.cancelled}\n` +
        `🔴 **긴급**: ${stats.urgent}개 | ⚠️ **지연**: ${stats.overdue}개`
      )
      .setTimestamp();

    // 필터 정보 표시
    const filters = [];
    if (statusFilter) filters.push(`상태: ${this.getStatusText(statusFilter)}`);
    if (priorityFilter) filters.push(`우선순위: ${this.getPriorityText(priorityFilter)}`);
    
    if (filters.length > 0) {
      embed.addFields({
        name: '🔍 적용된 필터',
        value: filters.join(' | '),
        inline: false
      });
    }

    tasks.forEach((task, index) => {
      const status = this.getStatusEmoji(task.status);
      const priority = this.getPriorityEmoji(task.priority);
      const dueDate = task.dueDate ? 
        task.dueDate.toLocaleString('ko-KR', { 
          timeZone: 'Asia/Seoul',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '마감일 없음';
      
      const progressBar = this.createProgressBar(task.progress);
      const isOverdue = task.dueDate && task.dueDate < new Date() && task.status !== 'completed';
      
      embed.addFields({
        name: `${status} ${task.title} ${isOverdue ? '⚠️' : ''}`,
        value: `📅 ${dueDate} | ${priority} | 📁 ${task.category?.name || '없음'}\n` +
               `📊 ${progressBar} ${task.progress}% | ID: \`${task.id.substr(0, 8)}...\``,
        inline: false
      });
    });

    return embed;
  },

  createProgressBar(progress) {
    const totalBars = 10;
    const filledBars = Math.round((progress / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  }
}; 