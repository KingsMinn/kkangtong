# 🤖 Discord Secretary Bot

AI 기반 개인 비서 Discord 봇입니다. Google Gemini 2.5 Flash-lite와 Pro 모델을 활용하여 자연어로 일정, 할일, 메모를 스마트하게 관리해드립니다.

## ✨ 주요 기능

### 📅 **일정 관리**

- 자연어로 일정 추가: "내일 오후 3시에 팀 회의"
- AI 자동 파싱으로 날짜, 시간, 장소 추출
- 기간별/상태별 필터링으로 일정 조회
- 알림 설정 및 수정/삭제 기능

### ✅ **할일 관리**

- 우선순위, 마감일 자동 설정
- 진행률 추적 및 시간 효율성 분석
- 하위 작업 자동 분해
- 상태별/우선순위별 필터링

### 📝 **메모 관리**

- 이미지 OCR 분석으로 텍스트 자동 추출
- AI 기반 스마트 검색 (의미적 검색)
- 고정, 아카이브, 카테고리 관리
- 키워드 하이라이팅 검색 결과

### 🤖 **AI 기능**

- **하이브리드 모델**: Flash-lite(빠름+저렴) + Pro(복잡한 분석)
- 복잡도 자동 판단으로 최적 모델 선택
- 자연어 파싱 및 의도 분석
- 이미지에서 일정/할일 정보 추출

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd discord-secretary

# 의존성 설치
npm install

# 환경변수 설정
cp env.template .env
# .env 파일을 편집하여 토큰과 API 키 설정
```

### 2. 환경변수 설정 (.env)

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
GUILD_ID=your_discord_server_id_here

# Google Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=discord_secretary
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# Bot Configuration
BOT_PREFIX=!
PROACTIVE_CHECK_INTERVAL=*/30 * * * *

# AI Configuration
USE_GEMINI_PRO_THRESHOLD=0.7
```

### 3. 데이터베이스 설정

PostgreSQL을 설치하고 데이터베이스를 생성하세요:

```sql
CREATE DATABASE discord_secretary;
CREATE USER secretary_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE discord_secretary TO secretary_user;
```

### 4. Discord 봇 설정

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 애플리케이션 생성
2. Bot 탭에서 봇 토큰 복사
3. OAuth2 → URL Generator에서 다음 권한 선택:
   - `bot`
   - `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Read Message History`

### 5. 커맨드 배포 및 실행

```bash
# 슬래시 커맨드 등록
npm run deploy

# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm start
```

## 📋 사용 가능한 커맨드

### 📅 일정 관리

- `/schedule add 내용:"내일 오후 3시 회의" [카테고리]` - 일정 추가
- `/schedule list [기간] [상태]` - 일정 목록 조회
- `/schedule edit 일정ID 수정내용` - 일정 수정
- `/schedule delete 일정ID` - 일정 삭제

### ✅ 할일 관리

- `/task add 내용:"긴급히 보고서 작성 - 2시간 소요" [카테고리]` - 할일 추가
- `/task list [상태] [우선순위]` - 할일 목록 조회
- `/task complete 할일ID` - 할일 완료 처리
- `/task progress 할일ID 진행률:50` - 진행률 설정
- `/task edit 할일ID 수정내용` - 할일 수정
- `/task delete 할일ID` - 할일 삭제

### 📝 메모 관리

- `/memo add 내용:"회의록" [제목] [카테고리] [이미지]` - 메모 추가
- `/memo list [카테고리] [고정메모만] [아카이브제외]` - 메모 목록
- `/memo search 키워드:"프로젝트" [검색범위]` - 메모 검색
- `/memo pin 메모ID` - 메모 고정/해제
- `/memo archive 메모ID` - 메모 아카이브/복원
- `/memo edit 메모ID 새내용` - 메모 수정
- `/memo delete 메모ID` - 메모 삭제

### 🔧 기타

- `/help [카테고리]` - 도움말 보기
- `/ping` - 봇 응답 시간 확인

## 🏗️ 아키텍처

### 🗄️ 데이터베이스 구조

- **Users**: 사용자 정보 및 설정
- **Categories**: 분류 관리
- **Schedules**: 일정 데이터
- **Tasks**: 할일 데이터
- **Memos**: 메모 데이터
- **Reminders**: 알림 시스템

### 🤖 AI 시스템

```
복잡도 분석 → 모델 선택 (Flash-lite/Pro) → 자연어 처리 → 구조화된 데이터
```

- **Flash-lite**: 일반적인 파싱, 단순 분석 (빠름, 저렴)
- **Pro**: 복잡한 추론, 의미적 검색 (정확함)

## 🐳 Docker 배포

### docker-compose.yml

```yaml
version: "3.8"
services:
  secretary-bot:
    build: .
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: discord_secretary
      POSTGRES_USER: secretary_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### 배포 명령

```bash
# Docker 이미지 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f secretary-bot
```

## 📊 성능 최적화

### AI 비용 최적화

- Flash-lite 우선 사용으로 **80% 비용 절약**
- 복잡도 임계값 조정으로 정확도/비용 균형
- 캐싱을 통한 중복 요청 방지

### 데이터베이스 최적화

- PostgreSQL JSONB 활용으로 유연한 스키마
- 적절한 인덱싱으로 빠른 검색
- 관계형 구조로 데이터 정합성 보장

## 🔧 개발 가이드

### 새 커맨드 추가

1. `commands/` 폴더에 새 파일 생성
2. SlashCommandBuilder로 커맨드 정의
3. `npm run deploy`로 Discord에 등록

### AI 서비스 확장

1. `services/aiService.js`에 새 메서드 추가
2. 복잡도 분석 로직 조정
3. 프롬프트 엔지니어링 최적화

### 데이터베이스 스키마 변경

1. `database/models/`에서 모델 수정
2. Sequelize migration 생성 (필요시)
3. `npm run dev`로 개발 환경에서 테스트

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 라이선스

This project is licensed under the ISC License.

## 🙏 감사의 말

- **Google Gemini AI** - 강력한 자연어 처리
- **Discord.js** - 완벽한 Discord API 래퍼
- **PostgreSQL** - 안정적인 데이터베이스
- **Sequelize** - 편리한 ORM

---

💡 **팁**: 자연어로 편하게 입력하세요! AI가 알아서 파싱해드립니다.
🚀 **성능**: Flash-lite/Pro 하이브리드로 빠르고 정확한 처리
🔒 **보안**: 개인 서버 전용으로 데이터 보안 완벽

**Made with ❤️ for productivity**
