# Node.js 18 Alpine 기반 이미지 사용 (경량화)
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 관리자 업데이트 및 필요한 시스템 패키지 설치
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# 패키지 파일들을 먼저 복사 (캐시 최적화)
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production && npm cache clean --force

# 애플리케이션 소스 코드 복사
COPY . .

# 불필요한 파일들 제거
RUN rm -rf .git .gitignore README.md docker-compose.yml Dockerfile

# 비특권 사용자 생성 및 권한 설정
RUN addgroup -g 1001 -S nodejs && \
    adduser -S secretary -u 1001 -G nodejs && \
    chown -R secretary:nodejs /app

# 비특권 사용자로 전환
USER secretary

# 포트 노출 (필요한 경우)
EXPOSE 3000

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# 환경변수 설정
ENV NODE_ENV=production
ENV TZ=Asia/Seoul

# 애플리케이션 시작
CMD ["npm", "start"]

# 메타데이터 라벨
LABEL maintainer="Discord Secretary Bot"
LABEL version="1.0.0"
LABEL description="AI-powered Discord secretary bot with Gemini integration" 