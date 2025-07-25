const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { models } = require('../database');
const aiService = require('../services/aiService');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memo')
    .setDescription('메모를 관리합니다')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('새로운 메모를 추가합니다')
        .addStringOption(option =>
          option.setName('content')
            .setDescription('메모 내용')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('title')
            .setDescription('메모 제목 (선택사항)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('category')
            .setDescription('메모 카테고리')
            .setRequired(false))
        .addAttachmentOption(option =>
          option.setName('image')
            .setDescription('분석할 이미지 첨부 (OCR)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('메모 목록을 보여줍니다')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('특정 카테고리의 메모만 보기')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('pinned_only')
            .setDescription('고정된 메모만 보기')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('exclude_archived')
            .setDescription('아카이브된 메모 제외')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('메모에서 검색합니다')
        .addStringOption(option =>
          option.setName('keyword')
            .setDescription('검색할 키워드')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('search_scope')
            .setDescription('검색할 범위')
            .addChoices(
              { name: '제목만', value: 'title' },
              { name: '내용만', value: 'content' },
              { name: '전체', value: 'all' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pin')
        .setDescription('메모를 고정/고정해제합니다')
        .addStringOption(option =>
          option.setName('memo_id')
            .setDescription('고정할 메모의 ID')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('archive')
        .setDescription('메모를 아카이브/복원합니다')
        .addStringOption(option =>
          option.setName('memo_id')
            .setDescription('아카이브할 메모의 ID')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('메모를 수정합니다')
        .addStringOption(option =>
          option.setName('memo_id')
            .setDescription('수정할 메모의 ID')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('new_content')
            .setDescription('새로운 메모 내용')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('메모를 삭제합니다')
        .addStringOption(option =>
          option.setName('memo_id')
            .setDescription('삭제할 메모의 ID')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    // 사용자 확인/생성
    const user = await this.getOrCreateUser(interaction.user);
    
    switch (subcommand) {
      case 'add':
        await this.addMemo(interaction, user);
        break;
      case 'list':
        await this.listMemos(interaction, user);
        break;
      case 'search':
        await this.searchMemos(interaction, user);
        break;
      case 'pin':
        await this.togglePin(interaction, user);
        break;
      case 'archive':
        await this.toggleArchive(interaction, user);
        break;
      case 'edit':
        await this.editMemo(interaction, user);
        break;
      case 'delete':
        await this.deleteMemo(interaction, user);
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

  async addMemo(interaction, user) {
    const content = interaction.options.getString('content');
    const title = interaction.options.getString('title');
    const categoryName = interaction.options.getString('category');
    const imageAttachment = interaction.options.getAttachment('image');
    
    await interaction.deferReply();

    try {
      let finalContent = content;
      let attachments = [];
      let aiExtracted = false;
      let extractionData = null;

      // 이미지가 첨부된 경우 OCR 분석
      if (imageAttachment && imageAttachment.contentType?.startsWith('image/')) {
        console.log('🖼️ 이미지 OCR 분석 중:', imageAttachment.name);
        
        try {
          // 이미지 다운로드
          const response = await fetch(imageAttachment.url);
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          
          // AI로 이미지 분석
          const aiResult = await aiService.analyzeImage(imageBuffer, content);
          
          if (aiResult.success) {
            const imageData = aiResult.data;
            
            // OCR 텍스트를 메모 내용에 추가
            if (imageData.extractedText) {
              finalContent += `\n\n📷 **이미지에서 추출된 텍스트:**\n${imageData.extractedText}`;
            }
            
            // 구조화된 정보가 있으면 추가
            if (imageData.schedules && imageData.schedules.length > 0) {
              finalContent += `\n\n📅 **감지된 일정 정보:**\n`;
              imageData.schedules.forEach(schedule => {
                finalContent += `- ${schedule.title} (${schedule.date} ${schedule.time})\n`;
              });
            }
            
            if (imageData.tasks && imageData.tasks.length > 0) {
              finalContent += `\n\n✅ **감지된 할일 정보:**\n`;
              imageData.tasks.forEach(task => {
                finalContent += `- ${task.title} (${task.priority})\n`;
              });
            }
            
            attachments.push({
              url: imageAttachment.url,
              name: imageAttachment.name,
              size: imageAttachment.size,
              type: 'image',
              ocrResult: imageData
            });
            
            aiExtracted = true;
            extractionData = {
              originalContent: content,
              ocrConfidence: imageData.confidence,
              extractedText: imageData.extractedText,
              rawResponse: aiResult.rawResponse
            };
          }
        } catch (error) {
          console.error('이미지 분석 오류:', error);
          // 분석 실패해도 원본 메모는 저장
          attachments.push({
            url: imageAttachment.url,
            name: imageAttachment.name,
            size: imageAttachment.size,
            type: 'image',
            ocrResult: null
          });
        }
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
            description: `${categoryName} 관련 메모들`
          }
        });
      }

      // 메모 생성
      const memo = await models.Memo.create({
        userId: user.id,
        categoryId: category?.id || null,
        title: title,
        content: finalContent,
        attachments: attachments,
        aiExtracted: aiExtracted,
        extractionData: extractionData,
        sourceInfo: {
          discord: {
            messageId: interaction.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            createdAt: new Date()
          }
        }
      });

      // 성공 응답
      const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('✅ 메모가 추가되었습니다!')
        .addFields(
          { name: '📝 제목', value: memo.title || '제목 없음', inline: false },
          { name: '📄 내용 미리보기', value: memo.content.length > 200 ? 
            memo.content.substring(0, 200) + '...' : memo.content, inline: false },
          { name: '📁 카테고리', value: category?.name || '없음', inline: true },
          { name: '📎 첨부파일', value: attachments.length > 0 ? `${attachments.length}개` : '없음', inline: true }
        )
        .setFooter({ text: `메모 ID: ${memo.id.substr(0, 8)}...` })
        .setTimestamp();

      // 이미지 분석 결과가 있으면 추가 정보 표시
      if (aiExtracted && extractionData) {
        embed.addFields({
          name: '🤖 AI 분석 결과',
          value: `신뢰도: ${Math.round(extractionData.ocrConfidence * 100)}%\n` +
                 `추출된 텍스트: ${extractionData.extractedText?.length || 0}자`,
          inline: true
        });
      }

      // 액션 버튼
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`memo_view_${memo.id}`)
            .setLabel('전체보기')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👁️'),
          new ButtonBuilder()
            .setCustomId(`memo_pin_${memo.id}`)
            .setLabel('고정')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📌'),
          new ButtonBuilder()
            .setCustomId(`memo_edit_${memo.id}`)
            .setLabel('수정')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️')
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('메모 추가 오류:', error);
      await interaction.editReply({
        content: '❌ 메모 추가 중 오류가 발생했습니다. 다시 시도해주세요.'
      });
    }
  },

  async listMemos(interaction, user) {
    const categoryName = interaction.options.getString('category');
    const pinnedOnly = interaction.options.getBoolean('pinned_only') || false;
    const excludeArchived = interaction.options.getBoolean('exclude_archived') || true;
    
    await interaction.deferReply();

    try {
      // 쿼리 조건 설정
      const whereCondition = { userId: user.id };
      
      if (pinnedOnly) {
        whereCondition.isPinned = true;
      }
      
      if (excludeArchived) {
        whereCondition.isArchived = false;
      }

      const includeConditions = [
        {
          model: models.Category,
          as: 'category',
          required: false
        }
      ];

      // 카테고리 필터링
      if (categoryName) {
        includeConditions[0].where = { name: categoryName };
        includeConditions[0].required = true;
      }

      // 메모 조회
      const memos = await models.Memo.findAll({
        where: whereCondition,
        include: includeConditions,
        order: [
          ['isPinned', 'DESC'],    // 고정된 메모 먼저
          ['updatedAt', 'DESC']    // 최근 수정 순
        ]
      });

      if (memos.length === 0) {
        const filterText = this.getFilterText(categoryName, pinnedOnly, excludeArchived);
        
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('📝 메모가 없습니다')
          .setDescription(`${filterText}에 해당하는 메모가 없습니다.`)
          .setFooter({ text: '/memo add 명령어로 메모를 추가해보세요!' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 통계 계산
      const stats = this.calculateMemoStats(memos);
      
      // 페이지네이션을 위한 설정
      const itemsPerPage = 5;
      const totalPages = Math.ceil(memos.length / itemsPerPage);
      const currentPage = 1;
      
      const embed = this.createMemoListEmbed(
        memos.slice(0, itemsPerPage), 
        currentPage, 
        totalPages, 
        stats,
        categoryName,
        pinnedOnly
      );
      
      // 페이지네이션 버튼
      const row = new ActionRowBuilder();
      if (totalPages > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('memo_list_prev')
            .setLabel('이전')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
            .setDisabled(currentPage === 1),
          new ButtonBuilder()
            .setCustomId('memo_list_next')
            .setLabel('다음')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️')
            .setDisabled(currentPage === totalPages)
        );
      }
      
      const components = row.components.length > 0 ? [row] : [];
      await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
      console.error('메모 목록 조회 오류:', error);
      await interaction.editReply({
        content: '❌ 메모 목록을 불러오는 중 오류가 발생했습니다.'
      });
    }
  },

  async searchMemos(interaction, user) {
    const keyword = interaction.options.getString('keyword');
    const searchScope = interaction.options.getString('search_scope') || 'all';
    
    await interaction.deferReply();

    try {
      // AI로 검색 쿼리 향상
      console.log('🔍 AI로 검색 쿼리 향상 중:', keyword);
      const enhancedQuery = await aiService.enhanceSearchQuery(keyword, 'memo');
      
      let searchConditions = [];
      const allKeywords = enhancedQuery.success ? 
        [keyword, ...enhancedQuery.data.expandedKeywords, ...enhancedQuery.data.synonyms] : 
        [keyword];

      // 검색 범위에 따른 조건 설정
      allKeywords.forEach(term => {
        if (searchScope === 'title' || searchScope === 'all') {
          searchConditions.push({ title: { [Op.like]: `%${term}%` } });
        }
        if (searchScope === 'content' || searchScope === 'all') {
          searchConditions.push({ content: { [Op.like]: `%${term}%` } });
        }
      });

      // 메모 검색
      const memos = await models.Memo.findAll({
        where: {
          userId: user.id,
          isArchived: false,
          [Op.or]: searchConditions
        },
        include: [
          {
            model: models.Category,
            as: 'category',
            required: false
          }
        ],
        order: [
          ['isPinned', 'DESC'],
          ['updatedAt', 'DESC']
        ]
      });

      if (memos.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#95a5a6')
          .setTitle('🔍 검색 결과가 없습니다')
          .setDescription(`"${keyword}"에 대한 검색 결과가 없습니다.`)
          .addFields({
            name: '💡 검색 팁',
            value: '• 키워드를 단순화해보세요\n• 전체 검색 범위를 사용해보세요\n• 아카이브된 메모도 확인해보세요',
            inline: false
          });

        // AI 검색 제안이 있으면 추가
        if (enhancedQuery.success && enhancedQuery.data.searchSuggestions.length > 0) {
          embed.addFields({
            name: '🤖 AI 추천 검색어',
            value: enhancedQuery.data.searchSuggestions.join(', '),
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 검색 결과 표시
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🔍 검색 결과')
        .setDescription(`"${keyword}"에 대한 ${memos.length}개의 결과를 찾았습니다.`)
        .setTimestamp();

      // AI 검색 향상 정보 표시
      if (enhancedQuery.success) {
        embed.addFields({
          name: '🤖 확장된 검색어',
          value: `${enhancedQuery.data.expandedKeywords.join(', ')}`,
          inline: false
        });
      }

      // 검색 결과 표시 (최대 8개)
      const displayMemos = memos.slice(0, 8);
      displayMemos.forEach((memo, index) => {
        const preview = this.highlightKeyword(memo.content, keyword);
        const titleDisplay = memo.title || '제목 없음';
        const pinnedIcon = memo.isPinned ? '📌 ' : '';
        
        embed.addFields({
          name: `${pinnedIcon}${titleDisplay}`,
          value: `${preview}\n` +
                 `📁 ${memo.category?.name || '없음'} | 📅 ${memo.updatedAt.toLocaleDateString('ko-KR')} | ID: \`${memo.id.substr(0, 8)}...\``,
          inline: false
        });
      });

      if (memos.length > 8) {
        embed.addFields({
          name: '📊 추가 결과',
          value: `${memos.length - 8}개의 추가 결과가 더 있습니다.`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('메모 검색 오류:', error);
      await interaction.editReply({
        content: '❌ 메모 검색 중 오류가 발생했습니다.'
      });
    }
  },

  async togglePin(interaction, user) {
    const memoId = interaction.options.getString('memo_id');
    
    await interaction.deferReply();

    try {
      const memo = await models.Memo.findOne({
        where: { 
          id: { [Op.like]: `${memoId}%` },
          userId: user.id 
        }
      });

      if (!memo) {
        await interaction.editReply({
          content: `❌ 메모를 찾을 수 없습니다. ID를 확인해주세요: ${memoId}`
        });
        return;
      }

      const newPinStatus = !memo.isPinned;
      await memo.update({ isPinned: newPinStatus });

      const embed = new EmbedBuilder()
        .setColor(newPinStatus ? '#f39c12' : '#95a5a6')
        .setTitle(`${newPinStatus ? '📌' : '📝'} 메모 ${newPinStatus ? '고정' : '고정 해제'}됨`)
        .addFields(
          { name: '제목', value: memo.title || '제목 없음', inline: false },
          { name: '상태', value: newPinStatus ? '📌 고정됨' : '📝 일반', inline: true }
        )
        .setFooter({ text: `메모 ID: ${memo.id.substr(0, 8)}...` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('메모 고정 토글 오류:', error);
      await interaction.editReply({
        content: '❌ 메모 고정 설정 중 오류가 발생했습니다.'
      });
    }
  },

  async toggleArchive(interaction, user) {
    const memoId = interaction.options.getString('memo_id');
    
    await interaction.deferReply();

    try {
      const memo = await models.Memo.findOne({
        where: { 
          id: { [Op.like]: `${memoId}%` },
          userId: user.id 
        }
      });

      if (!memo) {
        await interaction.editReply({
          content: `❌ 메모를 찾을 수 없습니다. ID를 확인해주세요: ${memoId}`
        });
        return;
      }

      const newArchiveStatus = !memo.isArchived;
      await memo.update({ isArchived: newArchiveStatus });

      const embed = new EmbedBuilder()
        .setColor(newArchiveStatus ? '#95a5a6' : '#3498db')
        .setTitle(`${newArchiveStatus ? '📦' : '📝'} 메모 ${newArchiveStatus ? '아카이브' : '복원'}됨`)
        .addFields(
          { name: '제목', value: memo.title || '제목 없음', inline: false },
          { name: '상태', value: newArchiveStatus ? '📦 아카이브됨' : '📝 활성', inline: true }
        )
        .setFooter({ text: `메모 ID: ${memo.id.substr(0, 8)}...` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('메모 아카이브 토글 오류:', error);
      await interaction.editReply({
        content: '❌ 메모 아카이브 설정 중 오류가 발생했습니다.'
      });
    }
  },

  async editMemo(interaction, user) {
    const memoId = interaction.options.getString('memo_id');
    const newContent = interaction.options.getString('new_content');
    
    await interaction.deferReply();

    try {
      const memo = await models.Memo.findOne({
        where: { 
          id: { [Op.like]: `${memoId}%` },
          userId: user.id 
        }
      });

      if (!memo) {
        await interaction.editReply({
          content: `❌ 메모를 찾을 수 없습니다. ID를 확인해주세요: ${memoId}`
        });
        return;
      }

      await memo.update({ content: newContent });

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('✅ 메모가 수정되었습니다!')
        .addFields(
          { name: '📝 제목', value: memo.title || '제목 없음', inline: false },
          { name: '📄 수정된 내용', value: newContent.length > 300 ? 
            newContent.substring(0, 300) + '...' : newContent, inline: false }
        )
        .setFooter({ text: `메모 ID: ${memo.id.substr(0, 8)}...` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('메모 수정 오류:', error);
      await interaction.editReply({
        content: '❌ 메모 수정 중 오류가 발생했습니다.'
      });
    }
  },

  async deleteMemo(interaction, user) {
    const memoId = interaction.options.getString('memo_id');
    
    await interaction.deferReply();

    try {
      const memo = await models.Memo.findOne({
        where: { 
          id: { [Op.like]: `${memoId}%` },
          userId: user.id 
        }
      });

      if (!memo) {
        await interaction.editReply({
          content: `❌ 메모를 찾을 수 없습니다. ID를 확인해주세요: ${memoId}`
        });
        return;
      }

      await memo.destroy();

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🗑️ 메모가 삭제되었습니다')
        .addFields(
          { name: '삭제된 메모', value: memo.title || '제목 없음', inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('메모 삭제 오류:', error);
      await interaction.editReply({
        content: '❌ 메모 삭제 중 오류가 발생했습니다.'
      });
    }
  },

  // 유틸리티 함수들
  getFilterText(category, pinnedOnly, excludeArchived) {
    const parts = [];
    if (category) parts.push(`"${category}" 카테고리`);
    if (pinnedOnly) parts.push('고정된');
    if (excludeArchived) parts.push('활성');
    
    return parts.length > 0 ? parts.join(' ') + ' 메모' : '모든 메모';
  },

  calculateMemoStats(memos) {
    const stats = {
      total: memos.length,
      pinned: 0,
      archived: 0,
      withAttachments: 0,
      aiExtracted: 0
    };

    memos.forEach(memo => {
      if (memo.isPinned) stats.pinned++;
      if (memo.isArchived) stats.archived++;
      if (memo.attachments && memo.attachments.length > 0) stats.withAttachments++;
      if (memo.aiExtracted) stats.aiExtracted++;
    });

    return stats;
  },

  createMemoListEmbed(memos, currentPage, totalPages, stats, categoryFilter, pinnedOnly) {
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📝 메모 목록')
      .setDescription(
        `총 ${stats.total}개의 메모 (${currentPage}/${totalPages} 페이지)\n` +
        `📊 **통계**: 📌 ${stats.pinned} | 📦 ${stats.archived} | 📎 ${stats.withAttachments} | 🤖 ${stats.aiExtracted}`
      )
      .setTimestamp();

    // 필터 정보 표시
    const filters = [];
    if (categoryFilter) filters.push(`카테고리: ${categoryFilter}`);
    if (pinnedOnly) filters.push('고정메모만');
    
    if (filters.length > 0) {
      embed.addFields({
        name: '🔍 적용된 필터',
        value: filters.join(' | '),
        inline: false
      });
    }

    memos.forEach((memo, index) => {
      const title = memo.title || '제목 없음';
      const pinnedIcon = memo.isPinned ? '📌' : '';
      const archivedIcon = memo.isArchived ? '📦' : '';
      const attachmentIcon = memo.attachments && memo.attachments.length > 0 ? '📎' : '';
      const aiIcon = memo.aiExtracted ? '🤖' : '';
      
      const preview = memo.content.length > 100 ? 
        memo.content.substring(0, 100) + '...' : memo.content;
      
      embed.addFields({
        name: `${pinnedIcon}${archivedIcon}${attachmentIcon}${aiIcon} ${title}`,
        value: `${preview}\n` +
               `📁 ${memo.category?.name || '없음'} | 📅 ${memo.updatedAt.toLocaleDateString('ko-KR')} | ID: \`${memo.id.substr(0, 8)}...\``,
        inline: false
      });
    });

    return embed;
  },

  highlightKeyword(text, keyword) {
    const maxLength = 150;
    const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase());
    
    if (keywordIndex === -1) {
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // 키워드 주변 텍스트 추출
    const start = Math.max(0, keywordIndex - 50);
    const end = Math.min(text.length, keywordIndex + keyword.length + 50);
    
    let preview = text.substring(start, end);
    if (start > 0) preview = '...' + preview;
    if (end < text.length) preview = preview + '...';
    
    // 키워드 강조 (Discord markdown 사용)
    const regex = new RegExp(`(${keyword})`, 'gi');
    preview = preview.replace(regex, '**$1**');
    
    return preview;
  }
}; 