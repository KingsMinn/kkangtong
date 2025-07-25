const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 환경변수 검증
const requiredEnvVars = ['DISCORD_TOKEN', 'GUILD_ID'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ 필수 환경변수가 설정되지 않았습니다: ${missingEnvVars.join(', ')}`);
  console.error('📝 env.template 파일을 참고하여 .env 파일을 생성해주세요.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// 모든 커맨드 데이터 수집
console.log('🔄 커맨드 데이터 수집 중...');
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`✅ ${command.data.name} 커맨드 로드됨`);
  } else {
    console.warn(`⚠️  ${filePath}에서 "data" 또는 "execute" 속성이 누락되었습니다.`);
  }
}

console.log(`\n📊 총 ${commands.length}개의 커맨드를 등록합니다:`);
commands.forEach(cmd => {
  console.log(`  • /${cmd.name} - ${cmd.description}`);
});

// REST 클라이언트 생성 및 토큰 설정
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// 커맨드 배포 함수
const deployCommands = async () => {
  try {
    console.log('\n🚀 Discord API에 슬래시 커맨드 등록 시작...');

    // 길드에 커맨드 등록 (개발 중에는 길드 커맨드 사용)
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID || 'CLIENT_ID_PLACEHOLDER', process.env.GUILD_ID),
      { body: commands },
    );

    console.log(`✅ ${data.length}개의 슬래시 커맨드가 성공적으로 등록되었습니다!`);
    
    // 등록된 커맨드 목록 표시
    console.log('\n📋 등록된 커맨드 목록:');
    data.forEach(cmd => {
      console.log(`  • /${cmd.name} (ID: ${cmd.id})`);
    });

    console.log('\n🎉 배포 완료! 이제 Discord 서버에서 슬래시 커맨드를 사용할 수 있습니다.');
    console.log('💡 봇을 시작하려면: npm start');

  } catch (error) {
    console.error('\n❌ 커맨드 등록 중 오류 발생:', error);
    
    if (error.code === 50001) {
      console.error('🔐 봇에 애플리케이션 커맨드 생성 권한이 없습니다.');
      console.error('   Discord 개발자 포털에서 봇 권한을 확인해주세요.');
    } else if (error.code === 10004) {
      console.error('🏗️  잘못된 Guild ID입니다. GUILD_ID 환경변수를 확인해주세요.');
    } else if (error.code === 0) {
      console.error('🔑 잘못된 봇 토큰입니다. DISCORD_TOKEN 환경변수를 확인해주세요.');
    }
    
    process.exit(1);
  }
};

// 전역 커맨드 배포 함수 (프로덕션용)
const deployGlobalCommands = async () => {
  try {
    console.log('\n🌍 전역 슬래시 커맨드 등록 시작...');
    console.log('⚠️  전역 커맨드는 반영되는데 최대 1시간이 소요될 수 있습니다.');

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID || 'CLIENT_ID_PLACEHOLDER'),
      { body: commands },
    );

    console.log(`✅ ${data.length}개의 전역 슬래시 커맨드가 성공적으로 등록되었습니다!`);
    console.log('🕐 전역 커맨드가 모든 서버에 적용되는데 최대 1시간이 소요됩니다.');

  } catch (error) {
    console.error('\n❌ 전역 커맨드 등록 중 오류 발생:', error);
    process.exit(1);
  }
};

// 커맨드 삭제 함수
const deleteCommands = async () => {
  try {
    console.log('\n🗑️  모든 슬래시 커맨드 삭제 중...');

    // 길드 커맨드 삭제
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID || 'CLIENT_ID_PLACEHOLDER', process.env.GUILD_ID),
      { body: [] },
    );

    console.log('✅ 모든 길드 커맨드가 삭제되었습니다.');

  } catch (error) {
    console.error('\n❌ 커맨드 삭제 중 오류 발생:', error);
    process.exit(1);
  }
};

// CLI 인터페이스
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'global':
    console.log('🌍 전역 커맨드 배포 모드');
    deployGlobalCommands();
    break;
  case 'delete':
    console.log('🗑️  커맨드 삭제 모드');
    deleteCommands();
    break;
  case 'help':
    console.log(`
📚 Discord Secretary Bot - 커맨드 배포 도구

사용법:
  node deploy-commands.js          길드 커맨드 배포 (개발용)
  node deploy-commands.js global   전역 커맨드 배포 (프로덕션용)
  node deploy-commands.js delete   모든 커맨드 삭제
  node deploy-commands.js help     이 도움말 표시

환경변수:
  DISCORD_TOKEN  Discord 봇 토큰
  CLIENT_ID      Discord 애플리케이션 ID (전역 배포 시 필요)
  GUILD_ID       Discord 서버 ID (길드 배포 시 필요)

💡 개발 중에는 길드 커맨드를, 프로덕션에서는 전역 커맨드를 사용하세요.
`);
    break;
  default:
    console.log('🏠 길드 커맨드 배포 모드 (기본값)');
    deployCommands();
    break;
}

// 프로그램 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n\n👋 배포 스크립트를 종료합니다.');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 