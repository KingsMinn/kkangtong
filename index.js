const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./database');

// Discord 클라이언트 생성
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // 메시지 내용 읽기 위해 필수!
    GatewayIntentBits.DirectMessages
  ]
});

// AI 서비스 불러오기
const aiService = require('./services/aiService');
const { models } = require('./database');

// 커맨드 컬렉션 생성
client.commands = new Collection();

// 환경변수 검증
const requiredEnvVars = ['DISCORD_TOKEN', 'GUILD_ID'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ 필수 환경변수가 설정되지 않았습니다: ${missingEnvVars.join(', ')}`);
  console.error('📝 env.template 파일을 참고하여 .env 파일을 생성해주세요.');
  process.exit(1);
}

// 커맨드 로딩 함수
const loadCommands = () => {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ 커맨드 로드됨: ${command.data.name}`);
    } else {
      console.warn(`⚠️  ${filePath}에서 "data" 또는 "execute" 속성이 누락되었습니다.`);
    }
  }
};

// 이벤트 핸들러 로딩 함수
const loadEvents = () => {
  const eventsPath = path.join(__dirname, 'events');
  
  // events 폴더가 없으면 생성
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath);
  }
  
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    
    console.log(`✅ 이벤트 로드됨: ${event.name}`);
  }
};

// 봇 초기화 함수
const initializeBot = async () => {
  try {
    console.log('🚀 Discord Secretary Bot 시작 중...');
    
    // 데이터베이스 연결
    await connectDB();
    
    // 커맨드 및 이벤트 로딩
    loadCommands();
    loadEvents();
    
    // Discord 로그인
    await client.login(process.env.DISCORD_TOKEN);
    
  } catch (error) {
    console.error('❌ 봇 초기화 실패:', error);
    process.exit(1);
  }
};

// 기본 이벤트 핸들러 (events 폴더가 비어있을 때를 위한 백업)
client.once('ready', () => {
  console.log(`✅ ${client.user.tag}로 로그인되었습니다!`);
  console.log(`📊 ${client.guilds.cache.size}개의 서버에서 활동 중`);

  // 봇 상태 설정
  client.user.setActivity('자연어로 대화해보세요!', { type: 'LISTENING' });
});

// 🤖 자연어 메시지 처리 핸들러 (완전히 새로운 AI 중심 방식!)
client.on('messageCreate', async (message) => {
  // 봇 자신의 메시지나 다른 봇 메시지 무시
  if (message.author.bot) return;
  
  // 메시지 디버깅 정보 출력
  console.log(`🔍 디버깅: 메시지 타입=${message.type}, 내용=[${message.content}], 길이=${message.content?.length || 0}, 임베드=${message.embeds?.length || 0}, 첨부파일=${message.attachments?.size || 0}`);
  
  // 빈 메시지 체크 로직을 더 관대하게 수정
  if (!message.content && message.embeds.length === 0 && message.attachments.size === 0) {
    console.log('⚠️ 완전히 빈 메시지 무시됨');
    return;
  }
  
  // 텍스트 내용이 있으면 처리 (임베드나 첨부파일만 있어도 처리)
  
  // 이제 멘션 없이도 모든 메시지에 응답! (DM은 당연히 응답)
  // 혹시 특정 채널에서만 작동하게 하려면 여기서 채널 체크 가능
  
  try {
    console.log(`📝 메시지 받음: [${message.content}] (길이: ${message.content?.length || 0})`);
    
    // 사용자 정보 확인/생성
    let user = await models.User.findOne({ 
      where: { discordId: message.author.id } 
    });
    
    if (!user) {
      user = await models.User.create({
        discordId: message.author.id,
        username: message.author.username,
        displayName: message.author.displayName || message.author.username,
        avatar: message.author.displayAvatarURL()
      });
      console.log(`👤 새 사용자 등록: ${user.username}`);
    }
    
    // 메시지 분석 시작
    await message.channel.sendTyping();
    
    // 🧠 AI가 모든 것을 처리!
    await handleAIResponse(message, user);
    
  } catch (error) {
    console.error('💥 메시지 처리 오류:', error);
    await message.reply('죄송합니다. 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
});

// 🧠 AI가 모든 것을 처리하는 핵심 함수
async function handleAIResponse(message, user) {
  // 사용자 메시지 대화 기록에 저장
  await models.Conversation.create({
    userId: user.id,
    channelId: message.channel.id,
    messageId: message.id,
    role: 'user',
    content: message.content || '[이미지 첨부]',
    timestamp: message.createdAt
  });

  // 이미지가 첨부된 경우 이미지 분석
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    
    // 이미지 파일인지 확인 (MIME 타입 체크)
    if (attachment.contentType && attachment.contentType.startsWith('image/')) {
      console.log(`🖼️ 이미지 첨부됨: ${attachment.name} (${attachment.contentType})`);
      
      try {
        await message.channel.sendTyping();
        
        // 현재 시각 정보
        const now = new Date();
        const koreanTime = new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false
        }).format(now);

        // 이미지 분석 수행
        const imageAnalysis = await aiService.analyzeImage(
          attachment.url,
          `현재 정확한 시각: ${koreanTime}
          
          이 이미지를 분석해주세요. 햄이 보낸 이미지입니다. 
          메시지 내용: "${message.content || '(메시지 없음)'}"
          
          이미지에 텍스트가 있다면 OCR로 읽어주고, 내용을 파악해서 일정, 할일, 메모로 저장할 수 있는지 판단해주세요.
          항상 "!!!!! 다나까" 말투로 응답하세요.`,
          attachment.contentType
        );
        
        if (imageAnalysis.success) {
          const sentMessage = await message.reply(`🖼️ **이미지 분석 결과다나까!!!!!**\n\n${imageAnalysis.response}`);
          
          // 이미지 분석 결과도 대화 기록에 저장
          await models.Conversation.create({
            userId: user.id,
            channelId: message.channel.id,
            messageId: sentMessage.id,
            role: 'assistant',
            content: `🖼️ 이미지 분석: ${imageAnalysis.response}`,
            timestamp: sentMessage.createdAt
          });
          
          console.log(`💬 이미지 분석 결과 저장됨`);
        } else {
          await message.reply('🖼️ 이미지 분석 중 오류가 발생했다나까!!!!! 다시 시도해주시다나까!!!!!');
        }
        
        return; // 이미지 처리 후 일반 텍스트 처리는 하지 않음
        
      } catch (error) {
        console.error('🖼️ 이미지 처리 오류:', error);
        await message.reply('🖼️ 이미지 처리 중 문제가 발생했다나까!!!!! 다시 시도해주시다나까!!!!!');
        return;
      }
    }
  }

  // 멘션 제거 로직 개선
  let userMessage = message.content;
  if (userMessage && userMessage.includes(`<@${client.user.id}>`)) {
    userMessage = userMessage.replace(`<@${client.user.id}>`, '').trim();
  }
  
  // 혹시 빈 문자열이 되면 원본 사용
  if (!userMessage || userMessage.trim() === '') {
    userMessage = message.content || '(빈 메시지)';
  }
  
  // URL이 포함된 경우 URL 분석
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = userMessage.match(urlRegex);
  
  if (urls && urls.length > 0) {
    const url = urls[0]; // 첫 번째 URL만 처리
    console.log(`🌐 URL 감지됨: ${url}`);
    
    try {
      await message.channel.sendTyping();
      
      // 현재 시각 정보
      const now = new Date();
      const koreanTime = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).format(now);
      
      // URL 내용 분석
      const urlAnalysis = await aiService.analyzeUrl(url, `현재 정확한 시각: ${koreanTime}\n\n${userMessage}`);
      
      if (urlAnalysis.success) {
        const jsonMatch = urlAnalysis.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiResponse = JSON.parse(jsonMatch[0]);
          
          // URL 분석 결과 전송
          const sentMessage = await message.reply(`🌐 **링크 분석 결과다나까!!!!!**\n\n${aiResponse.response}`);
          
          // URL 분석 결과도 대화 기록에 저장
          await models.Conversation.create({
            userId: user.id,
            channelId: message.channel.id,
            messageId: sentMessage.id,
            role: 'assistant',
            content: `🌐 URL 분석: ${aiResponse.response}`,
            timestamp: sentMessage.createdAt
          });
          
          console.log(`💬 URL 분석 결과 저장됨`);
          
          // 메모로 저장할 가치가 있다면 제안
          if (aiResponse.data && aiResponse.data.canSaveAsMemo) {
            setTimeout(async () => {
              await message.channel.send(`💡 **이 내용을 메모로 저장할까요다나까?!!!!!**\n"메모 저장해줘"라고 말씀해주시다나까!!!!!`);
            }, 2000);
          }
          
        } else {
          // JSON 파싱 실패 시 직접 응답
          const sentMessage = await message.reply(`🌐 **링크 분석 결과다나까!!!!!**\n\n${urlAnalysis.response}`);
          
          await models.Conversation.create({
            userId: user.id,
            channelId: message.channel.id,
            messageId: sentMessage.id,
            role: 'assistant',
            content: `🌐 URL 분석: ${urlAnalysis.response}`,
            timestamp: sentMessage.createdAt
          });
        }
        
        return; // URL 처리 후 일반 텍스트 처리는 하지 않음
        
      } else {
        await message.reply(urlAnalysis.response); // 이미 에러 메시지가 포함됨
        return;
      }
      
    } catch (error) {
      console.error('🌐 URL 처리 오류:', error);
      await message.reply('🌐 링크 분석 중 문제가 발생했다나까!!!!! 다시 시도해주시다나까!!!!!');
      return;
    }
  }
  
  console.log(`🧠 AI에게 전달할 메시지: [${userMessage}] (원본: [${message.content}])`);
  
  // 최근 대화 기록 가져오기 (최근 8개로 설정)
  const recentConversations = await models.Conversation.findAll({
    where: { 
      userId: user.id,
      channelId: message.channel.id 
    },
    order: [['timestamp', 'DESC']],
    limit: 8
  });
  
  // 현재 시각 정보 추가 (한국 시간)
  const now = new Date();
  const koreanTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).format(now);

  // 시스템 프롬프트 (역할 정의만)
  const systemPrompt = `당신은 '햄'을 보좌하는 충실한 비서 '깡통'입니다.
한국어로 응답, 말끝은 다나까로 끝내고, !!! 붙이기
**기능:**
1.  **일정 확인:** 내가 "오늘 일정 뭐야?", "내일 뭐 해야 해?"라고 물으면, 내 구글 캘린더를 확인하고 내가 이전에 너에게 알려준 할 일 목록을 종합해서 알려줘.
2.  **할 일 추가:** 내가 "OO 해야 해", "OO 기억해줘"라고 말하면, 그걸 할 일 목록에 추가해줘. 구체적인 시간이나 날짜를 말하면 거기에 맞춰서 기억해줘.
3.  **할 일 완료:** 내가 "OO 했어", "OO 끝냈어"라고 말하면, 해당 할 일을 완료된 것으로 표시하고 목록에서 이동시켜줘.
4.  **정보 기억:** 내가 특정 정보(예: 웹사이트 링크, 아이디어)를 "이거 기억해줘"라고 말하면, 나중에 내가 물어볼 때 다시 알려줄 수 있도록 기억해 줘.
5.  **제안/추천:** 내가 "지금 뭐하면 좋을까?", "오늘 남은 시간 활용 추천해 줘"라고 물으면, 현재 시간과 남은 할 일을 고려해서 현실적이고 우선순위가 높은 일들을 추천해 줘.

**출력 형식:**
* 할 일 목록을 보여줄 때는 이모지(⬜: 미완료, ✅: 완료)를 사용해서 구분해 줘.
* 할 일 목록은 다음 세 가지 카테고리로 나눠서 출력해 줘:
    * **✅ 방금 완료된 항목:** 내가 가장 최근에 완료했다고 말한 항목.
    * **📝 현재 해야 할 항목:** 아직 완료되지 않은 모든 할 일.
    * **✅ 이전에 완료된 항목:** 방금 완료된 항목 이전에 내가 완료했다고 말한 모든 항목.
* 너무 많은 할 일을 한 번에 보여줘서 부담을 주지 않도록, 질문의 의도에 맞춰 핵심적인 내용만 우선적으로 알려줘.

**예시:**
나: "나 피그마 컴포넌트 작업해야 해."
너: "네 햄!!!, 피그마 컴포넌트 작업 항목을 추가했습니다까!! 현재 할 일 목록은 다음과 같습니다까: 📝 까그마 컴포넌트 작업"

나: "피그마 컴포넌트 작업 끝냈어."
너: "네 햄!, 피그마 컴포넌트 작업을 완료 처리했습니다나까!!!.
✅ 방금 완료된 항목: 피그마 컴포넌트 작업
📝 현재 해야 할 항목: (남은 목록)"

현재 시각: ${koreanTime}

다음 기능들을 수행할 수 있습니다:
1. 일정 추가 - CREATE_SCHEDULE
2. 할일 추가 - CREATE_TASK  
3. 메모 저장 - CREATE_MEMO
4. 검색 - SEARCH
5. 일정 목록 보기 - LIST_SCHEDULES
6. 할일 목록 보기 - LIST_TASKS
7. 일반 대화 - CHAT

응답 형식:
{
  "action": "수행할_액션", 
  "response": "사용자에게_보낸_응답",
  "data": {
    // 필요한 경우에만 포함
    "title": "제목",
    "content": "내용", 
    "date": "날짜시간",
    "tags": ["태그1", "태그2"],
    "keywords": ["검색키워드"]
  }
}`;

  // 대화 히스토리를 자연스러운 contents 배열로 구성
  const contents = [];
  
  // 시스템 프롬프트를 첫 번째 메시지로
  contents.push({
    "role": "user",
    "parts": [{"text": systemPrompt}]
  });
  contents.push({
    "role": "model", 
    "parts": [{"text": "네 헴!!!!! 비서 깡통으로서 최선을 다해 도와드리겠다나까!!!!! 무엇이든 말씀해주시다나까!!!!!"}]
  });
  
  // 이전 대화들을 자연스럽게 추가 (시간순으로 정렬)
  const sortedConversations = recentConversations
    .reverse() // 오래된 것부터
    .slice(0, -1); // 방금 저장한 메시지 제외
    
  for (const conv of sortedConversations) {
    contents.push({
      "role": conv.role === 'user' ? 'user' : 'model',
      "parts": [{"text": conv.content}]
    });
  }
  
  // 현재 사용자 메시지 추가
  contents.push({
    "role": "user",
    "parts": [{"text": userMessage}]
  });

  console.log('🧠 전송할 대화 내용:', JSON.stringify(contents, null, 2));

  try {
    const aiResult = await aiService.generateResponse(contents);
    
    if (aiResult.success) {
      const jsonMatch = aiResult.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiResponse = JSON.parse(jsonMatch[0]);
        
        // AI가 지시한 액션 수행
        await executeAIAction(aiResponse, message, user);
      } else {
        // JSON 파싱 실패 시 AI 응답을 그대로 사용
        const sentMessage = await message.reply(aiResult.response);
        
        // 봇의 응답 대화 기록에 저장
        await models.Conversation.create({
          userId: user.id,
          channelId: message.channel.id,
          messageId: sentMessage.id,
          role: 'assistant',
          content: aiResult.response,
          timestamp: sentMessage.createdAt
        });
        
        console.log(`💬 대화 기록 저장됨 (직접 응답): [${aiResult.response.slice(0, 50)}...]`);
      }
    } else {
      const errorResponse = '죄송합니다. 잠시 후 다시 시도해주세요.';
      const sentMessage = await message.reply(errorResponse);
      
      // 에러 응답도 대화 기록에 저장
      await models.Conversation.create({
        userId: user.id,
        channelId: message.channel.id,
        messageId: sentMessage.id,
        role: 'assistant',
        content: errorResponse,
        timestamp: sentMessage.createdAt
      });
    }
  } catch (error) {
    console.error('AI 처리 오류:', error);
    const errorResponse = 'AI 처리 중 오류가 발생했습니다.';
    const sentMessage = await message.reply(errorResponse);
    
    // 에러 응답도 대화 기록에 저장
    await models.Conversation.create({
      userId: user.id,
      channelId: message.channel.id,
      messageId: sentMessage.id,
      role: 'assistant',
      content: errorResponse,
      timestamp: sentMessage.createdAt
    });
  }
}

// 🎯 AI가 지시한 액션을 실제로 수행하는 함수
async function executeAIAction(aiResponse, message, user) {
  try {
    switch (aiResponse.action) {
      case 'CREATE_SCHEDULE':
        if (aiResponse.data) {
          await models.Item.create({
            userId: user.id,
            type: 'schedule',
            title: aiResponse.data.title || '새 일정',
            content: aiResponse.data.content,
            startDate: aiResponse.data.date || new Date(),
            tags: aiResponse.data.tags || [],
            aiExtracted: true
          });
        }
        break;
        
      case 'CREATE_TASK':
        if (aiResponse.data) {
          await models.Item.create({
            userId: user.id,
            type: 'task',
            title: aiResponse.data.title || '새 할일',
            content: aiResponse.data.content,
            dueDate: aiResponse.data.date,
            tags: aiResponse.data.tags || [],
            aiExtracted: true
          });
        }
        break;
        
      case 'CREATE_MEMO':
        await models.Item.create({
          userId: user.id,
          type: 'memo',
          title: aiResponse.data?.title,
          content: aiResponse.data?.content || message.content,
          tags: aiResponse.data?.tags || [],
          aiExtracted: true
        });
        break;
        
      case 'SEARCH':
        const keywords = aiResponse.data?.keywords || [aiResponse.data?.content];
        const searchResults = await searchUserData(user.id, keywords);
        aiResponse.response += `\n\n${formatSearchResults(searchResults)}`;
        break;
        
      case 'LIST_SCHEDULES':
        const schedules = await models.Item.findAll({
          where: { 
            userId: user.id,
            type: 'schedule'
          },
          order: [['startDate', 'ASC']],
          limit: 5
        });
        aiResponse.response += `\n\n${formatScheduleList(schedules)}`;
        break;
        
      case 'LIST_TASKS':
        const tasks = await models.Item.findAll({
          where: { 
            userId: user.id,
            type: 'task',
            status: { [require('sequelize').Op.ne]: 'completed' }
          },
          order: [['createdAt', 'ASC']],
          limit: 5
        });
        aiResponse.response += `\n\n${formatTaskList(tasks)}`;
        break;
    }
    
    // 최종 응답 전송
    const sentMessage = await message.reply(aiResponse.response);
    
    // 봇의 응답도 대화 기록에 저장
    await models.Conversation.create({
      userId: user.id,
      channelId: message.channel.id,
      messageId: sentMessage.id,
      role: 'assistant',
      content: aiResponse.response,
      timestamp: sentMessage.createdAt
    });
    
    console.log(`💬 대화 기록 저장됨: [${aiResponse.response.slice(0, 50)}...]`);
    
  } catch (error) {
    console.error('액션 실행 오류:', error);
    await message.reply('작업 수행 중 오류가 발생했습니다.');
  }
}

// 🔍 통합 검색 함수
async function searchUserData(userId, keywords) {
  const results = [];
  
  for (const keyword of keywords) {
    // 통합 아이템 검색 (일정, 할일, 메모 모두)
    const items = await models.Item.findAll({
      where: {
        userId: userId,
        [require('sequelize').Op.or]: [
          { title: { [require('sequelize').Op.like]: `%${keyword}%` } },
          { content: { [require('sequelize').Op.like]: `%${keyword}%` } },
          { tags: { [require('sequelize').Op.like]: `%${keyword}%` } }
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    results.push(...items.map(item => ({ 
      type: item.type === 'schedule' ? '📅 일정' : item.type === 'task' ? '📋 할일' : '📝 메모',
      title: item.title || item.content.slice(0, 30),
      content: item.content,
      tags: item.tags,
      date: item.startDate || item.dueDate || item.createdAt
    })));
  }
  
  return results;
}

// 📋 결과 포맷팅 함수들
function formatSearchResults(results) {
  if (results.length === 0) return '🔍 검색 결과가 없습니다.';
  
  return '🔍 **검색 결과:**\n' + 
    results.map((r, i) => {
      const tags = r.tags && r.tags.length > 0 ? ` #${r.tags.join(' #')}` : '';
      return `${i + 1}. ${r.type}: **${r.title}**${tags}`;
    }).join('\n');
}

function formatScheduleList(schedules) {
  if (schedules.length === 0) return '📅 등록된 일정이 없습니다.';
  
  return '📅 **다가오는 일정:**\n' +
    schedules.map((s, i) => `${i + 1}. **${s.title}** - ${s.startDate}`).join('\n');
}

function formatTaskList(tasks) {
  if (tasks.length === 0) return '📋 진행 중인 할일이 없습니다.';
  
  return '📋 **할일 목록:**\n' +
    tasks.map((t, i) => `${i + 1}. **${t.title}**${t.dueDate ? ` (마감: ${t.dueDate})` : ''}`).join('\n');
}

// 슬래시 커맨드 핸들러 (보조적 역할)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('❌ 커맨드 실행 중 오류:', error);
    const errorMessage = '명령어 실행 중 오류가 발생했습니다.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// 예상치 못한 오류 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// 봇 초기화 실행
if (require.main === module) {
  initializeBot();
}

module.exports = client;
